import React, { useState, useEffect, useRef } from 'react';
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
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { useToast } from '../../components/ui/ToastProvider';
import { handleError } from '../../lib/errorHandler';
import { processAuthTokensFromUrl, setIsRecoverySession } from '../../lib/useDeepLinking';
import {
  LogoWallToAll,
  LogoWallToAllTypography,
} from '../../lib/assets';
import { CustomInput } from '../../components/ui/CustomInput';
import { CustomButton } from '../../components/CustomButton';

const ResetPasswordScreen: React.FC = () => {
  const router = useRouter();
  const { showError, showSuccess } = useToast();
  const { width } = useWindowDimensions();
  const horizontalPadding = width >= 768 ? 24 : 16;
  const hasProcessedRef = useRef(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(true);

  useEffect(() => {
    // Evita processamento duplicado
    if (hasProcessedRef.current) return;
    hasProcessedRef.current = true;

    const processUrl = async (url: string | null) => {
      if (!isSupabaseConfigured) {
        setError('Erro de configuração.');
        setIsValidating(false);
        return false;
      }

      if (!url) return false;

      try {
        console.log('[ResetPassword] Processando URL:', url);

        // Se há uma URL com tokens, processa ela
        if (url.includes('#')) {
          console.log('[ResetPassword] Processando tokens da URL...');
          const success = await processAuthTokensFromUrl(url);
          
          if (success) {
            console.log('[ResetPassword] Tokens processados com sucesso!');
            setIsValidating(false);
            return true;
          }
        }
      } catch (e) {
        console.error('[ResetPassword] Erro ao processar URL:', e);
      }

      return false;
    };

    const processDeepLinkAndValidate = async () => {
      if (!isSupabaseConfigured) {
        setError('Erro de configuração.');
        setIsValidating(false);
        return;
      }

      try {
        // Primeiro, tenta pegar a URL inicial (deep link que abriu o app - cold start)
        const initialUrl = await Linking.getInitialURL();
        console.log('[ResetPassword] URL inicial (getInitialURL):', initialUrl);

        // Se há uma URL com tokens, processa ela
        if (await processUrl(initialUrl)) {
          return;
        }

        // Se não processou tokens da URL, verifica se já há uma sessão válida
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          console.log('[ResetPassword] Sessão existente encontrada');
          setIsValidating(false);
          return;
        }

        // Sem sessão e sem tokens válidos
        setError('Link inválido ou expirado. Solicite um novo link de recuperação.');
        setIsValidating(false);
      } catch (e) {
        console.error('[ResetPassword] Erro:', e);
        const processed = handleError(e, 'auth');
        setError(processed.userMessage);
        setIsValidating(false);
      }
    };

    // Processa deep link inicial (cold start)
    processDeepLinkAndValidate();

    // Listener para deep links quando o app já está aberto
    const subscription = Linking.addEventListener('url', (event) => {
      console.log('[ResetPassword] Deep link recebido (app aberto):', event.url);
      if (event.url && event.url.includes('reset-password')) {
        processUrl(event.url);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

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
      
      // Verifica se há sessão antes de tentar alterar a senha
      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
      console.log('[ResetPassword] Verificando sessão antes de alterar:', {
        hasSession: !!currentSession,
        userEmail: currentSession?.user?.email,
        sessionError: sessionError?.message,
      });
      
      if (!currentSession) {
        const errorMsg = sessionError?.message || 'Sessão expirada. Solicite um novo link de recuperação.';
        setError(errorMsg);
        showError(errorMsg);
        setLoading(false);
        return;
      }

      console.log('[ResetPassword] Tentando alterar senha...');
      const { data, error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      console.log('[ResetPassword] Resultado updateUser:', {
        hasData: !!data,
        hasUser: !!data?.user,
        updateError: updateError?.message,
      });

      if (updateError) {
        console.error('[ResetPassword] Erro ao alterar senha:', updateError);
        const processed = handleError(updateError, 'auth');
        setError(processed.userMessage);
        showError(processed.userMessage);
        setLoading(false);
        return;
      }

      // Verifica se realmente alterou (data deve ter user)
      if (!data?.user) {
        console.error('[ResetPassword] updateUser retornou sem user!');
        setError('Erro ao alterar senha. Tente novamente.');
        showError('Erro ao alterar senha. Tente novamente.');
        setLoading(false);
        return;
      }

      console.log('[ResetPassword] Senha alterada com sucesso!');
      // Sucesso - senha alterada
      showSuccess('Senha alterada com sucesso!');
      setLoading(false);
      
      // Limpa a flag de sessão de recuperação
      setIsRecoverySession(false);
      
      // Faz signOut para limpar a sessão de recuperação
      // O Supabase já invalida a sessão de recuperação ao alterar a senha, mas fazemos signOut para garantir
      try {
        await supabase.auth.signOut();
      } catch (error) {
        console.warn('[ResetPassword] Erro ao fazer signOut (ignorado):', error);
      }
      
      // Redireciona imediatamente para login
      router.replace('/(auth)/login');
    } catch (e: any) {
      console.error('[ResetPassword] Exceção ao alterar senha:', e);
      // Se o erro é "Auth session missing", significa que não há sessão válida
      // NÃO assumimos que a senha foi alterada - mostramos erro
      const errorMessage = e?.message || String(e);
      if (errorMessage.includes('Auth session missing') || errorMessage.includes('session missing')) {
        setError('Sessão expirada. Solicite um novo link de recuperação.');
        showError('Sessão expirada. Solicite um novo link de recuperação.');
        setLoading(false);
        return;
      }
      
      // Para outros erros, mostra normalmente
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

