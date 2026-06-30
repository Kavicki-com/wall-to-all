import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { useBusinessProfile } from '../../../context/BusinessProfileContext';
import { formatWorkDays } from '../../../lib/workDaysUtils';
import ScreenContainer from '../../../components/layout/ScreenContainer';
import ServiceCard from '../../../components/ServiceCard';
import BricksBackground from '../../../components/profile/BricksBackground';
import ProfileHero from '../../../components/profile/ProfileHero';
import RatingsRowCard from '../../../components/profile/RatingsRowCard';
import ProfileAddressCard from '../../../components/profile/ProfileAddressCard';
import OperatingHoursCard from '../../../components/profile/OperatingHoursCard';
import PaymentMethodsCard from '../../../components/profile/PaymentMethodsCard';
import SectionTitle from '../../../components/ui/SectionTitle';
import { Icon } from '../../../components/ui/Icon';
import { CustomButton } from '../../../components/CustomButton';
import { getPriceRange } from '../../../lib/utils';
import { logger } from '../../../lib/logger';
import { ServiceListItem, ReviewStats } from '../../../lib/types';
import { colors } from '../../../lib/theme';

type Service = ServiceListItem;

const MerchantProfileScreen: React.FC = () => {
  const router = useRouter();
  const { businessProfile, loading: profileLoading } = useBusinessProfile();
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<Service[]>([]);
  const [reviewStats, setReviewStats] = useState<ReviewStats>({ average_rating: 0, total_reviews: 0 });

  React.useEffect(() => {
    if (businessProfile && !profileLoading) {
      loadBusinessData();
    }
  }, [businessProfile?.id, profileLoading]);

  const loadBusinessData = async () => {
    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !businessProfile) {
        logger.debug('Usuário não autenticado ou perfil não disponível');
        setLoading(false);
        return;
      }

      if (businessProfile) {
        const { data: servicesData, error: servicesError } = await supabase
          .from('services')
          .select('*')
          .eq('business_id', businessProfile.id)
          .order('created_at', { ascending: false });

        if (servicesError) {
          logger.error('Erro ao buscar serviços:', servicesError);
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

        if (servicesData) {
          const servicesWithRatings = await Promise.all(
            servicesData.map(async (service) => {
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
      }
    } catch (error) {
      logger.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderServiceCard = ({ item }: { item: Service }) => (
    <ServiceCard
      name={item.name}
      price={item.price}
      photos={item.photos}
      rating={item.rating}
      reviewCount={item.review_count}
      categoryName={null}
      containerStyle={styles.serviceCard}
      onPress={() => router.push(`/(merchant)/services/edit/${item.id}`)}
    />
  );

  if (loading || profileLoading) {
    return (
      <ScreenContainer scroll={false} backgroundColor={colors.background}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </ScreenContainer>
    );
  }

  if (!businessProfile) {
    return (
      <ScreenContainer scroll={false} backgroundColor={colors.background}>
        <View style={styles.container}>
          <Text style={styles.errorText}>Perfil do negócio não encontrado</Text>
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

        {businessProfile.address && <ProfileAddressCard address={businessProfile.address} />}
        <OperatingHoursCard hours={formatWorkDays(businessProfile.work_days || null)} />

        <PaymentMethodsCard methods={paymentMethods} />

        <TouchableOpacity
          style={styles.editProfileLink}
          onPress={() => router.push('/(merchant)/profile/edit')}
        >
          <Text style={styles.editProfileText}>Editar Perfil</Text>
        </TouchableOpacity>

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
            <Text style={styles.emptyServicesText}>Nenhum serviço cadastrado</Text>
          )}
        </View>

        <View style={styles.bottomButtonContainer}>
          <CustomButton
            title="Cadastrar novo serviço"
            variant="outline"
            onPress={() => router.push('/(merchant)/services/create')}
            style={{ borderRadius: 24, height: 48 }}
            width="100%"
          />
        </View>

      </ScreenContainer>
    </View>
  );
};

export default MerchantProfileScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
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
    marginTop: 8,
  },
  serviceCard: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.textPrimary,
  },
  editProfileLink: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    zIndex: 1,
  },
  editProfileText: {
    fontSize: 14,
    fontFamily: 'Montserrat_700Bold',
    color: colors.brand,
    textDecorationLine: 'none',
  },
  bottomButtonContainer: {
    marginHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
    zIndex: 1,
  },
  emptyServicesText: {
    fontSize: 14,
    fontFamily: 'Montserrat_400Regular',
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 16,
  },
  errorText: {
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: colors.accent,
    textAlign: 'center',
    marginTop: 24,
  },
});