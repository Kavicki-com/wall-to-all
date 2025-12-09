import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../../../lib/supabase';
import { MerchantTopBar } from '../../../../components/MerchantTopBar';
import { IconDateRange, IconTimer } from '../../../../lib/icons';
import { MaterialIcons } from '@expo/vector-icons';

type Appointment = {
  id: string;
  business_id: string;
  service_id: string;
  appointment_date: string;
  appointment_time: string;
  business: {
    id: string;
    business_name: string;
    work_days: Record<string, { start: string; end: string; active?: boolean }>;
  };
  service: {
    id: string;
    name: string;
    duration_minutes: number;
  };
};

type TimeSlot = {
  time: string;
  available: boolean;
  type: 'available' | 'occupied' | 'lunch';
};

const MerchantRescheduleScreen: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ appointmentId: string; justification?: string }>();
  const [loading, setLoading] = useState(true);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [availableDates, setAvailableDates] = useState<Date[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [showMoreDates, setShowMoreDates] = useState(false);
  const [showMoreTimes, setShowMoreTimes] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadAppointmentData();
  }, []);

  useEffect(() => {
    if (selectedDate && appointment) {
      loadAvailableTimes();
    } else {
      setTimeSlots([]);
      setSelectedTime(null);
    }
  }, [selectedDate, appointment]);

  const loadAppointmentData = async () => {
    try {
      setLoading(true);

      if (!params.appointmentId) {
        console.error('ID do agendamento não fornecido');
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

      const { data: businessData } = await supabase
        .from('business_profiles')
        .select('id')
        .eq('owner_id', user.id)
        .single();

      if (!businessData) {
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
        .eq('id', params.appointmentId)
        .eq('business_id', businessData.id)
        .single();

      if (error || !appointmentData) {
        console.error('Erro ao buscar agendamento:', error);
        router.replace('/(merchant)/dashboard');
        return;
      }

      setAppointment(appointmentData as Appointment);
      generateAvailableDates(appointmentData as Appointment);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      router.replace('/(merchant)/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const generateAvailableDates = (apt: Appointment) => {
    const dates: Date[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 1; i <= 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date);
    }

    setAvailableDates(dates);
  };

  const loadAvailableTimes = async () => {
    if (!selectedDate || !appointment) return;

    try {
      setLoading(true);
      const dateString = selectedDate.toISOString().split('T')[0];

      const workDays = appointment.business.work_days;
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
      const workDay = workDays[dayName];

      if (!workDay) {
        setTimeSlots([]);
        setLoading(false);
        return;
      }

      const { data: existingAppointments } = await supabase
        .from('appointments')
        .select('appointment_time')
        .eq('business_id', appointment.business_id)
        .eq('appointment_date', dateString)
        .in('status', ['pending', 'confirmed', 'rescheduled'])
        .neq('id', params.appointmentId);

      const serviceDuration = appointment.service.duration_minutes || 60;
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
    existingAppointments: Array<{ appointment_time: string }>,
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

      let type: 'available' | 'occupied' | 'lunch' = 'available';
      const slotStart = new Date(`${dateString}T${timeString}:00`);
      const slotEnd = new Date(`${dateString}T${slotEndTime}:00`);

      const isOccupied = existingAppointments.some((apt) => {
        const aptTime = apt.appointment_time.split(':');
        const aptStart = new Date(`${dateString}T${aptTime[0]}:${aptTime[1]}:00`);
        const aptEnd = new Date(aptStart);
        aptEnd.setMinutes(aptEnd.getMinutes() + serviceDuration);
        return (
          (slotStart >= aptStart && slotStart < aptEnd) ||
          (slotEnd > aptStart && slotEnd <= aptEnd) ||
          (slotStart <= aptStart && slotEnd >= aptEnd)
        );
      });

      if (isOccupied) {
        type = 'occupied';
      }

      if (type === 'available' && currentHour + Math.ceil(serviceDuration / 60) > endHour) {
        type = 'occupied';
      }

      slots.push({ time: timeString, available: type === 'available', type });

      currentHour += 1;
    }

    return slots;
  };

  const formatDate = (date: Date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}`;
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setSelectedTime(null);
  };

  const handleTimeSelect = (time: string) => {
    const slot = timeSlots.find((s) => s.time === time);
    if (slot?.available) {
      setSelectedTime(time);
    }
  };

  const handleSuggestNewTime = async () => {
    if (!selectedDate || !selectedTime || !appointment) return;

    try {
      setSubmitting(true);

      const dateString = selectedDate.toISOString().split('T')[0];
      const [hours, minutes] = selectedTime.split(':').map(Number);
      const newTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;

      const { error } = await supabase
        .from('appointments')
        .update({
          appointment_date: dateString,
          appointment_time: newTime,
          status: 'rescheduled',
        })
        .eq('id', params.appointmentId);

      if (error) {
        console.error('Erro ao reagendar:', error);
        return;
      }

      router.back();
    } catch (error) {
      console.error('Erro ao sugerir novo horário:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const displayedDates = showMoreDates ? availableDates : availableDates.slice(0, 4);
  const availableTimeSlots = timeSlots.filter((slot) => slot.available && slot.type === 'available');
  const displayedTimes = showMoreTimes
    ? availableTimeSlots
    : availableTimeSlots.slice(0, 6);

  if (loading && !appointment) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#000E3D" />
      </View>
    );
  }

  if (!appointment) {
    return null;
  }

  return (
    <View style={styles.container}>
      <MerchantTopBar showBack onBackPress={() => router.back()} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <Text style={styles.mainTitle}>Selecione o Melhor dia e horario</Text>

          {/* Date Selection */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <IconDateRange size={24} color="#E5102E" />
              <Text style={styles.sectionTitle}>Escolha uma data</Text>
            </View>

            <View style={styles.dateGrid}>
              {displayedDates.map((date, index) => {
                const isSelected = selectedDate?.getTime() === date.getTime();
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.dateButton,
                      isSelected ? styles.dateButtonSelected : styles.dateButtonUnselected,
                    ]}
                    onPress={() => handleDateSelect(date)}
                  >
                    <Text
                      style={[
                        styles.dateButtonText,
                        isSelected ? styles.dateButtonTextSelected : styles.dateButtonTextUnselected,
                      ]}
                    >
                      {formatDate(date)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {availableDates.length > 4 && (
              <TouchableOpacity
                style={styles.seeMoreButton}
                onPress={() => setShowMoreDates(!showMoreDates)}
              >
                <Text style={styles.seeMoreText}>
                  {showMoreDates ? 'Ver menos datas' : 'Ver mais datas'}
                </Text>
                <MaterialIcons
                  name={showMoreDates ? 'keyboard-arrow-up' : 'keyboard-arrow-right'}
                  size={24}
                  color="#A8BDFF"
                />
              </TouchableOpacity>
            )}
          </View>

          {/* Time Selection */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <IconTimer size={24} color="#E5102E" />
              <Text style={styles.sectionTitle}>Escolha um horário</Text>
            </View>

            {!selectedDate ? (
              <Text style={styles.emptyMessage}>Selecione uma data primeiro</Text>
            ) : loading ? (
              <ActivityIndicator size="small" color="#000E3D" style={styles.loader} />
            ) : availableTimeSlots.length === 0 ? (
              <Text style={styles.emptyMessage}>Nenhum horário disponível para esta data</Text>
            ) : (
              <>
                <View style={styles.timeGrid}>
                  {displayedTimes.map((slot, index) => {
                    const isSelected = selectedTime === slot.time;
                    return (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.timeButton,
                          isSelected ? styles.timeButtonSelected : styles.timeButtonUnselected,
                        ]}
                        onPress={() => handleTimeSelect(slot.time)}
                        disabled={!slot.available}
                      >
                        <Text
                          style={[
                            styles.timeButtonText,
                            isSelected
                              ? styles.timeButtonTextSelected
                              : styles.timeButtonTextUnselected,
                          ]}
                        >
                          {slot.time}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {availableTimeSlots.length > 6 && (
                  <TouchableOpacity
                    style={styles.seeMoreButton}
                    onPress={() => setShowMoreTimes(!showMoreTimes)}
                  >
                    <Text style={styles.seeMoreText}>
                      {showMoreTimes ? 'Ver menos horários' : 'Ver mais horários'}
                    </Text>
                    <MaterialIcons
                      name={showMoreTimes ? 'keyboard-arrow-up' : 'keyboard-arrow-right'}
                      size={24}
                      color="#A8BDFF"
                    />
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>

          {/* Suggest Button */}
          <TouchableOpacity
            style={[
              styles.suggestButton,
              (!selectedDate || !selectedTime) && styles.suggestButtonDisabled,
            ]}
            onPress={handleSuggestNewTime}
            disabled={!selectedDate || !selectedTime || submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FEFEFE" />
            ) : (
              <>
                <Text style={styles.suggestButtonText}>Sugerir novo horário</Text>
                <MaterialIcons name="schedule" size={24} color="#FEFEFE" />
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

export default MerchantRescheduleScreen;

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
    paddingBottom: 100,
  },
  content: {
    padding: 24,
    paddingTop: 0,
    gap: 24,
  },
  mainTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#0F0F0F',
    marginBottom: 24,
    width: '100%',
  },
  section: {
    gap: 16,
    backgroundColor: '#FAFAFA',
    paddingVertical: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 22,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#E5102E',
  },
  dateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 27,
    width: '100%',
  },
  dateButton: {
    paddingTop: 4,
    paddingBottom: 4,
    paddingHorizontal: 0,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
    flex: 1,
    minWidth: 0,
    borderRadius: 8,
    maxWidth: '48%',
  },
  dateButtonSelected: {
    backgroundColor: '#000E3D',
  },
  dateButtonUnselected: {
    backgroundColor: '#EBEFFF',
  },
  dateButtonText: {
    fontSize: 24,
    fontFamily: 'Montserrat_700Bold',
    textAlign: 'center',
    width: '100%',
  },
  dateButtonTextSelected: {
    color: '#FEFEFE',
  },
  dateButtonTextUnselected: {
    color: '#000E3D',
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 27,
    width: '100%',
  },
  timeButton: {
    flex: 1,
    minWidth: '45%',
    maxWidth: '48%',
    paddingVertical: 4,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeButtonSelected: {
    backgroundColor: '#000E3D',
  },
  timeButtonUnselected: {
    backgroundColor: '#EBEFFF',
  },
  timeButtonText: {
    fontSize: 24,
    fontFamily: 'Montserrat_700Bold',
    textAlign: 'center',
  },
  timeButtonTextSelected: {
    color: '#FEFEFE',
  },
  timeButtonTextUnselected: {
    color: '#000E3D',
  },
  seeMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 24,
  },
  seeMoreText: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#A8BDFF',
  },
  suggestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#000E3D',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 24,
    shadowColor: '#1D1D1D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.24,
    shadowRadius: 8,
    elevation: 4,
  },
  suggestButtonDisabled: {
    opacity: 0.5,
  },
  suggestButtonText: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#FEFEFE',
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
});

