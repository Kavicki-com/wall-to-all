import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ActivityIndicator,
  FlatList,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { applyAcceptedReschedules } from '../../../lib/utils';
import { IconShare } from '../../../lib/icons';
import AppHeader from '../../../components/layout/AppHeader';
import ScreenContainer from '../../../components/layout/ScreenContainer';
import ServiceCategoryCard from '../../../components/ServiceCategoryCard';
import AppointmentCard from '../../../components/appointments/AppointmentCard';
import { CustomButton } from '../../../components/CustomButton';

type BusinessProfile = {
  id: string;
  business_name: string;
  logo_url: string | null;
  description: string | null;
};

type Service = {
  id: string;
  name: string;
  price: number;
  photos: string[] | string | null;
  rating?: number;
  review_count?: number;
  categories?: {
    id: number;
    name: string;
  } | null;
};

type Appointment = {
  id: string;
  start_time: string;
  end_time?: string;
  service: { id: string; name: string } | { id: string; name: string }[];
};

const MerchantHomeScreen: React.FC = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  useEffect(() => {
    loadBusinessAndServices();
  }, []);

  // Recarregar dados quando a tela receber foco (ex: após reagendamento)
  useFocusEffect(
    useCallback(() => {
      loadBusinessAndServices();
    }, [])
  );

  const loadBusinessAndServices = async () => {
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
        .select('id, business_name, logo_url, description')
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
          console.error('Erro ao buscar negócio:', businessError);
        }
        setLoading(false);
        return;
      }

      // Business ID is not used in this component
      setBusinessProfile(businessData as BusinessProfile);

      const { data: servicesData, error: servicesError } = await supabase
        .from('services')
        .select(`
          *,
          categories:category_id (
            id,
            name
          )
        `)
        .eq('business_id', businessData.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(5);

      if (servicesError) {
        console.error('Erro ao buscar serviços:', servicesError);
      } else if (servicesData) {
        // Buscar ratings para serviços
        const servicesWithRatings = await Promise.all(
          (servicesData as Service[]).map(async (service) => {
            const { data: serviceReviews } = await supabase
              .from('reviews')
              .select('rating')
              .eq('service_id', service.id);

            const rating =
              serviceReviews && serviceReviews.length > 0
                ? serviceReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / serviceReviews.length
                : undefined;
            const reviewCount = serviceReviews?.length || undefined;

            return {
              ...service,
              rating,
              review_count: reviewCount,
            };
          })
        );
        setServices(servicesWithRatings);
      }

      // Buscar próximos agendamentos (próximos 3)
      // IMPORTANTE: Buscar um range maior para incluir agendamentos que podem ter sido reagendados
      const today = new Date();
      const extendedEnd = new Date(today);
      extendedEnd.setMonth(extendedEnd.getMonth() + 3); // Buscar até 3 meses à frente
      
      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from('appointments')
        .select(
          `
          id,
          start_time,
          end_time,
          service:services(id, name)
        `,
        )
        .eq('business_id', businessData.id)
        .gte('start_time', today.toISOString())
        .lte('start_time', extendedEnd.toISOString())
        .order('start_time', { ascending: true })
        .limit(50); // Buscar mais para depois filtrar os 3 primeiros após aplicar reagendamentos

      if (appointmentsError) {
        console.error('Erro ao buscar agendamentos do lojista:', appointmentsError);
      } else if (appointmentsData) {
        // Aplicar reagendamentos aceitos aos agendamentos PRIMEIRO
        const appointmentsWithReschedules = await applyAcceptedReschedules(appointmentsData);
        
        // Filtrar apenas agendamentos futuros (após aplicar reagendamentos)
        const futureAppointments = appointmentsWithReschedules
          .filter((apt) => new Date(apt.start_time) >= today);
        
        setAppointments(futureAppointments as Appointment[]);
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
    loadBusinessAndServices();
  };

  const handleShareProfile = () => {
    router.push('/(merchant)/home/share');
  };

  const renderServiceCard = ({ item }: { item: Service }) => (
    <ServiceCategoryCard
      id={item.id}
      name={item.name}
      price={item.price}
      photos={item.photos}
      rating={item.rating}
      reviewCount={item.review_count}
      category={item.categories?.name || null}
      onPress={(id) => router.push(`/(merchant)/services/edit/${id}`)}
    />
  );

  if (loading) {
    return (
      <ScreenContainer scroll={false} backgroundColor="#FAFAFA">
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E5102E" />
          <Text style={styles.loadingText}>Carregando...</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer 
      scroll={true}
      hasHeader={true}
      backgroundColor="#FAFAFA"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      footer={
        <View style={styles.footerContainer}>
          <CustomButton
            title="Cadastrar novo serviço"
            variant="outline"
            onPress={() => router.push('/(merchant)/services/create')}
            style={{ borderRadius: 24, height: 48 }}
            width="100%"
          />
        </View>
      }
      header={<AppHeader showBackButton={false} />}
    >
        {/* Avatar e Nome do Negócio */}
        <View style={styles.avatarSection}>
          {businessProfile?.logo_url ? (
            <Image
              source={{ uri: businessProfile.logo_url }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatar, styles.placeholderAvatar]} />
          )}
          <View style={styles.businessNameContainer}>
            <Text style={styles.businessName}>
              {businessProfile?.business_name || 'Meu Negócio'}
            </Text>
          </View>
        </View>

        {/* Seção Meus Agendamentos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Meus Agendamentos</Text>
          {appointments.length > 0 ? (
            <ScrollView
              nestedScrollEnabled
              scrollEnabled
              showsVerticalScrollIndicator
              style={styles.appointmentsScrollArea}
              contentContainerStyle={styles.appointmentsList}
            >
              {appointments.map((item) => {
                const startDate = new Date(item.start_time);
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
                const serviceName = Array.isArray(item.service)
                  ? item.service[0]?.name
                  : item.service?.name;

                return (
                  <AppointmentCard
                    key={item.id}
                    time={time}
                    dateLabel={dateLabel}
                    serviceName={serviceName || 'Serviço'}
                    showShopName={false}
                    onPress={() => router.push(`/(merchant)/dashboard/appointment/${item.id}`)}
                  />
                );
              })}
            </ScrollView>
          ) : (
            <View style={styles.emptyStateCard}>
              <Text style={styles.emptyStateText}>
                Você ainda não tem nenhum agendamento, divulgue seu perfil para receber mais clientes
              </Text>
            </View>
          )}
          <CustomButton
            title="Compartilhar perfil"
            variant="outline"
            onPress={handleShareProfile}
            rightIcon={<IconShare size={24} color="#000E3D" />}
            style={{ borderRadius: 24 }}
            width="100%"
          />
        </View>

        {/* Seção Meus Serviços */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Meus Serviços</Text>
          {services.length > 0 ? (
            <FlatList
              data={services}
              renderItem={renderServiceCard}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.servicesCarousel}
              initialNumToRender={3}
              maxToRenderPerBatch={5}
              windowSize={5}
              removeClippedSubviews={true}
            />
          ) : (
            <Text style={styles.emptyServicesText}>Nenhum serviço cadastrado</Text>
          )}
        </View>
    </ScreenContainer>
  );
};

export default MerchantHomeScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#000E3D',
  },
  avatarSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  placeholderAvatar: {
    backgroundColor: '#E0E0E0',
  },
  businessNameContainer: {
    flex: 1,
  },
  businessName: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#0F0F0F',
  },
  section: {
    marginBottom: 24,
    gap: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#E5102E',
  },
  appointmentsList: {
    gap: 12,
  },
  appointmentsScrollArea: {
    maxHeight: 360,
  },
  emptyStateCard: {
    backgroundColor: '#FEFEFE',
    borderWidth: 1,
    borderColor: '#DBDBDB',
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 16,
  },
  emptyStateText: {
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#0F0F0F',
    textAlign: 'center',
  },
  servicesCarousel: {
    paddingRight: 24,
  },
  footerContainer: {
    paddingTop: 8,
    backgroundColor: '#FAFAFA',
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  emptyServicesText: {
    fontSize: 14,
    fontFamily: 'Montserrat_400Regular',
    color: '#474747',
    textAlign: 'center',
    marginTop: 16,
  },
});
