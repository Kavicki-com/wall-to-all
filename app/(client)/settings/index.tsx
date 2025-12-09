import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { MaterialIcons } from '@expo/vector-icons';
import {
  IconAccount,
  IconLock,
  IconDelete,
  IconSupport,
  IconDocs,
  IconHelp,
  IconSettings,
} from '../../../lib/icons';

type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at?: string;
};

const SettingsScreen: React.FC = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Erro ao buscar perfil:', error);
      } else if (profileData) {
        setProfile(profileData as Profile);
      }
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
    } finally {
      setLoading(false);
    }
  };

  const getClientSinceYear = () => {
    if (!profile?.created_at) return '2025';
    const year = new Date(profile.created_at).getFullYear();
    return year.toString();
  };

  const handleLogout = () => {
    Alert.alert('Sair', 'Tem certeza que deseja sair?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#E5102E" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Container */}
        <View style={styles.profileContainer}>
          <View style={styles.profileAvatarContainer}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.placeholderAvatar]} />
            )}
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{profile?.full_name || 'Usuário'}</Text>
            <Text style={styles.profileSince}>Cliente desde {getClientSinceYear()}</Text>
          </View>
        </View>

        {/* Options List */}
        <View style={styles.optionsContainer}>
          <View style={styles.optionsList}>
            {/* Editar Perfil */}
            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => router.push('/(client)/profile/edit')}
              activeOpacity={0.7}
            >
              <IconAccount size={24} color="#000E3D" />
              <Text style={styles.optionText}>Editar Perfil</Text>
              <View style={styles.chevronContainer}>
                <MaterialIcons name="chevron-right" size={18} color="#000E3D" />
              </View>
            </TouchableOpacity>

            {/* Alterar Senha */}
            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => router.push('/(client)/profile/password')}
              activeOpacity={0.7}
            >
              <IconLock size={24} color="#000E3D" />
              <Text style={styles.optionText}>Alterar Senha</Text>
              <View style={styles.chevronContainer}>
                <MaterialIcons name="chevron-right" size={18} color="#000E3D" />
              </View>
            </TouchableOpacity>

            {/* Excluir Conta */}
            <TouchableOpacity
              style={styles.optionItem}
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
                        Alert.alert('Atenção', 'Funcionalidade de exclusão de conta em desenvolvimento.');
                      },
                    },
                  ]
                );
              }}
              activeOpacity={0.7}
            >
              <MaterialIcons name="delete-outline" size={24} color="#000E3D" />
              <Text style={styles.optionText}>Excluir Conta</Text>
              <View style={styles.chevronContainer}>
                <MaterialIcons name="chevron-right" size={18} color="#000E3D" />
              </View>
            </TouchableOpacity>

            {/* Suporte */}
            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => {
                Alert.alert('Contato', 'Entre em contato pelo e-mail: suporte@walltoall.com');
              }}
              activeOpacity={0.7}
            >
              <IconSupport size={24} color="#000E3D" />
              <Text style={styles.optionText}>Suporte</Text>
              <View style={styles.chevronContainer}>
                <MaterialIcons name="chevron-right" size={18} color="#000E3D" />
              </View>
            </TouchableOpacity>

            {/* Termos de uso */}
            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => router.push('/(client)/settings/terms')}
              activeOpacity={0.7}
            >
              <IconDocs size={24} color="#000E3D" />
              <Text style={styles.optionText}>Termos de uso</Text>
              <View style={styles.chevronContainer}>
                <MaterialIcons name="chevron-right" size={18} color="#000E3D" />
              </View>
            </TouchableOpacity>

            {/* FAQ */}
            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => router.push('/(client)/settings/faq')}
              activeOpacity={0.7}
            >
              <IconHelp size={24} color="#000E3D" />
              <Text style={styles.optionText}>FAQ</Text>
              <View style={styles.chevronContainer}>
                <MaterialIcons name="chevron-right" size={18} color="#000E3D" />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <Text style={styles.logoutButtonText}>Sair</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

export default SettingsScreen;

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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 32,
    paddingBottom: 100,
    alignItems: 'center',
  },
  profileContainer: {
    alignItems: 'center',
    marginBottom: 32,
    gap: 8,
  },
  profileAvatarContainer: {
    marginBottom: 0,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  placeholderAvatar: {
    backgroundColor: '#E0E0E0',
  },
  profileInfo: {
    alignItems: 'center',
    gap: 4,
  },
  profileName: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#0F0F0F',
    textAlign: 'center',
  },
  profileSince: {
    fontSize: 8,
    fontFamily: 'Montserrat_500Medium',
    color: '#0F0F0F',
  },
  optionsContainer: {
    width: '90%',
    maxWidth: 342,
    marginBottom: 32,
    alignSelf: 'center',
  },
  optionsList: {
    gap: 12,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEFEFE',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 16,
    gap: 26,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 1,
    elevation: 2,
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#000E3D',
  },
  chevronContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingRight: 4,
  },
  logoutButton: {
    width: '90%',
    maxWidth: 342,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  logoutButtonText: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#000E3D',
  },
});
