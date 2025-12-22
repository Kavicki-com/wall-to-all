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
import SectionTitle from '../../../components/ui/SectionTitle';
import { getPriceRange } from '../../../lib/utils';
import { CustomButton } from '../../../components/CustomButton';
import { Icon } from '../../../components/ui/Icon';

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
    // loadBusinessData é estável (useCallback), não precisa estar nas dependências
    // Só deve executar quando businessProfile?.id ou profileLoading mudam
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
          const serviceIds = servicesData.map((service) => service.id);
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

          const servicesWithRatings = servicesData.map((service) => {
            const stats = ratingsMap[service.id];
            const count = stats?.count || 0;
            const rating = count > 0 ? stats!.sum / count : undefined;

            return {
              ...service,
              rating,
              review_count: count || undefined,
            };
          });
          setServices(servicesWithRatings as any as Service[]);
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

  return (
    <View style={{ flex: 1 }}>
      <ScreenContainer 
        scroll={true}
        hasHeader={false}
        hasTabBar={false}
        backgroundColor="transparent"
        horizontalPadding={0}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.backgroundContainer}>
          <BricksBackground fillScreen={true} useStoreBackground={true} />
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
        <View style={styles.actionsContainer}>
          <CustomButton
            title="Compartilhar"
            variant="primary"
            onPress={handleShare}
            rightIcon={<Icon name="ios_share" family="MaterialSymbols" size={24} color="#FEFEFE" />}
            style={styles.primaryButton}
            width="100%"
          />

          <CustomButton
            title="Avaliar"
            variant="outline"
            onPress={() => {
              // Navegar para tela de avaliações quando implementada
            }}
            rightIcon={<Icon name="kid_star" family="MaterialSymbols" size={24} color="#000E3D" />}
            style={styles.outlineButton}
            width="100%"
          />
        </View>
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