import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { formatWorkDays } from '../../../lib/workDaysUtils';
import { IconPix, IconCreditCard, IconCash, IconRatingStar } from '../../../lib/icons';
import { LinearGradient } from 'expo-linear-gradient';

type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  email?: string;
  created_at?: string;
};

type Service = {
  id: string;
  name: string;
  price: number;
  photos: string[] | string | null;
  rating?: number;
  review_count?: number;
  category?: string;
};

type Business = {
  id: string;
  business_name: string;
  logo_url: string | null;
  hero_image_url: string | null;
  category: string | null;
  description: string | null;
  work_days: Record<string, { start: string; end: string }> | null;
  accepted_payment_methods: {
    pix?: boolean;
    card?: boolean;
    cash?: boolean;
  } | null;
  services?: Array<{ id: string; name: string; price: number }>;
};

type Appointment = {
  id: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  service: {
    name: string;
  };
  business: {
    business_name: string;
  };
};

const ClientProfileScreen: React.FC = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [averageRating, setAverageRating] = useState(0);
  const [avatarKey, setAvatarKey] = useState(0); // Para forçar atualização da imagem

  // Recarregar perfil quando a tela receber foco (ex: ao voltar da edição)
  useFocusEffect(
    React.useCallback(() => {
    loadProfile();
    }, [])
  );

  const loadProfile = async () => {
    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        console.log('Usuário não autenticado');
        setLoading(false);
        return;
      }

      // Buscar perfil
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('Erro ao buscar perfil:', profileError);
      } else if (profileData) {
        setProfile(profileData as Profile);
        // Atualizar key para forçar recarregamento da imagem
        if (profileData.avatar_url) {
          setAvatarKey(Date.now());
        }
      }

      // Buscar agendamentos
      const { data: appointmentsData } = await supabase
        .from('appointments')
        .select(
          `*,
          service:services(name),
          business:business_profiles(business_name)`
        )
        .eq('client_id', user.id)
        .limit(10);

      if (appointmentsData) {
        setAppointments(appointmentsData as Appointment[]);
      }

      // Buscar serviços mais contratados
      const { data: servicesData } = await supabase
        .from('services')
        .select('*')
        .in(
          'id',
          appointmentsData?.map((a: any) => a.service_id).filter(Boolean) || []
        )
        .limit(10);

      if (servicesData) {
        // Buscar ratings para serviços
        const servicesWithRatings = await Promise.all(
          (servicesData as Service[]).map(async (service) => {
            const { data: reviews } = await supabase
              .from('reviews')
              .select('rating')
              .eq('service_id', service.id);

            const rating =
              reviews && reviews.length > 0
                ? reviews.reduce((sum, r) => sum + (r.rating || 0), 0) / reviews.length
                : undefined;
            const reviewCount = reviews?.length || undefined;

            return {
              ...service,
              rating,
              review_count: reviewCount,
            };
          })
        );
        setServices(servicesWithRatings.slice(0, 2));
      }

      // Buscar profissionais mais contratados
      const businessIds = [
        ...new Set(
          appointmentsData?.map((a: any) => a.business_id).filter(Boolean) || []
        ),
      ];

      if (businessIds.length > 0) {
        const { data: businessesData } = await supabase
          .from('business_profiles')
          .select('*, services(id, name, price)')
          .in('id', businessIds)
          .limit(3);

        if (businessesData) {
          setBusinesses(businessesData as Business[]);
        }
      }

      // Calcular média de avaliações
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
      console.error('Erro ao carregar perfil:', error);
    } finally {
      setLoading(false);
    }
  };

  const getClientSinceYear = () => {
    if (!profile?.created_at) return '2025';
    const year = new Date(profile.created_at).getFullYear();
    return year.toString();
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E5102E" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Container */}
        <View style={styles.profileContainer}>
          <View style={styles.profileAvatarContainer}>
            {profile?.avatar_url ? (
              <Image
                source={{
                  uri: profile.avatar_url + (profile.avatar_url.includes('?') ? '&' : '?') + `_t=${avatarKey}`,
                }}
                style={styles.avatar}
                key={`${profile.avatar_url}-${avatarKey}`} // Force re-render quando URL ou key mudar
              />
            ) : (
              <View style={[styles.avatar, styles.placeholderAvatar]} />
            )}
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{profile?.full_name || 'Usuário'}</Text>
            <Text style={styles.profileSince}>Cliente desde {getClientSinceYear()}</Text>
          </View>
        </View>

        {/* Ratings Card */}
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

        {/* Payment Methods Card */}
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

        {/* Services Section */}
        {services.length > 0 && (
          <View style={styles.servicesSection}>
            <Text style={styles.sectionTitle}>Serviços mais contratados</Text>
            <View style={styles.servicesList}>
              {services.map((service) => {
                let imagesArray: string[] = [];
                if (service.photos) {
                  if (typeof service.photos === 'string') {
                    try {
                      imagesArray = JSON.parse(service.photos);
                    } catch {
                      imagesArray = [service.photos];
                    }
                  } else if (Array.isArray(service.photos)) {
                    imagesArray = service.photos;
                  }
                }
                const firstImage = imagesArray.length > 0 ? imagesArray[0] : null;

                return (
                  <View key={service.id} style={styles.serviceCard}>
                    <View style={styles.serviceImageContainer}>
                      {firstImage ? (
                        <Image
                          source={{ uri: firstImage }}
                          style={styles.serviceImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={[styles.serviceImage, styles.placeholderImage]} />
                      )}
                      {service.category && (
                        <View style={styles.serviceCategoryBadge}>
                          <Text style={styles.serviceCategoryText}>{service.category}</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.serviceInfo}>
                      <Text style={styles.serviceName}>{service.name}</Text>
                      <View style={styles.serviceRatingContainer}>
                        <Text style={styles.serviceRatingValue}>
                          {service.rating?.toFixed(1) || '4.9'}
                        </Text>
                        {[...Array(5)].map((_, i) => (
                          <IconRatingStar key={i} size={24} color="#FFD700" />
                        ))}
                        <Text style={styles.serviceReviewCount}>
                          ({service.review_count || 30})
                        </Text>
                      </View>
                      <Text style={styles.servicePrice}>
                        R$ {service.price.toFixed(2).replace('.', ',')}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Businesses Section */}
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
              {businesses.map((business) => {
                const businessServices = business.services || [];
                const priceRange = getPriceRange(businessServices);

                return (
                  <TouchableOpacity
                    key={business.id}
                    style={styles.businessCard}
                    onPress={() => router.push(`/(client)/store/${business.id}`)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.businessHeroContainer}>
                      <View style={styles.businessImageContainer}>
                        {business.hero_image_url ? (
                          <Image
                            source={{ uri: business.hero_image_url }}
                            style={styles.businessHeroImage}
                            resizeMode="cover"
                          />
                        ) : business.logo_url ? (
                          <Image
                            source={{ uri: business.logo_url }}
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
                        <View style={styles.businessProfileContainer}>
                          <View style={styles.businessAvatarContainer}>
                            {business.logo_url ? (
                              <Image
                                source={{ uri: business.logo_url }}
                                style={styles.businessAvatar}
                              />
                            ) : (
                              <View style={[styles.businessAvatar, styles.placeholderAvatar]} />
                            )}
                          </View>
                          <View style={styles.businessInfo}>
                            <Text style={styles.businessName}>{business.business_name}</Text>
                            <Text style={styles.businessCategory}>
                              {business.category || 'Serviços profissionais'}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>
                    <View style={styles.priceRangeContainer}>
                      <Text style={styles.priceRangeLabel}>Preço médio</Text>
                      <Text style={styles.priceRangeValue}>
                        {priceRange.slice(0, 3)}
                        <Text style={styles.priceRangeInactive}>{priceRange.slice(3)}</Text>
                      </Text>
                    </View>
                    {businessServices.length > 0 && (
                      <View style={styles.servicePillsContainer}>
                        {businessServices.slice(0, 4).map((service) => (
                          <View key={service.id} style={styles.servicePill}>
                            <Text style={styles.servicePillText}>{service.name}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                    <View style={styles.operatingHours}>
                      <Text style={styles.operatingHoursTitle}>Horário de funcionamento</Text>
                      <Text style={styles.operatingHoursText}>
                        {formatWorkDays(business.work_days)}
                      </Text>
                    </View>
                    <View style={styles.paymentMethods}>
                      <Text style={styles.paymentMethodsTitle}>Pagamentos aceitos</Text>
                      <View style={styles.paymentMethodsRow}>
                        {business.accepted_payment_methods?.pix && (
                          <View style={styles.paymentMethodItem}>
                            <IconPix width={16} height={16} />
                            <Text style={styles.paymentMethodText}>PIX</Text>
                          </View>
                        )}
                        {business.accepted_payment_methods?.card && (
                          <View style={styles.paymentMethodItem}>
                            <IconCreditCard width={16} height={16} />
                            <Text style={styles.paymentMethodText}>Cartão</Text>
                          </View>
                        )}
                        {business.accepted_payment_methods?.cash && (
                          <View style={styles.paymentMethodItem}>
                            <IconCash width={16} height={16} />
                            <Text style={styles.paymentMethodText}>Dinheiro</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

export default ClientProfileScreen;

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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 32,
    paddingBottom: 100,
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
    width: 88,
    height: 88,
    borderRadius: 44,
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
    width: 342,
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
    width: 342,
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
    width: 305,
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
    width: 342,
    marginBottom: 16,
    gap: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#E5102E',
    marginBottom: 0,
  },
  servicesList: {
    flexDirection: 'row',
    gap: 16,
  },
  serviceCard: {
    gap: 8,
    width: 194,
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
  placeholderImage: {
    backgroundColor: '#E0E0E0',
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
  businessesSection: {
    width: 342,
    marginBottom: 16,
    gap: 16,
  },
  businessesList: {
    gap: 10,
  },
  businessCard: {
    backgroundColor: '#FEFEFE',
    borderRadius: 16,
    overflow: 'hidden',
    width: 255,
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
});
