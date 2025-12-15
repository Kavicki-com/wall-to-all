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
import { IconAccountCircle } from '../../lib/icons';
import { CustomInput } from '../../components/ui/CustomInput';
import { CustomButton } from '../../components/CustomButton';

const LoginScreen: React.FC = () => {
  const router = useRouter();
  const { session } = useAuth();
  const { showError } = useToast();
  const { width } = useWindowDimensions();
  const horizontalPadding = width >= 768 ? 24 : 16;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

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

  const handleForgotPasswordPress = async () => {
    if (!email) {
      setError('Informe seu e-mail.');
      return;
    }
    // Lógica de recuperação...
  };

  const handleGooglePress = async () => {
    // Lógica do Google...
  };

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

            {/* Container Mestre: Largura fluida com padding responsivo */}
            <View style={[styles.contentContainer, { paddingHorizontal: horizontalPadding }]}>
              
              {/* Formulário */}
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
                  <TouchableOpacity onPress={handleForgotPasswordPress} activeOpacity={0.7} style={styles.forgotPasswordButton}>
                    <Text style={styles.forgotPasswordText}>Esqueceu sua senha?</Text>
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

              {/* Ações: Aqui garantimos o comprimento igual */}
              <View style={styles.actionsContainer}>
                
                {/* 1. Entrar: VERMELHO e LARGURA TOTAL */}
                <CustomButton
                  title="Entrar"
                  onPress={handleLogin}
                  isLoading={loading}
                  disabled={loading}
                  variant="red" 
                  width="100%"
                  style={styles.buttonSpacing}
                />

                {/* 2. Registrar: LARGURA TOTAL */}
                <CustomButton
                  title="Registrar"
                  onPress={handleGoToSignup}
                  variant="outline-white"
                  width="100%"
                  style={styles.buttonSpacing}
                />

                {/* 3. Google: LARGURA TOTAL */}
                <CustomButton
                  title="Continue with Google"
                  onPress={handleGooglePress}
                  leftIcon={<GoogleLogo width={24} height={24} />}
                  variant="outline"
                  width="100%"
                  style={[styles.googleButtonOverride, styles.buttonSpacing]}
                  textStyle={styles.googleButtonText}
                />
              </View>
            </View>
          </KeyboardAvoidingView>
        </ScrollView>
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
    justifyContent: 'center',
  },
  keyboardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
    gap: 32,
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
  contentContainer: {
    width: '100%',
    gap: 24,
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
  actionsContainer: {
    width: '100%',
    gap: 16,
    marginTop: 8,
  },
  buttonSpacing: {
    marginVertical: 0,
  },
  googleButtonOverride: {
    backgroundColor: '#FEFEFE',
    borderColor: '#FEFEFE',
  },
  googleButtonText: {
    color: '#4A4A4A',
  },
});