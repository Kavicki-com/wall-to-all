import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Dimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import AppHeader from '../../../components/layout/AppHeader';
import ScreenContainer from '../../../components/layout/ScreenContainer';
import RescheduleAppointment from '../../../components/ui/RescheduleAppointment';
import { AppointmentTimeline, type TimelineEvent } from '../../../components/appointments/AppointmentTimeline';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { checkAppointmentConflicts, applyAcceptedReschedules } from '../../../lib/utils';
import { notifyRescheduleAccepted, notifyRescheduleRejected } from '../../../lib/notifications';
import { safeGoBack } from '../../../lib/router-utils';
import { logger } from '../../../lib/logger';
import { Appointment, AppointmentRescheduleItem } from '../../../lib/types';
import { useToast } from '../../../components/ui/ToastProvider';
import { colors } from '../../../lib/theme';

// Função auxiliar para converter string ISO para Date local, evitando problemas de timezone
const parseLocalDate = (isoString: string): Date => {
  // Se a string já tem timezone, usar diretamente
  if (isoString.includes('Z') || isoString.includes('+') || isoString.includes('-', 10)) {
    return new Date(isoString);
  }
  // Se não tem timezone, assumir que é UTC e converter para local
  // Adicionar 'Z' para indicar UTC
  const date = new Date(isoString + (isoString.includes('T') ? '' : 'T00:00:00') + 'Z');
  // Criar uma nova data usando os componentes locais para evitar problemas de timezone
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds()
  );
};

type AppointmentReschedule = AppointmentRescheduleItem;

type AppointmentExtended = Appointment & {
  service: {
    id: number;
    name: string;
    price: number;
  };
  business: {
    id: number;
    business_name: string;
    logo_url: string | null;
    address: string | null;
  };
  pending_reschedules?: AppointmentReschedule[]; // Reagendamentos pendentes criados pelo merchant
  client_pending_reschedules?: AppointmentReschedule[]; // Reagendamentos pendentes criados pelo cliente
  accepted_reschedules?: AppointmentReschedule[];
  rejected_reschedules?: AppointmentReschedule[]; // Reagendamentos rejeitados
  created_at: string;
};

// TimelineEvent importado de AppointmentTimeline

const AppointmentDetailScreen: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const appointmentId = Number(params.id);
  const [loading, setLoading] = useState(true);
  const [appointment, setAppointment] = useState<AppointmentExtended | null>(null);
  const [showRescheduleForm, setShowRescheduleForm] = useState(false);
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [updating, setUpdating] = useState(false);
  const { showError, showSuccess, showWarning } = useToast();

  const loadAppointment = React.useCallback(async () => {
    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        logger.debug('Usuário não autenticado');
        setLoading(false);
        return;
      }

      // Buscar dados atualizados do agendamento
      // Usar .single() para garantir que encontre o agendamento
      const { data: appointmentData, error } = await supabase
        .from('appointments')
        .select(
          `
          *,
          service:services(id, name, price),
          business:business_profiles(id, business_name, logo_url, address)
        `
        )
        .eq('id', appointmentId)
        .eq('client_id', user.id)
        .single();

      if (error) {
        logger.error('Erro ao buscar agendamento:', error);
      } else if (appointmentData) {
        // Aplicar reagendamentos aceitos ao agendamento (atualiza start_time e end_time se houver reagendamento aceito)
        const appointmentsWithReschedules = await applyAcceptedReschedules([appointmentData]);
        const appointmentWithAcceptedReschedule = appointmentsWithReschedules[0] || appointmentData;

        // Buscar reagendamentos pendentes criados pelo MERCHANT (para o cliente aceitar/rejeitar)
        const { data: merchantPendingReschedules } = await supabase
          .from('appointment_reschedules')
          .select('*')
          .eq('appointment_id', appointmentData.id)
          .eq('status', 'pending')
          .eq('requested_by_type', 'merchant')
          .order('created_at', { ascending: false });

        // Buscar reagendamentos pendentes criados pelo CLIENTE (para mostrar que está aguardando resposta do merchant)
        const { data: clientPendingReschedules } = await supabase
          .from('appointment_reschedules')
          .select('*')
          .eq('appointment_id', appointmentData.id)
          .eq('status', 'pending')
          .eq('requested_by_type', 'client')
          .order('created_at', { ascending: false });

        // Buscar reagendamentos aceitos criados pelo MERCHANT
        // Para mostrar a nova data e justificativa após aceitar
        // IMPORTANTE: Buscar todos os reagendamentos aceitos (não apenas merchant) para mostrar histórico completo
        const { data: acceptedReschedules } = await supabase
          .from('appointment_reschedules')
          .select('*')
          .eq('appointment_id', appointmentData.id)
          .eq('status', 'accepted')
          .order('accepted_at', { ascending: false });

        // Buscar reagendamentos rejeitados (tanto do cliente quanto do merchant)
        const { data: rejectedReschedules } = await supabase
          .from('appointment_reschedules')
          .select('*')
          .eq('appointment_id', appointmentData.id)
          .eq('status', 'rejected')
          .order('rejected_at', { ascending: false });

        // Atualizar estado com os dados atualizados do agendamento
        // Isso garante que o card branco e as seções de reagendamento sejam atualizados
        const updatedAppointment = {
          ...appointmentWithAcceptedReschedule,
          pending_reschedules: merchantPendingReschedules || [],
          client_pending_reschedules: clientPendingReschedules || [],
          accepted_reschedules: acceptedReschedules || [],
          rejected_reschedules: rejectedReschedules || [],
        } as AppointmentExtended;

        setAppointment(updatedAppointment);

        // Log para debug - remover em produção se necessário
        logger.debug('[AppointmentDetail] Dados atualizados:', {
          start_time: updatedAppointment.start_time,
          end_time: updatedAppointment.end_time,
          hasAcceptedReschedules: (updatedAppointment.accepted_reschedules?.length || 0) > 0,
          hasPendingReschedules: (updatedAppointment.pending_reschedules?.length || 0) > 0,
        });
      }
    } catch (error) {
      logger.error('Erro ao carregar agendamento:', error);
    } finally {
      setLoading(false);
    }
  }, [appointmentId]);

  useEffect(() => {
    loadAppointment();
  }, [loadAppointment]);

  const buildTimeline = (): TimelineEvent[] => {
    if (!appointment) return [];

    const events: TimelineEvent[] = [];

    // 1. Criação do agendamento
    events.push({
      id: `creation-${appointment.id}`,
      type: 'creation',
      date: appointment.created_at,
      title: 'Agendamento Criado',
      description: 'Você criou este agendamento',
      actor: 'client',
    });

    // 2. Confirmação do agendamento (se aplicável)
    if (appointment.status === 'confirmed') {
      const confirmedAt = (appointment as any).updated_at || appointment.created_at;
      events.push({
        id: `confirmed-${appointment.id}`,
        type: 'confirmed',
        date: confirmedAt,
        title: 'Agendamento Aceito',
        description: 'O estabelecimento confirmou seu agendamento',
        actor: 'merchant',
      });
    }

    // 2. Reagendamentos
    const allReschedules = [
      ...(appointment.pending_reschedules || []),
      ...(appointment.client_pending_reschedules || []),
      ...(appointment.accepted_reschedules || []),
      ...(appointment.rejected_reschedules || []),
    ];

    allReschedules.forEach((reschedule) => {
      events.push({
        id: `req-${reschedule.id}`,
        type: 'reschedule_request',
        date: reschedule.created_at,
        title: 'Solicitação de Reagendamento',
        description: `Sugestão: ${format(parseLocalDate(reschedule.new_start_time), "dd/MM 'às' HH:mm")}`,
        actor: reschedule.requested_by_type,
      });

      if (reschedule.status === 'accepted' && reschedule.accepted_at) {
        events.push({
          id: `acc-${reschedule.id}`,
          type: 'reschedule_accepted',
          date: reschedule.accepted_at,
          title: 'Reagendamento Aceito',
          description: `Novo horário confirmado`,
          actor: reschedule.requested_by_type === 'client' ? 'merchant' : 'client',
        });
      } else if (reschedule.status === 'rejected' && reschedule.rejected_at) {
        events.push({
          id: `rej-${reschedule.id}`,
          type: 'reschedule_rejected',
          date: reschedule.rejected_at,
          title: 'Reagendamento Recusado',
          description: reschedule.rejected_reason ? `Motivo: ${reschedule.rejected_reason}` : undefined,
          actor: reschedule.requested_by_type === 'client' ? 'merchant' : 'client',
        });
      }
    });

    return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  // Resetar campos e recarregar dados quando a tela é focada (quando volta de outras telas)
  useFocusEffect(
    React.useCallback(() => {
      // Resetar o campo de justificativa
      setRescheduleReason('');
      // Resetar também o estado do formulário
      setShowRescheduleForm(false);
      // Recarregar dados do agendamento para atualizar solicitações de reagendamento
      loadAppointment();
    }, [loadAppointment])
  );


  const handleReschedulePress = () => {
    if (!showRescheduleForm) {
      setShowRescheduleForm(true);
    }
  };

  const handleContinueReschedule = () => {
    if (!appointment) return;

    router.push({
      pathname: '/(client)/appointments/reschedule',
      params: {
        appointmentId: appointment.id,
        reason: rescheduleReason,
      },
    });
  };

  const handleAcceptReschedule = async (rescheduleId: number) => {
    if (!appointment) return;

    try {
      setUpdating(true);

      // Buscar dados do reagendamento
      const { data: rescheduleData, error: fetchError } = await supabase
        .from('appointment_reschedules')
        .select('*')
        .eq('id', rescheduleId)
        .eq('appointment_id', appointment.id)
        .eq('status', 'pending')
        .single();

      if (fetchError || !rescheduleData) {
        showError('Reagendamento não encontrado ou já processado.');
        return;
      }

      // Verificar conflitos de horário antes de aceitar
      const { hasConflict, error: conflictError } = await checkAppointmentConflicts(
        appointment.business.id,
        rescheduleData.new_start_time,
        rescheduleData.new_end_time,
        appointment.id
      );

      if (conflictError) {
        logger.error('Erro ao verificar conflitos:', conflictError);
        showError('Não foi possível verificar disponibilidade do horário.');
        return;
      }

      if (hasConflict) {
        showWarning('Este horário já está ocupado. O reagendamento não pode ser aceito.');
        return;
      }

      // Atualizar o agendamento com os novos horários
      const { error: updateError } = await supabase
        .from('appointments')
        .update({
          start_time: rescheduleData.new_start_time,
          end_time: rescheduleData.new_end_time,
          status: 'confirmed',
        })
        .eq('id', appointment.id);

      if (updateError) {
        logger.error('Erro ao atualizar agendamento:', updateError);
        showError('Não foi possível aceitar o reagendamento.');
        return;
      }

      // Marcar reagendamento como aceito
      const { error: acceptError } = await supabase
        .from('appointment_reschedules')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
        })
        .eq('id', rescheduleId);

      if (acceptError) {
        logger.error('Erro ao marcar reagendamento como aceito:', acceptError);
        showError('Reagendamento atualizado, mas houve erro ao atualizar o status.');
        return;
      }

      // Cancelar outros reagendamentos pendentes do mesmo agendamento
      await supabase
        .from('appointment_reschedules')
        .update({
          status: 'cancelled',
        })
        .eq('appointment_id', appointment.id)
        .eq('status', 'pending')
        .neq('id', rescheduleId);

      // Buscar o business_profile para obter o owner_id e enviar notificação
      const { data: businessProfile } = await supabase
        .from('business_profiles')
        .select('owner_id, business_name')
        .eq('id', appointment.business.id)
        .single();

      // Enviar notificação ao merchant
      if (businessProfile?.owner_id) {
        await notifyRescheduleAccepted(
          businessProfile.owner_id,
          appointment.id,
          rescheduleId,
          rescheduleData.new_start_time,
          businessProfile.business_name
        );
      }

      // Recarregar dados do agendamento para mostrar os novos horários
      // Forçar recarregamento completo para garantir que os dados atualizados sejam exibidos
      await loadAppointment();

      // Forçar atualização do estado para garantir que a UI seja atualizada
      // Aguardar um pouco para garantir que o React atualizou o estado antes de mostrar o Alert
      // Isso permite que a UI seja atualizada com os novos horários no card e nas seções
      await new Promise(resolve => setTimeout(resolve, 300));

      showSuccess('Reagendamento aceito com sucesso.');
    } catch (error) {
      logger.error('Erro ao aceitar reagendamento:', error);
      showError('Ocorreu um erro ao aceitar o reagendamento.');
    } finally {
      setUpdating(false);
    }
  };

  const handleRejectReschedule = async (rescheduleId: number, reason?: string) => {
    if (!appointment) return;

    try {
      setUpdating(true);

      // Buscar dados do reagendamento para obter o ID
      const { data: rescheduleData } = await supabase
        .from('appointment_reschedules')
        .select('*')
        .eq('id', rescheduleId)
        .eq('appointment_id', appointment.id)
        .eq('status', 'pending')
        .single();

      const { error } = await supabase
        .from('appointment_reschedules')
        .update({
          status: 'rejected',
          rejected_at: new Date().toISOString(),
          rejected_reason: reason || null,
        })
        .eq('id', rescheduleId)
        .eq('appointment_id', appointment.id);

      if (error) {
        logger.error('Erro ao rejeitar reagendamento:', error);
        showError('Não foi possível rejeitar o reagendamento.');
        return;
      }

      // Verificar se não há mais reagendamentos pendentes do merchant
      // Se não houver, voltar o status do appointment para 'confirmed'
      const { data: otherPendingReschedules } = await supabase
        .from('appointment_reschedules')
        .select('id')
        .eq('appointment_id', appointment.id)
        .eq('status', 'pending')
        .eq('requested_by_type', 'merchant');

      if (!otherPendingReschedules || otherPendingReschedules.length === 0) {
        // Não há mais reagendamentos pendentes, voltar status para 'confirmed'
        await supabase
          .from('appointments')
          .update({ status: 'confirmed' })
          .eq('id', appointment.id);
      }

      // Buscar o business_profile para obter o owner_id e enviar notificação
      const { data: businessProfile } = await supabase
        .from('business_profiles')
        .select('owner_id, business_name')
        .eq('id', appointment.business.id)
        .single();

      // Enviar notificação ao merchant
      if (businessProfile?.owner_id && rescheduleData) {
        await notifyRescheduleRejected(
          businessProfile.owner_id,
          appointment.id,
          rescheduleId,
          businessProfile.business_name,
          reason || null
        );
      }

      loadAppointment();
      showSuccess('Reagendamento rejeitado.');
    } catch (error) {
      logger.error('Erro ao rejeitar reagendamento:', error);
      showError('Ocorreu um erro ao rejeitar o reagendamento.');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <ScreenContainer scroll={false} backgroundColor={colors.background}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </ScreenContainer>
    );
  }

  if (!appointment) {
    return (
      <ScreenContainer
        scroll={false}
        backgroundColor={colors.background}
        hasHeader={true}
        header={
          <AppHeader
            showBackButton={true}
            onPressBack={() => safeGoBack('/(client)/appointments')}
          />
        }
      >
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Agendamento não encontrado</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer
      scroll={true}
      hasHeader={true}
      backgroundColor={colors.background}
      contentContainerStyle={styles.scrollContent}
      header={
        <AppHeader
          showBackButton={true}
          onPressBack={() => safeGoBack('/(client)/appointments')}
        />
      }
    >
      <View style={styles.cardWrapper}>
        <RescheduleAppointment
          date={format(parseLocalDate(appointment.start_time), 'yyyy-MM-dd')}
          time={format(parseLocalDate(appointment.start_time), 'HH:mm')}
          serviceName={appointment.service.name}
          price={appointment.service.price || 0}
          businessName={appointment.business.business_name}
          businessAddress={appointment.business.address}
          businessLogoUrl={appointment.business.logo_url}
          paymentMethod={(appointment.payment_method as 'pix' | 'card' | 'cash') ?? 'pix'}
          clientNote={appointment.client_notes || undefined}
          linkLabel="Remarcar agendamento"
          onLinkPress={handleReschedulePress}
          showJustification={showRescheduleForm}
          justification={rescheduleReason}
          onChangeJustification={setRescheduleReason}
          primaryButtonLabel="Continuar"
          onPrimaryAction={handleContinueReschedule}
        />
      </View>

      {/* Accepted Reschedules - Mostrar apenas o último reagendamento aceito */}
      {appointment.accepted_reschedules &&
        appointment.accepted_reschedules.length > 0 &&
        (!appointment.client_pending_reschedules || appointment.client_pending_reschedules.length === 0) && (() => {
          const reschedule = appointment.accepted_reschedules[0]; // Mais recente (já vem ordenado desc)
          const originalDate = parseLocalDate(reschedule.original_start_time);
          const newDate = parseLocalDate(reschedule.new_start_time);
          const originalTime = format(originalDate, 'HH:mm');
          const newTime = format(newDate, 'HH:mm');
          const originalEndTime = format(parseLocalDate(reschedule.original_end_time), 'HH:mm');
          const newEndTime = format(parseLocalDate(reschedule.new_end_time), 'HH:mm');

          return (
            <View style={styles.reschedulesSection}>
              <Text style={styles.sectionTitle}>Último Reagendamento:</Text>
              <View style={[styles.rescheduleCard, styles.acceptedRescheduleCard]}>
                <View style={styles.rescheduleHeader}>
                  <Text style={styles.rescheduleTitle}>Reagendamento Aceito</Text>
                  <Text style={styles.rescheduleDate}>
                    Aceito em {format(parseLocalDate(reschedule.accepted_at || reschedule.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </Text>
                </View>

                {/* Actor Info */}
                <View style={styles.actorInfoContainer}>
                  <View style={styles.actorInfoItem}>
                    <Text style={styles.actorInfoText}>
                      Solicitado por: <Text style={styles.actorInfoHighlight}>{reschedule.requested_by_type === 'client' ? 'Você' : 'Profissional'}</Text>
                    </Text>
                  </View>
                  <View style={styles.actorInfoItem}>
                    <Text style={styles.actorInfoText}>
                      Aceito por: <Text style={styles.actorInfoHighlight}>{reschedule.requested_by_type === 'client' ? 'Profissional' : 'Você'}</Text>
                    </Text>
                  </View>
                </View>

                <View style={styles.rescheduleTimes}>
                  <View style={styles.rescheduleTimeItem}>
                    <Text style={styles.rescheduleTimeLabel}>Horário anterior:</Text>
                    <Text style={styles.rescheduleTimeValue}>
                      {format(originalDate, 'dd/MM/yyyy', { locale: ptBR })} - {originalTime} às {originalEndTime}
                    </Text>
                  </View>
                  <View style={styles.rescheduleTimeItem}>
                    <Text style={styles.rescheduleTimeLabel}>Nova data e horário:</Text>
                    <Text style={[styles.rescheduleTimeValue, styles.newTimeValue]}>
                      {format(newDate, 'dd/MM/yyyy', { locale: ptBR })} - {newTime} às {newEndTime}
                    </Text>
                  </View>
                </View>

                {reschedule.justification && (
                  <View style={styles.rescheduleJustification}>
                    <Text style={styles.rescheduleJustificationLabel}>
                      {reschedule.requested_by_type === 'client' ? 'Sua justificativa:' : 'Justificativa do profissional:'}
                    </Text>
                    <Text style={styles.rescheduleJustificationText}>{reschedule.justification}</Text>
                  </View>
                )}
              </View>
            </View>
          );
        })()}

      {/* Client Pending Reschedules - Aguardando resposta do merchant */}
      {appointment.client_pending_reschedules && appointment.client_pending_reschedules.length > 0 && (() => {
        // Pegar apenas o último reagendamento (já vem ordenado do banco)
        const reschedule = appointment.client_pending_reschedules[0];
        const originalDate = parseLocalDate(reschedule.original_start_time);
        const newDate = parseLocalDate(reschedule.new_start_time);
        const originalTime = format(originalDate, 'HH:mm');
        const newTime = format(newDate, 'HH:mm');
        const originalEndTime = format(parseLocalDate(reschedule.original_end_time), 'HH:mm');
        const newEndTime = format(parseLocalDate(reschedule.new_end_time), 'HH:mm');

        return (
          <View style={styles.reschedulesSection}>
            <Text style={styles.sectionTitle}>Reagendamento pendente:</Text>
            <View style={styles.rescheduleCard}>
              <View style={styles.rescheduleHeader}>
                <Text style={styles.rescheduleTitle}>Reagendamento Solicitado</Text>
                <Text style={styles.rescheduleStatus}>Aguardando resposta do profissional</Text>
              </View>

              <View style={styles.rescheduleTimes}>
                <View style={styles.rescheduleTimeItem}>
                  <Text style={styles.rescheduleTimeLabel}>Horário atual:</Text>
                  <Text style={styles.rescheduleTimeValue}>
                    {format(originalDate, 'dd/MM/yyyy', { locale: ptBR })} - {originalTime} às {originalEndTime}
                  </Text>
                </View>
                <View style={styles.rescheduleTimeItem}>
                  <Text style={styles.rescheduleTimeLabel}>Novo horário solicitado:</Text>
                  <Text style={styles.rescheduleTimeValue}>
                    {format(newDate, 'dd/MM/yyyy', { locale: ptBR })} - {newTime} às {newEndTime}
                  </Text>
                </View>
              </View>

              {reschedule.justification && (
                <View style={styles.rescheduleJustification}>
                  <Text style={styles.rescheduleJustificationLabel}>Sua justificativa:</Text>
                  <Text style={styles.rescheduleJustificationText}>{reschedule.justification}</Text>
                </View>
              )}

              <View style={styles.pendingInfo}>
                <Text style={styles.pendingInfoText}>
                  O profissional precisa aceitar este reagendamento para que os horários sejam atualizados.
                </Text>
              </View>
            </View>
          </View>
        );
      })()}

      {/* Rejected Reschedules - Mostrar reagendamentos rejeitados */}
      {appointment.rejected_reschedules &&
        appointment.rejected_reschedules.length > 0 &&
        (!appointment.pending_reschedules || appointment.pending_reschedules.length === 0) &&
        (!appointment.client_pending_reschedules || appointment.client_pending_reschedules.length === 0) && (
          <View style={styles.reschedulesSection}>
            <Text style={styles.sectionTitle}>Reagendamento Rejeitado:</Text>
            {appointment.rejected_reschedules.map((reschedule) => {
              const originalDate = parseLocalDate(reschedule.original_start_time);
              const newDate = parseLocalDate(reschedule.new_start_time);
              const originalTime = format(originalDate, 'HH:mm');
              const newTime = format(newDate, 'HH:mm');
              const originalEndTime = format(parseLocalDate(reschedule.original_end_time), 'HH:mm');
              const newEndTime = format(parseLocalDate(reschedule.new_end_time), 'HH:mm');

              return (
                <View key={reschedule.id} style={[styles.rescheduleCard, styles.rejectedRescheduleCard]}>
                  <View style={styles.rescheduleHeader}>
                    <Text style={styles.rescheduleTitle}>Reagendamento Rejeitado</Text>
                    <Text style={styles.rescheduleDate}>
                      Rejeitado em {format(parseLocalDate(reschedule.rejected_at || reschedule.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </Text>
                  </View>

                  <View style={styles.rescheduleTimes}>
                    <View style={styles.rescheduleTimeItem}>
                      <Text style={styles.rescheduleTimeLabel}>Horário anterior:</Text>
                      <Text style={styles.rescheduleTimeValue}>
                        {format(originalDate, 'dd/MM/yyyy', { locale: ptBR })} - {originalTime} às {originalEndTime}
                      </Text>
                    </View>
                    <View style={styles.rescheduleTimeItem}>
                      <Text style={styles.rescheduleTimeLabel}>Horário sugerido:</Text>
                      <Text style={styles.rescheduleTimeValue}>
                        {format(newDate, 'dd/MM/yyyy', { locale: ptBR })} - {newTime} às {newEndTime}
                      </Text>
                    </View>
                  </View>

                  {reschedule.justification && (
                    <View style={styles.rescheduleJustification}>
                      <Text style={styles.rescheduleJustificationLabel}>
                        {reschedule.requested_by_type === 'merchant' ? 'Justificativa do profissional:' : 'Sua justificativa:'}
                      </Text>
                      <Text style={styles.rescheduleJustificationText}>{reschedule.justification}</Text>
                    </View>
                  )}

                  {reschedule.rejected_reason && (
                    <View style={styles.rescheduleJustification}>
                      <Text style={styles.rescheduleJustificationLabel}>Motivo da rejeição:</Text>
                      <Text style={styles.rescheduleJustificationText}>{reschedule.rejected_reason}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

      {/* Pending Reschedules - Criados pelo merchant (para o cliente aceitar/rejeitar) */}
      {appointment.pending_reschedules && appointment.pending_reschedules.length > 0 && (
        <View style={styles.reschedulesSection}>
          <Text style={styles.sectionTitle}>Solicitações de reagendamento:</Text>
          {appointment.pending_reschedules.map((reschedule) => {
            const originalDate = parseLocalDate(reschedule.original_start_time);
            const newDate = parseLocalDate(reschedule.new_start_time);
            const originalTime = format(originalDate, 'HH:mm');
            const newTime = format(newDate, 'HH:mm');
            const originalEndTime = format(parseLocalDate(reschedule.original_end_time), 'HH:mm');
            const newEndTime = format(parseLocalDate(reschedule.new_end_time), 'HH:mm');

            return (
              <View key={reschedule.id} style={styles.rescheduleCard}>
                <View style={styles.rescheduleHeader}>
                  <Text style={styles.rescheduleTitle}>Solicitação de Reagendamento</Text>
                  <Text style={styles.rescheduleDate}>
                    {format(parseLocalDate(reschedule.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </Text>
                </View>

                <View style={styles.rescheduleTimes}>
                  <View style={styles.rescheduleTimeItem}>
                    <Text style={styles.rescheduleTimeLabel}>Horário atual:</Text>
                    <Text style={styles.rescheduleTimeValue}>
                      {format(originalDate, 'dd/MM/yyyy', { locale: ptBR })} - {originalTime} às {originalEndTime}
                    </Text>
                  </View>
                  <View style={styles.rescheduleTimeItem}>
                    <Text style={styles.rescheduleTimeLabel}>Novo horário solicitado:</Text>
                    <Text style={styles.rescheduleTimeValue}>
                      {format(newDate, 'dd/MM/yyyy', { locale: ptBR })} - {newTime} às {newEndTime}
                    </Text>
                  </View>
                </View>

                {reschedule.justification && (
                  <View style={styles.rescheduleJustification}>
                    <Text style={styles.rescheduleJustificationLabel}>Justificativa:</Text>
                    <Text style={styles.rescheduleJustificationText}>{reschedule.justification}</Text>
                  </View>
                )}

                <View style={styles.rescheduleActions}>
                  <TouchableOpacity
                    style={[styles.rescheduleActionButton, styles.rejectButton]}
                    onPress={() => {
                      Alert.alert(
                        'Rejeitar Reagendamento',
                        'Deseja rejeitar esta solicitação de reagendamento?',
                        [
                          { text: 'Cancelar', style: 'cancel' },
                          {
                            text: 'Rejeitar',
                            style: 'destructive',
                            onPress: () => handleRejectReschedule(reschedule.id),
                          },
                        ]
                      );
                    }}
                    disabled={updating}
                  >
                    <Text style={styles.rejectButtonText}>Rejeitar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.rescheduleActionButton, styles.acceptButton]}
                    onPress={() => {
                      Alert.alert(
                        'Aceitar Reagendamento',
                        'Deseja aceitar esta solicitação de reagendamento? O horário do agendamento será atualizado.',
                        [
                          { text: 'Cancelar', style: 'cancel' },
                          {
                            text: 'Aceitar',
                            onPress: () => handleAcceptReschedule(reschedule.id),
                          },
                        ]
                      );
                    }}
                    disabled={updating}
                  >
                    <Text style={styles.acceptButtonText}>Aceitar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Timeline Section */}
      <AppointmentTimeline
        events={buildTimeline()}
        merchantLabel="Profissional"
        clientLabel="Você"
      />

    </ScreenContainer >
  );
};

export default AppointmentDetailScreen;

const styles = StyleSheet.create({
  actorInfoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 12,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  actorInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actorInfoText: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#666',
  },
  actorInfoHighlight: {
    fontFamily: 'Montserrat_700Bold',
    color: colors.textPrimary,
  },
  timelineContainer: {
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 0,
    minHeight: 80,
  },
  timelineLeftColumn: {
    alignItems: 'center',
    width: 24,
    marginRight: 12,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#999',
    zIndex: 1,
  },
  timelineDotCreation: {
    backgroundColor: '#2196F3',
  },
  timelineDotSuccess: {
    backgroundColor: '#17723F',
  },
  timelineDotConfirmed: {
    backgroundColor: '#17723F',
  },
  timelineDotError: {
    backgroundColor: colors.accent,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 4,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 24,
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  timelineTitle: {
    fontSize: 14,
    fontFamily: 'Montserrat_700Bold',
    color: '#333',
  },
  timelineDate: {
    fontSize: 12,
    fontFamily: 'Montserrat_400Regular',
    color: '#999',
  },
  timelineDescription: {
    fontSize: 13,
    fontFamily: 'Montserrat_400Regular',
    color: '#666',
    marginBottom: 4,
  },
  timelineActor: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#666',
    fontStyle: 'italic',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100,
  },
  errorText: {
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: colors.textPrimary,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 0,
    paddingBottom: 24,
  },
  cardWrapper: {
    width: Dimensions.get('window').width,
    marginLeft: -16,
    marginRight: -16,
  },
  reschedulesSection: {
    width: '100%',
    gap: 16,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: colors.accent,
  },
  rescheduleCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    gap: 16,
  },
  rescheduleHeader: {
    gap: 4,
  },
  rescheduleTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: colors.textPrimary,
  },
  rescheduleStatus: {
    fontSize: 14,
    fontFamily: 'Montserrat_500Medium',
    color: '#FFA500',
  },
  rescheduleDate: {
    fontSize: 12,
    fontFamily: 'Montserrat_400Regular',
    color: '#666666',
  },
  rescheduleTimes: {
    gap: 12,
  },
  rescheduleTimeItem: {
    gap: 4,
  },
  rescheduleTimeLabel: {
    fontSize: 14,
    fontFamily: 'Montserrat_500Medium',
    color: '#666666',
  },
  rescheduleTimeValue: {
    fontSize: 14,
    fontFamily: 'Montserrat_700Bold',
    color: colors.textPrimary,
  },
  rescheduleJustification: {
    gap: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  rescheduleJustificationLabel: {
    fontSize: 14,
    fontFamily: 'Montserrat_500Medium',
    color: '#666666',
  },
  rescheduleJustificationText: {
    fontSize: 14,
    fontFamily: 'Montserrat_400Regular',
    color: colors.textPrimary,
    lineHeight: 20,
  },
  rescheduleActions: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  rescheduleActionButton: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButton: {
    backgroundColor: '#17723F',
  },
  acceptButtonText: {
    fontSize: 14,
    fontFamily: 'Montserrat_700Bold',
    color: colors.surface,
  },
  rejectButton: {
    backgroundColor: colors.accent,
  },
  rejectButtonText: {
    fontSize: 14,
    fontFamily: 'Montserrat_700Bold',
    color: colors.surface,
  },
  acceptedRescheduleCard: {
    borderColor: '#17723F',
    borderWidth: 2,
    backgroundColor: '#F0F9F4',
  },
  rejectedRescheduleCard: {
    borderColor: colors.accent,
    borderWidth: 2,
    backgroundColor: '#FFF5F5',
  },
  newTimeValue: {
    color: '#17723F',
  },
  pendingInfo: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    marginTop: 8,
  },
  pendingInfoText: {
    fontSize: 14,
    fontFamily: 'Montserrat_400Regular',
    color: '#666666',
    lineHeight: 20,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

