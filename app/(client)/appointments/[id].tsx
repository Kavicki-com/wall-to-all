import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  TextInput,
  Animated,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { IconPix, IconCreditCard, IconCash } from '../../../lib/icons';
import { MaterialIcons } from '@expo/vector-icons';
import { MerchantTopBar } from '../../../components/MerchantTopBar';

type Appointment = {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  payment_method: string;
  client_notes: string | null;
  service: {
    id: string;
    name: string;
    price: number;
  };
  business: {
    id: string;
    business_name: string;
    logo_url: string | null;
    address: string | null;
  };
};

const AppointmentDetailScreen: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [showRescheduleForm, setShowRescheduleForm] = useState(false);
  const [rescheduleReason, setRescheduleReason] = useState('');
  const slideAnim = React.useRef(new Animated.Value(0)).current;
  const scrollViewRef = React.useRef<ScrollView>(null);

  useEffect(() => {
    loadAppointment();
  }, [params.id]);

  // Resetar campos quando a tela é focada (quando volta de outras telas)
  useFocusEffect(
    React.useCallback(() => {
      // Resetar o campo de justificativa
      setRescheduleReason('');
      // Resetar também o estado do formulário
      setShowRescheduleForm(false);
      slideAnim.setValue(0);
    }, [])
  );

  const loadAppointment = async () => {
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

      const { data: appointmentData, error } = await supabase
        .from('appointments')
        .select(
          `
          *,
          service:services(id, name, price),
          business:business_profiles(id, business_name, logo_url, address)
        `
        )
        .eq('id', params.id)
        .eq('client_id', user.id)
        .single();

      if (error) {
        console.error('Erro ao buscar agendamento:', error);
      } else if (appointmentData) {
        setAppointment(appointmentData as Appointment);
      }
    } catch (error) {
      console.error('Erro ao carregar agendamento:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDateAndTime = () => {
    if (!appointment) return 'Hoje - 11:30';
    
    const date = new Date(appointment.start_time);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);
    
    const isToday = compareDate.getTime() === today.getTime();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    if (isToday) {
      return `Hoje - ${hours}:${minutes}`;
    }
    
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    return `${day}/${month}/${year} - ${hours}:${minutes}`;
  };

  const getPaymentIcon = () => {
    if (!appointment) return null;
    
    switch (appointment.payment_method) {
      case 'pix':
        return <IconPix size={24} color="#000E3D" />;
      case 'card':
        return <IconCreditCard size={24} color="#000E3D" />;
      case 'cash':
        return <IconCash size={24} color="#000E3D" />;
      default:
        return <IconPix size={24} color="#000E3D" />;
    }
  };

  const getPaymentLabel = () => {
    if (!appointment) return 'PIX';
    
    switch (appointment.payment_method) {
      case 'pix':
        return 'PIX';
      case 'card':
        return 'Cartão';
      case 'cash':
        return 'Dinheiro';
      default:
        return 'PIX';
    }
  };

  const handleReschedulePress = () => {
    if (!showRescheduleForm) {
      setShowRescheduleForm(true);
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: false,
        tension: 50,
        friction: 7,
      }).start(() => {
        // Scroll para o final após a animação
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      });
    }
  };

  const handleContinueReschedule = () => {
    if (!appointment) return;
    
    router.push({
      pathname: '/(client)/appointments/reschedule',
      params: {
        appointmentId: appointment.id,
        reason: rescheduleReason,
      },
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E5102E" />
      </View>
    );
  }

  if (!appointment) {
    return (
      <View style={styles.container}>
        <MerchantTopBar
          showBack
          onBackPress={() => router.back()}
          fallbackPath="/(client)/home"
        />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Agendamento não encontrado</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MerchantTopBar
        showBack
        onBackPress={() => router.back()}
        fallbackPath="/(client)/home"
      />

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Main Card */}
        <View style={styles.mainCard}>
          {/* Appointment Details */}
          <View style={styles.appointmentDetails}>
            <Text style={styles.dateTimeText}>{formatDateAndTime()}</Text>
            <Text style={styles.serviceName}>{appointment.service.name}</Text>
          </View>

          {/* Professional Section */}
          <View style={styles.professionalSection}>
            <Text style={styles.sectionLabel}>Profissional</Text>
            <View style={styles.businessInfo}>
              {appointment.business.logo_url ? (
                <Image
                  source={{ uri: appointment.business.logo_url }}
                  style={styles.businessAvatar}
                />
              ) : (
                <View style={[styles.businessAvatar, styles.placeholderAvatar]} />
              )}
              <Text style={styles.businessName}>{appointment.business.business_name}</Text>
            </View>
            {appointment.business.address && (
              <View style={styles.addressCard}>
                <Text style={styles.addressText}>{appointment.business.address}</Text>
              </View>
            )}
          </View>

          {/* Payment Method */}
          <View style={styles.paymentSection}>
            <Text style={styles.sectionLabel}>Método de pagamento:</Text>
            <View style={styles.paymentCard}>
              {getPaymentIcon()}
              <View style={styles.paymentInfo}>
                <Text style={styles.paymentMethodLabel}>{getPaymentLabel()}</Text>
                <Text style={styles.paymentPrice}>
                  R$ {appointment.service.price.toFixed(2).replace('.', ',')}
                </Text>
              </View>
            </View>
          </View>

          {/* Client Notes */}
          <View style={styles.notesSection}>
            <Text style={styles.sectionLabel}>Observações do cliente:</Text>
            <Text style={styles.notesText}>
              {appointment.client_notes || 'Nenhuma observação.'}
            </Text>
          </View>

          {/* Reschedule Button */}
          <TouchableOpacity
            style={styles.rescheduleButton}
            activeOpacity={0.8}
            onPress={handleReschedulePress}
          >
            <Text style={styles.rescheduleButtonText}>Remarcar agendamento</Text>
          </TouchableOpacity>

          {/* Reschedule Form (animated) */}
          <Animated.View
            style={[
              styles.rescheduleForm,
              {
                height: slideAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 250],
                }),
                opacity: slideAnim,
                overflow: 'hidden',
              },
            ]}
          >
            <View style={styles.justificationSection}>
              <Text style={styles.justificationLabel}>Justificativa</Text>
              <TextInput
                style={styles.justificationInput}
                placeholder="Não vou conseguir chegar no horário e gostaria de trocar para o horário seguinte."
                placeholderTextColor="#0F0F0F"
                multiline
                numberOfLines={4}
                value={rescheduleReason}
                onChangeText={setRescheduleReason}
                textAlignVertical="top"
              />
            </View>

            <TouchableOpacity
              style={styles.continueButton}
              activeOpacity={0.8}
              onPress={handleContinueReschedule}
            >
              <Text style={styles.continueButtonText}>Continuar</Text>
              <MaterialIcons name="keyboard-arrow-right" size={24} color="#000E3D" />
            </TouchableOpacity>
          </Animated.View>
        </View>
      </ScrollView>
    </View>
  );
};

export default AppointmentDetailScreen;

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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 100,
  },
  errorText: {
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#0F0F0F',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
    alignItems: 'center',
  },
  mainCard: {
    backgroundColor: '#FEFEFE',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    padding: 24,
    marginTop: 0,
    marginHorizontal: 0,
    width: '100%',
    shadowColor: '#1D1D1D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 4,
    gap: 24,
  },
  appointmentDetails: {
    gap: 8,
  },
  dateTimeText: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#E5102E',
  },
  serviceName: {
    fontSize: 20,
    fontFamily: 'Montserrat_700Bold',
    color: '#0F0F0F',
  },
  professionalSection: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#E5102E',
    textAlign: 'left',
    marginBottom: 0,
  },
  businessInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  businessAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  placeholderAvatar: {
    backgroundColor: '#E0E0E0',
  },
  businessName: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#0F0F0F',
  },
  addressCard: {
    backgroundColor: '#FEFEFE',
    borderRadius: 4,
    padding: 16,
    shadowColor: '#1D1D1D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  addressText: {
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#0F0F0F',
  },
  paymentSection: {
    gap: 8,
  },
  paymentCard: {
    backgroundColor: '#FEFEFE',
    borderRadius: 24,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    shadowColor: '#1D1D1D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 4,
    width: '100%',
  },
  paymentInfo: {
    flex: 1,
    gap: 8,
  },
  paymentMethodLabel: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#0F0F0F',
  },
  paymentPrice: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#17723F',
  },
  notesSection: {
    gap: 8,
  },
  notesText: {
    fontSize: 16,
    fontFamily: 'Montserrat_500Medium',
    color: '#0F0F0F',
  },
  rescheduleButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rescheduleButtonText: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#E5102E',
  },
  rescheduleForm: {
    gap: 24,
    width: '100%',
    flexDirection: 'column',
  },
  justificationSection: {
    gap: 4,
    width: '100%',
  },
  justificationLabel: {
    fontSize: 12,
    fontFamily: 'Montserrat_700Bold',
    color: '#0F0F0F',
  },
  justificationInput: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#474747',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 16,
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#0F0F0F',
    minHeight: 150,
    textAlignVertical: 'top',
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#000E3D',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 16,
    width: '100%',
  },
  continueButtonText: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#000E3D',
  },
});

