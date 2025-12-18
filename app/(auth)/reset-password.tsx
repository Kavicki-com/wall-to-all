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
    // NOTA: Não bloqueia processamento com hasProcessedRef aqui porque quando o app está aberto
    // e a Activity é reiniciada pelo deep link, precisamos processar novamente
    // O hasProcessedRef será gerenciado dentro de processUrl e pelo listener

    const processUrl = async (url: string | null): Promise<boolean | 'ERROR_DEFINED'> => {
      if (!isSupabaseConfigured) {
        setError('Erro de configuração.');
        setIsValidating(false);
        return false;
      }

      if (!url) return false;

      try {
        console.log('[ResetPassword] Processando URL:', url);
        console.log('[ResetPassword] URL contém #:', url.includes('#'));

        // Se há uma URL com tokens, processa ela
        if (url.includes('#')) {
          console.log('[ResetPassword] Processando tokens da URL...');
          try {
            const success = await processAuthTokensFromUrl(url);
            
            if (success) {
              console.log('[ResetPassword] Tokens processados com sucesso!');
              setIsValidating(false);
              return true;
            } else {
              console.warn('[ResetPassword] Falha ao processar tokens da URL');
            }
          } catch (e: any) {
            // Verifica se é um erro do Supabase (link expirado/inválido)
            if (e?.message?.startsWith('SUPABASE_ERROR:')) {
              const errorParts = e.message.split(':');
              const errorCode = errorParts[1];
              const errorDescription = errorParts.slice(2).join(':') || 'Link inválido ou expirado';
              
              console.error('[ResetPassword] Erro do Supabase detectado:', { errorCode, errorDescription });
              
              // Define mensagem de erro apropriada
              if (errorCode === 'otp_expired' || errorCode === 'access_denied') {
                setError('Link inválido ou expirado. Solicite um novo link de recuperação.');
              } else {
                setError(errorDescription || 'Link inválido ou expirado. Solicite um novo link de recuperação.');
              }
              setIsValidating(false);
              return 'ERROR_DEFINED'; // Retorna valor especial indicando que erro já foi definido
            }
            throw e; // Re-lança se não for erro do Supabase
          }
        } else {
          console.warn('[ResetPassword] URL não contém # - pode estar truncada ou modificada');
          // Tenta processar mesmo sem #, caso a URL tenha sido modificada
          try {
            const success = await processAuthTokensFromUrl(url);
            if (success) {
              console.log('[ResetPassword] Tokens processados com sucesso (sem #)!');
              setIsValidating(false);
              return true;
            }
          } catch (e: any) {
            // Verifica se é um erro do Supabase
            if (e?.message?.startsWith('SUPABASE_ERROR:')) {
              const errorParts = e.message.split(':');
              const errorCode = errorParts[1];
              const errorDescription = errorParts.slice(2).join(':') || 'Link inválido ou expirado';
              
              if (errorCode === 'otp_expired' || errorCode === 'access_denied') {
                setError('Link inválido ou expirado. Solicite um novo link de recuperação.');
              } else {
                setError(errorDescription || 'Link inválido ou expirado. Solicite um novo link de recuperação.');
              }
              setIsValidating(false);
              return 'ERROR_DEFINED'; // Retorna valor especial indicando que erro já foi definido
            }
            throw e;
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
        // IMPORTANTE: Verifica primeiro se já há uma sessão válida
        // Isso pode acontecer se o _layout.tsx já processou o deep link antes do componente montar
        
        let existingSession = null;
        for (let i = 0; i < 3; i++) {
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          if (currentSession) {
            existingSession = currentSession;
            console.log('[ResetPassword] Sessão existente encontrada ANTES de processar deep link (tentativa', i + 1, ')');
            break;
          }
          if (i < 2) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }
        
        // Se já há uma sessão válida, não precisa processar o deep link
        if (existingSession) {
          console.log('[ResetPassword] Sessão já existe, não precisa processar deep link');
          setIsValidating(false);
          return;
        }
        
        // Primeiro, tenta pegar a URL inicial (deep link que abriu o app - cold start)
        const initialUrl = await Linking.getInitialURL();
        console.log('[ResetPassword] URL inicial (getInitialURL):', initialUrl);

        // Ignora URLs do Expo dev server - só processa URLs de reset-password
        const shouldProcessInitialUrl = initialUrl && 
          initialUrl.includes('reset-password') && 
          !initialUrl.includes('expo-development-client');

        // Se há uma URL com tokens, processa ela
        if (shouldProcessInitialUrl) {
          const urlProcessed = await processUrl(initialUrl);
          // Se processUrl retornou true, significa que processou com sucesso
          if (urlProcessed === true) {
            hasProcessedRef.current = true;
            return;
          }
          // Se processUrl retornou 'ERROR_DEFINED', significa que detectou erro do Supabase
          // e já definiu a mensagem de erro apropriada - não continua para verificar sessão
          if (urlProcessed === 'ERROR_DEFINED') {
            hasProcessedRef.current = true;
            return; // Para aqui, não continua para verificar sessão
          }
        }

        // Se não processou tokens da URL, verifica se já há uma sessão válida
        // Em produção, pode haver um delay na persistência da sessão
        // IMPORTANTE: Se não havia URL inicial (app aberto), aguarda um pouco para dar tempo
        // ao listener processar o deep link se o usuário clicar nele
        // Também verifica getInitialURL novamente após o delay, pois quando a Activity é reiniciada
        // pelo deep link, pode haver um delay antes de getInitialURL retornar a URL
        if (!initialUrl) {
          console.log('[ResetPassword] Sem URL inicial - verificando getInitialURL periodicamente por 3s...');
          
          // Verifica getInitialURL periodicamente durante 3 segundos
          // Quando a Activity é reiniciada pelo deep link, getInitialURL pode retornar a URL após um delay
          let foundUrl: string | null = null;
          const checkInterval = 300; // Verifica a cada 300ms
          const totalWaitTime = 3000; // Total de 3 segundos
          const maxChecks = Math.floor(totalWaitTime / checkInterval);
          
          for (let i = 0; i < maxChecks; i++) {
            await new Promise(resolve => setTimeout(resolve, checkInterval));
            const checkUrl = await Linking.getInitialURL();
            
            if (checkUrl && checkUrl.includes('reset-password') && !checkUrl.includes('expo-development-client')) {
              foundUrl = checkUrl;
              console.log('[ResetPassword] URL encontrada na verificação', i + 1, ', processando...');
              break;
            }
          }
          
          if (foundUrl) {
            const urlProcessed = await processUrl(foundUrl);
            if (urlProcessed === true) {
              hasProcessedRef.current = true;
              return;
            }
            if (urlProcessed === 'ERROR_DEFINED') {
              hasProcessedRef.current = true;
              return;
            }
          } else {
            console.log('[ResetPassword] Nenhuma URL encontrada após', totalWaitTime, 'ms de verificação periódica');
          }
        }
        
        let session = null;
        for (let i = 0; i < 3; i++) {
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          if (currentSession) {
            session = currentSession;
            console.log('[ResetPassword] Sessão existente encontrada (tentativa', i + 1, ')');
            break;
          }
          if (i < 2) {
            // Aguarda um pouco antes de tentar novamente
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
        
        if (session) {
          setIsValidating(false);
          return;
        }

        // Sem sessão e sem tokens válidos
        console.error('[ResetPassword] Nenhuma sessão encontrada após processar URL');
        setError('Link inválido ou expirado. Solicite um novo link de recuperação.');
        setIsValidating(false);
      } catch (e) {
        console.error('[ResetPassword] Erro:', e);
        const processed = handleError(e, 'auth');
        setError(processed.userMessage);
        setIsValidating(false);
      }
    };

    // IMPORTANTE: Registra o listener ANTES de processar o deep link inicial
    // Isso garante que o listener esteja ativo quando a Activity é reiniciada pelo deep link
    
    const subscription = Linking.addEventListener('url', async (event) => {
      console.log('[ResetPassword] Deep link recebido (app aberto):', event.url);
      
      // Ignora URLs do Expo dev server
      if (event.url && event.url.includes('expo-development-client')) {
        console.log('[ResetPassword] URL do Expo dev server ignorada no listener:', event.url);
        // Tenta obter a URL real do getInitialURL quando recebe URL do Expo dev server
        // Isso pode acontecer quando o app está aberto e a Activity é reiniciada
        try {
          const realUrl = await Linking.getInitialURL();
          if (realUrl && realUrl.includes('reset-password') && !realUrl.includes('expo-development-client')) {
            console.log('[ResetPassword] URL real encontrada via getInitialURL:', realUrl);
            // Reseta o flag para permitir processamento
            hasProcessedRef.current = false;
            setIsValidating(true);
            setError(null);
            const urlProcessed = await processUrl(realUrl);
            if (urlProcessed === true || urlProcessed === 'ERROR_DEFINED') {
              hasProcessedRef.current = true;
            }
            return;
          }
        } catch (error) {
          console.warn('[ResetPassword] Erro ao obter URL real:', error);
        }
        return;
      }
      
      if (event.url && event.url.includes('reset-password')) {
        console.log('[ResetPassword] Processando deep link do listener...');
        // Reseta o flag para permitir processamento novamente
        hasProcessedRef.current = false;
        // Reseta o estado de validação e erro para processar o novo link
        setIsValidating(true);
        setError(null);
        // Processa a URL e aguarda o resultado
        const urlProcessed = await processUrl(event.url);
        // Se processou com sucesso ou erro já foi definido, marca como processado
        if (urlProcessed === true || urlProcessed === 'ERROR_DEFINED') {
          hasProcessedRef.current = true;
        }
      } else {
        console.warn('[ResetPassword] Deep link recebido mas não é reset-password:', event.url);
      }
    });

    // Processa deep link inicial (cold start) - DEPOIS de registrar o listener
    processDeepLinkAndValidate();

    // Verificação contínua de getInitialURL() para warm start
    // Mesmo após registrar o listener, continuamos verificando getInitialURL() periodicamente
    // porque quando a Activity é reiniciada, o listener pode não ser acionado imediatamente
    let continuousCheckInterval: NodeJS.Timeout | null = null;
    let continuousCheckCount = 0;
    const maxContinuousChecks = 20; // Verifica por até 6 segundos (20 * 300ms)
    
    const startContinuousCheck = () => {
      continuousCheckInterval = setInterval(async () => {
        continuousCheckCount++;
        
        // Para a verificação se já processou ou se excedeu o limite
        if (hasProcessedRef.current || continuousCheckCount >= maxContinuousChecks) {
          if (continuousCheckInterval) {
            clearInterval(continuousCheckInterval);
            continuousCheckInterval = null;
          }
          return;
        }
        
        try {
          const checkUrl = await Linking.getInitialURL();
          
          if (checkUrl && checkUrl.includes('reset-password') && !checkUrl.includes('expo-development-client')) {
            console.log('[ResetPassword] URL encontrada na verificação contínua (check', continuousCheckCount, '), processando...');
            // Para a verificação contínua
            if (continuousCheckInterval) {
              clearInterval(continuousCheckInterval);
              continuousCheckInterval = null;
            }
            // Reseta o flag para permitir processamento
            hasProcessedRef.current = false;
            setIsValidating(true);
            setError(null);
            const urlProcessed = await processUrl(checkUrl);
            if (urlProcessed === true || urlProcessed === 'ERROR_DEFINED') {
              hasProcessedRef.current = true;
            }
          }
        } catch (error) {
          console.warn('[ResetPassword] Erro na verificação contínua:', error);
        }
      }, 300); // Verifica a cada 300ms
    };
    
    // Inicia a verificação contínua apenas se não havia URL inicial (warm start)
    // Aguarda um pouco para dar tempo ao listener processar primeiro
    setTimeout(() => {
      if (!hasProcessedRef.current) {
        startContinuousCheck();
      }
    }, 500);

    return () => {
      subscription.remove();
      if (continuousCheckInterval) {
        clearInterval(continuousCheckInterval);
      }
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
        
        // Trata erro específico de senha igual à antiga
        if (updateError.message?.includes('New password should be different from the old password') || 
            updateError.message?.includes('new password should be different')) {
          const specificError = 'A nova senha deve ser diferente da senha atual.';
          setError(specificError);
          showError(specificError);
          setLoading(false);
          return;
        }
        
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

