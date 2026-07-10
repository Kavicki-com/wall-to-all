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
import HomeTopBar from '../../../components/home/HomeTopBar';
import { AppDrawer, DrawerItem } from '../../../components/layout/AppDrawer';
import NotificationModal from '../../../components/notifications/NotificationModal';
import { useNotifications } from '../../../context/NotificationContext';
import { StoreHighlightCard } from '../../../components/home/StoreHighlightCard';
import { StoriesRow } from '../../../components/home/StoriesRow';
import ScreenContainer from '../../../components/layout/ScreenContainer';
import ServiceCategoryCard from '../../../components/ServiceCategoryCard';
import AppointmentCard from '../../../components/appointments/AppointmentCard';
import SearchBar from '../../../components/SearchBar';
import { CustomButton } from '../../../components/CustomButton';
import { Chip } from '../../../components/ui/Chip';
import { applyAcceptedReschedules } from '../../../lib/utils';
import { Appointment, BusinessProfile, Business, Service, Category } from '../../../lib/types';
import { colors } from '../../../lib/theme';

const FEATURED_LIMIT = 10;
const POPULAR_LIMIT = 10;
const CATEGORIES_LIMIT = 50;
const UPCOMING_APPOINTMENTS_LIMIT = 50;

// Largura fixa do StoreHighlightCard (Figma 2715:3469) — usada no getItemLayout
// do carrossel "Lojas em destaque".
const HIGHLIGHT_CARD_WIDTH = 255;
const HIGHLIGHT_GAP = 10;

const ClientHomeScreen: React.FC = () => {
  const router = useRouter();
  const { unreadCount, refreshNotifications } = useNotifications();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [allFeaturedBusinesses, setAllFeaturedBusinesses] = useState<BusinessProfile[]>([]);
  const [allPopularServices, setAllPopularServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  // Menu lateral (AppDrawer) e modal de notificações — donos do estado que a
  // HomeTopBar (genérica) apenas dispara via callbacks.
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notifModalVisible, setNotifModalVisible] = useState(false);

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

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const openNotifications = useCallback(() => setNotifModalVisible(true), []);
  // Ao fechar o modal, recarrega a contagem — mesmo fluxo do AppHeader.
  const closeNotifications = useCallback(() => {
    setNotifModalVisible(false);
    refreshNotifications();
  }, [refreshNotifications]);

  // Itens do menu (drawer) do cliente — rotas já existentes do app.
  const drawerItems: DrawerItem[] = useMemo(
    () => [
      { label: 'Início', route: '/(client)/home' },
      { label: 'Meus agendamentos', route: '/(client)/appointments' },
      { label: 'Buscar serviços', route: '/(client)/search' },
      { label: 'Perfil', route: '/(client)/profile' },
      { label: 'Configurações', route: '/(client)/settings' },
    ],
    [],
  );

  // Lojas em destaque (BusinessProfile) → shape `Business` que o StoreHighlightCard
  // consome. Os campos já vêm nas linhas do featured (mesmos que o antigo
  // renderBusinessCard passava ao BusinessCard).
  const toBusiness = useCallback(
    (b: BusinessProfile): Business => ({
      id: b.id,
      business_name: b.business_name,
      logo_url: b.logo_url,
      description: b.description,
      address: b.address,
      banner_url: b.banner_url,
      accepted_payment_methods: b.accepted_payment_methods,
      work_days: b.work_days,
      services: b.services,
      categories: b.categories,
    }),
    [],
  );

  // Stories: as mesmas lojas em destaque, mapeadas ao shape do StoriesRow.
  const stories = useMemo(
    () =>
      allFeaturedBusinesses.map((b) => ({
        id: b.id,
        name: b.business_name,
        logoUrl: b.logo_url,
      })),
    [allFeaturedBusinesses],
  );

  const renderHighlightCard = ({ item }: { item: BusinessProfile }) => (
    <StoreHighlightCard
      business={toBusiness(item)}
      onPress={() => router.push(`/(client)/store/${item.id}`)}
    />
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
      onPress={() => router.push({
        pathname: '/(client)/schedule/time',
        params: {
          businessId: item.business_id?.toString() || '',
          serviceId: item.id.toString(),
        },
      })}

    />
  );

  const styles = useMemo(() => StyleSheet.create({
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
    },
    scrollContent: {
      paddingBottom: 24,
    },
    searchBlock: {
      width: '100%',
      paddingTop: 10,
      paddingBottom: 12,
    },
    searchTouchArea: {
      width: '100%',
    },
    categoriesContainer: {
      marginBottom: 16,
    },
    categoriesContent: {
      gap: 4,
    },
    storiesSection: {
      marginBottom: 16,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 16,
      fontFamily: 'Montserrat_700Bold',
      color: colors.accent,
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
    // Estado vazio de "Meus Agendamentos" (Figma 2715:3462): cartão de borda
    // tracejada em surfaceGrey, raio 16.
    emptyAppointmentsCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.surfaceGrey,
      borderRadius: 16,
      padding: 16,
    },
    emptyAppointmentsText: {
      fontSize: 16,
      fontFamily: 'Montserrat_400Regular',
      color: colors.textPrimary,
    },
    highlightsList: {
      gap: HIGHLIGHT_GAP,
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
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 16,
    },
    footerContainer: {
      backgroundColor: colors.background,
      paddingTop: 10,
      paddingHorizontal: 0,
      paddingBottom: 22,
    },
    scheduleButton: {
      borderRadius: 24,
      borderWidth: 1,
      backgroundColor: colors.background,
      marginVertical: 0,
      paddingVertical: 14,
      height: undefined,
    },
  }), []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <>
      <ScreenContainer
        scroll={true}
        hasHeader={true}
        backgroundColor={colors.background}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.accent]}
            tintColor={colors.accent}
          />
        }
        header={
          <HomeTopBar
            onMenu={openDrawer}
            onBell={openNotifications}
            notificationCount={unreadCount}
          />
        }
        footer={
          <View style={styles.footerContainer}>
            <CustomButton
              title="Agendar serviços"
              variant="outline"
              onPress={() => router.push('/(client)/search')}
              width="100%"
              style={styles.scheduleButton}
            />
          </View>
        }
      >
        {/* Bloco de busca: combo "Procurar serviços" + botão de filtro vermelho
            (56px) — todo o bloco navega para a busca — e as chips de categorias. */}
        <View style={styles.searchBlock}>
          <TouchableOpacity
            testID="home-search-combo"
            activeOpacity={0.9}
            onPress={() => router.push('/(client)/search')}
            style={styles.searchTouchArea}
          >
            <View pointerEvents="none">
              <SearchBar
                value=""
                onChangeText={() => { }}
                placeholder="Procurar serviços"
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

        {/* Stories: as lojas em destaque como anéis circulares. */}
        {stories.length > 0 && (
          <View style={styles.storiesSection}>
            <StoriesRow stores={stories} />
          </View>
        )}

        {/* Meus Agendamentos — sempre visível; vazio → cartão tracejado. */}
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
          ) : (
            <View style={styles.emptyAppointmentsCard}>
              <Text style={styles.emptyAppointmentsText}>
                Você ainda não tem nenhum agendamento, agende um serviço para visualizar eles aqui:
              </Text>
            </View>
          )}
        </View>

        {/* Lojas em destaque — carrossel de StoreHighlightCard (255px). */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lojas em destaque</Text>
          {allFeaturedBusinesses.length > 0 ? (
            <FlatList
              data={allFeaturedBusinesses}
              renderItem={renderHighlightCard}
              keyExtractor={(item) => item.id.toString()}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.highlightsList}
              initialNumToRender={3}
              maxToRenderPerBatch={5}
              windowSize={5}
              removeClippedSubviews={true}
              getItemLayout={(data, index) => ({
                length: HIGHLIGHT_CARD_WIDTH + HIGHLIGHT_GAP,
                offset: (HIGHLIGHT_CARD_WIDTH + HIGHLIGHT_GAP) * index,
                index,
              })}
            />
          ) : (
            <Text style={styles.emptyText}>Nenhuma loja em destaque no momento</Text>
          )}
        </View>

        {/* Serviços mais contratados — carrossel existente (inalterado). */}
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

      {/* Menu lateral e modal de notificações — irmãos do ScreenContainer para
          não viverem dentro do ScrollView. */}
      <AppDrawer visible={drawerOpen} onClose={closeDrawer} items={drawerItems} />
      <NotificationModal
        visible={notifModalVisible}
        onClose={closeNotifications}
        onNotificationsUpdated={refreshNotifications}
      />
    </>
  );
};

export default ClientHomeScreen;
