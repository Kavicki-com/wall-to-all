import { logger } from '../logger';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';

/**
 * Extrai os parâmetros de autenticação do fragmento (#) da URL
 * O Supabase envia tokens no formato: walltoall://reset-password#access_token=xxx&refresh_token=xxx&type=recovery
 */
export const extractAuthParams = (url: string): Record<string, string | boolean> | null => {
    try {
        if (__DEV__) {
            logger.debug('[DeepLinking] extractAuthParams - Iniciando extração');
            logger.debug('[DeepLinking] extractAuthParams - URL length:', url.length);
        }

        // Procura por fragmento (#) na URL
        const hashIndex = url.indexOf('#');
        if (__DEV__) {
            logger.debug('[DeepLinking] extractAuthParams - hashIndex:', hashIndex);
        }

        if (hashIndex === -1) {
            if (__DEV__) {
                logger.warn('[DeepLinking] extractAuthParams - ✗ Nenhum hash (#) encontrado na URL');
            }
            return null;
        }

        // Decodifica o fragment para tratar %26 como &
        const fragment = decodeURIComponent(url.substring(hashIndex + 1));
        if (__DEV__) {
            logger.debug('[DeepLinking] extractAuthParams - Fragment decodificado (primeiros 100 chars):', fragment.substring(0, 100));
        }
        const params: Record<string, string> = {};

        // Parse dos parâmetros do fragmento
        const pairs = fragment.split('&');
        if (__DEV__) {
            logger.debug('[DeepLinking] extractAuthParams - Número de pares encontrados:', pairs.length);
        }
        pairs.forEach((pair, index) => {
            const [key, value] = pair.split('=');
            if (key && value) {
                const decodedKey = decodeURIComponent(key);
                const decodedValue = decodeURIComponent(value);
                params[decodedKey] = decodedValue;
                if (__DEV__ && index < 3) { // Log apenas os primeiros 3 para não poluir
                    logger.debug(`[DeepLinking] extractAuthParams - Par ${index}: ${decodedKey} = ${decodedValue.substring(0, 50)}...`);
                }
            }
        });

        if (__DEV__) {
            logger.debug('[DeepLinking] extractAuthParams - Params extraídos:', {
                keys: Object.keys(params),
                hasAccessToken: !!params.access_token,
                hasRefreshToken: !!params.refresh_token,
                hasType: !!params.type,
                hasError: !!params.error,
                errorCode: params.error_code,
            });
        }

        // Verifica se a URL contém erros do Supabase (link expirado/inválido)
        if (params.error || params.error_code) {
            if (__DEV__) {
                logger.error('[DeepLinking] extractAuthParams - ✗ URL contém erro do Supabase:', {
                    error: params.error,
                    errorCode: params.error_code,
                    errorDescription: params.error_description,
                });
            }
            // Retorna um objeto especial indicando erro
            return { __error: true, error: params.error, error_code: params.error_code, error_description: params.error_description };
        }

        // Verifica se tem os tokens necessários
        if (params.access_token && params.refresh_token) {
            if (__DEV__) {
                logger.debug('[DeepLinking] extractAuthParams - ✓ Tokens extraídos com sucesso!', {
                    hasAccessToken: true,
                    hasRefreshToken: true,
                    hasType: !!params.type,
                    type: params.type,
                });
            }
            return params;
        }

        if (__DEV__) {
            logger.error('[DeepLinking] extractAuthParams - ✗ Faltando tokens!', {
                hasAccessToken: !!params.access_token,
                hasRefreshToken: !!params.refresh_token,
                foundKeys: Object.keys(params),
            });
        }
        return null;
    } catch (error) {
        if (__DEV__) {
            logger.error('[DeepLinking] Erro ao extrair parâmetros:', error);
        }
        return null;
    }
};

/**
 * Salva o código de referral se presente na URL
 * Suporta formatos: ?ref=CODE ou ?referral=CODE
 */
export const extractAndSaveReferralCode = async (url: string, isInitialUrl = false): Promise<string | null> => {
  try {
    const { queryParams } = Linking.parse(url);
    const refCode = queryParams?.ref || queryParams?.referral;

    if (refCode && typeof refCode === 'string') {
      const upperRefCode = refCode.toUpperCase();

      // Se for URL inicial, verificar se é o mesmo código que acabou de ser usado
      // Isso evita que o código "volte das cinzas" por persistência do getInitialURL
      if (isInitialUrl) {
        const lastUsed = await AsyncStorage.getItem('last_used_referral_code');
        if (lastUsed === upperRefCode) {
          if (__DEV__) {
            logger.debug('[DeepLinking] Referral code ignorado (sticky initial URL):', upperRefCode);
          }
          return null;
        }
      }

      await AsyncStorage.setItem('referral_code', upperRefCode);
      if (__DEV__) {
        logger.debug('[DeepLinking] Referral code salvo:', refCode);
      }
      return refCode;
    }
  } catch (error) {
    logger.warn('[DeepLinking] Erro ao extrair referral code:', error);
  }
  return null;
};

