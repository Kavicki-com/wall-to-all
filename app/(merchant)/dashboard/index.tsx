import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import AppHeader from '../../../components/layout/AppHeader';
import ScreenContainer from '../../../components/layout/ScreenContainer';
import MonthCalendar from '../../../components/calendar/MonthCalendar';
import { format, parseISO, isToday, startOfMonth, endOfMonth, addMonths, subMonths, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import AppointmentDaySection from '../../../components/appointments/AppointmentDaySection';
import AppointmentCard from '../../../components/appointments/AppointmentCard';
import { applyAcceptedReschedules } from '../../../lib/utils';
import { logger } from '../../../lib/logger';
import { useToast } from '../../../components/ui/ToastProvider';
import { MerchantDashboardAppointment } from '../../../lib/types';
import { colors } from '../../../lib/theme';

type Appointment = MerchantDashboardAppointment;

const normalizeAppointment = (appointment: Appointment): Appointment => ({
  ...appointment,
  service: Array.isArray(appointment.service) ? appointment.service[0] : appointment.service,
  client: Array.isArray(appointment.client) ? appointment.client[0] : appointment.client,
});

const MerchantDashboardScreen: React.FC = () => {
  const router = useRouter();
  const { showError } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarResetKey, setCalendarResetKey] = useState(0);

  const loadBusinessAndAppointments = useCallback(async () => {
    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (__DEV__) {
          logger.debug('Usuário não autenticado');
        }
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
        // PGRST116 significa que não há perfil (0 linhas) - isso é esperado durante o cadastro inicial
        // Não logamos esse erro específico pois é tratado adequadamente
        if (businessError?.code === 'PGRST116') {
          Alert.alert(
            'Perfil não encontrado',
            'Você precisa criar um perfil de negócio primeiro.',
            [{ text: 'OK', onPress: () => router.push('/(merchant)/profile/edit') }]
          );
        } else if (businessError) {
          // Só loga erros que não são PGRST116
          logger.error('Erro ao buscar negócio:', businessError);
        }
        setLoading(false);
        return;
      }

      // Business ID is not used in this component

      // Buscar agendamentos do mês atual
      // IMPORTANTE: Buscar um range maior para incluir agendamentos que podem ter sido reagendados para este mês
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);
      const startDate = format(monthStart, 'yyyy-MM-dd');
      const endDate = format(monthEnd, 'yyyy-MM-dd');

      // Buscar agendamentos que podem estar no mês (considerando data original ou reagendamento)
      // Buscar um range maior (2 meses antes e depois) para capturar reagendamentos
      const extendedStart = new Date(monthStart);
      extendedStart.setMonth(extendedStart.getMonth() - 2);
      const extendedEnd = new Date(monthEnd);
      extendedEnd.setMonth(extendedEnd.getMonth() + 2);
      const extendedStartDate = format(extendedStart, 'yyyy-MM-dd');
      const extendedEndDate = format(extendedEnd, 'yyyy-MM-dd');

      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from('appointments')
        .select(
          `
          id, start_time, end_time, status, payment_method, client_notes,
          service:services(id, name, price, price_type, duration_minutes, photos),
          client:profiles!appointments_client_id_fkey(id, full_name, avatar_url)
        `,
        )
        .eq('business_id', businessData.id)
        .gte('start_time', `${extendedStartDate}T00:00:00`)
        .lte('start_time', `${extendedEndDate}T23:59:59`)
        .order('start_time', { ascending: true })
        .limit(200); // Aumentar limite para incluir mais agendamentos

      if (appointmentsError) {
        logger.error('Erro ao buscar agendamentos:', appointmentsError);
      } else if (appointmentsData) {
        // Aplicar reagendamentos aceitos aos agendamentos PRIMEIRO
        const appointmentsWithReschedules = await applyAcceptedReschedules(appointmentsData);

        // Filtrar por data DEPOIS de aplicar reagendamentos
        // Mostrar apenas agendamentos futuros ou do mês selecionado
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const filteredAppointments = appointmentsWithReschedules.filter((apt) => {
          const aptDate = new Date(apt.start_time);
          aptDate.setHours(0, 0, 0, 0);
          const aptDateString = format(aptDate, 'yyyy-MM-dd');

          // Incluir se estiver no mês selecionado OU se for um agendamento futuro
          const isInSelectedMonth = aptDateString >= startDate && aptDateString <= endDate;
          const isFuture = aptDate >= today;

          // Filtro solicitado: Apenas últimos 7 dias
          const sevenDaysAgo = subDays(today, 7);
          const sevenDaysAgoString = format(sevenDaysAgo, 'yyyy-MM-dd');

          // Regra principal: Não mostrar nada anterior a 7 dias atrás
          if (aptDateString < sevenDaysAgoString) {
            return false;
          }

          return isInSelectedMonth || (isFuture && aptDateString < startDate);
        });

        const normalized = filteredAppointments.map((apt) =>
          normalizeAppointment(apt as any as Appointment),
        );
        setAppointments(normalized);
      }
    } catch (error) {
      logger.error('Erro ao carregar dados:', error);
      showError('Não foi possível carregar os dados. Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentMonth, router]);

  // Resetar estado do calendário e recarregar agendamentos quando a tela receber foco
  // Usamos dependências vazias para evitar loop de re-render (setState altera currentMonth -> altera callback)
  useFocusEffect(
    React.useCallback(() => {
      setCurrentMonth(new Date());
      setSelectedDate(new Date());
      setCalendarResetKey((prev) => prev + 1);
      // Recarregar agendamentos quando a tela receber foco (ex: após reagendamento)
      loadBusinessAndAppointments();
    }, []) // eslint-disable-line react-hooks/exhaustive-deps
    // loadBusinessAndAppointments é estável o suficiente; evitar depender de currentMonth
  );

  useEffect(() => {
    loadBusinessAndAppointments();
  }, [loadBusinessAndAppointments]);

  // Realtime subscription para atualizar automaticamente quando agendamentos são modificados
  useEffect(() => {
    let businessId: number | null = null;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setupSubscription = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) return;

        // Buscar business_profile do lojista
        const { data: businessData } = await supabase
          .from('business_profiles')
          .select('id')
          .eq('owner_id', user.id)
          .single();

        if (!businessData) return;

        businessId = businessData.id;

        // Criar channel para escutar mudanças em appointments
        channel = supabase
          .channel(`merchant-appointments-${businessId}`)
          .on(
            'postgres_changes',
            {
              event: '*', // INSERT, UPDATE, DELETE
              schema: 'public',
              table: 'appointments',
              filter: `business_id=eq.${businessId}`,
            },
            (payload) => {
              logger.debug('Appointment change detected:', payload.eventType);
              // Recarregar agendamentos quando houver mudança
              loadBusinessAndAppointments();
            }
          )
          .subscribe();
      } catch (error) {
        logger.error('Erro ao configurar realtime subscription:', error);
      }
    };

    setupSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [loadBusinessAndAppointments]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadBusinessAndAppointments();
    } catch (error) {
      // Erro já é tratado dentro de loadBusinessAndAppointments
      // Aqui apenas garantimos que o estado seja resetado
      logger.error('Erro ao atualizar dados:', error);
    } finally {
      // O loadBusinessAndAppointments já reseta o refreshing no finally,
      // mas garantimos aqui também por segurança
      setRefreshing(false);
    }
  };

  // Memoizar markedDates para evitar recálculo a cada renderização
  const markedDates = useMemo(() => {
    return appointments.map((apt) => format(new Date(apt.start_time), 'yyyy-MM-dd'));
  }, [appointments]);

  const formatDateHeader = useCallback((date: Date): string => {
    const day = format(date, 'd', { locale: ptBR });
    const month = format(date, 'MMM', { locale: ptBR });
    return `${day} de ${month}.`;
  }, []);

  // Memoizar agrupamento de appointments para evitar recálculo a cada renderização
  const groupedAppointments = useMemo(() => {
    const grouped: { [key: string]: Appointment[] } = {};
    appointments.forEach((apt) => {
      const aptDate = new Date(apt.start_time);
      const dateKey = aptDate.toISOString().split('T')[0];
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(apt);
    });
    return grouped;
  }, [appointments]);

  // Memoizar sortedDates para evitar recálculo
  const sortedDates = useMemo(() => {
    return Object.keys(groupedAppointments).sort();
  }, [groupedAppointments]);

  if (loading) {
    return (
      <ScreenContainer scroll={false} backgroundColor={colors.background}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
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
      header={<AppHeader showBackButton={false} />}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Título */}
      <Text style={styles.sectionTitle}>Próximos agendamentos</Text>

      {/* Calendário */}
      <MonthCalendar
        key={calendarResetKey}
        currentMonth={currentMonth}
        onMonthChange={(direction) => setCurrentMonth((prev) => (direction === 'next' ? addMonths(prev, 1) : subMonths(prev, 1)))}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        markedDates={markedDates}
      />

      {/* Lista de Agendamentos Agrupados por Data */}
      {sortedDates.map((dateKey) => {
        const dateAppointments = groupedAppointments[dateKey];
        const date = parseISO(dateKey);
        const isTodayDate = isToday(date);
        const hasReschedulePending = dateAppointments.some(
          (apt) => apt.status?.toLowerCase() === 'rescheduled'
        );

        return (
          <AppointmentDaySection
            key={dateKey}
            dateLabel={formatDateHeader(date)}
            isToday={isTodayDate}
            statusLabel={hasReschedulePending ? 'Reagendado - Pendente' : undefined}
            hasAppointments={dateAppointments.length > 0}
            containerStyle={styles.dateGroup}
          >
            {dateAppointments.map((appointment) => {
              const appointmentDate = new Date(appointment.start_time);
              const time = format(appointmentDate, 'HH:mm');
              const dateLabel = `Data ${format(appointmentDate, 'dd/MM/yy')}`;
              const serviceData = Array.isArray(appointment.service)
                ? appointment.service[0]
                : appointment.service;

              return (
                <AppointmentCard
                  key={appointment.id}
                  time={time}
                  dateLabel={dateLabel}
                  serviceName={serviceData?.name || 'Serviço'}
                  showShopName={false}
                  onPress={() => router.push(`/(merchant)/dashboard/appointment/${appointment.id}`)}
                />
              );
            })}
          </AppointmentDaySection>
        );
      })}

      {/* Mensagem quando não há agendamentos */}
      {sortedDates.length === 0 && (
        <AppointmentDaySection
          dateLabel={formatDateHeader(selectedDate)}
          isToday={isToday(selectedDate)}
          hasAppointments={false}
          containerStyle={styles.dateGroup}
        >
          {null}
        </AppointmentDaySection>
      )}
    </ScreenContainer>
  );
};

export default MerchantDashboardScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 16,
    paddingBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: colors.accent,
    marginBottom: 24,
  },
  dateGroup: {
    marginBottom: 16,
  },
});
