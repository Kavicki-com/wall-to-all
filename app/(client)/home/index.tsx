import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { sortCategories } from '../../../lib/categoryUtils';
import { useCardWidth } from '../../../lib/responsive';
import AppHeader from '../../../components/layout/AppHeader';
import { BusinessCard } from '../../../components/BusinessCard';
import ScreenContainer from '../../../components/layout/ScreenContainer';
import ServiceCategoryCard from '../../../components/ServiceCategoryCard';
import AppointmentCard from '../../../components/appointments/AppointmentCard';
import SearchBar from '../../../components/SearchBar';
import { CustomButton } from '../../../components/CustomButton';
import { Chip } from '../../../components/ui/Chip';
import { applyAcceptedReschedules } from '../../../lib/utils';

type Appointment = {
  id: string;
  client_id: string;
  start_time: string;
  service: {
    id: string;
    name: string;
  };
  business: {
    business_name: string;
    logo_url: string | null;
  };
};

type BusinessProfile = {
  id: string;
  business_name: string;
  category: string | null;
  logo_url: string | null;
  banner_url?: string | null;
  description: string | null;
  accepted_payment_methods: {
    pix?: boolean;
    card?: boolean;
    cash?: boolean;
  } | null;
  work_days: Record<string, { start: string; end: string }> | null;
  services?: Array<{ id: string; name: string }>;
  categories?: {
    id: number;
    name: string;
  };
};

type Service = {
  id: string;
  name: string;
  price: number;
  photos: string[] | string | null;
  business_profiles: {
    business_name: string;
  } | null;
  business_id: string;
  rating?: number;
  review_count?: number;
  categories?: {
    id: string;
    name: string;
  } | null;
};

const FEATURED_LIMIT = 10;
const POPULAR_LIMIT = 10;
const CATEGORIES_LIMIT = 50;

const ClientHomeScreen: React.FC = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [allFeaturedBusinesses, setAllFeaturedBusinesses] = useState<BusinessProfile[]>([]);
  const [allPopularServices, setAllPopularServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);

  const businessCardWidth = useCardWidth(1.5, 24, 10);
  const businessGap = 10;

  const serviceCardWidth = useCardWidth(2, 24, 14);
  const serviceGap = 14;

  const buildRatingsMap = (reviews: Array<{ service_id: string; rating: number | null }>) => {
    const map: Record<string, { sum: number; count: number }> = {};
    reviews.forEach((review) => {
      if (!review.service_id) return;
      if (!map[review.service_id]) {
        map[review.service_id] = { sum: 0, count: 0 };
      }
      map[review.service_id].sum += review.rating || 0;
      map[review.service_id].count += 1;
    });
    return map;
  };

  const loadData = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) {
        setLoading(true);
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        console.log('Usuário não autenticado');
        setLoading(false);
        return;
      }

      const [
        { data: appointmentsData, error: appointmentsError },
        { data: businessesData, error: businessesError },
        { data: servicesData, error: servicesError },
        { data: categoriesData, error: categoriesError },
      ] = await Promise.all([
        supabase
          .from('appointments')
          .select('*, service:services(id, name), business:business_profiles(business_name, logo_url)')
          .eq('client_id', user.id)
          .order('start_time', { ascending: true })
          .gte('start_time', new Date().toISOString()),
        supabase
          .from('business_profiles')
          .select(`
            *,
            categories:category_id (
              id,
              name
            ),
            services (
              id,
              name
            )
          `)
          .range(0, FEATURED_LIMIT - 1),
        supabase
          .from('services')
          .select(`
            *,
            categories:category_id (
              id,
              name
            ),
            business_profiles(business_name)
          `)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .range(0, POPULAR_LIMIT - 1),
        supabase
          .from('categories')
          .select('id, name')
          .order('name', { ascending: true })
          .range(0, CATEGORIES_LIMIT - 1),
      ]);

      if (appointmentsError) {
        console.error('Erro ao buscar agendamentos:', appointmentsError);
      } else if (appointmentsData) {
        const appointmentsWithReschedules = await applyAcceptedReschedules(appointmentsData);
        setAppointments(appointmentsWithReschedules as Appointment[]);
      }

      if (businessesError) {
        console.error('Erro ao buscar lojas em destaque:', businessesError);
      } else if (businessesData) {
        setAllFeaturedBusinesses(businessesData as BusinessProfile[]);
      }

      if (servicesError) {
        console.error('Erro ao buscar serviços:', servicesError);
      } else if (servicesData) {
        const serviceIds = (servicesData as Service[]).map((s) => s.id).filter(Boolean);
        let ratingsMap: Record<string, { sum: number; count: number }> = {};

        if (serviceIds.length > 0) {
          const { data: reviewsData, error: reviewsError } = await supabase
            .from('reviews')
            .select('service_id, rating')
            .in('service_id', serviceIds);

          if (reviewsError) {
            console.error('Erro ao buscar avaliações de serviços populares:', reviewsError);
          } else if (reviewsData) {
            ratingsMap = buildRatingsMap(reviewsData as Array<{ service_id: string; rating: number | null }>);
          }
        }

        const servicesWithRatings = (servicesData as Service[]).map((service) => {
          const ratingEntry = ratingsMap[service.id];
          const count = ratingEntry?.count || 0;
          const rating = count > 0 ? ratingEntry!.sum / count : undefined;

          return {
            ...service,
            rating,
            review_count: count || undefined,
          };
        });

        setAllPopularServices(servicesWithRatings);
      }

      if (categoriesError) {
        console.error('Erro ao buscar categorias:', categoriesError);
      } else if (categoriesData) {
        const sortedCategories = sortCategories(categoriesData);
        setCategories(sortedCategories);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      if (!isRefresh) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData(true);
    setRefreshing(false);
  };

  const renderBusinessCard = ({ item }: { item: BusinessProfile }) => (
    <View style={{ marginRight: businessGap }}>
      <BusinessCard
        id={item.id}
        business_name={item.business_name}
        logo_url={item.logo_url}
        banner_url={item.banner_url}
        description={item.description}
        category={item.category}
        accepted_payment_methods={item.accepted_payment_methods}
        work_days={item.work_days}
        services={item.services}
        categories={item.categories}
        width={businessCardWidth}
      />
    </View>
  );

  const renderServiceCard = ({ item }: { item: Service }) => (
    <ServiceCategoryCard
      id={item.id}
      name={item.name}
      price={item.price}
      photos={item.photos}
      rating={item.rating}
      reviewCount={item.review_count}
      category={item.categories?.name || item.business_profiles?.business_name || null}
      onPress={() => router.push(`/(client)/store/${item.business_id}`)}
    />
  );

  const styles = useMemo(() => StyleSheet.create({
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
      paddingBottom: 24,
    },
    searchBarContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: 12,
      paddingBottom: 16,
      gap: 8,
    },
    searchInputContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FEFEFE',
      borderWidth: 1,
      borderColor: '#474747',
      borderRadius: 24,
      paddingHorizontal: 12,
      paddingVertical: 16,
      minWidth: 152,
    },
    searchInput: {
      flex: 1,
      fontSize: 16,
      fontFamily: 'Montserrat_400Regular',
      color: '#0F0F0F',
      padding: 0,
      margin: 0,
    },
    searchIconContainer: {
      width: 24,
      height: 24,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 3,
    },
    filterButton: {
      width: 56,
      height: 56,
      backgroundColor: '#E5102E',
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#1D1D1D',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.24,
      shadowRadius: 8,
      elevation: 4,
    },
    categoriesContainer: {
      marginBottom: 16,
    },
    categoriesContent: {
      gap: 4,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 16,
      fontFamily: 'Montserrat_700Bold',
      color: '#E5102E',
      marginBottom: 16,
    },
    appointmentsList: {
      gap: 12,
    },
    appointmentsScrollArea: {
      maxHeight: 360,
    },
    appointmentCard: {
      paddingVertical: 4,
    },
    businessesList: {
      gap: 10,
      paddingRight: 24,
      paddingBottom: 20, 
    },
    servicesList: {
      paddingRight: 24,
      marginBottom: 24,
    },
    emptyText: {
      fontSize: 14,
      fontFamily: 'Montserrat_400Regular',
      color: '#474747',
      textAlign: 'center',
      marginTop: 16,
    },
    headerArea: {
      paddingTop: 10,
      paddingBottom: 10,
      backgroundColor: '#FAFAFA',
    },
  }), []);

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
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          colors={['#E5102E']}
          tintColor="#E5102E"
        />
      }
      header={<AppHeader showBackButton={false} />}
    >
        <View style={styles.headerArea}>
          <TouchableOpacity 
            activeOpacity={0.9} 
            onPress={() => router.push('/(client)/search')}
          >
            <View pointerEvents="none">
              <SearchBar
                value="" 
                onChangeText={() => {}} 
                placeholder="O que você procura?"
                showFilterButton={true}
              />
            </View>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoriesContainer}
          contentContainerStyle={styles.categoriesContent}
        >
          {categories.map((category) => (
            <Chip
              key={category.id}
              label={category.name}
              variant="outline"
              onPress={() => {
                router.push({
                  pathname: '/(client)/search/results',
                  params: { category: category.name },
                });
              }}
              style={{ marginRight: 4 }}
            />
          ))}
        </ScrollView>

        {appointments.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Meus Agendamentos</Text>
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

                return (
                  <AppointmentCard
                    key={item.id}
                    time={time}
                    dateLabel={dateLabel}
                    serviceName={item.service?.name || 'Serviço'}
                    showShopName={false}
                    onPress={() => router.push(`/(client)/appointments/${item.id}`)}
                    containerStyle={styles.appointmentCard}
                  />
                );
              })}
            </ScrollView>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lojas em destaque</Text>
          {allFeaturedBusinesses.length > 0 ? (
            <FlatList
              data={allFeaturedBusinesses}
              renderItem={renderBusinessCard}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.businessesList}
              initialNumToRender={3}
              maxToRenderPerBatch={5}
              windowSize={5}
              removeClippedSubviews={true}
              getItemLayout={(data, index) => ({
                length: businessCardWidth + businessGap,
                offset: (businessCardWidth + businessGap) * index,
                index,
              })}
            />
          ) : (
            <Text style={styles.emptyText}>Nenhuma loja em destaque no momento</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Serviços mais contratados</Text>
          {allPopularServices.length > 0 ? (
            <FlatList
              data={allPopularServices}
              renderItem={renderServiceCard}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.servicesList}
              initialNumToRender={4}
              maxToRenderPerBatch={6}
              windowSize={5}
              removeClippedSubviews={true}
              getItemLayout={(data, index) => ({
                length: serviceCardWidth + serviceGap,
                offset: (serviceCardWidth + serviceGap) * index,
                index,
              })}
            />
          ) : (
            <Text style={styles.emptyText}>Nenhum serviço disponível no momento</Text>
          )}

          <CustomButton
            title="Agendar serviços"
            variant="outline"
            onPress={() => {
              
            }}
            style={{ marginTop: 24, borderRadius: 24 }}
            width="100%"
          />
        </View>
    </ScreenContainer>
  );
};

export default ClientHomeScreen;