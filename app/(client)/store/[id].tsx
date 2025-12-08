import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { formatWorkDays } from '../../../lib/workDaysUtils';
import { IconBack, IconNotification, IconSchedule, IconRatingStar, IconKidStar, IconPix, IconCreditCard, IconCash } from '../../../lib/icons';
import { MaterialIcons } from '@expo/vector-icons';
import BackgroundSvg from '../../../assets/background.svg';

// Tipos
type BusinessProfile = {
  id: string;
  business_name: string;
  description: string | null;
  logo_url: string | null;
  category_id: number | null;
  categories?: {
    id: number;
    name: string;
  };
  address: string | null;
  work_days: Record<string, { start: string; end: string }> | null;
  accepted_payment_methods: {
    pix?: boolean;
    card?: boolean;
    cash?: boolean;
  } | null;
};

type Service = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  photos: string[] | string | null;
  rating?: number;
  review_count?: number;
};

type ReviewStats = {
  average_rating: number;
  total_reviews: number;
};

const StoreProfileScreen: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const businessId = params.id;

  const [loading, setLoading] = useState(true);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [reviewStats, setReviewStats] = useState<ReviewStats>({ average_rating: 0, total_reviews: 0 });

  useEffect(() => {
    if (businessId) {
      loadBusinessData();
    }
  }, [businessId]);

  const loadBusinessData = async () => {
    if (!businessId) return;

    try {
      setLoading(true);

      // Buscar perfil do negócio
      const { data: businessData, error: businessError } = await supabase
        .from('business_profiles')
        .select(`
          *,
          categories:category_id (
            id,
            name
          )
        `)
        .eq('id', businessId)
        .single();

      if (businessError) {
        console.error('Erro ao buscar perfil do negócio:', businessError);
        setLoading(false);
        return;
      }

      if (businessData) {
        setBusinessProfile(businessData as BusinessProfile);
      }

      // Buscar serviços do negócio
      if (businessData) {
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
          .order('created_at', { ascending: false });

        if (servicesError) {
          console.error('Erro ao buscar serviços:', servicesError);
        } else if (servicesData) {
          // Buscar avaliações por serviço
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

        // Buscar estatísticas de avaliações do negócio
        const { data: reviewsData, error: reviewsError } = await supabase
          .from('reviews')
          .select('rating')
          .eq('business_id', businessData.id);

        if (!reviewsError && reviewsData) {
          const total = reviewsData.length;
          const average =
            total > 0
              ? reviewsData.reduce((sum, r) => sum + (r.rating || 0), 0) / total
              : 0;
          setReviewStats({
            average_rating: average,
            total_reviews: total,
          });
        }
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };


  const getPriceRange = (services: Service[]) => {
    if (services.length === 0) return '$$$$$';
    const prices = services.map((s) => s.price).filter((p) => p > 0);
    if (prices.length === 0) return '$$$$$';
    const avg = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    if (avg < 30) return '$$$$$';
    if (avg < 50) return '$$$$$';
    if (avg < 100) return '$$$$$';
    return '$$$$$';
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
        activeOpacity={0.8}
        onPress={() => {
          router.push(`/(client)/schedule/service?businessId=${businessId}`);
        }}
        accessibilityRole="button"
        accessibilityLabel={`Selecionar serviço ${item.name}`}
        accessibilityHint="Toque para iniciar o agendamento deste serviço"
      >
        <View style={styles.serviceImageContainer}>
          {firstImage ? (
            <Image source={{ uri: firstImage }} style={styles.serviceImage} resizeMode="cover" />
          ) : (
            <View style={[styles.serviceImage, styles.placeholderImage]} />
          )}
        </View>
        <View style={styles.serviceInfo}>
          <Text style={styles.serviceName}>{item.name}</Text>
          <View style={styles.serviceRatingContainer}>
            <View style={styles.serviceRating}>
              <Text style={styles.serviceRatingValue}>{item.rating || 4.8}</Text>
              <IconRatingStar size={24} color="#FFD700" />
              <Text style={styles.serviceRatingCount}>({item.review_count || 25})</Text>
            </View>
            <Text style={styles.serviceCategory}>Cortes</Text>
          </View>
          <Text style={styles.servicePrice}>
            R$ {item.price.toFixed(2).replace('.', ',')}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E5102E" />
      </View>
    );
  }

  if (!businessProfile) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Loja não encontrada</Text>
      </View>
    );
  }

  const paymentMethods = businessProfile.accepted_payment_methods || {};
  const priceRange = getPriceRange(services);

  return (
    <View style={styles.container}>
      {/* Background com bricks pattern */}
      <View style={styles.backgroundPattern}>
        <BackgroundSvg 
          width="100%" 
          height="100%" 
          style={styles.backgroundSvg}
          preserveAspectRatio="none"
        />
      </View>

      {/* Top Bar */}
      <View style={styles.topBar}>
        <View style={styles.topBarDivider} />
        <View style={styles.topBarContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <IconBack size={24} color="#FEFEFE" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.notificationButton} activeOpacity={0.8}>
            <IconNotification size={24} color="#FEFEFE" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <View style={styles.heroContainer}>
          <View style={styles.heroImageContainer}>
            {businessProfile.logo_url ? (
              <Image
                source={{ uri: businessProfile.logo_url }}
                style={styles.heroImage}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.heroImage, styles.placeholderImage]} />
            )}
            <LinearGradient
              colors={['transparent', 'rgba(0,14,61,0.5)']}
              style={styles.heroGradient}
            />
          </View>

          {/* Profile Avatar e Info */}
          <View style={styles.profileAvatarContainer}>
            <View style={styles.avatarContainer}>
              {businessProfile.logo_url ? (
                <Image
                  source={{ uri: businessProfile.logo_url }}
                  style={styles.avatar}
                />
              ) : (
                <View style={[styles.avatar, styles.placeholderAvatar]} />
              )}
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.businessName}>{businessProfile.business_name}</Text>
              <Text style={styles.businessDescription}>
                {businessProfile.description || 'Serviços profissionais'}
              </Text>
            </View>
          </View>
        </View>

        {/* Ratings Card */}
        <View style={styles.ratingsCard}>
          <View style={styles.ratingContainer}>
            <View style={styles.ratingValueContainer}>
              <Text style={styles.ratingText}>
                {reviewStats.total_reviews === 0
                  ? 'Sem avaliações'
                  : `${reviewStats.average_rating.toFixed(1)}`}
              </Text>
            </View>
            <Text style={styles.ratingCount}>({reviewStats.total_reviews})</Text>
          </View>
          <View style={styles.ratingContainer}>
            <Text style={styles.priceRangeLabel}>Preço médio</Text>
            <Text style={styles.priceRangeValue}>
              {priceRange.slice(0, 3)}
              <Text style={styles.priceRangeInactive}>{priceRange.slice(3)}</Text>
            </Text>
          </View>
        </View>

        {/* Address Card */}
        {businessProfile.address && (
          <View style={styles.addressCard}>
            <Text style={styles.addressText}>{businessProfile.address}</Text>
          </View>
        )}

        {/* Operating Hours Card */}
        <View style={styles.operatingHoursCard}>
          <Text style={styles.operatingHoursTitle}>Horário de funcionamento</Text>
          <Text style={styles.operatingHoursText}>
            {formatWorkDays(businessProfile.work_days)}
          </Text>
        </View>

        {/* Payment Methods Card */}
        <View style={styles.paymentMethodsCard}>
          <Text style={styles.paymentMethodsTitle}>Pagamentos aceitos</Text>
          <View style={styles.paymentMethodsRow}>
            {paymentMethods.pix && (
              <View style={styles.paymentMethodItem}>
                <IconPix width={24} height={24} />
                <Text style={styles.paymentMethodText}>PIX</Text>
              </View>
            )}
            {paymentMethods.card && (
              <View style={styles.paymentMethodItem}>
                <IconCreditCard width={24} height={24} color="#000E3D" />
                <Text style={styles.paymentMethodText}>Cartão</Text>
              </View>
            )}
            {paymentMethods.cash && (
              <View style={styles.paymentMethodItem}>
                <IconCash width={24} height={24} color="#000E3D" />
                <Text style={styles.paymentMethodText}>Dinheiro</Text>
              </View>
            )}
          </View>
        </View>

        {/* Services Section */}
        <View style={styles.servicesSection}>
          <Text style={styles.servicesTitle}>Serviços</Text>
          {services.length > 0 ? (
            <FlatList
              data={services}
              renderItem={renderServiceCard}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              contentContainerStyle={styles.servicesList}
            />
          ) : (
            <Text style={styles.emptyServicesText}>Nenhum serviço disponível</Text>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.scheduleButton}
            activeOpacity={0.8}
            onPress={() => {
              console.log('Iniciar agendamento para loja:', businessId);
              // TODO: Navegar para tela de seleção de serviço
              if (services.length > 0) {
                router.push(`/(client)/schedule/service?businessId=${businessId}`);
              }
            }}
          >
            <Text style={styles.scheduleButtonText}>Agendar serviços</Text>
            <IconSchedule size={24} color="#FEFEFE" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.reviewButton}
            activeOpacity={0.8}
            onPress={() => {
              console.log('Avaliar loja:', businessId);
              // TODO: Navegar para tela de avaliação
            }}
          >
            <Text style={styles.reviewButtonText}>Avaliar</Text>
            <IconKidStar size={24} color="#000E3D" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

export default StoreProfileScreen;

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
  backgroundPattern: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    zIndex: 0,
  },
  backgroundSvg: {
    opacity: 0.08,
    width: '100%',
    height: '100%',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  topBarDivider: {
    height: 14,
    backgroundColor: '#EBEFFF',
  },
  topBarContent: {
    height: 56,
    paddingHorizontal: 24,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#000E3D',
  },
  backButton: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationButton: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
    marginTop: 70,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  heroContainer: {
    marginTop: 24,
    marginHorizontal: 24,
    marginBottom: 16,
  },
  heroImageContainer: {
    height: 122,
    borderRadius: 8,
    marginBottom: -80,
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
  },
  profileAvatarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 16,
    height: 88,
    marginTop: -80,
  },
  avatarContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  profileInfo: {
    flex: 1,
    gap: 4,
  },
  businessName: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#FEFEFE',
  },
  businessDescription: {
    fontSize: 8,
    fontFamily: 'Montserrat_500Medium',
    color: '#FEFEFE',
  },
  ratingsCard: {
    backgroundColor: '#FEFEFE',
    borderRadius: 4,
    padding: 16,
    marginHorizontal: 24,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#1D1D1D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  ratingValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#0F0F0F',
  },
  ratingCount: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#474747',
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
  addressCard: {
    backgroundColor: '#FEFEFE',
    borderRadius: 4,
    padding: 16,
    marginHorizontal: 24,
    marginBottom: 8,
    shadowColor: '#1D1D1D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  addressText: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#0F0F0F',
    flex: 1,
  },
  operatingHoursCard: {
    backgroundColor: '#FEFEFE',
    borderRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 24,
    marginBottom: 8,
    gap: 8,
    shadowColor: '#1D1D1D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  operatingHoursTitle: {
    fontSize: 12,
    fontFamily: 'Montserrat_700Bold',
    color: '#000E3D',
  },
  operatingHoursText: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#0F0F0F',
  },
  paymentMethodsCard: {
    backgroundColor: '#FEFEFE',
    borderRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 24,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 16,
    shadowColor: '#1D1D1D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  paymentMethodsTitle: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#0F0F0F',
    flex: 1,
  },
  paymentMethodsRow: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  paymentMethodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  paymentMethodText: {
    fontSize: 12,
    fontFamily: 'Montserrat_400Regular',
    color: '#0F0F0F',
  },
  servicesSection: {
    marginHorizontal: 24,
    marginBottom: 16,
    gap: 16,
  },
  servicesTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#E5102E',
  },
  servicesList: {
    gap: 16,
  },
  serviceCard: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#474747',
    borderRadius: 16,
    overflow: 'hidden',
    gap: 16,
  },
  serviceImageContainer: {
    width: 85,
    height: '100%',
  },
  serviceImage: {
    width: '100%',
    height: '100%',
  },
  serviceInfo: {
    flex: 1,
    padding: 16,
    gap: 8,
    justifyContent: 'space-between',
  },
  serviceName: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#0F0F0F',
  },
  serviceRatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  serviceRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  serviceRatingValue: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#0F0F0F',
  },
  serviceRatingCount: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#474747',
  },
  serviceCategory: {
    fontSize: 12,
    fontFamily: 'Montserrat_300Light',
    color: '#0F0F0F',
  },
  servicePrice: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#17723F',
  },
  actionsContainer: {
    marginHorizontal: 24,
    marginBottom: 24,
    gap: 9,
  },
  scheduleButton: {
    backgroundColor: '#000E3D',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#1D1D1D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.24,
    shadowRadius: 8,
    elevation: 4,
  },
  scheduleButtonText: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#FEFEFE',
  },
  reviewButton: {
    borderWidth: 1,
    borderColor: '#000E3D',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  reviewButtonText: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#000E3D',
  },
  emptyServicesText: {
    fontSize: 14,
    fontFamily: 'Montserrat_400Regular',
    color: '#474747',
    textAlign: 'center',
    marginTop: 16,
  },
  errorText: {
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#E5102E',
    textAlign: 'center',
    marginTop: 24,
  },
  placeholderImage: {
    backgroundColor: '#E0E0E0',
  },
  placeholderAvatar: {
    backgroundColor: '#E0E0E0',
  },
});

