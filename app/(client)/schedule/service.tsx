import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { IconBack, IconRatingStar, IconNotification } from '../../../lib/icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';

type Service = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  photos: string[] | string | null;
  rating?: number;
  review_count?: number;
  duration_minutes?: number;
};

const ScheduleServiceScreen: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ businessId: string }>();
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState<string>('');

  // Resetar seleção quando a tela é focada
  useFocusEffect(
    React.useCallback(() => {
      setSelectedService(null);
      return () => {
        // Cleanup ao desfocar
      };
    }, [])
  );

  useEffect(() => {
    loadServices();
  }, [params.businessId]);

  const loadServices = async () => {
    try {
      setLoading(true);

      if (!params.businessId) {
        console.error('businessId não fornecido');
        setLoading(false);
        return;
      }

      // Buscar nome da loja
      const { data: businessData } = await supabase
        .from('business_profiles')
        .select('business_name')
        .eq('id', params.businessId)
        .single();

      if (businessData) {
        setBusinessName(businessData.business_name);
      }

      // Buscar serviços da loja
      const { data: servicesData, error } = await supabase
        .from('services')
        .select('*')
        .eq('business_id', params.businessId)
        .order('name', { ascending: true });

      if (error) {
        console.error('Erro ao buscar serviços:', error);
      } else if (servicesData) {
        setServices(servicesData as Service[]);
      }
    } catch (error) {
      console.error('Erro ao carregar serviços:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleServiceSelect = (serviceId: string) => {
    setSelectedService(serviceId);
  };

  const handleContinue = () => {
    if (selectedService) {
      router.push({
        pathname: '/(client)/schedule/time',
        params: {
          businessId: params.businessId,
          serviceId: selectedService,
        },
      });
    }
  };

  const renderServiceCard = ({ item }: { item: Service }) => {
    const isSelected = selectedService === item.id;
    const hasSelection = selectedService !== null;
    const shouldReduceOpacity = hasSelection && !isSelected;
    
    // Processar imagens
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
        style={[
          styles.serviceCard,
          !isSelected && styles.serviceCardNotSelected,
          isSelected && styles.serviceCardSelected,
          shouldReduceOpacity && styles.serviceCardUnselected,
        ]}
        activeOpacity={0.8}
        onPress={() => handleServiceSelect(item.id)}
        accessibilityRole="button"
        accessibilityLabel={`Serviço ${item.name}, preço R$ ${item.price.toFixed(2).replace('.', ',')}`}
        accessibilityHint={isSelected ? "Serviço selecionado. Toque novamente para desmarcar" : "Toque para selecionar este serviço"}
        accessibilityState={{ selected: isSelected }}
      >
        {firstImage ? (
          <Image
            source={{ uri: firstImage }}
            style={styles.serviceImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.serviceImage, styles.placeholderImage]} />
        )}
        <View style={styles.serviceInfo}>
          <Text style={styles.serviceName} numberOfLines={1}>{item.name}</Text>
          <View style={styles.serviceRatingRow}>
            <Text style={styles.serviceRatingText}>
              {item.rating ? item.rating.toFixed(1) : '4.8'}
            </Text>
            <IconRatingStar size={16} color="#FFD700" />
            <Text style={styles.serviceReviewCount}>
              ({item.review_count || '25'})
            </Text>
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
      {/* Top Bar */}
      <View style={styles.topBar}>
        <View style={styles.topBarDivider} />
        <View style={styles.topBarContent}>
          <View style={styles.topBarGradientContainer}>
            <Svg style={StyleSheet.absoluteFill} viewBox="0 0 410 56" preserveAspectRatio="none">
              <Defs>
                <RadialGradient
                  id="topBarRadialGradient"
                  cx="50%"
                  cy="50%"
                  r="50%"
                  gradientUnits="userSpaceOnUse"
                >
                  <Stop offset="0%" stopColor="rgba(214,224,255,0.2)" />
                  <Stop offset="25%" stopColor="rgba(161,172,207,0.2)" />
                  <Stop offset="37.5%" stopColor="rgba(134,145,182,0.2)" />
                  <Stop offset="50%" stopColor="rgba(107,119,158,0.2)" />
                  <Stop offset="62.5%" stopColor="rgba(80,93,134,0.2)" />
                  <Stop offset="75%" stopColor="rgba(54,67,110,0.2)" />
                  <Stop offset="87.5%" stopColor="rgba(27,40,85,0.2)" />
                  <Stop offset="93.75%" stopColor="rgba(13,27,73,0.2)" />
                  <Stop offset="100%" stopColor="rgba(0,14,61,0.2)" />
                </RadialGradient>
              </Defs>
              <Rect x="0" y="0" width="410" height="56" fill="url(#topBarRadialGradient)" />
            </Svg>
            <LinearGradient
              colors={['rgba(0,14,61,0.2)', 'rgba(214,224,255,0.2)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
          </View>
          <View style={styles.topBarGradientOverlay} />
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
            accessibilityHint="Toque para voltar à tela anterior"
          >
            <IconBack size={24} color="#FEFEFE" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.notificationButton}
            accessibilityRole="button"
            accessibilityLabel="Notificações"
            accessibilityHint="Toque para ver notificações"
          >
            <IconNotification size={24} color="#FEFEFE" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Serviços disponíveis</Text>
        {services.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              Nenhum serviço disponível no momento.
            </Text>
          </View>
        ) : (
          <FlatList
            data={services}
            renderItem={renderServiceCard}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            contentContainerStyle={styles.servicesList}
          />
        )}
      </ScrollView>

      {/* Continue Button */}
      {selectedService && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.continueButton}
            activeOpacity={0.8}
            onPress={handleContinue}
            accessibilityRole="button"
            accessibilityLabel="Continuar para seleção de data"
            accessibilityHint="Toque para continuar e selecionar a data do agendamento"
          >
            <Text style={styles.continueButtonText}>Continuar</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

export default ScheduleServiceScreen;

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
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  topBarDivider: {
    height: 14,
    backgroundColor: '#EBEFFF',
  },
  topBarContent: {
    height: 56,
    paddingHorizontal: 24,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#000E3D',
    position: 'relative',
    overflow: 'hidden',
  },
  topBarGradientContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  topBarGradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000E3D',
    opacity: 0.8,
  },
  backButton: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationButton: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
    marginTop: 70,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 100,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#E5102E',
    marginBottom: 16,
  },
  servicesList: {
    paddingBottom: 16,
  },
  serviceCard: {
    flexDirection: 'row',
    backgroundColor: '#FEFEFE',
    borderRadius: 16,
    padding: 16,
    gap: 16,
    marginBottom: 16,
  },
  serviceCardNotSelected: {
    borderWidth: 1,
    borderColor: '#000000',
  },
  serviceCardSelected: {
    borderColor: '#E5102E',
    borderWidth: 2,
  },
  serviceCardUnselected: {
    opacity: 0.5,
  },
  serviceImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  placeholderImage: {
    backgroundColor: '#E0E0E0',
  },
  serviceInfo: {
    flex: 1,
    justifyContent: 'space-between',
    gap: 4,
  },
  serviceName: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#0F0F0F',
  },
  serviceRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  serviceRatingText: {
    fontSize: 14,
    fontFamily: 'Montserrat_600SemiBold',
    color: '#0F0F0F',
  },
  serviceReviewCount: {
    fontSize: 14,
    fontFamily: 'Montserrat_400Regular',
    color: '#474747',
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
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FEFEFE',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  continueButton: {
    backgroundColor: '#000E3D',
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonText: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#FEFEFE',
  },
});




