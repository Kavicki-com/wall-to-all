import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useSafeGoBack } from '../../lib/router-utils';
import { supabase } from '../../lib/supabase';
import { IconCheckboxPayment } from '../../lib/assets';
import { useToast } from '../../components/ui/ToastProvider';
import { handleError } from '../../lib/errorHandler';
import SelectDropdown from '../../components/ui/SelectDropdown';
import ServiceImagePicker from '../../components/ui/ServiceImagePicker';
import { Icon } from '../../components/ui/Icon';
import { CustomInput } from '../../components/ui/CustomInput';
import ScreenContainer from '../../components/layout/ScreenContainer';
import SignupHeaderMerchant from '../../components/auth/SignupHeaderMerchant';
import { CustomButton } from '../../components/CustomButton';

type AvailabilityOption = {
  value: string;
  label: string;
};

const AVAILABILITY_OPTIONS: AvailabilityOption[] = [
  { value: 'available', label: 'Disponível' },
  { value: 'unavailable', label: 'Indisponível' },
];

const MerchantSignupServicesScreen: React.FC = () => {
  const router = useRouter();
  const safeGoBack = useSafeGoBack('/(auth)/merchant-signup-business');
  const { showError } = useToast();
  const params = useLocalSearchParams<{ userId?: string; companyId?: string }>();
  const companyId = params.companyId as string | undefined;

  const [serviceName, setServiceName] = useState('');
  const [chargeType, setChargeType] = useState<'fixed' | 'hourly'>('fixed');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('');
  const [category, setCategory] = useState<'local' | 'home'>('local');
  const [availability, setAvailability] = useState<AvailabilityOption | null>(null);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Estados para múltiplas fotos (até 4)
  const [serviceImages, setServiceImages] = useState<string[]>([]);
  const [imagesUploading, setImagesUploading] = useState(false);

  // Resetar campos quando a tela é focada (quando volta de outras telas)
  useFocusEffect(
    React.useCallback(() => {
      setServiceName('');
      setChargeType('fixed');
      setPrice('');
      setDuration('');
      setCategory('local');
      setAvailability(null);
      setDescription('');
      setServiceImages([]);
      setError(null);
    }, [])
  );

  // Função para formatar preço como moeda BRL
  const formatCurrency = (value: string): string => {
    const numbers = value.replace(/\D/g, '');
    if (!numbers) return '';
    const amount = parseInt(numbers, 10) / 100;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const handlePriceChange = (text: string) => {
    const formatted = formatCurrency(text);
    setPrice(formatted);
  };

  // Função para converter duração de formato texto para minutos
  // Função para converter duração de formato texto para minutos
  const parseDurationToMinutes = (durationText: string): number => {
    if (!durationText) return 60; // Default 1 hora
    
    // Remove espaços e converte para lowercase
    const cleaned = durationText.trim().toLowerCase();
    
    // Tenta extrair horas e minutos
    const hourMatch = cleaned.match(/(\d+)\s*h/);
    const minuteMatch = cleaned.match(/(\d+)\s*m/);
    
    let hours = 0;
    let minutes = 0;
    
    if (hourMatch) {
      hours = parseInt(hourMatch[1], 10);
    }
    if (minuteMatch) {
      minutes = parseInt(minuteMatch[1], 10);
    }
    
    // Se não encontrou horas nem minutos, tenta interpretar como número puro
    // Para evitar ambiguidade, assumimos que números pequenos (<= 8) são horas
    // e números maiores são minutos (mais comum para serviços)
    if (!hourMatch && !minuteMatch) {
      const numberMatch = cleaned.match(/(\d+)/);
      if (numberMatch) {
        const number = parseInt(numberMatch[1], 10);
        // Se o número for <= 8, assume horas (ex: "1" = 1h, "2" = 2h)
        // Se for > 8, assume minutos (ex: "30" = 30min, "60" = 60min)
        // Isso evita que "10" seja interpretado como 10 horas (600 min)
        if (number <= 8) {
          hours = number;
        } else {
          minutes = number;
        }
      }
    }
    
    const totalMinutes = hours * 60 + minutes;
    return totalMinutes > 0 ? totalMinutes : 60; // Default 60 minutos se não conseguir converter
  };



  // Função para fazer upload de múltiplas imagens para Supabase Storage
  const uploadImagesToSupabase = async (): Promise<string[]> => {
    if (serviceImages.length === 0) return [];

    try {
      setImagesUploading(true);

      const { data, error: authError } = await supabase.auth.getUser();
      const currentUser = data?.user;
      
      if (authError || !currentUser) {
        throw new Error('Usuário não autenticado. Faça login novamente.');
      }

      const authenticatedUserId = currentUser.id;
      const uploadPromises = serviceImages.map(async (imageUri, index) => {
        const fileExt = imageUri.split('.').pop() || 'jpg';
        const fileName = `${authenticatedUserId}-${Date.now()}-${index}.${fileExt}`;
        const filePath = `service-images/${fileName}`;

        const base64 = await FileSystem.readAsStringAsync(imageUri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);

      const { error: uploadError } = await supabase.storage
          .from('services-assets')
          .upload(filePath, byteArray, {
            contentType: `image/${fileExt}`,
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from('services-assets').getPublicUrl(filePath);

        return publicUrl;
      });

      const imageUrls = await Promise.all(uploadPromises);
      return imageUrls;
    } catch (error) {
      console.error('Erro ao fazer upload das imagens:', error);
      const message = error instanceof Error ? error.message : 'Erro ao fazer upload das imagens';
      throw new Error(`Erro ao fazer upload das imagens: ${message}`);
    } finally {
      setImagesUploading(false);
    }
  };


  const handleContinue = async () => {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    const currentUser = authData?.user;
    
    if (authError || !currentUser) {
      setError('Sessão expirada. Por favor, faça login novamente.');
      setTimeout(() => {
        router.replace('/(auth)/login');
      }, 2000);
      return;
    }

    let businessIdToUse = companyId;
    
    if (!businessIdToUse) {
      const { data: businessData, error: businessError } = await supabase
        .from('business_profiles')
        .select('id')
        .eq('owner_id', currentUser.id)
        .single();

      if (businessError || !businessData) {
        setError('Negócio não encontrado. Por favor, complete o cadastro do negócio primeiro.');
        return;
      }

      businessIdToUse = businessData.id;
    }

    if (!serviceName || !price) {
      setError('Informe pelo menos nome e preço do serviço.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const numericPrice = Number(
        price.replace('R$', '').replace('.', '').replace(',', '.').trim(),
      );

      if (isNaN(numericPrice) || numericPrice <= 0) {
        setError('Preço inválido. Informe um valor válido.');
        return;
      }

      const durationMinutes = parseDurationToMinutes(duration);

      let imageUrls: string[] = [];
      if (serviceImages.length > 0) {
        try {
          imageUrls = await uploadImagesToSupabase();
        } catch {
          Alert.alert(
            'Erro no upload',
            'Não foi possível fazer upload de todas as imagens. Deseja continuar sem as imagens?',
            [
              { text: 'Cancelar', style: 'cancel' },
              {
                text: 'Continuar',
                onPress: async () => {
                  await performInsert(businessIdToUse!, numericPrice, durationMinutes, []);
                },
              },
            ]
          );
          return;
        }
      }

      await performInsert(businessIdToUse!, numericPrice, durationMinutes, imageUrls);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Erro ao salvar serviço.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const performInsert = async (
    businessId: string,
    numericPrice: number,
    durationMinutes: number,
    imageUrls: string[]
  ) => {
    const { data: businessData, error: businessError } = await supabase
      .from('business_profiles')
      .select('category_id')
      .eq('id', businessId)
      .single();

    if (businessError) {
      console.error('Erro ao buscar categoria da loja:', businessError);
    }

    const isActive = availability?.value === 'available';
    const locationType = category === 'home' ? 'home' : 'shop';
    const priceTypeValue = chargeType === 'hourly' ? 'hourly' : 'fixed';

    const { error: serviceError } = await supabase.from('services').insert({
      business_id: businessId,
      name: serviceName,
      description: description || null,
      price: numericPrice,
      duration_minutes: durationMinutes,
      location_type: locationType,
      is_active: isActive,
      price_type: priceTypeValue,
      category_id: businessData?.category_id || null,
      photos: imageUrls.length > 0 ? imageUrls : null,
    });

    if (serviceError) {
      const processed = handleError(serviceError, 'service');
      setError(processed.userMessage);
      showError(processed.userMessage);
      return;
    }

    router.replace('/(auth)/merchant-signup-loading');
  };

  return (
    <ScreenContainer
      scroll
      backgroundColor="#FEFEFE"
      contentContainerStyle={{ flexGrow: 1, paddingTop: 0, paddingBottom: 16 }}
      header={
        <SignupHeaderMerchant
          title="Seus serviços"
          subtitle="Cadastre os serviços do seu negócio"
          steps={['Cadastro', 'Endereço', 'Negócio', 'Serviços']}
          currentStepIndex={3}
          showBackButton={true}
          onPressBack={safeGoBack}
        />
      }
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >

          {/* Form */}
          <View style={styles.form}>
            {/* Nome do serviço */}
            <CustomInput
              label="Nome do Serviço"
              placeholder="Nome do Serviço"
              value={serviceName}
              onChangeText={setServiceName}
            />

            {/* Forma de cobrança */}
            <View style={styles.radioGroup}>
              <Text style={styles.label}>Forma de cobrança</Text>
              <View style={styles.radioRow}>
                <TouchableOpacity
                  style={styles.radioOption}
                  onPress={() => setChargeType('fixed')}
                  activeOpacity={0.7}
                >
                  <View style={styles.radioContainer}>
                    {chargeType === 'fixed' ? (
                      <IconCheckboxPayment width={24} height={24} />
                    ) : (
                      <View style={styles.radioCircle} />
                    )}
                    <Text style={styles.radioLabel}>Valor Fixo</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.radioOption}
                  onPress={() => setChargeType('hourly')}
                  activeOpacity={0.7}
                >
                  <View style={styles.radioContainer}>
                    {chargeType === 'hourly' ? (
                      <IconCheckboxPayment width={24} height={24} />
                    ) : (
                      <View style={styles.radioCircle} />
                    )}
                    <Text style={styles.radioLabel}>Valor por hora</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {/* Preço */}
            <CustomInput
              label="Preço"
              placeholder="R$ 100,00"
              keyboardType="numeric"
              value={price}
              onChangeText={handlePriceChange}
            />

            {/* Duração */}
            <CustomInput
              label="Duração"
              placeholder="1h"
              value={duration}
              onChangeText={setDuration}
            />

            {/* Categoria do Serviço */}
            <View style={styles.radioGroup}>
              <Text style={styles.label}>Categoria do Serviço</Text>
              <View style={styles.chipRow}>
                <View style={styles.chipContainer}>
                  <TouchableOpacity
                    style={[
                      category === 'local' ? styles.chip : styles.chipOutline,
                      category === 'local' && styles.chipActive,
                    ]}
                    activeOpacity={0.7}
                    onPress={() => setCategory('local')}
                  >
                    <Text
                      style={[
                        category === 'local' ? styles.chipText : styles.chipTextOutline,
                        category === 'local' && styles.chipTextActive,
                      ]}
                    >
                      No meu local
                    </Text>
                    {category === 'local' && (
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          setCategory('home');
                        }}
                        style={styles.chipCloseButton}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Icon name="close" family="MaterialSymbols" size={16} color="#FEFEFE" />
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                </View>
                <View style={styles.chipContainer}>
                  <TouchableOpacity
                    style={[
                      category === 'home' ? styles.chip : styles.chipOutline,
                      category === 'home' && styles.chipActive,
                    ]}
                    activeOpacity={0.7}
                    onPress={() => setCategory('home')}
                  >
                    <Text
                      style={[
                        category === 'home' ? styles.chipText : styles.chipTextOutline,
                        category === 'home' && styles.chipTextActive,
                      ]}
                    >
                      À domicílio
                    </Text>
                    {category === 'home' && (
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          setCategory('local');
                        }}
                        style={styles.chipCloseButton}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Icon name="close" family="MaterialSymbols" size={16} color="#FEFEFE" />
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Descrição do serviço */}
            <CustomInput
              label="Descrição do Serviço"
              placeholder="Deixe aqui sua opinião."
              multiline
              numberOfLines={4}
              value={description}
              onChangeText={setDescription}
              containerStyle={styles.textareaGroup}
            />

            {/* Disponibilidade */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Disponibilidade</Text>
            <SelectDropdown<AvailabilityOption>
              data={AVAILABILITY_OPTIONS}
              labelKey="label"
              valueKey="value"
              onSelect={(option) => setAvailability(option)}
              selectedValue={availability}
              placeholder="Selecione aqui"
            />
            </View>

            {/* Fotos do serviço */}
            <ServiceImagePicker
              images={serviceImages}
              onImagesChange={setServiceImages}
              uploading={imagesUploading}
              maxImages={4}
            />
          </View>

          {!!error && <Text style={styles.errorText}>{error}</Text>}

        {/* Botão Continuar */}
        <View style={styles.actions}>
          <CustomButton
            title="Continuar"
            onPress={handleContinue}
            isLoading={loading || imagesUploading}
            disabled={loading || imagesUploading}
            variant="primary"
            style={{ borderRadius: 24, marginVertical: 0 }}
            width="100%"
          />
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
};

export default MerchantSignupServicesScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  form: {
    marginTop: 24,
    width: '100%',
    gap: 16,
  },
  inputGroup: {
    width: '100%',
  },
  label: {
    fontSize: 12,
    fontFamily: 'Montserrat_700Bold',
    color: '#000E3D',
    marginBottom: 4,
  },
  radioGroup: {
    width: '100%',
  },
  radioRow: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 8,
    flexWrap: 'wrap',
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  radioCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000E3D',
  },
  radioLabel: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 16,
    color: '#0F0F0F',
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  chipContainer: {
    flexDirection: 'row',
  },
  chip: {
    backgroundColor: '#000E3D',
    borderRadius: 32,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  chipText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: '#FEFEFE',
  },
  chipOutline: {
    borderWidth: 1,
    borderColor: '#000E3D',
    borderRadius: 32,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  chipTextOutline: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: '#000E3D',
  },
  chipActive: {
    backgroundColor: '#000E3D',
  },
  chipTextActive: {
    color: '#FEFEFE',
  },
  chipCloseButton: {
    marginLeft: 4,
    paddingVertical: 2,
    paddingHorizontal: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipCloseIcon: {
    color: '#FEFEFE',
    fontSize: 20,
    fontFamily: 'Montserrat_700Bold',
    lineHeight: 22,
  },
  textareaGroup: {
    marginTop: 16,
  },
  errorText: {
    marginTop: 16,
    alignSelf: 'center',
    color: '#E5102E',
    fontFamily: 'Montserrat_500Medium',
    fontSize: 14,
  },
  actions: {
    paddingBottom: 32,
  },
});