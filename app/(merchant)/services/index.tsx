import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { IconSearch } from '../../../lib/icons';
import AppHeader from '../../../components/layout/AppHeader';
import { safeGoBack } from '../../../lib/router-utils';
import ScreenContainer from '../../../components/layout/ScreenContainer';
import ServiceCard from '../../../components/ServiceCard';
import { CustomButton } from '../../../components/CustomButton';
import { logger } from '../../../lib/logger';

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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const loadBusinessAndServices = useCallback(async () => {
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


      const { data: servicesData, error: servicesError } = await supabase
        .from('services')
        .select(
          'id,name,price,description,photos,category_id,duration_minutes,reviews(rating),categories(name)'
        )
        .eq('business_id', businessData.id)
        .order('created_at', { ascending: false });

      if (servicesError) {
        logger.error('Erro ao carregar serviços:', servicesError);
      }

      if (servicesData) {
        const servicesWithRatings = (servicesData as { reviews?: { rating?: number }[]; categories?: { name?: string } }[]).map((service) => {
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
      logger.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  // --- EFEITOS E CARREGAMENTO DE DADOS ---
  useEffect(() => {
    loadBusinessAndServices();
  }, [loadBusinessAndServices]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadBusinessAndServices();
    } catch (error) {
      // Erro já é tratado dentro de loadBusinessAndServices
      // Aqui apenas garantimos que o estado seja resetado
      logger.error('Erro ao atualizar dados:', error);
    } finally {
      // O loadBusinessAndServices já reseta o refreshing no finally,
      // mas garantimos aqui também por segurança
      setRefreshing(false);
    }
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
    return (
      <ServiceCard
        name={item.name}
        price={item.price}
        photos={item.photos}
        rating={item.rating}
        reviewCount={item.review_count}
        categoryName={item.category}
        containerStyle={{ width: '100%' }}
        onPress={() => handleServicePress(item.id)}
      />
    );
  };

  if (loading) {
    return (
      <ScreenContainer scroll={false} backgroundColor="#FAFAFA" hasHeader={true}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E5102E" />
        </View>
      </ScreenContainer>
    );
  }

  // --- RENDERIZAÇÃO DA TELA ---
  return (
    <ScreenContainer
      scroll={false}
      backgroundColor="#FAFAFA"
      hasHeader={true}
      horizontalPadding={24}
      header={
        <AppHeader
          showBackButton={true}
          onPressBack={() => safeGoBack('/(merchant)/home')}
        />
      }
      footer={
        <View style={styles.footerContainer}>
          <CustomButton
            title="Cadastrar novo serviço"
            variant="outline"
            onPress={handleAddService}
            style={{ borderRadius: 24, height: 48 }}
            width="100%"

          />
        </View>
      }
    >
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
            <View style={styles.searchIconContainer}>
              <IconSearch size={20} color="#0F0F0F" />
            </View>
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
      </View>
    </ScreenContainer>
  );
};

export default MerchantServicesScreen;

// --- ESTILOS ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainContent: {
    flex: 1,
  },

  // --- HEADER ---
  headerSection: {
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Montserrat_700Bold',
    color: '#E5102E',
    marginTop: 0,
    marginBottom: 16,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 16,
    height: 56,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0F0F0F',
    backgroundColor: '#FFFFFF',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#0F0F0F',
    paddingRight: 12,
    height: '100%',
  },
  searchIconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  // --- LISTA ---
  listSection: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 20,
    gap: 16,
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

  // --- FOOTER ---
  footerContainer: {
    paddingTop: 16,
    paddingBottom: 32,
    backgroundColor: '#FAFAFA',
  },
});