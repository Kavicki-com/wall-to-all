import React from 'react';
import {
  View,
  Text,
  StyleSheet,
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
  IconSupport,
  IconDocs,
  IconHelp,
  IconDelete,
} from '../../../lib/icons';
import ScreenContainer from '../../../components/layout/ScreenContainer';
import { CustomButton } from '../../../components/CustomButton';
import { useProfile } from '../../../context/ProfileContext';

const SettingsScreen: React.FC = () => {
  const router = useRouter();
  const { profile, loading } = useProfile();

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

  const handleDeleteAccount = async () => {
    Alert.alert(
      'Excluir Conta',
      'Tem certeza que deseja excluir sua conta? Esta ação é irreversível e todos os seus dados serão permanentemente removidos, incluindo:\n\n• Seus agendamentos\n• Suas avaliações\n• Seu perfil\n\nEsta ação não pode ser desfeita.',
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

              // 1. Deletar agendamentos do cliente
              const { error: appointmentsError } = await supabase
                .from('appointments')
                .delete()
                .eq('client_id', user.id);

              if (appointmentsError) {
                console.error('Erro ao deletar agendamentos:', appointmentsError);
                Alert.alert('Erro', 'Não foi possível deletar seus agendamentos. Tente novamente.');
                return;
              }

              // 2. Deletar avaliações do cliente
              const { error: reviewsError } = await supabase
                .from('reviews')
                .delete()
                .eq('client_id', user.id);

              if (reviewsError) {
                console.error('Erro ao deletar avaliações:', reviewsError);
                Alert.alert('Erro', 'Não foi possível deletar suas avaliações. Tente novamente.');
                return;
              }

              // 3. Deletar profile do usuário
              const { error: profileError } = await supabase
                .from('profiles')
                .delete()
                .eq('id', user.id);

              if (profileError) {
                console.error('Erro ao deletar perfil:', profileError);
                Alert.alert('Erro', 'Não foi possível deletar seu perfil. Tente novamente.');
                return;
              }

              // 4. Deletar usuário do auth.users usando Edge Function
              try {
                const { error: deleteError } = await supabase.functions.invoke('delete-user', {
                  method: 'POST',
                });

                if (deleteError) {
                  console.error('Erro ao deletar usuário do auth:', deleteError);
                  // Continua mesmo se falhar - o usuário já foi removido das tabelas principais
                }
              } catch (fnError) {
                console.error('Erro ao chamar função de exclusão:', fnError);
                // Continua mesmo se falhar - o usuário já foi removido das tabelas principais
              }

              // 5. Fazer logout
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
      <ScreenContainer 
        scroll={false} 
        backgroundColor="#FAFAFA" 
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E5102E" />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer 
      scroll={true}
      backgroundColor="#FAFAFA" 
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
            onPress={handleDeleteAccount}
            activeOpacity={0.7}
          >
            <IconDelete size={24} color="#000E3D" />
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
      <CustomButton
        title="Sair"
        variant="ghost"
        onPress={handleLogout}
        style={{ borderRadius: 24, width: '90%', maxWidth: 342, alignSelf: 'center' }}
      />
    </ScreenContainer>
  );
};

export default SettingsScreen;

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
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
});
