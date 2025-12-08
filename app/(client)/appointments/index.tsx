import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  FlatList,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { IconRatingStar, IconSchedule, IconNotification, IconChevronDown } from '../../../lib/icons';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';

type Appointment = {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  payment_method: string;
  service: {
    id: string;
    name: string;
    price: number;
    photos: string[] | string | null;
  };
  business: {
    id: string;
    business_name: string;
    logo_url: string | null;
  };
};

const ClientAppointmentsScreen: React.FC = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [calendarExpanded, setCalendarExpanded] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  useEffect(() => {
    loadAppointments();
  }, []);

  useEffect(() => {
    // Quando carregar agendamentos, selecionar a data do primeiro agendamento se não houver agendamentos na data atual
    if (appointments.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayString = today.toISOString().split('T')[0];
      
      const hasTodayAppointments = appointments.some((apt) => {
        const aptDate = new Date(apt.start_time);
        aptDate.setHours(0, 0, 0, 0);
        return aptDate.toISOString().split('T')[0] === todayString;
      });
      
      if (!hasTodayAppointments) {
        const firstAppointment = appointments[0];
        const firstDate = new Date(firstAppointment.start_time);
        firstDate.setHours(0, 0, 0, 0);
        setSelectedDate(firstDate);
      }
    }
  }, [appointments.length]);

  const loadAppointments = async () => {
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

      const { data: appointmentsData, error } = await supabase
        .from('appointments')
        .select(
          `
          *,
          service:services(id, name, price, photos),
          business:business_profiles(id, business_name, logo_url)
        `,
        )
        .eq('client_id', user.id)
        .order('start_time', { ascending: false });

      if (error) {
        console.error('Erro ao buscar agendamentos:', error);
      } else if (appointmentsData) {
        setAppointments(appointmentsData as Appointment[]);
      }
    } catch (error) {
      console.error('Erro ao carregar agendamentos:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadAppointments();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const months = [
      'Jan',
      'Fev',
      'Mar',
      'Abr',
      'Mai',
      'Jun',
      'Jul',
      'Ago',
      'Set',
      'Out',
      'Nov',
      'Dez',
    ];

    const dayName = days[date.getDay()];
    const day = date.getDate();
    const month = months[date.getMonth()];

    return `${dayName}, ${day} ${month}`;
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}h${minutes !== '00' ? minutes : ''}`;
  };

  const getStatusLabel = (status: string) => {
    const statusMap: Record<string, string> = {
      pending: 'Pendente',
      confirmed: 'Confirmado',
      cancelled: 'Cancelado',
      completed: 'Concluído',
      rescheduled: 'Reagendado',
    };
    return statusMap[status] || status;
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

  const formatSelectedDate = () => {
    const months = [
      'Jan',
      'Fev',
      'Mar',
      'Abr',
      'Mai',
      'Jun',
      'Jul',
      'Ago',
      'Set',
      'Out',
      'Nov',
      'Dez',
    ];
    const day = selectedDate.getDate();
    const month = months[selectedDate.getMonth()];
    return `${day} de ${month}.`;
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const hasAppointmentOnDate = (date: Date) => {
    const dateString = date.toISOString().split('T')[0];
    return appointments.some((apt) => {
      const aptDate = new Date(apt.start_time);
      const aptDateString = aptDate.toISOString().split('T')[0];
      return aptDateString === dateString;
    });
  };

  const getFilteredAppointments = () => {
    const dateString = selectedDate.toISOString().split('T')[0];
    return appointments.filter((apt) => {
      const aptDate = new Date(apt.start_time);
      const aptDateString = aptDate.toISOString().split('T')[0];
      return aptDateString === dateString;
    });
  };

  const generateCalendar = () => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
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

  const renderAppointmentCard = ({ item }: { item: Appointment }) => {
    // Processar imagens do serviço
    let imagesArray: string[] = [];
    if (item.service.photos) {
      if (typeof item.service.photos === 'string') {
        try {
          imagesArray = JSON.parse(item.service.photos);
        } catch {
          imagesArray = [item.service.photos];
        }
      } else if (Array.isArray(item.service.photos)) {
        imagesArray = item.service.photos;
      }
    }
    const firstImage = imagesArray.length > 0 ? imagesArray[0] : null;

    return (
      <TouchableOpacity
        style={styles.appointmentCard}
        activeOpacity={0.8}
        onPress={() => {
          router.push(`/(client)/appointments/${item.id}`);
        }}
      >
        {/* Service Image */}
        {firstImage ? (
          <Image
            source={{ uri: firstImage }}
            style={styles.serviceImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.serviceImage, styles.placeholderImage]} />
        )}

        <View style={styles.appointmentInfo}>
          {/* Business Info */}
          <View style={styles.businessInfo}>
            {item.business.logo_url ? (
              <Image
                source={{ uri: item.business.logo_url }}
                style={styles.businessLogo}
              />
            ) : (
              <View style={[styles.businessLogo, styles.placeholderLogo]} />
            )}
            <View style={styles.businessText}>
              <Text style={styles.businessName}>{item.business.business_name}</Text>
              <Text style={styles.serviceName}>{item.service.name}</Text>
            </View>
          </View>

          {/* Date and Time */}
          <View style={styles.dateTimeContainer}>
            <View style={styles.dateTimeItem}>
              <IconSchedule size={16} color="#474747" />
              <Text style={styles.dateTimeText}>
                {formatDate(item.start_time)} às {formatTime(item.start_time)}
              </Text>
            </View>
          </View>

          {/* Price and Status */}
          <View style={styles.footer}>
            <Text style={styles.price}>
              R$ {item.service.price.toFixed(2).replace('.', ',')}
            </Text>
            <View
              style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}
            >
              <Text style={styles.statusText}>{getStatusLabel(item.status)}</Text>
            </View>
          </View>
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

  return (
    <View style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <View style={styles.topBarDivider} />
        <View style={styles.topBarContent}>
          <View style={styles.topBarGradientContainer}>
            <Svg style={StyleSheet.absoluteFill} viewBox="0 0 410 56" preserveAspectRatio="none">
              <Defs>
                <RadialGradient
                  id="topBarRadialGradient"
                  cx="50%"
                  cy="50%"
                  r="50%"
                  gradientUnits="userSpaceOnUse"
                >
                  <Stop offset="0%" stopColor="rgba(214,224,255,0.2)" />
                  <Stop offset="25%" stopColor="rgba(161,172,207,0.2)" />
                  <Stop offset="37.5%" stopColor="rgba(134,145,182,0.2)" />
                  <Stop offset="50%" stopColor="rgba(107,119,158,0.2)" />
                  <Stop offset="62.5%" stopColor="rgba(80,93,134,0.2)" />
                  <Stop offset="75%" stopColor="rgba(54,67,110,0.2)" />
                  <Stop offset="87.5%" stopColor="rgba(27,40,85,0.2)" />
                  <Stop offset="93.75%" stopColor="rgba(13,27,73,0.2)" />
                  <Stop offset="100%" stopColor="rgba(0,14,61,0.2)" />
                </RadialGradient>
              </Defs>
              <Rect x="0" y="0" width="410" height="56" fill="url(#topBarRadialGradient)" />
            </Svg>
            <LinearGradient
              colors={['rgba(0,14,61,0.2)', 'rgba(214,224,255,0.2)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          </View>
          <View style={styles.topBarGradientOverlay} />
          <View style={styles.topBarSpacer} />
          <TouchableOpacity style={styles.notificationButton}>
            <IconNotification size={24} color="#FEFEFE" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Próximos agendamentos</Text>

        {/* Calendar */}
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
                      targetDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, dayObj.day);
                    } else if (dayObj.isNextMonth) {
                      targetDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, dayObj.day);
                    } else {
                      targetDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), dayObj.day);
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
                          hasAppointment && !isSelectedDate && styles.calendarDayWithAppointment,
                        ]}
                        onPress={() => setSelectedDate(targetDate)}
                        activeOpacity={0.7}
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
          >
            <Text style={styles.calendarToggleText}>
              {calendarExpanded ? 'Ocultar' : 'Ver tudo'}
            </Text>
            <View
              style={[
                styles.calendarToggleIcon,
                !calendarExpanded && styles.calendarToggleIconRotated,
              ]}
            >
              <IconChevronDown size={24} color="#000E3D" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Date header */}
        <View style={styles.dateHeader}>
          <Text style={styles.dateHeaderText}>{formatSelectedDate()}</Text>
          {isToday(selectedDate) && <Text style={styles.dateHeaderToday}>Hoje</Text>}
        </View>

        {/* Appointments List */}
        {getFilteredAppointments().length === 0 ? (
          <View style={styles.emptyStateCard}>
            <Text style={styles.emptyStateText}>
              Nenhum agendamento para esta data.
            </Text>
          </View>
        ) : (
          <View style={styles.appointmentsList}>
            {getFilteredAppointments().map((appointment) => (
              <View key={appointment.id}>
                {renderAppointmentCard({ item: appointment })}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Schedule Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.scheduleButton}
          activeOpacity={0.8}
          onPress={() => router.push('/(client)/home')}
        >
          <Text style={styles.scheduleButtonText}>Agendar serviços</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default ClientAppointmentsScreen;

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
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  topBarDivider: {
    height: 14,
    backgroundColor: '#EBEFFF',
  },
  topBarContent: {
    height: 56,
    paddingHorizontal: 24,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: '#000E3D',
    position: 'relative',
    overflow: 'hidden',
  },
  topBarGradientContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  topBarGradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000E3D',
    opacity: 0.8,
  },
  topBarSpacer: {
    flex: 1,
  },
  notificationButton: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
    marginTop: 70,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 120,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#E5102E',
    marginBottom: 16,
  },
  calendarContainer: {
    backgroundColor: '#D6E0FF',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
  },
  calendarGrid: {
    paddingTop: 24,
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
  daysOfWeek: {
    flexDirection: 'row',
    height: 24,
    marginBottom: 0,
  },
  dayOfWeek: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayOfWeekText: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#0F0F0F',
  },
  calendarWeeks: {
    marginTop: 0,
  },
  calendarWeek: {
    flexDirection: 'row',
    height: 48,
  },
  calendarDay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    width: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  calendarDayEmpty: {
    flex: 1,
  },
  calendarDaySelected: {
    backgroundColor: '#E5102E',
    borderColor: '#E5102E',
  },
  calendarDayText: {
    fontSize: 16,
    fontFamily: 'Montserrat_500Medium',
    color: '#0F0F0F',
  },
  calendarDayTextOtherMonth: {
    color: '#B8B8B8',
    opacity: 0.6,
  },
  calendarDayTextSelected: {
    color: '#FEFEFE',
  },
  calendarDayWithAppointment: {
    position: 'relative',
  },
  appointmentIndicator: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5102E',
  },
  calendarToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 14, 61, 0.1)',
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
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  emptyStateCard: {
    backgroundColor: '#FEFEFE',
    borderWidth: 1,
    borderColor: '#DBDBDB',
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  emptyStateText: {
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#0F0F0F',
  },
  appointmentsList: {
    gap: 16,
  },
  appointmentCard: {
    backgroundColor: '#FEFEFE',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  serviceImage: {
    width: '100%',
    height: 200,
  },
  placeholderImage: {
    backgroundColor: '#E0E0E0',
  },
  appointmentInfo: {
    padding: 16,
    gap: 12,
  },
  businessInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  businessLogo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
  },
  placeholderLogo: {
    backgroundColor: '#E0E0E0',
  },
  businessText: {
    flex: 1,
    gap: 4,
  },
  businessName: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#000E3D',
  },
  serviceName: {
    fontSize: 14,
    fontFamily: 'Montserrat_400Regular',
    color: '#474747',
  },
  dateTimeContainer: {
    gap: 8,
  },
  dateTimeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateTimeText: {
    fontSize: 14,
    fontFamily: 'Montserrat_400Regular',
    color: '#474747',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  price: {
    fontSize: 18,
    fontFamily: 'Montserrat_700Bold',
    color: '#17723F',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Montserrat_700Bold',
    color: '#FEFEFE',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FEFEFE',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  scheduleButton: {
    borderWidth: 1,
    borderColor: '#000E3D',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleButtonText: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#000E3D',
  },
});
