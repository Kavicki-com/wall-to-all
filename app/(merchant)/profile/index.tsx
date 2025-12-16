import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
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
import OperatingHoursCard from '../../../components/profile/OperatingHoursCard';
import PaymentMethodsCard from '../../../components/profile/PaymentMethodsCard';
import SectionTitle from '../../../components/ui/SectionTitle';

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


const MerchantProfileScreen: React.FC = () => {
  const router = useRouter();
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

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !businessProfile) {
        console.log('Usuário não autenticado ou perfil não disponível');
        setLoading(false);
        return;
      }

      // Perfil do negócio agora vem do BusinessProfileContext, não precisa buscar aqui

      // Buscar serviços do negócio
      if (businessProfile) {
        const { data: servicesData, error: servicesError } = await supabase
          .from('services')
          .select('*')
          .eq('business_id', businessProfile.id)
          .order('created_at', { ascending: false });

        if (servicesError) {
          console.error('Erro ao buscar serviços:', servicesError);
        } else if (servicesData) {
          // Os serviços serão atualizados com ratings abaixo
          // setServices(servicesData as Service[]);
        }

        // Buscar estatísticas de avaliações do negócio
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

        // Buscar avaliações por serviço para calcular ratings individuais
        if (servicesData) {
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
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
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
      <ScreenContainer scroll={false} backgroundColor="#FAFAFA">
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E5102E" />
        </View>
      </ScreenContainer>
    );
  }

  if (!businessProfile) {
    return (
      <ScreenContainer scroll={false} backgroundColor="#FAFAFA">
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
      <BricksBackground fillScreen={true} />
      <ScreenContainer 
        scroll={true}
        hasHeader={false}
        backgroundColor="transparent"
        horizontalPadding={0}
        contentContainerStyle={styles.scrollContent}
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
        {/* Operating hours */}
        <OperatingHoursCard hours={formatWorkDays(businessProfile.work_days || null)} />
        {/* Accepted payment methods */}
        <PaymentMethodsCard methods={paymentMethods} />
        {/* Edit Profile Button */}
        <TouchableOpacity
          style={styles.editProfileButton}
          activeOpacity={0.8}
          onPress={() => router.push('/(merchant)/profile/edit')}
        >
          <Text style={styles.editProfileButtonText}>Editar Perfil</Text>
        </TouchableOpacity>
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
            <Text style={styles.emptyServicesText}>Nenhum serviço cadastrado</Text>
          )}
          {/* Add Service Button */}
          <TouchableOpacity
            style={styles.addServiceButton}
            activeOpacity={0.8}
            onPress={() => router.push('/(merchant)/services/create')}
          >
            <Text style={styles.addServiceButtonText}>Cadastrar novo serviço</Text>
          </TouchableOpacity>
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
    backgroundColor: '#FAFAFA',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  topSection: {
    gap: 0,
  },
  editProfileButton: {
    marginHorizontal: 24,
    marginBottom: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
  },
  editProfileButtonText: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#000E3D',
  },
  servicesSection: {
    marginHorizontal: 24,
    marginBottom: 6,
  },
  serviceCard: {
    width: '100%',
  },
  addServiceButton: {
    borderWidth: 1,
    borderColor: '#000E3D',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  addServiceButtonText: {
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
});
