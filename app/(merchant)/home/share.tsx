import React, { useState } from 'react';
import { useBusinessProfile } from '../../../context/BusinessProfileContext';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase';
import { formatWorkDays } from '../../../lib/workDaysUtils';
import { handleError } from '../../../lib/errorHandler';
import ScreenContainer from '../../../components/layout/ScreenContainer';
import ServiceCard from '../../../components/ServiceCard';
// New shared profile components
import BricksBackground from '../../../components/profile/BricksBackground';
import ProfileHero from '../../../components/profile/ProfileHero';
import RatingsRowCard from '../../../components/profile/RatingsRowCard';
import ProfileAddressCard from '../../../components/profile/ProfileAddressCard';
import OperatingHoursCard from '../../../components/profile/OperatingHoursCard';
import PaymentMethodsCard from '../../../components/profile/PaymentMethodsCard';
import ProfileActions from '../../../components/profile/ProfileActions';
import SectionTitle from '../../../components/ui/SectionTitle';

type Service = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  photos: string[] | string | null;
  rating?: number;
  review_count?: number;
  categories?: {
    id: number;
    name: string;
  } | null;
};

type ReviewStats = {
  average_rating: number;
  total_reviews: number;
};

const ShareProfileScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { businessProfile, loading: profileLoading } = useBusinessProfile();
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<Service[]>([]);
  const [reviewStats, setReviewStats] = useState<ReviewStats>({ average_rating: 0, total_reviews: 0 });

  // Carregar dados quando o perfil do negócio estiver disponível
  React.useEffect(() => {
    if (businessProfile && !profileLoading) {
      loadBusinessData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessProfile?.id, profileLoading]);

  const loadBusinessData = async () => {
    try {
      setLoading(true);

      if (!businessProfile) {
        setLoading(false);
        return;
      }

      // Perfil do negócio agora vem do BusinessProfileContext, não precisa buscar aqui
      if (businessProfile) {
        const { data: servicesData, error: servicesError } = await supabase
          .from('services')
          .select(`
            *,
            categories:category_id (
              id,
              name
            )
          `)
          .eq('business_id', businessProfile.id)
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (servicesError) {
          handleError(servicesError, 'service');
        } else if (servicesData) {
          const serviceIds = (servicesData as Service[]).map((service) => service.id);
          let ratingsMap: Record<string, { sum: number; count: number }> = {};

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
              }, {} as Record<string, { sum: number; count: number }>);
            } else if (reviewsError) {
              handleError(reviewsError, 'service');
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
          .eq('business_id', businessProfile.id);

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
      handleError(error, 'general');
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

  const handleShare = async () => {
    if (!businessProfile) return;

    try {
      const shareUrl = `https://wall-to-all.com/store/${businessProfile.id}`;
      const message = `Conheça ${businessProfile.business_name} no Wall-to-all! ${shareUrl}`;
      await Share.share({
        message,
        url: shareUrl,
      });
    } catch (error) {
      handleError(error, 'general');
    }
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
          // Navegação para página do serviço será implementada
        }}
      />
    );
  };

  if (loading || profileLoading) {
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
          <Text style={styles.errorText}>Perfil não encontrado</Text>
        </View>
      </ScreenContainer>
    );
  }

  const paymentMethods = businessProfile.accepted_payment_methods || {};
  const priceRange = getPriceRange(services);

  // Calcula o paddingBottom: safe area bottom + 9px para os botões ficarem a 9px da margem inferior
  const paddingBottom = Math.max(insets.bottom, 0) + 9;

  return (
    <View style={{ flex: 1 }}>
      <BricksBackground fillScreen={true} />
      <ScreenContainer 
        scroll={true}
        hasHeader={false}
        hasTabBar={false}
        backgroundColor="transparent"
        horizontalPadding={0}
        contentContainerStyle={{ ...styles.scrollContent, paddingBottom }}
      >
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
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              contentContainerStyle={{ gap: 16 }}
            />
          ) : (
            <Text style={styles.emptyServicesText}>Nenhum serviço disponível</Text>
          )}
        </View>
        {/* Action buttons */}
        <ProfileActions
          onShare={handleShare}
          onReview={() => {
            // Navegar para tela de avaliações quando implementada
          }}
        />
      </ScreenContainer>
    </View>
  );
};

export default ShareProfileScreen;

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
  topSection: {
    gap: 0,
  },
  servicesSection: {
    marginHorizontal: 24,
    marginBottom: 6,
  },
  serviceCard: {
    width: '100%',
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