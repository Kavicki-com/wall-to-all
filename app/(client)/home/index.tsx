import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { sortCategories } from '../../../lib/categoryUtils';
import { formatWorkDays } from '../../../lib/workDaysUtils';
import { IconPix, IconCreditCard, IconCash, IconRatingStar, IconSearch, IconFilter, IconSelfCare } from '../../../lib/icons';
import { useCardWidth } from '../../../lib/responsive';
import { MerchantTopBar } from '../../../components/MerchantTopBar';

type Appointment = {
  id: string;
  client_id: string;
  start_time: string;
  service: {
    id: string;
    name: string;
  };
  business: {
    business_name: string;
    logo_url: string | null;
  };
};

type BusinessProfile = {
  id: string;
  business_name: string;
  category: string | null;
  logo_url: string | null;
  hero_image_url?: string | null;
  description: string | null;
  accepted_payment_methods: {
    pix?: boolean;
    card?: boolean;
    cash?: boolean;
  } | null;
  work_days: Record<string, { start: string; end: string }> | null;
  services?: Array<{ id: string; name: string }>;
  categories?: {
    id: number;
    name: string;
  };
};

type Service = {
  id: string;
  name: string;
  price: number;
  photos: string[] | string | null;
  business_profiles: {
    business_name: string;
  } | null;
  business_id: string;
  rating?: number;
  review_count?: number;
  categories?: {
    id: number;
    name: string;
  } | null;
};

const ClientHomeScreen: React.FC = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [allFeaturedBusinesses, setAllFeaturedBusinesses] = useState<BusinessProfile[]>([]);
  const [allPopularServices, setAllPopularServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<Array<{ id: number; name: string }>>([]);

  // Cards de negócios (~1.5 visíveis em scroll horizontal)
  const businessCardWidth = useCardWidth(1.5, 24, 10);
  const businessGap = 10; // Gap entre cards de negócios (marginRight)

  // Cards de serviços (~2 visíveis em scroll horizontal)
  const serviceCardWidth = useCardWidth(2, 24, 14);
  const serviceGap = 14; // Gap entre cards de serviços (marginRight)

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
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

      // 1. Buscar agendamentos
      const { data: appointmentsData } = await supabase
        .from('appointments')
        .select('*, service:services(id, name), business:business_profiles(business_name, logo_url)')
        .eq('client_id', user.id)
        .order('start_time', { ascending: true })
        .gte('start_time', new Date().toISOString())
        .limit(3)
        .order('start_time', { ascending: true });

      if (appointmentsData) {
        setAppointments(appointmentsData as Appointment[]);
      }

      // 2. Buscar lojas em destaque
      const { data: businessesData } = await supabase
        .from('business_profiles')
        .select(`
          *,
          categories:category_id (
            id,
            name
          ),
          services (
            id,
            name
          )
        `)
        .limit(10);

      if (businessesData) {
        setAllFeaturedBusinesses(businessesData as BusinessProfile[]);
      }

      // 3. Buscar serviços mais contratados
      const { data: servicesData } = await supabase
        .from('services')
        .select(`
          *,
          categories:category_id (
            id,
            name
          ),
          business_profiles(business_name)
        `)
        .eq('is_active', true)
        .limit(10)
        .order('created_at', { ascending: false });

      if (servicesData) {
        setAllPopularServices(servicesData as Service[]);
      }

      // 4. Buscar categorias do banco de dados
      const { data: categoriesData } = await supabase
        .from('categories')
        .select('id, name')
        .order('name', { ascending: true });

      if (categoriesData) {
        // Ordenar: alfabética, mas "outros" sempre por último
        const sortedCategories = sortCategories(categoriesData);
        setCategories(sortedCategories);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };


  // ✅ Componente memoizado para evitar re-renders desnecessários
  const BusinessCard = React.memo<{ item: BusinessProfile }>(({ item }) => {
    const paymentMethods = item.accepted_payment_methods || {};
    const services = item.services || [];

    return (
      <TouchableOpacity
        style={styles.businessCard}
        activeOpacity={0.8}
        onPress={() => {
          router.push(`/(client)/store/${item.id}`);
        }}
        accessibilityRole="button"
        accessibilityLabel={`Loja ${item.business_name}`}
        accessibilityHint="Toque para ver detalhes da loja"
      >
        {/* Hero Image com Avatar sobreposto */}
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
            {/* Profile Avatar e Info sobrepostos na parte inferior da imagem */}
            <View style={styles.businessProfileContainer}>
              <View style={styles.businessAvatarContainer}>
                {item.logo_url ? (
                  <Image
                    source={{ uri: item.logo_url }}
                    style={styles.businessAvatar}
                  />
                ) : (
                  <View style={[styles.businessAvatar, styles.placeholderAvatar]} />
                )}
              </View>
              <View style={styles.businessInfo}>
                <Text style={styles.businessName}>{item.business_name}</Text>
                <Text style={styles.businessDescription}>
                  {item.description || 'Serviços profissionais'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Preço médio - FORA do banner */}
        <View style={styles.priceRangeContainer}>
          <Text style={styles.priceRangeLabel}>Preço médio</Text>
          <Text style={styles.priceRangeValue}>
            $$$<Text style={styles.priceRangeInactive}>$$</Text>
          </Text>
        </View>

        {/* Service Pills */}
        {services.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.servicePillsContainer}
          >
            {services.slice(0, 8).map((service) => (
              <View key={service.id} style={styles.servicePill}>
                <Text style={styles.servicePillText}>{service.name}</Text>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Horário de funcionamento */}
        <View style={styles.operatingHours}>
          <Text style={styles.operatingHoursTitle}>Horário de funcionamento</Text>
          <Text style={styles.operatingHoursText}>
            {formatWorkDays(item.work_days)}
          </Text>
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
  });

  const renderBusinessCard = ({ item }: { item: BusinessProfile }) => (
    <BusinessCard item={item} />
  );

  // ✅ Componente memoizado para evitar re-renders desnecessários
  const ServiceCard = React.memo<{ item: Service }>(({ item }) => {
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
    
    const categoryName = item.categories?.name || item.business_profiles?.business_name || 'Serviço';

    return (
      <TouchableOpacity
        style={styles.serviceCard}
        activeOpacity={0.8}
        onPress={() => {
          // Ir para o perfil da loja que oferece o serviço
          router.push(`/(client)/store/${item.business_id}`);
        }}
        accessibilityRole="button"
        accessibilityLabel={`Serviço: ${item.name}`}
        accessibilityHint="Toque para ver detalhes do serviço"
      >
        {/* Service Image */}
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
          {/* Category Badge */}
          <View style={styles.serviceBadge}>
            <Text style={styles.serviceBadgeText}>{categoryName}</Text>
          </View>
        </View>

        {/* Service Info */}
        <View style={styles.serviceInfo}>
          <Text style={styles.serviceName} numberOfLines={2}>
            {item.name}
          </Text>
          <View style={styles.serviceRatingContainer}>
            <View style={styles.serviceRating}>
              <Text style={styles.serviceRatingValue}>
                {item.rating || 4.9}
              </Text>
              {[1, 2, 3, 4, 5].map((star) => (
                <IconRatingStar key={star} size={12} color="#FFD700" />
              ))}
              <Text style={styles.serviceRatingCount}>
                ({item.review_count || 30})
              </Text>
            </View>
          </View>
          <Text style={styles.servicePrice}>
            R$ {item.price.toFixed(2).replace('.', ',')}
          </Text>
        </View>
      </TouchableOpacity>
    );
  });

  const renderServiceCard = ({ item }: { item: Service }) => (
    <ServiceCard item={item} />
  );

  // Estilos dinâmicos usando useMemo
  const styles = useMemo(() => StyleSheet.create({
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
    paddingBottom: 100,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 8,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEFEFE',
    borderWidth: 1,
    borderColor: '#474747',
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 16,
    minWidth: 152,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#0F0F0F',
    padding: 0,
    margin: 0,
  },
  searchIconContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 3,
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
    elevation: 4,
  },
  categoriesContainer: {
    marginBottom: 16,
  },
  categoriesContent: {
    paddingHorizontal: 24,
    gap: 4,
  },
  categoryChip: {
    borderWidth: 1,
    borderColor: '#000E3D',
    borderRadius: 32,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 4,
  },
  categoryChipText: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#000E3D',
  },
  section: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#E5102E',
    marginBottom: 16,
  },
  appointmentCard: {
    flexDirection: 'column',
    gap: 16,
    paddingVertical: 16,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
  },
  appointmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
  },
  appointmentTime: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#474747',
  },
  appointmentDate: {
    fontSize: 12,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#0F0F0F',
  },
  appointmentContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    height: 40,
  },
  appointmentServiceName: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#0F0F0F',
  },
  appointmentChevron: {
    fontSize: 24,
    fontFamily: 'Montserrat_400Regular',
    color: '#E5102E',
    width: 40,
    textAlign: 'center',
  },
  businessesList: {
    gap: 10,
    paddingRight: 24,
  },
  businessCard: {
    width: businessCardWidth,
    backgroundColor: '#FEFEFE',
    borderRadius: 16,
    overflow: 'hidden',
    marginRight: businessGap,
    shadowColor: '#1D1D1D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  businessHeroContainer: {
    width: '100%',
    position: 'relative',
  },
  businessImageContainer: {
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
  priceRangeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
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
  businessProfileContainer: {
    position: 'absolute',
    bottom: -72,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingLeft: 16,
    paddingBottom: 8,
    zIndex: 2,
  },
  businessAvatarContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
  },
  businessAvatar: {
    width: '100%',
    height: '100%',
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
  businessDescription: {
    fontSize: 8,
    fontFamily: 'Montserrat_500Medium',
      color: '#FEFEFE',
  },
  servicePillsContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  servicePill: {
    borderWidth: 1,
    borderColor: '#000E3D',
    borderRadius: 32,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
  },
  servicePillText: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#000E3D',
  },
  operatingHours: {
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  operatingHoursTitle: {
    fontSize: 12,
    fontFamily: 'Montserrat_700Bold',
    color: '#000E3D',
    marginBottom: 8,
  },
  operatingHoursText: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#0F0F0F',
  },
  paymentMethods: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  paymentMethodsTitle: {
    fontSize: 12,
    fontFamily: 'Montserrat_700Bold',
    color: '#0F0F0F',
    width: 223,
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
    fontFamily: 'Montserrat_500Medium',
    color: '#0F0F0F',
  },
  servicesList: {
    gap: 14,
    paddingRight: 24,
    marginBottom: 24,
  },
  serviceCard: {
      width: serviceCardWidth,
      marginRight: serviceGap,
  },
  serviceImageContainer: {
    height: 94,
    borderRadius: 8,
    marginBottom: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  serviceImage: {
    width: '100%',
    height: '100%',
  },
  serviceBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FEFEFE',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 4,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  serviceBadgeText: {
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
    height: 40,
    marginBottom: 7,
  },
  serviceRatingContainer: {
    gap: 8,
  },
  serviceRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  serviceRatingValue: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#0F0F0F',
    marginRight: 4,
  },
  serviceRatingCount: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#474747',
    marginLeft: 4,
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
    marginTop: 24,
    width: '100%',
  },
  scheduleButtonText: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#000E3D',
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Montserrat_400Regular',
    color: '#474747',
    textAlign: 'center',
    marginTop: 16,
  },
  placeholderImage: {
    backgroundColor: '#E0E0E0',
  },
  placeholderAvatar: {
    backgroundColor: '#E0E0E0',
  },
  }), [businessCardWidth, serviceCardWidth]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E5102E" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MerchantTopBar showNotification fallbackPath="/(client)/home" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Search Bar */}
        <View style={styles.searchBarContainer}>
          <TouchableOpacity
            style={styles.searchInputContainer}
            onPress={() => router.push('/(client)/search')}
            activeOpacity={0.8}
            accessibilityRole="search"
            accessibilityLabel="Buscar serviços"
            accessibilityHint="Toque para abrir a tela de busca"
          >
            <TextInput
              style={styles.searchInput}
              placeholder="Procurar serviços"
              placeholderTextColor="#0f0f0f"
              editable={false}
              accessibilityElementsHidden={true}
              importantForAccessibility="no"
            />
            <View style={styles.searchIconContainer}>
              <IconSearch size={25} color="#0F0F0F" />
            </View>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.filterButton} 
            activeOpacity={0.8}
            onPress={() => router.push('/(client)/search')}
            accessibilityRole="button"
            accessibilityLabel="Abrir filtros de busca"
            accessibilityHint="Toque para abrir a tela de busca com filtros"
          >
            <IconFilter width={25} height={25} color="#FEFEFE" />
          </TouchableOpacity>
        </View>

        {/* Categories */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoriesContainer}
          contentContainerStyle={styles.categoriesContent}
        >
          {categories.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={styles.categoryChip}
              activeOpacity={0.7}
              onPress={() => {
                router.push({
                  pathname: '/(client)/search/results',
                  params: { category: category.name },
                });
              }}
              accessibilityRole="button"
              accessibilityLabel={`Buscar serviços de ${category.name}`}
              accessibilityHint="Toque para ver serviços desta categoria"
            >
              <Text style={styles.categoryChipText}>
                {category.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Meus Agendamentos */}
        {appointments.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Meus Agendamentos</Text>
            {appointments.slice(0, 3).map((appointment) => {
              const startDate = new Date(appointment.start_time);
              const timeString = startDate.toLocaleTimeString('pt-BR', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: false 
              });
              const dateString = `Data ${startDate.toLocaleDateString('pt-BR', { 
                day: '2-digit',
                month: '2-digit',
                year: '2-digit'
              })}`;
              
              return (
                <TouchableOpacity
                  key={appointment.id}
                  style={styles.appointmentCard}
                  activeOpacity={0.8}
                  onPress={() => router.push(`/(client)/appointments/${appointment.id}`)}
                >
                  <View style={styles.appointmentHeader}>
                    <Text style={styles.appointmentTime}>{timeString}</Text>
                    <Text style={styles.appointmentDate}>{dateString}</Text>
                  </View>
                  <View style={styles.appointmentContent}>
                    <IconSelfCare size={24} color="#000E3D" />
                    <Text style={styles.appointmentServiceName} numberOfLines={1}>
                      {appointment.service?.name || 'Serviço'}
                    </Text>
                    <Text style={styles.appointmentChevron}>›</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Lojas em destaque */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lojas em destaque</Text>
          {allFeaturedBusinesses.length > 0 ? (
            <FlatList
              data={allFeaturedBusinesses}
              renderItem={renderBusinessCard}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.businessesList}
              initialNumToRender={3}
              maxToRenderPerBatch={5}
              windowSize={5}
              removeClippedSubviews={true}
              getItemLayout={(data, index) => ({
                length: businessCardWidth + businessGap,
                offset: (businessCardWidth + businessGap) * index,
                index,
              })}
            />
          ) : (
            <Text style={styles.emptyText}>Nenhuma loja em destaque no momento</Text>
          )}
        </View>

        {/* Serviços mais contratados */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Serviços mais contratados</Text>
          {allPopularServices.length > 0 ? (
            <FlatList
              data={allPopularServices}
              renderItem={renderServiceCard}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.servicesList}
              initialNumToRender={4}
              maxToRenderPerBatch={6}
              windowSize={5}
              removeClippedSubviews={true}
              getItemLayout={(data, index) => ({
                length: serviceCardWidth + serviceGap,
                offset: (serviceCardWidth + serviceGap) * index,
                index,
              })}
            />
          ) : (
            <Text style={styles.emptyText}>Nenhum serviço disponível no momento</Text>
          )}

          {/* Botão Agendar serviços - dentro da seção de serviços */}
          <TouchableOpacity
            style={styles.scheduleButton}
            activeOpacity={0.8}
            onPress={() => {
              console.log('Navegar para agendamento');
            }}
            accessibilityRole="button"
            accessibilityLabel="Agendar serviços"
            accessibilityHint="Toque para agendar um novo serviço"
          >
            <Text style={styles.scheduleButtonText}>Agendar serviços</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

export default ClientHomeScreen;
