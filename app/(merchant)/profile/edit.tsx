import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { IconBack, IconNotification, IconChevronDown, IconCheckbox, IconCheckboxOutline, IconDelete } from '../../../lib/icons';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { fetchCategories, type Category } from '../../../lib/categories';

const BUSINESS_TIME_OPTIONS = ['1 ano', '2 anos', '3 anos', '4 anos', '5+ anos'];

const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Segunda-feira' },
  { key: 'tuesday', label: 'Terça-feira' },
  { key: 'wednesday', label: 'Quarta-feira' },
  { key: 'thursday', label: 'Quinta-feira' },
  { key: 'friday', label: 'Sexta-feira' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
];

type BusinessProfile = {
  id: string;
  business_name: string;
  description: string | null;
  logo_url: string | null;
  category_id: number | null;
  categories?: {
    id: number;
    name: string;
  };
  address: string | null;
  work_days: Record<string, { start: string; end: string }> | null;
  accepted_payment_methods: {
    pix?: boolean;
    card?: boolean;
    cash?: boolean;
  } | null;
};

const EditBusinessProfileScreen: React.FC = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [description, setDescription] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [businessTime, setBusinessTime] = useState<string | null>(null);
  const [lunchTime, setLunchTime] = useState('');
  const [hasLunchTime, setHasLunchTime] = useState(false);
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [workDays, setWorkDays] = useState<Record<string, { start: string; end: string }>>({});
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showBusinessTimePicker, setShowBusinessTimePicker] = useState(false);

  useEffect(() => {
    loadCategories();
    loadBusinessProfile();
    requestImagePermission();
  }, []);

  const loadCategories = async () => {
    const categoriesData = await fetchCategories();
    setCategories(categoriesData);
  };

  const loadBusinessProfile = async () => {
    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.back();
        return;
      }

      const { data: businessData, error } = await supabase
        .from('business_profiles')
        .select(`
          *,
          categories:category_id (
            id,
            name
          )
        `)
        .eq('owner_id', user.id)
        .single();

      if (error || !businessData) {
        console.error('Erro ao buscar perfil:', error);
        Alert.alert('Erro', 'Perfil do negócio não encontrado.');
        router.back();
        return;
      }

      setBusinessProfile(businessData as BusinessProfile);
      setBusinessName(businessData.business_name);
      setDescription(businessData.description || '');
      setSelectedCategoryId(businessData.category_id || null);
      setLogoUri(businessData.logo_url);
      setWorkDays(businessData.work_days || {});
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
      Alert.alert('Erro', 'Ocorreu um erro ao carregar o perfil.');
    } finally {
      setLoading(false);
    }
  };

  const requestImagePermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão necessária', 'Precisamos de permissão para acessar suas fotos.');
    }
  };

  const pickLogo = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setLogoUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Erro ao selecionar imagem:', error);
      Alert.alert('Erro', 'Não foi possível selecionar a imagem.');
    }
  };

  const uploadLogo = async (): Promise<string | null> => {
    if (!logoUri || logoUri.startsWith('http')) {
      return logoUri;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return null;

      const fileName = `${user.id}_${Date.now()}.jpg`;
      const filePath = `business-logos/${fileName}`;

      const response = await fetch(logoUri);
      const blob = await response.blob();

      const { data, error } = await supabase.storage
        .from('business-assets')
        .upload(filePath, blob, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (error) {
        console.error('Erro ao fazer upload:', error);
        return null;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('business-assets').getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Erro ao processar imagem:', error);
      return null;
    }
  };

  const handleWorkDayToggle = (dayKey: string) => {
    const newWorkDays = { ...workDays };
    if (newWorkDays[dayKey]) {
      delete newWorkDays[dayKey];
    } else {
      newWorkDays[dayKey] = { start: '07:00', end: '18:00' };
    }
    setWorkDays(newWorkDays);
  };

  const handleWorkDayTimeChange = (dayKey: string, field: 'start' | 'end', value: string) => {
    const newWorkDays = { ...workDays };
    if (!newWorkDays[dayKey]) {
      newWorkDays[dayKey] = { start: '07:00', end: '18:00' };
    }
    newWorkDays[dayKey][field] = value;
    setWorkDays(newWorkDays);
  };

  const handleSave = async () => {
    if (!businessName.trim()) {
      Alert.alert('Erro', 'O nome do negócio é obrigatório.');
      return;
    }

    if (!businessProfile) {
      Alert.alert('Erro', 'Perfil não encontrado.');
      return;
    }

    try {
      setSaving(true);

      const logoUrl = await uploadLogo();

      const { error } = await supabase
        .from('business_profiles')
        .update({
          business_name: businessName.trim(),
          description: description.trim() || null,
          category_id: selectedCategoryId || null,
          logo_url: logoUrl,
          work_days: Object.keys(workDays).length > 0 ? workDays : null,
        })
        .eq('id', businessProfile.id);

      if (error) {
        console.error('Erro ao atualizar perfil:', error);
        Alert.alert('Erro', 'Não foi possível atualizar o perfil.');
        return;
      }

      Alert.alert('Sucesso', 'Perfil atualizado com sucesso!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error('Erro ao salvar perfil:', error);
      Alert.alert('Erro', 'Ocorreu um erro ao salvar o perfil.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      'Excluir Conta',
      'Tem certeza que deseja excluir sua conta? Esta ação é irreversível e todos os seus dados serão permanentemente removidos, incluindo:\n\n• Seus agendamentos\n• Seus serviços\n• Suas avaliações\n• Seu perfil de negócio\n\nEsta ação não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir Conta',
          style: 'destructive',
          onPress: async () => {
            try {
              const {
                data: { user },
              } = await supabase.auth.getUser();

              if (!user) {
                Alert.alert('Erro', 'Usuário não autenticado.');
                return;
              }

              // Buscar business_profile
              const { data: businessData } = await supabase
                .from('business_profiles')
                .select('id')
                .eq('owner_id', user.id)
                .single();

              if (businessData) {
                const businessId = businessData.id;

                // 1. Deletar agendamentos
                await supabase.from('appointments').delete().eq('business_id', businessId);

                // 2. Deletar avaliações
                await supabase.from('reviews').delete().eq('business_id', businessId);

                // 3. Deletar serviços
                await supabase.from('services').delete().eq('business_id', businessId);

                // 4. Deletar business_profile
                await supabase.from('business_profiles').delete().eq('id', businessId);
              }

              // 5. Deletar profile do usuário
              await supabase.from('profiles').delete().eq('id', user.id);

              // 6. Fazer logout e deletar conta de autenticação
              // Nota: A exclusão de auth.users geralmente requer função server-side
              // Por enquanto, apenas fazemos logout
              await supabase.auth.signOut();

              Alert.alert('Conta Excluída', 'Sua conta foi excluída com sucesso.');
              router.replace('/(auth)/login');
            } catch (error) {
              console.error('Erro ao excluir conta:', error);
              Alert.alert('Erro', 'Ocorreu um erro ao excluir sua conta. Por favor, tente novamente.');
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

  if (!businessProfile) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Perfil não encontrado.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top Bar with Gradient */}
      <View style={styles.topBarContainer}>
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
                  <Stop offset="0%" stopColor="rgba(214,224,255,1)" />
                  <Stop offset="25%" stopColor="rgba(161,172,207,1)" />
                  <Stop offset="37.5%" stopColor="rgba(134,145,182,1)" />
                  <Stop offset="50%" stopColor="rgba(107,119,158,1)" />
                  <Stop offset="62.5%" stopColor="rgba(80,93,134,1)" />
                  <Stop offset="75%" stopColor="rgba(54,67,110,1)" />
                  <Stop offset="87.5%" stopColor="rgba(27,40,85,1)" />
                  <Stop offset="93.75%" stopColor="rgba(13,27,73,1)" />
                  <Stop offset="100%" stopColor="rgba(0,14,61,1)" />
                </RadialGradient>
              </Defs>
              <Rect x="0" y="0" width="410" height="56" fill="url(#topBarRadialGradient)" opacity={0.2} />
            </Svg>
            <LinearGradient
              colors={['rgba(0, 14, 61, 0.2)', 'rgba(214, 224, 255, 0.2)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={['rgba(0, 14, 61, 1)', 'rgba(0, 14, 61, 1)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.topBarInner}>
              <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                <IconBack size={24} color="#FEFEFE" />
              </TouchableOpacity>
              <Text style={styles.topBarTitle}>Editar perfil</Text>
              <TouchableOpacity style={styles.notificationButton}>
                <IconNotification size={24} color="#FEFEFE" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Business Name */}
        <View style={styles.field}>
          <Text style={styles.label}>Nome do seu negócio</Text>
          <TextInput
            style={styles.input}
            placeholder="Nome do seu negócio"
            placeholderTextColor="#9E9E9E"
            value={businessName}
            onChangeText={setBusinessName}
          />
        </View>

        {/* Category (Área de atuação) */}
        <View style={styles.field}>
          <Text style={styles.label}>Área de atuação</Text>
          <TouchableOpacity
            style={styles.input}
            onPress={() => setShowCategoryPicker(true)}
          >
            <Text style={[styles.inputText, !selectedCategoryId && styles.inputPlaceholder]}>
              {selectedCategoryId 
                ? categories.find(c => c.id === selectedCategoryId)?.name || 'Selecione uma categoria'
                : 'Selecione uma categoria'}
            </Text>
            <IconChevronDown size={24} color="#0F0F0F" />
          </TouchableOpacity>
        </View>

        {/* Lunch Time Checkbox */}
        <TouchableOpacity
          style={styles.checkboxContainer}
          onPress={() => setHasLunchTime(!hasLunchTime)}
          activeOpacity={0.7}
        >
          {hasLunchTime ? (
            <IconCheckbox size={24} color="#000E3D" />
          ) : (
            <IconCheckboxOutline size={24} color="#000E3D" />
          )}
          <Text style={styles.checkboxLabel}>Horário de almoço</Text>
        </TouchableOpacity>

        {/* Lunch Time Input */}
        {hasLunchTime && (
          <View style={styles.field}>
            <Text style={styles.label}>Horário de almoço</Text>
            <TouchableOpacity style={[styles.input, styles.inputWithBorder]}>
              <Text style={styles.inputText}>{lunchTime || '12:00'}</Text>
              <IconChevronDown size={24} color="#0F0F0F" />
            </TouchableOpacity>
          </View>
        )}

        {/* Business Time */}
        <View style={styles.field}>
          <Text style={styles.label}>Tempo de Negócio</Text>
          <TouchableOpacity
            style={[styles.input, styles.inputWithBorder]}
            onPress={() => setShowBusinessTimePicker(true)}
          >
            <Text style={[styles.inputText, !businessTime && styles.inputPlaceholder]}>
              {businessTime || '1 ano'}
            </Text>
            <IconChevronDown size={24} color="#0F0F0F" />
          </TouchableOpacity>
        </View>

        {/* Work Days */}
        <View style={styles.workDaysSection}>
          <Text style={styles.label}>Dias de funcionamento</Text>
          {DAYS_OF_WEEK.map((day) => {
            const isEnabled = !!workDays[day.key];
            const daySchedule = workDays[day.key];

            return (
              <View key={day.key} style={styles.daySelector}>
                <TouchableOpacity
                  style={styles.dayCheckbox}
                  onPress={() => handleWorkDayToggle(day.key)}
                  activeOpacity={0.7}
                >
                  {isEnabled ? (
                    <IconCheckbox size={24} color="#000E3D" />
                  ) : (
                    <IconCheckboxOutline size={24} color="#474747" />
                  )}
                  <Text style={[styles.dayLabel, !isEnabled && styles.dayLabelDisabled]}>
                    {day.label}
                  </Text>
                </TouchableOpacity>
                {isEnabled && daySchedule && (
                  <View style={styles.dayTimes}>
                    <View style={styles.timeInputContainer}>
                      <Text style={styles.timeLabel}>Hora de abertura</Text>
                      <TextInput
                        style={styles.timeInput}
                        placeholder="07:00"
                        placeholderTextColor="#0F0F0F"
                        value={daySchedule.start}
                        onChangeText={(value) => handleWorkDayTimeChange(day.key, 'start', value)}
                      />
                    </View>
                    <View style={styles.timeInputContainer}>
                      <Text style={styles.timeLabel}>Hora de fechamento</Text>
                      <TextInput
                        style={styles.timeInput}
                        placeholder="18:00"
                        placeholderTextColor="#0F0F0F"
                        value={daySchedule.end}
                        onChangeText={(value) => handleWorkDayTimeChange(day.key, 'end', value)}
                      />
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Description */}
        <View style={styles.field}>
          <Text style={styles.label}>O que você faz?</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Descreva seu negócio..."
            placeholderTextColor="#9E9E9E"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
        </View>

        {/* Logo Upload */}
        <View style={styles.field}>
          <Text style={styles.label}>Adicione o logotipo do seu negócio</Text>
          <TouchableOpacity style={styles.logoUploadContainer} onPress={pickLogo}>
            {logoUri ? (
              <Image source={{ uri: logoUri }} style={styles.logoImage} />
            ) : (
              <View style={styles.logoPlaceholder}>
                <IconDelete size={34} color="#474747" />
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Delete Account Button */}
        <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteAccount}>
          <Text style={styles.deleteButtonText}>Excluir conta</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Continue Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.continueButton, saving && styles.continueButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FEFEFE" />
          ) : (
            <Text style={styles.continueButtonText}>Continuar</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Category Picker Modal */}
      <Modal
        visible={showCategoryPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCategoryPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Selecione a categoria</Text>
            <ScrollView>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.modalOption,
                    selectedCategoryId === cat.id && styles.modalOptionSelected,
                  ]}
                  onPress={() => {
                    setSelectedCategoryId(cat.id);
                    setShowCategoryPicker(false);
                  }}
                >
                  <Text style={[
                    styles.modalOptionText,
                    selectedCategoryId === cat.id && styles.modalOptionTextSelected,
                  ]}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowCategoryPicker(false)}
            >
              <Text style={styles.modalCloseButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Business Time Picker Modal */}
      <Modal
        visible={showBusinessTimePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBusinessTimePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Tempo de negócio</Text>
            <ScrollView>
              {BUSINESS_TIME_OPTIONS.map((time) => (
                <TouchableOpacity
                  key={time}
                  style={styles.modalOption}
                  onPress={() => {
                    setBusinessTime(time);
                    setShowBusinessTimePicker(false);
                  }}
                >
                  <Text style={styles.modalOptionText}>{time}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowBusinessTimePicker(false)}
            >
              <Text style={styles.modalCloseButtonText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default EditBusinessProfileScreen;

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
  topBarContainer: {
    width: '100%',
  },
  topBarDivider: {
    height: 14,
    backgroundColor: '#EBEFFF',
  },
  topBarContent: {
    height: 56,
  },
  topBarGradientContainer: {
    flex: 1,
    position: 'relative',
  },
  topBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    height: '100%',
  },
  backButton: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBarTitle: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#FEFEFE',
    textAlign: 'center',
  },
  notificationButton: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 120,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontFamily: 'Montserrat_700Bold',
    color: '#000E3D',
    marginBottom: 4,
  },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEFEFE',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#474747',
    paddingHorizontal: 12,
    paddingVertical: 16,
    minHeight: 48,
  },
  inputWithBorder: {
    borderWidth: 2,
    borderColor: '#0F0F0F',
  },
  inputText: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#0F0F0F',
  },
  inputPlaceholder: {
    color: '#9E9E9E',
  },
  textArea: {
    minHeight: 190,
    paddingTop: 16,
    alignItems: 'flex-start',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 16,
  },
  checkboxLabel: {
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#0F0F0F',
  },
  workDaysSection: {
    marginBottom: 16,
  },
  daySelector: {
    marginBottom: 9,
  },
  dayCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 9,
  },
  dayLabel: {
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#0F0F0F',
  },
  dayLabelDisabled: {
    color: '#474747',
  },
  dayTimes: {
    flexDirection: 'row',
    gap: 12,
    marginLeft: 28,
  },
  timeInputContainer: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 12,
    fontFamily: 'Montserrat_700Bold',
    color: '#000E3D',
    marginBottom: 4,
  },
  timeInput: {
    backgroundColor: '#FEFEFE',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#474747',
    paddingHorizontal: 12,
    paddingVertical: 16,
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#0F0F0F',
  },
  logoUploadContainer: {
    width: '100%',
    height: 147,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  logoPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(29, 29, 29, 0.32)',
  },
  deleteButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 24,
    alignItems: 'center',
    marginTop: 8,
  },
  deleteButtonText: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#E5102E',
  },
  footer: {
    position: 'absolute',
    bottom: 32,
    left: 24,
    right: 24,
  },
  continueButton: {
    backgroundColor: '#000E3D',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1D1D1D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.24,
    shadowRadius: 8,
    elevation: 4,
  },
  continueButtonDisabled: {
    opacity: 0.6,
  },
  continueButtonText: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#FEFEFE',
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
    color: '#474747',
    textAlign: 'center',
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
    padding: 24,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Montserrat_700Bold',
    color: '#000E3D',
    marginBottom: 16,
  },
  modalOption: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  modalOptionSelected: {
    backgroundColor: '#E3F2FD',
  },
  modalOptionText: {
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#0F0F0F',
  },
  modalOptionTextSelected: {
    fontFamily: 'Montserrat_700Bold',
    color: '#1976D2',
  },
  modalCloseButton: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#000E3D',
  },
});
