import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import {
  IconCheckbox,
  IconCheckboxOutline,
  IconPix,
  IconCreditCard,
  IconCash,
} from '../../lib/icons';
import { fetchCategories, type Category } from '../../lib/categories';
import { handleError } from '../../lib/errorHandler';
import SelectDropdown from '../../components/ui/SelectDropdown';
import { CustomInput } from '../../components/ui/CustomInput';
import { Icon } from '../../components/ui/Icon';
import ScreenContainer from '../../components/layout/ScreenContainer';
import SignupHeaderMerchant from '../../components/auth/SignupHeaderMerchant';
import { CustomButton } from '../../components/CustomButton';

type BusinessTimeOption = {
  value: string;
  label: string;
};

const BUSINESS_TIME_OPTIONS: BusinessTimeOption[] = [
  { value: 'menos-1', label: 'Menos de 1 ano' },
  { value: '1-3', label: '1 a 3 anos' },
  { value: '3-5', label: '3 a 5 anos' },
  { value: 'mais-5', label: 'Mais de 5 anos' },
];

// Intervalos de almoço de 1 hora
const LUNCH_TIME_OPTIONS: { start: string; end: string; label: string }[] = [
  { start: '11:00', end: '12:00', label: '11:00 a 12:00' },
  { start: '12:00', end: '13:00', label: '12:00 a 13:00' },
  { start: '13:00', end: '14:00', label: '13:00 a 14:00' },
  { start: '14:00', end: '15:00', label: '14:00 a 15:00' },
];

const WEEK_DAYS = [
  { key: 'monday', label: 'Segunda-feira' },
  { key: 'tuesday', label: 'Terça-feira' },
  { key: 'wednesday', label: 'Quarta-feira' },
  { key: 'thursday', label: 'Quinta-feira' },
  { key: 'friday', label: 'Sexta-feira' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
] as const;

type WorkDayData = {
  active: boolean;
  start: string;
  end: string;
};

type WorkDaysState = {
  monday: WorkDayData;
  tuesday: WorkDayData;
  wednesday: WorkDayData;
  thursday: WorkDayData;
  friday: WorkDayData;
  saturday: WorkDayData;
  sunday: WorkDayData;
};

const MerchantSignupBusinessScreen: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ userId?: string; addressData?: string }>();
  const userId = params.userId as string | undefined;
  const addressData = params.addressData ? JSON.parse(params.addressData as string) : null;

  const [businessName, setBusinessName] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [businessTime, setBusinessTime] = useState<BusinessTimeOption | null>(null);
  const [hasLunchBreak, setHasLunchBreak] = useState(false);
  const [lunchTime, setLunchTime] = useState<{ start: string; end: string; label: string } | null>(null);
  const [description, setDescription] = useState('');
  const [pix, setPix] = useState(true);
  const [card, setCard] = useState(true);
  const [cash, setCash] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bannerImage, setBannerImage] = useState<string | null>(null);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [logoImage, setLogoImage] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  
  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const categoriesData = await fetchCategories();
      setCategories(categoriesData);
    } catch (error) {
      handleError(error, 'general');
      setCategories([]);
    }
  };
  
  const [workDays, setWorkDays] = useState<WorkDaysState>({
    monday: { active: false, start: '07:00', end: '18:00' },
    tuesday: { active: false, start: '07:00', end: '18:00' },
    wednesday: { active: false, start: '07:00', end: '18:00' },
    thursday: { active: false, start: '07:00', end: '18:00' },
    friday: { active: false, start: '07:00', end: '18:00' },
    saturday: { active: false, start: '07:00', end: '18:00' },
    sunday: { active: false, start: '07:00', end: '18:00' },
  });

  // Resetar campos quando a tela é focada (quando volta de outras telas)
  useFocusEffect(
    React.useCallback(() => {
      setBusinessName('');
      setSelectedCategory(null);
      setBusinessTime(null);
      setHasLunchBreak(false);
      setLunchTime(null);
      setDescription('');
      setPix(true);
      setCard(true);
      setCash(true);
      setBannerImage(null);
      setLogoImage(null);
      setError(null);
      setWorkDays({
        monday: { active: false, start: '07:00', end: '18:00' },
        tuesday: { active: false, start: '07:00', end: '18:00' },
        wednesday: { active: false, start: '07:00', end: '18:00' },
        thursday: { active: false, start: '07:00', end: '18:00' },
        friday: { active: false, start: '07:00', end: '18:00' },
        saturday: { active: false, start: '07:00', end: '18:00' },
        sunday: { active: false, start: '07:00', end: '18:00' },
      });
    }, [])
  );

  const handleContinue = async () => {
    const { data, error: userError } = await supabase.auth.getUser();
    const currentUser = data?.user;
    
    if (userError || !currentUser) {
      if (userId) {
        setError('Sessão expirada. Por favor, faça login novamente.');
        setTimeout(() => {
          router.replace('/(auth)/login');
        }, 2000);
        return;
      }
      setError('Você precisa estar logado para continuar. Por favor, volte e faça o cadastro novamente.');
      return;
    }

    const userIdToUse = currentUser.id;

    if (!businessName) {
      setError('Informe o nome do seu negócio.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const workDaysJson: Record<string, { start: string; end: string }> = {};
      Object.entries(workDays).forEach(([dayKey, dayData]) => {
        if (dayData.active) {
          workDaysJson[dayKey] = {
            start: dayData.start,
            end: dayData.end,
          };
        }
      });

      const acceptedPaymentMethods = {
        pix: pix,
        card: card,
        cash: cash,
      };

      let bannerUrl: string | null = null;
      if (bannerImage) {
        bannerUrl = await uploadBannerToSupabase(userIdToUse);
        if (bannerImage && !bannerUrl) {
          const shouldContinue = await new Promise<boolean>((resolve) => {
            Alert.alert(
              'Erro no upload',
              'Não foi possível fazer upload da foto de capa. Deseja continuar sem a foto de capa?',
              [
                { text: 'Cancelar', onPress: () => resolve(false), style: 'cancel' },
                { text: 'Continuar', onPress: () => resolve(true) },
              ]
            );
          });
          if (!shouldContinue) {
            setLoading(false);
            return;
          }
        }
      }

      let logoUrl: string | null = null;
      if (logoImage) {
        logoUrl = await uploadLogoToSupabase(userIdToUse);
        if (logoImage && !logoUrl) {
          const shouldContinue = await new Promise<boolean>((resolve) => {
            Alert.alert(
              'Erro no upload',
              'Não foi possível fazer upload do logotipo. Deseja continuar sem o logo?',
              [
                { text: 'Cancelar', onPress: () => resolve(false), style: 'cancel' },
                { text: 'Continuar', onPress: () => resolve(true) },
              ]
            );
          });
          if (!shouldContinue) {
            setLoading(false);
            return;
          }
        }
      }

      const { data, error: companyError } = await supabase
        .from('business_profiles')
        .insert({
          owner_id: userIdToUse,
          business_name: businessName,
          category_id: selectedCategory?.id || null,
          description: description || null,
          address: addressData?.address || null,
          banner_url: bannerUrl || null,
          logo_url: logoUrl || null,
          business_time: businessTime?.label || null,
          lunch_break_start: hasLunchBreak && lunchTime ? lunchTime.start : null,
          lunch_break_end: hasLunchBreak && lunchTime ? lunchTime.end : null,
          work_days: Object.keys(workDaysJson).length > 0 ? workDaysJson : null,
          accepted_payment_methods: acceptedPaymentMethods,
        })
        .select('id')
        .single();

      if (companyError) {
        setError(companyError.message);
        return;
      }

      const companyId = data?.id as string;

      router.push({
        pathname: '/(auth)/merchant-signup-services',
        params: { userId: userIdToUse, companyId },
      });
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao salvar dados do negócio.');
    } finally {
      setLoading(false);
    }
  };

  const renderCheckbox = (checked: boolean) =>
    checked ? <IconCheckbox width={18} height={18} /> : <IconCheckboxOutline width={18} height={18} />;

  const handlePickBannerImage = async () => {
    try {
      // Solicitar permissão apenas quando necessário
      if (Platform.OS !== 'web') {
        try {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert(
              'Permissão necessária',
              'Precisamos da permissão para acessar suas fotos!'
            );
            return;
          }
        } catch (permissionError) {
          handleError(permissionError, 'general');
          Alert.alert('Erro', 'Não foi possível solicitar permissão para acessar suas fotos.');
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setBannerImage(result.assets[0].uri);
      }
    } catch (error) {
      handleError(error, 'general');
      Alert.alert('Erro', 'Não foi possível selecionar a imagem.');
    }
  };

  const handlePickImage = async () => {
    try {
      // Solicitar permissão apenas quando necessário
      if (Platform.OS !== 'web') {
        try {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert(
              'Permissão necessária',
              'Precisamos da permissão para acessar suas fotos!'
            );
            return;
          }
        } catch (permissionError) {
          handleError(permissionError, 'general');
          Alert.alert('Erro', 'Não foi possível solicitar permissão para acessar suas fotos.');
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setLogoImage(result.assets[0].uri);
      }
    } catch (error) {
      handleError(error, 'general');
      Alert.alert('Erro', 'Não foi possível selecionar a imagem.');
    }
  };

  const uploadBannerToSupabase = async (_userIdParam?: string): Promise<string | null> => {
    if (!bannerImage) return null;

    try {
      setBannerUploading(true);

      const { data, error: authError } = await supabase.auth.getUser();
      const currentUser = data?.user;
      
      if (authError || !currentUser) {
        throw new Error('Usuário não autenticado. Faça login novamente.');
      }

      const authenticatedUserId = currentUser.id;
      const fileExt = bannerImage.split('.').pop() || 'jpg';
      const fileName = `${authenticatedUserId}-${Date.now()}.${fileExt}`;
      const filePath = `business-banners/${fileName}`;

      // Verificar se o arquivo existe antes de ler
      const fileInfo = await FileSystem.getInfoAsync(bannerImage);
      if (!fileInfo.exists) {
        throw new Error('Arquivo de imagem não encontrado. Por favor, selecione a imagem novamente.');
      }

      let base64: string;
      try {
        base64 = await FileSystem.readAsStringAsync(bannerImage, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } catch (fileError) {
        handleError(fileError, 'general');
        throw new Error('Não foi possível ler o arquivo de imagem. Verifique se o arquivo não está corrompido.');
      }

      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);

      const { error: uploadError } = await supabase.storage
        .from('business-assets')
        .upload(filePath, byteArray, {
          contentType: `image/${fileExt}`,
          upsert: false,
        });

      if (uploadError) {
        handleError(uploadError, 'general');
        throw uploadError;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('business-assets').getPublicUrl(filePath);

      return publicUrl;
    } catch (error: unknown) {
      handleError(error, 'general');
      Alert.alert('Erro', 'Não foi possível fazer upload da foto de capa.');
      return null;
    } finally {
      setBannerUploading(false);
    }
  };

  const uploadLogoToSupabase = async (_userIdParam?: string): Promise<string | null> => {
    if (!logoImage) return null;

    try {
      setLogoUploading(true);

      const { data, error: authError } = await supabase.auth.getUser();
      const currentUser = data?.user;
      
      if (authError || !currentUser) {
        throw new Error('Usuário não autenticado. Faça login novamente.');
      }

      const authenticatedUserId = currentUser.id;
      const fileExt = logoImage.split('.').pop() || 'jpg';
      const fileName = `${authenticatedUserId}-${Date.now()}.${fileExt}`;
      const filePath = `business-logos/${fileName}`;

      // Verificar se o arquivo existe antes de ler
      const fileInfo = await FileSystem.getInfoAsync(logoImage);
      if (!fileInfo.exists) {
        throw new Error('Arquivo de imagem não encontrado. Por favor, selecione a imagem novamente.');
      }

      let base64: string;
      try {
        base64 = await FileSystem.readAsStringAsync(logoImage, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } catch (fileError) {
        handleError(fileError, 'general');
        throw new Error('Não foi possível ler o arquivo de imagem. Verifique se o arquivo não está corrompido.');
      }

      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);

      const { error: uploadError } = await supabase.storage
        .from('business-assets')
        .upload(filePath, byteArray, {
          contentType: `image/${fileExt}`,
          upsert: false,
        });

      if (uploadError) {
        handleError(uploadError, 'general');
        throw uploadError;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('business-assets').getPublicUrl(filePath);

      return publicUrl;
    } catch (error: unknown) {
      handleError(error, 'general');
      Alert.alert('Erro', 'Não foi possível fazer upload do logotipo.');
      return null;
    } finally {
      setLogoUploading(false);
    }
  };

  const toggleWorkDay = (dayKey: keyof WorkDaysState) => {
    setWorkDays((prev) => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        active: !prev[dayKey].active,
      },
    }));
  };

  const updateWorkDayStart = (dayKey: keyof WorkDaysState, time: string) => {
    setWorkDays((prev) => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        start: time,
      },
    }));
  };

  const updateWorkDayEnd = (dayKey: keyof WorkDaysState, time: string) => {
    setWorkDays((prev) => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        end: time,
      },
    }));
  };

  const formatTime = (value: string): string => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length === 0) return '';
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 4) {
      return `${numbers.slice(0, 2)}:${numbers.slice(2)}`;
    }
    return `${numbers.slice(0, 2)}:${numbers.slice(2, 4)}`;
  };

  return (
    <ScreenContainer
      scroll
      backgroundColor="#FEFEFE"
      contentContainerStyle={{ flexGrow: 1, paddingTop: 0, paddingBottom: 16 }}
      header={
        <SignupHeaderMerchant
          title="Dados do negócio"
          subtitle="Conte mais sobre o seu negócio"
          steps={['Cadastro', 'Endereço', 'Negócio', 'Serviços']}
          currentStepIndex={2}
          showBackButton={true}
          onPressBack={router.back}
        />
      }
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >

          {/* Form */}
          <View style={styles.form}>
              {/* Nome do negócio */}
              <CustomInput
                label="Nome do seu negócio"
                placeholder="Digite aqui o nome"
                value={businessName}
                onChangeText={setBusinessName}
              />

              {/* Área de atuação */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Área de atuação</Text>
                <SelectDropdown<Category>
                  data={categories}
                  labelKey="name"
                  valueKey="id"
                  onSelect={(category) => {
                    setSelectedCategory(category);
                  }}
                  selectedValue={selectedCategory}
                  placeholder="Selecione aqui"
                  maxHeight={200}
                />
                <Text style={styles.categoryHelperText}>
                  Escolha a categoria que melhor descreve o seu negócio principal
                </Text>
              </View>

              {/* Tempo de negócio */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Tempo de negócio</Text>
                <SelectDropdown<BusinessTimeOption>
                  data={BUSINESS_TIME_OPTIONS}
                  labelKey="label"
                  valueKey="value"
                  onSelect={(option) => setBusinessTime(option)}
                  selectedValue={businessTime}
                  placeholder="Selecione aqui"
                />
              </View>

              {/* Checkbox Horário de almoço */}
              <TouchableOpacity
                style={styles.checkboxContainer}
                activeOpacity={0.7}
                onPress={() => {
                  setHasLunchBreak(!hasLunchBreak);
                  if (hasLunchBreak) {
                    setLunchTime(null);
                  }
                }}
              >
                {hasLunchBreak ? (
                  <IconCheckbox width={18} height={18} />
                ) : (
                  <IconCheckboxOutline width={18} height={18} />
                )}
                <Text
                  style={[
                    styles.checkboxLabelText,
                    hasLunchBreak && styles.checkboxLabelSelected,
                  ]}
                >
                  Horário de almoço
                </Text>
              </TouchableOpacity>

              {/* Campo de horário de almoço */}
              {hasLunchBreak && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Horário de almoço</Text>
                  <SelectDropdown<{ start: string; end: string; label: string }>
                    data={[...LUNCH_TIME_OPTIONS]}
                    labelKey="label"
                    valueKey="label"
                    onSelect={(interval) => setLunchTime(interval)}
                    selectedValue={lunchTime}
                    placeholder="Selecione aqui"
                  />
                </View>
              )}

              {/* Pagamentos aceitos */}
              <View style={styles.paymentMethodsContainer}>
                <Text style={styles.paymentMethodLabel}>Pagamentos aceitos</Text>
                <View style={styles.paymentMethodsRow}>
                  {/* PIX */}
                  <TouchableOpacity
                    style={styles.paymentMethod}
                    activeOpacity={0.7}
                    onPress={() => setPix((v) => !v)}
                  >
                    <View style={styles.paymentCheckbox}>
                      {renderCheckbox(pix)}
                    </View>
                    <IconPix width={24} height={24} />
                    <Text style={styles.paymentText}>PIX</Text>
                  </TouchableOpacity>

                  {/* Cartão */}
                  <TouchableOpacity
                    style={styles.paymentMethod}
                    activeOpacity={0.7}
                    onPress={() => setCard((v) => !v)}
                  >
                    <View style={styles.paymentCheckbox}>
                      {renderCheckbox(card)}
                    </View>
                    <IconCreditCard width={24} height={24} />
                    <Text style={styles.paymentText}>Cartão</Text>
                  </TouchableOpacity>

                  {/* Dinheiro */}
                  <TouchableOpacity
                    style={styles.paymentMethod}
                    activeOpacity={0.7}
                    onPress={() => setCash((v) => !v)}
                  >
                    <View style={styles.paymentCheckbox}>
                      {renderCheckbox(cash)}
                    </View>
                    <IconCash width={24} height={24} />
                    <Text style={styles.paymentText}>Dinheiro</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Dias de funcionamento */}
              <View style={styles.workdaysSection}>
                <Text style={styles.label}>Dias de funcionamento</Text>
                
                {WEEK_DAYS.map((day) => {
                  const dayData = workDays[day.key as keyof WorkDaysState];
                  return (
                    <View key={day.key} style={styles.daySelector}>
                      {/* Checkbox e Label do dia */}
                      <TouchableOpacity
                        style={styles.dayCheckboxRow}
                        activeOpacity={0.7}
                        onPress={() => toggleWorkDay(day.key as keyof WorkDaysState)}
                      >
                        <View style={styles.checkboxIconWrapper}>
                          {renderCheckbox(dayData.active)}
                        </View>
                        <Text
                          style={[
                            styles.dayLabel,
                            !dayData.active && styles.dayLabelInactive,
                          ]}
                        >
                          {day.label}
                        </Text>
                      </TouchableOpacity>

                      {/* Inputs de horário */}
                      {dayData.active && (
                        <View style={styles.dayTimeInputs}>
                          {/* Hora de abertura */}
                          <CustomInput
                            label="Hora de abertura"
                            placeholder="07:00"
                            value={dayData.start}
                            onChangeText={(text) => {
                              const formatted = formatTime(text);
                              updateWorkDayStart(
                                day.key as keyof WorkDaysState,
                                formatted,
                              );
                            }}
                            keyboardType="numeric"
                            maxLength={5}
                            containerStyle={styles.timeInputGroup}
                            labelStyle={styles.timeInputLabel}
                          />

                          {/* Hora de fechamento */}
                          <CustomInput
                            label="Hora de fechamento"
                            placeholder="18:00"
                            value={dayData.end}
                            onChangeText={(text) => {
                              const formatted = formatTime(text);
                              updateWorkDayEnd(
                                day.key as keyof WorkDaysState,
                                formatted,
                              );
                            }}
                            keyboardType="numeric"
                            maxLength={5}
                            containerStyle={styles.timeInputGroup}
                            labelStyle={styles.timeInputLabel}
                          />
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>

              {/* Descrição geral */}
              <CustomInput
                label="O que você faz?"
                placeholder="Descreva seu negócio de maneira geral"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                containerStyle={styles.textareaGroup}
              />

              {/* Upload de banner */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  Adicione uma foto de capa
                </Text>
                <TouchableOpacity
                  style={styles.addBannerBox}
                  onPress={handlePickBannerImage}
                  activeOpacity={0.8}
                  disabled={bannerUploading}
                >
                  {bannerImage ? (
                    <Image
                      source={{ uri: bannerImage }}
                      style={styles.bannerPreview}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.addPhotoContent}>
                      <View style={styles.circleButton}>
                        <Icon name="add" size={24} color="#FFFFFF" />
                      </View>
                      {bannerUploading ? (
                        <ActivityIndicator
                          size="small"
                          color="#474747"
                          style={styles.uploadIndicator}
                        />
                      ) : (
                        <Text style={styles.addPhotoText}>Adicionar foto de capa</Text>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              {/* Upload de logo */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  Adicione o logotipo do seu negócio
                </Text>
                <TouchableOpacity
                  style={styles.addPhotoBox}
                  onPress={handlePickImage}
                  activeOpacity={0.8}
                  disabled={logoUploading}
                >
                  {logoImage ? (
                    <Image
                      source={{ uri: logoImage }}
                      style={styles.logoPreview}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.addPhotoContent}>
                      <View style={styles.circleButton}>
                        <Icon name="add" size={24} color="#FFFFFF" />
                      </View>
                      {logoUploading ? (
                        <ActivityIndicator
                          size="small"
                          color="#474747"
                          style={styles.uploadIndicator}
                        />
                      ) : (
                        <Text style={styles.addPhotoText}>Adicionar logo</Text>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              </View>
          </View>

          {!!error && <Text style={styles.errorText}>{error}</Text>}

        {/* Botão Continuar */}
        <View style={styles.actions}>
          <CustomButton
            title="Continuar"
            onPress={handleContinue}
            isLoading={loading}
            disabled={loading}
            variant="primary"
            style={{ borderRadius: 24, marginVertical: 0 }}
            width="100%"
          />
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
};

export default MerchantSignupBusinessScreen;

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
  selectInput: {
    borderWidth: 1,
    borderColor: '#474747',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectInputStrong: {
    borderWidth: 2,
    borderColor: '#0F0F0F',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectText: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 16,
    color: '#0F0F0F',
  },
  selectPlaceholder: {
    color: '#0F0F0F',
  },
  selectPlaceholderDark: {
    color: '#0F0F0F',
  },
  paymentMethodsContainer: {
    gap: 16,
    alignItems: 'flex-start',
    width: '100%',
  },
  paymentMethodLabel: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    lineHeight: 12,
    color: '#0F0F0F',
  },
  paymentMethodsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    alignItems: 'center',
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  paymentCheckbox: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardSection: {
    width: '100%',
    borderRadius: 4,
    backgroundColor: '#FEFEFE',
    shadowColor: '#1D1D1D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    padding: 0,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  smallTitle: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: '#0F0F0F',
    width: '100%',
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  checkboxIconWrapper: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 3,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 0,
  },
  checkboxLabel: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 16,
    color: '#474747',
  },
  checkboxLabelText: {
    fontSize: 12,
    fontFamily: 'Montserrat_700Bold',
    color: '#000E3D',
    marginBottom: 0,
  },
  checkboxLabelSelected: {
    color: '#000E3D',
  },
  paymentText: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    lineHeight: 12,
    color: '#0F0F0F',
  },
  workdaysSection: {
    marginTop: 16,
    width: '100%',
    gap: 16,
  },
  daySelector: {
    width: '100%',
    gap: 9,
  },
  dayCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dayLabel: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 16,
    color: '#0F0F0F',
  },
  dayLabelInactive: {
    color: '#474747',
  },
  dayTimeInputs: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    paddingLeft: 28,
  },
  timeInputGroup: {
    flex: 1,
  },
  timeInputLabel: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 12,
    color: '#000E3D',
  },
  helperText: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: '#0F0F0F',
    marginTop: 4,
  },
  categoryHelperText: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: '#0F0F0F',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FEFEFE',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    minHeight: 400,
    flexDirection: 'column',
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 18,
    color: '#000E3D',
  },
  modalCloseButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  modalCloseText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: '#000E3D',
  },
  modalList: {
    maxHeight: 350,
    paddingVertical: 8,
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalOptionSelected: {
    backgroundColor: '#D6E0FF',
  },
  modalOptionText: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 16,
    color: '#0F0F0F',
  },
  modalOptionTextSelected: {
    fontFamily: 'Montserrat_700Bold',
    color: '#000E3D',
  },
  selectedIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#000E3D',
  },
  textareaGroup: {
    marginTop: 16,
  },
  addBannerBox: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#000000',
    borderStyle: 'dashed',
    borderRadius: 8,
    height: 180,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#D9D9D9',
  },
  bannerPreview: {
    width: '100%',
    height: '100%',
  },
  addPhotoBox: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#000000',
    borderStyle: 'dashed',
    borderRadius: 8,
    height: 147,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#D9D9D9',
  },
  addPhotoContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  circleButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#383838',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoPreview: {
    width: '100%',
    height: '100%',
  },
  uploadIndicator: {
    marginTop: 8,
  },
  addPhotoText: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 14,
    color: '#474747',
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
    paddingTop: 8,
    backgroundColor: '#FEFEFE',
  },
});