import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { formatWorkDays } from '../../../lib/workDaysUtils';
import { IconSchedule, IconKidStar, IconPix, IconCreditCard, IconCash } from '../../../lib/icons';
import BackgroundSvg from '../../../assets/background.svg';
import AppHeader from '../../../components/layout/AppHeader';
import ScreenContainer from '../../../components/layout/ScreenContainer';
import { safeGoBack } from '../../../lib/router-utils';
import ServiceCard from '../../../components/ServiceCard';
import { CustomButton } from '../../../components/CustomButton';
import { Card } from '../../../components/ui/Card';
import { useResponsiveWidth, useResponsiveHeight } from '../../../lib/responsive';

type BusinessProfile = {
  id: string;
  business_name: string;
  description: string | null;
  logo_url: string | null;
  category_id: string | null;
  categories?: {
    id: string;
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

  // Dimensões responsivas
  const heroHeight = useResponsiveHeight(122);
  const avatarSize = useResponsiveWidth(88);

  useEffect(() => {
    if (businessId) {
      loadBusinessData();
    }
  }, [businessId]);

  const loadBusinessData = async () => {
    if (!businessId) return;

    try {
      setLoading(true);

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
          .order('created_at', { ascending: false });

        if (servicesError) {
          console.error('Erro ao buscar serviços:', servicesError);
        } else if (servicesData) {
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
    const serviceWithCategory = item as any;
    return (
      <ServiceCard
        name={item.name}
        price={item.price}
        photos={item.photos}
        rating={item.rating}
        reviewCount={item.review_count}
        categoryName={serviceWithCategory.categories?.name || null}
        onPress={() => {
          router.push(`/(client)/schedule/service?businessId=${businessId}`);
        }}
      />
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
      <ScreenContainer 
        scroll={false} 
        horizontalPadding={0} 
        backgroundColor="#FAFAFA" 
        hasHeader={true}
        hasTabBar={false}
        header={
          <AppHeader 
            showBackButton={true}
            onPressBack={() => safeGoBack('/(client)/home')}
          />
        }
      >
        <View style={styles.container}>
          <Text style={styles.errorText}>Loja não encontrada</Text>
        </View>
      </ScreenContainer>
    );
  }

  const paymentMethods = businessProfile.accepted_payment_methods || {};
  const priceRange = getPriceRange(services);

  return (
    <ScreenContainer 
      scroll={true}
      hasHeader={true}
      hasTabBar={false}
      horizontalPadding={0}
      backgroundColor="#FAFAFA"
      header={
        <AppHeader 
          showBackButton={true}
          onPressBack={() => safeGoBack('/(client)/home')}
        />
      }
    >
      {/* Background com bricks pattern */}
      <View style={styles.backgroundPattern}>
        <BackgroundSvg 
          width="100%" 
          height="100%" 
          style={styles.backgroundSvg}
          preserveAspectRatio="none"
        />
      </View>

      {/* Hero Section */}
        <View style={styles.heroContainer}>
          <View style={[styles.heroImageContainer, { height: heroHeight }]}>
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
            <View style={[styles.avatarContainer, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }]}>
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
        <Card variant="secondary" padding={16} style={{ marginHorizontal: 24, marginBottom: 8 }}>
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
          <View style={[styles.ratingContainer, { marginTop: 0 }]}>
            <Text style={styles.priceRangeLabel}>Preço médio</Text>
            <Text style={styles.priceRangeValue}>
              {priceRange.slice(0, 3)}
              <Text style={styles.priceRangeInactive}>{priceRange.slice(3)}</Text>
            </Text>
          </View>
        </Card>

        {/* Address Card */}
        {businessProfile.address && (
          <Card variant="secondary" padding={16} style={{ marginHorizontal: 24, marginBottom: 8 }}>
            <Text style={styles.addressText}>{businessProfile.address}</Text>
          </Card>
        )}

        {/* Operating Hours Card */}
        <Card variant="secondary" paddingHorizontal={16} paddingVertical={12} style={{ marginHorizontal: 24, marginBottom: 8, gap: 8 }}>
          <Text style={styles.operatingHoursTitle}>Horário de funcionamento</Text>
          <Text style={styles.operatingHoursText}>
            {formatWorkDays(businessProfile.work_days)}
          </Text>
        </Card>

        {/* Payment Methods Card */}
        <Card variant="secondary" paddingHorizontal={16} paddingVertical={12} style={{ marginHorizontal: 24, marginBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
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
        </Card>

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
              ItemSeparatorComponent={() => <View style={styles.serviceSeparator} />}
              removeClippedSubviews={false}
              initialNumToRender={services.length}
            />
          ) : (
            <Text style={styles.emptyServicesText}>Nenhum serviço disponível</Text>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <CustomButton
            title="Agendar serviços"
            variant="primary"
            onPress={() => {
              if (services.length > 0) {
                router.push(`/(client)/schedule/service?businessId=${businessId}`);
              }
            }}
            rightIcon={<IconSchedule size={24} color="#FEFEFE" />}
            style={{ borderRadius: 24, shadowColor: '#1D1D1D', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.24, shadowRadius: 8, elevation: 4 }}
            width="100%"
          />

          <CustomButton
            title="Avaliar"
            variant="outline"
            onPress={() => {
            }}
            rightIcon={<IconKidStar size={24} color="#000E3D" />}
            style={{ borderRadius: 24, marginTop: 12 }}
            width="100%"
          />
        </View>
    </ScreenContainer>
  );
};

export default StoreProfileScreen;

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
  heroContainer: {
    marginTop: 24,
    marginHorizontal: 24,
    marginBottom: 16,
  },
  heroImageContainer: {
    // height será aplicado dinamicamente via style prop
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
    // height será calculado dinamicamente baseado no avatarSize
    marginTop: -80,
  },
  avatarContainer: {
    // width, height e borderRadius serão aplicados dinamicamente via style prop
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
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    justifyContent: 'space-between',
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
  addressText: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#0F0F0F',
    flex: 1,
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
    paddingTop: 0,
  },
  serviceSeparator: {
    height: 16,
  },
  actionsContainer: {
    marginHorizontal: 24,
    marginBottom: 24,
    gap: 9,
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

