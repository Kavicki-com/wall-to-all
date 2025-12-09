import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Share,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase';
import { IconShare, IconRatingStar } from '../../../lib/icons';
import { MerchantTopBar } from '../../../components/MerchantTopBar';
import { useCardWidth } from '../../../lib/responsive';

type BusinessProfile = {
  id: string;
  business_name: string;
  logo_url: string | null;
  description: string | null;
};

type Service = {
  id: string;
  name: string;
  price: number;
  photos: string[] | string | null;
  rating?: number;
  review_count?: number;
  categories?: {
    id: number;
    name: string;
  } | null;
};

const MerchantHomeScreen: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);

  // Cards de serviços (~2 visíveis em scroll horizontal)
  // ⚠️ VERIFICADO: Cards de serviços têm width: 193px e marginRight: 14px
  const serviceCardWidth = useCardWidth(2, 24, 14);
  const serviceGap = 14; // ✅ Gap confirmado: marginRight do serviceCard

  // Estilos dinâmicos que dependem de serviceCardWidth
  const dynamicStyles = useMemo(() => StyleSheet.create({
    serviceCard: {
      width: serviceCardWidth,
      marginRight: serviceGap,
      backgroundColor: '#FAFAFA',
      borderRadius: 8,
      overflow: 'hidden',
    },
  }), [serviceCardWidth]);

  useEffect(() => {
    loadBusinessAndServices();
  }, []);

  const loadBusinessAndServices = async () => {
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

      // Buscar business_profile do lojista
      const { data: businessData, error: businessError } = await supabase
        .from('business_profiles')
        .select('id, business_name, logo_url, description')
        .eq('owner_id', user.id)
        .single();

      if (businessError || !businessData) {
        console.error('Erro ao buscar negócio:', businessError);
        if (businessError?.code === 'PGRST116') {
          Alert.alert(
            'Perfil não encontrado',
            'Você precisa criar um perfil de negócio primeiro.',
            [{ text: 'OK', onPress: () => router.push('/(merchant)/profile/edit') }]
          );
        }
        setLoading(false);
        return;
      }

      setBusinessId(businessData.id);
      setBusinessProfile(businessData as BusinessProfile);

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
        .order('created_at', { ascending: false })
        .limit(5);

      if (servicesError) {
        console.error('Erro ao buscar serviços:', servicesError);
      } else if (servicesData) {
        // Buscar ratings para serviços
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
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      Alert.alert(
        'Erro ao carregar',
        'Não foi possível carregar os dados. Verifique sua conexão e tente novamente.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadBusinessAndServices();
  };

  const handleShareProfile = () => {
    router.push('/(merchant)/home/share');
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
        style={[styles.serviceCard, dynamicStyles.serviceCard]}
        activeOpacity={0.8}
        onPress={() => router.push(`/(merchant)/services/edit/${item.id}`)}
        accessibilityRole="button"
        accessibilityLabel={`Serviço ${item.name}, preço R$ ${item.price.toFixed(2).replace('.', ',')}`}
        accessibilityHint="Toque para editar este serviço"
      >
        <View style={styles.serviceImageContainer}>
          {firstImage ? (
            <Image source={{ uri: firstImage }} style={styles.serviceImage} resizeMode="cover" />
          ) : (
            <View style={[styles.serviceImage, styles.placeholderImage]} />
          )}
          {item.categories?.name && (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{item.categories.name}</Text>
            </View>
          )}
        </View>
        <View style={styles.serviceInfo}>
          <Text style={styles.serviceName} numberOfLines={2}>
            {item.name}
          </Text>
          <View style={styles.serviceRatingContainer}>
            <View style={styles.serviceRating}>
              <Text style={styles.serviceRatingValue}>{item.rating?.toFixed(1) || '4.9'}</Text>
              {[1, 2, 3, 4, 5].map((star) => (
                <IconRatingStar key={star} size={12} color="#FFD700" />
              ))}
              <Text style={styles.serviceRatingCount}>({item.review_count || 30})</Text>
            </View>
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
        <Text style={styles.loadingText}>Carregando...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MerchantTopBar />
      <View style={styles.pageContent}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
        >
        {/* Avatar e Nome do Negócio */}
        <View style={styles.avatarSection}>
          {businessProfile?.logo_url ? (
            <Image
              source={{ uri: businessProfile.logo_url }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatar, styles.placeholderAvatar]} />
          )}
          <View style={styles.businessNameContainer}>
            <Text style={styles.businessName}>
              {businessProfile?.business_name || 'Meu Negócio'}
            </Text>
          </View>
        </View>

        {/* Seção Meus Agendamentos */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Meus Agendamentos</Text>
          <View style={styles.emptyStateCard}>
            <Text style={styles.emptyStateText}>
              Você ainda não tem nenhum agendamento, divulgue seu perfil para receber mais clientes
            </Text>
          </View>
          <TouchableOpacity
            style={styles.shareButton}
            onPress={handleShareProfile}
            accessibilityRole="button"
            accessibilityLabel="Compartilhar perfil do negócio"
            accessibilityHint="Toque para compartilhar seu perfil e receber mais clientes"
          >
            <Text style={styles.shareButtonText}>Compartilhar perfil</Text>
            <IconShare size={24} color="#000E3D" />
          </TouchableOpacity>
        </View>

        {/* Seção Meus Serviços */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Meus Serviços</Text>
          {services.length > 0 ? (
            <FlatList
              data={services}
              renderItem={renderServiceCard}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.servicesCarousel}
              initialNumToRender={3}
              maxToRenderPerBatch={5}
              windowSize={5}
              removeClippedSubviews={true}
            />
          ) : (
            <Text style={styles.emptyServicesText}>Nenhum serviço cadastrado</Text>
          )}
        </View>
        </ScrollView>

        <View style={[styles.footerSection, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
          <TouchableOpacity
            style={styles.addServiceButton}
            onPress={() => router.push('/(merchant)/services/create')}
            accessibilityRole="button"
            accessibilityLabel="Cadastrar novo serviço"
            accessibilityHint="Toque para adicionar um novo serviço ao seu negócio"
          >
            <Text style={styles.addServiceButtonText}>Cadastrar novo serviço</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default MerchantHomeScreen;

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
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#000E3D',
  },
  scrollView: {
    flex: 1,
  },
  pageContent: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 100,
  },
  avatarSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  placeholderAvatar: {
    backgroundColor: '#E0E0E0',
  },
  businessNameContainer: {
    flex: 1,
  },
  businessName: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#0F0F0F',
  },
  section: {
    marginBottom: 24,
    gap: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#E5102E',
  },
  emptyStateCard: {
    backgroundColor: '#FEFEFE',
    borderWidth: 1,
    borderColor: '#DBDBDB',
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 16,
  },
  emptyStateText: {
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#0F0F0F',
    textAlign: 'center',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#000E3D',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  shareButtonText: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#000E3D',
  },
  servicesCarousel: {
    gap: 14,
    paddingRight: 24,
  },
  serviceImageContainer: {
    height: 94,
    position: 'relative',
  },
  serviceImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    backgroundColor: '#E0E0E0',
  },
  categoryBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FEFEFE',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  categoryText: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#000E3D',
  },
  serviceInfo: {
    padding: 8,
    gap: 7,
    alignItems: 'flex-start',
  },
  serviceName: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#000E3D',
    minHeight: 40,
    textAlign: 'left',
    alignSelf: 'flex-start',
  },
  serviceRatingContainer: {
    gap: 8,
    alignSelf: 'flex-start',
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
    textAlign: 'left',
  },
  serviceRatingCount: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#474747',
    textAlign: 'left',
  },
  servicePrice: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#17723F',
    textAlign: 'left',
    alignSelf: 'flex-start',
  },
  addServiceButton: {
    borderWidth: 1,
    borderColor: '#000E3D',
    borderRadius: 24,
    height: 48,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAFAFA',
    width: '100%',
  },
  addServiceButtonText: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#000E3D',
  },
  footerSection: {
    paddingHorizontal: 24,
    paddingTop: 8,
    backgroundColor: '#FAFAFA',
  },
  emptyServicesText: {
    fontSize: 14,
    fontFamily: 'Montserrat_400Regular',
    color: '#474747',
    textAlign: 'center',
    marginTop: 16,
  },
});
