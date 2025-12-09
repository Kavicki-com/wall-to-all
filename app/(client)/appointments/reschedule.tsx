import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
  Modal,
  Image,
  TouchableWithoutFeedback,
  Platform,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { IconDateRange, IconTimer, IconSchedule, IconPix, IconCheckCircle } from '../../../lib/icons';
import { MaterialIcons } from '@expo/vector-icons';
import { MerchantTopBar } from '../../../components/MerchantTopBar';

type Appointment = {
  id: string;
  business_id: string;
  service_id: string;
  start_time: string;
  end_time: string;
  payment_method?: string;
  reschedule_justification?: string | null;
  business: {
    id: string;
    business_name: string;
    work_days: Record<string, { start: string; end: string; active?: boolean }>;
    logo_url?: string | null;
    address?: string | null;
  };
  service: {
    id: string;
    name: string;
    duration_minutes: number;
    price?: number;
  };
};

type TimeSlot = {
  time: string;
  available: boolean;
  type: 'available' | 'occupied' | 'lunch';
};

const RescheduleAppointmentScreen: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ appointmentId: string; reason?: string }>();
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = useWindowDimensions();
  const [loading, setLoading] = useState(true);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [availableDates, setAvailableDates] = useState<Date[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [showMoreDates, setShowMoreDates] = useState(false);
  const [showMoreTimes, setShowMoreTimes] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [justification, setJustification] = useState(params.reason || '');

  // Recarregar dados sempre que o agendamento ou a justificativa nos params mudar.
  // Isso evita manter dados do agendamento anterior quando o usuário abre a tela
  // novamente a partir de outro agendamento.
  useEffect(() => {
    loadAppointmentData();
  }, [params.appointmentId, params.reason]);

  useEffect(() => {
    if (selectedDate && appointment) {
      loadAvailableTimes();
    } else {
      // Limpar horários quando não há data selecionada
      setTimeSlots([]);
      setSelectedTime(null);
    }
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
        setShowRescheduleModal(false);
        setShowConfirmationModal(false);
      } else {
        // Se tem reason, é porque veio da tela anterior com justificativa
        // Manter o reason mas resetar seleções
        setSelectedDate(null);
        setSelectedTime(null);
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
        console.error('Usuário não autenticado');
        router.replace('/(client)/appointments');
        return;
      }

      if (!params.appointmentId) {
        console.error('ID do agendamento não fornecido');
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
        console.error('Erro ao buscar agendamento:', error);
        router.replace('/(client)/appointments');
        return;
      }

      setAppointment(appointmentData as Appointment);
      generateAvailableDates(appointmentData as Appointment);
      
      // Carregar justificativa apenas se vier nos params (da tela anterior)
      // Não carregar justificativa de processos anteriores para evitar histórico
      if (params.reason) {
        setJustification(params.reason);
      } else {
        // Se não há reason nos params, garantir que está vazio
        setJustification('');
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      router.replace('/(client)/appointments');
    } finally {
      setLoading(false);
    }
  };

  const generateAvailableDates = (apt: Appointment) => {
    const dates: Date[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const workDays = apt.business.work_days;
    
    // Se não houver work_days, retornar array vazio
    if (!workDays) {
      setAvailableDates([]);
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

    // Gerar próximas datas, filtrando apenas dias que o negócio funciona
    // Se o dia existe no work_days, significa que está ativo
    // Limitar a busca a 60 dias para evitar loop infinito
    let daysChecked = 0;
    const maxDaysToCheck = 60;
    
    for (let i = 1; dates.length < 30 && daysChecked < maxDaysToCheck; i++) {
      daysChecked++;
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dayName = dayNames[date.getDay()];
      const workDay = workDays[dayName];

      // Se o dia existe no work_days, está ativo (não há propriedade 'active')
      if (workDay) {
        dates.push(date);
      }
    }

    setAvailableDates(dates);
    // Não selecionar data automaticamente - deixar usuário escolher
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

      // Buscar appointments existentes para esta data
      const { data: existingAppointments } = await supabase
        .from('appointments')
        .select('start_time, end_time')
        .eq('business_id', appointment.business_id)
        .gte('start_time', `${dateString}T00:00:00`)
        .lt('start_time', `${dateString}T23:59:59`)
        .in('status', ['pending', 'confirmed'])
        .neq('id', params.appointmentId); // Excluir o agendamento atual

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

      let type: 'available' | 'occupied' | 'lunch' = 'available';
      const slotStart = new Date(`${dateString}T${timeString}:00`);
      const slotEnd = new Date(`${dateString}T${slotEndTime}:00`);

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

  const handleSuggestNewTime = () => {
    if (!selectedDate || !selectedTime || !appointment) return;
    setShowRescheduleModal(true);
  };

  const handleSubmitReschedule = async () => {
    if (!selectedDate || !selectedTime || !appointment) return;

    try {
      // Obter usuário autenticado
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        console.error('Usuário não autenticado');
        return;
      }

      const [hours, minutes] = selectedTime.split(':').map(Number);
      const newStartTime = new Date(selectedDate);
      newStartTime.setHours(hours, minutes, 0, 0);

      const newEndTime = new Date(newStartTime);
      newEndTime.setMinutes(newEndTime.getMinutes() + appointment.service.duration_minutes);

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
        console.error('Erro ao criar solicitação de reagendamento:', rescheduleError);
        Alert.alert('Erro', 'Não foi possível solicitar o reagendamento. Tente novamente.');
        return;
      }

      // Atualizar status do agendamento para indicar que há um reagendamento pendente
      // Mantém os horários originais até ser aceito
      const { error: updateError } = await supabase
        .from('appointments')
        .update({
          reschedule_justification: justification || params.reason || null,
          status: 'pending', // Status indica que precisa de confirmação
        })
        .eq('id', params.appointmentId);

      if (updateError) {
        console.error('Erro ao atualizar agendamento:', updateError);
        // Se falhar, tentar remover o registro de reagendamento criado
        await supabase
          .from('appointment_reschedules')
          .delete()
          .eq('id', rescheduleData.id);
        Alert.alert('Erro', 'Não foi possível processar o reagendamento. Tente novamente.');
        return;
      }

      // Resetar campos após sucesso antes de mostrar o modal
      setJustification('');
      setSelectedDate(null);
      setSelectedTime(null);
      setShowRescheduleModal(false);
      setShowConfirmationModal(true);
    } catch (error) {
      console.error('Erro ao sugerir novo horário:', error);
      Alert.alert('Erro', 'Ocorreu um erro ao processar o reagendamento.');
    }
  };

  const formatDateLong = (date: Date) => {
    const months = [
      'Janeiro',
      'Fevereiro',
      'Março',
      'Abril',
      'Maio',
      'Junho',
      'Julho',
      'Agosto',
      'Setembro',
      'Outubro',
      'Novembro',
      'Dezembro',
    ];
    return `${date.getDate()} de ${months[date.getMonth()]}`;
  };

  // Calcular largura dos cards de data e horário para grid 2x3 (2 colunas, 3 linhas - 3 de cada lado)
  // ⚠️ IMPORTANTE: Recalcular TODAS as constantes derivadas dentro do useMemo
  // para garantir que dependam apenas de SCREEN_WIDTH e SCREEN_HEIGHT
  const styles = useMemo(() => {
    const CONTENT_PADDING = 24 * 2; // Padding horizontal total (24 de cada lado)
    const DATE_GRID_GAP = 27; // Gap entre os botões de data
    const DATE_BUTTON_WIDTH = (SCREEN_WIDTH - CONTENT_PADDING - DATE_GRID_GAP) / 2;
    const TIME_BUTTON_WIDTH = DATE_BUTTON_WIDTH; // Mesma largura dos cards de data

    return StyleSheet.create({
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
        paddingHorizontal: 24,
        paddingVertical: 16,
        position: 'relative',
      },
      topBarGradientContainer: {
        ...StyleSheet.absoluteFillObject,
      },
      topBarGradientOverlay: {
        ...StyleSheet.absoluteFillObject,
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
      scrollView: {
        flex: 1,
      },
      scrollContent: {
        paddingBottom: 100,
      },
      content: {
        padding: 24,
        gap: 24,
      },
      mainTitle: {
        fontSize: 16,
        fontFamily: 'Montserrat_700Bold',
        color: '#000000',
        marginBottom: 0,
      },
      section: {
        gap: 16,
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
        width: DATE_BUTTON_WIDTH,
        paddingVertical: 4,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
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
        width: TIME_BUTTON_WIDTH,
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
        alignSelf: 'center',
        marginTop: 0,
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
        paddingTop: 24,
        paddingHorizontal: 24,
        paddingBottom: 40,
        maxHeight: SCREEN_HEIGHT * 0.9,
        width: '100%',
        ...Platform.select({
          ios: {
            shadowColor: '#1D1D1D',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.16,
            shadowRadius: 16,
          },
          android: {
            elevation: 16,
          },
        }),
      },
      modalScrollView: {
        maxHeight: SCREEN_HEIGHT * 0.8,
      },
      modalScrollContent: {
        gap: 24,
        paddingBottom: 24,
      },
      modalHeading: {
        gap: 8,
      },
      modalHeadingContent: {
        gap: 8,
      },
      modalRescheduleLabel: {
        fontSize: 16,
        fontFamily: 'Montserrat_700Bold',
        color: '#E5102E',
      },
      modalServiceName: {
        fontSize: 20,
        fontFamily: 'Montserrat_700Bold',
        color: '#0F0F0F',
      },
      currentAppointmentCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        backgroundColor: '#EBEFFF',
        borderWidth: 2,
        borderColor: '#000E3D',
        borderRadius: 24,
        padding: 16,
      },
      currentAppointmentContent: {
        flex: 1,
        gap: 8,
      },
      currentAppointmentDate: {
        fontSize: 16,
        fontFamily: 'Montserrat_700Bold',
        color: '#000E3D',
      },
      currentAppointmentTime: {
        fontSize: 16,
        fontFamily: 'Montserrat_700Bold',
        color: '#000E3D',
      },
      modalSection: {
        gap: 8,
      },
      modalSectionLabel: {
        fontSize: 16,
        fontFamily: 'Montserrat_700Bold',
        color: '#E5102E',
      },
      professionalInfo: {
        gap: 8,
      },
      professionalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
      },
      businessLogo: {
        width: 40,
        height: 40,
        borderRadius: 20,
      },
      placeholderLogo: {
        backgroundColor: '#E5E5E5',
      },
      businessName: {
        flex: 1,
        fontSize: 16,
        fontFamily: 'Montserrat_700Bold',
        color: '#000000',
      },
      addressCard: {
        backgroundColor: '#FEFEFE',
        borderRadius: 4,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E5E5E5',
        ...Platform.select({
          ios: {
            shadowColor: '#1D1D1D',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.08,
            shadowRadius: 8,
          },
          android: {
            elevation: 4,
          },
        }),
      },
      addressText: {
        fontSize: 16,
        fontFamily: 'Montserrat_400Regular',
        color: '#000000',
      },
      paymentCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        backgroundColor: '#FEFEFE',
        borderRadius: 24,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E5E5E5',
        ...Platform.select({
          ios: {
            shadowColor: '#1D1D1D',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 8,
          },
          android: {
            elevation: 2,
          },
        }),
      },
      paymentContent: {
        flex: 1,
        gap: 8,
      },
      paymentMethod: {
        fontSize: 16,
        fontFamily: 'Montserrat_700Bold',
        color: '#000000',
      },
      paymentAmount: {
        fontSize: 16,
        fontFamily: 'Montserrat_700Bold',
        color: '#17723F',
      },
      justificationAndButtonContainer: {
        gap: 16,
        width: '100%',
      },
      justificationLabel: {
        fontSize: 16,
        fontFamily: 'Montserrat_700Bold',
        color: '#000000',
      },
      justificationContainer: {
        backgroundColor: '#FEFEFE',
        borderRadius: 8,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E5E5E5',
      },
      justificationText: {
        fontSize: 16,
        fontFamily: 'Montserrat_400Regular',
        color: '#000000',
        lineHeight: 24,
      },
      modalSubmitButton: {
        backgroundColor: '#000E3D',
        borderRadius: 24,
        paddingVertical: 12,
        paddingHorizontal: 16,
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        ...Platform.select({
          ios: {
            shadowColor: '#1D1D1D',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.24,
            shadowRadius: 8,
          },
          android: {
            elevation: 4,
          },
        }),
      },
      modalSubmitButtonText: {
        fontSize: 16,
        fontFamily: 'Montserrat_700Bold',
        color: '#FEFEFE',
      },
      // Confirmation Modal Styles
      confirmationOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
      },
      confirmationModalContainer: {
        backgroundColor: '#FEFEFE',
        borderRadius: 24,
        padding: 16,
        width: '100%',
        maxWidth: 400,
        alignItems: 'center',
        gap: 16,
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
        width: 67,
        height: 67,
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
        width: 256,
      },
      confirmationCloseButton: {
        width: 256,
        backgroundColor: 'transparent',
        borderRadius: 24,
        paddingVertical: 12,
        paddingHorizontal: 16,
        alignItems: 'center',
        justifyContent: 'center',
      },
      confirmationCloseButtonText: {
        fontSize: 16,
        fontFamily: 'Montserrat_700Bold',
        color: '#000E3D',
      },
    });
  }, [SCREEN_WIDTH, SCREEN_HEIGHT]);

  // Sempre exibir 6 datas inicialmente (grid 3x2)
  const displayedDates = showMoreDates ? availableDates : availableDates.slice(0, 6);
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
      <MerchantTopBar
        title="Reagendamento"
        showBack
        onBackPress={() => router.back()}
        fallbackPath="/(client)/home"
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <Text style={styles.mainTitle}>Selecione o Melhor dia e horário</Text>

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

            {availableDates.length > 6 && (
              <TouchableOpacity
                style={styles.seeMoreButton}
                onPress={() => setShowMoreDates(!showMoreDates)}
                disabled
              >
                <Text style={styles.seeMoreText}>Ver mais datas</Text>
                <MaterialIcons name="keyboard-arrow-right" size={24} color="#A8BDFF" />
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
            disabled={!selectedDate || !selectedTime}
          >
            <Text style={styles.suggestButtonText}>Sugerir novo horário</Text>
            <IconSchedule size={24} color="#FEFEFE" />
          </TouchableOpacity>
        </View>
      </ScrollView>

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
            <View style={styles.modalContent}>
                <ScrollView
                  style={styles.modalScrollView}
                  contentContainerStyle={styles.modalScrollContent}
                  showsVerticalScrollIndicator={false}
                >
                  {/* Heading */}
                  <View style={styles.modalHeading}>
                    <View style={styles.modalHeadingContent}>
                      <Text style={styles.modalRescheduleLabel}>Reagendamento</Text>
                      <Text style={styles.modalServiceName}>
                        {appointment?.service.name || 'Serviço'}
                      </Text>
                    </View>

                    {/* New Appointment Card */}
                    {selectedDate && selectedTime && (
                      <View style={styles.currentAppointmentCard}>
                        <IconDateRange size={24} color="#000E3D" />
                        <View style={styles.currentAppointmentContent}>
                          <Text style={styles.currentAppointmentDate}>
                            {formatDateLong(selectedDate)}
                          </Text>
                          <Text style={styles.currentAppointmentTime}>
                            {(() => {
                              if (!appointment) return '';
                              const [hours, minutes] = selectedTime.split(':').map(Number);
                              const endTime = new Date(selectedDate);
                              endTime.setHours(hours, minutes, 0, 0);
                              endTime.setMinutes(
                                endTime.getMinutes() + appointment.service.duration_minutes,
                              );
                              return `${hours}h às ${endTime.getHours()}h`;
                            })()}
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>

                  {/* Professional Info */}
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionLabel}>Profissional:</Text>
                    <View style={styles.professionalInfo}>
                      <View style={styles.professionalHeader}>
                        {appointment?.business.logo_url ? (
                          <Image
                            source={{ uri: appointment.business.logo_url }}
                            style={styles.businessLogo}
                          />
                        ) : (
                          <View style={[styles.businessLogo, styles.placeholderLogo]} />
                        )}
                        <Text style={styles.businessName}>
                          {appointment?.business.business_name || 'Negócio'}
                        </Text>
                      </View>
                      {appointment?.business.address && (
                        <View style={styles.addressCard}>
                          <Text style={styles.addressText}>
                            {appointment.business.address}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Payment Method */}
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionLabel}>Método de pagamento:</Text>
                    <View style={styles.paymentCard}>
                      <IconPix size={24} color="#000E3D" />
                      <View style={styles.paymentContent}>
                        <Text style={styles.paymentMethod}>PIX</Text>
                        <Text style={styles.paymentAmount}>
                          R$ {appointment?.service.price
                            ? appointment.service.price.toFixed(2).replace('.', ',')
                            : '0,00'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Justification and Submit Button Container */}
                  <View style={styles.justificationAndButtonContainer}>
                    <Text style={styles.justificationLabel}>Justificativa</Text>
                    <View style={styles.justificationContainer}>
                      <Text style={styles.justificationText}>
                        {justification || 'Não vou conseguir chegar no horário e gostaria de trocar para o horário seguinte.'}
                      </Text>
                    </View>

                    {/* Submit Button */}
                    <TouchableOpacity
                      style={styles.modalSubmitButton}
                      onPress={handleSubmitReschedule}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.modalSubmitButtonText}>Enviar</Text>
                    </TouchableOpacity>
                  </View>
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
                <View style={styles.confirmationIconContainer}>
                  <IconCheckCircle size={67} color="#17723F" />
                </View>

                {/* Success Text */}
                <Text style={styles.confirmationTitle}>Reagendamento solicitado</Text>

                {/* Message */}
                <Text style={styles.confirmationMessage}>
                  Aguarde o profissional aceitar a sua sugestão
                </Text>

                {/* Close Button */}
                <TouchableOpacity
                  style={styles.confirmationCloseButton}
                  activeOpacity={0.8}
                  onPress={() => {
                    setShowConfirmationModal(false);
                    // Resetar campos antes de navegar
                    setJustification('');
                    setSelectedDate(null);
                    setSelectedTime(null);
                    router.replace(`/(client)/appointments/${params.appointmentId}`);
                  }}
                >
                  <Text style={styles.confirmationCloseButtonText}>Fechar</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

export default RescheduleAppointmentScreen;

