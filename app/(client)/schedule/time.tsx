import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { IconBack, IconChevronDown, IconForkSpoon, IconNotification } from '../../../lib/icons';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';

type TimeSlot = {
  time: string;
  available: boolean;
  type?: 'available' | 'occupied' | 'lunch';
};

const ScheduleTimeScreen: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{
    businessId: string;
    serviceId: string;
    date?: string;
  }>();
  const [loading, setLoading] = useState(true);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [calendarExpanded, setCalendarExpanded] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(
    params.date ? new Date(params.date) : new Date(),
  );

  // Resetar seleção quando a tela é focada
  useFocusEffect(
    React.useCallback(() => {
      setSelectedTime(null);
      return () => {
        // Cleanup ao desfocar
      };
    }, [])
  );

  useEffect(() => {
    loadAvailableTimes();
  }, [selectedDate, params.businessId, params.serviceId]);

  const loadAvailableTimes = async () => {
    try {
      setLoading(true);

      if (!params.businessId || !params.serviceId) {
        console.error('Parâmetros faltando');
        setLoading(false);
        return;
      }

      const dateString = selectedDate.toISOString().split('T')[0];

      // Buscar horários de funcionamento da loja e duração do serviço
      const [businessResult, serviceResult] = await Promise.all([
        supabase
          .from('business_profiles')
          .select('work_days')
          .eq('id', params.businessId)
          .single(),
        supabase
          .from('services')
          .select('duration_minutes')
          .eq('id', params.serviceId)
          .single(),
      ]);

      if (businessResult.error || !businessResult.data?.work_days) {
        console.error('Erro ao buscar horários de funcionamento:', businessResult.error);
        setTimeSlots([]);
        setLoading(false);
        return;
      }

      const serviceDuration = serviceResult.data?.duration_minutes || 60;

      // Verificar qual dia da semana é a data selecionada
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
      const workDay = businessResult.data.work_days[dayName];

      if (!workDay) {
        // Dia não está disponível
        setTimeSlots([]);
        setLoading(false);
        return;
      }

      // Buscar appointments existentes para esta data
      const { data: existingAppointments } = await supabase
        .from('appointments')
        .select('start_time, end_time')
        .eq('business_id', params.businessId)
        .gte('start_time', `${dateString}T00:00:00`)
        .lt('start_time', `${dateString}T23:59:59`)
        .in('status', ['pending', 'confirmed']);

      // Gerar slots de horário baseado no horário de funcionamento
      const slots = generateTimeSlots(
        workDay.start,
        workDay.end,
        existingAppointments || [],
        serviceDuration,
        dateString,
      );
      setTimeSlots(slots);
    } catch (error) {
      console.error('Erro ao carregar horários:', error);
      setTimeSlots([]);
    } finally {
      setLoading(false);
    }
  };

  const generateTimeSlots = (
    startTime: string,
    endTime: string,
    existingAppointments: Array<{ start_time: string; end_time: string }>,
    serviceDuration: number,
    dateString: string,
  ): TimeSlot[] => {
    const slots: TimeSlot[] = [];
    const [startHour] = startTime.split(':').map(Number);
    const [endHour] = endTime.split(':').map(Number);

    let currentHour = startHour;

    while (currentHour < endHour) {
      const timeString = `${String(currentHour).padStart(2, '0')}:00`;
      const nextHour = currentHour + 1;
      const slotEndTime = `${String(nextHour).padStart(2, '0')}:00`;

      // Verificar se está ocupado por appointment existente
      let type: 'available' | 'occupied' | 'lunch' = 'available';
      const slotStart = new Date(`${dateString}T${timeString}:00`);
      const slotEnd = new Date(`${dateString}T${slotEndTime}:00`);

      // Verificar overlap com appointments existentes
      const isOccupied = existingAppointments.some((apt) => {
        const aptStart = new Date(apt.start_time);
        const aptEnd = new Date(apt.end_time);
        return (
          (slotStart >= aptStart && slotStart < aptEnd) ||
          (slotEnd > aptStart && slotEnd <= aptEnd) ||
          (slotStart <= aptStart && slotEnd >= aptEnd)
        );
      });

      if (isOccupied) {
        type = 'occupied';
      }

      // Verificar se há espaço suficiente para o serviço
      if (type === 'available' && currentHour + Math.ceil(serviceDuration / 60) > endHour) {
        type = 'occupied';
      }

      slots.push({ time: timeString, available: type === 'available', type });

      currentHour += 1;
    }

    return slots;
  };

  const formatTime = (time: string) => {
    const [hours] = time.split(':');
    const nextHour = parseInt(hours) + 1;
    return `${hours}h às ${nextHour}h`;
  };

  const handleTimeSelect = (time: string) => {
    const slot = timeSlots.find((s) => s.time === time);
    if (slot?.available) {
      setSelectedTime(time);
    }
  };

  const handleContinue = () => {
    if (selectedTime && params.businessId && params.serviceId) {
      const dateString = selectedDate.toISOString().split('T')[0];
      router.push({
        pathname: '/(client)/schedule/confirm',
        params: {
          businessId: params.businessId,
          serviceId: params.serviceId,
          date: dateString,
          time: selectedTime,
        },
      });
    }
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

  // Gerar calendário mensal
  const generateCalendar = () => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    // Pegar último dia do mês anterior
    const prevMonthLastDay = new Date(year, month, 0).getDate();

    const days: Array<{ day: number; isCurrentMonth: boolean; isPrevMonth: boolean; isNextMonth: boolean }> = [];
    
    // Adicionar dias do mês anterior
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push({ 
        day: prevMonthLastDay - i, 
        isCurrentMonth: false, 
        isPrevMonth: true,
        isNextMonth: false
      });
    }
    
    // Adicionar dias do mês atual
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ 
        day: i, 
        isCurrentMonth: true,
        isPrevMonth: false,
        isNextMonth: false
      });
    }

    // Completar a última semana com dias do próximo mês
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
    // Retorna apenas os primeiros 7 dias (primeira semana completa)
    return allDays.slice(0, 7);
  };

  const calendarDays = calendarExpanded ? generateCalendar() : getFirstWeek();
  const dayNames = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

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
              style={StyleSheet.absoluteFillObject}
            />
          </View>
          <View style={styles.topBarGradientOverlay} />
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
            accessibilityHint="Toque para voltar à tela anterior"
          >
            <IconBack size={24} color="#FEFEFE" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.notificationButton}
            accessibilityRole="button"
            accessibilityLabel="Notificações"
            accessibilityHint="Toque para ver notificações"
          >
            <IconNotification size={24} color="#FEFEFE" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
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
                    
                    const isSelected = 
                      targetDate.getDate() === selectedDate.getDate() &&
                      targetDate.getMonth() === selectedDate.getMonth() &&
                      targetDate.getFullYear() === selectedDate.getFullYear();
                    
                    const isOtherMonth = !dayObj.isCurrentMonth;
                    
                    return (
                      <TouchableOpacity
                        key={dayIndex}
                        style={[
                          styles.calendarDay,
                          isSelected && styles.calendarDaySelected,
                        ]}
                        onPress={() => setSelectedDate(targetDate)}
                        accessibilityRole="button"
                        accessibilityLabel={`Dia ${dayObj.day}${isSelected ? ', selecionado' : ''}`}
                        accessibilityHint="Toque para selecionar esta data"
                        accessibilityState={{ selected: isSelected }}
                      >
                        <Text
                          style={[
                            styles.calendarDayText,
                            isOtherMonth && styles.calendarDayTextOtherMonth,
                            isSelected && styles.calendarDayTextSelected,
                          ]}
                        >
                          {dayObj.day}
                        </Text>
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
            accessibilityLabel={calendarExpanded ? "Ocultar calendário" : "Mostrar calendário completo"}
            accessibilityHint="Toque para expandir ou recolher o calendário"
            accessibilityState={{ expanded: calendarExpanded }}
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

        {/* Time slots list */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#E5102E" />
          </View>
        ) : timeSlots.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              Não há horários disponíveis para esta data.
            </Text>
          </View>
        ) : (
          <View style={styles.timeSlotsList}>
            {timeSlots.map((slot, index) => {
              const isSelected = selectedTime === slot.time;
              const isDisabled = !slot.available;

              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.timeSlotCard,
                    isSelected && styles.timeSlotCardSelected,
                    isDisabled && styles.timeSlotCardDisabled,
                  ]}
                  activeOpacity={0.8}
                  onPress={() => handleTimeSelect(slot.time)}
                  disabled={isDisabled}
                  accessibilityRole="button"
                  accessibilityLabel={`Horário ${formatTime(slot.time)}${slot.type === 'lunch' ? ', horário de almoço' : slot.type === 'occupied' ? ', ocupado' : ', disponível'}`}
                  accessibilityHint={isDisabled ? "Este horário não está disponível" : isSelected ? "Horário selecionado. Toque novamente para desmarcar" : "Toque para selecionar este horário"}
                  accessibilityState={{ selected: isSelected, disabled: isDisabled }}
                >
                  {slot.type === 'lunch' && (
                    <View style={styles.lunchIcon}>
                      <IconForkSpoon size={24} color="#0F0F0F" />
                    </View>
                  )}
                  <View style={styles.timeSlotContent}>
                    <Text
                      style={[
                        styles.timeSlotTime,
                        isSelected && styles.timeSlotTimeSelected,
                        isDisabled && styles.timeSlotTimeDisabled,
                      ]}
                    >
                      {formatTime(slot.time)}
                    </Text>
                    <Text
                      style={[
                        styles.timeSlotStatus,
                        isSelected && styles.timeSlotStatusSelected,
                        isDisabled && styles.timeSlotStatusDisabled,
                      ]}
                    >
                      {slot.type === 'lunch'
                        ? 'Almoço'
                        : slot.type === 'occupied'
                        ? 'Ocupado'
                        : 'Disponível'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Continue Button */}
      {selectedTime && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.continueButton}
            activeOpacity={0.8}
            onPress={handleContinue}
            accessibilityRole="button"
            accessibilityLabel="Continuar para confirmação do agendamento"
            accessibilityHint="Toque para continuar e confirmar o agendamento"
          >
            <Text style={styles.continueButtonText}>Continuar</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

export default ScheduleTimeScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  loadingContainer: {
    padding: 32,
    justifyContent: 'center',
    alignItems: 'center',
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
    justifyContent: 'space-between',
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
  backButton: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
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
    paddingBottom: 100,
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
  },
  calendarDayEmpty: {
    flex: 1,
  },
  calendarDaySelected: {
    backgroundColor: '#E5102E',
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
  timeSlotsList: {
    gap: 12,
  },
  timeSlotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEFEFE',
    borderRadius: 24,
    padding: 16,
    gap: 16,
    shadowColor: '#1D1D1D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  timeSlotCardSelected: {
    borderColor: '#000E3D',
    backgroundColor: '#D6E0FF',
  },
  timeSlotCardDisabled: {
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
  },
  lunchIcon: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeSlotContent: {
    flex: 1,
    gap: 8,
  },
  timeSlotTime: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#0F0F0F',
  },
  timeSlotTimeSelected: {
    color: '#000E3D',
  },
  timeSlotTimeDisabled: {
    color: '#0F0F0F',
  },
  timeSlotStatus: {
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#0F0F0F',
  },
  timeSlotStatusSelected: {
    color: '#000E3D',
  },
  timeSlotStatusDisabled: {
    color: '#0F0F0F',
  },
  emptyContainer: {
    padding: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#474747',
    textAlign: 'center',
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
  continueButton: {
    backgroundColor: '#000E3D',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1D1D1D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.24,
    shadowRadius: 8,
    elevation: 4,
  },
  continueButtonText: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#FEFEFE',
  },
});
