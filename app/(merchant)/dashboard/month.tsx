import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { IconBack } from '../../../lib/icons';
import { format, isSameDay, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { applyAcceptedReschedules } from '../../../lib/utils';
import AppHeader from '../../../components/layout/AppHeader';
import ScreenContainer from '../../../components/layout/ScreenContainer';
import { safeGoBack } from '../../../lib/router-utils';
import MonthCalendar from '../../../components/calendar/MonthCalendar';
import AppointmentDaySection from '../../../components/appointments/AppointmentDaySection';
import AppointmentCard from '../../../components/appointments/AppointmentCard';
import { logger } from '../../../lib/logger';
import { MerchantMonthAppointment } from '../../../lib/types';
import { colors } from '../../../lib/theme';

type Appointment = MerchantMonthAppointment;

type DayAppointments = {
  date: Date;
  appointments: Appointment[];
};

const MerchantMonthDashboardScreen: React.FC = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [calendarResetKey, setCalendarResetKey] = useState(0);

  // Resetar estado do calendário quando a tela receber foco
  useFocusEffect(
    React.useCallback(() => {
      setCurrentMonth(new Date());
      setSelectedDate(null);
      setCalendarResetKey((prev) => prev + 1);
    }, [])
  );

  useEffect(() => {
    loadBusinessAndAppointments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // loadBusinessAndAppointments é estável (useCallback), não precisa estar nas dependências
  }, [currentMonth]);

  const loadBusinessAndAppointments = async () => {
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

      // Buscar business_profile do lojista
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
        setLoading(false);
        return;
      }


      // Buscar agendamentos do mês
      // IMPORTANTE: Buscar um range maior para incluir agendamentos que podem ter sido reagendados para este mês
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);
      const startDate = format(monthStart, 'yyyy-MM-dd');
      const endDate = format(monthEnd, 'yyyy-MM-dd');

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
          *,
          service:services(id, name),
          client:profiles!appointments_client_id_fkey(id, full_name)
        `,
        )
        .eq('business_id', businessData.id)
        .gte('start_time', `${extendedStartDate}T00:00:00`)
        .lte('start_time', `${extendedEndDate}T23:59:59`)
        .order('start_time', { ascending: true });

      if (appointmentsError) {
        logger.error('Erro ao buscar agendamentos:', appointmentsError);
      } else if (appointmentsData) {
        // Aplicar reagendamentos aceitos aos agendamentos PRIMEIRO
        const appointmentsWithReschedules = await applyAcceptedReschedules(appointmentsData);

        // Filtrar por data DEPOIS de aplicar reagendamentos
        const filteredAppointments = appointmentsWithReschedules.filter((apt) => {
          const aptDate = new Date(apt.start_time);
          const aptDateString = format(aptDate, 'yyyy-MM-dd');
          return aptDateString >= startDate && aptDateString <= endDate;
        });

        // Converter id de number para string para corresponder ao tipo Appointment
        const normalizedAppointments: Appointment[] = filteredAppointments.map((apt) => ({
          ...apt,
          id: String(apt.id),
          service: {
            id: String(apt.service.id),
            name: apt.service.name,
          },
          client: {
            id: String(apt.client.id),
            full_name: apt.client.full_name,
          },
        }));

        setAppointments(normalizedAppointments);
      }
    } catch (error) {
      logger.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

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

  const handleMonthChange = (direction: 'prev' | 'next') => {
    setCurrentMonth((prevMonth) => {
      const newMonth = new Date(prevMonth);
      newMonth.setMonth(prevMonth.getMonth() + (direction === 'next' ? 1 : -1));
      return newMonth;
    });
  };

  const getAppointmentsForDate = (date: Date) => {
    const dateString = format(date, 'yyyy-MM-dd');
    return appointments.filter((apt) => {
      const aptDate = new Date(apt.start_time);
      const aptDateString = format(aptDate, 'yyyy-MM-dd');
      return aptDateString === dateString;
    });
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
  };

  const formatDayLabel = (date: Date) => format(date, "d 'de' MMM.", { locale: ptBR });

  const groupedAppointments: DayAppointments[] = [];
  const appointmentsByDate = new Map<string, Appointment[]>();

  appointments.forEach((apt) => {
    const aptDate = new Date(apt.start_time);
    const dateKey = format(aptDate, 'yyyy-MM-dd');
    if (!appointmentsByDate.has(dateKey)) {
      appointmentsByDate.set(dateKey, []);
    }
    appointmentsByDate.get(dateKey)!.push(apt);
  });

  appointmentsByDate.forEach((apts, dateKey) => {
    groupedAppointments.push({
      date: parseISO(dateKey),
      appointments: apts,
    });
  });

  groupedAppointments.sort((a, b) => a.date.getTime() - b.date.getTime());

  if (loading) {
    return (
      <ScreenContainer
        scroll={false}
        backgroundColor={colors.background}
        hasHeader={true}
        hasTabBar={false}
        header={
          <AppHeader
            showBackButton={true}
            onPressBack={() => safeGoBack('/(merchant)/dashboard')}
          />
        }
      >
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
      hasTabBar={false}
      backgroundColor={colors.background}
      contentContainerStyle={styles.scrollContent}
      header={
        <AppHeader
          showBackButton={true}
          onPressBack={() => safeGoBack('/(merchant)/dashboard')}
        />
      }
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => safeGoBack('/(merchant)/dashboard')}>
          <IconBack size={24} color={colors.brand} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Agenda Mensal</Text>
        </View>
      </View>
      {/* Calendar */}
      <MonthCalendar
        key={calendarResetKey}
        currentMonth={currentMonth}
        onMonthChange={handleMonthChange}
        selectedDate={selectedDate}
        onSelectDate={handleDateSelect}
        markedDates={appointments.map((apt) => format(new Date(apt.start_time), 'yyyy-MM-dd'))}
      />

      {/* Appointments List */}
      {selectedDate ? (
        <AppointmentDaySection
          dateLabel={formatDayLabel(selectedDate)}
          isToday={isSameDay(selectedDate, new Date())}
          hasAppointments={getAppointmentsForDate(selectedDate).length > 0}
        >
          {getAppointmentsForDate(selectedDate).map((apt) => {
            const appointmentDate = new Date(apt.start_time);
            const time = format(appointmentDate, 'HH:mm');
            const dateLabel = `Data ${format(appointmentDate, 'dd/MM/yy')}`;

            return (
              <AppointmentCard
                key={apt.id}
                time={time}
                dateLabel={dateLabel}
                serviceName={apt.service.name}
                showShopName={false}
                onPress={() => router.push(`/(merchant)/dashboard/appointment/${apt.id}`)}
              />
            );
          })}
        </AppointmentDaySection>
      ) : (
        <View style={styles.allAppointmentsSection}>
          <Text style={styles.sectionTitle}>Todos os agendamentos do mês</Text>
          {groupedAppointments.length === 0 ? (
            <AppointmentDaySection
              dateLabel={formatDayLabel(currentMonth)}
              isToday={isSameDay(currentMonth, new Date())}
              hasAppointments={false}
            >
              {null}
            </AppointmentDaySection>
          ) : (
            groupedAppointments.map((dayGroup) => {
              const hasReschedulePending = dayGroup.appointments.some(
                (apt) => apt.status?.toLowerCase() === 'rescheduled'
              );

              return (
                <AppointmentDaySection
                  key={format(dayGroup.date, 'yyyy-MM-dd')}
                  dateLabel={formatDayLabel(dayGroup.date)}
                  isToday={isSameDay(dayGroup.date, new Date())}
                  statusLabel={hasReschedulePending ? 'Reagendado - Pendente' : undefined}
                  hasAppointments={dayGroup.appointments.length > 0}
                  containerStyle={styles.dayGroup}
                >
                  {dayGroup.appointments.map((apt) => {
                    const appointmentDate = new Date(apt.start_time);
                    const time = format(appointmentDate, 'HH:mm');
                    const dateLabel = `Data ${format(appointmentDate, 'dd/MM/yy')}`;

                    return (
                      <AppointmentCard
                        key={apt.id}
                        time={time}
                        dateLabel={dateLabel}
                        serviceName={apt.service.name}
                        showShopName={false}
                        onPress={() => router.push(`/(merchant)/dashboard/appointment/${apt.id}`)}
                      />
                    );
                  })}
                </AppointmentDaySection>
              );
            })
          )}
        </View>
      )}
    </ScreenContainer>
  );
};

export default MerchantMonthDashboardScreen;

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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Montserrat_700Bold',
    color: colors.brand,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  allAppointmentsSection: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Montserrat_700Bold',
    color: colors.brand,
    marginBottom: 16,
  },
  dayGroup: {
    marginBottom: 24,
  },
});
















