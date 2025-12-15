/**
 * Sistema de notificações
 */

import { supabase } from './supabase';

export type NotificationType = 
  | 'reschedule_accepted'
  | 'reschedule_rejected'
  | 'reschedule_requested'
  | 'appointment_confirmed'
  | 'appointment_cancelled'
  | 'appointment_requested';

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
    console.log('sendNotification: Criando notificação', {
      userId,
      type,
      title,
      message,
      relatedAppointmentId,
      relatedRescheduleId,
    });

    // Tentar usar a função RPC primeiro (opção híbrida)
    console.log('sendNotification: Chamando função RPC insert_notification...');
    const { data: rpcData, error: rpcError } = await supabase.rpc('insert_notification', {
      p_user_id: userId,
      p_type: type,
      p_title: title,
      p_message: message,
      p_related_appointment_id: relatedAppointmentId ?? null,
      p_related_reschedule_id: relatedRescheduleId ?? null,
    });

    // Log detalhado do resultado da RPC
    console.log('sendNotification: Resultado da chamada RPC:', {
      hasError: !!rpcError,
      errorCode: rpcError?.code,
      errorMessage: rpcError?.message,
      errorDetails: rpcError?.details,
      errorHint: rpcError?.hint,
      rpcData: rpcData,
      rpcDataType: typeof rpcData,
    });

    // Se a função RPC funcionou, retornar sucesso
    if (!rpcError && rpcData) {
      // A função RPC retorna um JSON com { success: true/false, id?: number, error?: string }
      if (typeof rpcData === 'object' && 'success' in rpcData) {
        if (rpcData.success === true) {
          console.log('sendNotification: ✅ Notificação criada com sucesso via RPC:', rpcData);
          return { success: true };
        } else {
          // A função RPC retornou success: false (provavelmente erro interno)
          console.error('sendNotification: ❌ Função RPC retornou success=false:', rpcData.error || 'Erro desconhecido');
          return { success: false, error: null };
        }
      }
      // Se rpcData não tem formato esperado, mas não há erro, considerar sucesso
      if (rpcData && typeof rpcData === 'object') {
        console.log('sendNotification: ✅ Notificação criada via RPC (formato não padrão, mas sem erro):', rpcData);
        return { success: true };
      }
    }

    // Se a função RPC falhou ou não existe
    if (rpcError) {
      // Código 42883 = função não existe, P0001 = erro genérico de função, 42809 = função não encontrada
      if (rpcError.code === '42883' || 
          rpcError.code === 'P0001' || 
          rpcError.code === '42809' ||
          rpcError.message?.toLowerCase().includes('function') || 
          rpcError.message?.toLowerCase().includes('does not exist') ||
          rpcError.message?.toLowerCase().includes('could not find')) {
        console.error('sendNotification: ❌ Função RPC insert_notification não encontrada. Execute o SQL no banco de dados.');
        console.error('sendNotification: Erro completo:', JSON.stringify(rpcError, null, 2));
        // Não tentar fallback se a função não existe - apenas retornar erro silencioso
        return { success: false, error: null };
      }
      
      // Se for erro de RLS na RPC, não tentar fallback
      if (rpcError.code === '42501') {
        console.error('sendNotification: ❌ RLS bloqueou a função RPC. Verifique as permissões GRANT da função.');
        return { success: false, error: null };
      }
      
      console.warn('sendNotification: ⚠️ Erro na função RPC, tentando inserção direta como fallback:', {
        code: rpcError.code,
        message: rpcError.message,
        details: rpcError.details,
        hint: rpcError.hint,
      });
    } else if (!rpcData) {
      console.warn('sendNotification: ⚠️ Função RPC não retornou dados, tentando inserção direta como fallback');
    }

    // Fallback: inserção direta (para compatibilidade ou se RPC não estiver disponível)
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

    console.log('sendNotification: Tentando inserção direta (fallback):', notificationData);

    const { data, error } = await supabase
      .from('notifications')
      .insert(notificationData)
      .select();

    console.log('sendNotification: Resultado da inserção direta:', {
      hasError: !!error,
      errorCode: error?.code,
      errorMessage: error?.message,
      errorDetails: error?.details,
      data: data,
    });

    if (error) {
      // Erro de RLS (Row Level Security) - política de segurança do Supabase
      // Isso geralmente acontece quando o usuário atual não tem permissão para inserir
      // notificações para outros usuários. Não é um erro crítico, apenas silencia.
      if (error.code === '42501') {
        console.error('sendNotification: ❌ Política RLS bloqueou a inserção direta. Verifique as políticas RLS no Supabase.');
        console.error('sendNotification: Erro completo:', JSON.stringify(error, null, 2));
        return { success: false, error: null };
      }

      // Tabela não encontrada
      if (error.code === '42P01') {
        console.warn('Tabela de notificações não encontrada. Notificações desabilitadas.');
        return { success: false, error: null };
      }

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
          // Se o fallback também falhar com RLS, silenciar
          if (fallbackError.code === '42501') {
            console.warn('Erro ao enviar notificação (RLS bloqueou fallback). Notificação não enviada (não crítico).');
            return { success: false, error: null };
          }
          console.warn('Erro ao enviar notificação (fallback também falhou):', fallbackError);
          return { success: false, error: null };
        }
        return { success: true };
      }
      
      // Outros erros - logar mas não bloquear o fluxo
      console.warn('Erro ao enviar notificação (não crítico):', error.message || error);
      return { success: false, error: null };
    }

    console.log('sendNotification: ✅ Notificação criada com sucesso (inserção direta):', data);
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
 * Envia notificação quando um agendamento é solicitado
 * @param merchantId - ID do merchant (owner do negócio)
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
    console.log('notifyAppointmentRequested: Iniciando', {
      merchantId,
      appointmentId,
      clientName,
      serviceName,
      startTime,
    });

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

    const result = await sendNotification(
      merchantId,
      'appointment_requested',
      'Nova Solicitação de Agendamento',
      `${clientName} solicitou agendamento de ${serviceName} para ${formattedDate} às ${formattedTime}.`,
      appointmentId,
      null
    );

    console.log('notifyAppointmentRequested: Resultado:', result);
  } catch (error) {
    // Não é um erro crítico - notificações são opcionais
    console.warn('Erro ao enviar notificação de agendamento solicitado (não crítico):', error);
  }
};

/**
 * Busca notificações do usuário
 * @param userId - ID do usuário
 * @param filters - Filtros opcionais (tipos de notificação, lidas/não lidas)
 * @returns Promise com a lista de notificações
 */
export const fetchNotifications = async (
  userId: string,
  filters?: {
    types?: NotificationType[];
    read?: boolean;
  }
): Promise<Notification[]> => {
  try {
    if (!userId) {
      console.warn('fetchNotifications: userId não fornecido');
      return [];
    }

    console.log('fetchNotifications: Buscando notificações para userId:', userId);
    console.log('fetchNotifications: Filtros:', filters);

    // Construir query base
    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId);

    // Aplicar filtros
    if (filters?.types && filters.types.length > 0) {
      console.log('fetchNotifications: Aplicando filtro de tipos:', filters.types);
      query = query.in('type', filters.types);
    }

    if (filters?.read !== undefined) {
      console.log('fetchNotifications: Aplicando filtro de read:', filters.read);
      query = query.eq('read', filters.read);
    }

    // Ordenar por data de criação (mais recentes primeiro)
    query = query.order('created_at', { ascending: false });

    console.log('fetchNotifications: Executando query...');
    const { data, error } = await query;

    if (error) {
      if (error.code === '42P01') {
        console.warn('Tabela de notificações não encontrada. Notificações desabilitadas.');
        return [];
      }
      console.error('Erro ao buscar notificações:', error);
      console.error('Detalhes do erro:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      return [];
    }

    if (!data) {
      console.warn('fetchNotifications: Nenhum dado retornado (data é null/undefined)');
      return [];
    }

    console.log(`fetchNotifications: ${data.length} notificações encontradas para o usuário ${userId}`);
    if (data.length > 0) {
      console.log('fetchNotifications: Primeira notificação:', JSON.stringify(data[0], null, 2));
    }
    return data as Notification[];
  } catch (err) {
    console.error('Erro ao buscar notificações (catch):', err);
    return [];
  }
};

/**
 * Marca uma notificação como lida
 * @param notificationId - ID da notificação
 * @returns Promise com o resultado da atualização
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
        console.warn('Tabela de notificações não encontrada. Notificações desabilitadas.');
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
 * Obtém a contagem de notificações não lidas
 * @param userId - ID do usuário
 * @returns Promise com a contagem de notificações não lidas
 */
export const getUnreadCount = async (userId: string): Promise<number> => {
  try {
    if (!userId) {
      console.warn('getUnreadCount: userId não fornecido');
      return 0;
    }

    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) {
      if (error.code === '42P01') {
        console.warn('Tabela de notificações não encontrada. Notificações desabilitadas.');
        return 0;
      }
      console.error('Erro ao contar notificações não lidas:', error);
      console.error('Detalhes do erro:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      return 0;
    }

    const unreadCount = count || 0;
    console.log(`getUnreadCount: ${unreadCount} notificações não lidas para o usuário ${userId}`);
    return unreadCount;
  } catch (err) {
    console.error('Erro ao contar notificações não lidas:', err);
    return 0;
  }
};

/**
 * Marca todas as notificações do usuário como lidas
 * @param userId - ID do usuário
 * @returns Promise com o resultado da atualização
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
        console.warn('Tabela de notificações não encontrada. Notificações desabilitadas.');
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
