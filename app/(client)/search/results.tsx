import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  FlatList,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { handleError } from '../../../lib/errorHandler';
import { useDebounce } from '../../../lib/hooks/useDebounce';
import { logger } from '../../../lib/logger';
import ScreenContainer from '../../../components/layout/ScreenContainer';
import AppHeader from '../../../components/layout/AppHeader';
import SearchBar from '../../../components/SearchBar';
import { BusinessCard } from '../../../components/BusinessCard';
import TopServiceCard from '../../../components/TopServiceCard';
import { CustomButton } from '../../../components/CustomButton';
import { safeGoBack } from '../../../lib/router-utils';
import { BusinessProfile as Business, Service } from '../../../lib/types';
import { colors } from '../../../lib/theme';

const SearchResultsScreen: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string; category?: string }>();

  const initialQuery = params.q || '';
  const initialCategory = params.category || null;

  const [search, setSearch] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    initialCategory,
  );
  const [, setSelectedCategoryId] = useState<number | null>(
    null,
  );

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Debounce para evitar múltiplas requisições durante digitação
  const debouncedSearch = useDebounce(search, 400);
  const debouncedCategory = useDebounce(selectedCategory, 400);

  // Atualiza estados quando query / categoria vindas da URL mudarem
  useEffect(() => {
    setSearch(params.q || '');
    setSelectedCategory(params.category || null);
    setSelectedCategoryId(null);
  }, [params.q, params.category]);

  // Usar valores debounced para busca
  useEffect(() => {
    performSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // performSearch é estável (useCallback), não precisa estar nas dependências
  }, [debouncedSearch, debouncedCategory]);

  const performSearch = useCallback(async () => {
    try {
      setLoading(true);

      const trimmedSearch = search.trim();
      let categoryId: number | null = null;

      // Descobrir o ID da categoria (se houver)
      if (selectedCategory) {
        const { data: exact, error: e1 } = await supabase
          .from('categories')
          .select('id, name')
          .ilike('name', selectedCategory.trim())
          .maybeSingle();
        if (!e1 && exact) {
          categoryId = exact.id;
        } else {
          const { data: partial } = await supabase
            .from('categories')
            .select('id, name')
            .ilike('name', `%${selectedCategory.trim()}%`)
            .maybeSingle();
          if (partial) categoryId = partial.id;
        }
      }

      setSelectedCategoryId(categoryId);

      // Verificar se o termo de busca é igual ao nome da categoria
      // Se for, tratar como busca apenas por categoria (não filtrar por nome)
      const isCategoryOnlySearch = selectedCategory &&
        trimmedSearch.toLowerCase().trim() === selectedCategory.toLowerCase().trim();

      // Se não houver busca nem categoria, limpar
      if (!trimmedSearch && !categoryId) {
        setBusinesses([]);
        setServices([]);
        setLoading(false);
        return;
      }

      // Buscar serviços primeiro
      let serviceQuery = supabase
        .from('services')
        .select(
          `
          *,
          categories:category_id ( id, name )
        `,
        )
        .eq('is_active', true);

      if (categoryId) {
        serviceQuery = serviceQuery.eq('category_id', categoryId);
      }

      // Só aplicar filtro de nome se não for uma busca apenas por categoria
      if (trimmedSearch && !isCategoryOnlySearch) {
        serviceQuery = serviceQuery.ilike('name', `%${trimmedSearch}%`);
      }

      const svcRes = await serviceQuery.limit(10);

      // Se houver termo de busca (e não for busca apenas por categoria), buscar negócios que têm serviços com esse termo
      // Se não houver termo mas houver categoria, buscar todos os negócios da categoria
      let businessIds: number[] = [];
      if (trimmedSearch && !isCategoryOnlySearch && svcRes.data) {
        // Pegar business_ids únicos dos serviços encontrados
        businessIds = [
          ...new Set(
            (svcRes.data as { business_id?: number }[])
              .map((svc) => svc.business_id)
              .filter((id): id is number => Boolean(id)),
          ),
        ];
      } else if ((!trimmedSearch || isCategoryOnlySearch) && categoryId && svcRes.data) {
        // Se só tiver categoria (ou for busca apenas por categoria), pegar business_ids dos serviços da categoria
        businessIds = [
          ...new Set(
            (svcRes.data as { business_id?: number }[])
              .map((svc) => svc.business_id)
              .filter((id): id is number => Boolean(id)),
          ),
        ];
      }

      // Montar query de negócios
      let businessQuery = supabase.from('business_profiles').select(
        `
        *,
        categories:category_id ( id, name ),
        services ( id, name, price )
      `,
      );

      if (trimmedSearch && !isCategoryOnlySearch && businessIds.length > 0) {
        // Se houver termo de busca (e não for busca apenas por categoria), buscar apenas negócios que têm serviços com esse termo
        businessQuery = businessQuery.in('id', businessIds);
        // Se também houver categoria, filtrar por categoria também
        if (categoryId) {
          businessQuery = businessQuery.eq('category_id', categoryId);
        }
      } else if ((!trimmedSearch || isCategoryOnlySearch) && categoryId) {
        // Se não houver termo mas houver categoria (ou for busca apenas por categoria), buscar por categoria diretamente
        businessQuery = businessQuery.eq('category_id', categoryId);
      } else if (!trimmedSearch && !categoryId) {
        // Se não houver nem termo nem categoria, não buscar negócios
        setBusinesses([]);
      }

      const bizRes =
        businessIds.length > 0 || categoryId || trimmedSearch
          ? await businessQuery.limit(10)
          : { data: null, error: null };

      // Tratar negócios
      if (bizRes.data && bizRes.data.length > 0) {
        setBusinesses(bizRes.data as Business[]);
      } else {
        setBusinesses([]);
      }

      // Tratar serviços com ratings / score
      // CORREÇÃO N+1: Buscar todos os reviews e appointments de uma vez
      if (svcRes.data && svcRes.data.length > 0) {
        const serviceIds = (svcRes.data as { id: number }[]).map(svc => svc.id);

        // Buscar todos os dados de uma vez (2 queries em vez de 2*N)
        const [allReviewsRes, allAppointmentsRes] = await Promise.all([
          supabase
            .from('reviews')
            .select('service_id, rating')
            .in('service_id', serviceIds),
          supabase
            .from('appointments')
            .select('service_id, id')
            .in('service_id', serviceIds)
            .in('status', ['pending', 'confirmed', 'completed']),
        ]);

        // Criar maps para lookup rápido
        const reviewsMap = (allReviewsRes.data || []).reduce((acc, review) => {
          if (!review.service_id) return acc;
          if (!acc[review.service_id]) {
            acc[review.service_id] = [];
          }
          acc[review.service_id]!.push(review);
          return acc;
        }, {} as Record<number, typeof allReviewsRes.data>);

        const appointmentsMap = (allAppointmentsRes.data || []).reduce((acc, appointment) => {
          if (!appointment.service_id) return acc;
          if (!acc[appointment.service_id]) {
            acc[appointment.service_id] = [];
          }
          acc[appointment.service_id]!.push(appointment);
          return acc;
        }, {} as Record<number, typeof allAppointmentsRes.data>);

        // Processar em memória
        const svcWithRatings = (svcRes.data as { id: number; business_id?: number; is_featured?: boolean }[]).map((svc) => {
          const reviews = reviewsMap[svc.id] || [];
          const appointments = appointmentsMap[svc.id] || [];

          const rating =
            reviews.length > 0
              ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) /
              reviews.length
              : undefined;
          const reviewCount = reviews.length;
          const appointmentCount = appointments.length;

          const baseScore = rating
            ? rating * 0.6 +
            Math.min(reviewCount / 10, 1) * 0.2 +
            Math.min(appointmentCount / 5, 1) * 0.2
            : 0;
          const featuredBonus = svc.is_featured ? 2.0 : 0;
          const score = baseScore + featuredBonus;

          return {
            ...(svc as Service),
            rating,
            review_count: reviewCount,
            appointment_count: appointmentCount,
            recommendation_score: score,
          } as Service;
        });

        svcWithRatings.sort((a, b) => {
          if (a.is_featured && !b.is_featured) return -1;
          if (!a.is_featured && b.is_featured) return 1;
          return (b.recommendation_score || 0) - (a.recommendation_score || 0);
        });

        setServices(svcWithRatings);
      } else {
        setServices([]);
      }
    } catch (error) {
      handleError(error, 'general');
      setBusinesses([]);
      setServices([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, selectedCategory]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await performSearch();
    } catch (error) {
      // Erro já é tratado dentro de performSearch
      // Aqui apenas garantimos que o estado seja resetado
      logger.error('Erro ao atualizar busca:', error);
    } finally {
      // O performSearch já reseta o refreshing no finally,
      // mas garantimos aqui também por segurança
      setRefreshing(false);
    }
  };

  const handleServicePress = (svc: Service) => {
    router.push({
      pathname: '/(client)/store/[id]',
      params: { id: svc.business_id.toString() },
    });
  };

  const handleBusinessPress = (bizId: number) => {
    router.push({
      pathname: '/(client)/store/[id]',
      params: { id: bizId.toString() },
    });
  };

  const handleSchedule = () => {
    if (services.length > 0) {
      router.push({
        pathname: '/(client)/store/[id]',
        params: { id: services[0].business_id.toString() },
      });
    }
  };

  const hasResults = businesses.length > 0 || services.length > 0;

  const renderHeader = useCallback(() => (
    <>
      <View style={styles.searchBarWrapper}>
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Procurar serviços"
          onSubmit={performSearch}
          onSearchPress={performSearch}
          onClear={() => {
            setSearch('');
            setSelectedCategory(null);
            setSelectedCategoryId(null);
            setBusinesses([]);
            setServices([]);
          }}
          variant="grey"
          iconMode="auto"
          showFilterButton
          onPressFilter={() => {
            // abrir painel de filtros quando existir
          }}
          containerStyle={{ width: '100%', paddingHorizontal: 0 }}
        />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <>
          {/* PRINCIPAIS RESULTADOS (BusinessCard) */}
          {businesses.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Principais resultados</Text>
              <FlatList
                data={businesses}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.businessRow}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item, index }) => (
                  <View
                    style={[
                      styles.businessWrapper,
                      index === businesses.length - 1 && { marginRight: 24 },
                    ]}
                  >
                    <BusinessCard
                      id={item.id}
                      business_name={item.business_name}
                      logo_url={item.logo_url}
                      banner_url={item.banner_url}
                      description={item.description}
                      category={item.categories?.name || null}
                      categories={item.categories}
                      services={item.services}
                      work_days={item.work_days as any}
                      accepted_payment_methods={item.accepted_payment_methods as any}
                      onPress={handleBusinessPress}
                    />
                  </View>
                )}
              />
            </View>
          )}

          {/* Title for Services List */}
          {services.length > 0 && (
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Principais serviços</Text>
          )}

          {!hasResults && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>Nenhum resultado encontrado.</Text>
              <Text style={styles.emptySubtitle}>
                Tente buscar com outros termos ou ajustar os filtros.
              </Text>
            </View>
          )}
        </>
      )}
    </>
  ), [search, loading, businesses, services, hasResults, performSearch, handleBusinessPress]);

  const renderServiceItem = useCallback(({ item }: { item: Service }) => (
    <View style={{ marginBottom: 12 }}>
      <TopServiceCard
        id={item.id}
        name={item.name}
        price={item.price}
        photos={item.photos}
        rating={item.rating}
        reviewCount={item.review_count}
        category={item.categories?.name || null}
        onPress={() => handleServicePress(item)}
      />
    </View>
  ), [handleServicePress]);

  const renderFooter = useCallback(() => {
    if (services.length > 0) {
      return (
        <View style={styles.buttonWrapper}>
          <CustomButton
            title="Agendar serviços"
            variant="outline"
            onPress={handleSchedule}
            style={styles.cylindricalButton}
          />
        </View>
      );
    }
    return null;
  }, [services.length, handleSchedule]);

  return (
    <ScreenContainer
      scroll={false} // Disable ScreenContainer scroll since we use FlatList
      hasHeader={true}
      hasTabBar={false}
      backgroundColor={colors.background}
      // contentContainerStyle removed as it applies to ScrollView
      header={
        <AppHeader
          showBackButton
          onPressBack={() => safeGoBack('/(client)/home')}
        />
      }
    >
      <FlatList
        data={services}
        renderItem={renderServiceItem}
        keyExtractor={(item) => item.id.toString()}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        removeClippedSubviews={true} // Performance optim: unmount offscreen components
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={5}
      />
    </ScreenContainer>
  );
};

export default SearchResultsScreen;

const styles = StyleSheet.create({
  searchBarWrapper: {
    backgroundColor: colors.background,
    paddingTop: 12,
    paddingBottom: 8,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
    paddingTop: 8,
    backgroundColor: colors.background,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: colors.accent,
    marginBottom: 16,
  },
  // Horizontal row de BusinessCards
  businessRow: {
    paddingRight: 24,
    paddingBottom: 16,
  },
  businessWrapper: {
    marginRight: 16,
  },
  servicesList: {
    marginBottom: 8,
  },
  buttonWrapper: {
    marginTop: 8,
  },
  cylindricalButton: {
    borderRadius: 50, // Formato cilíndrico (metade da altura ou mais)
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 48,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat_600SemiBold',
    color: colors.textSecondary,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Montserrat_400Regular',
    color: '#9E9E9E',
    textAlign: 'center',
  },
});
