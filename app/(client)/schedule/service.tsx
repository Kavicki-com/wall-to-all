import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import AppHeader from '../../../components/layout/AppHeader';
import ScreenContainer from '../../../components/layout/ScreenContainer';
import { CustomButton } from '../../../components/CustomButton';
import ServiceCard from '../../../components/ServiceCard';
import { safeGoBack } from '../../../lib/router-utils';
import { logger } from '../../../lib/logger';
import { Service } from '../../../lib/types';
import { colors } from '../../../lib/theme';

const ScheduleServiceScreen: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ businessId: string }>();
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<number | null>(null);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // loadServices é estável (useCallback), não precisa estar nas dependências
  }, [params.businessId]);

  const loadServices = async () => {
    try {
      setLoading(true);

      if (!params.businessId) {
        logger.error('businessId não fornecido');
        setLoading(false);
        return;
      }

      // Buscar nome da loja (não usado diretamente, mas mantido para possível uso futuro)
      await supabase
        .from('business_profiles')
        .select('business_name')
        .eq('id', Number(params.businessId))
        .single();

      // Business name is not used in this component

      // Buscar serviços da loja
      const { data: servicesData, error } = await supabase
        .from('services')
        .select('*')
        .eq('business_id', Number(params.businessId))
        .order('name', { ascending: true });

      if (error) {
        logger.error('Erro ao buscar serviços:', error);
      } else if (servicesData) {
        setServices(servicesData);
      }
    } catch (error) {
      logger.error('Erro ao carregar serviços:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleServiceSelect = (serviceId: number) => {
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

    // Estilos condicionais para seleção
    const containerStyle: {
      marginBottom: number;
      opacity?: number;
      borderColor?: string;
      borderWidth?: number;
    } = {
      marginBottom: 16,
    };

    if (isSelected) {
      containerStyle.borderColor = colors.accent;
      containerStyle.borderWidth = 2;
    } else {
      containerStyle.borderColor = colors.textSecondary;
      containerStyle.borderWidth = 1;
    }

    if (shouldReduceOpacity) {
      containerStyle.opacity = 0.5;
    }

    return (
      <ServiceCard
        name={item.name}
        price={item.price}
        photos={item.photos}
        rating={item.rating}
        reviewCount={item.review_count}
        categoryName={null}
        containerStyle={containerStyle}
        onPress={() => handleServiceSelect(item.id)}
      />
    );
  };

  if (loading) {
    return (
      <ScreenContainer style={{ backgroundColor: colors.background }}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer
      scroll={true}
      hasHeader={true}
      hasTabBar={false}
      backgroundColor={colors.background}
      header={
        <AppHeader
          showBackButton={true}
          onPressBack={() => safeGoBack('/(client)/home')}
        />
      }
      footer={selectedService ? (
        <View style={styles.footerContainer}>
          <CustomButton
            compact
            title="Continuar"
            onPress={handleContinue}
            variant="primary"
            accessibilityLabel="Continuar para seleção de data"
            accessibilityHint="Toque para continuar e selecionar a data do agendamento"

          />
        </View>
      ) : undefined}
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
          keyExtractor={(item) => item.id.toString()}
          scrollEnabled={false}
          contentContainerStyle={styles.servicesList}
        />
      )}
    </ScreenContainer>
  );
};

export default ScheduleServiceScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: colors.accent,
    marginBottom: 16,
  },
  servicesList: {
    paddingBottom: 16,
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
    color: colors.textSecondary,
    textAlign: 'center',
  },
  footerContainer: {
    backgroundColor: 'transparent',
    paddingTop: 12,
    paddingBottom: 32,
  },
});




