import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Defs, RadialGradient as SvgRadialGradient, Rect, Stop } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../../lib/supabase';
import { responsiveHeight } from '../../../../lib/responsive';
import { IconAddPhoto } from '../../../../lib/icons';
import SelectDropdown from '../../../../components/ui/SelectDropdown';

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

  useEffect(() => {
    requestImagePermissions();
    loadService();
  }, [params.id]);

  const requestImagePermissions = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão necessária', 'Precisamos de permissão para acessar suas fotos!');
        return false;
      }
    }
    return true;
  };

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
    if (!durationText) return 60;
    const cleaned = durationText.trim().toLowerCase();
    const hourMatch = cleaned.match(/(\d+)\s*h/);
    const minuteMatch = cleaned.match(/(\d+)\s*m/);

    let hours = 0;
    let minutes = 0;

    if (hourMatch) hours = parseInt(hourMatch[1], 10);
    if (minuteMatch) minutes = parseInt(minuteMatch[1], 10);

    if (!hourMatch && !minuteMatch) {
      const numberMatch = cleaned.match(/(\d+)/);
      if (numberMatch) hours = parseInt(numberMatch[1], 10);
    }

    return hours * 60 + minutes || 60;
  };

  const formatPriceFromNumber = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const loadService = async () => {
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
        router.back();
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
        router.back();
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
    } catch (err: any) {
      console.error('Erro ao carregar serviço:', err);
      setError('Ocorreu um erro ao carregar o serviço.');
    } finally {
      setLoading(false);
    }
  };

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

  const handlePickImage = async () => {
    if (serviceImages.length >= 4) {
      Alert.alert('Limite atingido', 'Você pode adicionar no máximo 4 fotos.');
      return;
    }

    const hasPermission = await requestImagePermissions();
    if (hasPermission === false) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const newImage = result.assets[0].uri;
        setServiceImages((prev) => [...prev, newImage]);
      }
    } catch (err) {
      console.error('Erro ao selecionar imagem:', err);
      Alert.alert('Erro', 'Não foi possível selecionar a imagem.');
    }
  };

  const handleRemoveImage = (index: number) => {
    setServiceImages((prev) => prev.filter((_, i) => i !== index));
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
    } catch (err: any) {
      console.error('Erro ao fazer upload das imagens:', err);
      throw new Error(`Erro ao fazer upload das imagens: ${err.message}`);
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
        console.error('Erro ao atualizar serviço:', updateError);
        setError(updateError.message);
        return;
      }

      Alert.alert('Sucesso', 'Serviço atualizado com sucesso!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      console.error('Erro ao salvar serviço:', err);
      setError(err?.message ?? 'Erro ao salvar serviço.');
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
                { text: 'OK', onPress: () => router.back() },
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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E5102E" />
      </View>
    );
  }

  if (!service) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.emptyText}>Serviço não encontrado.</Text>
      </View>
    );
  }

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
          <View style={styles.header}>
            <View style={styles.headerBackground}>
              <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#000E3D' }]} />
              <Svg style={StyleSheet.absoluteFill} viewBox="0 0 390 129" preserveAspectRatio="none">
                <Defs>
                  <SvgRadialGradient
                    id="headerRadialGradient"
                    cx="0.5"
                    cy="0.3"
                    rx="100%"
                    ry="100%"
                    gradientUnits="objectBoundingBox"
                  >
                    <Stop offset="0%" stopColor="rgba(50, 70, 140, 0.3)" />
                    <Stop offset="100%" stopColor="#000E3D" stopOpacity="1" />
                  </SvgRadialGradient>
                </Defs>
                <Rect x="0" y="0" width="390" height="129" fill="url(#headerRadialGradient)" />
              </Svg>
            </View>

            <View style={styles.headerContent}>
              <Text style={styles.welcomeTitle}>Editar serviços</Text>
              <Text style={styles.welcomeSubtitle}>
                Atualize os detalhes do seu serviço
              </Text>
            </View>
          </View>

          <View style={styles.form}>
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

            <View style={styles.radioGroup}>
              <Text style={styles.label}>Forma de cobrança</Text>
              <View style={styles.radioRow}>
                <TouchableOpacity
                  style={styles.radioOption}
                  onPress={() => setChargeType('fixed')}
                  activeOpacity={0.7}
                >
                  <View style={styles.radioIconOuter}>
                    {chargeType === 'fixed' && <View style={styles.radioIconInner} />}
                  </View>
                  <Text style={styles.radioText}>Valor Fixo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.radioOption}
                  onPress={() => setChargeType('hourly')}
                  activeOpacity={0.7}
                >
                  <View style={styles.radioIconOuter}>
                    {chargeType === 'hourly' && <View style={styles.radioIconInner} />}
                  </View>
                  <Text style={styles.radioText}>Valor por hora</Text>
                </TouchableOpacity>
              </View>
            </View>

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
                        <Text style={styles.chipCloseIcon}>×</Text>
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
                        <Text style={styles.chipCloseIcon}>×</Text>
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.textareaGroup}>
              <Text style={styles.label}>Descrição do Serviço</Text>
              <TextInput
                style={styles.textarea}
                placeholder="Conte mais sobre o serviço."
                placeholderTextColor="#0f0f0f"
                multiline
                numberOfLines={4}
                value={description}
                onChangeText={setDescription}
              />
            </View>

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
                        <View style={styles.removePhotoBadge}>
                          <Text style={styles.removePhotoText}>×</Text>
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

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.buttonOutlined}
            activeOpacity={0.8}
            onPress={handleDelete}
            disabled={saving || imagesUploading}
          >
            {saving ? (
              <ActivityIndicator color="#E5102E" />
            ) : (
              <Text style={styles.buttonOutlinedText}>Excluir Serviço</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.buttonContained}
            activeOpacity={0.8}
            onPress={handleSave}
            disabled={saving || imagesUploading}
          >
            {saving || imagesUploading ? (
              <ActivityIndicator color="#FEFEFE" />
            ) : (
              <Text style={styles.buttonContainedText}>Salvar Alterações</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

export default EditServiceScreen;

const headerHeight = responsiveHeight(129);

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 0,
    paddingBottom: 32,
  },
  header: {
    height: headerHeight,
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
    gap: 12,
    flexWrap: 'wrap',
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  radioIconOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000E3D',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioIconInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#000E3D',
  },
  radioText: {
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
  chipTextActive: {
    color: '#FEFEFE',
  },
  chipCloseButton: {
    marginLeft: 8,
    paddingVertical: 6,
    paddingHorizontal: 4,
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
    justifyContent: 'space-between',
    marginTop: 8,
  },
  photoBox: {
    width: '48%',
    aspectRatio: 1,
    borderWidth: 1,
    borderColor: '#000000',
    borderStyle: 'dashed',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D9D9D9',
    marginBottom: 12,
  },
  photoBoxContainer: {
    width: '48%',
    aspectRatio: 1,
    position: 'relative',
    marginBottom: 12,
  },
  photoPreview: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -10,
    right: -10,
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePhotoBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E5102E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePhotoText: {
    color: '#FEFEFE',
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    lineHeight: 20,
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
    gap: 12,
  },
  buttonContained: {
    width: '90%',
    maxWidth: 342,
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
  buttonOutlined: {
    width: '90%',
    maxWidth: 342,
    alignSelf: 'center',
    backgroundColor: '#FEFEFE',
    borderRadius: 24,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#000E3D',
  },
  buttonOutlinedText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: '#000E3D',
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#474747',
    textAlign: 'center',
  },
});




