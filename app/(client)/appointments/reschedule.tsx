import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TouchableWithoutFeedback,
  Platform,
  Alert,
  Dimensions,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../components/ui/ToastProvider';
import { handleError } from '../../../lib/errorHandler';
import { IconDateRange, IconTimer, IconCheckCircle } from '../../../lib/icons';
import { Icon } from '../../../components/ui/Icon';
import AppHeader from '../../../components/layout/AppHeader';
import ScreenContainer from '../../../components/layout/ScreenContainer';
import RescheduleModalCard from '../../../components/ui/RescheduleModalCard';
import { ScheduleSectionHeader } from '../../../components/appointments/ScheduleSectionHeader';
import { PrimaryActionButton } from '../../../components/appointments/PrimaryActionButton';
import { PillGrid, PillItem } from '../../../components/appointments/PillGrid';
import { InlineLink } from '../../../components/appointments/InlineLink';
import { format } from 'date-fns';
import { notifyRescheduleRequested } from '../../../lib/notifications';
import { CustomButton } from '../../../components/CustomButton';
import { useResponsiveWidth } from '../../../lib/responsive';
import { safeGoBack } from '../../../lib/router-utils';
import { validateTime, validateDate } from '../../../lib/validations';
import { RESCHEDULE_DEFAULTS } from '../../../lib/constants';
import { applyAcceptedReschedules } from '../../../lib/utils';
import { logger } from '../../../lib/logger';
import { Appointment, WorkDays } from '../../../lib/types';

// Usando tipo centralizado de lib/types.ts
// Note: Appointment já tem business e service como nested objects

type TimeSlot = {
  time: string;
  available: boolean;
  type: 'available' | 'occupied' | 'lunch';
};

const RescheduleAppointmentScreen: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ appointmentId: string; reason?: string }>();
  const { showError } = useToast();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [loadingTimes, setLoadingTimes] = useState(false);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [availableDates, setAvailableDates] = useState<Date[]>([]);
  const [markedDates, setMarkedDates] = useState<string[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [timesToShow, setTimesToShow] = useState<number>(RESCHEDULE_DEFAULTS.INITIAL_TIMES_TO_SHOW);
  const [datesToShow, setDatesToShow] = useState<number>(RESCHEDULE_DEFAULTS.INITIAL_DATES_TO_SHOW);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [justification, setJustification] = useState(params.reason || '');

  // Dimensões responsivas
  const iconSize = useResponsiveWidth(67);

  // Recarregar dados sempre que o agendamento ou a justificativa nos params mudar.
  // Isso evita manter dados do agendamento anterior quando o usuário abre a tela
  // novamente a partir de outro agendamento.
  useEffect(() => {
    loadAppointmentData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // loadAppointmentData é estável (useCallback), não precisa estar nas dependências
  }, [params.appointmentId, params.reason]);

  useEffect(() => {
    if (selectedDate && appointment) {
      loadAvailableTimes();
    } else {
      setTimeSlots([]);
      setSelectedTime(null);
      setTimesToShow(RESCHEDULE_DEFAULTS.INITIAL_TIMES_TO_SHOW);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // loadAvailableTimes é estável (useCallback), não precisa estar nas dependências
  }, [selectedDate, appointment]);

  // Resetar campos quando a tela é focada (exceto se vier com reason nos params)
  useFocusEffect(
    React.useCallback(() => {
      // Se não há reason nos params, significa que é uma nova entrada ou volta após processo
      // Resetar campos para limpar histórico de processos anteriores
      if (!params.reason) {
        setJustification('');
        setSelectedDate(null);
        setSelectedTime(null);
        setTimesToShow(RESCHEDULE_DEFAULTS.INITIAL_TIMES_TO_SHOW);
        setDatesToShow(RESCHEDULE_DEFAULTS.INITIAL_DATES_TO_SHOW);
        setShowRescheduleModal(false);
        setShowConfirmationModal(false);
      } else {
        setSelectedDate(null);
        setSelectedTime(null);
        setTimesToShow(RESCHEDULE_DEFAULTS.INITIAL_TIMES_TO_SHOW);
        setDatesToShow(RESCHEDULE_DEFAULTS.INITIAL_DATES_TO_SHOW);
        setShowRescheduleModal(false);
        setShowConfirmationModal(false);
      }
    }, [params.reason])
  );

  const loadAppointmentData = async () => {
    try {
      setLoading(true);
      setAppointment(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace('/(client)/appointments');
        return;
      }

      if (!params.appointmentId) {
        router.replace('/(client)/appointments');
        return;
      }

      const { data: appointmentData, error } = await supabase
        .from('appointments')
        .select(
          `
          *,
          business:business_profiles(id, business_name, work_days, logo_url, address),
          service:services(id, name, duration_minutes, price)
        `,
        )
        .eq('id', Number(params.appointmentId))
        .eq('client_id', user.id)
        .single();

      if (error || !appointmentData) {
        handleError(error || new Error('Agendamento não encontrado'), 'appointment');
        router.replace('/(client)/appointments');
        return;
      }

      setAppointment(appointmentData as Appointment);
      generateAvailableDates(appointmentData as Appointment);
      
      if (params.reason) {
        setJustification(params.reason);
      } else {
        setJustification('');
      }
    } catch (error) {
      handleError(error, 'appointment');
      router.replace('/(client)/appointments');
    } finally {
      setLoading(false);
    }
  };

  const generateAvailableDates = (_apt: Appointment) => {
    const dates: Date[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 1; i <= 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date);
    }

    setAvailableDates(dates);
    // Criar array de datas marcadas no formato 'yyyy-MM-dd'
    const markedDatesArray = dates.map((date) => format(date, 'yyyy-MM-dd'));
    setMarkedDates(markedDatesArray);
  };

  // Função auxiliar para converter duração do serviço (mesma lógica do merchant)
  const parseServiceDuration = (duration: number): number => {
    if (!duration) return 60;
    if (duration <= 480) return duration;
    const convertedFromMs = Math.round(duration / 1000 / 60);
    if (convertedFromMs > 0 && convertedFromMs <= 480) return convertedFromMs;
    const convertedFromSeconds = Math.round(duration / 60);
    if (convertedFromSeconds > 0 && convertedFromSeconds <= 480) return convertedFromSeconds;
    return 60;
  };

  const loadAvailableTimes = async () => {
    if (!selectedDate || !appointment) {
      return;
    }

    try {
      setLoadingTimes(true);
      const dateString = selectedDate.toISOString().split('T')[0];

      let workDays = appointment.business?.work_days;
      let lunchBreakStart: string | null = null;
      let lunchBreakEnd: string | null = null;
      
      if (!workDays) {
        const { data: businessProfile, error: businessError } = await supabase
          .from('business_profiles')
          .select('work_days, lunch_break_start, lunch_break_end')
          .eq('id', appointment.business_id)
          .single();

        if (businessError || !businessProfile) {
          handleError(businessError || new Error('Perfil do negócio não encontrado'), 'appointment');
          setTimeSlots([]);
          setLoadingTimes(false);
          return;
        }
        
        workDays = businessProfile.work_days;
        lunchBreakStart = businessProfile.lunch_break_start;
        lunchBreakEnd = businessProfile.lunch_break_end;
        
        if (typeof workDays === 'string') {
          try {
            workDays = JSON.parse(workDays);
          } catch (e) {
            handleError(e, 'appointment');
            setTimeSlots([]);
            setLoadingTimes(false);
            return;
          }
        }
      } else {
        // Se workDays já está disponível, ainda precisamos buscar os horários de almoço
        const { data: businessProfile } = await supabase
          .from('business_profiles')
          .select('lunch_break_start, lunch_break_end')
          .eq('id', appointment.business_id)
          .single();
        
        if (businessProfile) {
          lunchBreakStart = businessProfile.lunch_break_start;
          lunchBreakEnd = businessProfile.lunch_break_end;
        }
      }
      
      if (!workDays) {
        setTimeSlots([]);
        setLoadingTimes(false);
        return;
      }

      const dayNames = [
        'sunday',
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
      ];
      const dayName = dayNames[selectedDate.getDay()];
      const workDay = (workDays as WorkDays)[dayName];

      if (!workDay) {
        setTimeSlots([]);
        setLoadingTimes(false);
        return;
      }

      const startTime = workDay.start;
      const endTime = workDay.end;

      if (!startTime || !endTime || typeof startTime !== 'string' || typeof endTime !== 'string') {
        setTimeSlots([]);
        setLoadingTimes(false);
        return;
      }

      const { data: existingAppointments } = await supabase
        .from('appointments')
        .select('id, start_time, end_time')
        .eq('business_id', appointment.business_id)
        .gte('start_time', `${dateString}T00:00:00`)
        .lt('start_time', `${dateString}T23:59:59`)
        .in('status', ['pending', 'confirmed'])
        .neq('id', Number(params.appointmentId));
      
      // Aplicar reagendamentos aceitos aos appointments existentes
      const appointmentsWithReschedules = existingAppointments 
        ? await applyAcceptedReschedules(existingAppointments)
        : [];

      const serviceDuration = parseServiceDuration(appointment.service?.duration_minutes || 60);
      const slots = generateTimeSlots(
        startTime,
        endTime,
        appointmentsWithReschedules || [],
        serviceDuration,
        dateString,
        lunchBreakStart,
        lunchBreakEnd,
      );
      
      setTimeSlots(slots);
    } catch (error) {
      handleError(error, 'appointment');
      setTimeSlots([]);
    } finally {
      setLoadingTimes(false);
    }
  };

  const generateTimeSlots = (
    startTime: string,
    endTime: string,
    existingAppointments: Array<{ start_time: string; end_time: string }>,
    serviceDuration: number,
    dateString: string,
    lunchBreakStart?: string | null,
    lunchBreakEnd?: string | null,
  ): TimeSlot[] => {
    const slots: TimeSlot[] = [];
    const [startHour] = startTime.split(':').map(Number);
    const [endHour] = endTime.split(':').map(Number);

    if (isNaN(startHour) || isNaN(endHour)) {
      return [];
    }

    // Calcular a duração do serviço em horas (arredondado para cima)
    const serviceDurationHours = Math.ceil(serviceDuration / 60);

    let currentHour = startHour;

    // Gerar slots apenas dentro do horário de funcionamento
    while (currentHour < endHour) {
      const timeString = `${String(currentHour).padStart(2, '0')}:00`;
      const nextHour = currentHour + 1;
      const slotEndTime = `${String(nextHour).padStart(2, '0')}:00`;

      let type: 'available' | 'occupied' | 'lunch' = 'available';

      // Verificar se está no horário de almoço
      if (lunchBreakStart && lunchBreakEnd) {
        const [lunchStartHour] = lunchBreakStart.split(':').map(Number);
        const [lunchEndHour] = lunchBreakEnd.split(':').map(Number);
        
        // Verificar se o slot está dentro do horário de almoço
        if (currentHour >= lunchStartHour && currentHour < lunchEndHour) {
          type = 'lunch';
          slots.push({ time: timeString, available: false, type });
          currentHour += 1;
          continue;
        }
      }

      // Verificar se há espaço suficiente para o serviço ANTES de verificar appointments
      // Se o serviço não cabe no tempo restante do expediente, marcar como ocupado
      const serviceEndHour = currentHour + serviceDurationHours;
      if (serviceEndHour > endHour) {
        type = 'occupied';
        slots.push({ time: timeString, available: false, type });
        currentHour += 1;
        continue;
      }

      // Verificar overlap com appointments existentes
      // Calcular o horário de término do serviço se ele começar neste slot
      const serviceStart = new Date(`${dateString}T${timeString}:00`);
      const serviceEnd = new Date(serviceStart);
      serviceEnd.setMinutes(serviceEnd.getMinutes() + serviceDuration);

      const isOccupied = existingAppointments.some((apt) => {
        const aptStart = new Date(apt.start_time);
        const aptEnd = new Date(apt.end_time);
        
        const aptDateString = aptStart.toISOString().split('T')[0];
        if (aptDateString !== dateString) {
          return false;
        }
        
        // Verificar se há overlap entre o serviço (serviceStart até serviceEnd) e o appointment
        return (
          (serviceStart.getTime() < aptEnd.getTime() && serviceEnd.getTime() > aptStart.getTime())
        );
      });

      if (isOccupied) {
        type = 'occupied';
      }

      slots.push({ time: timeString, available: type === 'available', type });

      currentHour += 1;
    }

    return slots;
  };

  const handleDateSelect = (date: Date) => {
    const dateString = format(date, 'yyyy-MM-dd');
    const isAvailable = markedDates.includes(dateString);
    
    if (isAvailable) {
      setSelectedDate(date);
      setSelectedTime(null);
      setTimesToShow(RESCHEDULE_DEFAULTS.INITIAL_TIMES_TO_SHOW);
    }
  };

  const handleTimeSelect = (time: string) => {
    const slot = timeSlots.find((s) => s.time === time);
    if (slot?.available) {
      setSelectedTime(time);
    }
  };

  const handleSuggestNewTime = () => {
    if (!selectedDate || !selectedTime || !appointment) return;
    setShowRescheduleModal(true);
  };

  const handleSubmitReschedule = async () => {
    if (!selectedDate || !selectedTime || !appointment) return;

    try {
      // Validar formato de horário
      if (!validateTime(selectedTime)) {
        showError('O formato do horário é inválido. Use o formato HH:mm.');
        return;
      }

      // Validar data
      if (!validateDate(selectedDate, false)) {
        showError('Selecione uma data futura para o reagendamento.');
        return;
      }

      // Obter usuário autenticado
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        showError('Usuário não autenticado');
        return;
      }

      const [hours, minutes] = selectedTime.split(':').map(Number);
      const newStartTime = new Date(selectedDate);
      newStartTime.setHours(hours, minutes, 0, 0);

      // Verificar se o horário não é no passado
      const now = new Date();
      if (newStartTime.getTime() < now.getTime()) {
        showError('Selecione um horário futuro para o reagendamento.');
        return;
      }

      // Usar função auxiliar para converter duração
      const serviceDuration = parseServiceDuration(appointment.service?.duration_minutes || 60);
      const newEndTime = new Date(newStartTime);
      newEndTime.setMinutes(newEndTime.getMinutes() + serviceDuration);

      // Horários originais do agendamento
      const originalStartTime = new Date(appointment.start_time);
      const originalEndTime = new Date(appointment.end_time);

      // Criar registro na tabela de histórico
      const { data: rescheduleData, error: rescheduleError } = await supabase
        .from('appointment_reschedules')
        .insert({
          appointment_id: parseInt(params.appointmentId),
          requested_by: user.id,
          requested_by_type: 'client',
          original_start_time: originalStartTime.toISOString(),
          original_end_time: originalEndTime.toISOString(),
          new_start_time: newStartTime.toISOString(),
          new_end_time: newEndTime.toISOString(),
          justification: justification || params.reason || null,
          status: 'pending',
        })
        .select()
        .single();

      if (rescheduleError) {
        const processed = handleError(rescheduleError, 'appointment');
        showError(processed.userMessage);
        return;
      }

      // Cancelar outros reagendamentos pendentes do mesmo agendamento criados pelo cliente
      // Isso garante que apenas o último reagendamento fique pendente
      await supabase
        .from('appointment_reschedules')
        .update({
          status: 'cancelled',
        })
        .eq('appointment_id', parseInt(params.appointmentId))
        .eq('status', 'pending')
        .eq('requested_by_type', 'client')
        .neq('id', rescheduleData.id);

      // Atualizar status do agendamento para indicar que há um reagendamento pendente
      // Mantém os horários originais até ser aceito
      // NOTA: A justificativa fica APENAS em appointment_reschedules.justification (já criada acima)
      const { error: updateError } = await supabase
        .from('appointments')
        .update({
          status: 'pending', // Status indica que precisa de confirmação
        })
        .eq('id', Number(params.appointmentId));

      if (updateError) {
        handleError(updateError, 'appointment');
        await supabase
          .from('appointment_reschedules')
          .delete()
          .eq('id', rescheduleData.id);
        Alert.alert('Erro', 'Não foi possível processar o reagendamento. Tente novamente.');
        return;
      }

      // Enviar notificação para o merchant
      try {
        // Buscar dados do merchant e cliente
        const { data: businessData } = await supabase
          .from('business_profiles')
          .select('owner_id')
          .eq('id', appointment.business?.id || appointment.business_id)
          .single();

        const { data: clientData } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();

        if (businessData?.owner_id && clientData?.full_name) {
          await notifyRescheduleRequested(
            businessData.owner_id,
            parseInt(params.appointmentId),
            rescheduleData.id,
            clientData.full_name,
            newStartTime.toISOString()
          );
        }
      } catch (notifError) {
        // Não bloquear o fluxo se a notificação falhar
        logger.warn('Erro ao enviar notificação de reagendamento:', notifError);
      }

      // Resetar campos após sucesso antes de mostrar o modal
      setJustification('');
      setSelectedDate(null);
      setSelectedTime(null);
      setShowRescheduleModal(false);
      setShowConfirmationModal(true);
    } catch (error) {
      const processed = handleError(error, 'appointment');
      showError(processed.userMessage);
    }
  };


  // Converter datas disponíveis em PillItem[]
  const datePillItems: PillItem[] = availableDates.map((date) => ({
    key: format(date, 'yyyy-MM-dd'),
    label: format(date, 'dd/MM'),
  }));
  
  const maxDates = Math.min(RESCHEDULE_DEFAULTS.MAX_DATES, datePillItems.length);
  const displayedDates = datePillItems.slice(0, datesToShow);
  const hasMoreDates = datesToShow < maxDates;
  const hasLessDates = datesToShow > RESCHEDULE_DEFAULTS.INITIAL_DATES_TO_SHOW;
  const selectedDateKey = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null;
  
  const handleShowMoreDates = () => {
    setDatesToShow((prev) => Math.min(prev + RESCHEDULE_DEFAULTS.INITIAL_DATES_TO_SHOW, maxDates));
  };
  
  const handleShowLessDates = () => {
    setDatesToShow((prev) => Math.max(prev - RESCHEDULE_DEFAULTS.INITIAL_DATES_TO_SHOW, RESCHEDULE_DEFAULTS.INITIAL_DATES_TO_SHOW));
  };
  
  // Converter todos os horários (disponíveis e não disponíveis) em PillItem[]
  // Mostrar todos os horários do expediente em grid, incluindo ocupados e horário de almoço
  const timePillItems: PillItem[] = timeSlots.map((slot) => ({
    key: slot.time,
    label: slot.time,
    disabled: !slot.available,
    showLunchIcon: slot.type === 'lunch',
  }));
  
  const displayedTimes = timePillItems.slice(0, timesToShow);
  const hasMoreTimes = timesToShow < timePillItems.length;
  const hasLessTimes = timesToShow > RESCHEDULE_DEFAULTS.INITIAL_TIMES_TO_SHOW;
  
  const handleShowMoreTimes = () => {
    setTimesToShow((prev) => Math.min(prev + RESCHEDULE_DEFAULTS.INITIAL_TIMES_TO_SHOW, timePillItems.length));
  };
  
  const handleShowLessTimes = () => {
    setTimesToShow((prev) => Math.max(prev - RESCHEDULE_DEFAULTS.INITIAL_TIMES_TO_SHOW, RESCHEDULE_DEFAULTS.INITIAL_TIMES_TO_SHOW));
  };

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
      topBar: {
        position: 'relative',
        zIndex: 10,
      },
      topBarDivider: {
        height: 14,
        backgroundColor: '#EBEFFF',
      },
      topBarContent: {
        height: 56,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        position: 'relative',
      },
      topBarGradientContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,
      },
      topBarGradientOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,
        backgroundColor: 'rgba(0, 14, 61, 0.2)',
      },
      backButton: {
        width: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
      },
      topBarSpacer: {
        flex: 1,
      },
      topBarTitle: {
        fontSize: 16,
        fontFamily: 'Montserrat_700Bold',
        color: '#FEFEFE',
        flex: 1,
        textAlign: 'center',
      },
      notificationButton: {
        width: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
      },
      scrollContent: {
        // flexGrow é aplicado automaticamente pelo ScreenContainer
        // paddingBottom é aplicado automaticamente quando há footer
      },
      content: {
        gap: 24,
      },
      mainTitle: {
        fontSize: 16,
        fontFamily: 'Montserrat_700Bold',
        color: '#000000',
        marginBottom: 4,
      },
      serviceName: {
        fontSize: 14,
        fontFamily: 'Montserrat_700Bold',
        color: '#474747',
        marginBottom: 0,
      },
      section: {
        gap: 16,
        backgroundColor: '#FAFAFA',
        paddingVertical: 8,
      },
      loader: {
        marginVertical: 16,
      },
      emptyMessage: {
        fontSize: 16,
        fontFamily: 'Montserrat_400Regular',
        color: '#474747',
        textAlign: 'center',
        paddingVertical: 16,
      },
      // Modal Styles
      modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
        zIndex: 1000,
      },
      modalContent: {
        backgroundColor: '#FEFEFE',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        paddingTop: 24,
        paddingBottom: 0,
        width: '100%',
        ...Platform.select({
          ios: {
            shadowColor: '#1D1D1D',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
          },
          android: {
            elevation: 4,
          },
        }),
      },
      modalScrollView: {
        flex: 1,
      },
      modalScrollContent: {
        gap: 24,
        paddingBottom: 24,
        paddingTop: 0,
        paddingHorizontal: 0,
        width: '100%',
      },
      // Confirmation Modal Styles
      confirmationOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: 0,
      },
      confirmationModalContainer: {
        backgroundColor: '#FEFEFE',
        borderRadius: 24,
        padding: 16,
        width: '100%',
        maxWidth: 400,
        alignItems: 'center',
        gap: 16,
        marginBottom: 0,
        ...Platform.select({
          ios: {
            shadowColor: '#1D1D1D',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.24,
            shadowRadius: 16,
          },
          android: {
            elevation: 8,
          },
        }),
      },
      confirmationIconContainer: {
        // width e height serão aplicados dinamicamente via style prop
        justifyContent: 'center',
        alignItems: 'center',
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
        color: '#000000',
        textAlign: 'center',
        width: '90%',
        maxWidth: 256,
        alignSelf: 'center',
      },
    });

  if (loading && !appointment) {
    return (
      <ScreenContainer style={{ backgroundColor: '#FAFAFA' }}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#000E3D" />
        </View>
      </ScreenContainer>
    );
  }

  if (!appointment) {
    return null;
  }

  return (
    <ScreenContainer 
      scroll={true}
      hasHeader={true}
      backgroundColor="#FAFAFA"
      header={
        <AppHeader
          title="Reagendamento"
          showBackButton={true}
          onPressBack={() => safeGoBack('/(client)/appointments')}
        />
      }
    >
        <View style={styles.content}>
          <Text style={styles.mainTitle}>Selecione o Melhor dia e horário</Text>
          {appointment?.service?.name && (
            <Text style={styles.serviceName}>{appointment.service.name}</Text>
          )}

          {/* Date Selection */}
          <View style={styles.section}>
            <ScheduleSectionHeader
              icon={<IconDateRange size={24} color="#E5102E" />}
              title="Escolha uma data"
            />

            <PillGrid
              items={displayedDates}
              selectedKey={selectedDateKey}
              onSelect={(key) => {
                const date = availableDates.find((d) => format(d, 'yyyy-MM-dd') === key);
                if (date) {
                  handleDateSelect(date);
                }
              }}
            />

            {availableDates.length > RESCHEDULE_DEFAULTS.INITIAL_DATES_TO_SHOW && (
              <>
                {hasMoreDates && (
                  <InlineLink
                    label="Ver mais datas"
                    onPress={handleShowMoreDates}
                  />
                )}
                {!hasMoreDates && hasLessDates && (
                  <InlineLink
                    label="Ver menos datas"
                    onPress={handleShowLessDates}
                  />
                )}
              </>
            )}
          </View>

          {/* Time Selection */}
          <View style={styles.section}>
            <ScheduleSectionHeader
              icon={<IconTimer size={24} color="#E5102E" />}
              title="Escolha um horário"
            />

            {!selectedDate ? (
              <Text style={styles.emptyMessage}>Selecione uma data primeiro</Text>
            ) : loadingTimes ? (
              <ActivityIndicator size="small" color="#000E3D" style={styles.loader} />
            ) : timeSlots.length === 0 ? (
              <Text style={styles.emptyMessage}>Nenhum horário disponível para esta data</Text>
            ) : (
              <>
                <PillGrid
                  items={displayedTimes}
                  selectedKey={selectedTime}
                  onSelect={(key) => handleTimeSelect(key)}
                />

                {timePillItems.length > RESCHEDULE_DEFAULTS.INITIAL_TIMES_TO_SHOW && (
                  <>
                    {hasMoreTimes && (
                      <InlineLink
                        label="Ver mais horários"
                        onPress={handleShowMoreTimes}
                      />
                    )}
                    {!hasMoreTimes && hasLessTimes && (
                      <InlineLink
                        label="Ver menos horários"
                        onPress={handleShowLessTimes}
                      />
                    )}
                  </>
                )}
              </>
            )}
          </View>

          {/* Suggest Button */}
          <PrimaryActionButton
            title="Sugerir novo horário"
            rightIcon={<Icon name="calendar_clock" family="MaterialSymbols" size={24} color="#FEFEFE" />}
            disabled={!selectedDate || !selectedTime}
            onPress={handleSuggestNewTime}
          />
        </View>

      {/* Reschedule Modal */}
      <Modal
        visible={showRescheduleModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRescheduleModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback onPress={() => setShowRescheduleModal(false)}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
          <TouchableWithoutFeedback>
            <View style={[
              styles.modalContent,
              {
                height: Dimensions.get('window').height * 0.82,
                maxHeight: Dimensions.get('window').height * 0.82,
              }
            ]}>
                <ScrollView
                  style={styles.modalScrollView}
                  contentContainerStyle={styles.modalScrollContent}
                  showsVerticalScrollIndicator={false}
                >
                  {appointment && selectedDate && selectedTime && (
                    <RescheduleModalCard
                      serviceName={appointment.service?.name || 'Serviço'}
                      price={appointment.service?.price || 0}
                      businessName={appointment.business?.business_name || 'Estabelecimento'}
                      businessAddress={appointment.business?.address}
                      businessLogoUrl={appointment.business?.logo_url}
                      paymentMethod={(appointment.payment_method as 'pix' | 'card' | 'cash') || 'pix'}
                      newDate={selectedDate}
                      newTime={selectedTime}
                      serviceDuration={parseServiceDuration(appointment.service?.duration_minutes || 60)}
                      justification={justification || params.reason || ''}
                      onSubmit={handleSubmitReschedule}
                    />
                  )}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
      </Modal>

      {/* Confirmation Modal */}
      <Modal
        visible={showConfirmationModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowConfirmationModal(false);
          // Resetar campos antes de navegar
          setJustification('');
          setSelectedDate(null);
          setSelectedTime(null);
          router.replace(`/(client)/appointments/${params.appointmentId}`);
        }}
      >
        <TouchableWithoutFeedback
          onPress={() => {
            setShowConfirmationModal(false);
            // Resetar campos antes de navegar
            setJustification('');
            setSelectedDate(null);
            setSelectedTime(null);
            router.replace(`/(client)/appointments/${params.appointmentId}`);
          }}
        >
          <View style={styles.confirmationOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.confirmationModalContainer}>
                {/* Success Icon */}
                <View style={[styles.confirmationIconContainer, { width: iconSize, height: iconSize }]}>
                  <IconCheckCircle size={iconSize} color="#17723F" />
                </View>

                {/* Success Text */}
                <Text style={styles.confirmationTitle}>Reagendamento solicitado</Text>

                {/* Message */}
                <Text style={styles.confirmationMessage}>
                  Aguarde o profissional aceitar a sua sugestão
                </Text>

                {/* Close Button */}
                <CustomButton
                  title="Fechar"
                  variant="outline"
                  onPress={() => {
                    setShowConfirmationModal(false);
                    // Resetar campos antes de navegar
                    setJustification('');
                    setSelectedDate(null);
                    setSelectedTime(null);
                    router.replace(`/(client)/appointments/${params.appointmentId}`);
                  }}
                  style={{ borderRadius: 24, width: '90%', maxWidth: 256, alignSelf: 'center', marginVertical: 0 }}
                />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </ScreenContainer>
  );
};

export default RescheduleAppointmentScreen;

