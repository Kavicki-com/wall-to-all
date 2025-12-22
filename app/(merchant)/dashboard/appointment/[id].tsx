import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Alert, Modal } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { supabase } from '../../../../lib/supabase';
import { Icon } from '../../../../components/ui/Icon';
import { MaterialSymbolIcon } from '../../../../components/ui/MaterialSymbolIcon';
import AppHeader from '../../../../components/layout/AppHeader';
import ScreenContainer from '../../../../components/layout/ScreenContainer';
import { CustomButton } from '../../../../components/CustomButton';
import { format, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { calculateAppointmentPrice, checkAppointmentConflicts, applyAcceptedReschedules } from '../../../../lib/utils';
import { notifyRescheduleAccepted, notifyRescheduleRejected } from '../../../../lib/notifications';
import { safeGoBack } from '../../../../lib/router-utils';
import { handleError } from '../../../../lib/errorHandler';

type AppointmentReschedule = {
  id: number;
  appointment_id: number;
  requested_by: string;
  requested_by_type: 'client' | 'merchant';
  original_start_time: string;
  original_end_time: string;
  new_start_time: string;
  new_end_time: string;
  justification?: string | null;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  created_at: string;
  accepted_at?: string | null;
  rejected_at?: string | null;
  rejected_reason?: string | null;
};

type Appointment = {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  payment_method: string;
  client_notes: string | null;
  service: {
    id: string;
    name: string;
    price: number;
    price_type: string;
    duration_minutes: number;
    photos: string[] | string | null;
  };
  client: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    email: string | null;
  };
  business: {
    id: string;
    business_name: string;
    address: string | null;
  };
  pending_reschedules?: AppointmentReschedule[];
  merchant_pending_reschedules?: AppointmentReschedule[];
  accepted_reschedules?: AppointmentReschedule[];
  rejected_reschedules?: AppointmentReschedule[];
};

const AppointmentDetailScreen: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [updating, setUpdating] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingActiveRef = useRef(false);

  // Função para carregar agendamento - memoizada para evitar recriações desnecessárias
  const loadAppointment = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      // Buscar business_profile do lojista
      const { data: businessData, error: businessError } = await supabase
        .from('business_profiles')
        .select('id')
        .eq('owner_id', user.id)
        .single();

      if (businessError || !businessData) {
        if (businessError && businessError.code !== 'PGRST116') {
          handleError(businessError, 'general');
        }
        router.replace('/(merchant)/dashboard');
        return;
      }

      // Buscar agendamento com dados atualizados
      // O polling periódico garante que dados atualizados sejam buscados automaticamente
      const { data: appointmentData, error } = await supabase
        .from('appointments')
        .select(
          `
          *,
          service:services(id, name, price, price_type, duration_minutes, photos),
          client:profiles!appointments_client_id_fkey(id, full_name, avatar_url, email),
          business:business_profiles(id, business_name, address)
        `,
        )
        .eq('id', params.id)
        .eq('business_id', businessData.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          Alert.alert('Agendamento não encontrado', 'Este agendamento não existe ou foi removido.');
        } else {
          const processed = handleError(error, 'appointment');
          Alert.alert('Erro', processed.userMessage);
        }
        router.replace('/(merchant)/dashboard');
      } else if (appointmentData) {
        const appointmentsWithReschedules = await applyAcceptedReschedules([appointmentData]);
        const appointmentWithAcceptedReschedule = appointmentsWithReschedules[0] || appointmentData;
        
        const [
          { data: clientPendingReschedules },
          { data: merchantPendingReschedules },
          { data: acceptedReschedules },
          { data: rejectedReschedules }
        ] = await Promise.all([
          supabase
            .from('appointment_reschedules')
            .select('*')
            .eq('appointment_id', appointmentData.id)
            .eq('status', 'pending')
            .eq('requested_by_type', 'client')
            .order('created_at', { ascending: false }),
          supabase
            .from('appointment_reschedules')
            .select('*')
            .eq('appointment_id', appointmentData.id)
            .eq('status', 'pending')
            .eq('requested_by_type', 'merchant')
            .order('created_at', { ascending: false })
            .limit(1),
          supabase
            .from('appointment_reschedules')
            .select('*')
            .eq('appointment_id', appointmentData.id)
            .eq('status', 'accepted')
            .eq('requested_by_type', 'merchant')
            .order('accepted_at', { ascending: false })
            .limit(1),
          supabase
            .from('appointment_reschedules')
            .select('*')
            .eq('appointment_id', appointmentData.id)
            .eq('status', 'rejected')
            .order('rejected_at', { ascending: false })
            .limit(1)
        ]);
        const updatedAppointment = {
          ...appointmentWithAcceptedReschedule,
          pending_reschedules: clientPendingReschedules || [],
          merchant_pending_reschedules: merchantPendingReschedules || [],
          accepted_reschedules: acceptedReschedules || [],
          rejected_reschedules: rejectedReschedules || [],
        } as Appointment & { 
          merchant_pending_reschedules?: AppointmentReschedule[];
          accepted_reschedules?: AppointmentReschedule[];
          rejected_reschedules?: AppointmentReschedule[];
        };
        
        setAppointment(updatedAppointment);
      }
    } catch (error) {
      handleError(error, 'appointment');
      if (showLoading) {
        Alert.alert('Erro', 'Ocorreu um erro ao carregar o agendamento.');
      }
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [params.id, router]);

  // Função para iniciar o polling
  const startPolling = useCallback(() => {
    // Limpar qualquer intervalo existente antes de criar um novo
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    
    isPollingActiveRef.current = true;
    pollingIntervalRef.current = setInterval(() => {
      // Usar ref para verificar se ainda há appointment (evita dependência circular)
      // O loadAppointment vai verificar internamente se precisa atualizar
      loadAppointment(false).catch(() => {
        // Silenciosamente ignorar erros durante polling
      });
    }, 15000); // Verificar a cada 15 segundos para evitar sobrecarga
  }, [loadAppointment]);

  // Função para parar o polling
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    isPollingActiveRef.current = false;
  }, []);

  useEffect(() => {
    let isMounted = true;
    
    const initialize = async () => {
      await loadAppointment(true);
      
      // Iniciar polling após um pequeno delay para garantir que o carregamento inicial terminou
      if (isMounted && !isPollingActiveRef.current) {
        setTimeout(() => {
          if (isMounted && !isPollingActiveRef.current) {
            startPolling();
          }
        }, 2000);
      }
    };
    
    initialize();
    
    return () => {
      isMounted = false;
      stopPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Dependência apenas de params.id para evitar loops: loadAppointment e startPolling são funções estáveis
  }, [params.id]);

  // Recarregar dados quando a tela recebe foco (quando volta de outras telas)
  // Isso garante que os dados sejam atualizados quando o cliente aceita um reagendamento
  useFocusEffect(
    useCallback(() => {
      // Forçar recarregamento para garantir dados atualizados após reagendamento aceito
      // Aguardar um pouco para garantir que qualquer atualização no banco foi processada
      const timer = setTimeout(() => {
        loadAppointment(true);
      }, 100);
      
      return () => {
        clearTimeout(timer);
      };
    }, [loadAppointment])
  );


  const handleStatusUpdate = async (newStatus: string) => {
    if (!appointment) return;

    try {
      setUpdating(true);

      const { error } = await supabase
        .from('appointments')
        .update({ status: newStatus })
        .eq('id', appointment.id);

      if (error) {
        const processed = handleError(error, 'appointment');
        Alert.alert('Erro', processed.userMessage);
      } else {
        loadAppointment();
      }
    } catch (error) {
      handleError(error, 'appointment');
      Alert.alert('Erro', 'Ocorreu um erro ao atualizar o status.');
    } finally {
      setUpdating(false);
    }
  };

  const handleConfirm = () => {
    Alert.alert(
      'Confirmar Agendamento',
      'Deseja confirmar este agendamento?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Confirmar', onPress: () => handleStatusUpdate('confirmed') },
      ],
    );
  };

  const handleReschedule = () => {
    if (!appointment) return;
    router.push({
      pathname: '/(merchant)/dashboard/appointment/confirm',
      params: {
        appointmentId: appointment.id,
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
        Alert.alert('Erro', 'Reagendamento não encontrado ou já processado.');
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
        handleError(conflictError, 'appointment');
        Alert.alert('Erro', 'Não foi possível verificar disponibilidade do horário.');
        return;
      }

      if (hasConflict) {
        Alert.alert(
          'Horário Indisponível',
          'Este horário já está ocupado. O reagendamento não pode ser aceito.'
        );
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
        handleError(updateError, 'appointment');
        Alert.alert('Erro', 'Não foi possível aceitar o reagendamento.');
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
        handleError(acceptError, 'appointment');
        Alert.alert('Erro', 'Reagendamento atualizado, mas houve erro ao atualizar o status.');
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

      // Enviar notificação ao cliente
      if (appointment.client?.id) {
        await notifyRescheduleAccepted(
          appointment.client.id,
          parseInt(appointment.id),
          rescheduleId,
          rescheduleData.new_start_time,
          appointment.business.business_name
        );
      }

      await loadAppointment();
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      Alert.alert('Sucesso', 'Reagendamento aceito com sucesso.');
    } catch (error) {
      handleError(error, 'appointment');
      Alert.alert('Erro', 'Ocorreu um erro ao aceitar o reagendamento.');
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
        handleError(error, 'appointment');
        Alert.alert('Erro', 'Não foi possível rejeitar o reagendamento.');
        return;
      }

      // Enviar notificação ao cliente
      if (appointment.client?.id && rescheduleData) {
        await notifyRescheduleRejected(
          appointment.client.id,
          parseInt(appointment.id),
          rescheduleId,
          appointment.business.business_name,
          reason || null
        );
      }

      await loadAppointment();
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
      Alert.alert('Sucesso', 'Reagendamento rejeitado.');
    } catch (error) {
      handleError(error, 'appointment');
      Alert.alert('Erro', 'Ocorreu um erro ao rejeitar o reagendamento.');
    } finally {
      setUpdating(false);
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    const methodMap: Record<string, string> = {
      pix: 'PIX',
      card: 'Cartão',
      cash: 'Dinheiro',
    };
    return methodMap[method] || method;
  };

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case 'pix':
        return <Icon family="FontAwesome6" name="pix" size={24} color="#000E3D" />;
      case 'card':
        return <Icon name="credit-card" size={24} color="#000E3D" />;
      case 'cash':
        return <Icon name="payments" size={24} color="#000E3D" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <ScreenContainer scroll={false} backgroundColor="#FAFAFA" hasTabBar={false}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E5102E" />
        </View>
      </ScreenContainer>
    );
  }

  if (!appointment) {
    return (
      <ScreenContainer 
        scroll={false} 
        backgroundColor="#FAFAFA" 
        hasHeader={true}
        hasTabBar={false}
        header={
          <AppHeader 
            showBackButton={true}
            onPressBack={() => safeGoBack('/(merchant)/dashboard')}
          />
        }
      >
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Agendamento não encontrado.</Text>
        </View>
      </ScreenContainer>
    );
  }

  const appointmentDate = new Date(appointment.start_time);
  const isTodayDate = isToday(appointmentDate);
  const dateLabel = isTodayDate
    ? 'Hoje'
    : format(appointmentDate, "EEEE, d 'de' MMMM", { locale: ptBR });
  const timeLabel = format(appointmentDate, 'HH:mm');

  return (
    <ScreenContainer 
      scroll={true}
      hasHeader={true}
      hasTabBar={false}
      backgroundColor="#FAFAFA"
      horizontalPadding={0}
      contentContainerStyle={styles.scrollContent}
      header={
        <AppHeader 
          showBackButton={true}
          onPressBack={() => safeGoBack('/(merchant)/dashboard')}
        />
      }
    >
        {/* Appointment Details Card */}
        <View style={styles.detailsCard}>
          {/* Header: Date and Time */}
          <View style={styles.headerSection}>
            <Text style={styles.dateTimeHeader}>
              {dateLabel} - {timeLabel}
            </Text>
            <Text style={styles.serviceNameHeader}>{appointment.service.name}</Text>
          </View>

          {/* Client Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cliente:</Text>
            <View style={styles.clientInfo}>
              {appointment.client.avatar_url ? (
                <Image
                  source={{ uri: appointment.client.avatar_url }}
                  style={styles.clientAvatar}
                />
              ) : (
                <View style={[styles.clientAvatar, styles.placeholderAvatar]} />
              )}
              <Text style={styles.clientName}>
                {appointment.client.full_name || 'Cliente'}
              </Text>
            </View>
          </View>

          {/* Payment Method */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Método de pagamento:</Text>
            <View style={styles.paymentMethodCard}>
              {getPaymentMethodIcon(appointment.payment_method)}
              <View style={styles.paymentMethodInfo}>
                <Text style={styles.paymentMethodLabel}>
                  {getPaymentMethodLabel(appointment.payment_method)}
                </Text>
                <Text style={styles.paymentMethodPrice}>
                  R$ {calculateAppointmentPrice(
                    appointment.service.price,
                    appointment.service.price_type as 'fixed' | 'hourly',
                    appointment.service.duration_minutes
                  ).toFixed(2).replace('.', ',')}
                </Text>
              </View>
            </View>
          </View>

          {/* Observations */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Observações do cliente:</Text>
            <Text style={styles.observations}>
              {appointment.client_notes || 'Nenhuma observação'}
            </Text>
          </View>

          {/* Pending Reschedules */}
          {appointment.pending_reschedules && appointment.pending_reschedules.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Solicitações de reagendamento:</Text>
              {appointment.pending_reschedules.map((reschedule) => {
                const originalDate = new Date(reschedule.original_start_time);
                const newDate = new Date(reschedule.new_start_time);
                const originalTime = format(originalDate, 'HH:mm');
                const newTime = format(newDate, 'HH:mm');
                const originalEndTime = format(new Date(reschedule.original_end_time), 'HH:mm');
                const newEndTime = format(new Date(reschedule.new_end_time), 'HH:mm');

                return (
                  <View key={reschedule.id} style={styles.rescheduleCard}>
                    <View style={styles.rescheduleHeader}>
                      <Text style={styles.rescheduleTitle}>Solicitação de Reagendamento</Text>
                      <Text style={styles.rescheduleDate}>
                        {format(new Date(reschedule.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
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

          {/* Merchant Pending Reschedules - Aguardando resposta do cliente */}
          {appointment.merchant_pending_reschedules && appointment.merchant_pending_reschedules.length > 0 && (() => {
            // Pegar apenas o último reagendamento (já vem ordenado do banco)
            const reschedule = appointment.merchant_pending_reschedules[0];
            const originalDate = new Date(reschedule.original_start_time);
            const newDate = new Date(reschedule.new_start_time);
            const originalTime = format(originalDate, 'HH:mm');
            const newTime = format(newDate, 'HH:mm');
            const originalEndTime = format(new Date(reschedule.original_end_time), 'HH:mm');
            const newEndTime = format(new Date(reschedule.new_end_time), 'HH:mm');

            return (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Reagendamento pendente:</Text>
                <View style={styles.rescheduleCard}>
                  <View style={styles.rescheduleHeader}>
                    <Text style={styles.rescheduleTitle}>Reagendamento Sugerido</Text>
                    <Text style={styles.rescheduleStatus}>Aguardando resposta do cliente</Text>
                  </View>

                  <View style={styles.rescheduleTimes}>
                    <View style={styles.rescheduleTimeItem}>
                      <Text style={styles.rescheduleTimeLabel}>Horário atual:</Text>
                      <Text style={styles.rescheduleTimeValue}>
                        {format(originalDate, 'dd/MM/yyyy', { locale: ptBR })} - {originalTime} às {originalEndTime}
                      </Text>
                    </View>
                    <View style={styles.rescheduleTimeItem}>
                      <Text style={styles.rescheduleTimeLabel}>Novo horário sugerido:</Text>
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

                  <View style={styles.pendingInfo}>
                    <Text style={styles.pendingInfoText}>
                      O cliente precisa aceitar este reagendamento para que os horários sejam atualizados.
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
           (!appointment.merchant_pending_reschedules || appointment.merchant_pending_reschedules.length === 0) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Reagendamento Rejeitado:</Text>
              {appointment.rejected_reschedules.map((reschedule) => {
                const originalDate = new Date(reschedule.original_start_time);
                const newDate = new Date(reschedule.new_start_time);
                const originalTime = format(originalDate, 'HH:mm');
                const newTime = format(newDate, 'HH:mm');
                const originalEndTime = format(new Date(reschedule.original_end_time), 'HH:mm');
                const newEndTime = format(new Date(reschedule.new_end_time), 'HH:mm');

                return (
                  <View key={reschedule.id} style={[styles.rescheduleCard, styles.rejectedRescheduleCard]}>
                    <View style={styles.rescheduleHeader}>
                      <Text style={styles.rescheduleTitle}>Reagendamento Rejeitado</Text>
                      <Text style={styles.rescheduleDate}>
                        Rejeitado em {format(new Date(reschedule.rejected_at || reschedule.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
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
                        <Text style={styles.rescheduleTimeLabel}>
                          {reschedule.requested_by_type === 'merchant' ? 'Horário sugerido:' : 'Horário solicitado:'}
                        </Text>
                        <Text style={styles.rescheduleTimeValue}>
                          {format(newDate, 'dd/MM/yyyy', { locale: ptBR })} - {newTime} às {newEndTime}
                        </Text>
                      </View>
                    </View>

                    {reschedule.justification && (
                      <View style={styles.rescheduleJustification}>
                        <Text style={styles.rescheduleJustificationLabel}>
                          {reschedule.requested_by_type === 'merchant' ? 'Sua justificativa:' : 'Justificativa do cliente:'}
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

          {/* Action Buttons */}
          {appointment.status !== 'cancelled' && appointment.status !== 'completed' && (
            <View style={styles.actionButtonsContainer}>
              {appointment.status === 'pending' && 
               (!appointment.merchant_pending_reschedules || appointment.merchant_pending_reschedules.length === 0) &&
               (!appointment.accepted_reschedules || appointment.accepted_reschedules.length === 0) && (
                <CustomButton
                  compact
                  title="Confirmar agendamento"
                  onPress={handleConfirm}
                  disabled={updating}
                  variant="outline"
                  rightIcon={<MaterialSymbolIcon name="check_circle" size={24} color="#000E3D" />}
                  style={{ marginBottom: 12 }}
                />
              )}
              <CustomButton
                compact
                title="Sugerir novo agendamento"
                onPress={handleReschedule}
                disabled={updating}
                variant="ghost"
                textStyle={{ color: '#E5102E' }}
                style={styles.rescheduleButton}
              />
            </View>
          )}
        </View>

      {/* Modal de Confirmação */}
      <Modal
        visible={showConfirmationModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowConfirmationModal(false);
          safeGoBack('/(merchant)/dashboard');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmationModalContent}>
            <Icon name="check-circle" size={67} color="#17723F" />
            <Text style={styles.confirmationTitle}>Sugestão de novo horário enviada</Text>
            <Text style={styles.confirmationMessage}>
              Aguarde o seu cliente confirmar a sua sugestão
            </Text>
            <CustomButton
              title="Fechar"
              onPress={() => {
                setShowConfirmationModal(false);
                safeGoBack('/(merchant)/dashboard');
              }}
              variant="primary"
              style={{ borderRadius: 24, marginVertical: 0 }}
              width="100%"
            />
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
};

export default AppointmentDetailScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    paddingRight: 0,
  },
  detailsCard: {
    backgroundColor: '#FEFEFE',
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    padding: 24,
    paddingBottom: 32,
    marginBottom: 24,
    width: '100%',
    shadowColor: '#1D1D1D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 4,
    gap: 24,
  },
  headerSection: {
    gap: 8,
  },
  dateTimeHeader: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#E5102E',
  },
  serviceNameHeader: {
    fontSize: 20,
    fontFamily: 'Montserrat_700Bold',
    color: '#0F0F0F',
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#E5102E',
  },
  clientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clientAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
  },
  placeholderAvatar: {
    backgroundColor: '#E0E0E0',
  },
  clientName: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#0F0F0F',
  },
  paymentMethodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#FEFEFE',
    borderRadius: 24,
    padding: 16,
    shadowColor: '#1D1D1D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 4,
  },
  paymentMethodInfo: {
    flex: 1,
    gap: 8,
  },
  paymentMethodLabel: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#0F0F0F',
  },
  paymentMethodPrice: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#17723F',
  },
  observations: {
    fontSize: 16,
    fontFamily: 'Montserrat_500Medium',
    fontWeight: '500',
    color: '#0F0F0F',
    lineHeight: 24,
    flexWrap: 'wrap',
  },
  rescheduleCard: {
    backgroundColor: '#FEFEFE',
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
    color: '#0F0F0F',
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
    color: '#0F0F0F',
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
    color: '#0F0F0F',
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
    color: '#FEFEFE',
  },
  rejectButton: {
    backgroundColor: '#E5102E',
  },
  rejectButtonText: {
    fontSize: 14,
    fontFamily: 'Montserrat_700Bold',
    color: '#FEFEFE',
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
  rejectedRescheduleCard: {
    borderColor: '#E5102E',
    borderWidth: 2,
    backgroundColor: '#FFF5F5',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#474747',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmationModalContent: {
    backgroundColor: '#FEFEFE',
    borderRadius: 24,
    padding: 16,
    alignItems: 'center',
    gap: 16,
  },
  confirmationTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#17723F',
    textAlign: 'center',
  },
  confirmationMessage: {
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#0F0F0F',
    textAlign: 'center',
  },
  actionButtonsContainer: {
    marginTop: 8,
    paddingTop: 16,
  },
  rescheduleButton: {
    borderWidth: 1,
    borderColor: '#E5102E',
    borderRadius: 24,
  },
});

