import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase';
import { formatWorkDays } from '../../../lib/workDaysUtils';
import { Icon } from '../../../components/ui/Icon';
import ScreenContainer from '../../../components/layout/ScreenContainer';
import AppHeader from '../../../components/layout/AppHeader';
import { safeGoBack } from '../../../lib/router-utils';
import ServiceCard from '../../../components/ServiceCard';
import { CustomButton } from '../../../components/CustomButton';
// Shared profile components
import BricksBackground from '../../../components/profile/BricksBackground';
import ProfileHero from '../../../components/profile/ProfileHero';
import RatingsRowCard from '../../../components/profile/RatingsRowCard';
import ProfileAddressCard from '../../../components/profile/ProfileAddressCard';
import OperatingHoursCard from '../../../components/profile/OperatingHoursCard';
import PaymentMethodsCard from '../../../components/profile/PaymentMethodsCard';
import SectionTitle from '../../../components/ui/SectionTitle';
import { logger } from '../../../lib/logger';
import ReviewModal from '../../../components/reviews/ReviewModal';
import { useAuth } from '../../../context/AuthContext';
import { BusinessProfile, Service } from '../../../lib/types';

type ReviewStats = {
  average_rating: number;
  total_reviews: number;
};

const StoreProfileScreen: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const businessId = Number(params.id);
  const { session } = useAuth();
  const clientId = session?.user?.id || null;
const [loading, setLoading] = useState(true);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [reviewStats, setReviewStats] = useState<ReviewStats>({ average_rating: 0, total_reviews: 0 });
  const [reviewModalVisible, setReviewModalVisible] = useState(false);

  useEffect(() => {
if (businessId) {
      loadBusinessData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // loadBusinessData é estável (useCallback), não precisa estar nas dependências
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
logger.error('Erro ao buscar perfil do negócio:', businessError);
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
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (servicesError) {
          logger.error('Erro ao buscar serviços:', servicesError);
        } else if (servicesData) {
          const serviceIds = (servicesData as Service[]).map((service) => service.id);
          let ratingsMap: Record<number, { sum: number; count: number }> = {};

          if (serviceIds.length > 0) {
            const { data: serviceReviews, error: reviewsError } = await supabase
              .from('reviews')
              .select('service_id, rating')
              .in('service_id', serviceIds);

            if (!reviewsError && serviceReviews) {
              ratingsMap = serviceReviews.reduce((acc, review) => {
                if (!review.service_id) return acc;
                if (!acc[review.service_id]) {
                  acc[review.service_id] = { sum: 0, count: 0 };
                }
                acc[review.service_id].sum += review.rating || 0;
                acc[review.service_id].count += 1;
                return acc;
              }, {} as Record<number, { sum: number; count: number }>);
            }
          }

          const servicesWithRatings = (servicesData as Service[]).map((service) => {
            const stats = ratingsMap[service.id];
            const count = stats?.count || 0;
            const rating = count > 0 ? stats!.sum / count : undefined;

            return {
              ...service,
              rating,
              review_count: count || undefined,
            };
          });
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
      logger.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };


  const getPriceRange = (services: Service[]) => {
    if (services.length === 0) return '$----';
    const prices = services.map((s) => s.price).filter((p) => p > 0);
    if (prices.length === 0) return '$----';

    const avg = prices.reduce((sum, p) => sum + p, 0) / prices.length;

    if (avg < 50) return '$----';
    if (avg < 100) return '$$---';
    if (avg < 200) return '$$$--';
    if (avg < 400) return '$$$$-';
    return '$$$$$';
  };

  const renderServiceCard = ({ item }: { item: Service }) => {
    return (
      <ServiceCard
        name={item.name}
        price={item.price}
        photos={item.photos}
        rating={item.rating}
        reviewCount={item.review_count}
        categoryName={item.categories?.name}
        containerStyle={styles.serviceCard}
        onPress={() => {
          router.push(`/(client)/schedule/service?businessId=${businessId}`);
        }}
      />
    );
  };

  if (loading) {
    return (
      <ScreenContainer 
        scroll={false} 
        backgroundColor="#FAFAFA" 
        hasHeader={false}
        hasTabBar={false}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E5102E" />
        </View>
      </ScreenContainer>
    );
  }

  if (!businessProfile) {
    return (
      <ScreenContainer 
        scroll={false} 
        backgroundColor="#FAFAFA" 
        hasHeader={false}
        hasTabBar={false}
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
    <View style={{ flex: 1 }}>
      <ScreenContainer 
        scroll={true}
        hasHeader={true}
        hasTabBar={false}
        backgroundColor="transparent"
        horizontalPadding={0}
        header={
          <AppHeader 
            showBackButton={true}
            onPressBack={() => safeGoBack('/(client)/home')}
          />
        }
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.backgroundContainer}>
          <BricksBackground 
            fillScreen={true}
            useStoreBackground={true}
          />
        </View>
        {/* Top section: Hero and Ratings */}
        <View style={styles.topSection}>
          <ProfileHero
            bannerUrl={businessProfile.banner_url || null}
            logoUrl={businessProfile.logo_url}
            businessName={businessProfile.business_name}
            description={businessProfile.description || businessProfile.categories?.name || undefined}
          />
          <RatingsRowCard
            averageRating={reviewStats.average_rating}
            totalReviews={reviewStats.total_reviews}
            priceRange={priceRange}
            onViewReviews={() => router.push(`/(client)/store/${businessId}/reviews`)}
          />
        </View>
        {/* Address */}
        {businessProfile.address && <ProfileAddressCard address={businessProfile.address} />}
        {/* Operating hours */}
        <OperatingHoursCard hours={formatWorkDays(businessProfile.work_days || null)} />
        {/* Accepted payment methods */}
        <PaymentMethodsCard methods={paymentMethods} />
        {/* Services section */}
        <View style={styles.servicesSection}>
          <SectionTitle>Serviços</SectionTitle>
          {services.length > 0 ? (
            <FlatList
              data={services}
              renderItem={renderServiceCard}
              keyExtractor={(item) => item.id.toString()}
              scrollEnabled={false}
              contentContainerStyle={{ gap: 16 }}
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
            rightIcon={<Icon name="calendar_clock" family="MaterialSymbols" size={24} color="#FEFEFE" />}
            style={styles.primaryButton}
            width="100%"
          />

          <CustomButton
            title="Avaliar"
            variant="outline"
            onPress={() => {
              if (!clientId) {
                Alert.alert('Atenção', 'Você precisa estar autenticado para avaliar', [
                  { text: 'OK' },
                  {
                    text: 'Fazer login',
                    onPress: () => router.push('/(auth)/login'),
                  },
                ]);
                return;
              }
              setReviewModalVisible(true);
            }}
            rightIcon={<Icon name="kid_star" family="MaterialSymbols" size={24} color="#000E3D" />}
            style={styles.outlineButton}
            width="100%"
          />
        </View>
      </ScreenContainer>

      <ReviewModal
        visible={reviewModalVisible}
        onClose={() => setReviewModalVisible(false)}
        businessId={businessId.toString()}
        clientId={clientId}
        onReviewSubmitted={() => {
          // Recarregar dados após avaliação
          loadBusinessData();
        }}
      />
    </View>
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
  scrollContent: {
    flexGrow: 1,
  },
  backgroundContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  topSection: {
    gap: 0,
    zIndex: 1,
  },
  servicesSection: {
    marginHorizontal: 24,
    marginBottom: 16,
    zIndex: 1,
  },
  serviceCard: {
    width: '100%',
  },
  actionsContainer: {
    marginHorizontal: 24,
    marginTop: 16,
    marginBottom: 24,
    gap: 9,
    zIndex: 1,
  },
  primaryButton: {
    borderRadius: 24,
    height: 48,
    shadowColor: '#1D1D1D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.24,
    shadowRadius: 8,
    elevation: 4,
  },
  outlineButton: {
    borderRadius: 24,
    height: 48,
    marginTop: 0,
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
});

