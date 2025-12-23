import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { useBusinessProfile } from '../../../context/BusinessProfileContext';
import { IconChevronDown, IconCheckbox, IconCheckboxOutline, IconDelete } from '../../../lib/icons';
import { Icon } from '../../../components/ui/Icon';
import { fetchCategories, type Category } from '../../../lib/categories';
import { CustomInput } from '../../../components/ui/CustomInput';
import AppHeader from '../../../components/layout/AppHeader';
import ScreenContainer from '../../../components/layout/ScreenContainer';
import { safeGoBack } from '../../../lib/router-utils';
import { CustomButton } from '../../../components/CustomButton';
import { useToast } from '../../../components/ui/ToastProvider';
import { handleError } from '../../../lib/errorHandler';
import { logger } from '../../../lib/logger';

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

const EditBusinessProfileScreen: React.FC = () => {
  const router = useRouter();
  const { showError, showSuccess } = useToast();
  const { businessProfile: contextBusinessProfile, loading: profileLoading, refreshBusinessProfile } = useBusinessProfile();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [description, setDescription] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [businessTime, setBusinessTime] = useState<string | null>(null);
  const [hasLunchTime, setHasLunchTime] = useState(false);
  const [bannerUri, setBannerUri] = useState<string | null>(null);
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [workDays, setWorkDays] = useState<Record<string, { start: string; end: string }>>({});
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showBusinessTimePicker, setShowBusinessTimePicker] = useState(false);

  useEffect(() => {
    loadCategories();
  }, []);

  // Carregar dados do perfil quando o contexto estiver disponível
  useEffect(() => {
    if (contextBusinessProfile && !profileLoading) {
      setBusinessName(contextBusinessProfile.business_name);
      setDescription(contextBusinessProfile.description || '');
      // category_id é number
      setSelectedCategoryId(contextBusinessProfile.category_id || null);
      setBannerUri(contextBusinessProfile.banner_url || null);
      setLogoUri(contextBusinessProfile.logo_url || null);
      setWorkDays(contextBusinessProfile.work_days || {});
      setLoading(false);
    } else if (!profileLoading && !contextBusinessProfile) {
      Alert.alert('Erro', 'Perfil do negócio não encontrado.');
      router.replace('/(merchant)/settings');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // router é estável do expo-router, não precisa estar nas dependências
  }, [contextBusinessProfile, profileLoading]);

  const loadCategories = async () => {
    const categoriesData = await fetchCategories();
    setCategories(categoriesData);
  };

  const pickBanner = async () => {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permissão necessária', 'Precisamos de permissão para acessar suas fotos.');
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setBannerUri(result.assets[0].uri);
      }
    } catch (error) {
      const processed = handleError(error, 'upload');
      showError(processed.userMessage);
    }
  };

  // Função auxiliar para determinar contentType baseado na extensão
  const getImageContentType = (ext: string): string => {
    const extMap: Record<string, string> = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'webp': 'image/webp',
    };
    return extMap[ext.toLowerCase()] || 'image/jpeg';
  };

  const pickLogo = async () => {
    try {
      // Solicitar permissão apenas quando necessário
      if (Platform.OS !== 'web') {
        try {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permissão necessária', 'Precisamos de permissão para acessar suas fotos.');
            return;
          }
        } catch (permissionError) {
          logger.error('Erro ao solicitar permissão de imagem:', permissionError);
          Alert.alert('Erro', 'Não foi possível solicitar permissão para acessar suas fotos.');
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setLogoUri(result.assets[0].uri);
      }
    } catch (error) {
      const processed = handleError(error, 'upload');
      showError(processed.userMessage);
    }
  };

  const uploadBanner = async (): Promise<string | null> => {
    if (!bannerUri || bannerUri.startsWith('http')) {
      return bannerUri;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return null;

      const fileExt = bannerUri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `business-banners/${fileName}`;

      // Verificar se o arquivo existe antes de ler
      const fileInfo = await FileSystem.getInfoAsync(bannerUri);
      if (!fileInfo.exists) {
        logger.error('Arquivo do banner não encontrado');
        return null;
      }

      // Ler arquivo como Base64
      const base64 = await FileSystem.readAsStringAsync(bannerUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Converter Base64 para Uint8Array
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);

      // Fazer upload
      const { error } = await supabase.storage
        .from('business-assets')
        .upload(filePath, byteArray, {
          contentType: getImageContentType(fileExt),
          upsert: true,
        });

      if (error) {
        logger.error('Erro ao fazer upload do banner:', error);
        return null;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('business-assets').getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      logger.error('Erro ao processar banner:', error);
      return null;
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

      const fileExt = logoUri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `business-logos/${fileName}`;

      // Verificar se o arquivo existe antes de ler
      const fileInfo = await FileSystem.getInfoAsync(logoUri);
      if (!fileInfo.exists) {
        logger.error('Arquivo do logo não encontrado');
        return null;
      }

      // Ler arquivo como Base64
      const base64 = await FileSystem.readAsStringAsync(logoUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Converter Base64 para Uint8Array
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);

      // Fazer upload
      const { error } = await supabase.storage
        .from('business-assets')
        .upload(filePath, byteArray, {
          contentType: getImageContentType(fileExt),
          upsert: true,
        });

      if (error) {
        logger.error('Erro ao fazer upload do logo:', error);
        return null;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('business-assets').getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      logger.error('Erro ao processar logo:', error);
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

    if (!contextBusinessProfile) {
      Alert.alert('Erro', 'Perfil não encontrado.');
      return;
    }

    try {
      setSaving(true);

      const bannerUrl = await uploadBanner();
      const logoUrl = await uploadLogo();

      // Verificar se houve tentativa de upload de novo banner que falhou
      const originalBannerUrl = contextBusinessProfile.banner_url || null;
      const hadNewBannerSelected = bannerUri && !bannerUri.startsWith('http');
      const bannerUploadFailed = hadNewBannerSelected && !bannerUrl;
      
      if (bannerUploadFailed) {
        Alert.alert('Erro', 'Não foi possível fazer upload do banner. Tente novamente.');
        setSaving(false);
        return;
      }

      // Preparar objeto de atualização
      const updateData: {
        business_name: string;
        description: string | null;
        category_id: number | null;
        banner_url?: string | null;
        logo_url?: string | null;
        work_days: Record<string, { start: string; end: string }> | null;
      } = {
        business_name: businessName.trim(),
        description: description.trim() || null,
        category_id: selectedCategoryId || null,
        work_days: Object.keys(workDays).length > 0 ? workDays : null,
      };

      // Só atualizar banner_url se houver uma mudança real
      // Se o banner não mudou (é a mesma URL ou ambos são null), manter o existente
      const hasBannerChanged = bannerUrl !== originalBannerUrl;
      
      if (hasBannerChanged) {
        // Se o usuário removeu o banner (bannerUrl é null mas havia um antes),
        // ou se fez upload de um novo com sucesso, atualizar
        updateData.banner_url = bannerUrl;
      }
      // Se não mudou, não incluir banner_url no update para preservar o valor existente

      // Verificar se houve tentativa de upload de novo logo que falhou
      const originalLogoUrl = contextBusinessProfile.logo_url || null;
      const hadNewLogoSelected = logoUri && !logoUri.startsWith('http');
      const logoUploadFailed = hadNewLogoSelected && !logoUrl;
      
      if (logoUploadFailed) {
        Alert.alert('Erro', 'Não foi possível fazer upload do logo. Tente novamente.');
        setSaving(false);
        return;
      }

      // Só atualizar logo_url se houver uma mudança real
      const hasLogoChanged = logoUrl !== originalLogoUrl;
      
      if (hasLogoChanged) {
        updateData.logo_url = logoUrl;
      }
      // Se não mudou, não incluir logo_url no update para preservar o valor existente

      const { error } = await supabase
        .from('business_profiles')
        .update(updateData)
        .eq('id', contextBusinessProfile.id);

      if (error) {
        const processed = handleError(error, 'profile');
        showError(processed.userMessage);
        return;
      }

      showSuccess('Perfil atualizado com sucesso!');
      // Atualizar o contexto do perfil antes de voltar
      await refreshBusinessProfile();
      Alert.alert('Sucesso', 'Perfil atualizado com sucesso!', [
        { text: 'OK', onPress: () => safeGoBack('/(merchant)/settings') },
      ]);
    } catch (error) {
      const processed = handleError(error, 'profile');
      showError(processed.userMessage);
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
                .maybeSingle();

              if (businessData) {
                const businessId = businessData.id;

              // 1. Deletar agendamentos
              const { error: appointmentsError } = await supabase
                .from('appointments')
                .delete()
                .eq('business_id', businessId);

              if (appointmentsError) {
                logger.error('Erro ao deletar agendamentos:', appointmentsError);
                Alert.alert('Erro', 'Não foi possível deletar os agendamentos. Tente novamente.');
                return;
              }

              // 2. Deletar avaliações
              const { error: reviewsError } = await supabase
                .from('reviews')
                .delete()
                .eq('business_id', businessId);

              if (reviewsError) {
                logger.error('Erro ao deletar avaliações:', reviewsError);
                Alert.alert('Erro', 'Não foi possível deletar as avaliações. Tente novamente.');
                return;
              }

              // 3. Deletar serviços
              const { error: servicesError } = await supabase
                .from('services')
                .delete()
                .eq('business_id', businessId);

              if (servicesError) {
                logger.error('Erro ao deletar serviços:', servicesError);
                Alert.alert('Erro', 'Não foi possível deletar os serviços. Tente novamente.');
                return;
              }

              // 4. Deletar business_profile
              const { error: businessProfileError } = await supabase
                .from('business_profiles')
                .delete()
                .eq('id', businessId);

              if (businessProfileError) {
                logger.error('Erro ao deletar perfil do negócio:', businessProfileError);
                Alert.alert('Erro', 'Não foi possível deletar o perfil do negócio. Tente novamente.');
                return;
              }
            }

            // 5. Deletar profile do usuário
            const { error: profileError } = await supabase
              .from('profiles')
              .delete()
              .eq('id', user.id);

            if (profileError) {
              logger.error('Erro ao deletar perfil do usuário:', profileError);
              Alert.alert('Erro', 'Não foi possível deletar o perfil do usuário. Tente novamente.');
              return;
            }

              // 6. Deletar usuário do auth.users usando Edge Function
              try {
                const { error: deleteError } = await supabase.functions.invoke('delete-user', {
                  method: 'POST',
                });

                if (deleteError) {
                  logger.error('Erro ao deletar usuário do auth:', deleteError);
                  // Continua mesmo se falhar - o usuário já foi removido das tabelas principais
                }
              } catch (fnError) {
                logger.error('Erro ao chamar função de exclusão:', fnError);
                // Continua mesmo se falhar - o usuário já foi removido das tabelas principais
              }

              // 7. Fazer logout
              await supabase.auth.signOut();

              Alert.alert('Conta Excluída', 'Sua conta foi excluída com sucesso.');
              router.replace('/(auth)/login');
            } catch (error) {
              logger.error('Erro ao excluir conta:', error);
              Alert.alert('Erro', 'Ocorreu um erro ao excluir sua conta. Por favor, tente novamente.');
            }
          },
        },
      ],
    );
  };

  if (loading || profileLoading) {
    return (
      <ScreenContainer 
        scroll={false} 
        backgroundColor="#FAFAFA" 
        hasHeader={true}
        hasTabBar={false}
        header={
          <AppHeader 
            title="Editar perfil"
            showBackButton={true}
            onPressBack={() => safeGoBack('/(merchant)/settings')}
          />
        }
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E5102E" />
        </View>
      </ScreenContainer>
    );
  }

  if (!contextBusinessProfile) {
    return (
      <ScreenContainer 
        scroll={false} 
        backgroundColor="#FAFAFA" 
        hasHeader={true}
        hasTabBar={false}
        header={
          <AppHeader 
            title="Editar perfil"
            showBackButton={true}
            onPressBack={() => safeGoBack('/(merchant)/settings')}
          />
        }
      >
        <View style={styles.container}>
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Perfil não encontrado.</Text>
          </View>
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
          title="Editar perfil"
          showBackButton={true}
          onPressBack={() => safeGoBack('/(merchant)/settings')}
        />
      }
      footer={
        <View style={styles.footerContainer}>
          <CustomButton
            title="Continuar"
            onPress={handleSave}
            isLoading={saving}
            disabled={saving}
            variant="primary"
            style={{ borderRadius: 24, marginVertical: 0 }}
            width="100%"
          />
        </View>
      }
    >
        {/* Business Name */}
        <CustomInput
          label="Nome do seu negócio"
          placeholder="Nome do seu negócio"
          value={businessName}
          onChangeText={setBusinessName}
          containerStyle={styles.field}
        />

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
              <Text style={styles.inputText}>12:00</Text>
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
                      <CustomInput
                        label="Hora de abertura"
                        placeholder="07:00"
                        value={daySchedule.start}
                        onChangeText={(value) => handleWorkDayTimeChange(day.key, 'start', value)}
                        containerStyle={{ marginBottom: 0 }}
                        inputContainerStyle={styles.timeInput}
                      />
                    </View>
                    <View style={styles.timeInputContainer}>
                      <CustomInput
                        label="Hora de fechamento"
                        placeholder="18:00"
                        value={daySchedule.end}
                        onChangeText={(value) => handleWorkDayTimeChange(day.key, 'end', value)}
                        containerStyle={{ marginBottom: 0 }}
                        inputContainerStyle={styles.timeInput}
                      />
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Description */}
        <CustomInput
          label="O que você faz?"
          placeholder="Descreva seu negócio..."
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
          containerStyle={styles.field}
          inputContainerStyle={StyleSheet.flatten([styles.input, styles.textArea])}
        />

        {/* Logo Upload */}
        <View style={styles.field}>
          <Text style={styles.uploadLabel}>Adicione o logotipo do seu negócio</Text>
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

        {/* Banner Upload */}
        <View style={styles.field}>
          <Text style={styles.uploadLabel}>Adicione uma foto de capa</Text>
          <TouchableOpacity style={styles.bannerUploadContainer} onPress={pickBanner} activeOpacity={0.8}>
            {bannerUri ? (
              <Image source={{ uri: bannerUri }} style={styles.bannerImage} />
            ) : (
              <View style={styles.bannerPlaceholder}>
                <View style={styles.bannerCircleButton}>
                  <Icon name="add" size={24} color="#FFFFFF" />
                </View>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Delete Account Button */}
        <CustomButton
          title="Excluir conta"
          variant="danger"
          onPress={handleDeleteAccount}
          style={{ borderRadius: 24, marginTop: 8 }}
          width="100%"
        />

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
            <CustomButton
              title="Cancelar"
              variant="ghost"
              onPress={() => setShowCategoryPicker(false)}
              style={{ marginTop: 16 }}
              width="100%"
            />
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
            <CustomButton
              title="Cancelar"
              variant="ghost"
              onPress={() => setShowBusinessTimePicker(false)}
              style={{ marginTop: 16 }}
              width="100%"
            />
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
};

export default EditBusinessProfileScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    minHeight: 48,
  },
  bannerUploadContainer: {
    width: '100%',
    height: 180,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#000000',
    backgroundColor: '#D9D9D9',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  bannerCircleButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#383838',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerPlaceholderText: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 14,
    color: '#474747',
  },
  uploadLabel: {
    fontSize: 12,
    fontFamily: 'Montserrat_700Bold',
    color: '#000E3D',
    marginBottom: 8,
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
  footerContainer: {
    paddingTop: 16,
    backgroundColor: '#FAFAFA',
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
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
});
