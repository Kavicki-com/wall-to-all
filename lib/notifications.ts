/**
 * Sistema de notificações
 */

import { supabase } from './supabase';

/**
 * Obtém a contagem de notificações não lidas para um usuário
 * @param userId - ID do usuário
 * @returns Promise com o número de notificações não lidas
 */
export const getUnreadCount = async (userId: string): Promise<number> => {
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) {
      // Se a tabela não existir, retornar 0
      if (error.code === '42P01') {
        console.warn('Tabela de notificações não encontrada.');
        return 0;
      }
      console.error('Erro ao buscar contagem de notificações:', error);
      return 0;
    }

    return count || 0;
  } catch (err) {
    console.warn('Erro ao buscar contagem de notificações (ignorado):', err);
    return 0;
  }
};

export type NotificationType = 
  | 'reschedule_accepted'
  | 'reschedule_rejected'
  | 'reschedule_requested'
  | 'reschedule_suggested'
  | 'appointment_requested'
  | 'appointment_confirmed'
  | 'appointment_cancelled';

export interface Notification {
  id?: number;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  related_id?: number | null; // Mantido para compatibilidade
  related_appointment_id?: number | null; // Nova coluna
  related_reschedule_id?: number | null; // Nova coluna
  read: boolean;
  created_at?: string;
}

/**
 * Envia uma notificação para um usuário
 * @param userId - ID do usuário que receberá a notificação
 * @param type - Tipo da notificação
 * @param title - Título da notificação
 * @param message - Mensagem da notificação
 * @param relatedAppointmentId - ID do agendamento relacionado (opcional)
 * @param relatedRescheduleId - ID do reagendamento relacionado (opcional)
 * @returns Promise com o resultado da inserção
 */
export const sendNotification = async (
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  relatedAppointmentId?: number | null,
  relatedRescheduleId?: number | null
): Promise<{ success: boolean; error?: any }> => {
  try {
    const notificationData: any = {
      user_id: userId,
      type,
      title,
      message,
      read: false,
    };

    // Adicionar related_appointment_id se fornecido
    if (relatedAppointmentId !== undefined && relatedAppointmentId !== null) {
      notificationData.related_appointment_id = relatedAppointmentId;
    }

    // Adicionar related_reschedule_id se fornecido
    if (relatedRescheduleId !== undefined && relatedRescheduleId !== null) {
      notificationData.related_reschedule_id = relatedRescheduleId;
    }

    const { error } = await supabase
      .from('notifications')
      .insert(notificationData);

    if (error) {
      // Se as colunas não existirem, tentar fallback com related_id
      if (error.code === 'PGRST204' || error.message?.includes('column')) {
        // Fallback: usar related_id se as novas colunas não existirem
        const fallbackData: any = {
          user_id: userId,
          type,
          title,
          message,
          read: false,
        };
        
        // Usar appointmentId como related_id se disponível (prioridade)
        if (relatedAppointmentId !== undefined && relatedAppointmentId !== null) {
          fallbackData.related_id = relatedAppointmentId;
        } else if (relatedRescheduleId !== undefined && relatedRescheduleId !== null) {
          fallbackData.related_id = relatedRescheduleId;
        }

        const { error: fallbackError } = await supabase
          .from('notifications')
          .insert(fallbackData);

        if (fallbackError) {
          console.warn('Erro ao enviar notificação (fallback também falhou):', fallbackError);
          return { success: false, error: null };
        }
        return { success: true };
      }
      
      if (error.code === '42P01') {
        console.warn('Tabela de notificações não encontrada. Notificações desabilitadas.');
        return { success: false, error: null };
      }
      
      console.error('Erro ao enviar notificação:', error);
      return { success: false, error };
    }

    return { success: true };
  } catch (err) {
    console.warn('Erro ao enviar notificação (ignorado):', err);
    return { success: false, error: null };
  }
};

/**
 * Envia notificação quando um reagendamento é aceito
 * @param clientId - ID do cliente
 * @param appointmentId - ID do agendamento
 * @param rescheduleId - ID do reagendamento
 * @param newStartTime - Novo horário de início
 * @param businessName - Nome do negócio
 */
export const notifyRescheduleAccepted = async (
  clientId: string,
  appointmentId: number,
  rescheduleId: number,
  newStartTime: string,
  businessName: string
): Promise<void> => {
  try {
    const date = new Date(newStartTime);
    const formattedDate = date.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    const formattedTime = date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    // Passar ambos os IDs: appointment_id e reschedule_id
    await sendNotification(
      clientId,
      'reschedule_accepted',
      'Reagendamento Aceito',
      `Seu reagendamento foi aceito! O novo horário é ${formattedDate} às ${formattedTime} em ${businessName}.`,
      appointmentId,
      rescheduleId
    );
  } catch {
    console.warn('Erro ao enviar notificação de reagendamento aceito (ignorado)');
  }
};

/**
 * Envia notificação quando um reagendamento é rejeitado
 * @param clientId - ID do cliente
 * @param appointmentId - ID do agendamento
 * @param rescheduleId - ID do reagendamento
 * @param businessName - Nome do negócio
 * @param reason - Motivo da rejeição (opcional)
 */
export const notifyRescheduleRejected = async (
  clientId: string,
  appointmentId: number,
  rescheduleId: number,
  businessName: string,
  reason?: string | null
): Promise<void> => {
  try {
    const message = reason
      ? `Seu reagendamento foi rejeitado por ${businessName}. Motivo: ${reason}`
      : `Seu reagendamento foi rejeitado por ${businessName}.`;

    // Passar ambos os IDs: appointment_id e reschedule_id
    await sendNotification(
      clientId,
      'reschedule_rejected',
      'Reagendamento Rejeitado',
      message,
      appointmentId,
      rescheduleId
    );
  } catch {
    console.warn('Erro ao enviar notificação de reagendamento rejeitado (ignorado)');
  }
};

/**
 * Envia notificação quando um reagendamento é solicitado
 * @param merchantId - ID do merchant
 * @param appointmentId - ID do agendamento
 * @param rescheduleId - ID do reagendamento
 * @param clientName - Nome do cliente
 * @param newStartTime - Novo horário solicitado
 */
export const notifyRescheduleRequested = async (
  merchantId: string,
  appointmentId: number,
  rescheduleId: number,
  clientName: string,
  newStartTime: string
): Promise<void> => {
  try {
    const date = new Date(newStartTime);
    const formattedDate = date.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    const formattedTime = date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    // Passar ambos os IDs: appointment_id e reschedule_id
    await sendNotification(
      merchantId,
      'reschedule_requested',
      'Nova Solicitação de Reagendamento',
      `${clientName} solicitou reagendamento para ${formattedDate} às ${formattedTime}.`,
      appointmentId,
      rescheduleId
    );
  } catch {
    console.warn('Erro ao enviar notificação de reagendamento solicitado (ignorado)');
  }
};

/**
 * Envia notificação quando um reagendamento é sugerido pelo merchant
 * @param clientId - ID do cliente
 * @param appointmentId - ID do agendamento
 * @param rescheduleId - ID do reagendamento
 * @param newStartTime - Novo horário sugerido
 * @param businessName - Nome do negócio
 */
export const notifyRescheduleSuggested = async (
  clientId: string,
  appointmentId: number,
  rescheduleId: number,
  newStartTime: string,
  businessName: string
): Promise<void> => {
  try {
    const date = new Date(newStartTime);
    const formattedDate = date.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    const formattedTime = date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    // Passar ambos os IDs: appointment_id e reschedule_id
    await sendNotification(
      clientId,
      'reschedule_suggested',
      'Reagendamento Sugerido',
      `${businessName} sugeriu um novo horário: ${formattedDate} às ${formattedTime}. Acesse seus agendamentos para aceitar ou rejeitar.`,
      appointmentId,
      rescheduleId
    );
  } catch {
    console.warn('Erro ao enviar notificação de reagendamento sugerido (ignorado)');
  }
};

/**
 * Envia notificação quando um agendamento é solicitado
 * @param merchantId - ID do merchant
 * @param appointmentId - ID do agendamento
 * @param clientName - Nome do cliente
 * @param serviceName - Nome do serviço
 * @param startTime - Horário de início do agendamento
 */
export const notifyAppointmentRequested = async (
  merchantId: string,
  appointmentId: number,
  clientName: string,
  serviceName: string,
  startTime: string
): Promise<void> => {
  try {
    const date = new Date(startTime);
    const formattedDate = date.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    const formattedTime = date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    await sendNotification(
      merchantId,
      'appointment_requested',
      'Nova Solicitação de Agendamento',
      `${clientName} solicitou um agendamento para ${serviceName} no dia ${formattedDate} às ${formattedTime}.`,
      appointmentId
    );
  } catch {
    console.warn('Erro ao enviar notificação de agendamento solicitado (ignorado)');
  }
};

/**
 * Busca notificações para um usuário
 * @param userId - ID do usuário
 * @param options - Opções de filtro (tipos de notificação)
 * @returns Promise com array de notificações
 */
export const fetchNotifications = async (
  userId: string,
  options?: { types?: NotificationType[] }
): Promise<Notification[]> => {
  try {
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (options?.types && options.types.length > 0) {
      query = query.in('type', options.types);
    }

    const { data, error } = await query;

    if (error) {
      if (error.code === '42P01') {
        console.warn('Tabela de notificações não encontrada.');
        return [];
      }
      console.error('Erro ao buscar notificações:', error);
      return [];
    }

    return (data as Notification[]) || [];
  } catch (err) {
    console.warn('Erro ao buscar notificações (ignorado):', err);
    return [];
  }
};

/**
 * Marca uma notificação como lida
 * @param notificationId - ID da notificação
 * @returns Promise com resultado da operação
 */
export const markNotificationAsRead = async (
  notificationId: number
): Promise<{ success: boolean; error?: any }> => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);

    if (error) {
      if (error.code === '42P01') {
        console.warn('Tabela de notificações não encontrada.');
        return { success: false, error: null };
      }
      console.error('Erro ao marcar notificação como lida:', error);
      return { success: false, error };
    }

    return { success: true };
  } catch (err) {
    console.warn('Erro ao marcar notificação como lida (ignorado):', err);
    return { success: false, error: null };
  }
};

/**
 * Marca todas as notificações de um usuário como lidas
 * @param userId - ID do usuário
 * @returns Promise com resultado da operação
 */
export const clearAllNotifications = async (
  userId: string
): Promise<{ success: boolean; error?: any }> => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) {
      if (error.code === '42P01') {
        console.warn('Tabela de notificações não encontrada.');
        return { success: false, error: null };
      }
      console.error('Erro ao limpar notificações:', error);
      return { success: false, error };
    }

    return { success: true };
  } catch (err) {
    console.warn('Erro ao limpar notificações (ignorado):', err);
    return { success: false, error: null };
  }
};
