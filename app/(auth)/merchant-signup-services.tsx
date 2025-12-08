import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { RadialGradient, LinearGradient } from 'react-native-gradients';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { IconCheckboxPayment } from '../../lib/assets';
import { IconChevronDown, IconAddPhoto, IconClose } from '../../lib/icons';
import SelectDropdown from '../../components/ui/SelectDropdown';

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

  // Função para formatar preço como moeda BRL
  const formatCurrency = (value: string): string => {
    // Remove tudo exceto números
    const numbers = value.replace(/\D/g, '');
    
    if (!numbers) return '';
    
    // Converte para número e formata como BRL
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
    
    // Se não encontrou horas nem minutos, tenta interpretar como número puro (assumindo horas)
    if (!hourMatch && !minuteMatch) {
      const numberMatch = cleaned.match(/(\d+)/);
      if (numberMatch) {
        hours = parseInt(numberMatch[1], 10);
      }
    }
    
    return hours * 60 + minutes || 60; // Default 60 minutos se não conseguir converter
  };


  // Função para solicitar permissões de imagem
  const requestImagePermissions = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permissão necessária',
          'Precisamos da permissão para acessar suas fotos!'
        );
        return false;
      }
    }
    return true;
  };

  // Função para selecionar imagem
  const handlePickImage = async () => {
    if (serviceImages.length >= 4) {
      Alert.alert('Limite atingido', 'Você pode adicionar no máximo 4 fotos.');
      return;
    }

    const hasPermission = await requestImagePermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const newImage = result.assets[0].uri;
        setServiceImages([...serviceImages, newImage]);
      }
    } catch (error) {
      console.error('Erro ao selecionar imagem:', error);
      Alert.alert('Erro', 'Não foi possível selecionar a imagem.');
    }
  };

  // Função para remover imagem
  const handleRemoveImage = (index: number) => {
    const newImages = serviceImages.filter((_, i) => i !== index);
    setServiceImages(newImages);
  };

  // Função para fazer upload de múltiplas imagens para Supabase Storage
  const uploadImagesToSupabase = async (): Promise<string[]> => {
    if (serviceImages.length === 0) return [];

    try {
      setImagesUploading(true);

      // Verificar se o usuário está autenticado
      const { data, error: authError } = await supabase.auth.getUser();
      const currentUser = data?.user;
      
      if (authError || !currentUser) {
        throw new Error('Usuário não autenticado. Faça login novamente.');
      }

      const authenticatedUserId = currentUser.id;
      const uploadPromises = serviceImages.map(async (imageUri, index) => {
        // Criar nome único para cada arquivo
        const fileExt = imageUri.split('.').pop() || 'jpg';
        const fileName = `${authenticatedUserId}-${Date.now()}-${index}.${fileExt}`;
        const filePath = `service-images/${fileName}`;

        // Ler o arquivo como base64
        const base64 = await FileSystem.readAsStringAsync(imageUri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        // Converter base64 para ArrayBuffer
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);

        // Fazer upload para Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('services-assets')
          .upload(filePath, byteArray, {
            contentType: `image/${fileExt}`,
            upsert: false,
          });

        if (uploadError) {
          console.error(`Erro no upload da imagem ${index}:`, uploadError);
          throw uploadError;
        }

        // Obter URL pública da imagem
        const {
          data: { publicUrl },
        } = supabase.storage.from('services-assets').getPublicUrl(filePath);

        return publicUrl;
      });

      const imageUrls = await Promise.all(uploadPromises);
      return imageUrls;
    } catch (error: any) {
      console.error('Erro ao fazer upload das imagens:', error);
      throw new Error(`Erro ao fazer upload das imagens: ${error.message}`);
    } finally {
      setImagesUploading(false);
    }
  };

  const handleContinue = async () => {
    // Buscar business_id do business_profiles baseado no usuário logado
    const { data: authData, error: authError } = await supabase.auth.getUser();
    const currentUser = authData?.user;
    
    if (authError || !currentUser) {
      setError('Sessão expirada. Por favor, faça login novamente.');
      setTimeout(() => {
        router.replace('/(auth)/login');
      }, 2000);
      return;
    }

    // Buscar business_id
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

    // Validações
    if (!serviceName || !price) {
      setError('Informe pelo menos nome e preço do serviço.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Converter preço para número (remove formatação BRL)
      const numericPrice = Number(
        price.replace('R$', '').replace('.', '').replace(',', '.').trim(),
      );

      if (isNaN(numericPrice) || numericPrice <= 0) {
        setError('Preço inválido. Informe um valor válido.');
        return;
      }

      // Converter duração para minutos
      const durationMinutes = parseDurationToMinutes(duration);

      // Fazer upload das imagens
      let imageUrls: string[] = [];
      if (serviceImages.length > 0) {
        try {
          imageUrls = await uploadImagesToSupabase();
        } catch (uploadError: any) {
          Alert.alert(
            'Erro no upload',
            `Não foi possível fazer upload de todas as imagens: ${uploadError.message}. Deseja continuar sem as imagens?`,
            [
              { text: 'Cancelar', style: 'cancel' },
              {
                text: 'Continuar',
                onPress: async () => {
                  // Continuar sem as imagens
                  await performInsert(businessIdToUse!, numericPrice, durationMinutes, []);
                },
              },
            ]
          );
          return;
        }
      }

      await performInsert(businessIdToUse!, numericPrice, durationMinutes, imageUrls);
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao salvar serviço.');
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
    // Buscar a categoria da loja para herdar no serviço
    const { data: businessData, error: businessError } = await supabase
      .from('business_profiles')
      .select('category_id')
      .eq('id', businessId)
      .single();

    if (businessError) {
      console.error('Erro ao buscar categoria da loja:', businessError);
    }

    // Mapear disponibilidade para is_active
    const isActive = availability?.value === 'available';

    // Mapear categoria para location_type
    const locationType = category === 'home' ? 'home' : 'shop';

    // Mapear chargeType para price_type
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
      category_id: businessData?.category_id || null, // Herdar categoria da loja
      photos: imageUrls.length > 0 ? imageUrls : null, // Array já está no formato correto
    });

    if (serviceError) {
      console.error('Erro ao inserir serviço:', serviceError);
      setError(serviceError.message);
      return;
    }

    router.replace('/(auth)/merchant-signup-loading');
  };

  return (
    <View style={styles.background}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header com o mesmo gradiente da seleção de tipo */}
          <View style={styles.header}>
            <View style={styles.headerBackground}>
              <View
                style={[
                  StyleSheet.absoluteFillObject,
                  { backgroundColor: '#000E3D' },
                ]}
              />
              <View style={StyleSheet.absoluteFillObject}>
                <LinearGradient
                  angle={0}
                  colorList={[
                    {
                      offset: '0%',
                      color: 'rgba(0, 14, 61, 0.80)',
                      opacity: '1',
                    },
                    {
                      offset: '100%',
                      color: 'rgba(0, 14, 61, 0.95)',
                      opacity: '1',
                    },
                  ]}
                />
              </View>
              <View style={StyleSheet.absoluteFillObject}>
                <RadialGradient
                  x={0.5 as any}
                  y={0.55 as any}
                  rx={2.0 as any}
                  ry={1.0 as any}
                  colorList={[
                    {
                      offset: '0%',
                      color: 'rgba(214, 224, 255, 0.18)',
                      opacity: '1',
                    },
                    {
                      offset: '100%',
                      color: 'rgba(0, 14, 61, 0.0)',
                      opacity: '1',
                    },
                  ]}
                />
              </View>
            </View>

            <View style={styles.headerContent}>
              <Text style={styles.welcomeTitle}>Seus serviços</Text>
              <Text style={styles.welcomeSubtitle}>
                Conte um pouco sobre o que você faz
              </Text>
            </View>
          </View>

          {/* Step bar */}
          <View style={styles.stepBar}>
            <View style={[styles.stepSegment, styles.stepSegmentComplete]} />
            <View style={[styles.stepSegment, styles.stepSegmentComplete]} />
            <View style={[styles.stepSegment, styles.stepSegmentComplete]} />
            <View style={[styles.stepSegment, styles.stepSegmentActive]} />
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Nome do serviço */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nome do Serviço</Text>
              <TextInput
                style={styles.input}
                placeholder="Nome do Serviço"
                placeholderTextColor="#0f0f0f"
                value={serviceName}
                onChangeText={setServiceName}
              />
            </View>

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
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Preço</Text>
              <TextInput
                style={styles.input}
                placeholder="R$ 100,00"
                placeholderTextColor="#0f0f0f"
                keyboardType="numeric"
                value={price}
                onChangeText={handlePriceChange}
              />
            </View>

            {/* Duração */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Duração</Text>
              <TextInput
                style={styles.input}
                placeholder="1h"
                placeholderTextColor="#0f0f0f"
                value={duration}
                onChangeText={setDuration}
              />
            </View>

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
                        <IconClose width={15} height={15} />
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
                        <IconClose width={15} height={15} />
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Descrição do serviço */}
            <View style={styles.textareaGroup}>
              <Text style={styles.label}>Descrição do Serviço</Text>
              <TextInput
                style={styles.textarea}
                placeholder="Deixe aqui sua opinião."
                placeholderTextColor="#0f0f0f"
                multiline
                numberOfLines={4}
                value={description}
                onChangeText={setDescription}
              />
            </View>

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
                strong
              />
            </View>

            {/* Fotos do serviço */}
            <View style={styles.photoGroup}>
              <Text style={styles.label}>Adicione fotos do seu serviço</Text>
              <View style={styles.photoRow}>
                {Array.from({ length: 4 }).map((_, index) => {
                  const imageUri = serviceImages[index];
                  return imageUri ? (
                    <View key={index} style={styles.photoBoxContainer}>
                      <Image
                        source={{ uri: imageUri }}
                        style={styles.photoPreview}
                        resizeMode="cover"
                      />
                      <TouchableOpacity
                        style={styles.removePhotoButton}
                        onPress={() => handleRemoveImage(index)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.removePhotoIcon}>
                          <IconAddPhoto width={14} height={14} />
                        </View>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      key={index}
                      style={styles.photoBox}
                      onPress={handlePickImage}
                      activeOpacity={0.7}
                      disabled={imagesUploading || serviceImages.length >= 4}
                    >
                      {imagesUploading ? (
                        <ActivityIndicator color="#474747" />
                      ) : (
                        <IconAddPhoto width={34} height={34} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>

          {!!error && <Text style={styles.errorText}>{error}</Text>}
        </ScrollView>

        {/* Botão Continuar */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.buttonContained}
            activeOpacity={0.8}
            onPress={handleContinue}
            disabled={loading || imagesUploading}
          >
            {loading || imagesUploading ? (
              <ActivityIndicator color="#FEFEFE" />
            ) : (
              <Text style={styles.buttonContainedText}>Continuar</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

export default MerchantSignupServicesScreen;

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 0,
    paddingBottom: 32,
  },
  header: {
    height: 129,
    paddingVertical: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'flex-start',
    alignSelf: 'stretch',
    overflow: 'hidden',
    position: 'relative',
    marginHorizontal: -24,
  },
  headerBackground: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  headerContent: {
    width: 342,
    height: 49,
    gap: 4,
    alignItems: 'flex-start',
    zIndex: 1,
  },
  welcomeTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 20,
    color: '#FEFEFE',
  },
  welcomeSubtitle: {
    marginTop: 4,
    fontFamily: 'Montserrat_400Regular',
    fontSize: 16,
    color: '#FEFEFE',
  },
  stepBar: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 24,
    marginBottom: 24,
    width: 342,
    alignSelf: 'center',
  },
  stepSegment: {
    flex: 1,
    height: 8,
    borderRadius: 24,
    backgroundColor: '#DBDBDB',
  },
  stepSegmentComplete: {
    backgroundColor: '#E5102E',
  },
  stepSegmentActive: {
    backgroundColor: '#DBDBDB',
  },
  form: {
    marginTop: 24,
    width: 342,
    alignSelf: 'center',
    gap: 16,
  },
  inputGroup: {
    width: '100%',
  },
  label: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 12,
    color: '#000E3D',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#474747',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 16,
    fontFamily: 'Montserrat_400Regular',
    fontSize: 16,
    color: '#0F0F0F',
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
  radioCircleSelected: {
    backgroundColor: '#000E3D',
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
    gap: 4,
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
    gap: 4,
  },
  chipTextOutline: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: '#000E3D',
  },
  chipActive: {
    backgroundColor: '#000E3D',
  },
  chipActiveOutline: {
    backgroundColor: '#000E3D',
  },
  chipTextActive: {
    color: '#FEFEFE',
  },
  chipCloseButton: {
    marginLeft: 4,
    padding: 2,
  },
  textareaGroup: {
    marginTop: 16,
  },
  textarea: {
    borderWidth: 1,
    borderColor: '#474747',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 16,
    minHeight: 120,
    textAlignVertical: 'top',
    fontFamily: 'Montserrat_400Regular',
    fontSize: 16,
    color: '#0F0F0F',
  },
  photoGroup: {
    marginTop: 16,
  },
  photoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 8,
  },
  photoBox: {
    width: 163,
    height: 107,
    borderWidth: 1,
    borderColor: '#000000',
    borderStyle: 'dashed',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D9D9D9',
  },
  photoBoxContainer: {
    width: 163,
    height: 107,
    position: 'relative',
  },
  photoPreview: {
    width: 163,
    height: 107,
    borderRadius: 8,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -15,
    right: -15,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePhotoIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E5102E',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '45deg' }],
  },
  errorText: {
    marginTop: 16,
    alignSelf: 'center',
    color: '#E5102E',
    fontFamily: 'Montserrat_500Medium',
    fontSize: 14,
  },
  actions: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  buttonContained: {
    width: 342,
    alignSelf: 'center',
    backgroundColor: '#000E3D',
    borderRadius: 24,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1D1D1D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.24,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonContainedText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: '#FEFEFE',
  },
});
