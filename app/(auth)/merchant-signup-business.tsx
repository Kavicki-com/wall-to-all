import React, { useState, useEffect } from 'react';
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
import * as FileSystem from 'expo-file-system/legacy';
import Svg, { Defs, RadialGradient as SvgRadialGradient, Stop, Rect } from 'react-native-svg';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { responsiveHeight } from '../../lib/responsive';
import {
  IconPix,
} from '../../lib/assets';
import {
  IconCheckbox,
  IconCheckboxOutline,
  IconCreditCard,
  IconCash,
  IconAddPhoto,
} from '../../lib/icons';
import { fetchCategories, type Category } from '../../lib/categories';
import SelectDropdown from '../../components/ui/SelectDropdown';

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
const LUNCH_TIME_OPTIONS = [
  { start: '11:00', end: '12:00', label: '11:00 a 12:00' },
  { start: '12:00', end: '13:00', label: '12:00 a 13:00' },
  { start: '13:00', end: '14:00', label: '13:00 a 14:00' },
  { start: '14:00', end: '15:00', label: '14:00 a 15:00' },
] as const;

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
  const [logoImage, setLogoImage] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  
  // Carregar categorias do banco ao montar o componente
  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const categoriesData = await fetchCategories();
      console.log('[merchant-signup-business] Categorias carregadas:', categoriesData.length);
      console.log('[merchant-signup-business] Lista de categorias:', categoriesData.map(c => c.name));
      if (categoriesData.length === 0) {
        console.warn('[merchant-signup-business] Nenhuma categoria encontrada no banco de dados!');
      }
      setCategories(categoriesData);
    } catch (error) {
      console.error('[merchant-signup-business] Erro ao carregar categorias:', error);
      setCategories([]);
    }
  };
  
  // Estado único para dias de funcionamento
  const [workDays, setWorkDays] = useState<WorkDaysState>({
    monday: { active: false, start: '07:00', end: '18:00' },
    tuesday: { active: false, start: '07:00', end: '18:00' },
    wednesday: { active: false, start: '07:00', end: '18:00' },
    thursday: { active: false, start: '07:00', end: '18:00' },
    friday: { active: false, start: '07:00', end: '18:00' },
    saturday: { active: false, start: '07:00', end: '18:00' },
    sunday: { active: false, start: '07:00', end: '18:00' },
  });

  const handleContinue = async () => {
    // Verificar se o usuário está autenticado
    const { data, error: userError } = await supabase.auth.getUser();
    const currentUser = data?.user;
    
    if (userError || !currentUser) {
      // Tentar fazer login novamente se tiver userId
      if (userId) {
        setError('Sessão expirada. Por favor, faça login novamente.');
        // Redirecionar para login após um tempo
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

      // Preparar work_days para salvar no Supabase (JSONB)
      // Só salva os dias que estão ativos
      const workDaysJson: Record<string, { start: string; end: string }> = {};
      Object.entries(workDays).forEach(([dayKey, dayData]) => {
        if (dayData.active) {
          workDaysJson[dayKey] = {
            start: dayData.start,
            end: dayData.end,
          };
        }
      });

      // Preparar métodos de pagamento aceitos para salvar no Supabase (JSONB)
      const acceptedPaymentMethods = {
        pix: pix,
        card: card,
        cash: cash,
      };

      // Fazer upload do logo se houver imagem selecionada
      let logoUrl: string | null = null;
      if (logoImage) {
        // Passar userIdToUse para a função de upload
        logoUrl = await uploadLogoToSupabase(userIdToUse);
        if (logoImage && !logoUrl) {
          // Se o upload falhar mas houver imagem, perguntar se quer continuar
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

      // Criar business_profiles com todos os dados (incluindo endereço da tela anterior)
      const { data, error: companyError } = await supabase
        .from('business_profiles')
        .insert({
          owner_id: userIdToUse,
          business_name: businessName,
          category_id: selectedCategory?.id || null,
          description: description || null,
          address: addressData?.address || null,
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

  const handlePickImage = async () => {
    const hasPermission = await requestImagePermissions();
    if (!hasPermission) return;

    try {
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
      console.error('Erro ao selecionar imagem:', error);
      Alert.alert('Erro', 'Não foi possível selecionar a imagem.');
    }
  };

  const uploadLogoToSupabase = async (userIdParam?: string): Promise<string | null> => {
    if (!logoImage) return null;

    try {
      setLogoUploading(true);

      // Verificar se o usuário está autenticado antes do upload
      const { data, error: authError } = await supabase.auth.getUser();
      const currentUser = data?.user;
      
      if (authError || !currentUser) {
        throw new Error('Usuário não autenticado. Faça login novamente.');
      }

      // Usar o ID do usuário autenticado no nome do arquivo
      const authenticatedUserId = currentUser.id;
      
      // Criar um nome único para o arquivo
      const fileExt = logoImage.split('.').pop() || 'jpg';
      const fileName = `${authenticatedUserId}-${Date.now()}.${fileExt}`;
      const filePath = `business-logos/${fileName}`;

      // Ler o arquivo como base64
      const base64 = await FileSystem.readAsStringAsync(logoImage, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Converter base64 para ArrayBuffer
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);

      // Fazer upload para Supabase Storage usando ArrayBuffer
      const { error: uploadError } = await supabase.storage
        .from('business-assets')
        .upload(filePath, byteArray, {
          contentType: `image/${fileExt}`,
          upsert: false,
        });

      if (uploadError) {
        console.error('Erro no upload:', uploadError);
        throw uploadError;
      }

      // Obter URL pública da imagem
      const {
        data: { publicUrl },
      } = supabase.storage.from('business-assets').getPublicUrl(filePath);

      return publicUrl;
    } catch (error: any) {
      console.error('Erro ao fazer upload do logo:', error);
      Alert.alert('Erro', 'Não foi possível fazer upload do logotipo.');
      return null;
    } finally {
      setLogoUploading(false);
    }
  };

  // Toggle de ativação de um dia
  const toggleWorkDay = (dayKey: keyof WorkDaysState) => {
    setWorkDays((prev) => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        active: !prev[dayKey].active,
      },
    }));
  };

  // Atualizar horário de abertura
  const updateWorkDayStart = (dayKey: keyof WorkDaysState, time: string) => {
    setWorkDays((prev) => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        start: time,
      },
    }));
  };

  // Atualizar horário de fechamento
  const updateWorkDayEnd = (dayKey: keyof WorkDaysState, time: string) => {
    setWorkDays((prev) => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        end: time,
      },
    }));
  };

  // Formatar horário (HH:mm)
  const formatTime = (value: string): string => {
    // Remove caracteres não numéricos
    const numbers = value.replace(/\D/g, '');
    
    if (numbers.length === 0) return '';
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 4) {
      return `${numbers.slice(0, 2)}:${numbers.slice(2)}`;
    }
    return `${numbers.slice(0, 2)}:${numbers.slice(2, 4)}`;
  };

  // Validar formato de horário
  const isValidTime = (time: string): boolean => {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
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
              {/* Fundo Sólido - Base Dark Navy */}
              <View
                style={[
                  StyleSheet.absoluteFillObject,
                  { backgroundColor: '#000E3D' },
                ]}
              />

              {/* Svg Radial Gradient - Efeito Difuso */}
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
                    {/* CORREÇÃO AQUI: 
                      1. rx="100%" estica a luz horizontalmente para não formar uma "bola".
                      2. cy="0.3" sobe um pouco a luz para vir de cima.
                      3. Cor central muito mais escura e desaturada (rgba 50, 70, 140).
                         Antes estava muito neon (74, 108, 255), o que causava o brilho excessivo.
                    */}
                    <Stop offset="0%" stopColor="rgba(50, 70, 140, 0.3)" />
                    
                    {/* As pontas fundem perfeitamente com o background */}
                    <Stop offset="100%" stopColor="#000E3D" stopOpacity="1" />
                  </SvgRadialGradient>
                </Defs>
                <Rect x="0" y="0" width="390" height="129" fill="url(#headerRadialGradient)" />
              </Svg>
            </View>

            <View style={styles.headerContent}>
              <Text style={styles.welcomeTitle}>Dados do negócio</Text>
              <Text style={styles.welcomeSubtitle}>
                Conte um pouco sobre o seu negócio
              </Text>
            </View>
          </View>

          {/* Step bar */}
          <View style={styles.stepBar}>
              <View style={[styles.stepSegment, styles.stepSegmentComplete]} />
              <View style={[styles.stepSegment, styles.stepSegmentComplete]} />
              <View style={[styles.stepSegment, styles.stepSegmentActive]} />
              <View style={styles.stepSegment} />
          </View>

          {/* Form */}
          <View style={styles.form}>
              {/* Nome do negócio */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nome do seu negócio</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Digite aqui o nome"
                  placeholderTextColor="#0f0f0f"
                  value={businessName}
                  onChangeText={setBusinessName}
                />
              </View>

              {/* Área de atuação */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Área de atuação</Text>
                <SelectDropdown<Category>
                  data={categories}
                  labelKey="name"
                  valueKey="id"
                  onSelect={(category) => {
                    console.log('[merchant-signup-business] Categoria selecionada:', category);
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
                <Text style={styles.label}>Tempo de Negócio</Text>
                <SelectDropdown<BusinessTimeOption>
                  data={BUSINESS_TIME_OPTIONS}
                  labelKey="label"
                  valueKey="value"
                  onSelect={(option) => setBusinessTime(option)}
                  selectedValue={businessTime}
                  placeholder="Selecione aqui"
                  strong
                />
              </View>

              {/* Checkbox Horário de almoço */}
              <TouchableOpacity
                style={styles.checkboxContainer}
                activeOpacity={0.7}
                onPress={() => {
                  setHasLunchBreak(!hasLunchBreak);
                  if (hasLunchBreak) {
                    // Se desmarcar, limpa o horário selecionado
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
                    styles.checkboxLabel,
                    hasLunchBreak && styles.checkboxLabelSelected,
                  ]}
                >
                  Horário de almoço
                </Text>
              </TouchableOpacity>

              {/* Campo de horário de almoço - só aparece se a checkbox estiver marcada */}
              {hasLunchBreak && (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Horário de almoço</Text>
                  <SelectDropdown<{ start: string; end: string; label: string }>
                    data={LUNCH_TIME_OPTIONS}
                    labelKey="label"
                    valueKey="label"
                    onSelect={(interval) => setLunchTime(interval)}
                    selectedValue={lunchTime}
                    placeholder="Selecione aqui"
                    strong
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

                      {/* Inputs de horário (só aparece se o dia estiver ativo) */}
                      {dayData.active && (
                        <View style={styles.dayTimeInputs}>
                          {/* Hora de abertura */}
                          <View style={styles.timeInputGroup}>
                            <Text style={styles.timeInputLabel}>
                              Hora de abertura
                            </Text>
                            <TextInput
                              style={styles.timeInput}
                              placeholder="07:00"
                              placeholderTextColor="#0f0f0f"
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
                            />
                          </View>

                          {/* Hora de fechamento */}
                          <View style={styles.timeInputGroup}>
                            <Text style={styles.timeInputLabel}>
                              Hora de fechamento
                            </Text>
                            <TextInput
                              style={styles.timeInput}
                              placeholder="18:00"
                              placeholderTextColor="#0f0f0f"
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
                            />
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>

              {/* Descrição geral */}
              <View style={styles.textareaGroup}>
                <Text style={styles.label}>O que você faz?</Text>
                <TextInput
                  style={styles.textarea}
                  placeholder="Descreva seu negócio de maneira geral"
                  placeholderTextColor="#0f0f0f"
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={4}
                />
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
                      <IconAddPhoto width={34} height={34} />
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
        </ScrollView>

        {/* Botão Continuar fixo embaixo */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.buttonContained}
            activeOpacity={0.8}
            onPress={handleContinue}
            disabled={loading}
          >
            {loading ? (
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

export default MerchantSignupBusinessScreen;

// Calcular altura responsiva do header ANTES do StyleSheet.create
const headerHeight = responsiveHeight(129);

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
    backgroundColor: '#E5102E',
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
  checkboxLabelSelected: {
    color: '#0F0F0F',
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
    paddingLeft: 28, // Alinha com o texto do checkbox
  },
  timeInputGroup: {
    flex: 1,
    gap: 4,
  },
  timeInputLabel: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 12,
    color: '#000E3D',
  },
  timeInput: {
    borderWidth: 1,
    borderColor: '#474747',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 16,
    fontFamily: 'Montserrat_400Regular',
    fontSize: 16,
    color: '#0F0F0F',
    backgroundColor: '#FEFEFE',
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
    paddingHorizontal: 24,
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
    paddingHorizontal: 24,
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
    paddingHorizontal: 24,
    paddingBottom: 32,
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
});


