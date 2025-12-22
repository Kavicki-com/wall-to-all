import React, { useEffect } from 'react';
import { StyleSheet, Text, View, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User, Session } from '@supabase/supabase-js';
import { LogoWallToAll } from '../../lib/assets';
import ScreenContainer from '../../components/layout/ScreenContainer';
import { supabase } from '../../lib/supabase';
import { logger } from '../../lib/logger';

const ClientSignupLoadingScreen: React.FC = () => {
  const router = useRouter();

  useEffect(() => {
    const completeSignup = async () => {
      const draftKey = 'client_signup_draft';
      
      try {
        // Buscar dados salvos no AsyncStorage
        const stored = await AsyncStorage.getItem(draftKey);
        
        if (!stored) {
          logger.error('[ClientSignupLoading] Dados do cadastro não encontrados');
          Alert.alert('Erro', 'Dados do cadastro não encontrados. Por favor, tente novamente.');
          router.replace('/(auth)/login');
          return;
        }

        let draftData;
        try {
          draftData = JSON.parse(stored);
        } catch (parseError) {
          logger.error('[ClientSignupLoading] Erro ao fazer parse do draft:', parseError);
          // Limpar draft corrompido
          await AsyncStorage.removeItem(draftKey);
          Alert.alert('Erro', 'Dados do cadastro corrompidos. Por favor, tente novamente.');
          router.replace('/(auth)/login');
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
            Alert.alert('Erro', 'Sessão não encontrada. Por favor, tente fazer login novamente.');
            await AsyncStorage.removeItem(draftKey);
            await AsyncStorage.removeItem('oauth_google_signup');
            await AsyncStorage.removeItem('oauth_google_data');
            router.replace('/(auth)/login');
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
              Alert.alert(
                'Erro',
                'Não foi possível fazer login. Por favor, tente fazer login manualmente.',
                [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
              );
              await AsyncStorage.removeItem(draftKey);
              return;
            }

            user = signInData.user;
            session = signInData.session;
          } else if (signUpError) {
            // Outro erro ao criar usuário
            logger.error('[ClientSignupLoading] Erro ao criar usuário:', signUpError);
            Alert.alert('Erro', 'Não foi possível criar a conta. Tente novamente.');
            router.replace('/(auth)/login');
            await AsyncStorage.removeItem(draftKey);
            return;
          } else if (!signUpData?.user) {
            logger.error('[ClientSignupLoading] Usuário não foi criado');
            Alert.alert('Erro', 'Não foi possível criar a conta. Tente novamente.');
            router.replace('/(auth)/login');
            await AsyncStorage.removeItem(draftKey);
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
                Alert.alert(
                  'Confirme seu e-mail',
                  'Enviamos um e-mail de confirmação. Por favor, confirme seu e-mail e faça login.',
                  [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
                );
                await AsyncStorage.removeItem(draftKey);
                return;
              }
              session = signInData.session;
            }
          }
        }

        // Criar ou atualizar profile (usar upsert para evitar erro se já existir)
        // IMPORTANTE: Sempre marcar signup_complete: true para evitar logout automático
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
          // Não bloquear, mas logar o erro
        }

        // Criar ou atualizar client_profile com endereço (usar upsert para evitar erro se já existir)
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
          // Não bloquear, mas logar o erro
        }

        // Limpar dados do draft e flags OAuth
        await AsyncStorage.removeItem(draftKey);
        if (isOAuth) {
          await AsyncStorage.removeItem('oauth_google_signup');
          await AsyncStorage.removeItem('oauth_google_data');
          if (__DEV__) {
            logger.debug('[ClientSignupLoading] Flags OAuth limpas');
          }
        }

        // Verificar se ainda tem sessão antes de redirecionar
        const { data: finalSessionCheck } = await supabase.auth.getSession();

        if (!finalSessionCheck?.session) {
          // Se não tem sessão, redirecionar para login
          Alert.alert(
            'Confirme seu e-mail',
            'Enviamos um e-mail de confirmação. Por favor, confirme seu e-mail e faça login.',
            [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
          );
          return;
        }

        // Redirecionar para home se tudo estiver OK
        router.replace('/(client)/home');

      } catch (error) {
        logger.error('[ClientSignupLoading] Erro ao completar cadastro:', error);
        Alert.alert('Erro', 'Ocorreu um erro ao completar o cadastro. Tente novamente.');
        router.replace('/(auth)/login');
      }
    };

    // Inicia o processo de signup após 1.5s
    // Nota: setTimeout não espera por promises, então chamamos a função async diretamente
    const timeout = setTimeout(() => {
      completeSignup();
    }, 1500);

    return () => clearTimeout(timeout);
  }, [router]);

  return (
    <ScreenContainer scroll backgroundColor="#FFFFFF">
      <View style={styles.content}>
        <View style={styles.logoWrapper}>
          <LogoWallToAll width={64} height={40} />
        </View>
        <Text style={styles.text}>
          Aguarde, enquanto preparamos tudo para você
        </Text>
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
  },
  logoWrapper: {
    marginBottom: 24,
  },
  text: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 16,
    color: '#0F0F0F',
    textAlign: 'center',
  },
});


