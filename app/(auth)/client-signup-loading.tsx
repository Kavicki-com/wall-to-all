import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, Text, View, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User, Session } from '@supabase/supabase-js';
import { LogoWallToAll } from '../../lib/assets';
import ScreenContainer from '../../components/layout/ScreenContainer';
import { supabase } from '../../lib/supabase';
import { logger } from '../../lib/logger';
import { CustomButton } from '../../components/CustomButton';
import { colors } from '../../lib/theme';
import { useAuth } from '../../context/AuthContext';

const ClientSignupLoadingScreen: React.FC = () => {
  const router = useRouter();
  const { refreshUserRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFatalError, setIsFatalError] = useState(false);

  const completeSignup = useCallback(async () => {
    const draftKey = 'client_signup_draft';
    setLoading(true);
    setError(null);

    try {
      // Buscar dados salvos no AsyncStorage
      const stored = await AsyncStorage.getItem(draftKey);

      if (!stored) {
        logger.error('[ClientSignupLoading] Dados do cadastro não encontrados');
        setError('Dados do cadastro não encontrados. Por favor, tente novamente.');
        setIsFatalError(true);
        return;
      }

      let draftData;
      try {
        draftData = JSON.parse(stored);
      } catch (parseError) {
        logger.error('[ClientSignupLoading] Erro ao fazer parse do draft:', parseError);
        // Limpar draft corrompido apenas se houver certeza
        await AsyncStorage.removeItem(draftKey);
        setError('Dados do cadastro corrompidos. Por favor, tente novamente.');
        setIsFatalError(true);
        return;
      }

      // Verificar se é OAuth
      const isOAuth = draftData.is_oauth === true;

      // Tentar criar usuário no Supabase Auth (apenas se NÃO for OAuth)
      let user: User | null = null;
      let session: Session | null = null;

      if (isOAuth) {
        // OAuth: conta já existe, apenas pegar sessão atual
        if (__DEV__) {
          logger.debug('[ClientSignupLoading] OAuth detectado, usando sessão existente');
        }

        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session?.user) {
          user = sessionData.session.user;
          session = sessionData.session;

          if (__DEV__) {
            logger.debug('[ClientSignupLoading] Sessão OAuth recuperada:', user.email);
          }
        } else {
          // Sem sessão, algo deu errado
          setError('Sessão não encontrada. Por favor, tente fazer login novamente.');
          setIsFatalError(true);
          // Manter draft por segurança se for erro de sessão temporário? 
          // No OAuth, o draft é preenchido pelo login do Google, então se falhou aqui, melhor voltar pro login.
          return;
        }
      } else {
        // Fluxo normal: criar usuário com signUp
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: draftData.email,
          password: draftData.password,
          options: {
            emailRedirectTo: 'walltoall://auth/login',
            data: {
              full_name: draftData.full_name,
              user_type: 'client',
              avatar_url: null,
            },
          },
        });

        // Se o usuário já existe, tentar fazer login
        if (signUpError?.message?.includes('already registered') || signUpError?.message?.includes('User already registered')) {
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: draftData.email,
            password: draftData.password,
          });

          if (signInError || !signInData?.session || !signInData?.user) {
            setError('Não foi possível fazer login automático. O e-mail já está em uso.');
            setIsFatalError(true);
            return;
          }

          user = signInData.user;
          session = signInData.session;
        } else if (signUpError) {
          // Outro erro ao criar usuário
          logger.error('[ClientSignupLoading] Erro ao criar usuário:', signUpError);

          // Verificar se é erro de rede
          const isNetworkError = signUpError.message?.toLowerCase().includes('network') ||
            signUpError.message?.toLowerCase().includes('fetch');

          if (isNetworkError) {
            setError('Erro de conexão. Verifique sua internet e tente novamente.');
            return; // Permite retentativa sem deletar draft
          }

          setError('Não foi possível criar a conta: ' + signUpError.message);
          setIsFatalError(true);
          return;
        } else if (!signUpData?.user) {
          logger.error('[ClientSignupLoading] Usuário não foi criado');
          setError('Não foi possível criar a conta. Tente novamente.');
          setIsFatalError(true);
          return;
        } else {
          // Usuário criado com sucesso
          user = signUpData.user;
          session = signUpData.session;

          // Se não tiver sessão, tentar fazer login
          if (!session) {
            const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
              email: draftData.email,
              password: draftData.password,
            });

            if (signInError || !signInData?.session) {
              // Se não conseguir fazer login, usuário precisa confirmar email
              setError('Enviamos um e-mail de confirmação. Por favor, confirme seu e-mail para prosseguir.');
              setIsFatalError(true);
              return;
            }
            session = signInData.session;
          }
        }
      }

      // Se chegamos aqui, temos user e session (ou pelo menos user no caso de confirmação pendente que tratamos acima)
      if (!user) {
        setError('Ocorreu um erro inesperado ao recuperar seus dados.');
        setIsFatalError(true);
        return;
      }

      // Criar ou atualizar profile
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          full_name: draftData.full_name,
          user_type: 'client',
          avatar_url: draftData.avatar_url || null,
          email: draftData.email,
          last_signup_step: 'complete',
          signup_started_at: draftData.signup_started_at,
          signup_complete: true,
          signup_completed_at: new Date().toISOString(),
        }, {
          onConflict: 'id'
        });

      if (profileError) {
        logger.error('[ClientSignupLoading] Erro ao criar/atualizar profile:', profileError);
        // Se for erro de rede no profile, permitir retry
        if (profileError.message?.toLowerCase().includes('network') || profileError.message?.toLowerCase().includes('fetch')) {
          setError('Erro de conexão ao salvar perfil. Tente novamente.');
          return;
        }
      }

      // Criar ou atualizar client_profile com endereço
      const { error: clientProfileError } = await supabase
        .from('client_profiles')
        .upsert({
          owner_id: user.id,
          address: draftData.address,
          signup_complete: true,
        }, {
          onConflict: 'owner_id'
        });

      if (clientProfileError) {
        logger.error('[ClientSignupLoading] Erro ao criar/atualizar client_profile:', clientProfileError);
        if (clientProfileError.message?.toLowerCase().includes('network') || clientProfileError.message?.toLowerCase().includes('fetch')) {
          setError('Erro de conexão ao salvar endereço. Tente novamente.');
          return;
        }
      }

      // Processar Referral (se houver código)
      // Fazemos isso após garantir que o profile existe
      if (draftData.referral_code) {
        try {
          const { error: referralError } = await supabase.rpc('process_referral', {
            p_referred_id: user.id,
            p_referral_code: draftData.referral_code
          });

          if (referralError) {
            // Log erro mas não bloqueia o fluxo
            logger.warn('[ClientSignupLoading] Erro ao processar referral:', referralError);
          } else {
            if (__DEV__) {
              logger.debug('[ClientSignupLoading] Referral processado com sucesso');
            }
          }
        } catch (refErr) {
          logger.warn('[ClientSignupLoading] Exceção ao processar referral:', refErr);
        }
      }

      // Limpar dados do draft e flags OAuth APENAS NO SUCESSO
      if (draftData.referral_code) {
        await AsyncStorage.setItem('last_used_referral_code', draftData.referral_code.toUpperCase());
      }
      await AsyncStorage.removeItem(draftKey);
      await AsyncStorage.removeItem('referral_code');
      if (isOAuth) {
        await AsyncStorage.removeItem('oauth_google_signup');
        await AsyncStorage.removeItem('oauth_google_data');
      }

      // Verificar se ainda tem sessão antes de redirecionar
      const { data: finalSessionCheck } = await supabase.auth.getSession();

      if (!finalSessionCheck?.session) {
        setError('Enviamos um e-mail de confirmação. Por favor, confirme seu e-mail para prosseguir.');
        setIsFatalError(true);
        return;
      }

      const refreshedRole = await refreshUserRole(user.id);

      if (__DEV__ && refreshedRole !== 'client') {
        logger.warn('[ClientSignupLoading] refreshUserRole retornou role inesperada:', refreshedRole);
      }

      // Redirecionar para home se tudo estiver OK
      router.replace('/(client)/home');

    } catch (err) {
      logger.error('[ClientSignupLoading] Erro genérico:', err);
      setError('Ocorreu um erro ao completar o cadastro. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [refreshUserRole, router]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      completeSignup();
    }, 1500);

    return () => clearTimeout(timeout);
  }, [completeSignup]);

  const handleGoBack = () => {
    router.replace('/(auth)/login');
  };

  return (
    <ScreenContainer scroll backgroundColor="#FFFFFF">
      <View style={styles.content}>
        <View style={styles.logoWrapper}>
          <LogoWallToAll width={64} height={40} />
        </View>

        {loading ? (
          <>
            <ActivityIndicator size="large" color={colors.brand} style={{ marginBottom: 16 }} />
            <Text style={styles.text}>
              Aguarde, enquanto preparamos tudo para você
            </Text>
          </>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>

            <View style={styles.buttonContainer}>
              {!isFatalError && (
                <CustomButton
                  title="Tentar Novamente"
                  onPress={completeSignup}
                  variant="primary"
                  style={styles.button}
                />
              )}

              <CustomButton
                title={isFatalError ? "Voltar" : "Ir para Login"}
                onPress={handleGoBack}
                variant="outline"
                style={styles.button}
              />
            </View>
          </View>
        ) : null}
      </View>
    </ScreenContainer>
  );
};

export default ClientSignupLoadingScreen;

const styles = StyleSheet.create({
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    minHeight: 400,
  },
  logoWrapper: {
    marginBottom: 48,
  },
  text: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 16,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  errorContainer: {
    alignItems: 'center',
    width: '100%',
  },
  errorText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 16,
    color: colors.accent,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  button: {
    borderRadius: 24,
    width: '100%',
  },
});
