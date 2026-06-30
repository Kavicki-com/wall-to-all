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
import { logger } from '../../../lib/logger';
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
import { useToast } from '../../../components/ui/ToastProvider';
import { colors } from '../../../lib/theme';

const SettingsScreen: React.FC = () => {
  const router = useRouter();
  const { profile, loading } = useProfile();
  const { showError, showSuccess, showInfo } = useToast();

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
                showError('Usuário não autenticado.');
                return;
              }

              // 1. Deletar agendamentos do cliente
              const { error: appointmentsError } = await supabase
                .from('appointments')
                .delete()
                .eq('client_id', user.id);

              if (appointmentsError) {
                logger.error('Erro ao deletar agendamentos:', appointmentsError);
                showError('Não foi possível deletar seus agendamentos. Tente novamente.');
                return;
              }

              // 2. Deletar avaliações do cliente
              const { error: reviewsError } = await supabase
                .from('reviews')
                .delete()
                .eq('client_id', user.id);

              if (reviewsError) {
                logger.error('Erro ao deletar avaliações:', reviewsError);
                showError('Não foi possível deletar suas avaliações. Tente novamente.');
                return;
              }

              // 3. Deletar profile do usuário
              const { error: profileError } = await supabase
                .from('profiles')
                .delete()
                .eq('id', user.id);

              if (profileError) {
                logger.error('Erro ao deletar perfil:', profileError);
                showError('Não foi possível deletar seu perfil. Tente novamente.');
                return;
              }

              // 4. Deletar usuário do auth.users usando Edge Function
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

              // 5. Fazer logout
              await supabase.auth.signOut();

              showSuccess('Sua conta foi excluída com sucesso.');
              router.replace('/(auth)/login');
            } catch (error) {
              console.error('Erro ao excluir conta:', error);
              showError('Ocorreu um erro ao excluir sua conta. Por favor, tente novamente.');
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <ScreenContainer scroll={false} backgroundColor={colors.background}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer
      scroll={true}
      backgroundColor={colors.background}
      footer={
        <CustomButton
          title="Sair"
          variant="ghost"
          onPress={handleLogout}
          style={styles.logoutButton}
        />
      }
    >
      <View style={styles.contentColumn}>
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
              <IconAccount size={24} color={colors.brand} />
              <Text style={styles.optionText}>Editar Perfil</Text>
              <View style={styles.chevronContainer}>
                <MaterialIcons name="chevron-right" size={18} color={colors.brand} />
              </View>
            </TouchableOpacity>

            {/* Alterar Senha */}
            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => router.push('/(client)/profile/password')}
              activeOpacity={0.7}
            >
              <IconLock size={24} color={colors.brand} />
              <Text style={styles.optionText}>Alterar Senha</Text>
              <View style={styles.chevronContainer}>
                <MaterialIcons name="chevron-right" size={18} color={colors.brand} />
              </View>
            </TouchableOpacity>

            {/* Excluir Conta */}
            <TouchableOpacity
              style={styles.optionItem}
              onPress={handleDeleteAccount}
              activeOpacity={0.7}
            >
              <IconDelete size={24} color={colors.brand} />
              <Text style={styles.optionText}>Excluir Conta</Text>
              <View style={styles.chevronContainer}>
                <MaterialIcons name="chevron-right" size={18} color={colors.brand} />
              </View>
            </TouchableOpacity>

            {/* Suporte */}
            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => {
                showInfo('Entre em contato pelo e-mail: suporte@walltoall.com');
              }}
              activeOpacity={0.7}
            >
              <IconSupport size={24} color={colors.brand} />
              <Text style={styles.optionText}>Suporte</Text>
              <View style={styles.chevronContainer}>
                <MaterialIcons name="chevron-right" size={18} color={colors.brand} />
              </View>
            </TouchableOpacity>

            {/* Termos de uso */}
            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => router.push('/(client)/settings/terms')}
              activeOpacity={0.7}
            >
              <IconDocs size={24} color={colors.brand} />
              <Text style={styles.optionText}>Termos de uso</Text>
              <View style={styles.chevronContainer}>
                <MaterialIcons name="chevron-right" size={18} color={colors.brand} />
              </View>
            </TouchableOpacity>

            {/* Política de Privacidade */}
            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => router.push('/(client)/settings/privacy')}
              activeOpacity={0.7}
            >
              <IconDocs size={24} color={colors.brand} />
              <Text style={styles.optionText}>Política de Privacidade</Text>
              <View style={styles.chevronContainer}>
                <MaterialIcons name="chevron-right" size={18} color={colors.brand} />
              </View>
            </TouchableOpacity>

            {/* FAQ */}
            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => router.push('/(client)/settings/faq')}
              activeOpacity={0.7}
            >
              <IconHelp size={24} color={colors.brand} />
              <Text style={styles.optionText}>FAQ</Text>
              <View style={styles.chevronContainer}>
                <MaterialIcons name="chevron-right" size={18} color={colors.brand} />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
};

export default SettingsScreen;

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  contentColumn: {
    width: '100%',
    maxWidth: 342,
    alignSelf: 'center',
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
    color: colors.textPrimary,
    textAlign: 'center',
  },
  profileSince: {
    fontSize: 8,
    fontFamily: 'Montserrat_500Medium',
    color: colors.textPrimary,
  },
  optionsContainer: {
    marginBottom: 32,
  },
  optionsList: {
    gap: 12,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
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
    color: colors.brand,
  },
  chevronContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingRight: 4,
  },
  logoutButton: {
    width: '100%',
    maxWidth: 342,
    alignSelf: 'center',
    borderRadius: 24,
    marginBottom: 12,
  },
});
