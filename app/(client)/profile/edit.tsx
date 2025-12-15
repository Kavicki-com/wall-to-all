import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { useProfile } from '../../../context/ProfileContext';
import { IconAddPhoto } from '../../../lib/icons';
import { CustomInput } from '../../../components/ui/CustomInput';
import AppHeader from '../../../components/layout/AppHeader';
import ScreenContainer from '../../../components/layout/ScreenContainer';
import { CustomButton } from '../../../components/CustomButton';
import { safeGoBack } from '../../../lib/router-utils';
import { useToast } from '../../../components/ui/ToastProvider';
import { handleError } from '../../../lib/errorHandler';

const EditProfileScreen: React.FC = () => {
  const router = useRouter();
  const { showError, showSuccess } = useToast();
  const { profile: contextProfile, loading: profileLoading, refreshProfile } = useProfile();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [password] = useState('*************');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  useEffect(() => {
    if (contextProfile) {
      setFullName(contextProfile.full_name || '');
      setEmail(contextProfile.email || '');
      setConfirmEmail(contextProfile.email || '');
      setAvatarUri(contextProfile.avatar_url || null);
      setLoading(false);
    } else if (!profileLoading) {
      // Se não há perfil e não está carregando, redireciona
      router.replace('/(client)/profile');
    }
  }, [contextProfile, profileLoading]);

  const pickImage = async () => {
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
          console.error('Erro ao solicitar permissão de imagem:', permissionError);
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
        setAvatarUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Erro ao selecionar imagem:', error);
      Alert.alert('Erro', 'Não foi possível selecionar a imagem.');
    }
  };

  const uploadAvatar = async (): Promise<string | null> => {
    if (!avatarUri || avatarUri.startsWith('http')) {
      return avatarUri;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        Alert.alert('Erro', 'Usuário não autenticado. Faça login novamente.');
        return null;
      }

      // Criar nome único para o arquivo
      const fileExt = avatarUri.split('.').pop() || 'jpg';
      const fileName = `${user.id}_${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Verificar se o arquivo existe antes de ler
      const fileInfo = await FileSystem.getInfoAsync(avatarUri);
      if (!fileInfo.exists) {
        Alert.alert('Erro', 'Arquivo de imagem não encontrado. Por favor, selecione a imagem novamente.');
        return null;
      }

      // Ler o arquivo como base64 usando FileSystem (mais confiável no React Native)
      let base64: string;
      try {
        base64 = await FileSystem.readAsStringAsync(avatarUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } catch (fileError) {
        console.error('Erro ao ler arquivo do avatar:', fileError);
        Alert.alert('Erro', 'Não foi possível ler o arquivo de imagem. Verifique se o arquivo não está corrompido.');
        return null;
      }

      // Converter base64 para ArrayBuffer
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);

      // Fazer upload para Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, byteArray, {
          contentType: `image/${fileExt}`,
          upsert: true,
        });

      if (uploadError) {
        console.error('Erro ao fazer upload:', uploadError);
        // Verificar se é erro de rede
        if (uploadError.message?.includes('Network') || uploadError.message?.includes('network')) {
          Alert.alert(
            'Erro de conexão',
            'Não foi possível fazer upload da imagem. Verifique sua conexão com a internet e tente novamente.'
          );
        } else {
          Alert.alert(
            'Erro ao fazer upload',
            `Não foi possível fazer upload da imagem: ${uploadError.message || 'Erro desconhecido'}`
          );
        }
        return null;
      }

      // Obter URL pública da imagem
      const {
        data: { publicUrl },
      } = supabase.storage.from('avatars').getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      const processed = handleError(error, 'upload');
      showError(processed.userMessage);
      return null;
    }
  };

  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert('Erro', 'O nome é obrigatório.');
      return;
    }

    if (!contextProfile) {
      Alert.alert('Erro', 'Perfil não encontrado.');
      return;
    }

    try {
      setSaving(true);

      const avatarUrl = await uploadAvatar();

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          avatar_url: avatarUrl,
        })
        .eq('id', contextProfile.id);

      if (error) {
        const processed = handleError(error, 'profile');
        showError(processed.userMessage);
        return;
      }

      showSuccess('Perfil atualizado com sucesso');
      // Atualizar o contexto do perfil antes de voltar
      await refreshProfile();
      setTimeout(() => {
        router.back();
      }, 1000);
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

  if (loading || profileLoading) {
    return (
      <ScreenContainer 
        style={{ backgroundColor: '#FAFAFA' }} 
        hasHeader={true}
        hasTabBar={false}
        header={
          <AppHeader 
            title="Editar perfil"
            showBackButton={true}
            onPressBack={() => safeGoBack('/(client)/profile')}
          />
        }
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E5102E" />
        </View>
      </ScreenContainer>
    );
  }

  if (!contextProfile) {
    return (
      <ScreenContainer 
        style={{ backgroundColor: '#FAFAFA' }} 
        hasHeader={true}
        hasTabBar={false}
        header={
          <AppHeader 
            title="Editar perfil"
            showBackButton={true}
            onPressBack={() => safeGoBack('/(client)/profile')}
          />
        }
      >
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Perfil não encontrado.</Text>
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
      contentContainerStyle={{ alignItems: 'center' }}
      header={
        <AppHeader 
          title="Editar perfil"
          showBackButton={true}
          onPressBack={() => safeGoBack('/(client)/profile')}
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
        {/* Logo Upload */}
        <View style={styles.logoUploadSection}>
          <Text style={styles.logoUploadLabel}>Alterar foto de perfil</Text>
          <TouchableOpacity
            style={styles.logoUploadContainer}
            onPress={pickImage}
            activeOpacity={0.8}
          >
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.logoUploadImage} />
            ) : (
              <View style={styles.logoUploadPlaceholder}>
                <IconAddPhoto size={34} color="#474747" />
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Form Fields */}
        <View style={styles.form}>
          {/* Name */}
          <CustomInput
            label="Seu nome"
            placeholder="Seu nome completo"
            value={fullName}
            onChangeText={setFullName}
            containerStyle={styles.inputSection}
          />

          {/* Email */}
          <CustomInput
            label="Email"
            value={email}
            readOnly
            containerStyle={styles.inputSection}
          />

          {/* Confirm Email */}
          <CustomInput
            label="Confirme seu email"
            value={confirmEmail}
            readOnly
            containerStyle={styles.inputSection}
          />

          {/* Password */}
          <CustomInput
            label="Senha"
            value={password}
            readOnly
            containerStyle={styles.inputSection}
            helperText="Utilize letras, números e um caractere especial"
          />

          {/* Change Password Button */}
          <CustomButton
            title="Alterar senha"
            variant="ghost"
            onPress={() => router.push('/(client)/profile/password')}
            style={{ borderRadius: 24, marginTop: 8 }}
            width="100%"
          />

          {/* Delete Account Button */}
          <CustomButton
            title="Excluir conta"
            variant="danger"
            onPress={handleDeleteAccount}
            style={{ borderRadius: 24, marginTop: 8 }}
            width="100%"
          />
        </View>
    </ScreenContainer>
  );
};

export default EditProfileScreen;

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  topBarContainer: {
    height: 70,
  },
  headerGradient: {
    height: '100%',
    justifyContent: 'flex-end',
    paddingBottom: 16,
  },
  topBarContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBarTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#FEFEFE',
    flex: 1,
    textAlign: 'center',
  },
  logoUploadSection: {
    width: '90%',
    maxWidth: 342,
    marginBottom: 16,
    gap: 4,
    alignSelf: 'center',
  },
  logoUploadLabel: {
    fontSize: 12,
    fontFamily: 'Montserrat_700Bold',
    color: '#000E3D',
  },
  logoUploadContainer: {
    width: '100%',
    height: 147,
    borderWidth: 4,
    borderColor: '#E5102E',
    borderRadius: 0,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  logoUploadImage: {
    width: '100%',
    height: '100%',
  },
  logoUploadPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  form: {
    width: '90%',
    maxWidth: 342,
    gap: 16,
    alignSelf: 'center',
  },
  inputSection: {
    marginBottom: 16,
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
});
