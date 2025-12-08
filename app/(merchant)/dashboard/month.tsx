import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { IconBack, IconChevronDown } from '../../../lib/icons';
import { format, addDays, isSameDay, parseISO, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type Appointment = {
  id: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  service: {
    id: string;
    name: string;
  };
  client: {
    id: string;
    full_name: string | null;
  };
};

type DayAppointments = {
  date: Date;
  appointments: Appointment[];
};

const MerchantMonthDashboardScreen: React.FC = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showFullCalendar, setShowFullCalendar] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  useEffect(() => {
    loadBusinessAndAppointments();
  }, [currentMonth]);

  const loadBusinessAndAppointments = async () => {
    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        console.log('Usuário não autenticado');
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
        console.error('Erro ao buscar negócio:', businessError);
        setLoading(false);
        return;
      }

      setBusinessId(businessData.id);

      // Buscar agendamentos do mês
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);
      const startDate = format(monthStart, 'yyyy-MM-dd');
      const endDate = format(monthEnd, 'yyyy-MM-dd');

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
        .gte('appointment_date', startDate)
        .lte('appointment_date', endDate)
        .order('appointment_date', { ascending: true })
        .order('appointment_time', { ascending: true });

      if (appointmentsError) {
        console.error('Erro ao buscar agendamentos:', appointmentsError);
      } else if (appointmentsData) {
        setAppointments(appointmentsData as Appointment[]);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadBusinessAndAppointments();
  };

  const generateCalendarDates = (month: Date) => {
    const startOfMonthDate = startOfMonth(month);
    const endOfMonthDate = endOfMonth(month);
    const startDay = startOfMonthDate.getDay(); // 0 for Sunday, 1 for Monday
    const dates: Date[] = [];

    for (let i = startDay; i > 0; i--) {
      const prevDay = new Date(startOfMonthDate);
      prevDay.setDate(startOfMonthDate.getDate() - i);
      dates.push(prevDay);
    }

    const daysInMonth = eachDayOfInterval({
      start: startOfMonthDate,
      end: endOfMonthDate,
    });
    dates.push(...daysInMonth);

    const totalCells = 42;
    const remainingCells = totalCells - dates.length;
    for (let i = 1; i <= remainingCells; i++) {
      const nextDay = new Date(endOfMonthDate);
      nextDay.setDate(endOfMonthDate.getDate() + i);
      dates.push(nextDay);
    }
    return dates;
  };

  const calendarDates = generateCalendarDates(currentMonth);

  const handleMonthChange = (direction: 'prev' | 'next') => {
    setCurrentMonth((prevMonth) => {
      const newMonth = new Date(prevMonth);
      newMonth.setMonth(prevMonth.getMonth() + (direction === 'next' ? 1 : -1));
      return newMonth;
    });
  };

  const getAppointmentsForDate = (date: Date) => {
    const dateString = format(date, 'yyyy-MM-dd');
    return appointments.filter((apt) => apt.appointment_date === dateString);
  };

  const handleDateSelect = (date: Date) => {
    if (date.getMonth() !== currentMonth.getMonth()) {
      setCurrentMonth(date);
    }
    setSelectedDate(date);
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    return `${hours}h${minutes !== '00' ? minutes : ''}`;
  };

  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      pending: '#FFA500',
      confirmed: '#17723F',
      cancelled: '#E5102E',
      completed: '#474747',
      rescheduled: '#000E3D',
    };
    return colorMap[status] || '#474747';
  };

  const groupedAppointments: DayAppointments[] = [];
  const appointmentsByDate = new Map<string, Appointment[]>();

  appointments.forEach((apt) => {
    const dateKey = apt.appointment_date;
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

  const renderAppointmentItem = (appointment: Appointment) => (
    <TouchableOpacity
      key={appointment.id}
      style={styles.appointmentItem}
      onPress={() => router.push(`/(merchant)/dashboard/appointment/${appointment.id}`)}
      activeOpacity={0.8}
    >
      <View
        style={[styles.statusIndicator, { backgroundColor: getStatusColor(appointment.status) }]}
      />
      <View style={styles.appointmentItemContent}>
        <Text style={styles.appointmentTime}>{formatTime(appointment.appointment_time)}</Text>
        <Text style={styles.appointmentService}>{appointment.service.name}</Text>
        <Text style={styles.appointmentClient}>
          {appointment.client.full_name || 'Cliente'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E5102E" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <IconBack size={24} color="#000E3D" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Agenda Mensal</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Calendar */}
        <View style={styles.calendarContainer}>
          <View style={styles.calendarHeader}>
            <TouchableOpacity onPress={() => handleMonthChange('prev')}>
              <IconBack size={20} color="#000E3D" />
            </TouchableOpacity>
            <Text style={styles.monthYearText}>
              {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
            </Text>
            <TouchableOpacity onPress={() => handleMonthChange('next')}>
              <IconBack size={20} color="#000E3D" style={{ transform: [{ rotate: '180deg' }] }} />
            </TouchableOpacity>
          </View>
          <View style={styles.daysOfWeekContainer}>
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
              <Text key={day} style={styles.dayOfWeekText}>
                {day}
              </Text>
            ))}
          </View>
          {showFullCalendar && (
            <View style={styles.calendarGrid}>
              {calendarDates.map((date, index) => {
                const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
                const isSelected = selectedDate && isSameDay(date, selectedDate);
                const isTodayDate = isSameDay(date, new Date());
                const dayAppointments = getAppointmentsForDate(date);
                const hasAppointments = dayAppointments.length > 0;

                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.calendarDay,
                      !isCurrentMonth && styles.calendarDayInactive,
                      isSelected && styles.calendarDaySelected,
                      isTodayDate && styles.calendarDayToday,
                    ]}
                    onPress={() => handleDateSelect(date)}
                    disabled={!isCurrentMonth}
                  >
                    <Text
                      style={[
                        styles.calendarDayText,
                        !isCurrentMonth && styles.calendarDayTextInactive,
                        isSelected && styles.calendarDayTextSelected,
                      ]}
                    >
                      {format(date, 'd')}
                    </Text>
                    {hasAppointments && (
                      <View style={styles.appointmentDot} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
          <TouchableOpacity
            style={styles.toggleCalendarButton}
            onPress={() => setShowFullCalendar(!showFullCalendar)}
          >
            <Text style={styles.toggleCalendarButtonText}>
              {showFullCalendar ? 'Ocultar' : 'Ver tudo'}
            </Text>
            <IconChevronDown
              size={16}
              color="#000E3D"
              style={showFullCalendar && { transform: [{ rotate: '180deg' }] }}
            />
          </TouchableOpacity>
        </View>

        {/* Appointments List */}
        {selectedDate ? (
          <View style={styles.selectedDateSection}>
            <Text style={styles.selectedDateText}>
              {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
            </Text>
            {isSameDay(selectedDate, new Date()) && (
              <Text style={styles.selectedDateTodayText}>Hoje</Text>
            )}
            {getAppointmentsForDate(selectedDate).length === 0 ? (
              <Text style={styles.emptyDateText}>Nenhum agendamento para esta data.</Text>
            ) : (
              <View style={styles.appointmentsList}>
                {getAppointmentsForDate(selectedDate).map((apt) => renderAppointmentItem(apt))}
              </View>
            )}
          </View>
        ) : (
          <View style={styles.allAppointmentsSection}>
            <Text style={styles.sectionTitle}>Todos os agendamentos do mês</Text>
            {groupedAppointments.length === 0 ? (
              <Text style={styles.emptyText}>Nenhum agendamento neste mês.</Text>
            ) : (
              groupedAppointments.map((dayGroup) => (
                <View key={format(dayGroup.date, 'yyyy-MM-dd')} style={styles.dayGroup}>
                  <Text style={styles.dayGroupDate}>
                    {format(dayGroup.date, "EEEE, d 'de' MMMM", { locale: ptBR })}
                    {isSameDay(dayGroup.date, new Date()) && (
                      <Text style={styles.dayGroupToday}> - Hoje</Text>
                    )}
                  </Text>
                  <View style={styles.appointmentsList}>
                    {dayGroup.appointments.map((apt) => renderAppointmentItem(apt))}
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

export default MerchantMonthDashboardScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: '#FEFEFE',
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
    color: '#000E3D',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 32,
  },
  calendarContainer: {
    backgroundColor: '#D6E0FF',
    borderRadius: 16,
    marginBottom: 24,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  monthYearText: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#000E3D',
    textTransform: 'capitalize',
  },
  daysOfWeekContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  dayOfWeekText: {
    fontSize: 14,
    fontFamily: 'Montserrat_700Bold',
    color: '#0F0F0F',
    width: 40,
    textAlign: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  calendarDay: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 100,
    marginVertical: 2,
    position: 'relative',
  },
  calendarDayInactive: {
    opacity: 0.38,
  },
  calendarDaySelected: {
    backgroundColor: '#E5102E',
  },
  calendarDayToday: {
    borderWidth: 1,
    borderColor: '#000E3D',
  },
  calendarDayText: {
    fontSize: 16,
    fontFamily: 'Montserrat_500Medium',
    color: '#0F0F0F',
  },
  calendarDayTextInactive: {
    color: '#919191',
  },
  calendarDayTextSelected: {
    color: '#FEFEFE',
  },
  appointmentDot: {
    position: 'absolute',
    bottom: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E5102E',
  },
  toggleCalendarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  toggleCalendarButtonText: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#000E3D',
    marginRight: 8,
  },
  selectedDateSection: {
    marginTop: 16,
  },
  selectedDateText: {
    fontSize: 20,
    fontFamily: 'Montserrat_700Bold',
    color: '#0F0F0F',
    textTransform: 'capitalize',
    marginBottom: 4,
  },
  selectedDateTodayText: {
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#474747',
    marginLeft: 8,
  },
  emptyDateText: {
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#474747',
    marginTop: 8,
  },
  allAppointmentsSection: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Montserrat_700Bold',
    color: '#000E3D',
    marginBottom: 16,
  },
  dayGroup: {
    marginBottom: 24,
  },
  dayGroupDate: {
    fontSize: 18,
    fontFamily: 'Montserrat_700Bold',
    color: '#0F0F0F',
    textTransform: 'capitalize',
    marginBottom: 12,
  },
  dayGroupToday: {
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#474747',
  },
  appointmentsList: {
    gap: 12,
  },
  appointmentItem: {
    flexDirection: 'row',
    backgroundColor: '#FEFEFE',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    overflow: 'hidden',
  },
  statusIndicator: {
    width: 4,
  },
  appointmentItemContent: {
    flex: 1,
    padding: 16,
    gap: 4,
  },
  appointmentTime: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#0F0F0F',
  },
  appointmentService: {
    fontSize: 14,
    fontFamily: 'Montserrat_500Medium',
    color: '#474747',
  },
  appointmentClient: {
    fontSize: 14,
    fontFamily: 'Montserrat_400Regular',
    color: '#474747',
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#474747',
    textAlign: 'center',
    marginTop: 16,
  },
});
















