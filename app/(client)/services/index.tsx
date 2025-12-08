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
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { IconBack, IconNotification, IconRatingStar } from '../../../lib/icons';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';

type Service = {
  id: string;
  name: string;
  price: number;
  photos: string[] | string | null;
  business_id: string;
  business_profiles: {
    business_name: string;
  } | null;
  categories?: {
    id: number;
    name: string;
  } | null;
  rating?: number;
  review_count?: number;
};

const ServicesAvailableScreen: React.FC = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<Service[]>([]);

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    try {
      setLoading(true);

      const { data: servicesData, error } = await supabase
        .from('services')
        .select(`
          *,
          business_profiles(business_name),
          categories:category_id (
            id,
            name
          )
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

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
    const categoryName = item.categories?.name || item.business_profiles?.business_name || 'Serviço';

    return (
      <TouchableOpacity
        style={styles.serviceCard}
        activeOpacity={0.8}
        onPress={() => {
          // Redirecionar para o perfil da loja para agendar o serviço
          router.push(`/(client)/store/${item.business_id}`);
        }}
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
              style={StyleSheet.absoluteFill}
            />
          </View>
          <View style={styles.topBarGradientOverlay} />
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <IconBack size={24} color="#FEFEFE" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.notificationButton}
            onPress={() => {
              console.log('Abrir notificações');
            }}
            activeOpacity={0.8}
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
        {/* Section Title */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Serviços dispníveis</Text>
          
          {services.length > 0 ? (
            <View style={styles.servicesList}>
              {services.map((service) => (
                <View key={service.id} style={styles.serviceCardWrapper}>
                  {renderServiceCard({ item: service })}
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>Nenhum serviço disponível no momento</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

export default ServicesAvailableScreen;

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
    paddingBottom: 100,
  },
  section: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#E5102E',
    marginBottom: 16,
  },
  servicesList: {
    gap: 16,
  },
  serviceCardWrapper: {
    width: '100%',
  },
  serviceCard: {
    width: '100%',
    backgroundColor: '#FEFEFE',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#474747',
  },
  serviceImageContainer: {
    height: 94,
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
    padding: 16,
    gap: 7,
  },
  serviceName: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#000E3D',
    minHeight: 40,
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
  emptyText: {
    fontSize: 14,
    fontFamily: 'Montserrat_400Regular',
    color: '#474747',
    textAlign: 'center',
    marginTop: 16,
  },
});

