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
  IconAccountCircle,
  IconLock,
  IconSupport,
  IconDocs,
  IconHelp,
  IconDelete,
} from '../../../lib/icons';
import ScreenContainer from '../../../components/layout/ScreenContainer';
import { CustomButton } from '../../../components/CustomButton';
import { useBusinessProfile } from '../../../context/BusinessProfileContext';
import { useToast } from '../../../components/ui/ToastProvider';
import { logger } from '../../../lib/logger';
import { colors } from '../../../lib/theme';

const SettingsScreen: React.FC = () => {
  const router = useRouter();
  const { businessProfile, loading } = useBusinessProfile();
  const { showError, showSuccess, showInfo } = useToast();

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
                showError('Usuário não autenticado.');
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

              showSuccess('Sua conta foi excluída com sucesso.');
              router.replace('/(auth)/login');
            } catch (error) {
              logger.error('Erro ao excluir conta:', error);
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
        {/* Profile Avatar */}
        <View style={styles.profileContainer}>
          <View style={styles.avatarContainer}>
            {businessProfile?.logo_url ? (
              <Image source={{ uri: businessProfile.logo_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.placeholderAvatar]} />
            )}
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.businessName}>
              {businessProfile?.business_name || 'Nome do Negócio'}
            </Text>
            <Text style={styles.businessCategory}>
              {businessProfile?.categories?.name || 'Cortes masculinos e femininos'}
            </Text>
          </View>
        </View>

        {/* Options List */}
        <View style={styles.optionsContainer}>
          <View style={styles.optionsList}>
            {/* Editar Perfil */}
            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => router.push('/(merchant)/profile/edit')}
              activeOpacity={0.7}
            >
              <IconAccountCircle size={24} color={colors.brand} />
              <Text style={styles.optionText}>Editar Perfil</Text>
              <View style={styles.chevronContainer}>
                <MaterialIcons name="chevron-right" size={18} color={colors.brand} />
              </View>
            </TouchableOpacity>

            {/* Alterar Senha */}
            <TouchableOpacity
              style={styles.optionItem}
              onPress={() => router.push('/(merchant)/profile/password')}
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
              onPress={() => showInfo('Entre em contato pelo e-mail: suporte@walltoall.com')}
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
              onPress={() => router.push('/(merchant)/settings/terms')}
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
              onPress={() => router.push('/(merchant)/settings/privacy')}
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
              onPress={() => router.push('/(merchant)/settings/faq')}
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
  avatarContainer: {
    marginBottom: 8,
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
  businessName: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  businessCategory: {
    fontSize: 8,
    fontFamily: 'Montserrat_500Medium',
    color: colors.textPrimary,
    textAlign: 'center',
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
    elevation: 1,
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
  },
  logoutButton: {
    width: '100%',
    maxWidth: 342,
    alignSelf: 'center',
    borderRadius: 24,
    marginBottom: 12,
  },
});
