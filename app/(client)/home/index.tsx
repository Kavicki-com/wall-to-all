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
import { Cache } from '../../../lib/cache';
import { logger } from '../../../lib/logger';
import AppHeader from '../../../components/layout/AppHeader';
import { BusinessCard } from '../../../components/BusinessCard';
import ScreenContainer from '../../../components/layout/ScreenContainer';
import ServiceCategoryCard from '../../../components/ServiceCategoryCard';
import AppointmentCard from '../../../components/appointments/AppointmentCard';
import SearchBar from '../../../components/SearchBar';
import { CustomButton } from '../../../components/CustomButton';
import { Chip } from '../../../components/ui/Chip';
import { applyAcceptedReschedules } from '../../../lib/utils';
import { Appointment, BusinessProfile, Service, Category } from '../../../lib/types';

const FEATURED_LIMIT = 10;
const POPULAR_LIMIT = 10;
const CATEGORIES_LIMIT = 50;
const UPCOMING_APPOINTMENTS_LIMIT = 50;

const ClientHomeScreen: React.FC = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [allFeaturedBusinesses, setAllFeaturedBusinesses] = useState<BusinessProfile[]>([]);
  const [allPopularServices, setAllPopularServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const businessCardWidth = useCardWidth(1.5, 24, 10);
  const businessGap = 10;

  const serviceCardWidth = useCardWidth(2, 24, 14);
  const serviceGap = 14;

  const buildRatingsMap = (reviews: Array<{ service_id: number; rating: number | null }>) => {
    const map: Record<number, { sum: number; count: number }> = {};
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
        setLoading(false);
        return;
      }

      // Tentar cache para categorias (apenas se não for refresh)
      let categoriesData: Category[] | null = null;
      if (!isRefresh) {
        const cachedCategories = await Cache.get<Category[]>('categories');
        if (cachedCategories) {
          const sortedCategories = sortCategories(cachedCategories);
          setCategories(sortedCategories);
        }
      }

      // Calcular início e fim do dia atual
      const today = new Date();
      const startOfToday = new Date(today);
      startOfToday.setHours(0, 0, 0, 0);
      const endOfToday = new Date(today);
      endOfToday.setHours(23, 59, 59, 999);

      const [
        { data: appointmentsData },
        { data: businessesData },
        { data: servicesData },
        { data: fetchedCategoriesData },
      ] = await Promise.all([
        supabase
          .from('appointments')
          .select('id, start_time, end_time, status, payment_method, service:services(id, name), business:business_profiles(business_name, logo_url)')
          .eq('client_id', user.id)
          .order('start_time', { ascending: true })
          .gte('start_time', startOfToday.toISOString())
          .lte('start_time', endOfToday.toISOString())
          .limit(UPCOMING_APPOINTMENTS_LIMIT),
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

      if (appointmentsData) {
        const appointmentsWithReschedules = await applyAcceptedReschedules(appointmentsData);

        // Filtrar apenas agendamentos do dia atual (após aplicar reagendamentos)
        const todayAppointments = appointmentsWithReschedules.filter((apt) => {
          const appointmentDate = new Date(apt.start_time);
          return appointmentDate >= startOfToday && appointmentDate <= endOfToday;
        });

        setAppointments(todayAppointments as Appointment[]);
      }

      if (businessesData) {
        setAllFeaturedBusinesses(businessesData as BusinessProfile[]);
      }

      if (servicesData) {
        const serviceIds = (servicesData as Service[]).map((s) => s.id).filter(Boolean);
        let ratingsMap: Record<number, { sum: number; count: number }> = {};

        if (serviceIds.length > 0) {
          const { data: reviewsData } = await supabase
            .from('reviews')
            .select('service_id, rating')
            .in('service_id', serviceIds);

          if (reviewsData) {
            ratingsMap = buildRatingsMap(reviewsData as Array<{ service_id: number; rating: number | null }>);
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

      if (fetchedCategoriesData) {
        const sortedCategories = sortCategories(fetchedCategoriesData as any);
        setCategories(sortedCategories as Category[]);
        // Cachear categorias por 10 minutos (raramente mudam)
        await Cache.set('categories', fetchedCategoriesData, 10 * 60 * 1000);
      }
    } catch (error) {
      logger.error('Erro ao carregar dados:', error);
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
        category={item.categories?.name || null}
        accepted_payment_methods={item.accepted_payment_methods as any}
        work_days={item.work_days as any}
        services={item.services as any}
        categories={item.categories}
        width={businessCardWidth}
        onPress={(id: number) => router.push(`/(client)/store/${id}`)}
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
      width: '100%',
    },
    searchTouchArea: {
      width: '100%',
    },
    searchWrapper: {
      width: '100%',
    },
    footerContainer: {
      backgroundColor: '#FAFAFA',
      paddingTop: 10,
      paddingHorizontal: 0,
      paddingBottom: 22,
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
      footer={
        <View style={styles.footerContainer}>
          <CustomButton
            title="Agendar serviços"
            variant="outline"
            onPress={() => router.push('/(client)/search')}
            width="100%"
            style={{
              borderRadius: 30,
              borderWidth: 1.5,
              backgroundColor: '#FAFAFA',
              height: undefined,
              paddingVertical: 14,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.05,
              shadowRadius: 3.84,
              elevation: 2,
              marginVertical: 0,
            }}
          />
        </View>
      }
    >
      <View style={styles.headerArea}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => router.push('/(client)/search')}
          style={styles.searchTouchArea}
        >
          <View pointerEvents="none" style={styles.searchWrapper}>
            <SearchBar
              value=""
              onChangeText={() => { }}
              placeholder="O que você procura?"
              showFilterButton={true}
              containerStyle={{ width: '100%', paddingHorizontal: 0 }}
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
            key={category.id.toString()}
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
                  key={item.id.toString()}
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
            keyExtractor={(item) => item.id.toString()}
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
            keyExtractor={(item) => item.id.toString()}
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
      </View>
    </ScreenContainer>
  );
};

export default ClientHomeScreen;