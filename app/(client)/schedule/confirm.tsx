import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import {
  IconBack,
  IconPix,
  IconCreditCard,
  IconCash,
  IconNotification,
  IconCheckCircle,
  IconRadioFill,
  IconRadioNoFill,
} from '../../../lib/icons';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import AppointmentSuccessModal from '../../../components/AppointmentSuccessModal';

type Service = {
  id: string;
  name: string;
  price: number;
  description: string | null;
  duration_minutes: number | null;
};

type Business = {
  id: string;
  business_name: string;
  address: string | null;
  logo_url: string | null;
};

const ScheduleConfirmScreen: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{
    businessId: string;
    serviceId: string;
    date: string;
    time: string;
  }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [service, setService] = useState<Service | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<
    'pix' | 'card' | 'cash'
  >('pix');
  const [observations, setObservations] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Resetar estado quando a tela é focada
  useFocusEffect(
    React.useCallback(() => {
      setSelectedPaymentMethod('pix');
      setObservations('');
      return () => {
        // Cleanup ao desfocar
      };
    }, [])
  );

  useEffect(() => {
    loadData();
  }, [params.businessId, params.serviceId]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Buscar serviço
      if (params.serviceId) {
        const { data: serviceData } = await supabase
          .from('services')
          .select('id, name, price, description, duration_minutes')
          .eq('id', params.serviceId)
          .single();

        if (serviceData) {
          setService(serviceData as Service);
        }
      }

      // Buscar loja
      if (params.businessId) {
        const { data: businessData } = await supabase
          .from('business_profiles')
          .select('id, business_name, address, logo_url')
          .eq('id', params.businessId)
          .single();

        if (businessData) {
          setBusiness(businessData as Business);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDateAndTime = () => {
    if (!params.date || !params.time) return 'Hoje - 10h às 11h';
    
    const date = new Date(params.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);
    
    const isToday = compareDate.getTime() === today.getTime();
    const [hours, minutes] = params.time.split(':');
    const nextHour = parseInt(hours) + 1;
    
    if (isToday) {
      return `Hoje - ${hours}h às ${nextHour}h`;
    }
    return `${hours}h às ${nextHour}h`;
  };

  const isToday = () => {
    if (!params.date) return false;
    const date = new Date(params.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);
    return compareDate.getTime() === today.getTime();
  };

  const handleConfirm = async () => {
    try {
      setSubmitting(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert('Erro', 'Usuário não autenticado');
        setSubmitting(false);
        return;
      }

      if (!params.businessId || !params.serviceId || !params.date || !params.time || !service) {
        Alert.alert('Erro', 'Dados incompletos');
        setSubmitting(false);
        return;
      }

      // Calcular start_time e end_time
      const startTime = `${params.date}T${params.time}:00`;
      const durationMinutes = service.duration_minutes || 60; // Default 1 hora se não especificado
      const startDate = new Date(startTime);
      const endDate = new Date(startDate.getTime() + durationMinutes * 60000);
      const endTime = endDate.toISOString();

      // Criar agendamento
      const { data, error } = await supabase
        .from('appointments')
        .insert({
          client_id: user.id,
          business_id: params.businessId,
          service_id: params.serviceId,
          start_time: startTime,
          end_time: endTime,
          status: 'pending',
          payment_method: selectedPaymentMethod,
          client_notes: observations || null,
        })
        .select()
        .single();

      if (error) {
        console.error('Erro ao criar agendamento:', error);
        Alert.alert('Erro', 'Não foi possível criar o agendamento');
        setSubmitting(false);
        return;
      }

      // Exibir modal de sucesso
      setShowSuccessModal(true);
    } catch (error) {
      console.error('Erro ao confirmar agendamento:', error);
      Alert.alert('Erro', 'Ocorreu um erro ao confirmar o agendamento');
    } finally {
      setSubmitting(false);
    }
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
          >
            <IconBack size={24} color="#FEFEFE" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.notificationButton}>
            <IconNotification size={24} color="#FEFEFE" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Main Card */}
        <View style={styles.mainCard}>
          {/* Appointment Details */}
          <View style={styles.appointmentDetails}>
            <Text style={styles.dateTimeText}>{formatDateAndTime()}</Text>
            {service && (
              <Text style={styles.serviceName}>{service.name}</Text>
            )}
            {service && (
              <Text style={styles.priceText}>
                R$ {service.price.toFixed(2).replace('.', ',')}
              </Text>
            )}
          </View>

          {/* Business Info */}
          {business && (
            <View style={styles.businessInfo}>
              <View style={styles.businessHeader}>
                {business.logo_url ? (
                  <Image
                    source={{ uri: business.logo_url }}
                    style={styles.businessAvatar}
                  />
                ) : (
                  <View style={[styles.businessAvatar, styles.placeholderAvatar]} />
                )}
                <Text style={styles.businessName}>{business.business_name}</Text>
              </View>
              {business.address && (
                <View style={styles.addressCard}>
                  <Text style={styles.addressText}>{business.address}</Text>
                </View>
              )}
            </View>
          )}

          {/* Payment Method */}
          <View style={styles.paymentSection}>
            <Text style={styles.paymentTitle}>Selecione o método de pagamento</Text>
            <View style={styles.paymentMethodsRow}>
              <TouchableOpacity
                style={styles.paymentMethodItem}
                activeOpacity={0.8}
                onPress={() => setSelectedPaymentMethod('pix')}
              >
                {selectedPaymentMethod === 'pix' ? (
                  <IconRadioFill size={24} color="#000E3D" />
                ) : (
                  <IconRadioNoFill size={24} color="#000E3D" />
                )}
                <IconPix size={24} color="#000E3D" />
                <Text style={styles.paymentMethodLabel}>PIX</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.paymentMethodItem}
                activeOpacity={0.8}
                onPress={() => setSelectedPaymentMethod('card')}
              >
                {selectedPaymentMethod === 'card' ? (
                  <IconRadioFill size={24} color="#000E3D" />
                ) : (
                  <IconRadioNoFill size={24} color="#000E3D" />
                )}
                <IconCreditCard size={24} color="#000E3D" />
                <Text style={styles.paymentMethodLabel}>Cartão</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.paymentMethodItem}
                activeOpacity={0.8}
                onPress={() => setSelectedPaymentMethod('cash')}
              >
                {selectedPaymentMethod === 'cash' ? (
                  <IconRadioFill size={24} color="#000E3D" />
                ) : (
                  <IconRadioNoFill size={24} color="#000E3D" />
                )}
                <IconCash size={24} color="#000E3D" />
                <Text style={styles.paymentMethodLabel}>Dinheiro</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Observations */}
          <View style={styles.observationsSection}>
            <Text style={styles.observationsLabel}>Observações</Text>
            <TextInput
              style={styles.observationsInput}
              placeholder="Gostaria de sugerir um novo horário pois terei uma consulta médica nesse horário solicitado."
              placeholderTextColor="#0F0F0F"
              multiline
              numberOfLines={4}
              value={observations}
              onChangeText={setObservations}
              textAlignVertical="top"
            />
          </View>

          {/* Confirm Button */}
          <TouchableOpacity
            style={[styles.confirmButton, submitting && styles.confirmButtonDisabled]}
            activeOpacity={0.8}
            onPress={handleConfirm}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#000E3D" />
            ) : (
              <>
                <Text style={styles.confirmButtonText}>Agendar</Text>
                <IconCheckCircle size={24} color="#000E3D" />
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Success Modal */}
      <AppointmentSuccessModal
        visible={showSuccessModal}
        onClose={() => {
          setShowSuccessModal(false);
          router.replace('/(client)/appointments');
        }}
      />
    </View>
  );
};

export default ScheduleConfirmScreen;

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
    padding: 0,
    paddingBottom: 100,
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
  priceText: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#17723F',
  },
  businessInfo: {
    gap: 8,
  },
  businessHeader: {
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
    gap: 16,
  },
  paymentTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#E5102E',
  },
  paymentMethodsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    flexWrap: 'wrap',
    gap: 24,
  },
  paymentMethodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  paymentMethodLabel: {
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#0F0F0F',
  },
  observationsSection: {
    gap: 4,
    minHeight: 150,
  },
  observationsLabel: {
    fontSize: 12,
    fontFamily: 'Montserrat_700Bold',
    color: '#000E3D',
  },
  observationsInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#474747',
    borderRadius: 4,
    padding: 16,
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#0F0F0F',
    minHeight: 150,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#000E3D',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  confirmButtonText: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#000E3D',
  },
});

