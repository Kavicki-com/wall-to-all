import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useWindowDimensions,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { useToast } from '../../components/ui/ToastProvider';
import { handleError } from '../../lib/errorHandler';
import {
  LogoWallToAll,
  LogoWallToAllTypography,
} from '../../lib/assets';
import { CustomInput } from '../../components/ui/CustomInput';
import { CustomButton } from '../../components/CustomButton';
import { IconAccountCircle } from '../../lib/icons';

const ForgotPasswordScreen: React.FC = () => {
  const router = useRouter();
  const { showError, showSuccess } = useToast();
  const { width, height } = useWindowDimensions();
  const horizontalPadding = width >= 768 ? 24 : 16;

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const handleSendRecoveryEmail = async () => {
    setError(null);
    setInfo(null);

    if (!email) {
      setError('Informe seu e-mail.');
      showError('Informe seu e-mail.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('E-mail inválido. Verifique o formato.');
      showError('E-mail inválido. Verifique o formato.');
      return;
    }

    if (!isSupabaseConfigured) {
      setError('Erro de configuração.');
      showError('Erro de configuração.');
      return;
    }

    try {
      setLoading(true);
      const redirectUrl = 'walltoall://reset-password';
      
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (resetError) {
        const processed = handleError(resetError, 'auth');
        setError(processed.userMessage);
        showError(processed.userMessage);
        setLoading(false);
        return;
      }

      const successMessage = 'E-mail de recuperação enviado! Verifique sua caixa de entrada.';
      setInfo(successMessage);
      showSuccess(successMessage);
      setLoading(false);
      
      // Limpa o campo de email após envio bem-sucedido
      setEmail('');
    } catch (e) {
      const processed = handleError(e, 'auth');
      setError(processed.userMessage);
      showError(processed.userMessage);
      setLoading(false);
    }
  };

  const handleGoToLogin = () => {
    router.back();
  };

  return (
    <View style={styles.background}>
      <LinearGradient
        colors={['rgba(0,14,61,0.2)', 'rgba(214,224,255,0.2)']}
        start={{ x: 0, y: 1 }}
        end={{ x: 0, y: 0 }}
        style={styles.gradient}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={[
              styles.mainContainer, 
              { 
                paddingHorizontal: horizontalPadding,
                minHeight: height * 0.9 
              }
            ]}>
              <View style={styles.topSection}>
                <View style={styles.logoContainer}>
                  <LogoWallToAll width={66.4} height={40} />
                  <LogoWallToAllTypography width={66.4} height={40} />
                </View>

                <View style={styles.contentWrapper}>
                  <Text style={styles.title}>Recuperar Senha</Text>
                  <Text style={styles.subtitle}>
                    Informe seu e-mail para receber o link de recuperação
                  </Text>

                  <View style={styles.inputWrapper}>
                    <CustomInput
                      label="E-mail"
                      placeholder="seu@email.com"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      value={email}
                      onChangeText={setEmail}
                      rightIcon={<IconAccountCircle width={20} height={20} />}
                      labelStyle={styles.label}
                      containerStyle={{ marginBottom: 0 }}
                    />
                  </View>

                  {(error || info) && (
                    <View style={styles.messageContainer}>
                      <Text style={error ? styles.errorText : styles.infoText}>
                        {error || info}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.bottomSection}>
                <CustomButton
                  title="Enviar"
                  onPress={handleSendRecoveryEmail}
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
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </View>
  );
};

export default ForgotPasswordScreen;

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
  },
  mainContainer: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 32,
  },
  topSection: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 32,
  },
  bottomSection: {
    width: '100%',
    gap: 16,
    marginBottom: 16,
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
  },
  contentWrapper: {
    width: '100%',
    alignItems: 'center',
    gap: 20,
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
    paddingHorizontal: 16,
  },
  inputWrapper: {
    width: '100%',
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
    marginTop: 8,
  },
  errorText: {
    color: '#E5102E',
    fontSize: 14,
    fontFamily: 'Montserrat_400Regular',
    textAlign: 'center',
  },
  infoText: {
    color: '#BBF7D0',
    fontSize: 14,
    fontFamily: 'Montserrat_400Regular',
    textAlign: 'center',
  },
  buttonSpacing: {
    marginVertical: 0,
  },
});

