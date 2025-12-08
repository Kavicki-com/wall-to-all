import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import {
  LogoWallToAll,
  LogoWallToAllTypography,
  GoogleLogo,
} from '../../lib/assets';
import { IconAccountCircle, IconVisibilityOff } from '../../lib/icons';

const LoginScreen: React.FC = () => {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    console.log('LoginScreen mounted');
  }, []);

  const handleLogin = async () => {
    setError(null);
    setInfo(null);

    if (!email || !password) {
      setError('Preencha e-mail e senha.');
      return;
    }

    try {
      setLoading(true);

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        console.log('Erro login supabase', signInError);
        if (signInError.message.includes('Invalid login credentials')) {
          setError('E-mail ou senha inválidos.');
        } else {
          setError(signInError.message);
        }
        return;
      }

      // Se chegou aqui, o login foi bem-sucedido
      // O AuthContext vai detectar a mudança de sessão automaticamente
      // e o RootLayout vai redirecionar para a rota correta baseado no user_type
    } catch (e) {
      console.log('Erro inesperado login', e);
      setError('Ocorreu um erro ao entrar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoToSignup = () => {
    // Fluxo de registro começa na seleção de tipo de usuário
    router.push('/(auth)/user-type-selection');
  };

  const handleForgotPasswordPress = async () => {
    if (!email) {
      setError('Informe seu e-mail para recuperar a senha.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setInfo(null);

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: 'walltoall://auth/login',
        },
      );

      if (resetError) {
        setError(resetError.message);
        return;
      }

      setInfo('Enviamos um link de recuperação para o seu e-mail.');
    } catch (e) {
      console.log('Erro ao solicitar recuperação de senha', e);
      setError('Não foi possível enviar o link de recuperação. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleGooglePress = async () => {
    try {
      setError(null);
      setInfo(null);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'walltoall://auth/login',
        },
      });

      if (error) {
        setError(error.message);
      }
    } catch (e) {
      console.log('Erro login Google', e);
      setError('Ocorreu um erro ao entrar com o Google.');
    }
  };

  return (
    <View style={styles.background}>
      <LinearGradient
        colors={[
          'rgba(0,14,61,0.2)',
          'rgba(214,224,255,0.2)',
        ]}
        start={{ x: 0, y: 1 }}
        end={{ x: 0, y: 0 }}
        style={styles.container}
      >
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Logo em posição absoluta, seguindo coordenadas do Figma */}
          <View style={styles.logoContainer}>
            <LogoWallToAll width={66.4} height={40} />
            <LogoWallToAllTypography width={66.4} height={40} />
          </View>

          {/* Formulário posicionado como no Figma */}
          <View style={styles.formContainer}>
            {/* Usuário */}
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>Usuário</Text>
              <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="seu@email.com"
                placeholderTextColor="#0f0f0f"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                accessibilityLabel="Campo de e-mail"
                accessibilityHint="Digite seu endereço de e-mail para entrar"
              />
                <View style={styles.iconContainer}>
                  <IconAccountCircle width={20} height={20} />
                </View>
              </View>
            </View>

            {/* Senha */}
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>Senha</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="***********"
                  placeholderTextColor="#0f0f0f"
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                  accessibilityLabel="Campo de senha"
                  accessibilityHint="Digite sua senha"
                />
                <TouchableOpacity
                  style={styles.iconContainerPassword}
                  onPress={handleForgotPasswordPress}
                  accessibilityRole="button"
                  accessibilityLabel="Recuperar senha"
                  accessibilityHint="Toque para receber um link de recuperação no e-mail"
                >
                  <IconVisibilityOff width={20} height={20} />
                </TouchableOpacity>
              </View>
              <Text style={styles.forgotPassword}>Esqueceu sua senha?</Text>
            </View>

            {/* Mensagens de erro e info centralizadas abaixo do campo de senha */}
            {error && (
              <View style={styles.messageContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
            {info && !error && (
              <View style={styles.messageContainer}>
                <Text style={styles.infoText}>{info}</Text>
              </View>
            )}
          </View>

          {/* Ações: Entrar, Registrar, Google, posicionadas como no Figma */}
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={styles.buttonContained}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Entrar na conta"
              accessibilityHint="Toque para fazer login com e-mail e senha"
              accessibilityState={{ disabled: loading, busy: loading }}
            >
              {loading ? (
                <ActivityIndicator color="#FEFEFE" />
              ) : (
                <Text style={styles.buttonContainedText}>Entrar</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.buttonOutline}
              onPress={handleGoToSignup}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Criar nova conta"
              accessibilityHint="Toque para ir para a tela de cadastro"
            >
              <Text style={styles.buttonOutlineText}>Registrar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.buttonGoogle}
              onPress={handleGooglePress}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Continuar com Google"
              accessibilityHint="Toque para fazer login usando sua conta Google"
            >
              <View style={styles.googleButtonContent}>
                {/* Usa o SVG exportado do Figma em `assets/Google Logo.svg` */}
                <GoogleLogo width={24} height={24} />
                <Text style={styles.googleButtonText}>
                  Continue with Google
                </Text>
              </View>
            </TouchableOpacity>
          </View>
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
  container: {
    flex: 1,
  },
  // Logo absoluta
  logoContainer: {
    position: 'absolute',
    left: 151,
    top: 119.77,
    width: 88,
    height: 109.64,
    backgroundColor: '#FEFEFE',
    borderWidth: 2.702,
    borderColor: '#FEFEFE',
    borderRadius: 4.568,
    padding: 2,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Form absoluto
  formContainer: {
    position: 'absolute',
    left: 24,
    top: 339.5,
    width: 342,
    flexDirection: 'column',
  },
  inputWrapper: {
    width: 342,
    marginBottom: 23,
  },
  label: {
    fontSize: 12,
    fontFamily: 'Montserrat_700Bold',
    color: '#A8BDFF',
    marginBottom: 4,
  },
  inputContainer: {
    width: 342,
    backgroundColor: '#FEFEFE',
    borderWidth: 1,
    borderColor: '#474747',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Montserrat_400Regular',
    color: '#0f0f0f',
    padding: 0,
    margin: 0,
  },
  iconContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 2,
  },
  iconContainerPassword: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 1,
  },
  forgotPassword: {
    fontSize: 12,
    fontFamily: 'Montserrat_400Regular',
    color: '#FEFEFE',
    textAlign: 'right',
    width: 342,
    marginTop: 4,
  },
  messageContainer: {
    width: 342,
    marginTop: 12,
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
  // Ações absolutas
  actionsContainer: {
    position: 'absolute',
    left: 24,
    top: 629.5,
    width: 342,
    flexDirection: 'column',
  },
  buttonContained: {
    width: 342,
    height: 44,
    backgroundColor: '#E5102E',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonContainedText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    lineHeight: 16,
    color: '#FEFEFE',
    textAlign: 'center',
  },
  buttonOutline: {
    width: 342,
    height: 44,
    borderWidth: 1,
    borderColor: '#FEFEFE',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  buttonOutlineText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    lineHeight: 16,
    color: '#FEFEFE',
    textAlign: 'center',
  },
  buttonGoogle: {
    width: 342,
    height: 54,
    backgroundColor: '#FEFEFE',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  googleButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
  },
  googleButtonText: {
    fontFamily: 'Roboto_500Medium',
    fontSize: 16,
    color: '#474747',
    marginLeft: 8,
  },
});


