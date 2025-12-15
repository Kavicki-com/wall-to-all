import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Alert,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../components/ui/ToastProvider';
import { handleError } from '../../../lib/errorHandler';
import AppHeader from '../../../components/layout/AppHeader';
import { safeGoBack } from '../../../lib/router-utils';
import SelectDropdown from '../../../components/ui/SelectDropdown';
import ServiceImagePicker from '../../../components/ui/ServiceImagePicker';
import { CustomInput } from '../../../components/ui/CustomInput';
import ScreenContainer from '../../../components/layout/ScreenContainer';
import { CustomButton } from '../../../components/CustomButton';
import { RadioGroup } from '../../../components/ui/RadioGroup';
import { Chip } from '../../../components/ui/Chip';

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
  const { showError, showSuccess } = useToast();
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

  const resetForm = () => {
    setServiceName('');
    setChargeType('fixed');
    setPrice('');
    setDuration('');
    setCategory('local');
    setAvailability(null);
    setDescription('');
    setServiceImages([]);
    setError(null);
  };

  // Resetar campos quando a tela é focada (quando volta de outras telas)
  useFocusEffect(
    React.useCallback(() => {
      resetForm();
    }, [])
  );

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
  const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

  const uploadImagesToSupabase = async (): Promise<string[]> => {
    if (serviceImages.length === 0) return [];

    const uploadedPaths: string[] = [];

    try {
      setImagesUploading(true);

      const { data, error: authError } = await supabase.auth.getUser();
      const currentUser = data?.user;
      
      if (authError || !currentUser) {
        throw new Error('Usuário não autenticado. Faça login novamente.');
      }

      const authenticatedUserId = currentUser.id;
      const uploadPromises = serviceImages.map(async (imageUri, index) => {
        const fileInfo = await FileSystem.getInfoAsync(imageUri);
        
        if (!fileInfo.exists) {
          throw new Error(`Arquivo de imagem ${index + 1} não encontrado. Por favor, selecione a imagem novamente.`);
        }

        if (fileInfo.size && fileInfo.size > MAX_IMAGE_SIZE) {
          throw new Error(`A imagem ${index + 1} excede o tamanho máximo de 5MB.`);
        }

        const fileExt = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
        const contentType = fileExt === 'png' ? 'image/png' : fileExt === 'webp' ? 'image/webp' : 'image/jpeg';
        
        if (!ALLOWED_TYPES.includes(contentType)) {
          throw new Error(`Formato de imagem não suportado para imagem ${index + 1} (use jpg, png ou webp).`);
        }

        const fileName = `${authenticatedUserId}-${Date.now()}-${index}.${fileExt}`;
        const filePath = `service-images/${fileName}`;

        // Usa FileSystem para ler a imagem como base64 (funciona com URIs locais)
        let base64: string;
        try {
          base64 = await FileSystem.readAsStringAsync(imageUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
        } catch (fileError) {
          console.error(`Erro ao ler arquivo da imagem ${index + 1}:`, fileError);
          throw new Error(`Não foi possível ler o arquivo de imagem ${index + 1}. Verifique se o arquivo não está corrompido.`);
        }

        // Converte base64 para Uint8Array
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);

        const { error: uploadError } = await supabase.storage
          .from('services-assets')
          .upload(filePath, byteArray, {
            contentType,
            upsert: false,
          });

        if (uploadError) {
          console.error(`Erro no upload da imagem ${index}:`, uploadError);
          throw uploadError;
        }

        uploadedPaths.push(filePath);

        const {
          data: { publicUrl },
        } = supabase.storage.from('services-assets').getPublicUrl(filePath);

        return publicUrl;
      });

      const imageUrls = await Promise.all(uploadPromises);
      return imageUrls;
    } catch (error: any) {
      console.error('Erro ao fazer upload das imagens:', error);

      if (uploadedPaths.length > 0) {
        // Limpa uploads parciais para evitar lixo no bucket
        try {
          await Promise.all(
            uploadedPaths.map(async (path) =>
              supabase.storage.from('services-assets').remove([path])
            )
          );
        } catch (cleanupError) {
          console.error('Erro ao limpar uploads parciais:', cleanupError);
        }
      }

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
      const processed = handleError(serviceError, 'service');
      setError(processed.userMessage);
      showError(processed.userMessage);
      return;
    }

    resetForm();
    showSuccess('Serviço criado com sucesso!');
    router.replace('/(merchant)/services');
  };

  return (
    <ScreenContainer 
      scroll={true}
      hasHeader={true}
      hasTabBar={false}
      backgroundColor="#FAFAFA"
      footer={
        <View style={styles.footerContainer}>
          <CustomButton
            compact
            title="Continuar"
            variant="primary"
            onPress={handleContinue}
            isLoading={loading || imagesUploading}
            disabled={loading || imagesUploading}
          />
        </View>
      }
      header={
        <AppHeader 
          title="Novo Serviço"
          showBackButton={true}
          onPressBack={() => safeGoBack('/(merchant)/services')}
        />
      }
    >
          {/* Form */}
          <View style={styles.form}>
            {/* Nome do serviço */}
            <CustomInput
              label="Nome do Serviço"
              placeholder="Nome do Serviço"
              value={serviceName}
              onChangeText={setServiceName}
              containerStyle={styles.inputGroup}
            />

            {/* Forma de cobrança */}
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

            {/* Preço */}
            <CustomInput
              label="Preço"
              placeholder="R$ 100,00"
              keyboardType="numeric"
              value={price}
              onChangeText={handlePriceChange}
              containerStyle={styles.inputGroup}
            />

            {/* Duração */}
            <CustomInput
              label="Duração"
              placeholder="1h"
              value={duration}
              onChangeText={setDuration}
              containerStyle={styles.inputGroup}
            />

            {/* Categoria do Serviço */}
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

            {/* Descrição do serviço */}
            <CustomInput
              label="Descrição do Serviço"
              placeholder="Deixe aqui sua opinião."
              multiline
              numberOfLines={4}
              value={description}
              onChangeText={setDescription}
              containerStyle={styles.textareaGroup}
              inputContainerStyle={styles.textarea}
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
    </ScreenContainer>
  );
};

export default MerchantSignupServicesScreen;

const styles = StyleSheet.create({
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
    paddingTop: 16,
    backgroundColor: '#FAFAFA',
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
});
