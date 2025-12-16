import React, { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../../lib/supabase';
import { useToast } from '../../../../components/ui/ToastProvider';
import { handleError } from '../../../../lib/errorHandler';
import { responsiveHeight } from '../../../../lib/responsive';
import SelectDropdown from '../../../../components/ui/SelectDropdown';
import ServiceImagePicker from '../../../../components/ui/ServiceImagePicker';
import { CustomInput } from '../../../../components/ui/CustomInput';
import AppHeader from '../../../../components/layout/AppHeader';
import ScreenContainer from '../../../../components/layout/ScreenContainer';
import { safeGoBack } from '../../../../lib/router-utils';
import { CustomButton } from '../../../../components/CustomButton';
import { RadioGroup } from '../../../../components/ui/RadioGroup';
import { Chip } from '../../../../components/ui/Chip';

type AvailabilityOption = {
  value: 'available' | 'unavailable';
  label: string;
};

type ServiceRecord = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration_minutes: number | null;
  location_type: 'home' | 'shop' | null;
  is_active: boolean | null;
  price_type: 'fixed' | 'hourly' | null;
  photos: string[] | string | null;
};

const AVAILABILITY_OPTIONS: AvailabilityOption[] = [
  { value: 'available', label: 'Disponível' },
  { value: 'unavailable', label: 'Indisponível' },
];

const EditServiceScreen: React.FC = () => {
  const router = useRouter();
  const { showError } = useToast();
  const params = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [imagesUploading, setImagesUploading] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [service, setService] = useState<ServiceRecord | null>(null);

  // Form state
  const [serviceName, setServiceName] = useState('');
  const [chargeType, setChargeType] = useState<'fixed' | 'hourly'>('fixed');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('');
  const [category, setCategory] = useState<'local' | 'home'>('local');
  const [availability, setAvailability] = useState<AvailabilityOption | null>(null);
  const [description, setDescription] = useState('');
  const [serviceImages, setServiceImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

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

  const formatPriceFromNumber = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const loadService = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: authData, error: authError } = await supabase.auth.getUser();
      const currentUser = authData?.user;

      if (authError || !currentUser) {
        router.replace('/(auth)/login');
        return;
      }

      const { data: businessData, error: businessError } = await supabase
        .from('business_profiles')
        .select('id')
        .eq('owner_id', currentUser.id)
        .single();

      if (businessError || !businessData) {
        Alert.alert('Erro', 'Negócio não encontrado.');
        safeGoBack('/(merchant)/services');
        return;
      }

      setBusinessId(businessData.id);

      const { data: serviceData, error: serviceError } = await supabase
        .from('services')
        .select('*')
        .eq('id', params.id)
        .eq('business_id', businessData.id)
        .single();

      if (serviceError || !serviceData) {
        Alert.alert('Erro', 'Serviço não encontrado.');
        safeGoBack('/(merchant)/services');
        return;
      }

      const normalizedPhotos = normalizePhotos(serviceData.photos);

      setService(serviceData as ServiceRecord);
      setServiceName(serviceData.name || '');
      setDescription(serviceData.description || '');
      setPrice(formatPriceFromNumber(serviceData.price));
      setDuration(serviceData.duration_minutes ? String(serviceData.duration_minutes) : '');
      setCategory(serviceData.location_type === 'home' ? 'home' : 'local');
      setAvailability(
        serviceData.is_active
          ? AVAILABILITY_OPTIONS[0]
          : serviceData.is_active === false
          ? AVAILABILITY_OPTIONS[1]
          : null,
      );
      setChargeType(serviceData.price_type === 'hourly' ? 'hourly' : 'fixed');
      setServiceImages(normalizedPhotos);
    } catch (err: unknown) {
      const processed = handleError(err, 'service');
      setError(processed.userMessage);
      showError(processed.userMessage);
    } finally {
      setLoading(false);
    }
  }, [params.id, router, showError]);

  useEffect(() => {
    loadService();
  }, [loadService]);

  const normalizePhotos = (photos: ServiceRecord['photos']): string[] => {
    if (!photos) return [];
    if (Array.isArray(photos)) return photos;
    try {
      const parsed = JSON.parse(photos);
      if (Array.isArray(parsed)) return parsed;
      return [photos];
    } catch {
      return [photos];
    }
  };


  const uploadImagesToSupabase = async (): Promise<string[]> => {
    if (serviceImages.length === 0) return [];

    const newImages = serviceImages.filter(
      (img) => img.startsWith('file://') || img.startsWith('content://'),
    );
    const existingImages = serviceImages.filter(
      (img) => img.startsWith('http://') || img.startsWith('https://'),
    );

    if (newImages.length === 0) return existingImages;

    try {
      setImagesUploading(true);

      const { data, error: authError } = await supabase.auth.getUser();
      const currentUser = data?.user;

      if (authError || !currentUser) {
        throw new Error('Usuário não autenticado. Faça login novamente.');
      }

      const authenticatedUserId = currentUser.id;
      const uploadPromises = newImages.map(async (imageUri, index) => {
        const fileExt = imageUri.split('.').pop() || 'jpg';
        const fileName = `${authenticatedUserId}-${Date.now()}-${index}.${fileExt}`;
        const filePath = `service-images/${fileName}`;

        // Verificar se o arquivo existe antes de ler
        const fileInfo = await FileSystem.getInfoAsync(imageUri);
        if (!fileInfo.exists) {
          throw new Error(`Arquivo de imagem ${index + 1} não encontrado. Por favor, selecione a imagem novamente.`);
        }

        let base64: string;
        try {
          base64 = await FileSystem.readAsStringAsync(imageUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
        } catch (fileError) {
          console.error(`Erro ao ler arquivo da imagem ${index + 1}:`, fileError);
          throw new Error(`Não foi possível ler o arquivo de imagem ${index + 1}. Verifique se o arquivo não está corrompido.`);
        }

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

        if (uploadError) {
          console.error(`Erro no upload da imagem ${index}:`, uploadError);
          throw uploadError;
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from('services-assets').getPublicUrl(filePath);

        return publicUrl;
      });

      const uploadedUrls = await Promise.all(uploadPromises);
      return [...existingImages, ...uploadedUrls];
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      console.error('Erro ao fazer upload das imagens:', err);
      throw new Error(`Erro ao fazer upload das imagens: ${errorMessage}`);
    } finally {
      setImagesUploading(false);
    }
  };

  const handleSave = async () => {
    if (!serviceName.trim() || !price.trim()) {
      setError('Informe pelo menos nome e preço do serviço.');
      return;
    }

    if (!service || !businessId) {
      setError('Dados do serviço não encontrados.');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const numericPrice = Number(
        price.replace('R$', '').replace('.', '').replace(',', '.').trim(),
      );

      if (isNaN(numericPrice) || numericPrice <= 0) {
        setError('Preço inválido. Informe um valor válido.');
        return;
      }

      const durationMinutes = parseDurationToMinutes(duration);
      const photos = await uploadImagesToSupabase();

      const { error: updateError } = await supabase
        .from('services')
        .update({
          name: serviceName,
          description: description || null,
          price: numericPrice,
          duration_minutes: durationMinutes,
          location_type: category === 'home' ? 'home' : 'shop',
          is_active: availability?.value === 'available',
          price_type: chargeType === 'hourly' ? 'hourly' : 'fixed',
          photos: photos.length > 0 ? photos : null,
        })
        .eq('id', service.id)
        .eq('business_id', businessId);

      if (updateError) {
        const processed = handleError(updateError, 'service');
        setError(processed.userMessage);
        showError(processed.userMessage);
        return;
      }

      Alert.alert('Sucesso', 'Serviço atualizado com sucesso!', [
        { text: 'OK', onPress: () => safeGoBack('/(merchant)/services') },
      ]);
    } catch (err: unknown) {
      const processed = handleError(err, 'service');
      setError(processed.userMessage);
      showError(processed.userMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!service || !businessId) return;
    Alert.alert(
      'Excluir Serviço',
      'Tem certeza que deseja excluir este serviço? Esta ação não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              setSaving(true);
              const { error: deleteError } = await supabase
                .from('services')
                .delete()
                .eq('id', service.id)
                .eq('business_id', businessId);

              if (deleteError) {
                console.error('Erro ao excluir serviço:', deleteError);
                Alert.alert('Erro', 'Não foi possível excluir o serviço.');
                return;
              }

              Alert.alert('Sucesso', 'Serviço excluído com sucesso!', [
                { text: 'OK', onPress: () => safeGoBack('/(merchant)/services') },
              ]);
            } catch (err) {
              console.error('Erro ao excluir serviço:', err);
              Alert.alert('Erro', 'Ocorreu um erro ao excluir o serviço.');
            } finally {
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <ScreenContainer scroll={false} backgroundColor="#FAFAFA" hasTabBar={false}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E5102E" />
        </View>
      </ScreenContainer>
    );
  }

  if (!service) {
    return (
      <ScreenContainer 
        scroll={false} 
        backgroundColor="#FAFAFA" 
        hasHeader={true}
        hasTabBar={false}
        header={
          <AppHeader 
            title="Editar serviço"
            showBackButton={true}
            onPressBack={() => safeGoBack('/(merchant)/services')}
          />
        }
      >
        <View style={styles.loadingContainer}>
          <Text style={styles.emptyText}>Serviço não encontrado.</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer 
      scroll={true}
      hasHeader={true}
      hasTabBar={false}
      backgroundColor="#FAFAFA"
      header={
        <AppHeader 
          title="Editar serviço"
          showBackButton={true}
          onPressBack={() => safeGoBack('/(merchant)/services')}
        />
      }
      footer={
        <View style={styles.footerContainer}>
          <CustomButton
            compact
            title="Excluir Serviço"
            variant="danger"
            onPress={handleDelete}
            isLoading={saving && !imagesUploading}
            disabled={saving || imagesUploading}
            style={{ marginBottom: 12 }}
          />
          <CustomButton
            compact
            title="Salvar alterações"
            variant="primary"
            onPress={handleSave}
            isLoading={saving || imagesUploading}
            disabled={saving || imagesUploading}
          />
        </View>
      }
    >
          <View style={styles.form}>
            <CustomInput
              label="Nome do Serviço"
              placeholder="Nome do Serviço"
              value={serviceName}
              onChangeText={setServiceName}
              containerStyle={styles.inputGroup}
            />

            <View style={styles.radioGroup}>
              <Text style={styles.label}>Forma de cobrança</Text>
              <RadioGroup
                options={[
                  { label: 'Valor Fixo', value: 'fixed' },
                  { label: 'Valor por hora', value: 'hourly' },
                ]}
                value={chargeType}
                onValueChange={(value) => setChargeType(value as 'fixed' | 'hourly')}
                direction="row"
                gap={12}
              />
            </View>

            <CustomInput
              label="Preço"
              placeholder="R$ 100,00"
              keyboardType="numeric"
              value={price}
              onChangeText={handlePriceChange}
              containerStyle={styles.inputGroup}
            />

            <CustomInput
              label="Duração"
              placeholder="1h"
              value={duration}
              onChangeText={setDuration}
              containerStyle={styles.inputGroup}
            />

            <View style={styles.radioGroup}>
              <Text style={styles.label}>Categoria do Serviço</Text>
              <View style={styles.chipRow}>
                <Chip
                  label="No meu local"
                  selected={category === 'local'}
                  variant={category === 'local' ? 'filled' : 'outline'}
                  onPress={() => setCategory('local')}
                  onClose={category === 'local' ? () => setCategory('home') : undefined}
                />
                <Chip
                  label="À domicílio"
                  selected={category === 'home'}
                  variant={category === 'home' ? 'filled' : 'outline'}
                  onPress={() => setCategory('home')}
                  onClose={category === 'home' ? () => setCategory('local') : undefined}
                />
              </View>
            </View>

            <CustomInput
              label="Descrição do Serviço"
              placeholder="Conte mais sobre o serviço."
              multiline
              numberOfLines={4}
              value={description}
              onChangeText={setDescription}
              containerStyle={styles.textareaGroup}
              inputContainerStyle={styles.textarea}
            />

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

            <ServiceImagePicker
              images={serviceImages}
              onImagesChange={setServiceImages}
              uploading={imagesUploading}
              maxImages={4}
            />
          </View>

          {!!error && <Text style={styles.errorText}>{error}</Text>}
    </ScreenContainer>
  );
};

export default EditServiceScreen;

const headerHeight = responsiveHeight(129);

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  header: {
    height: headerHeight,
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'flex-start',
    alignSelf: 'stretch',
    overflow: 'hidden',
    position: 'relative',
    marginHorizontal: -16, // Full-bleed header: compensa o padding padrão de 16px
  },
  headerBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    zIndex: 0,
  },
  headerContent: {
    width: '90%',
    maxWidth: 342,
    height: 49,
    gap: 4,
    alignItems: 'flex-start',
    zIndex: 1,
    alignSelf: 'center',
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
    width: '90%',
    maxWidth: 342,
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
    width: '90%',
    maxWidth: 342,
    alignSelf: 'center',
    gap: 16,
  },
  inputGroup: {
    width: '100%',
    marginBottom: 16,
  },
  label: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 12,
    color: '#000E3D',
    marginBottom: 4,
  },
  radioGroup: {
    width: '100%',
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  textareaGroup: {
    marginTop: 16,
    marginBottom: 16,
  },
  textarea: {
    borderWidth: 1,
    borderColor: '#474747',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 16,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  errorText: {
    marginTop: 16,
    alignSelf: 'center',
    color: '#E5102E',
    fontFamily: 'Montserrat_500Medium',
    fontSize: 14,
  },
  footerContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  actions: {
    paddingBottom: 32,
    gap: 12,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#474747',
    textAlign: 'center',
  },
});




