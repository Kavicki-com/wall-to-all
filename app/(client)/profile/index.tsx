import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { useProfile } from '../../../context/ProfileContext';
import { IconPix, IconCreditCard, IconRatingStar } from '../../../lib/icons';
import { useCardWidth, useResponsiveWidth } from '../../../lib/responsive';
import { BusinessCard } from '../../../components/BusinessCard';
import ScreenContainer from '../../../components/layout/ScreenContainer';
import ServiceCategoryCard from '../../../components/ServiceCategoryCard';
import { applyAcceptedReschedules } from '../../../lib/utils';
import { logger } from '../../../lib/logger';
import { Service, BusinessProfile as Business, Appointment } from '../../../lib/types';

const ClientProfileScreen: React.FC = () => {
  const router = useRouter();
  const { profile, loading: profileLoading } = useProfile();
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [averageRating, setAverageRating] = useState(0);
  const [avatarKey, setAvatarKey] = useState(0);

  const businessCardWidth = useCardWidth(1.5, 24, 10);
  const businessGap = 10;

  const serviceCardWidth = useCardWidth(2, 24, 14);
  const serviceGap = 14;

  const avatarSize = useResponsiveWidth(88);

  React.useEffect(() => {
    if (profile?.avatar_url) {
      setAvatarKey(Date.now());
    }
  }, [profile?.avatar_url]);

  React.useEffect(() => {
    if (profile && !profileLoading) {
      loadProfile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // loadProfile é estável (useCallback), não precisa estar nas dependências
  }, [profile?.id, profileLoading]);

  const loadProfile = async () => {
    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data: appointmentsData, error: appointmentsError } = await supabase
        .from('appointments')
        .select(
          `id, start_time, end_time, status, payment_method, service_id, business_id,
          service:services(name),
          business:business_profiles(business_name)`
        )
        .eq('client_id', user.id)
        .limit(10);

      if (appointmentsError) {
        if (__DEV__) {
          logger.error('Erro ao buscar agendamentos:', appointmentsError);
        }
      } else if (appointmentsData) {
        const appointmentsWithReschedules = await applyAcceptedReschedules(appointmentsData);
        setAppointments(appointmentsWithReschedules as Appointment[]);
      }

      const serviceIds =
        appointmentsData
          ?.map((a: { service_id: number | null }) => a.service_id)
          .filter(Boolean) || [];

      const { data: servicesData, error: servicesError } = await supabase
        .from('services')
        .select(`
          id, name, price, photos, category_id,
          categories:category_id (
            id,
            name
          )
        `)
        .in('id', serviceIds)
        .range(0, 9);

      if (servicesError) {
        if (__DEV__) {
          logger.error('Erro ao buscar serviços:', servicesError);
        }
      } else if (servicesData) {
        let ratingsMap: Record<number, { sum: number; count: number }> = {};

        if (serviceIds.length > 0) {
          const { data: reviewsData, error: reviewsError } = await supabase
            .from('reviews')
            .select('service_id, rating')
            .in('service_id', serviceIds.filter((id): id is number => id !== null));

          if (!reviewsError && reviewsData) {
            ratingsMap = reviewsData.reduce((acc, review) => {
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
        setServices(servicesWithRatings.slice(0, 10));
      }

      const businessIds = [
        ...new Set(
          appointmentsData?.map((a: { business_id: number | null }) => a.business_id).filter(Boolean) || []
        ),
      ];

      if (businessIds.length > 0) {
        const { data: businessesData } = await supabase
          .from('business_profiles')
          .select(`
            *,
            services(id, name, price),
            categories:category_id (
              id,
              name
            )
          `)
          .in('id', businessIds.filter((id): id is number => id !== null))
          .limit(3);

        if (businessesData) {
          setBusinesses(businessesData as Business[]);
        }
      }

      const { data: allReviews } = await supabase
        .from('reviews')
        .select('rating')
        .eq('client_id', user.id);

      if (allReviews && allReviews.length > 0) {
        const avg =
          allReviews.reduce((sum, r) => sum + (r.rating || 0), 0) /
          allReviews.length;
        setAverageRating(avg);
      }
    } catch (error) {
      if (__DEV__) {
        logger.error('Erro ao carregar perfil:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const getClientSinceYear = () => {
    if (!profile?.created_at) return '2025';
    const year = new Date(profile.created_at).getFullYear();
    return year.toString();
  };

  const renderServiceCard = ({ item }: { item: Service }) => (
    <ServiceCategoryCard
      id={item.id}
      name={item.name}
      price={item.price}
      photos={item.photos}
      rating={item.rating}
      reviewCount={item.review_count}
      category={item.categories?.name || null}
    />
  );

  if (loading || profileLoading) {
    return (
      <ScreenContainer 
        style={{ backgroundColor: '#FAFAFA' }} 
        hasHeader={false}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E5102E" />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer 
      scroll={true}
      hasHeader={false}
      backgroundColor="#FAFAFA"
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.defaultPadding}>
        <View style={styles.profileContainer}>
          <View style={styles.profileAvatarContainer}>
            {profile?.avatar_url ? (
              <Image
                source={{
                  uri: profile.avatar_url + (profile.avatar_url.includes('?') ? '&' : '?') + `_t=${avatarKey}`,
                }}
                style={[styles.avatar, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }]}
                key={`${profile.avatar_url}-${avatarKey}`}
              />
            ) : (
              <View style={[styles.avatar, styles.placeholderAvatar, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }]} />
            )}
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{profile?.full_name || 'Usuário'}</Text>
            <Text style={styles.profileSince}>Cliente desde {getClientSinceYear()}</Text>
          </View>
        </View>

        <View style={styles.ratingsCard}>
          <View style={styles.ratingItem}>
            <Text style={styles.ratingLabel}>Agendamentos</Text>
            <Text style={styles.ratingValue}>{appointments.length}</Text>
          </View>
          <View style={styles.ratingItem}>
            <Text style={styles.ratingLabel}>Avaliação</Text>
            <View style={styles.ratingStarsContainer}>
              <Text style={styles.ratingValue}>{averageRating.toFixed(1)}</Text>
              <IconRatingStar size={24} color="#FFD700" />
            </View>
          </View>
        </View>

        <View style={styles.paymentMethodsCard}>
          <Text style={styles.paymentMethodsTitle}>
            Meus métodos de pagamento mais usados
          </Text>
          <View style={styles.paymentMethodsRow}>
            <View style={styles.paymentMethodItem}>
              <IconPix width={24} height={24} />
              <Text style={styles.paymentMethodText}>PIX</Text>
            </View>
            <View style={styles.paymentMethodItem}>
              <IconCreditCard width={24} height={24} />
              <Text style={styles.paymentMethodText}>Cartão</Text>
            </View>
          </View>
        </View>
      </View>

      {services.length > 0 && (
        <View style={styles.servicesSection}>
          <Text style={styles.sectionTitle}>Serviços mais contratados</Text>
          <FlatList
            data={services}
            renderItem={renderServiceCard}
            keyExtractor={(item) => item.id.toString()}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.servicesList}
            initialNumToRender={3}
            maxToRenderPerBatch={5}
            windowSize={5}
            removeClippedSubviews={true}
            getItemLayout={(data, index) => ({
              length: serviceCardWidth + serviceGap,
              offset: (serviceCardWidth + serviceGap) * index,
              index,
            })}
          />
        </View>
      )}

      {businesses.length > 0 && (
        <View style={styles.businessesSection}>
          <Text style={styles.sectionTitle}>
            Profissionais mais contratados por você
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.businessesList}
          >
            {businesses.map((business) => (
              <View key={business.id.toString()} style={{ marginRight: businessGap }}>
                <BusinessCard
                  id={business.id}
                  business_name={business.business_name}
                  logo_url={business.logo_url}
                  banner_url={business.banner_url}
                  description={business.description}
                  category={business.categories?.name || null}
                  accepted_payment_methods={business.accepted_payment_methods as any}
                  work_days={business.work_days as any}
                  services={business.services as any}
                  categories={business.categories}
                  width={businessCardWidth}
                  onPress={(id) => router.push(`/(client)/store/${id}`)}
                />
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </ScreenContainer>
  );
};

export default ClientProfileScreen;

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 32,
    paddingTop: 16,
    paddingHorizontal: 0,
  },
  defaultPadding: {
    paddingHorizontal: 24,
    width: '100%',
    alignItems: 'center',
  },
  profileContainer: {
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  profileAvatarContainer: {
    marginBottom: 0,
  },
  avatar: {
    // dynamic
  },
  placeholderAvatar: {
    backgroundColor: '#E0E0E0',
  },
  profileInfo: {
    alignItems: 'center',
    gap: 4,
  },
  profileName: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#0F0F0F',
    textAlign: 'center',
  },
  profileSince: {
    fontSize: 8,
    fontFamily: 'Montserrat_500Medium',
    color: '#0F0F0F',
  },
  ratingsCard: {
    backgroundColor: '#FEFEFE',
    borderRadius: 4,
    padding: 16,
    marginBottom: 16,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#1D1D1D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  ratingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  ratingLabel: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#0F0F0F',
  },
  ratingValue: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#474747',
  },
  ratingStarsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  paymentMethodsCard: {
    backgroundColor: '#FEFEFE',
    borderRadius: 4,
    padding: 12,
    marginBottom: 16,
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    minWidth: 0,
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
    fontFamily: 'Montserrat_400Regular',
    color: '#0F0F0F',
  },
  servicesSection: {
    width: '100%',
    marginBottom: 16,
    gap: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#E5102E',
    marginBottom: 0,
    paddingHorizontal: 24,
  },
  servicesList: {
    paddingHorizontal: 24,
    paddingRight: 32,
  },
  businessesSection: {
    width: '100%',
    marginBottom: 16,
    gap: 16,
  },
  businessesList: {
    paddingHorizontal: 24,
    paddingRight: 32,
    paddingVertical: 4,
  },
});