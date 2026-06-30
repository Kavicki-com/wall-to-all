import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { supabase } from '../../../../lib/supabase';
import AppHeader from '../../../../components/layout/AppHeader';
import ScreenContainer from '../../../../components/layout/ScreenContainer';
import { IconDateRange, IconTimer } from '../../../../lib/icons';
import { Icon } from '../../../../components/ui/Icon';
import { ScheduleSectionHeader } from '../../../../components/appointments/ScheduleSectionHeader';
import { PrimaryActionButton } from '../../../../components/appointments/PrimaryActionButton';
import { PillGrid, PillItem } from '../../../../components/appointments/PillGrid';
import { InlineLink } from '../../../../components/appointments/InlineLink';
import { format } from 'date-fns';
import { useSafeGoBack } from '../../../../lib/router-utils';
import { applyAcceptedReschedules } from '../../../../lib/utils';
import { logger } from '../../../../lib/logger';
import { parseWorkDays } from '../../../../lib/typeGuards';
import { useToast } from '../../../../components/ui/ToastProvider';
import RescheduleConfirmModal from './reschedule-confirm';
import { MerchantRescheduleAppointment } from '../../../../lib/types';
import { colors } from '../../../../lib/theme';

type Appointment = MerchantRescheduleAppointment;

type TimeSlot = {
  time: string;
  available: boolean;
  type: 'available' | 'occupied' | 'lunch';
};

const MerchantRescheduleScreen: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ appointmentId: string; justification?: string }>();
  // Inicializar justificativa com o valor dos parâmetros (vem da tela confirm.tsx)
  const [justification, setJustification] = useState(params.justification || '');
  const safeGoBack = useSafeGoBack('/(merchant)/dashboard');
  const { showError } = useToast();
  const [loading, setLoading] = useState(true);
  const [loadingTimes, setLoadingTimes] = useState(false);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [availableDates, setAvailableDates] = useState<Date[]>([]);
  const [markedDates, setMarkedDates] = useState<string[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [datesToShow, setDatesToShow] = useState(6); // Mostrar 6 datas inicialmente
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    loadAppointmentData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // loadAppointmentData é estável (useCallback), não precisa estar nas dependências
  }, []);

  // Atualizar justificativa quando os parâmetros mudarem (quando vier de confirm.tsx)
  useEffect(() => {
    if (params.justification) {
      setJustification(params.justification);
    }
  }, [params.justification]);

  // Resetar seleções quando a tela recebe foco (mas manter a justificativa se vier dos parâmetros)
  useFocusEffect(
    useCallback(() => {
      setSelectedDate(null);
      setSelectedTime(null);
      setDatesToShow(6);
      // Não limpar a justificativa aqui, ela deve ser mantida se vier dos parâmetros
    }, []),
  );

  useEffect(() => {
    if (selectedDate && appointment) {
      loadAvailableTimes();
    } else {
      setTimeSlots([]);
      setSelectedTime(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // loadAvailableTimes é estável (useCallback), não precisa estar nas dependências
  }, [selectedDate, appointment]);

  const loadAppointmentData = async () => {
    try {
      setLoading(true);

      if (!params.appointmentId) {
        logger.error('ID do agendamento não fornecido');
        router.replace('/(merchant)/dashboard');
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace('/(auth)/login');
        return;
      }

      const { data: businessData, error: businessError } = await supabase
        .from('business_profiles')
        .select('id')
        .eq('owner_id', user.id)
        .single();

      if (businessError || !businessData) {
        // PGRST116 significa que não há perfil (0 linhas) - isso é esperado em alguns casos
        // Não logamos esse erro específico pois é tratado adequadamente
        if (businessError && businessError.code !== 'PGRST116') {
          logger.error('Erro ao buscar negócio:', businessError);
        }
        router.replace('/(merchant)/dashboard');
        return;
      }

      const { data: appointmentData, error } = await supabase
        .from('appointments')
        .select(
          `
          *,
          business:business_profiles!appointments_business_id_fkey(id, business_name, work_days),
          service:services!appointments_service_id_fkey(id, name, duration_minutes)
        `,
        )
        .eq('id', Number(params.appointmentId))
        .eq('business_id', businessData.id)
        .single();

      if (error || !appointmentData) {
        logger.error('Erro ao buscar agendamento:', error);
        showError('Erro ao carregar dados do agendamento. Redirecionando...');
        router.replace('/(merchant)/dashboard');
        return;
      }

      // Validar estrutura básica do appointmentData
      if (!appointmentData.business || !appointmentData.service) {
        logger.error('Dados do agendamento inválidos: business ou service ausente');
        showError('Dados do agendamento inválidos. Redirecionando...');
        router.replace('/(merchant)/dashboard');
        return;
      }

      // Validar work_days do business se existir
      let safeWorkDays: any = null;
      if (appointmentData.business.work_days) {
        safeWorkDays = parseWorkDays(appointmentData.business.work_days);
        if (!safeWorkDays) {
          logger.warn('[Reschedule] work_days do appointment inválido, mas continuando...');
          // Não bloqueia, pois vamos tentar buscar do business_profile depois
        }
      }

      // Validar service
      if (!appointmentData.service.id || !appointmentData.service.name) {
        logger.error('Dados do serviço inválidos');
        showError('Dados do serviço inválidos. Redirecionando...');
        router.replace('/(merchant)/dashboard');
        return;
      }

      // Criar objeto Appointment tipado corretamente
      const validatedAppointment: Appointment = {
        id: String(appointmentData.id),
        business_id: String(appointmentData.business_id),
        service_id: String(appointmentData.service_id),
        start_time: appointmentData.start_time,
        end_time: appointmentData.end_time,
        business: {
          id: String(appointmentData.business.id),
          business_name: appointmentData.business.business_name,
          work_days: safeWorkDays || ({} as any),
        },
        service: {
          id: String(appointmentData.service.id),
          name: appointmentData.service.name,
          duration_minutes: appointmentData.service.duration_minutes || 60,
        },
      };

      setAppointment(validatedAppointment);
      await generateAvailableDates(validatedAppointment);
    } catch (error) {
      logger.error('Erro ao carregar dados:', error);
      showError('Erro ao carregar dados do agendamento. Redirecionando...');
      router.replace('/(merchant)/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const generateAvailableDates = async (apt: Appointment) => {
    try {
      // Buscar work_days do business_profile
      const { data: businessProfile, error: businessError } = await supabase
        .from('business_profiles')
        .select('work_days')
        .eq('id', Number(apt.business_id))
        .single();

      let workDaysSource: unknown = null;

      if (businessError || !businessProfile) {
        logger.error('[Reschedule] Erro ao buscar work_days:', businessError);
        // Se não conseguir buscar, usar work_days do appointment
        workDaysSource = apt.business.work_days;
      } else {
        workDaysSource = businessProfile.work_days;
      }

      // Se ainda não tiver work_days, usar do appointment
      if (!workDaysSource) {
        workDaysSource = apt.business.work_days;
      }

      // Validar workDays usando parseWorkDays (já trata strings JSON automaticamente)
      const safeWorkDays = parseWorkDays(workDaysSource);

      if (!safeWorkDays) {
        logger.error('[Reschedule] Erro ao processar horários de funcionamento: dados inválidos');
        showError('Erro ao processar horários de funcionamento. Tente novamente.');
        return;
      }

      generateDatesFromWorkDays(safeWorkDays);
    } catch (error) {
      logger.error('[Reschedule] Erro ao gerar datas disponíveis:', error);
      showError('Erro ao gerar datas disponíveis. Tente novamente.');
    }
  };

  const generateDatesFromWorkDays = (workDays: Record<string, { start: string; end: string; active?: boolean }>) => {
    const dates: Date[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dayNames = [
      'sunday',
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
    ];

    for (let i = 1; i <= 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);

      const dayName = dayNames[date.getDay()];
      const workDay = workDays[dayName];

      // Incluir apenas se o dia estiver ativo ou se tiver start e end definidos
      if (workDay && (workDay.active !== false) && workDay.start && workDay.end) {
        dates.push(date);
      }
    }

    setAvailableDates(dates);
    // Criar array de datas marcadas no formato 'yyyy-MM-dd'
    const markedDatesArray = dates.map((date) => format(date, 'yyyy-MM-dd'));
    setMarkedDates(markedDatesArray);
  };

  const loadAvailableTimes = async () => {
    if (!selectedDate || !appointment) {
      logger.debug('[Reschedule] loadAvailableTimes: selectedDate ou appointment não disponível');
      return;
    }

    try {
      logger.debug('[Reschedule] loadAvailableTimes iniciado para data:', selectedDate);
      setLoadingTimes(true);
      const dateString = selectedDate.toISOString().split('T')[0];

      // Buscar work_days e lunch_break do business_profile
      const { data: businessProfile, error: businessError } = await supabase
        .from('business_profiles')
        .select('work_days, lunch_break_start, lunch_break_end')
        .eq('id', Number(appointment.business_id))
        .single();

      if (businessError || !businessProfile) {
        logger.error('[Reschedule] Erro ao buscar horários de funcionamento:', businessError);
        setTimeSlots([]);
        setLoadingTimes(false);
        return;
      }

      logger.debug('[Reschedule] businessProfile retornado:', JSON.stringify(businessProfile, null, 2));

      // Tentar usar work_days do business_profile primeiro, depois do appointment
      let workDaysSource: unknown = businessProfile.work_days;

      // Se não tiver work_days no business_profile, tentar usar do appointment
      if (!workDaysSource) {
        workDaysSource = appointment.business.work_days;
      }

      // Validar workDays usando parseWorkDays (já trata strings JSON automaticamente)
      const safeWorkDays = parseWorkDays(workDaysSource);

      if (!safeWorkDays) {
        logger.error('[Reschedule] Erro ao processar horários de funcionamento: dados inválidos');
        showError('Erro ao processar horários de funcionamento. Tente novamente.');
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
      const workDay = safeWorkDays[dayName];

      logger.debug('[Reschedule] Dia selecionado:', dayName, 'para data:', dateString);
      logger.debug('[Reschedule] workDay encontrado:', workDay);
      logger.debug('[Reschedule] workDays completo:', JSON.stringify(safeWorkDays, null, 2));

      if (!workDay) {
        logger.debug('[Reschedule] Dia não está disponível no work_days');
        setTimeSlots([]);
        setLoadingTimes(false);
        return;
      }

      // Verificar se workDay tem start e end válidos
      // workDay pode ser um objeto com { start, end } ou { active, start, end }
      const startTime = workDay.start;
      const endTime = workDay.end;

      if (!startTime || !endTime || typeof startTime !== 'string' || typeof endTime !== 'string') {
        logger.debug('[Reschedule] workDay não tem start ou end válidos:', workDay);
        logger.debug('[Reschedule] Tipo de start:', typeof startTime, 'Valor:', startTime);
        logger.debug('[Reschedule] Tipo de end:', typeof endTime, 'Valor:', endTime);
        setTimeSlots([]);
        setLoadingTimes(false);
        return;
      }

      logger.debug('[Reschedule] Horário de funcionamento encontrado:', startTime, '-', endTime);

      // Buscar appointments existentes usando start_time e end_time
      // Usar um intervalo mais amplo para cobrir possíveis diferenças de fuso horário
      const prevDay = new Date(selectedDate);
      prevDay.setDate(prevDay.getDate() - 1);
      const nextDay = new Date(selectedDate);
      nextDay.setDate(nextDay.getDate() + 1);

      const startDateStr = prevDay.toISOString().split('T')[0];
      const endDateStr = nextDay.toISOString().split('T')[0];

      const { data: existingAppointments } = await supabase
        .from('appointments')
        .select('id, start_time, end_time')
        .eq('business_id', Number(appointment.business_id))
        .gte('start_time', `${startDateStr}T00:00:00`)
        .lt('start_time', `${endDateStr}T23:59:59`)
        .in('status', ['pending', 'confirmed'])
        .neq('id', Number(params.appointmentId))
        .limit(100);

      logger.debug('[Reschedule] Appointments existentes encontrados:', existingAppointments?.length || 0);
      if (existingAppointments && existingAppointments.length > 0) {
        logger.debug('[Reschedule] Detalhes dos appointments:', JSON.stringify(existingAppointments, null, 2));
        existingAppointments.forEach((apt, index) => {
          const aptStart = new Date(apt.start_time);
          const aptEnd = new Date(apt.end_time);
          logger.debug(`[Reschedule] Appointment ${index + 1}:`, {
            start: aptStart.toISOString(),
            end: aptEnd.toISOString(),
            startHour: aptStart.getHours(),
            endHour: aptEnd.getHours(),
            duration: (aptEnd.getTime() - aptStart.getTime()) / (1000 * 60), // em minutos
          });
        });
      } else {
        logger.debug('[Reschedule] NENHUM appointment existente encontrado para esta data!');
      }

      // Aplicar reagendamentos aceitos aos appointments existentes
      const appointmentsWithReschedules = existingAppointments
        ? await applyAcceptedReschedules(existingAppointments)
        : [];

      // duration_minutes deve estar em minutos
      let serviceDuration = appointment.service.duration_minutes || 60;

      // Se o valor for muito grande (provavelmente está em milissegundos), converter
      // Valores normais de duração em minutos: 15, 30, 60, 90, 120, etc.
      // Se for maior que 480 (8 horas), provavelmente está em milissegundos ou em formato incorreto
      // Serviços normais não duram mais que 8 horas
      if (serviceDuration > 480) {
        logger.warn('[Reschedule] serviceDuration parece estar em formato incorreto:', serviceDuration);
        // Tentar converter de milissegundos
        const convertedFromMs = Math.round(serviceDuration / 1000 / 60);
        // Se a conversão resultar em um valor razoável (menos de 8 horas), usar
        if (convertedFromMs > 0 && convertedFromMs <= 480) {
          serviceDuration = convertedFromMs;
          logger.debug('[Reschedule] serviceDuration convertido de ms para minutos:', serviceDuration);
        } else {
          // Se ainda for muito grande, pode estar em segundos
          const convertedFromSeconds = Math.round(serviceDuration / 60);
          if (convertedFromSeconds > 0 && convertedFromSeconds <= 480) {
            serviceDuration = convertedFromSeconds;
            logger.debug('[Reschedule] serviceDuration convertido de segundos para minutos:', serviceDuration);
          } else {
            // Se nada funcionar, usar um valor padrão razoável (60 minutos)
            logger.warn('[Reschedule] serviceDuration inválido, usando padrão de 60 minutos');
            serviceDuration = 60;
          }
        }
      }

      logger.debug('[Reschedule] serviceDuration final (minutos):', serviceDuration);

      // Obter horário de almoço se existir
      const lunchBreakStart = businessProfile.lunch_break_start;
      const lunchBreakEnd = businessProfile.lunch_break_end;

      logger.debug('[Reschedule] Horário de almoço:', lunchBreakStart, '-', lunchBreakEnd);

      const slots = generateTimeSlots(
        startTime,
        endTime,
        appointmentsWithReschedules || [],
        serviceDuration,
        dateString,
        lunchBreakStart,
        lunchBreakEnd,
      );

      logger.debug('[Reschedule] Slots retornados de generateTimeSlots:', slots.length);
      logger.debug('[Reschedule] Primeiros 3 slots:', slots.slice(0, 3));
      setTimeSlots(slots);
      logger.debug('[Reschedule] loadAvailableTimes concluído. Slots definidos:', slots.length);
    } catch (error) {
      logger.error('[Reschedule] Erro ao carregar horários:', error);
      setTimeSlots([]);
    } finally {
      setLoadingTimes(false);
      logger.debug('[Reschedule] loadAvailableTimes finalizado. loadingTimes = false');
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
    logger.debug('[Reschedule] generateTimeSlots chamado com:', { startTime, endTime, serviceDuration, dateString });
    logger.debug('[Reschedule] existingAppointments:', existingAppointments?.length || 0);

    const slots: TimeSlot[] = [];
    const [startHour] = startTime.split(':').map(Number);
    const [endHour] = endTime.split(':').map(Number);

    logger.debug('[Reschedule] Horas extraídas - startHour:', startHour, 'endHour:', endHour);

    if (isNaN(startHour) || isNaN(endHour)) {
      logger.error('[Reschedule] Erro ao parsear horários:', { startTime, endTime });
      return [];
    }

    // OTIMIZAÇÃO: Criar mapa de horários ocupados antes do loop
    // Isso reduz complexidade de O(n×m) para O(n+m)
    // Onde n = número de slots e m = número de appointments
    const occupiedHours = new Set<number>();
    const serviceDurationHours = Math.ceil(serviceDuration / 60);

    // Processar todos os appointments uma única vez
    existingAppointments.forEach((apt) => {
      const aptStart = new Date(apt.start_time);
      const aptEnd = new Date(apt.end_time);
      const aptDateString = aptStart.toISOString().split('T')[0];

      // Apenas processar appointments do mesmo dia
      if (aptDateString !== dateString) {
        return;
      }

      const aptStartHour = aptStart.getHours();
      const aptEndHour = aptEnd.getHours();

      // Marcar todas as horas que, se um serviço começar nelas, se sobreporiam com este appointment
      // Se um appointment está de 9:00 a 11:00 e o serviço dura 2h,
      // então qualquer slot de 7:00 até 10:59 se sobreporia
      // (serviço de 7:00-9:00, 8:00-10:00, 9:00-11:00, 10:00-12:00)
      const minSlotHour = Math.max(startHour, aptStartHour - serviceDurationHours + 1);
      const maxSlotHour = Math.min(endHour, aptEndHour);

      for (let hour = minSlotHour; hour < maxSlotHour; hour++) {
        // Verificar se um serviço começando nesta hora se sobreporia com o appointment
        const serviceStart = new Date(`${dateString}T${String(hour).padStart(2, '0')}:00:00`);
        const serviceEnd = new Date(serviceStart);
        serviceEnd.setMinutes(serviceEnd.getMinutes() + serviceDuration);

        if (serviceStart.getTime() < aptEnd.getTime() && serviceEnd.getTime() > aptStart.getTime()) {
          occupiedHours.add(hour);
        }
      }
    });

    let currentHour = startHour;

    // Gerar slots apenas dentro do horário de funcionamento
    while (currentHour < endHour) {
      const timeString = `${String(currentHour).padStart(2, '0')}:00`;
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
      const slotEndHourCalculated = currentHour + serviceDurationHours;

      if (slotEndHourCalculated > endHour) {
        type = 'occupied';
        slots.push({ time: timeString, available: false, type });
        currentHour += 1;
        continue;
      }

      // OTIMIZAÇÃO: Verificar ocupação usando o Set (O(1) lookup)
      if (occupiedHours.has(currentHour)) {
        type = 'occupied';
      }

      slots.push({ time: timeString, available: type === 'available', type });

      currentHour += 1;
    }

    logger.debug('[Reschedule] Total de slots gerados:', slots.length);
    logger.debug('[Reschedule] Slots disponíveis:', slots.filter(s => s.available).length);

    return slots;
  };

  const handleDateSelect = (date: Date) => {
    // Verificar se a data está disponível (existe em availableDates)
    const dateString = format(date, 'yyyy-MM-dd');
    const isAvailable = markedDates.includes(dateString);

    logger.debug('[Reschedule] handleDateSelect chamado. Data:', dateString, 'Disponível:', isAvailable);

    if (isAvailable) {
      logger.debug('[Reschedule] Definindo selectedDate:', dateString);
      setSelectedDate(date);
      setSelectedTime(null);
    } else {
      logger.debug('[Reschedule] Data não está disponível:', dateString);
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
    setShowConfirmModal(true);
  };

  const handleModalClose = () => {
    setShowConfirmModal(false);
  };

  const handleModalSuccess = () => {
    setShowConfirmModal(false);
    // Opcional: navegar de volta ou atualizar a tela
    router.back();
  };

  const availableTimeSlots = timeSlots.filter((slot) => slot.available && slot.type === 'available');

  logger.debug('[Reschedule] === ESTADO ATUAL ===');
  logger.debug('[Reschedule] timeSlots total:', timeSlots.length);
  logger.debug('[Reschedule] timeSlots detalhes:', timeSlots.map(s => ({ time: s.time, available: s.available, type: s.type })));
  logger.debug('[Reschedule] availableTimeSlots filtrados:', availableTimeSlots.length);
  logger.debug('[Reschedule] availableTimeSlots detalhes:', availableTimeSlots.map(s => ({ time: s.time, available: s.available, type: s.type })));
  logger.debug('[Reschedule] selectedDate:', selectedDate);
  logger.debug('[Reschedule] loadingTimes:', loadingTimes);
  logger.debug('[Reschedule] ====================');

  // Converter datas disponíveis em PillItem[]
  const datePillItems: PillItem[] = availableDates.map((date) => ({
    key: format(date, 'yyyy-MM-dd'),
    label: format(date, 'dd/MM'),
  }));

  // Limitar a 30 datas máximo
  const maxDates = Math.min(30, datePillItems.length);
  const displayedDates = datePillItems.slice(0, datesToShow);
  const hasMoreDates = datesToShow < maxDates;
  const hasLessDates = datesToShow > 6;
  const selectedDateKey = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null;

  const handleShowMoreDates = () => {
    // Adicionar mais 6 datas (grid 2x2x2)
    setDatesToShow((prev) => Math.min(prev + 6, maxDates));
  };

  const handleShowLessDates = () => {
    // Reduzir 6 datas (grid 2x2x2)
    setDatesToShow((prev) => Math.max(prev - 6, 6));
  };

  // Converter todos os horários (disponíveis e não disponíveis) em PillItem[]
  // Mostrar todos os horários do expediente em grid, incluindo ocupados e horário de almoço
  const timePillItems: PillItem[] = timeSlots.map((slot) => ({
    key: slot.time,
    label: slot.time,
    disabled: !slot.available,
    showLunchIcon: slot.type === 'lunch',
  }));

  // Mostrar todos os horários (sem limitação)
  const displayedTimes = timePillItems;

  if (loading && !appointment) {
    return (
      <ScreenContainer scroll={false} backgroundColor={colors.background} hasTabBar={false}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.brand} />
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
      hasTabBar={false}
      safeAreaEdges={['left', 'right']}
      backgroundColor={colors.background}
      contentContainerStyle={styles.scrollContent}
      header={
        <AppHeader
          title="Reagendamento"
          showBackButton={true}
          onPressBack={safeGoBack}
        />
      }
    >
      <View style={styles.wrapper}>
        <View style={styles.content}>
          <Text style={styles.mainTitle}>Selecione o Melhor dia e horario</Text>

          {/* Date Selection */}
          <View style={styles.section}>
            <ScheduleSectionHeader
              icon={<IconDateRange size={24} color={colors.accent} />}
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

            {availableDates.length > 6 && (
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
              icon={<IconTimer size={24} color={colors.accent} />}
              title="Escolha um horário"
            />

            {!selectedDate ? (
              <Text style={styles.emptyMessage}>Selecione uma data primeiro</Text>
            ) : loadingTimes ? (
              <ActivityIndicator size="small" color={colors.brand} style={styles.loader} />
            ) : timeSlots.length === 0 ? (
              <Text style={styles.emptyMessage}>Nenhum horário disponível para esta data</Text>
            ) : (
              <PillGrid
                items={displayedTimes}
                selectedKey={selectedTime}
                onSelect={(key) => handleTimeSelect(key)}
              />
            )}
          </View>
        </View>

        {/* Suggest Button */}
        <View style={styles.buttonContainer}>
          <PrimaryActionButton
            title="Sugerir novo horário"
            rightIcon={<Icon name="calendar_clock" family="MaterialSymbols" size={24} color={colors.surface} />}
            disabled={!selectedDate || !selectedTime}
            onPress={handleSuggestNewTime}
          />
        </View>
      </View>

      {/* Reschedule Confirm Modal */}
      {selectedDate && selectedTime && (
        <>
          <RescheduleConfirmModal
            visible={showConfirmModal}
            onClose={handleModalClose}
            appointmentId={params.appointmentId}
            date={selectedDate.toISOString().split('T')[0]}
            time={selectedTime}
            justification={justification || ''}
            onSuccess={handleModalSuccess}
          />
        </>
      )}
    </ScreenContainer>
  );
};

export default MerchantRescheduleScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  wrapper: {
    flex: 1,
    justifyContent: 'space-between',
  },
  content: {
    padding: 24,
    paddingTop: 24,
    gap: 24,
  },
  mainTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: colors.textPrimary,
    width: '100%',
  },
  section: {
    gap: 16,
    backgroundColor: colors.background,
    paddingVertical: 8,
  },
  loader: {
    marginVertical: 16,
  },
  emptyMessage: {
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 16,
  },
  buttonContainer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
});

