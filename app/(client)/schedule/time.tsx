import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { applyAcceptedReschedules } from '../../../lib/utils';
import { IconForkSpoon } from '../../../lib/icons';
import AppHeader from '../../../components/layout/AppHeader';
import ScreenContainer from '../../../components/layout/ScreenContainer';
import MonthCalendar from '../../../components/calendar/MonthCalendar';
import { CustomButton } from '../../../components/CustomButton';
import { safeGoBack } from '../../../lib/router-utils';

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
  const initialDate = params.date ? new Date(params.date) : new Date();
  const [loading, setLoading] = useState(true);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState<Date>(initialDate);
  const [selectedDate, setSelectedDate] = useState<Date>(initialDate);
  const [calendarResetKey, setCalendarResetKey] = useState(0);

  useFocusEffect(
    React.useCallback(() => {
      setSelectedTime(null);
      setCurrentMonth(params.date ? new Date(params.date) : new Date());
      setSelectedDate(params.date ? new Date(params.date) : new Date());
      setCalendarResetKey((prev) => prev + 1);
      return () => {
      };
    }, [params.date])
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
          .select('work_days, lunch_break_start, lunch_break_end')
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

      // duration_minutes deve estar em minutos
      let serviceDuration = serviceResult.data?.duration_minutes || 60;
      
      // Se o valor for muito grande (provavelmente está em formato incorreto), converter
      // Valores normais de duração em minutos: 15, 30, 60, 90, 120, etc.
      // Se for maior que 480 (8 horas), provavelmente está em milissegundos ou segundos
      if (serviceDuration > 480) {
        console.warn('[ScheduleTime] serviceDuration parece estar em formato incorreto:', serviceDuration);
        // Tentar converter de milissegundos
        const convertedFromMs = Math.round(serviceDuration / 1000 / 60);
        if (convertedFromMs > 0 && convertedFromMs <= 480) {
          serviceDuration = convertedFromMs;
          console.log('[ScheduleTime] serviceDuration convertido de ms para minutos:', serviceDuration);
        } else {
          // Se ainda for muito grande, tentar converter de segundos
          const convertedFromSeconds = Math.round(serviceDuration / 60);
          if (convertedFromSeconds > 0 && convertedFromSeconds <= 480) {
            serviceDuration = convertedFromSeconds;
            console.log('[ScheduleTime] serviceDuration convertido de segundos para minutos:', serviceDuration);
          } else {
            // Se nada funcionar, usar um valor padrão razoável (60 minutos)
            console.warn('[ScheduleTime] serviceDuration inválido, usando padrão de 60 minutos');
            serviceDuration = 60;
          }
        }
      }

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
        .select('id, start_time, end_time')
        .eq('business_id', params.businessId)
        .gte('start_time', `${dateString}T00:00:00`)
        .lt('start_time', `${dateString}T23:59:59`)
        .in('status', ['pending', 'confirmed']);
      
      // Aplicar reagendamentos aceitos aos appointments existentes
      const appointmentsWithReschedules = existingAppointments 
        ? await applyAcceptedReschedules(existingAppointments)
        : [];

      // Obter horários de almoço
      const lunchBreakStart = businessResult.data?.lunch_break_start;
      const lunchBreakEnd = businessResult.data?.lunch_break_end;

      // Gerar slots de horário baseado no horário de funcionamento
      // Usar appointments com reagendamentos aplicados
      const slots = generateTimeSlots(
        workDay.start,
        workDay.end,
        appointmentsWithReschedules || [],
        serviceDuration,
        dateString,
        lunchBreakStart,
        lunchBreakEnd,
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
    lunchBreakStart?: string | null,
    lunchBreakEnd?: string | null,
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

  const handleMonthChange = (direction: 'prev' | 'next') => {
    setCurrentMonth((prevMonth) => {
      const newMonth = new Date(prevMonth);
      newMonth.setMonth(prevMonth.getMonth() + (direction === 'next' ? 1 : -1));
      return newMonth;
    });
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setCurrentMonth(date);
  };

  return (
    <ScreenContainer 
      scroll={true}
      hasHeader={true}
      hasTabBar={true}
      backgroundColor="#FAFAFA"
      header={
        <AppHeader
          showBackButton={true}
          onPressBack={() => safeGoBack('/(client)/home')}
        />
      }
      footer={selectedTime ? (
        <View style={styles.footerContainer}>
          <CustomButton
            compact
            title="Continuar"
            onPress={handleContinue}
            variant="primary"
            accessibilityLabel="Continuar para confirmação do agendamento"
            accessibilityHint="Toque para continuar e confirmar o agendamento"
          />
        </View>
      ) : undefined}
    >
      <Text style={styles.sectionTitle}>Próximos agendamentos</Text>

      {/* Calendar */}
      <MonthCalendar
        key={calendarResetKey}
        currentMonth={currentMonth}
        onMonthChange={handleMonthChange}
        selectedDate={selectedDate}
        onSelectDate={handleDateSelect}
        markedDates={[]}
      />

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
    </ScreenContainer>
  );
};

export default ScheduleTimeScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    padding: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#E5102E',
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
  footerContainer: {
    backgroundColor: '#FEFEFE',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
});
