import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/ToastProvider';
import { handleError } from '../../lib/errorHandler';
import {
  LogoWallToAll,
  LogoWallToAllTypography,
  GoogleLogo,
} from '../../lib/assets';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { processAuthTokensFromUrl } from '../../lib/useDeepLinking';
import { IconAccountCircle } from '../../lib/icons';
import { CustomInput } from '../../components/ui/CustomInput';
import { CustomButton } from '../../components/CustomButton';
import { useRateLimit } from '../../lib/hooks/useRateLimit';

WebBrowser.maybeCompleteAuthSession();

const LoginScreen: React.FC = () => {
  const router = useRouter();
  const { session } = useAuth();
  const { showError, showSuccess } = useToast();
  const { width, height } = useWindowDimensions();
  const horizontalPadding = width >= 768 ? 24 : 16;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Rate limiting: 5 tentativas por 15 minutos por email
  const rateLimitKey = email.toLowerCase().trim() || 'anonymous';
  const { canExecute, reset, getInfo } = useRateLimit(
    `login_${rateLimitKey}`,
    5, // máximo de 5 tentativas
    15 * 60 * 1000 // 15 minutos
  );

  useEffect(() => {
    if (session && loading) {
      setLoading(false);
    }
  }, [session, loading]);

  useFocusEffect(
    React.useCallback(() => {
      setEmail('');
      setPassword('');
      setError(null);
      setInfo(null);
    }, [])
  );

  const handleLogin = async () => {
    setError(null);
    setInfo(null);

    if (!email || !password) {
      setError('Preencha e-mail e senha.');
      return;
    }

    if (!isSupabaseConfigured) {
      setError('Erro de configuração.');
      return;
    }

    // Verificar rate limit antes de tentar login
    const canProceed = await canExecute();
    if (!canProceed) {
      const rateLimitInfo = await getInfo();
      if (rateLimitInfo?.isLimited) {
        const remainingMinutes = Math.ceil((rateLimitInfo.resetAt - Date.now()) / 60000);
        const errorMessage = `Muitas tentativas de login. Aguarde ${remainingMinutes} minuto(s) antes de tentar novamente.`;
        setError(errorMessage);
        showError(errorMessage);
        return;
      }
    }

    try {
      setLoading(true);
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        const processed = handleError(signInError, 'login');
        setError(processed.userMessage);
        showError(processed.userMessage);
        setLoading(false);
        return;
      }

      // Login bem-sucedido: resetar rate limit
      await reset();
    } catch (e) {
      const processed = handleError(e, 'login');
      setError(processed.userMessage);
      showError(processed.userMessage);
      setLoading(false);
    }
  };

  const handleGoToSignup = () => {
    router.push('/(auth)/user-type-selection');
  };

  const handleForgotPasswordPress = () => {
    router.push('/(auth)/forgot-password');
  };

  const handleGooglePress = async () => {
    if (googleLoading || loading) {
      return;
    }

    setError(null);
    setInfo(null);

    if (!isSupabaseConfigured) {
      setError('Erro de configuração.');
      showError('Erro de configuração.');
      return;
    }

    try {
      setGoogleLoading(true);
      // Usa o scheme diretamente como string (mesmo padrão usado em reset-password)
      const redirectTo = 'walltoall://auth/callback';
const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });
if (oauthError) {
        const processed = handleError(oauthError, 'auth');
        setError(processed.userMessage);
        showError(processed.userMessage);
        return;
      }

      if (!data?.url) {
        const message = 'Não foi possível iniciar o login com Google.';
        setError(message);
        showError(message);
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

      if (result.type === 'success' && result.url) {
        try {
          const success = await processAuthTokensFromUrl(result.url);
          
          if (success) {
            // Mostrar feedback de sucesso
            showSuccess('Conta Google conectada com sucesso!');
            setInfo('Complete seu cadastro para acessar o app.');
            
            if (__DEV__) {
}
          } else {
            const message = 'Não foi possível conectar com Google.';
            setError(message);
            showError(message);
          }
        } catch (error) {
          const processed = handleError(error, 'auth');
          setError(processed.userMessage);
          showError(processed.userMessage);
        }
      } else if (result.type === 'cancel' || result.type === 'dismiss') {
        setInfo('Login com Google cancelado.');
      }
    } catch (e) {
      const processed = handleError(e, 'auth');
      setError(processed.userMessage);
      showError(processed.userMessage);
    } finally {
      setGoogleLoading(false);
    }
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

                <View style={styles.inputsWrapper}>
                  <CustomInput
                    label="Usuário"
                    placeholder="seu@email.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={setEmail}
                    rightIcon={<IconAccountCircle width={20} height={20} />}
                    labelStyle={styles.label}
                    containerStyle={{ marginBottom: 0 }}
                  />

                  <View>
                    <CustomInput
                      label="Senha"
                      placeholder="***********"
                      isPassword
                      value={password}
                      onChangeText={setPassword}
                      labelStyle={styles.label}
                      containerStyle={{ marginBottom: 4 }}
                    />
                    <TouchableOpacity 
                      onPress={handleForgotPasswordPress} 
                      activeOpacity={0.7} 
                      style={styles.forgotPasswordButton}
                    >
                      <Text style={styles.forgotPasswordText}>
                        Esqueceu sua senha?
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {(error || info) && (
                  <View style={styles.messageContainer}>
                    <Text style={error ? styles.errorText : styles.infoText}>
                      {error || info}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.bottomSection}>
                <CustomButton
                  title="Entrar"
                  onPress={handleLogin}
                  isLoading={loading}
                  disabled={loading}
                  variant="red" 
                  width="100%"
                  style={styles.buttonSpacing}
                />

                <CustomButton
                  title="Registrar"
                  onPress={handleGoToSignup}
                  variant="outline-white"
                  width="100%"
                  style={styles.buttonSpacing}
                />

                <CustomButton
                  title="Continue with Google"
                  onPress={handleGooglePress}
                  leftIcon={<GoogleLogo width={24} height={24} />}
                  variant="outline"
                  width="100%"
                  style={[styles.googleButtonOverride, styles.buttonSpacing]}
                  textStyle={styles.googleButtonText}
                  isLoading={googleLoading}
                  disabled={googleLoading || loading}
                />
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </View>
  );
};

export default LoginScreen;

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
  inputsWrapper: {
    width: '100%',
    gap: 20,
  },
  label: {
    fontSize: 12,
    fontFamily: 'Montserrat_700Bold',
    color: '#A8BDFF',
    marginBottom: 4,
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginTop: 8,
  },
  forgotPasswordText: {
    fontSize: 12,
    fontFamily: 'Montserrat_400Regular',
    color: '#FEFEFE',
  },
  messageContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
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
  googleButtonOverride: {
    backgroundColor: '#FEFEFE',
    borderColor: '#FEFEFE',
    borderRadius: 8,
  },
  googleButtonText: {
    color: '#4A4A4A',
  },
});