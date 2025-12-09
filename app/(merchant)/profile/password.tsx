import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { IconBack, IconNotification, IconVisibilityOff, IconCheckCircle } from '../../../lib/icons';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { responsiveWidth, useResponsiveHeight } from '../../../lib/responsive';

const ChangePasswordScreen: React.FC = () => {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const topBarHeight = useResponsiveHeight(56); // Altura responsiva do header SVG (viewBox="0 0 410 56")

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
        console.error('Erro ao atualizar senha:', updateError);
        Alert.alert('Erro', 'Não foi possível atualizar a senha.');
        return;
      }

      setShowSuccessModal(true);
    } catch (error) {
      console.error('Erro ao alterar senha:', error);
      Alert.alert('Erro', 'Ocorreu um erro ao alterar a senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Bar with Gradient */}
      <View style={styles.topBarContainer}>
        <View style={styles.topBarDivider} />
        <View style={styles.topBarContent}>
          <View style={styles.topBarGradientContainer}>
            <Svg style={[StyleSheet.absoluteFill, { height: topBarHeight }]} viewBox="0 0 410 56" preserveAspectRatio="none">
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
              style={StyleSheet.absoluteFillObject}
            />
            <LinearGradient
              colors={['rgba(0, 14, 61, 1)', 'rgba(0, 14, 61, 1)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={styles.topBarInner}>
              <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                <IconBack size={24} color="#FEFEFE" />
              </TouchableOpacity>
              <Text style={styles.topBarTitle}>Alterar senha</Text>
              <TouchableOpacity style={styles.notificationButton}>
                <IconNotification size={24} color="#FEFEFE" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      {/* Welcome Note */}
      <View style={styles.welcomeNote}>
        <Text style={styles.welcomeTitle}>Escolha sua nova senha</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* New Password */}
        <View style={styles.field}>
          <Text style={styles.label}>Senha</Text>
          <View style={styles.passwordInputContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder=" "
              placeholderTextColor="#0F0F0F"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry={!showNewPassword}
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowNewPassword(!showNewPassword)}
            >
              <IconVisibilityOff size={24} color="#0F0F0F" />
            </TouchableOpacity>
          </View>
          <Text style={styles.helperText}>Utilize letras, números e um caractere especial</Text>
        </View>

        {/* Confirm Password */}
        <View style={styles.field}>
          <Text style={styles.label}>Confirmar Senha</Text>
          <View style={styles.passwordInputContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder=" "
              placeholderTextColor="#0F0F0F"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirmPassword}
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              <IconVisibilityOff size={24} color="#0F0F0F" />
            </TouchableOpacity>
          </View>
          <Text style={styles.helperText}>As senhas devem ser iguais</Text>
        </View>
      </ScrollView>

      {/* Change Password Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.changePasswordButton, loading && styles.changePasswordButtonDisabled]}
          onPress={handleChangePassword}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FEFEFE" />
          ) : (
            <Text style={styles.changePasswordButtonText}>Alterar senha</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowSuccessModal(false);
          router.back();
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.successModalContent}>
            <IconCheckCircle size={67} color="#17723F" />
            <Text style={styles.successModalTitle}>Nova senha salva!</Text>
            <TouchableOpacity
              style={styles.successModalButton}
              onPress={() => {
                setShowSuccessModal(false);
                router.back();
              }}
            >
              <Text style={styles.successModalButtonText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default ChangePasswordScreen;

// Calcular largura responsiva para footer absoluto
const footerWidth = responsiveWidth(342);
const footerTransformX = -footerWidth / 2;

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  welcomeNote: {
    paddingHorizontal: 24,
    paddingTop: 0,
    paddingBottom: 0,
  },
  welcomeTitle: {
    fontSize: 20,
    fontFamily: 'Montserrat_700Bold',
    color: '#0F0F0F',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 24,
    paddingBottom: 100,
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
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEFEFE',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#474747',
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  passwordInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#0F0F0F',
  },
  eyeButton: {
    padding: 1,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  helperText: {
    fontSize: 12,
    fontFamily: 'Montserrat_500Medium',
    color: '#0F0F0F',
    marginTop: 4,
  },
  footer: {
    position: 'absolute',
    bottom: 32,
    left: '50%',
    transform: [{ translateX: footerTransformX }],
    width: footerWidth,
  },
  changePasswordButton: {
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
  changePasswordButtonDisabled: {
    opacity: 0.6,
  },
  changePasswordButtonText: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#FEFEFE',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successModalContent: {
    backgroundColor: '#FEFEFE',
    borderRadius: 24,
    padding: 16,
    alignItems: 'center',
    width: '100%',
    maxWidth: 342,
    gap: 16,
  },
  successModalTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#17723F',
    textAlign: 'center',
  },
  successModalButton: {
    width: 256,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 24,
    alignItems: 'center',
  },
  successModalButtonText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: '#000E3D',
  },
});
