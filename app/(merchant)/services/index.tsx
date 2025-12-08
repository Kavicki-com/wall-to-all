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
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { IconSearch, IconRatingStar } from '../../../lib/icons';
import { MerchantTopBar } from '../../../components/MerchantTopBar';

type Service = {
  id: string;
  name: string;
  price: number;
  description: string | null;
  photos: string[] | string | null;
  duration_minutes: number | null;
  rating?: number;
  review_count?: number;
  categories?: {
    id: number;
    name: string;
  } | null;
};

const MerchantServicesScreen: React.FC = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [businessId, setBusinessId] = useState<string | null>(null);

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
        .select('id')
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
        .order('created_at', { ascending: false });

      if (servicesError) {
        console.error('Erro ao buscar serviços:', servicesError);
        // Não mostrar erro para o usuário, apenas logar
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
        'Não foi possível carregar os serviços. Verifique sua conexão e tente novamente.',
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
      (service.categories?.name && service.categories.name.toLowerCase().includes(query))
    );
  });

  const renderServiceCard = ({ item }: { item: Service }) => {
    // Processar imagens do serviço
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
        style={styles.serviceCard}
        activeOpacity={0.8}
        onPress={() => handleServicePress(item.id)}
        accessibilityRole="button"
        accessibilityLabel={`Serviço ${item.name}, preço R$ ${item.price.toFixed(2).replace('.', ',')}`}
        accessibilityHint="Toque para editar este serviço"
      >
        {/* Service Image */}
        {firstImage ? (
          <Image source={{ uri: firstImage }} style={styles.serviceImage} resizeMode="cover" />
        ) : (
          <View style={[styles.serviceImage, styles.placeholderImage]} />
        )}

        <View style={styles.serviceInfo}>
          <Text style={styles.serviceName}>{item.name}</Text>
          <View style={styles.serviceDetails}>
            <View style={styles.ratingContainer}>
              <Text style={styles.ratingValue}>{item.rating?.toFixed(1) || '4.8'}</Text>
              <IconRatingStar size={12} color="#FFD700" />
              <Text style={styles.reviewCount}>({item.review_count || 25})</Text>
            </View>
            {item.categories?.name && (
              <Text style={styles.categoryText}>{item.categories.name}</Text>
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

  return (
    <View style={styles.container}>
      <MerchantTopBar title="Serviços" />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.addButton}
          onPress={handleAddService}
          accessibilityRole="button"
          accessibilityLabel="Adicionar novo serviço"
          accessibilityHint="Toque para criar um novo serviço"
        >
          <Text style={styles.addButtonText}>+ Adicionar</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <IconSearch size={20} color="#474747" />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar serviços..."
            placeholderTextColor="#9E9E9E"
            value={searchQuery}
            onChangeText={setSearchQuery}
            accessibilityLabel="Campo de busca de serviços"
            accessibilityHint="Digite o nome do serviço que deseja buscar"
          />
        </View>
      </View>

      {/* Services List */}
      {filteredServices.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {searchQuery
              ? 'Nenhum serviço encontrado.'
              : 'Você ainda não tem serviços cadastrados.'}
          </Text>
          {!searchQuery && (
            <TouchableOpacity
              style={styles.addFirstButton}
              onPress={handleAddService}
              accessibilityRole="button"
              accessibilityLabel="Adicionar primeiro serviço"
              accessibilityHint="Toque para criar seu primeiro serviço"
            >
              <Text style={styles.addFirstButtonText}>Adicionar Primeiro Serviço</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <>
          <FlatList
            data={filteredServices}
            renderItem={renderServiceCard}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            showsVerticalScrollIndicator={false}
          />
          <TouchableOpacity
            style={styles.addServiceButton}
            onPress={handleAddService}
            accessibilityRole="button"
            accessibilityLabel="Cadastrar novo serviço"
            accessibilityHint="Toque para adicionar um novo serviço ao seu negócio"
          >
            <Text style={styles.addServiceButtonText}>Cadastrar novo serviço</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
};

export default MerchantServicesScreen;

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
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: '#FEFEFE',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
    marginTop: 70,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Montserrat_700Bold',
    color: '#000E3D',
  },
  addButton: {
    backgroundColor: '#E5102E',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  addButtonText: {
    fontSize: 14,
    fontFamily: 'Montserrat_700Bold',
    color: '#FEFEFE',
  },
  searchContainer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#FEFEFE',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#0F0F0F',
  },
  listContent: {
    padding: 24,
    paddingBottom: 100,
    gap: 8,
  },
  serviceCard: {
    flexDirection: 'row',
    backgroundColor: '#FEFEFE',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#474747',
    overflow: 'hidden',
  },
  serviceImage: {
    width: 85,
    height: '100%',
    minHeight: 100,
  },
  placeholderImage: {
    backgroundColor: '#E0E0E0',
  },
  serviceInfo: {
    flex: 1,
    padding: 16,
    gap: 8,
    justifyContent: 'space-between',
  },
  serviceName: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#0F0F0F',
  },
  serviceDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  ratingValue: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#0F0F0F',
  },
  reviewCount: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#474747',
  },
  categoryText: {
    fontSize: 12,
    fontFamily: 'Montserrat_300Light',
    color: '#0F0F0F',
  },
  servicePrice: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#17723F',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#474747',
    textAlign: 'center',
    marginBottom: 24,
  },
  addFirstButton: {
    backgroundColor: '#E5102E',
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  addFirstButtonText: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#FEFEFE',
  },
  addServiceButton: {
    position: 'absolute',
    bottom: 100,
    left: 24,
    right: 24,
    borderWidth: 1,
    borderColor: '#000E3D',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEFEFE',
  },
  addServiceButtonText: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#000E3D',
  },
});
