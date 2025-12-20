import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { handleError } from '../../../lib/errorHandler';
import ScreenContainer from '../../../components/layout/ScreenContainer';
import AppHeader from '../../../components/layout/AppHeader';
import SearchBar from '../../../components/SearchBar';
import { BusinessCard } from '../../../components/BusinessCard';
import TopServiceCard from '../../../components/TopServiceCard';
import { CustomButton } from '../../../components/CustomButton';
import { safeGoBack } from '../../../lib/router-utils';

type Business = {
  id: string;
  business_name: string;
  logo_url: string | null;
  banner_url?: string | null;
  description?: string | null;
  category_id: string | number | null;
  categories?: { id: number; name: string } | null;
  work_days?: Record<string, { start: string; end: string }> | null;
  accepted_payment_methods?: {
    pix?: boolean;
    card?: boolean;
    cash?: boolean;
  } | null;
  services?: Array<{ id: string; name: string; price?: number }>;
};

type Service = {
  id: string;
  name: string;
  price: number;
  category_id: string | null;
  business_id: string;
  photos: string[] | string | null;
  categories?: { id: string; name: string } | null;
  rating?: number;
  review_count?: number;
  appointment_count?: number;
  recommendation_score?: number;
  is_featured?: boolean;
};

const SearchResultsScreen: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string; category?: string }>();

  const initialQuery = params.q || '';
  const initialCategory = params.category || null;

  const [search, setSearch] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    initialCategory,
  );
  const [, setSelectedCategoryId] = useState<string | null>(
    null,
  );

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Atualiza estados quando query / categoria vindas da URL mudarem
  useEffect(() => {
    setSearch(params.q || '');
    setSelectedCategory(params.category || null);
    setSelectedCategoryId(null);
  }, [params.q, params.category]);

  useEffect(() => {
    performSearch();
  }, [search, selectedCategory]);

  const performSearch = async () => {
    try {
      setLoading(true);

      const trimmedSearch = search.trim();
      let categoryId: string | null = null;

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
      let businessIds: string[] = [];
      if (trimmedSearch && !isCategoryOnlySearch && svcRes.data) {
        // Pegar business_ids únicos dos serviços encontrados
        businessIds = [
          ...new Set(
            (svcRes.data as any[])
              .map((svc: any) => svc.business_id)
              .filter(Boolean),
          ),
        ];
      } else if ((!trimmedSearch || isCategoryOnlySearch) && categoryId && svcRes.data) {
        // Se só tiver categoria (ou for busca apenas por categoria), pegar business_ids dos serviços da categoria
        businessIds = [
          ...new Set(
            (svcRes.data as any[])
              .map((svc: any) => svc.business_id)
              .filter(Boolean),
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
      if (svcRes.data) {
        const svcWithRatings = await Promise.all(
          (svcRes.data as any[]).map(async (svc: any) => {
            const [reviewRes, appointRes] = await Promise.all([
              supabase.from('reviews').select('rating').eq('service_id', svc.id),
              supabase
                .from('appointments')
                .select('id')
                .eq('service_id', svc.id)
                .in('status', ['pending', 'confirmed', 'completed']),
            ]);

            const reviews = reviewRes.data || [];
            const appointments = appointRes.data || [];

            const rating =
              reviews.length > 0
                ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) /
                  reviews.length
                : undefined;
            const reviewCount = reviews.length || 0;
            const appointmentCount = appointments.length || 0;

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
          }),
        );

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
  };

  const onRefresh = () => {
    setRefreshing(true);
    performSearch();
  };

  const handleServicePress = (svc: Service) => {
    router.push({
      pathname: '/(client)/store/[id]',
      params: { id: svc.business_id },
    });
  };

  const handleBusinessPress = (bizId: string) => {
    router.push({
      pathname: '/(client)/store/[id]',
      params: { id: bizId },
    });
  };

  const handleSchedule = () => {
    if (services.length > 0) {
      router.push({
        pathname: '/(client)/store/[id]',
        params: { id: services[0].business_id },
      });
    }
  };

  const hasResults = businesses.length > 0 || services.length > 0;

  return (
    <ScreenContainer 
      scroll={true}
      hasHeader={true}
      hasTabBar={false}
      backgroundColor="#FAFAFA"
      contentContainerStyle={styles.scrollContent}
      header={
        <AppHeader
          showBackButton
          onPressBack={() => safeGoBack('/(client)/home')}
        />
      }
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* SearchBar igual ao MCP: cinza, com X e botão de filtro vermelho */}
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
          <ActivityIndicator size="large" color="#E5102E" />
        </View>
      ) : (
        <>
          {/* PRINCIPAIS RESULTADOS (BusinessCard) */}
          {businesses.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Principais resultados</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.businessRow}
              >
                {businesses.map((biz, index) => (
                  <View
                    key={biz.id}
                    style={[
                      styles.businessWrapper,
                      index === businesses.length - 1 && { marginRight: 24 },
                    ]}
                  >
                    <BusinessCard
                      id={biz.id}
                      business_name={biz.business_name}
                      logo_url={biz.logo_url}
                      banner_url={biz.banner_url}
                      description={biz.description}
                      category={biz.categories?.name || null}
                      categories={biz.categories}
                      services={biz.services}
                      work_days={biz.work_days}
                      accepted_payment_methods={biz.accepted_payment_methods}
                      onPress={handleBusinessPress}
                    />
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* PRINCIPAIS SERVIÇOS (TopServiceCard) */}
          {services.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Principais serviços</Text>
              <View style={styles.servicesList}>
                {services.map((svc) => (
                  <TopServiceCard
                    key={svc.id}
                    id={svc.id}
                    name={svc.name}
                    price={svc.price}
                    photos={svc.photos}
                    rating={svc.rating}
                    reviewCount={svc.review_count}
                    category={svc.categories?.name || null}
                    onPress={() => handleServicePress(svc)}
                  />
                ))}
              </View>

              <View style={styles.buttonWrapper}>
                <CustomButton
                  title="Agendar serviços"
                  variant="outline"
                  onPress={handleSchedule}
                  style={styles.cylindricalButton}
                />
              </View>
            </View>
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
    </ScreenContainer>
  );
};

export default SearchResultsScreen;

const styles = StyleSheet.create({
  searchBarWrapper: {
    backgroundColor: '#FAFAFA',
    paddingTop: 12,
    paddingBottom: 8,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
    paddingTop: 8,
    backgroundColor: '#FAFAFA',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#E5102E',
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
    color: '#474747',
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
