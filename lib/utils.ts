import { supabase } from './supabase';
import { handleError } from './errorHandler';

/**
 * Calcula o nível de preço (1-5) baseado na média dos preços dos serviços
 * @param services - Array de serviços com propriedade price opcional
 * @returns Número de 1 a 5 representando o nível de preço
 */
export const getPriceLevel = (services: Array<{ price?: number }>): number => {
  if (!services || services.length === 0) return 1;

  // Filtra preços válidos
  const prices = services
    .map((s) => s.price)
    .filter((p): p is number => p !== undefined && p > 0);

  if (prices.length === 0) return 1;

  // Calcula média
  const avg = prices.reduce((sum, p) => sum + p, 0) / prices.length;

  if (avg > 300) return 5; // $$$$$
  if (avg > 200) return 4; // $$$$
  if (avg > 100) return 3; // $$$
  if (avg > 30) return 2;  // $$
  
  return 1; // $ (até 30)
};

/**
 * Calcula a faixa de preço como string (ex: '$----', '$$---', '$$$--', '$$$$-', '$$$$$')
 * @param services - Array de serviços com propriedade price
 * @returns String representando a faixa de preço
 */
export const getPriceRange = (services: Array<{ price: number }>): string => {
  if (!services || services.length === 0) return '$----';
  
  const prices = services.map((s) => s.price).filter((p) => p > 0);
  if (prices.length === 0) return '$----';

  const avg = prices.reduce((sum, p) => sum + p, 0) / prices.length;

  if (avg < 50) return '$----';
  if (avg < 100) return '$$---';
  if (avg < 200) return '$$$--';
  if (avg < 400) return '$$$$-';
  return '$$$$$';
};

/**
 * Aplica reagendamentos aceitos aos agendamentos
 * Se um agendamento tiver um reagendamento aceito, substitui start_time e end_time pelos valores do reagendamento
 * 
 * @param appointments - Array de agendamentos
 * @returns Array de agendamentos com horários atualizados se houver reagendamento aceito
 */
export const applyAcceptedReschedules = async <T extends { id: string | number; start_time: string; end_time: string }>(
  appointments: T[]
): Promise<T[]> => {
  if (!appointments || appointments.length === 0) {
    return appointments;
  }

  try {
    // Buscar todos os reagendamentos aceitos para esses agendamentos
    const appointmentIds = appointments.map(apt => typeof apt.id === 'string' ? parseInt(apt.id, 10) : apt.id);
    
    const { data: acceptedReschedules, error } = await supabase
      .from('appointment_reschedules')
      .select('appointment_id, new_start_time, new_end_time')
      .in('appointment_id', appointmentIds as number[])
      .eq('status', 'accepted')
      .order('accepted_at', { ascending: false }); // Pegar o mais recente se houver múltiplos

    if (error) {
      handleError(error, 'appointment');
      return appointments;
    }

    if (!acceptedReschedules || acceptedReschedules.length === 0) {
      return appointments; // Nenhum reagendamento aceito, retornar original
    }

    // Criar um mapa de appointment_id -> reagendamento aceito (mais recente)
    const rescheduleMap = new Map<number | string, { new_start_time: string; new_end_time: string }>();
    
    acceptedReschedules.forEach((reschedule) => {
      const aptId = reschedule.appointment_id;
      // Se já existe, manter o mais recente (já vem ordenado por accepted_at desc)
      if (!rescheduleMap.has(aptId)) {
        rescheduleMap.set(aptId, {
          new_start_time: reschedule.new_start_time,
          new_end_time: reschedule.new_end_time,
        });
      }
    });

    // Aplicar os reagendamentos aos agendamentos
    return appointments.map((appointment) => {
      const reschedule = rescheduleMap.get(appointment.id);
      if (reschedule) {
        return {
          ...appointment,
          start_time: reschedule.new_start_time,
          end_time: reschedule.new_end_time,
        };
      }
      return appointment;
    });
  } catch (error) {
    handleError(error, 'appointment');
    return appointments;
  }
};

/**
 * Calcula o preço total de um agendamento baseado no tipo de preço do serviço
 * 
 * @param servicePrice - Preço base do serviço
 * @param priceType - Tipo de preço: 'fixed' ou 'hourly'
 * @param durationMinutes - Duração do serviço em minutos (necessário apenas para 'hourly')
 * @returns Preço total calculado
 */
export const calculateAppointmentPrice = (
  servicePrice: number,
  priceType: 'fixed' | 'hourly',
  durationMinutes: number
): number => {
  if (priceType === 'fixed') {
    return servicePrice;
  }
  
  // Para preço por hora, calcular baseado na duração
  // durationMinutes / 60 converte minutos em horas
  return servicePrice * (durationMinutes / 60);
};

/**
 * Verifica se há conflitos de horário para um agendamento
 * Considera tanto os horários originais quanto reagendamentos aceitos
 * @param businessId - ID do negócio
 * @param startTime - Horário de início (ISO string)
 * @param endTime - Horário de término (ISO string)
 * @param excludeAppointmentId - ID do agendamento a ser excluído da verificação (opcional, para reagendamentos)
 * @returns Promise com o resultado da verificação
 */
export const checkAppointmentConflicts = async (
  businessId: number,
  startTime: string,
  endTime: string,
  excludeAppointmentId?: number
): Promise<{ hasConflict: boolean; error?: unknown }> => {
  try {
    // Buscar agendamentos que podem conflitar
    let query = supabase
      .from('appointments')
      .select('id, start_time, end_time')
      .eq('business_id', businessId)
      .in('status', ['pending', 'confirmed'])
      .lte('start_time', endTime)
      .gte('end_time', startTime);

    // Excluir o agendamento atual se fornecido (para reagendamentos)
    if (excludeAppointmentId) {
      query = query.neq('id', excludeAppointmentId);
    }

    const { data: appointments, error } = await query;

    if (error) {
      handleError(error, 'appointment');
      return { hasConflict: false, error };
    }

    if (!appointments || appointments.length === 0) {
      return { hasConflict: false };
    }

    // Aplicar reagendamentos aceitos aos agendamentos encontrados
    const appointmentsWithReschedules = await applyAcceptedReschedules(appointments);

    // Verificar se algum agendamento (com reagendamento aplicado) conflita
    const hasConflict = appointmentsWithReschedules.some((apt) => {
      const aptStart = new Date(apt.start_time);
      const aptEnd = new Date(apt.end_time);
      const newStart = new Date(startTime);
      const newEnd = new Date(endTime);

      // Verificar overlap: os horários se sobrepõem
      return (
        (aptStart.getTime() < newEnd.getTime() && aptEnd.getTime() > newStart.getTime())
      );
    });

    return { hasConflict };
  } catch (error) {
    handleError(error, 'appointment');
    return { hasConflict: false, error };
  }
};

