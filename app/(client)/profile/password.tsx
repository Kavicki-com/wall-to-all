import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Modal,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { IconCheckCircle } from '../../../lib/icons';
import { CustomInput } from '../../../components/ui/CustomInput';
import AppHeader from '../../../components/layout/AppHeader';
import ScreenContainer from '../../../components/layout/ScreenContainer';
import { CustomButton } from '../../../components/CustomButton';
import { safeGoBack } from '../../../lib/router-utils';
import { useToast } from '../../../components/ui/ToastProvider';
import { handleError } from '../../../lib/errorHandler';

const ChangePasswordScreen: React.FC = () => {
  const router = useRouter();
  const { showError, showSuccess } = useToast();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Resetar campos quando a tela é focada (quando volta de outras telas)
  useFocusEffect(
    React.useCallback(() => {
      setNewPassword('');
      setConfirmPassword('');
      setShowSuccessModal(false);
    }, [])
  );

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert('Erro', 'Preencha todos os campos.');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Erro', 'As senhas devem ser iguais.');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Erro', 'A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !user.email) {
        Alert.alert('Erro', 'Usuário não encontrado.');
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        const processed = handleError(updateError, 'profile');
        showError(processed.userMessage);
        return;
      }

      setShowSuccessModal(true);
      showSuccess('Senha alterada com sucesso');
    } catch (error) {
      const processed = handleError(error, 'profile');
      showError(processed.userMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer 
      scroll={true}
      hasHeader={true}
      hasTabBar={false}
      backgroundColor="#FAFAFA"
      footer={
        <View style={styles.footerContainer}>
          <CustomButton
            title="Alterar senha"
            onPress={handleChangePassword}
            isLoading={loading}
            disabled={loading}
            variant="primary"
            style={{ marginVertical: 0, borderRadius: 25 }}
            width="100%"
          />
        </View>
      }
      header={
        <AppHeader 
          title="Alterar senha"
          showBackButton={true}
          onPressBack={() => safeGoBack('/(client)/profile')}
        />
      }
    >
        {/* Welcome Note */}
        <View style={styles.welcomeNote}>
          <Text style={styles.welcomeTitle}>Escolha sua nova senha</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* New Password */}
          <CustomInput
            label="Senha"
            placeholder="Digite sua nova senha"
            isPassword
            value={newPassword}
            onChangeText={setNewPassword}
            containerStyle={styles.inputSection}
            helperText="Utilize letras, números e um caractere especial"
          />

          {/* Confirm Password */}
          <CustomInput
            label="Confirmar Senha"
            placeholder="Confirme sua nova senha"
            isPassword
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            containerStyle={styles.inputSection}
            helperText="As senhas devem ser iguais"
          />
        </View>

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <IconCheckCircle size={67} color="#17723F" />
            <Text style={styles.modalTitle}>Nova senha salva!</Text>
            <CustomButton
              title="Fechar"
              onPress={() => {
                setShowSuccessModal(false);
                safeGoBack('/(client)/profile');
              }}
              variant="primary"
              style={{ marginVertical: 0, borderRadius: 25 }}
              width="100%"
            />
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
};

export default ChangePasswordScreen;

const styles = StyleSheet.create({
  welcomeNote: {
    marginBottom: 24,
  },
  welcomeTitle: {
    fontSize: 20,
    fontFamily: 'Montserrat_700Bold',
    color: '#0F0F0F',
  },
  form: {
    width: '90%',
    maxWidth: 342,
    alignSelf: 'center',
    gap: 16,
  },
  inputSection: {
    gap: 4,
    marginBottom: 16,
  },
  helperText: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#0F0F0F',
  },
  footerContainer: {
    paddingTop: 16,
    backgroundColor: '#FAFAFA',
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#FEFEFE',
    borderRadius: 24,
    padding: 16,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    gap: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#17723F',
    textAlign: 'center',
  },
});
