import { supabase } from '../supabase';
import { handleError } from '../errorHandler';
import { validateTime, validateDate } from '../validations';
import { checkAppointmentConflicts } from '../utils';
import { notifyAppointmentRequested } from '../notifications';
import { logger } from '../logger';
import type { BookingPaymentMethod } from '../services/bookingTypes';

/** Dados que a tela de confirmação já tem em mãos ao confirmar. */
export interface AppointmentDraft {
  businessId: number;
  serviceId: number;
  serviceName: string;
  durationMinutes: number;
  /** yyyy-MM-dd */
  date: string;
  /** HH:mm */
  time: string;
  paymentMethod: BookingPaymentMethod;
  observations: string;
}

export type BookingErrorCode =
  | 'unauthenticated'
  | 'invalid_time'
  | 'past_date'
  | 'conflict'
  | 'insert_failed';

/**
 * Falha de negócio ao criar o agendamento. `message` já é a copy pt-BR que a
 * tela mostra no toast; `code` decide se é aviso ou erro. Falhas inesperadas
 * (ex.: erro na consulta de conflitos) NÃO viram BookingError: sobem como
 * vieram para a tela tratar com `handleError`, como antes da extração.
 */
export class BookingError extends Error {
  constructor(
    public readonly code: BookingErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'BookingError';
  }
}

export interface CreatedAppointment {
  id: number;
  startTime: string;
  endTime: string;
}

export interface CreateAppointmentOptions {
  /**
   * Notifica o lojista ao criar (default `true`). F8: o pagamento online
   * reserva antes de cobrar com `false`; quem notifica depois é o webhook
   * (Stripe) ou a tela via `notifyAppointmentCreated` (mock).
   */
  notify?: boolean;
}

/**
 * Cria o agendamento `pending` no Supabase (extraído de `schedule/confirm.tsx`
 * sem mudança de comportamento): valida horário e data, checa conflito, insere
 * em `appointments` e notifica o lojista em best-effort (falha de notificação
 * nunca bloqueia a criação).
 */
export async function createAppointment(
  draft: AppointmentDraft,
  { notify = true }: CreateAppointmentOptions = {},
): Promise<CreatedAppointment> {
  const now = new Date();
  const startDate = new Date(`${draft.date}T${draft.time}:00`);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new BookingError('unauthenticated', 'Usuário não autenticado');
  }

  if (!validateTime(draft.time)) {
    throw new BookingError('invalid_time', 'O formato do horário é inválido. Use o formato HH:mm.');
  }

  if (!validateDate(startDate, false)) {
    throw new BookingError('past_date', 'Selecione uma data futura para o agendamento.');
  }

  if (startDate.getTime() < now.getTime()) {
    throw new BookingError('past_date', 'Selecione um horário futuro para o agendamento.');
  }

  const startTime = startDate.toISOString();
  const durationMinutes = draft.durationMinutes || 60; // Default 1 hora se não especificado
  const endTime = new Date(startDate.getTime() + durationMinutes * 60000).toISOString();

  const { hasConflict, error: conflictError } = await checkAppointmentConflicts(
    draft.businessId,
    startTime,
    endTime,
  );

  if (conflictError) {
    throw conflictError;
  }

  if (hasConflict) {
    throw new BookingError('conflict', 'Selecione outro horário, este já está ocupado.');
  }

  const { data: appointmentData, error } = await supabase
    .from('appointments')
    .insert({
      client_id: user.id,
      business_id: draft.businessId,
      service_id: draft.serviceId,
      start_time: startTime,
      end_time: endTime,
      status: 'pending',
      payment_method: draft.paymentMethod,
      client_notes: draft.observations || null,
    })
    .select()
    .single();

  if (error || !appointmentData) {
    const processed = handleError(error, 'appointment');
    throw new BookingError('insert_failed', processed.userMessage);
  }

  if (notify) {
    await notifyMerchant(user.id, draft, appointmentData.id, startTime);
  }

  return { id: appointmentData.id, startTime, endTime };
}

/**
 * Notifica o lojista de uma reserva já criada com `notify: false` (pagamento
 * online aprovado no modo mock, onde não há webhook). Best-effort: nunca lança.
 */
export async function notifyAppointmentCreated(
  draft: AppointmentDraft,
  created: CreatedAppointment,
): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await notifyMerchant(user.id, draft, created.id, created.startTime);
  } catch (error) {
    logger.warn('Erro ao notificar o lojista (não crítico):', error);
  }
}

/** Notificação ao lojista. Best-effort: erros de RLS ou rede só viram log. */
async function notifyMerchant(
  clientId: string,
  draft: AppointmentDraft,
  appointmentId: number,
  startTime: string,
): Promise<void> {
  try {
    logger.debug('Agendamento criado, buscando dados para notificação...');

    const { data: clientData, error: clientError } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', clientId)
      .single();

    if (clientError) {
      logger.error('Erro ao buscar dados do cliente:', clientError);
    }

    const { data: businessData, error: businessError } = await supabase
      .from('business_profiles')
      .select('owner_id')
      .eq('id', draft.businessId)
      .single();

    if (businessError) {
      logger.error('Erro ao buscar dados do negócio:', businessError);
    }

    const clientName = clientData?.full_name || 'Cliente';
    const merchantId = businessData?.owner_id;

    if (merchantId && appointmentId) {
      logger.debug('Enviando notificação para merchant:', merchantId);
      await notifyAppointmentRequested(
        merchantId,
        appointmentId,
        clientName,
        draft.serviceName,
        startTime,
      );
    } else {
      logger.warn('Dados incompletos para enviar notificação:', {
        hasMerchantId: !!merchantId,
        hasAppointmentId: !!appointmentId,
      });
    }
  } catch (notifError) {
    // Não bloquear o fluxo se a notificação falhar
    logger.warn('Erro ao enviar notificação de agendamento (não crítico):', notifError);
  }
}
