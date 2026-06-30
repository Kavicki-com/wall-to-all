import React, { useEffect } from 'react';
import { StyleSheet, Text, View, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User, Session } from '@supabase/supabase-js';
import { LogoWallToAll } from '../../lib/assets';
import { supabase } from '../../lib/supabase';
import { logger } from '../../lib/logger';
import { useToast } from '../../components/ui/ToastProvider';
import { colors } from '../../lib/theme';
import { useAuth } from '../../context/AuthContext';

const MerchantSignupLoadingScreen: React.FC = () => {
  const router = useRouter();
  const { showError } = useToast();
  const { refreshUserRole } = useAuth();

  // Função auxiliar para fazer upload de banner
  const uploadBanner = async (userId: string, imageUri: string): Promise<string | null> => {
    try {
      const fileExt = imageUri.split('.').pop() || 'jpg';
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `business-banners/${fileName}`;

      const fileInfo = await FileSystem.getInfoAsync(imageUri);
      if (!fileInfo.exists) {
        return null;
      }

      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);

      const { error: uploadError } = await supabase.storage
        .from('business-assets')
        .upload(filePath, byteArray, {
          contentType: `image/${fileExt}`,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('business-assets').getPublicUrl(filePath);
      return publicUrl;
    } catch (error) {
      logger.error('[MerchantSignupLoading] Erro ao fazer upload do banner:', error);
      return null;
    }
  };

  // Função auxiliar para fazer upload de logo
  const uploadLogo = async (userId: string, imageUri: string): Promise<string | null> => {
    try {
      const fileExt = imageUri.split('.').pop() || 'jpg';
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `business-logos/${fileName}`;

      const fileInfo = await FileSystem.getInfoAsync(imageUri);
      if (!fileInfo.exists) {
        return null;
      }

      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);

      const { error: uploadError } = await supabase.storage
        .from('business-assets')
        .upload(filePath, byteArray, {
          contentType: `image/${fileExt}`,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('business-assets').getPublicUrl(filePath);
      return publicUrl;
    } catch (error) {
      logger.error('[MerchantSignupLoading] Erro ao fazer upload do logo:', error);
      return null;
    }
  };

  // Função auxiliar para fazer upload de imagens de serviços
  const uploadServiceImages = async (userId: string, imageUris: string[]): Promise<string[]> => {
    if (imageUris.length === 0) return [];

    try {
      const uploadPromises = imageUris.map(async (imageUri, index) => {
        const fileExt = imageUri.split('.').pop() || 'jpg';
        const fileName = `${userId}-${Date.now()}-${index}.${fileExt}`;
        const filePath = `service-images/${fileName}`;

        const fileInfo = await FileSystem.getInfoAsync(imageUri);
        if (!fileInfo.exists) {
          return null;
        }

        const base64 = await FileSystem.readAsStringAsync(imageUri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);

        const { error: uploadError } = await supabase.storage
          .from('services-assets')
          .upload(filePath, byteArray, {
            contentType: `image/${fileExt}`,
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from('services-assets').getPublicUrl(filePath);
        return publicUrl;
      });

      const imageUrls = await Promise.all(uploadPromises);
      return imageUrls.filter((url): url is string => url !== null);
    } catch (error) {
      logger.error('[MerchantSignupLoading] Erro ao fazer upload das imagens de serviços:', error);
      return [];
    }
  };

  useEffect(() => {
    const completeSignup = async () => {
      const draftKey = 'merchant_signup_draft';

      try {
        // Buscar dados salvos no AsyncStorage
        const stored = await AsyncStorage.getItem(draftKey);

        if (!stored) {
          logger.error('[MerchantSignupLoading] Dados do cadastro não encontrados');
          showError('Dados do cadastro não encontrados. Por favor, tente novamente.');
          router.replace('/(auth)/login');
          return;
        }

        let draftData;
        try {
          draftData = JSON.parse(stored);
        } catch (parseError) {
          logger.error('[MerchantSignupLoading] Erro ao fazer parse do draft:', parseError);
          // Limpar draft corrompido
          await AsyncStorage.removeItem(draftKey);
          showError('Dados do cadastro corrompidos. Por favor, tente novamente.');
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
            logger.debug('[MerchantSignupLoading] OAuth detectado, usando sessão existente');
          }

          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData?.session?.user) {
            user = sessionData.session.user;
            session = sessionData.session;

            if (__DEV__) {
              logger.debug('[MerchantSignupLoading] Sessão OAuth recuperada:', user.email);
            }
          } else {
            // Sem sessão, algo deu errado
            showError('Sessão não encontrada. Por favor, tente fazer login novamente.');
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
                user_type: 'merchant',
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
            logger.error('[MerchantSignupLoading] Erro ao criar usuário:', signUpError);
            showError('Não foi possível criar a conta. Tente novamente.');
            router.replace('/(auth)/login');
            await AsyncStorage.removeItem(draftKey);
            return;
          } else if (!signUpData?.user) {
            logger.error('[MerchantSignupLoading] Usuário não foi criado');
            showError('Não foi possível criar a conta. Tente novamente.');
            router.replace('/(auth)/login');
            await AsyncStorage.removeItem(draftKey);
            return;
          } else {
            user = signUpData.user;
            session = signUpData.session;

            if (!session) {
              const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                email: draftData.email,
                password: draftData.password,
              });

              if (signInError || !signInData?.session) {
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

        // Fazer uploads das imagens e coletar erros
        const uploadErrors: string[] = [];
        let bannerUrl: string | null = null;
        if (draftData.banner_image_uri) {
          bannerUrl = await uploadBanner(user.id, draftData.banner_image_uri);
          if (!bannerUrl) {
            uploadErrors.push('Foto de capa');
          }
        }

        let logoUrl: string | null = null;
        if (draftData.logo_image_uri) {
          logoUrl = await uploadLogo(user.id, draftData.logo_image_uri);
          if (!logoUrl) {
            uploadErrors.push('Logotipo');
          }
        }

        // Criar ou atualizar profile
        // IMPORTANTE: Sempre marcar signup_complete: true para evitar logout automático
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: user.id,
            full_name: draftData.full_name,
            user_type: 'merchant',
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
          logger.error('[MerchantSignupLoading] Erro ao criar/atualizar profile:', profileError);
        }

        // Criar ou atualizar business_profile
        // Agora com constraint UNIQUE em owner_id, podemos usar upsert de forma idiomática
        const { data: businessProfileData, error: businessProfileError } = await supabase
          .from('business_profiles')
          .upsert({
            owner_id: user.id,
            business_name: draftData.business_name,
            category_id: draftData.category_id,
            description: draftData.description,
            address: draftData.address,
            banner_url: bannerUrl,
            logo_url: logoUrl,
            business_time: draftData.business_time,
            lunch_break_start: draftData.lunch_break_start,
            lunch_break_end: draftData.lunch_break_end,
            work_days: draftData.work_days,
            accepted_payment_methods: draftData.accepted_payment_methods,
            signup_complete: true,
          }, {
            onConflict: 'owner_id'
          })
          .select('id')
          .single();

        if (businessProfileError) {
          logger.error('[MerchantSignupLoading] Erro ao criar/atualizar business_profile:', businessProfileError);
        }

        const businessId = businessProfileData?.id;

        // Criar serviços se houver
        if (draftData.services && Array.isArray(draftData.services) && draftData.services.length > 0 && businessId) {
          for (const service of draftData.services) {
            // Fazer upload das imagens do serviço
            let serviceImageUrls: string[] = [];
            if (service.service_images_uris && Array.isArray(service.service_images_uris) && service.service_images_uris.length > 0) {
              const expectedCount = service.service_images_uris.length;
              serviceImageUrls = await uploadServiceImages(user.id, service.service_images_uris);
              if (serviceImageUrls.length < expectedCount) {
                uploadErrors.push(`Imagens do serviço "${service.name}"`);
              }
            }

            // Criar serviço
            const { error: serviceError } = await supabase
              .from('services')
              .insert({
                business_id: businessId,
                name: service.name,
                description: service.description,
                price: service.price,
                duration_minutes: service.duration_minutes,
                location_type: service.location_type,
                is_active: service.is_active,
                price_type: service.price_type,
                category_id: draftData.category_id,
                photos: serviceImageUrls.length > 0 ? serviceImageUrls : null,
              });

            if (serviceError) {
              logger.error('[MerchantSignupLoading] Erro ao criar serviço:', serviceError);
            }
          }
        }

        // Limpar dados do draft e flags OAuth
        await AsyncStorage.removeItem(draftKey);
        if (isOAuth) {
          await AsyncStorage.removeItem('oauth_google_signup');
          await AsyncStorage.removeItem('oauth_google_data');
          if (__DEV__) {
            logger.debug('[MerchantSignupLoading] Flags OAuth limpas');
          }
        }

        // Verificar se ainda tem sessão antes de redirecionar
        const { data: finalSessionCheck } = await supabase.auth.getSession();
        if (!finalSessionCheck?.session) {
          Alert.alert(
            'Confirme seu e-mail',
            'Enviamos um e-mail de confirmação. Por favor, confirme seu e-mail e faça login.',
            [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
          );
          return;
        }

        const refreshedRole = await refreshUserRole(user.id);

        if (__DEV__ && refreshedRole !== 'merchant') {
          logger.warn('[MerchantSignupLoading] refreshUserRole retornou role inesperada:', refreshedRole);
        }

        // Notificar sobre erros de upload se houver
        if (uploadErrors.length > 0) {
          Alert.alert(
            'Cadastro realizado com sucesso',
            'Algumas imagens não puderam ser enviadas e podem ser adicionadas depois através do perfil do seu negócio.',
            [{ text: 'OK', onPress: () => router.replace('/(merchant)/dashboard') }]
          );
        } else {
          // Redirecionar para dashboard
          router.replace('/(merchant)/dashboard');
        }

      } catch (error) {
        logger.error('[MerchantSignupLoading] Erro ao completar cadastro:', error);
        showError('Ocorreu um erro ao completar o cadastro. Tente novamente.');
        router.replace('/(auth)/login');
      }
    };

    // Inicia o processo de signup após 1.5s
    // Nota: setTimeout não espera por promises, então chamamos a função async diretamente
    const timeout = setTimeout(() => {
      completeSignup();
    }, 1500);

    return () => clearTimeout(timeout);
  }, [refreshUserRole, router]);

  return (
    <View style={styles.background}>
      <View style={styles.content}>
        <View style={styles.logoWrapper}>
          <LogoWallToAll width={64} height={40} />
        </View>
        <Text style={styles.text}>
          Aguarde, enquanto preparamos tudo para você
        </Text>
      </View>
    </View>
  );
};

export default MerchantSignupLoadingScreen;

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: '#FFFFFF', // fundo branco, como no Figma
  },
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
    color: colors.textPrimary,
    textAlign: 'center',
  },
});


