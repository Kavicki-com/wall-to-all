import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { MerchantTopBar } from '../../../components/MerchantTopBar';
import { IconChevronDown } from '../../../lib/icons';
import { format, parseISO, isToday, isSameDay, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MaterialIcons } from '@expo/vector-icons';

type Appointment = {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  payment_method: string;
  observations: string | null;
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
  };
};

const MerchantDashboardScreen: React.FC = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarExpanded, setCalendarExpanded] = useState(false);

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
        if (businessError?.code === 'PGRST116') {
          Alert.alert(
            'Perfil não encontrado',
            'Você precisa criar um perfil de negócio primeiro.',
            [{ text: 'OK', onPress: () => router.push('/(merchant)/profile/edit') }]
          );
        }
        setLoading(false);
        return;
      }

      setBusinessId(businessData.id);

      // Buscar agendamentos do mês atual usando start_time
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);
      const startDate = format(monthStart, 'yyyy-MM-dd');
      const endDate = format(monthEnd, 'yyyy-MM-dd');

      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from('appointments')
        .select(
          `
          *,
          service:services(id, name, price, price_type, duration_minutes, photos),
          client:profiles!appointments_client_id_fkey(id, full_name, avatar_url)
        `,
        )
        .eq('business_id', businessData.id)
        .gte('start_time', `${startDate}T00:00:00`)
        .lte('start_time', `${endDate}T23:59:59`)
        .order('start_time', { ascending: true });

      if (appointmentsError) {
        console.error('Erro ao buscar agendamentos:', appointmentsError);
      } else if (appointmentsData) {
        setAppointments(appointmentsData as Appointment[]);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      Alert.alert(
        'Erro ao carregar',
        'Não foi possível carregar os dados. Verifique sua conexão e tente novamente.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadBusinessAndAppointments();
  };

  const hasAppointmentOnDate = (date: Date): boolean => {
    const dateString = date.toISOString().split('T')[0];
    return appointments.some((apt) => {
      const aptDate = new Date(apt.start_time);
      const aptDateString = aptDate.toISOString().split('T')[0];
      return aptDateString === dateString;
    });
  };

  const getFilteredAppointments = (): Appointment[] => {
    const dateString = selectedDate.toISOString().split('T')[0];
    return appointments.filter((apt) => {
      const aptDate = new Date(apt.start_time);
      const aptDateString = aptDate.toISOString().split('T')[0];
      return aptDateString === dateString;
    });
  };

  const generateCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const prevMonthLastDay = new Date(year, month, 0).getDate();

    const days: Array<{ day: number; isCurrentMonth: boolean; isPrevMonth: boolean; isNextMonth: boolean }> = [];
    
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push({ 
        day: prevMonthLastDay - i, 
        isCurrentMonth: false, 
        isPrevMonth: true,
        isNextMonth: false
      });
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ 
        day: i, 
        isCurrentMonth: true,
        isPrevMonth: false,
        isNextMonth: false
      });
    }

    const remainingDays = days.length % 7;
    if (remainingDays !== 0) {
      for (let i = 1; i <= (7 - remainingDays); i++) {
        days.push({ 
          day: i, 
          isCurrentMonth: false,
          isPrevMonth: false,
          isNextMonth: true
        });
      }
    }

    return days;
  };

  const getFirstWeek = () => {
    const allDays = generateCalendar();
    return allDays.slice(0, 7);
  };

  const formatSelectedDate = (): string => {
    const day = format(selectedDate, 'd', { locale: ptBR });
    const month = format(selectedDate, 'MMM', { locale: ptBR });
    return `${day} de ${month}.`;
  };

  const formatDateHeader = (date: Date): string => {
    const day = format(date, 'd', { locale: ptBR });
    const month = format(date, 'MMM', { locale: ptBR });
    return `${day} de ${month}.`;
  };

  const getGroupedAppointments = () => {
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
  };

  const renderAppointmentCard = (appointment: Appointment) => {
    const appointmentDate = new Date(appointment.start_time);
    const timeString = format(appointmentDate, 'HH:mm');
    const dateString = format(appointmentDate, 'dd/MM/yy');

    return (
      <TouchableOpacity
        key={appointment.id}
        style={styles.appointmentCard}
        onPress={() => router.push(`/(merchant)/dashboard/appointment/${appointment.id}`)}
        accessibilityRole="button"
        accessibilityLabel={`Agendamento: ${appointment.service.name} às ${timeString}`}
        accessibilityHint="Toque para ver detalhes do agendamento"
      >
        <View style={styles.appointmentHeader}>
          <Text style={styles.appointmentTime}>{timeString}</Text>
          <Text style={styles.appointmentDateLabel}>Data {dateString}</Text>
        </View>
        <View style={styles.appointmentContent}>
          <View style={styles.appointmentIconPlaceholder} />
          <Text style={styles.appointmentServiceName} numberOfLines={1}>
            {appointment.service.name}
          </Text>
          <MaterialIcons name="chevron-right" size={24} color="#E5102E" />
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E5102E" />
      </View>
    );
  }

  const calendarDays = calendarExpanded ? generateCalendar() : getFirstWeek();
  const dayNames = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
  const groupedAppointments = getGroupedAppointments();
  const sortedDates = Object.keys(groupedAppointments).sort();

  return (
    <View style={styles.container}>
      <MerchantTopBar />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Título */}
        <Text style={styles.sectionTitle}>Próximos agendamentos</Text>

        {/* Calendário */}
        <View style={styles.calendarContainer}>
          <View style={styles.calendarGrid}>
            {/* Days of week */}
            <View style={styles.daysOfWeek}>
              {dayNames.map((day, index) => (
                <View key={index} style={styles.dayOfWeek}>
                  <Text style={styles.dayOfWeekText}>{day}</Text>
                </View>
              ))}
            </View>

            {/* Calendar days */}
            <View style={styles.calendarWeeks}>
              {Array.from({ length: Math.ceil(calendarDays.length / 7) }).map((_, weekIndex) => (
                <View key={weekIndex} style={styles.calendarWeek}>
                  {calendarDays.slice(weekIndex * 7, (weekIndex + 1) * 7).map((dayObj, dayIndex) => {
                    // Calcular a data correta
                    let targetDate: Date;
                    if (dayObj.isPrevMonth) {
                      targetDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, dayObj.day);
                    } else if (dayObj.isNextMonth) {
                      targetDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, dayObj.day);
                    } else {
                      targetDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), dayObj.day);
                    }
                    
                    const isSelectedDate = 
                      targetDate.getDate() === selectedDate.getDate() &&
                      targetDate.getMonth() === selectedDate.getMonth() &&
                      targetDate.getFullYear() === selectedDate.getFullYear();
                    const isTodayDate = isToday(targetDate);
                    const hasAppointment = hasAppointmentOnDate(targetDate);
                    const isOtherMonth = !dayObj.isCurrentMonth;
                    
                    return (
                      <TouchableOpacity
                        key={dayIndex}
                        style={[
                          styles.calendarDay,
                          isSelectedDate && styles.calendarDaySelected,
                        ]}
                        onPress={() => setSelectedDate(targetDate)}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={`${dayObj.day} de ${format(currentMonth, 'MMMM', { locale: ptBR })}`}
                        accessibilityHint={hasAppointment ? 'Este dia tem agendamentos' : 'Toque para selecionar este dia'}
                      >
                        <Text
                          style={[
                            styles.calendarDayText,
                            isOtherMonth && styles.calendarDayTextOtherMonth,
                            isSelectedDate && styles.calendarDayTextSelected,
                          ]}
                        >
                          {dayObj.day}
                        </Text>
                        {hasAppointment && !isSelectedDate && (
                          <View style={styles.appointmentIndicator} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>

          {/* Toggle calendar button */}
          <TouchableOpacity
            style={styles.calendarToggle}
            onPress={() => setCalendarExpanded(!calendarExpanded)}
            accessibilityRole="button"
            accessibilityLabel={calendarExpanded ? 'Ocultar calendário' : 'Mostrar calendário completo'}
          >
            <Text style={styles.calendarToggleText}>
              {calendarExpanded ? 'Ocultar' : 'Ver tudo'}
            </Text>
            <View
              style={[
                styles.calendarToggleIcon,
                calendarExpanded && styles.calendarToggleIconRotated,
              ]}
            >
              <IconChevronDown size={24} color="#000E3D" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Lista de Agendamentos Agrupados por Data */}
        {sortedDates.map((dateKey) => {
          const dateAppointments = groupedAppointments[dateKey];
          const date = parseISO(dateKey);
          const isTodayDate = isToday(date);

          return (
            <View key={dateKey} style={styles.dateGroup}>
              <View style={styles.dateHeader}>
                <Text style={styles.dateHeaderText}>{formatDateHeader(date)}</Text>
                {isTodayDate && <Text style={styles.dateHeaderToday}>Hoje</Text>}
              </View>
              <View style={styles.appointmentsContainer}>
                {dateAppointments.map((appointment) => renderAppointmentCard(appointment))}
              </View>
            </View>
          );
        })}

        {/* Mensagem quando não há agendamentos */}
        {sortedDates.length === 0 && (
          <View style={styles.emptyStateCard}>
            <Text style={styles.emptyStateText}>
              Nenhum agendamento para esta data.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

export default MerchantDashboardScreen;

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
  scrollView: {
    flex: 1,
    marginTop: 70,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 100,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#E5102E',
    marginBottom: 24,
  },
  calendarContainer: {
    backgroundColor: '#D6E0FF',
    borderRadius: 16,
    paddingTop: 24,
    paddingHorizontal: 12,
    paddingBottom: 4,
    marginBottom: 24,
  },
  calendarGrid: {
    marginBottom: 8,
  },
  daysOfWeek: {
    flexDirection: 'row',
    marginBottom: 0,
  },
  dayOfWeek: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 24,
    marginBottom: 8,
  },
  dayOfWeekText: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#0F0F0F',
  },
  calendarWeeks: {
    gap: 0,
  },
  calendarWeek: {
    flexDirection: 'row',
    gap: 0,
  },
  calendarDay: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 100,
    minHeight: 40,
    maxHeight: 40,
    margin: 4,
  },
  calendarDaySelected: {
    backgroundColor: '#E5102E',
  },
  calendarDayText: {
    fontSize: 16,
    fontFamily: 'Montserrat_500Medium',
    color: '#1D1B20',
  },
  calendarDayTextOtherMonth: {
    color: '#919191',
    opacity: 0.38,
  },
  calendarDayTextSelected: {
    color: '#FEFEFE',
  },
  appointmentIndicator: {
    position: 'absolute',
    bottom: 2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5102E',
  },
  calendarToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 8,
  },
  calendarToggleText: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#000E3D',
  },
  calendarToggleIcon: {
    transform: [{ rotate: '0deg' }],
  },
  calendarToggleIconRotated: {
    transform: [{ rotate: '180deg' }],
  },
  dateGroup: {
    marginBottom: 16,
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  dateHeaderText: {
    fontSize: 20,
    fontFamily: 'Montserrat_700Bold',
    color: '#0F0F0F',
  },
  dateHeaderToday: {
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#0F0F0F',
  },
  appointmentsContainer: {
    gap: 4,
  },
  appointmentCard: {
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    paddingTop: 8,
    paddingBottom: 16,
    gap: 16,
  },
  appointmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  appointmentTime: {
    fontSize: 12,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#474747',
    flex: 1,
  },
  appointmentDateLabel: {
    fontSize: 12,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#0F0F0F',
  },
  appointmentContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    height: 40,
  },
  appointmentIconPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E0E0E0',
  },
  appointmentServiceName: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#0F0F0F',
  },
  emptyStateCard: {
    padding: 16,
  },
  emptyStateText: {
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#0F0F0F',
  },
});
