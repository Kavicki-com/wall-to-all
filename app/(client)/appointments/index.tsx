import React, { useEffect, useMemo, useState } from 'react';
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
import { format } from 'date-fns';
import AppHeader from '../../../components/layout/AppHeader';
import ScreenContainer from '../../../components/layout/ScreenContainer';
import { safeGoBack } from '../../../lib/router-utils';
import MonthCalendar from '../../../components/calendar/MonthCalendar';
import AppointmentDaySection from '../../../components/appointments/AppointmentDaySection';
import AppointmentCard from '../../../components/appointments/AppointmentCard';
import { applyAcceptedReschedules } from '../../../lib/utils';

type AppointmentService = {
  id: string;
  name: string;
  price: number;
  photos: string[] | string | null;
};

type AppointmentBusiness = {
  id: string;
  business_name: string;
  logo_url: string | null;
};

type RawAppointment = {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  payment_method: string;
  service: AppointmentService | AppointmentService[];
  business: AppointmentBusiness | AppointmentBusiness[];
  hasPendingReschedule?: boolean;
};

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
  hasPendingReschedule?: boolean;
};

const normalizeAppointment = (appointment: RawAppointment): Appointment => ({
  ...appointment,
  service: Array.isArray(appointment.service) ? appointment.service[0] : appointment.service,
  business: Array.isArray(appointment.business) ? appointment.business[0] : appointment.business,
});

const normalizeAppointmentsList = (items: RawAppointment[] = []) =>
  items.map(normalizeAppointment);

const ClientAppointmentsScreen: React.FC = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const PAGE_SIZE = 50; // Carregar 50 appointments por vez
  
  // Usar ref para evitar que mudanças em page recriem loadAppointments
  const pageRef = React.useRef(0);

  // Criar uma chave baseada nos horários dos agendamentos para detectar mudanças
  const appointmentsKey = useMemo(() => {
    return appointments.map(apt => `${apt.id}-${apt.start_time}-${apt.end_time}`).join('|');
  }, [appointments]);

  const loadAppointments = React.useCallback(async (reset = false) => {
    try {
      if (reset) {
        setLoading(true);
        setHasMore(true);
        pageRef.current = 0;
      } else {
        setLoadingMore(true);
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        console.log('Usuário não autenticado');
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
        return;
      }

      // Para reset, buscar todos os agendamentos (sem paginação)
      // Para loadMore, usar paginação
      let appointmentsData;
      let error;
      
      if (reset) {
        // Buscar todos os agendamentos quando for reset (ordenado por data, mais recentes primeiro)
        const result = await supabase
          .from('appointments')
          .select(
            `
            id, start_time, end_time, status, payment_method,
            service:services(id, name, price, photos),
            business:business_profiles(id, business_name, logo_url)
          `,
          )
          .eq('client_id', user.id)
          .order('start_time', { ascending: false })
          .limit(1000); // Limite alto para garantir que todos sejam carregados
        
        appointmentsData = result.data;
        error = result.error;
      } else {
        // Usar paginação apenas para loadMore
        const currentPage = pageRef.current;
        const from = currentPage * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        
        const result = await supabase
          .from('appointments')
          .select(
            `
            id, start_time, end_time, status, payment_method,
            service:services(id, name, price, photos),
            business:business_profiles(id, business_name, logo_url)
          `,
          )
          .eq('client_id', user.id)
          .order('start_time', { ascending: false })
          .range(from, to);
        
        appointmentsData = result.data;
        error = result.error;
      }

      if (error) {
        console.error('Erro ao buscar agendamentos:', error);
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
        return;
      }

      if (appointmentsData) {
        // Aplicar reagendamentos aceitos aos agendamentos primeiro
        const appointmentsWithAcceptedReschedules = await applyAcceptedReschedules(appointmentsData);
        
        // Buscar reagendamentos pendentes criados pelo cliente para cada agendamento
        const appointmentIds = appointmentsWithAcceptedReschedules.map(apt => apt.id);
        
        if (appointmentIds.length > 0) {
          const { data: pendingReschedules } = await supabase
            .from('appointment_reschedules')
            .select('appointment_id')
            .in('appointment_id', appointmentIds)
            .eq('status', 'pending')
            .eq('requested_by_type', 'client');

          // Criar um Set com IDs de agendamentos que têm reagendamento pendente
          // Converter ambos para string para garantir comparação correta
          const pendingRescheduleAppointmentIds = new Set(
            (pendingReschedules || []).map(r => String(r.appointment_id))
          );

          // Adicionar flag hasPendingReschedule para cada agendamento
          const appointmentsWithReschedule = appointmentsWithAcceptedReschedules.map(apt => ({
            ...apt,
            hasPendingReschedule: pendingRescheduleAppointmentIds.has(String(apt.id)),
          }));

          const normalizedAppointments = normalizeAppointmentsList(
            appointmentsWithReschedule as RawAppointment[],
          );

          if (reset) {
            setAppointments(normalizedAppointments);
            pageRef.current = 1;
          } else {
            const nextPage = pageRef.current + 1;
            setAppointments((prev) => [...prev, ...normalizedAppointments]);
            pageRef.current = nextPage;
          }
        } else {
          const normalizedAppointments = normalizeAppointmentsList(
            appointmentsWithAcceptedReschedules as RawAppointment[],
          );

          if (reset) {
            setAppointments(normalizedAppointments);
            pageRef.current = 1;
          } else {
            const nextPage = pageRef.current + 1;
            setAppointments((prev) => [...prev, ...normalizedAppointments]);
            pageRef.current = nextPage;
          }
        }
        
        // Verificar se há mais dados para carregar (apenas para paginação)
        if (!reset) {
          setHasMore(appointmentsData.length === PAGE_SIZE);
        } else {
          // Se foi reset, não há mais para carregar (já trouxe tudo)
          setHasMore(false);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar agendamentos:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [PAGE_SIZE]);

  const loadMoreAppointments = React.useCallback(() => {
    if (!loadingMore && hasMore) {
      loadAppointments(false);
    }
  }, [loadingMore, hasMore, loadAppointments]);

  // Recarregar agendamentos quando a tela receber foco (voltar de outras telas)
  // Isso garante que os dados sejam atualizados quando o usuário aceita um reagendamento
  useFocusEffect(
    React.useCallback(() => {
      // Não resetar a data selecionada, apenas recarregar os dados
      // Isso permite que o usuário veja a data atualizada se foi alterada
      loadAppointments(true);
    }, [loadAppointments])
  );

  useEffect(() => {
    loadAppointments(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Quando os agendamentos mudarem (incluindo mudanças nos horários), atualizar a data selecionada
    if (appointments.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const currentSelectedString = selectedDate.toISOString().split('T')[0];
      
      // Verificar se há agendamentos na data selecionada
      const hasSelectedDateAppointments = appointments.some((apt) => {
        const aptDate = new Date(apt.start_time);
        aptDate.setHours(0, 0, 0, 0);
        return aptDate.toISOString().split('T')[0] === currentSelectedString;
      });
      
      // Se não há agendamentos na data selecionada, encontrar a próxima data com agendamentos
      if (!hasSelectedDateAppointments) {
        // Ordenar por start_time descendente (mais recentes primeiro) para priorizar agendamentos futuros
        const sortedAppointments = [...appointments].sort((a, b) => 
          new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
        );
        
        // Primeiro tentar encontrar um agendamento futuro
        const todayString = today.toISOString().split('T')[0];
        const futureAppointment = sortedAppointments.find((apt) => {
          const aptDate = new Date(apt.start_time);
          aptDate.setHours(0, 0, 0, 0);
          return aptDate.toISOString().split('T')[0] >= todayString;
        });
        
        // Se não houver futuro, pegar o mais recente (pode ser passado)
        const appointmentToShow = futureAppointment || sortedAppointments[0];
        
        if (appointmentToShow) {
          const appointmentDate = new Date(appointmentToShow.start_time);
          appointmentDate.setHours(0, 0, 0, 0);
          
          // Atualizar para a data do agendamento
          setSelectedDate(appointmentDate);
          setCurrentMonth(appointmentDate);
        }
      }
      // Se há agendamentos na data selecionada, não fazer nada (manter a seleção atual)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointmentsKey]);

  const onRefresh = () => {
    setRefreshing(true);
    loadAppointments(true);
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

  const getFilteredAppointments = () => {
    const dateString = selectedDate.toISOString().split('T')[0];
    return appointments.filter((apt) => {
      const aptDate = new Date(apt.start_time);
      const aptDateString = aptDate.toISOString().split('T')[0];
      return aptDateString === dateString;
    });
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

  const markedDates = useMemo(
    () => appointments.map((apt) => format(new Date(apt.start_time), 'yyyy-MM-dd')),
    [appointments],
  );
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E5102E" />
      </View>
    );
  }

  return (
    <ScreenContainer 
      scroll={true}
      hasHeader={true}
      backgroundColor="#FAFAFA"
      contentContainerStyle={styles.scrollContent}
      header={
        <AppHeader 
          showBackButton={true} 
          onPressBack={() => safeGoBack('/(client)/home')}
        />
      }
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      footer={
        <View style={styles.footerContainer}>
          <TouchableOpacity
            style={styles.scheduleButton}
            activeOpacity={0.8}
            onPress={() => router.push('/(client)/home')}
          >
            <Text style={styles.scheduleButtonText}>Agendar serviços</Text>
          </TouchableOpacity>
        </View>
      }
    >
      <Text style={styles.sectionTitle}>Próximos agendamentos</Text>

      {/* Calendar */}
      <MonthCalendar
        key={0}
        currentMonth={currentMonth}
        onMonthChange={handleMonthChange}
        selectedDate={selectedDate}
        onSelectDate={handleDateSelect}
        markedDates={markedDates}
      />

      {/* Appointments List */}
      {(() => {
        const filteredAppointments = getFilteredAppointments();
        const hasPendingReschedule = filteredAppointments.some(
          (apt) => apt.hasPendingReschedule === true
        );

        return (
          <AppointmentDaySection
            dateLabel={formatSelectedDate()}
            isToday={isToday(selectedDate)}
            statusLabel={hasPendingReschedule ? 'Reagendamento Pendente' : undefined}
            hasAppointments={filteredAppointments.length > 0}
          >
            {filteredAppointments.map((appointment) => {
              const startDate = new Date(appointment.start_time);
              const time = startDate.toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              });
              const dateLabel = `Data ${startDate.toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: '2-digit',
              })}`;

              return (
                <AppointmentCard
                  key={appointment.id}
                  time={time}
                  dateLabel={dateLabel}
                  serviceName={appointment.service?.name || 'Serviço'}
                  shopName={appointment.business?.business_name || 'Estabelecimento'}
                  showShopName={true}
                  onPress={() => {
                    router.push(`/(client)/appointments/${appointment.id}`);
                  }}
                />
              );
            })}
          </AppointmentDaySection>
        );
      })()}

      {/* Botão Carregar Mais */}
      {hasMore && (
        <View style={styles.loadMoreContainer}>
          <TouchableOpacity
            style={styles.loadMoreButton}
            onPress={loadMoreAppointments}
            disabled={loadingMore}
          >
            {loadingMore ? (
              <ActivityIndicator size="small" color="#000E3D" />
            ) : (
              <Text style={styles.loadMoreText}>Carregar mais agendamentos</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </ScreenContainer>
  );
};

export default ClientAppointmentsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#E5102E',
    marginBottom: 16,
  },
  footerContainer: {
    backgroundColor: '#FEFEFE',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  scheduleButton: {
    borderWidth: 1,
    borderColor: '#000E3D',
    borderRadius: 24,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleButtonText: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#000E3D',
  },
  loadMoreContainer: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  loadMoreButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#000E3D',
    backgroundColor: '#FEFEFE',
    minWidth: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreText: {
    fontSize: 14,
    fontFamily: 'Montserrat_700Bold',
    color: '#000E3D',
  },
});
