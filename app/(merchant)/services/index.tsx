import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase';
import { IconSearch, IconRatingStar } from '../../../lib/icons';
import { MerchantTopBar } from '../../../components/MerchantTopBar';

// --- TIPOS ---
type Service = {
  id: string;
  name: string;
  price: number;
  description: string | null;
  photos: string[] | string | null;
  category: string | null;
  duration_minutes: number | null;
  rating?: number;
  review_count?: number;
};

const MerchantServicesScreen: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [businessId, setBusinessId] = useState<string | null>(null);

  // --- EFEITOS E CARREGAMENTO DE DADOS ---
  useEffect(() => {
    loadBusinessAndServices();
  }, []);

  const loadBusinessAndServices = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data: businessData, error: businessError } = await supabase
        .from('business_profiles')
        .select('id')
        .eq('owner_id', user.id)
        .single();

      if (businessError || !businessData) {
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

      const { data: servicesData, error: servicesError } = await supabase
        .from('services')
        .select(
          'id,name,price,description,photos,category_id,duration_minutes,reviews(rating),categories(name)'
        )
        .eq('business_id', businessData.id)
        .order('created_at', { ascending: false });

      if (servicesError) {
        console.error('Erro ao carregar serviços:', servicesError);
      }

      if (servicesData) {
        const servicesWithRatings = (servicesData as any[]).map((service) => {
          const ratings = Array.isArray(service.reviews) ? service.reviews : [];
          const reviewCount = ratings.length || undefined;
          const rating =
            ratings.length > 0
              ? ratings.reduce((sum: number, r: { rating?: number }) => sum + (r?.rating || 0), 0) /
                ratings.length
              : undefined;
          const { reviews, categories, ...rest } = service;
          const categoryName = categories?.name ?? null;
          return { ...rest, category: categoryName, rating, review_count: reviewCount };
        });
        setServices(servicesWithRatings as Service[]);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadBusinessAndServices();
  };

  // --- NAVEGAÇÃO E FILTROS ---
  const handleServicePress = (serviceId: string) => {
    router.push(`/(merchant)/services/edit/${serviceId}`);
  };

  const handleAddService = () => {
    router.push('/(merchant)/services/create');
  };

  const filteredServices = services.filter((service) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      service.name.toLowerCase().includes(query) ||
      (service.description && service.description.toLowerCase().includes(query)) ||
      (service.category && service.category.toLowerCase().includes(query))
    );
  });

  // --- RENDERIZAÇÃO DO CARD ---
  const renderServiceCard = ({ item }: { item: Service }) => {
    const imagesArray: string[] = [];
    if (item.photos) {
      if (typeof item.photos === 'string') {
        try {
          imagesArray.push(...JSON.parse(item.photos));
        } catch {
          imagesArray.push(item.photos);
        }
      } else if (Array.isArray(item.photos)) {
        imagesArray.push(...item.photos);
      }
    }
    const firstImage = imagesArray.length > 0 ? imagesArray[0] : null;

    return (
      <TouchableOpacity
        style={styles.serviceCard}
        activeOpacity={0.8}
        onPress={() => handleServicePress(item.id)}
      >
        <Image 
            source={firstImage ? { uri: firstImage } : undefined} 
            style={[styles.serviceImage, !firstImage && styles.placeholderImage]} 
            resizeMode="cover" 
        />
       
        <View style={styles.serviceInfo}>
          <Text style={styles.serviceName} numberOfLines={2}>{item.name}</Text>
          
          <View style={styles.serviceDetailsRow}>
            <View style={styles.ratingBadge}>
              <Text style={styles.ratingValue}>{item.rating?.toFixed(1) || '4.8'}</Text>
              <IconRatingStar size={14} color="#FFCE31" />
              <Text style={styles.reviewCount}>({item.review_count || 25})</Text>
            </View>
            
            {item.category && (
              <Text style={styles.categoryText} numberOfLines={1}>
                {item.category}
              </Text>
            )}
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
      </View>
    );
  }

  // --- RENDERIZAÇÃO DA TELA ---
  return (
    <View style={styles.container}>
      <MerchantTopBar showBack={true} />
      
      <View style={styles.mainContent}>
        {/* 1. TOPO: Título e Busca */}
        <View style={styles.headerSection}>
          <Text style={styles.title}>Meus serviços</Text>
          
          <View style={styles.searchBarContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar serviços"
              placeholderTextColor="#474747"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <IconSearch size={20} color="#0F0F0F" />
          </View>
        </View>

        {/* 2. MEIO: Lista de Serviços (Flex: 1) */}
        <View style={styles.listSection}>
          <FlatList
            data={filteredServices}
            renderItem={renderServiceCard}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  {searchQuery
                    ? 'Nenhum serviço encontrado.'
                    : 'Você ainda não tem serviços cadastrados.'}
                </Text>
              </View>
            }
          />
        </View>

        {/* 3. FUNDO: Botão Fixo */}
        {/* Ajustei o paddingBottom para aproximar o botão da barra de navegação */}
        <View style={[styles.footerSection, { paddingBottom: Math.max(insets.bottom, 20) + 20 }]}>
          <TouchableOpacity
            style={styles.addServiceButton}
            onPress={handleAddService}
          >
            <Text style={styles.addServiceButtonText}>Cadastrar novo serviço</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default MerchantServicesScreen;

// --- ESTILOS ---
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
  mainContent: {
    flex: 1,
  },
  
  // --- HEADER (Ajustado posicionamento e tamanho da busca) ---
  headerSection: {
    paddingHorizontal: 24,
    paddingTop: 20, // Espaço entre header e título
    paddingBottom: 24,
  },
  title: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#E5102E',
    marginBottom: 16,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 16, // Padding interno lateral
    height: 56, // Aumentada a altura da barra
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#474747',
    backgroundColor: 'transparent',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#0F0F0F',
    marginRight: 8,
    height: '100%', // Garante que o input ocupe toda a altura
  },

  // --- LISTA ---
  listSection: {
    flex: 1, // Ocupa o espaço central
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 20,
    gap: 16,
  },

  // --- CARD DO SERVIÇO ---
  serviceCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#474747',
    overflow: 'hidden',
    height: 104,
  },
  serviceImage: {
    width: 85,
    height: '100%',
    backgroundColor: '#E0E0E0',
  },
  placeholderImage: {
    backgroundColor: '#E0E0E0',
  },
  serviceInfo: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
  },
  serviceName: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#0F0F0F',
    marginBottom: 4,
  },
  serviceDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  ratingValue: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#0F0F0F',
    marginRight: 4,
  },
  reviewCount: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#474747',
    marginLeft: 2,
  },
  categoryText: {
    fontSize: 12,
    fontFamily: 'Montserrat_300Light',
    color: '#0F0F0F',
    flex: 1,
  },
  servicePrice: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#17723F',
  },

  // --- EMPTY STATE ---
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#474747',
    textAlign: 'center',
  },

  // --- FOOTER (Ajustado posicionamento do botão) ---
  footerSection: {
    paddingHorizontal: 24,
    backgroundColor: '#FAFAFA',
    paddingTop: 16, // Um pouco mais de respiro acima do botão
    // paddingBottom é definido dinamicamente no JSX
  },
  addServiceButton: {
    borderWidth: 1,
    borderColor: '#000E3D',
    borderRadius: 24,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    width: '100%',
  },
  addServiceButtonText: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#000E3D',
  },
});