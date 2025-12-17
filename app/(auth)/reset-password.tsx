import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { useToast } from '../../components/ui/ToastProvider';
import { handleError } from '../../lib/errorHandler';
import {
  LogoWallToAll,
  LogoWallToAllTypography,
} from '../../lib/assets';
import { CustomInput } from '../../components/ui/CustomInput';
import { CustomButton } from '../../components/CustomButton';

const ResetPasswordScreen: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { showError, showSuccess } = useToast();
  const { width } = useWindowDimensions();
  const horizontalPadding = width >= 768 ? 24 : 16;

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(true);

  useEffect(() => {
    // Verifica se há parâmetros de reset no URL (vindos do deep link)
    const checkResetParams = async () => {
      if (!isSupabaseConfigured) {
        setError('Erro de configuração.');
        setIsValidating(false);
        return;
      }

      // O Supabase automaticamente processa os parâmetros do link quando o app abre
      // Verificamos se há uma sessão válida de reset
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        // Se não há sessão, pode ser que o link ainda não foi processado
        // ou o token expirou
        if (!session) {
          setError('Link inválido ou expirado. Solicite um novo link de recuperação.');
          setIsValidating(false);
          return;
        }

        setIsValidating(false);
      } catch (e) {
        const processed = handleError(e, 'auth');
        setError(processed.userMessage);
        setIsValidating(false);
      }
    };

    checkResetParams();
  }, [params]);

  const handleResetPassword = async () => {
    setError(null);

    if (!newPassword || !confirmPassword) {
      setError('Preencha todos os campos.');
      showError('Preencha todos os campos.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('As senhas devem ser iguais.');
      showError('As senhas devem ser iguais.');
      return;
    }

    if (newPassword.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      showError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (!isSupabaseConfigured) {
      setError('Erro de configuração.');
      showError('Erro de configuração.');
      return;
    }

    try {
      setLoading(true);
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        const processed = handleError(updateError, 'auth');
        setError(processed.userMessage);
        showError(processed.userMessage);
        setLoading(false);
        return;
      }

      // Sucesso
      showSuccess('Senha alterada com sucesso!');
      
      // Redireciona para login após 1 segundo
      setTimeout(() => {
        router.replace('/(auth)/login');
      }, 1000);
    } catch (e) {
      const processed = handleError(e, 'auth');
      setError(processed.userMessage);
      showError(processed.userMessage);
      setLoading(false);
    }
  };

  const handleGoToLogin = () => {
    router.replace('/(auth)/login');
  };

  if (isValidating) {
    return (
      <View style={styles.background}>
        <LinearGradient
          colors={['rgba(0,14,61,0.2)', 'rgba(214,224,255,0.2)']}
          start={{ x: 0, y: 1 }}
          end={{ x: 0, y: 0 }}
          style={styles.gradient}
        >
          <View style={styles.centeredContainer}>
            <Text style={styles.loadingText}>Validando link...</Text>
          </View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.background}>
      <LinearGradient
        colors={['rgba(0,14,61,0.2)', 'rgba(214,224,255,0.2)']}
        start={{ x: 0, y: 1 }}
        end={{ x: 0, y: 0 }}
        style={styles.gradient}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <KeyboardAvoidingView
            style={styles.keyboardContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            {/* Logo */}
            <View style={styles.logoContainer}>
              <LogoWallToAll width={66.4} height={40} />
              <LogoWallToAllTypography width={66.4} height={40} />
            </View>

            {/* Container */}
            <View style={[styles.contentContainer, { paddingHorizontal: horizontalPadding }]}>
              <Text style={styles.title}>Redefinir Senha</Text>
              <Text style={styles.subtitle}>Digite sua nova senha</Text>

              {/* Formulário */}
              <View style={styles.inputsWrapper}>
                <CustomInput
                  label="Nova Senha"
                  placeholder="***********"
                  isPassword
                  value={newPassword}
                  onChangeText={setNewPassword}
                  labelStyle={styles.label}
                  containerStyle={{ marginBottom: 0 }}
                />

                <CustomInput
                  label="Confirmar Senha"
                  placeholder="***********"
                  isPassword
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  labelStyle={styles.label}
                  containerStyle={{ marginBottom: 4 }}
                />
              </View>

              {error && (
                <View style={styles.messageContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              {/* Botões */}
              <View style={styles.actionsContainer}>
                <CustomButton
                  title="Redefinir Senha"
                  onPress={handleResetPassword}
                  isLoading={loading}
                  disabled={loading}
                  variant="red"
                  width="100%"
                  style={styles.buttonSpacing}
                />

                <CustomButton
                  title="Voltar ao Login"
                  onPress={handleGoToLogin}
                  variant="outline-white"
                  width="100%"
                  style={styles.buttonSpacing}
                />
              </View>
            </View>
          </KeyboardAvoidingView>
        </ScrollView>
      </LinearGradient>
    </View>
  );
};

export default ResetPasswordScreen;

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: '#000E3D',
  },
  gradient: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  keyboardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
    gap: 32,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FEFEFE',
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
  },
  logoContainer: {
    width: 88,
    height: 109.64,
    backgroundColor: '#FEFEFE',
    borderWidth: 2.7,
    borderColor: '#FEFEFE',
    borderRadius: 4.5,
    padding: 2,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 24,
  },
  contentContainer: {
    width: '100%',
    gap: 24,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Montserrat_700Bold',
    color: '#FEFEFE',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Montserrat_400Regular',
    color: '#A8BDFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  inputsWrapper: {
    gap: 20,
  },
  label: {
    fontSize: 12,
    fontFamily: 'Montserrat_700Bold',
    color: '#A8BDFF',
    marginBottom: 4,
  },
  messageContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    color: '#E5102E',
    fontSize: 14,
    fontFamily: 'Montserrat_400Regular',
    textAlign: 'center',
  },
  actionsContainer: {
    width: '100%',
    gap: 16,
    marginTop: 8,
  },
  buttonSpacing: {
    marginVertical: 0,
  },
});

