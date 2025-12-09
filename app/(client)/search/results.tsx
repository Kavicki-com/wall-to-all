import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, RefreshControl, TextInput } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { IconFilter, IconPix, IconCreditCard, IconCash, IconRatingStar, IconClose } from '../../../lib/icons';
import { formatWorkDays } from '../../../lib/workDaysUtils';
import { useCardWidth } from '../../../lib/responsive';
import { MerchantTopBar } from '../../../components/MerchantTopBar';

type Business = {
  id: string;
  business_name: string;
  category_id: number | null;
  categories?: {
    id: number;
    name: string;
  };
  logo_url: string | null;
  hero_image_url: string | null;
  description: string | null;
  address: string | null;
  work_days: Record<string, { start: string; end: string }> | null;
  accepted_payment_methods: {
    pix?: boolean;
    card?: boolean;
    cash?: boolean;
  } | null;
  services?: Array<{ id: string; name: string; price: number }>;
};

type Service = {
  id: string;
  name: string;
  price: number;
  category_id: number | null;
  categories?: {
    id: number;
    name: string;
  };
  photos: string[] | string | null;
  rating?: number;
  review_count?: number;
  appointment_count?: number;
  recommendation_score?: number;
  is_featured?: boolean;
  business_id: string;
};

const SearchResultsScreen: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ q: string; category?: string }>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [searchQuery, setSearchQuery] = useState(params.q || '');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    params.category || null,
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);

  // Card de negócios (~1.5 visíveis em scroll horizontal)
  const businessCardWidth = useCardWidth(1.5, 24, 10);
  const businessGap = 10; // Gap entre cards de negócios (marginRight)

  // Estilos dinâmicos que dependem de businessCardWidth
  const dynamicStyles = useMemo(() => StyleSheet.create({
    businessCardWrapper: {
      width: businessCardWidth,
      marginRight: businessGap,
    },
  }), [businessCardWidth]);

  // Atualizar estados quando params mudarem (ex: voltar e selecionar outra categoria)
  useEffect(() => {
    const newQuery = params.q || '';
    const newCategory = params.category || null;
    
    // Sempre atualizar os estados quando os params mudarem
    if (newQuery !== searchQuery || newCategory !== selectedCategory) {
      setSearchQuery(newQuery);
      setSelectedCategory(newCategory);
      setSelectedCategoryId(null); // Resetar ID para forçar nova busca
    }
  }, [params.q, params.category]);

  useEffect(() => {
    // Só busca se tiver categoria OU query de texto
    if (selectedCategory || searchQuery.trim().length > 0) {
      performSearch();
    } else {
      // Se não tiver nem categoria nem query, limpar resultados
      setBusinesses([]);
      setServices([]);
      setLoading(false);
    }
  }, [searchQuery, selectedCategory]);

  const performSearch = async () => {
    try {
      setLoading(true);

      // Se tiver categoria selecionada (nome), buscar o ID primeiro
      let categoryId: number | null = null;
      if (selectedCategory) {
        // Primeiro tenta busca exata (case-insensitive) - sem wildcards
        const { data: categoryDataExact, error: errorExact } = await supabase
          .from('categories')
          .select('id, name')
          .ilike('name', selectedCategory.trim())
          .maybeSingle();
        
        if (!errorExact && categoryDataExact) {
          categoryId = categoryDataExact.id;
          setSelectedCategoryId(categoryId);
          console.log('Categoria encontrada (exata):', { id: categoryId, name: categoryDataExact.name });
        } else {
          // Se não encontrou exato, tenta busca parcial
          const { data: categoryDataPartial, error: categoryError } = await supabase
            .from('categories')
            .select('id, name')
            .ilike('name', `%${selectedCategory.trim()}%`)
            .maybeSingle();
          
          if (categoryError) {
            console.error('Erro ao buscar categoria:', categoryError);
          } else if (categoryDataPartial) {
            categoryId = categoryDataPartial.id;
            setSelectedCategoryId(categoryId);
            console.log('Categoria encontrada (parcial):', { id: categoryId, name: categoryDataPartial.name });
          } else {
            console.warn('Categoria não encontrada:', selectedCategory);
            // Listar todas as categorias disponíveis para debug
            const { data: allCategories } = await supabase
              .from('categories')
              .select('id, name')
              .order('name', { ascending: true });
            console.log('Categorias disponíveis no banco:', allCategories);
            setSelectedCategoryId(null);
          }
        }
      } else {
        setSelectedCategoryId(null);
      }

      let businessQuery = supabase.from('business_profiles').select(`
        *,
        categories:category_id (
          id,
          name
        ),
        services(id, name, price)
      `);

      let serviceQuery = supabase.from('services').select(`
        *,
        categories:category_id (
          id,
          name
        )
      `)
      .eq('is_active', true);

      // Se tiver categoria, filtrar por categoria (mesmo sem query de texto)
      if (categoryId) {
        businessQuery = businessQuery.eq('category_id', categoryId);
        serviceQuery = serviceQuery.eq('category_id', categoryId);
        
        // Se também tiver query de texto, adicionar filtro de texto
        if (searchQuery.trim().length > 0) {
          businessQuery = businessQuery.ilike('business_name', `%${searchQuery}%`);
          serviceQuery = serviceQuery.ilike('name', `%${searchQuery}%`);
        }
      } else if (searchQuery.trim().length > 0) {
        // Se não tiver categoria mas tiver query, buscar apenas por texto
        businessQuery = businessQuery.ilike('business_name', `%${searchQuery}%`);
        serviceQuery = serviceQuery.ilike('name', `%${searchQuery}%`);
      } else {
        // Se não tiver nem categoria nem query, não buscar nada (mostrar vazio)
        setBusinesses([]);
        setServices([]);
        setLoading(false);
        return;
      }

      const [businessesResult, servicesResult] = await Promise.all([
        businessQuery.limit(10),
        serviceQuery.limit(10),
      ]);

      if (businessesResult.error) {
        console.error('Erro ao buscar lojas:', businessesResult.error);
      }
      if (servicesResult.error) {
        console.error('Erro ao buscar serviços:', servicesResult.error);
      }

      console.log('Resultados da busca:', {
        categoryId,
        selectedCategory,
        searchQuery,
        businessesCount: businessesResult.data?.length || 0,
        servicesCount: servicesResult.data?.length || 0,
        businessQueryError: businessesResult.error,
        serviceQueryError: servicesResult.error,
      });
      
      // Log detalhado se não encontrar resultados mas tiver categoria
      if (categoryId && servicesResult.data?.length === 0) {
        console.warn('⚠️ Categoria selecionada mas nenhum serviço encontrado:', {
          categoryId,
          categoryName: selectedCategory,
        });
        
        // Verificar se existem serviços com essa categoria no banco
        const { data: testServices, error: testError } = await supabase
          .from('services')
          .select('id, name, category_id, is_active')
          .eq('category_id', categoryId)
          .eq('is_active', true)
          .limit(5);
        console.log('🔍 Serviços com essa categoria no banco:', testServices);
        if (testError) {
          console.error('❌ Erro ao verificar serviços:', testError);
        }
        
        // Verificar também se há serviços inativos
        const { data: inactiveServices } = await supabase
          .from('services')
          .select('id, name, category_id, is_active')
          .eq('category_id', categoryId)
          .eq('is_active', false)
          .limit(3);
        if (inactiveServices && inactiveServices.length > 0) {
          console.log('⚠️ Existem serviços inativos com essa categoria:', inactiveServices);
        }
      }

      if (businessesResult.data) {
        setBusinesses(businessesResult.data as Business[]);
      } else {
        setBusinesses([]);
      }

      if (servicesResult.data) {
        // Buscar ratings e appointments para serviços
        const servicesWithRatings = await Promise.all(
          (servicesResult.data as Service[]).map(async (service) => {
            const [reviewsResult, appointmentsResult] = await Promise.all([
              supabase
                .from('reviews')
                .select('rating')
                .eq('service_id', service.id),
              supabase
                .from('appointments')
                .select('id')
                .eq('service_id', service.id)
                .in('status', ['pending', 'confirmed', 'completed']),
            ]);

            const reviews = reviewsResult.data || [];
            const appointments = appointmentsResult.data || [];

            const rating =
              reviews.length > 0
                ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length
                : undefined;
            const reviewCount = reviews.length || 0;
            const appointmentCount = appointments.length || 0;

            // Calcular score para determinar serviço recomendado
            // Score = (rating * 0.6) + (reviewCount normalizado * 0.2) + (appointmentCount normalizado * 0.2)
            // Se is_featured = true, adiciona bonus de 2.0 ao score
            const baseScore = rating
              ? rating * 0.6 + Math.min(reviewCount / 10, 1) * 0.2 + Math.min(appointmentCount / 5, 1) * 0.2
              : 0;
            const featuredBonus = service.is_featured ? 2.0 : 0;
            const score = baseScore + featuredBonus;

            return {
              ...service,
              rating,
              review_count: reviewCount,
              appointment_count: appointmentCount,
              recommendation_score: score,
            };
          })
        );

        // Ordenar: primeiro is_featured = true, depois por score de recomendação (maior primeiro)
        servicesWithRatings.sort((a, b) => {
          // Serviços featured sempre vêm primeiro
          if (a.is_featured && !b.is_featured) return -1;
          if (!a.is_featured && b.is_featured) return 1;
          // Se ambos featured ou ambos não featured, ordenar por score
          return (b.recommendation_score || 0) - (a.recommendation_score || 0);
        });
        setServices(servicesWithRatings);
      } else {
        setServices([]);
      }
    } catch (error) {
      console.error('Erro ao buscar:', error);
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

  const handleBusinessPress = (businessId: string) => {
    router.push({
      pathname: '/(client)/store/[id]',
      params: { id: businessId },
    });
  };

  const handleServicePress = (service: Service) => {
    router.push({
      pathname: '/(client)/store/[id]',
      params: { id: service.business_id },
    });
  };


  const getPriceRange = (services: Array<{ price: number }>) => {
    if (services.length === 0) return '$$$$$';
    const prices = services.map((s) => s.price).filter((p) => p > 0);
    if (prices.length === 0) return '$$$$$';
    const avg = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    if (avg < 30) return '$$$$$';
    if (avg < 50) return '$$$$$';
    if (avg < 100) return '$$$$$';
    return '$$$$$';
  };

  const renderBusinessCard = ({ item }: { item: Business }) => {
    const paymentMethods = item.accepted_payment_methods || {};
    const businessServices = item.services || [];
    const priceRange = getPriceRange(businessServices);

    let imagesArray: string[] = [];
    if (item.services && item.services.length > 0) {
      // Use first service image if available
    }

    return (
      <TouchableOpacity
        style={styles.businessCard}
        onPress={() => handleBusinessPress(item.id)}
        activeOpacity={0.8}
      >
        {/* Hero Image */}
        <View style={styles.businessHeroContainer}>
          <View style={styles.businessImageContainer}>
            {item.hero_image_url ? (
              <Image
                source={{ uri: item.hero_image_url }}
                style={styles.businessHeroImage}
                resizeMode="cover"
              />
            ) : item.logo_url ? (
              <Image
                source={{ uri: item.logo_url }}
                style={styles.businessHeroImage}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.businessHeroImage, styles.placeholderImage]} />
            )}
            <LinearGradient
              colors={['transparent', 'rgba(0,14,61,0.5)']}
              style={styles.businessGradient}
            />
            {/* Profile Avatar e Info sobrepostos */}
            <View style={styles.businessProfileContainer}>
              <View style={styles.businessAvatarContainer}>
                {item.logo_url ? (
                  <Image source={{ uri: item.logo_url }} style={styles.businessAvatar} />
                ) : (
                  <View style={[styles.businessAvatar, styles.placeholderAvatar]} />
                )}
              </View>
              <View style={styles.businessInfo}>
                <Text style={styles.businessName}>{item.business_name}</Text>
                <Text style={styles.businessCategory}>
                  {item.categories?.name || 'Serviços profissionais'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Preço médio */}
        <View style={styles.priceRangeContainer}>
          <Text style={styles.priceRangeLabel}>Preço médio</Text>
          <Text style={styles.priceRangeValue}>
            {priceRange.slice(0, 3)}
            <Text style={styles.priceRangeInactive}>{priceRange.slice(3)}</Text>
          </Text>
        </View>

        {/* Service Pills */}
        {businessServices.length > 0 && (
          <View style={styles.servicePillsContainer}>
            {businessServices.slice(0, 4).map((service) => (
              <View key={service.id} style={styles.servicePill}>
                <Text style={styles.servicePillText}>{service.name}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Horário de funcionamento */}
        <View style={styles.operatingHours}>
          <Text style={styles.operatingHoursTitle}>Horário de funcionamento</Text>
          <Text style={styles.operatingHoursText}>{formatWorkDays(item.work_days)}</Text>
        </View>

        {/* Payment Methods */}
        <View style={styles.paymentMethods}>
          <Text style={styles.paymentMethodsTitle}>Pagamentos aceitos</Text>
          <View style={styles.paymentMethodsRow}>
            {paymentMethods.pix && (
              <View style={styles.paymentMethodItem}>
                <IconPix width={16} height={16} />
                <Text style={styles.paymentMethodText}>PIX</Text>
              </View>
            )}
            {paymentMethods.card && (
              <View style={styles.paymentMethodItem}>
                <IconCreditCard width={16} height={16} />
                <Text style={styles.paymentMethodText}>Cartão</Text>
              </View>
            )}
            {paymentMethods.cash && (
              <View style={styles.paymentMethodItem}>
                <IconCash width={16} height={16} />
                <Text style={styles.paymentMethodText}>Dinheiro</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderServiceCard = ({ item }: { item: Service }) => {
    let imagesArray: string[] = [];
    if (item.photos) {
      if (typeof item.photos === 'string') {
        try {
          imagesArray = JSON.parse(item.photos);
        } catch {
          imagesArray = [item.photos];
        }
      } else if (Array.isArray(item.photos)) {
        imagesArray = item.photos;
      }
    }
    const firstImage = imagesArray.length > 0 ? imagesArray[0] : null;

    return (
      <TouchableOpacity
        style={styles.serviceCard}
        onPress={() => handleServicePress(item)}
        activeOpacity={0.8}
      >
        <View style={styles.serviceImageContainer}>
          {firstImage ? (
            <Image source={{ uri: firstImage }} style={styles.serviceImage} resizeMode="cover" />
          ) : (
            <View style={[styles.serviceImage, styles.placeholderImage]} />
          )}
          {item.categories?.name && (
            <View style={styles.serviceCategoryBadge}>
              <Text style={styles.serviceCategoryText}>{item.categories.name}</Text>
            </View>
          )}
        </View>
        <View style={styles.serviceInfo}>
          <Text style={styles.serviceName}>{item.name}</Text>
          <View style={styles.serviceRatingContainer}>
            <Text style={styles.serviceRatingValue}>{item.rating?.toFixed(1) || '4.5'}</Text>
            <IconRatingStar size={24} color="#FFD700" />
            <IconRatingStar size={24} color="#FFD700" />
            <IconRatingStar size={24} color="#FFD700" />
            <IconRatingStar size={24} color="#FFD700" />
            <IconRatingStar size={24} color="#FFD700" />
            <Text style={styles.serviceReviewCount}>({item.review_count || 25})</Text>
          </View>
          <Text style={styles.servicePrice}>
            R$ {item.price.toFixed(2).replace('.', ',')}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <MerchantTopBar showNotification fallbackPath="/(client)/home" />

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar..."
            placeholderTextColor="#9E9E9E"
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              // Se limpar o campo mas tiver categoria, manter a busca por categoria
              if (text.trim().length === 0 && selectedCategory) {
                // A busca será refeita pelo useEffect que monitora searchQuery
              }
            }}
            onSubmitEditing={performSearch}
          />
          <TouchableOpacity 
            onPress={() => {
              // Limpar estados antes de voltar
              setSearchQuery('');
              setSelectedCategory(null);
              setSelectedCategoryId(null);
              router.replace('/(client)/home');
            }}
            accessibilityRole="button"
            accessibilityLabel="Fechar e voltar para home"
          >
            <IconClose size={14} color="#0F0F0F" />
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.filterButton}>
          <IconFilter size={18} color="#FEFEFE" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E5102E" />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Principais Resultados */}
          {businesses.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Principais resultados</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.businessesHorizontal}
              >
                {businesses.map((business) => (
                  <View key={business.id} style={dynamicStyles.businessCardWrapper}>
                    {renderBusinessCard({ item: business })}
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Principais Serviços */}
          {services.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Principais serviços</Text>
              
              {/* Serviço Recomendado (primeiro da lista) */}
              {services.length > 0 && (
                <View style={styles.recommendedServiceCard}>
                  {renderServiceCard({ item: services[0] })}
                </View>
              )}

              {/* Demais Serviços */}
              {services.length > 1 && (
                <View style={styles.servicesList}>
                  {services.slice(1).map((service) => (
                    <View key={service.id} style={styles.serviceCardWrapper}>
                      {renderServiceCard({ item: service })}
                    </View>
                  ))}
                </View>
              )}

              <TouchableOpacity
                style={styles.scheduleButton}
                onPress={() => {
                  if (services.length > 0) {
                    router.push(`/(client)/store/${services[0].business_id}`);
                  }
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.scheduleButtonText}>Agendar serviços</Text>
              </TouchableOpacity>
            </View>
          )}

          {businesses.length === 0 && services.length === 0 && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Nenhum resultado encontrado.</Text>
              <Text style={styles.emptySubtext}>
                Tente buscar com outros termos ou filtros.
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
};

export default SearchResultsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#FEFEFE',
    gap: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEFEFE',
    borderWidth: 1,
    borderColor: '#474747',
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 16,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#0F0F0F',
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
    elevation: 6,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 100,
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
  businessesHorizontal: {
    gap: 10,
    paddingRight: 24,
  },
  businessCard: {
    backgroundColor: '#FEFEFE',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#1D1D1D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  businessHeroContainer: {
    width: '100%',
  },
  businessImageContainer: {
    width: '100%',
    height: 122,
    position: 'relative',
    overflow: 'visible',
  },
  businessHeroImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    backgroundColor: '#E0E0E0',
  },
  businessGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
  },
  businessProfileContainer: {
    position: 'absolute',
    bottom: -72,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingLeft: 16,
    paddingBottom: 8,
    gap: 8,
  },
  businessAvatarContainer: {
    marginBottom: 0,
  },
  businessAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#FEFEFE',
  },
  placeholderAvatar: {
    backgroundColor: '#E0E0E0',
  },
  businessInfo: {
    flex: 1,
    gap: 4,
  },
  businessName: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#FEFEFE',
  },
  businessCategory: {
    fontSize: 8,
    fontFamily: 'Montserrat_500Medium',
    color: '#FEFEFE',
  },
  priceRangeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  priceRangeLabel: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#0F0F0F',
  },
  priceRangeValue: {
    fontSize: 12,
    fontFamily: 'Montserrat_700Bold',
    color: '#E5102E',
  },
  priceRangeInactive: {
    color: '#DBDBDB',
  },
  servicePillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  servicePill: {
    borderWidth: 1,
    borderColor: '#000E3D',
    borderRadius: 32,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  servicePillText: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#000E3D',
  },
  operatingHours: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  operatingHoursTitle: {
    fontSize: 12,
    fontFamily: 'Montserrat_700Bold',
    color: '#000E3D',
  },
  operatingHoursText: {
    fontSize: 12,
    fontFamily: 'Montserrat_400Regular',
    color: '#0F0F0F',
  },
  paymentMethods: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 16,
  },
  paymentMethodsTitle: {
    fontSize: 12,
    fontFamily: 'Montserrat_400Regular',
    color: '#0F0F0F',
  },
  paymentMethodsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  paymentMethodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  paymentMethodText: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#0F0F0F',
  },
  recommendedServiceCard: {
    marginBottom: 12,
  },
  servicesList: {
    gap: 12,
    marginBottom: 24,
  },
  serviceCardWrapper: {
    marginBottom: 0,
  },
  serviceCard: {
    gap: 8,
  },
  serviceImageContainer: {
    width: '100%',
    height: 94,
    borderRadius: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  serviceImage: {
    width: '100%',
    height: '100%',
  },
  serviceCategoryBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FEFEFE',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  serviceCategoryText: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#000E3D',
  },
  serviceInfo: {
    gap: 7,
  },
  serviceName: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#000E3D',
    minHeight: 40,
  },
  serviceRatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  serviceRatingValue: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#0F0F0F',
  },
  serviceReviewCount: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#474747',
  },
  servicePrice: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#17723F',
  },
  scheduleButton: {
    borderWidth: 1,
    borderColor: '#000E3D',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleButtonText: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#000E3D',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#474747',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    fontFamily: 'Montserrat_400Regular',
    color: '#9E9E9E',
    textAlign: 'center',
  },
});
