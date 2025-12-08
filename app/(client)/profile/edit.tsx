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
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { IconBack, IconNotification, IconAddPhoto, IconVisibilityOff } from '../../../lib/icons';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';

type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  email?: string;
};

const EditProfileScreen: React.FC = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [password, setPassword] = useState('*************');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    loadProfile();
    requestImagePermission();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.back();
        return;
      }

      // Buscar perfil
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Erro ao buscar perfil:', error);
        Alert.alert('Erro', 'Não foi possível carregar o perfil.');
        router.back();
        return;
      }

      if (profileData) {
        setProfile(profileData as Profile);
        setFullName(profileData.full_name || '');
        setEmail(user.email || '');
        setConfirmEmail(user.email || '');
        setAvatarUri(profileData.avatar_url);
      }
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

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
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

      // Ler o arquivo como base64 usando FileSystem (mais confiável no React Native)
      const base64 = await FileSystem.readAsStringAsync(avatarUri, {
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
    } catch (error: any) {
      console.error('Erro ao processar imagem:', error);
      
      // Tratamento de erros mais específico
      if (error.message?.includes('Network') || error.message?.includes('network')) {
        Alert.alert(
          'Erro de conexão',
          'Não foi possível fazer upload da imagem. Verifique sua conexão com a internet e tente novamente.'
        );
      } else if (error.message?.includes('permission') || error.message?.includes('Permission')) {
        Alert.alert(
          'Permissão negada',
          'Não foi possível acessar a imagem. Verifique as permissões do aplicativo.'
        );
      } else {
        Alert.alert(
          'Erro ao processar imagem',
          error.message || 'Ocorreu um erro inesperado ao processar a imagem.'
        );
      }
      
      return null;
    }
  };

  const handleSave = async () => {
    if (!fullName.trim()) {
      Alert.alert('Erro', 'O nome é obrigatório.');
      return;
    }

    if (!profile) {
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
        .eq('id', profile.id);

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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E5102E" />
      </View>
    );
  }

  if (!profile) {
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
        <LinearGradient
          colors={['#000E3D', '#000E3D']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.headerGradient}
        >
          <Svg height="100%" width="100%" style={StyleSheet.absoluteFillObject}>
            <Defs>
              <RadialGradient
                id="grad"
                cx="50%"
                cy="50%"
                r="50%"
                gradientUnits="userSpaceOnUse"
                gradientTransform="matrix(1 0 0 0.5 0 0)"
              >
                <Stop offset="0%" stopColor="#D6E0FF" />
                <Stop offset="100%" stopColor="#000E3D" />
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#grad)" opacity="0.2" />
          </Svg>
          <View style={styles.topBarContent}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <IconBack size={24} color="#FEFEFE" />
            </TouchableOpacity>
            <Text style={styles.topBarTitle}>Editar perfil</Text>
            <IconNotification size={24} color="#FEFEFE" />
          </View>
        </LinearGradient>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
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
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Seu nome</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Seu nome completo"
                placeholderTextColor="#9E9E9E"
                value={fullName}
                onChangeText={setFullName}
              />
            </View>
          </View>

          {/* Email */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Email</Text>
            <View style={styles.inputContainer}>
              <Text style={styles.inputText}>{email}</Text>
            </View>
          </View>

          {/* Confirm Email */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Confirme seu email</Text>
            <View style={styles.inputContainer}>
              <Text style={styles.inputText}>{confirmEmail}</Text>
            </View>
          </View>

          {/* Password */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Senha</Text>
            <View style={styles.inputContainer}>
              <Text style={styles.inputText}>{password}</Text>
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <IconVisibilityOff size={24} color="#0F0F0F" />
              </TouchableOpacity>
            </View>
            <Text style={styles.helperText}>
              Utilize letras, números e um caractere especial
            </Text>
          </View>

          {/* Change Password Button */}
          <TouchableOpacity
            style={styles.ghostButton}
            onPress={() => router.push('/(client)/profile/password')}
            activeOpacity={0.7}
          >
            <Text style={styles.ghostButtonText}>Alterar senha</Text>
          </TouchableOpacity>

          {/* Delete Account Button */}
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => {
              Alert.alert(
                'Excluir conta',
                'Tem certeza que deseja excluir sua conta? Esta ação não pode ser desfeita.',
                [
                  { text: 'Cancelar', style: 'cancel' },
                  {
                    text: 'Excluir',
                    style: 'destructive',
                    onPress: () => {
                      // Implementar exclusão de conta
                      Alert.alert('Atenção', 'Funcionalidade de exclusão de conta em desenvolvimento.');
                    },
                  },
                ]
              );
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.deleteButtonText}>Excluir conta</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Continue Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.continueButton, saving && styles.continueButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FEFEFE" />
          ) : (
            <Text style={styles.continueButtonText}>Continuar</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default EditProfileScreen;

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
    height: 70,
  },
  headerGradient: {
    height: '100%',
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 100,
    alignItems: 'center',
  },
  logoUploadSection: {
    width: 342,
    marginBottom: 16,
    gap: 4,
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
    width: 342,
    gap: 16,
  },
  inputSection: {
    gap: 4,
  },
  inputLabel: {
    fontSize: 12,
    fontFamily: 'Montserrat_700Bold',
    color: '#000E3D',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEFEFE',
    borderWidth: 1,
    borderColor: '#474747',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 16,
    gap: 16,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#0F0F0F',
  },
  inputText: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#0F0F0F',
  },
  eyeButton: {
    padding: 1,
  },
  helperText: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#0F0F0F',
  },
  ghostButton: {
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostButtonText: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#000E3D',
  },
  deleteButton: {
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1D1D1D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.24,
    shadowRadius: 8,
    elevation: 6,
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
});
