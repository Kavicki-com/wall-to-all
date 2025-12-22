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
import { logger } from '../../lib/logger';

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
if (__DEV__) {
      logger.debug('[ResetPassword] ========== COMPONENTE MONTADO ==========');
      console.log('[DEBUG] ResetPassword useEffect montado');
    }
    
    // NOTA: Não bloqueia processamento com hasProcessedRef aqui porque quando o app está aberto
    // e a Activity é reiniciada pelo deep link, precisamos processar novamente
    // O hasProcessedRef será gerenciado dentro de processUrl e pelo listener

    const processUrl = async (url: string | null): Promise<boolean | 'ERROR_DEFINED'> => {
if (!isSupabaseConfigured) {
        if (__DEV__) {
          logger.error('[ResetPassword] Supabase não configurado!');
        }
        setError('Erro de configuração.');
        setIsValidating(false);
        return false;
      }

      if (!url) {
        if (__DEV__) {
          logger.debug('[ResetPassword] URL é null');
        }
        return false;
      }

      try {
        if (__DEV__) { 
          logger.debug('[ResetPassword] === INICIANDO PROCESSAMENTO DE URL ===');
          logger.debug('[ResetPassword] Processando URL:', url.substring(0, 100) + '...');
          logger.debug('[ResetPassword] URL contém #:', url.includes('#'));
        }

        // Se há uma URL com tokens, processa ela
        if (url.includes('#')) {
          if (__DEV__) { logger.debug('[ResetPassword] Processando tokens da URL...');
          }
          try {
const success = await processAuthTokensFromUrl(url);
if (success) {
              if (__DEV__) { 
                logger.debug('[ResetPassword] Tokens processados com sucesso!');
                logger.debug('[ResetPassword] Aguardando 1s para persistência da sessão...');
              }
              
              // Aguarda mais tempo para garantir que a sessão foi persistida
              await new Promise(resolve => setTimeout(resolve, 1000));
              
              if (__DEV__) {
                logger.debug('[ResetPassword] Verificando se sessão foi persistida...');
              }
              
              // Verifica se a sessão foi realmente configurada (com múltiplas tentativas)
              let verifiedSession = null;
              let verifyError = null;
              
              for (let attempt = 1; attempt <= 3; attempt++) {
if (__DEV__) {
                  logger.debug(`[ResetPassword] Tentativa ${attempt}/3 de verificar sessão...`);
                }
                
                const result = await supabase.auth.getSession();
                verifiedSession = result.data.session;
                verifyError = result.error;
if (verifiedSession && !verifyError) {
                  if (__DEV__) {
                    logger.debug(`[ResetPassword] Sessão encontrada na tentativa ${attempt}!`);
                  }
                  break;
                }
                
                if (attempt < 3) {
                  if (__DEV__) {
                    logger.debug(`[ResetPassword] Sessão não encontrada, aguardando 500ms antes de tentar novamente...`);
                  }
                  await new Promise(resolve => setTimeout(resolve, 500));
                }
              }
              
              if (!verifiedSession || verifyError) {
                if (__DEV__) {
                  logger.error('[ResetPassword] Sessão não encontrada após 3 tentativas:', {
                    hasSession: !!verifiedSession,
                    error: verifyError?.message,
                  });
                }
                setError('Erro ao processar link de recuperação. Tente novamente.');
                setIsValidating(false);
                return 'ERROR_DEFINED';
              }
              
              if (__DEV__) { 
                logger.debug('[ResetPassword] ✓ Sessão verificada com sucesso!', {
                  userEmail: verifiedSession.user?.email,
                  userId: verifiedSession.user?.id,
                });
              }
              
              setIsValidating(false);
              return true;
            } else {
              if (__DEV__) {
                logger.warn('[ResetPassword] Falha ao processar tokens da URL');
              }
            }
          } catch (e: unknown) {
            // Verifica se é um erro do Supabase (link expirado/inválido)
            const error = e as { message?: string };
            if (error?.message?.startsWith('SUPABASE_ERROR:')) {
              const errorParts = error.message.split(':');
              const errorCode = errorParts[1];
              const errorDescription = errorParts.slice(2).join(':') || 'Link inválido ou expirado';
              
              if (__DEV__) {
                logger.error('[ResetPassword] Erro do Supabase detectado:', { errorCode, errorDescription });
              }
              
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
          if (__DEV__) {
            logger.warn('[ResetPassword] URL não contém # - pode estar truncada ou modificada');
          }
          // Tenta processar mesmo sem #, caso a URL tenha sido modificada
          try {
            const success = await processAuthTokensFromUrl(url);
            if (success) {
              if (__DEV__) { logger.debug('[ResetPassword] Tokens processados com sucesso (sem #)!');
              }
              
              // Aguarda um pouco para garantir que a sessão foi persistida
              await new Promise(resolve => setTimeout(resolve, 500));
              
              // Verifica se a sessão foi realmente configurada
              const { data: { session: verifiedSession }, error: verifyError } = await supabase.auth.getSession();
              if (!verifiedSession || verifyError) {
                if (__DEV__) {
                  logger.error('[ResetPassword] Sessão não encontrada após processar tokens (sem #):', {
                    hasSession: !!verifiedSession,
                    error: verifyError?.message,
                  });
                }
                setError('Erro ao processar link de recuperação. Tente novamente.');
                setIsValidating(false);
                return 'ERROR_DEFINED';
              }
              
              setIsValidating(false);
              return true;
            }
          } catch (e: unknown) {
            // Verifica se é um erro do Supabase
            const error = e as { message?: string };
            if (error?.message?.startsWith('SUPABASE_ERROR:')) {
              const errorParts = error.message.split(':');
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
        if (__DEV__) {
          logger.error('[ResetPassword] Erro ao processar URL:', e);
        }
      }

      return false;
    };

    const processDeepLinkAndValidate = async () => {
if (__DEV__) {
        logger.debug('[ResetPassword] ========== processDeepLinkAndValidate INICIADO ==========');
        console.log('[DEBUG] processDeepLinkAndValidate iniciado');
      }
      
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
if (__DEV__) { logger.debug('[ResetPassword] Sessão existente encontrada ANTES de processar deep link (tentativa', i + 1, ')');
            }
            break;
          }
          if (i < 2) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }
        
        // Se já há uma sessão válida, não precisa processar o deep link
        if (existingSession) {
          if (__DEV__) { logger.debug('[ResetPassword] Sessão já existe, não precisa processar deep link');
          }
          setIsValidating(false);
          return;
        }
        
        // Primeiro, tenta pegar a URL inicial (deep link que abriu o app - cold start)
        const initialUrl = await Linking.getInitialURL();
if (__DEV__) {
          logger.debug('[ResetPassword] ========== getInitialURL RESULTADO ==========');
          logger.debug('[ResetPassword] URL inicial (getInitialURL):', initialUrl);
          console.log('[DEBUG] getInitialURL:', initialUrl);
          console.log('[DEBUG] URL contém reset-password:', initialUrl?.includes('reset-password'));
        }

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
          if (__DEV__) {
            logger.debug('[ResetPassword] Sem URL inicial - verificando getInitialURL periodicamente por 3s...');
          }
          
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
              if (__DEV__) {
                logger.debug('[ResetPassword] URL encontrada na verificação', i + 1, ', processando...');
              }
              break;
            }
          }
          
          if (foundUrl) {
            const urlProcessed = await processUrl(foundUrl);
            if (urlProcessed === true || urlProcessed === 'ERROR_DEFINED') {
              hasProcessedRef.current = true;
              return;
            }
          } else {
            if (__DEV__) {
              logger.debug('[ResetPassword] Nenhuma URL encontrada após', totalWaitTime, 'ms de verificação periódica');
            }
          }
        }
        
        if (__DEV__) {
          logger.debug('[ResetPassword] Verificando se já existe sessão válida...');
        }
        
        let session = null;
        for (let i = 0; i < 5; i++) {
          const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
          if (currentSession && !sessionError) {
            session = currentSession;
            if (__DEV__) {
              logger.debug('[ResetPassword] Sessão existente encontrada (tentativa', i + 1, '):', {
                userEmail: currentSession.user?.email,
                userId: currentSession.user?.id,
              });
            }
            break;
          }
          if (i < 4) {
            if (__DEV__) {
              logger.debug('[ResetPassword] Sessão não encontrada na tentativa', i + 1, ', aguardando 500ms...');
            }
            // Aguarda um pouco antes de tentar novamente
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
        
        if (session) {
          if (__DEV__) {
            logger.debug('[ResetPassword] ✓ Sessão válida encontrada! Permitindo reset de senha.');
          }
          setIsValidating(false);
          return;
        }

        // Sem sessão e sem tokens válidos
        if (__DEV__) {
          logger.error('[ResetPassword] ✗ Nenhuma sessão encontrada após todas as tentativas');
        }
        setError('Link inválido ou expirado. Solicite um novo link de recuperação.');
        setIsValidating(false);
      } catch (e) {
        logger.error('[ResetPassword] Erro:', e);
        const processed = handleError(e, 'auth');
        setError(processed.userMessage);
        setIsValidating(false);
      }
    };

    // IMPORTANTE: Registra o listener ANTES de processar o deep link inicial
    // Isso garante que o listener esteja ativo quando a Activity é reiniciada pelo deep link
    
    const subscription = Linking.addEventListener('url', async (event) => {
logger.debug('[ResetPassword] Deep link recebido (app aberto):', event.url);
      
      // Ignora URLs do Expo dev server
      if (event.url && event.url.includes('expo-development-client')) {
        logger.debug('[ResetPassword] URL do Expo dev server ignorada no listener:', event.url);
        // Tenta obter a URL real do getInitialURL quando recebe URL do Expo dev server
        // Isso pode acontecer quando o app está aberto e a Activity é reiniciada
        try {
          const realUrl = await Linking.getInitialURL();
          if (realUrl && realUrl.includes('reset-password') && !realUrl.includes('expo-development-client')) {
            logger.debug('[ResetPassword] URL real encontrada via getInitialURL:', realUrl);
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
          logger.warn('[ResetPassword] Erro ao obter URL real:', error);
        }
        return;
      }
      
      if (event.url && event.url.includes('reset-password')) {
        logger.debug('[ResetPassword] Processando deep link do listener...');
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
        logger.warn('[ResetPassword] Deep link recebido mas não é reset-password:', event.url);
      }
    });

    // Declara no escopo do useEffect para ser acessível no cleanup
    let continuousCheckInterval: NodeJS.Timeout | null = null;
    let continuousCheckCount = 0;
    const maxContinuousChecks = 20;

    // Processa deep link inicial (cold start) - DEPOIS de registrar o listener
    processDeepLinkAndValidate().then(() => {
      // Verificação contínua de getInitialURL() para warm start
      // Mesmo após registrar o listener, continuamos verificando getInitialURL() periodicamente
      // porque quando a Activity é reiniciada, o listener pode não ser acionado imediatamente
      
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
              logger.debug('[ResetPassword] URL encontrada na verificação contínua (check', continuousCheckCount, '), processando...');
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
            logger.warn('[ResetPassword] Erro na verificação contínua:', error);
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
    });

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
      logger.debug('[ResetPassword] Verificando sessão antes de alterar:', {
        hasSession: !!currentSession,
        userEmail: currentSession?.user?.email,
        sessionError: sessionError?.message,
      });
      
      if (!currentSession || sessionError) {
        // Tenta uma última vez obter a sessão antes de desistir
        await new Promise(resolve => setTimeout(resolve, 300));
        const { data: { session: retrySession }, error: retryError } = await supabase.auth.getSession();
        
        if (!retrySession || retryError) {
          const errorMsg = 'Sessão expirada. Solicite um novo link de recuperação.';
          setError(errorMsg);
          showError(errorMsg);
          setLoading(false);
          return;
        }
        
        // Se conseguiu na segunda tentativa, usa essa sessão
        logger.debug('[ResetPassword] Sessão recuperada na segunda tentativa');
      }

      logger.debug('[ResetPassword] Tentando alterar senha...');
      const { data, error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      logger.debug('[ResetPassword] Resultado updateUser:', {
        hasData: !!data,
        hasUser: !!data?.user,
        updateError: updateError?.message,
      });

      if (updateError) {
        logger.error('[ResetPassword] Erro ao alterar senha:', updateError);
        
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
        logger.error('[ResetPassword] updateUser retornou sem user!');
        setError('Erro ao alterar senha. Tente novamente.');
        showError('Erro ao alterar senha. Tente novamente.');
        setLoading(false);
        return;
      }

      logger.debug('[ResetPassword] Senha alterada com sucesso!');
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
        logger.warn('[ResetPassword] Erro ao fazer signOut (ignorado):', error);
      }
      
      // Redireciona imediatamente para login
      router.replace('/(auth)/login');
    } catch (e: unknown) {
      logger.error('[ResetPassword] Exceção ao alterar senha:', e);
      const error = e as { message?: string };
      // Se o erro é "Auth session missing", significa que não há sessão válida
      // NÃO assumimos que a senha foi alterada - mostramos erro
      const errorMessage = error?.message || String(e);
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

