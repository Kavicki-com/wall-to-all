import { useEffect, useRef } from 'react';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { processAuthTokensFromUrl } from '../useDeepLinking';
import { logger } from '../logger';

/**
 * Hook para gerenciar deep links de autenticação (reset e OAuth)
 * Intercepta deep links ANTES do Expo Router processá-los
 * Isso garante que possamos processar os tokens mesmo quando a Activity é reiniciada
 */
export function useDeepLinkHandler() {
  const router = useRouter();
  const deepLinkProcessedRef = useRef(false);

  const isAuthLink = (url?: string | null) => {
    if (!url) return false;
    const sanitized = url.toLowerCase();
    return sanitized.includes('reset-password') || sanitized.includes('auth/callback');
  };

  const navigateAfterProcess = (url: string) => {
    if (url.toLowerCase().includes('reset-password')) {
      router.replace('/(auth)/reset-password');
    } else {
      // OAuth callback: deixa o roteamento principal decidir o destino
      router.replace('/');
    }
  };

  useEffect(() => {
    const handleDeepLink = async (event: { url: string }) => {
      if (__DEV__) {
        logger.debug('[useDeepLinkHandler] ========== handleDeepLink CHAMADO ==========');
        console.log('[DEBUG] useDeepLinkHandler - URL recebida:', event.url?.substring(0, 100));
      }
      
      // Ignora URLs do Expo dev server
      if (event.url && event.url.includes('expo-development-client')) {
        if (__DEV__) { 
          logger.debug('[useDeepLinkHandler] URL do Expo dev server ignorada no listener global:', event.url);
        }
        // Tenta obter a URL real do getInitialURL
        try {
          const realUrl = await Linking.getInitialURL();
          
          if (realUrl && isAuthLink(realUrl) && !realUrl.includes('expo-development-client')) {
            if (__DEV__) { 
              logger.debug('[useDeepLinkHandler] URL real encontrada via getInitialURL:', realUrl);
            }
            // Processa os tokens e navega para reset-password
            try {
              const success = await processAuthTokensFromUrl(realUrl);
              if (success) {
                if (__DEV__) { 
                  logger.debug('[useDeepLinkHandler] Tokens processados com sucesso, navegando após getInitialURL');
                }
                navigateAfterProcess(realUrl);
                deepLinkProcessedRef.current = true;
              }
            } catch (error: unknown) {
              if (__DEV__) {
                logger.error('[useDeepLinkHandler] Erro ao processar tokens:', error);
              }
              // Se for erro do Supabase, navega para reset-password mesmo assim
              // O componente reset-password.tsx vai tratar o erro
              if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' && error.message.startsWith('SUPABASE_ERROR:')) {
                navigateAfterProcess(realUrl);
                deepLinkProcessedRef.current = true;
              }
            }
          }
        } catch (error) {
          if (__DEV__) {
            logger.warn('[useDeepLinkHandler] Erro ao obter URL real:', error);
          }
        }
        return;
      }
      
      // Se for um deep link de autenticação, processa os tokens e navega
      if (event.url && isAuthLink(event.url) && !deepLinkProcessedRef.current) {
        if (__DEV__) { 
          logger.debug('[useDeepLinkHandler] ========== Deep link de autenticação detectado ==========');
          console.log('[DEBUG] useDeepLinkHandler - isAuthLink: true, processando...');
        }
        deepLinkProcessedRef.current = true;
        
        try {
          if (__DEV__) {
            console.log('[DEBUG] useDeepLinkHandler - Chamando processAuthTokensFromUrl...');
          }
          const success = await processAuthTokensFromUrl(event.url);
          
          if (__DEV__) {
            console.log('[DEBUG] useDeepLinkHandler - processAuthTokensFromUrl retornou:', success);
          }
          
          if (success) {
            if (__DEV__) { 
              logger.debug('[useDeepLinkHandler] ========== Tokens processados com sucesso ==========');
              console.log('[DEBUG] useDeepLinkHandler - Navegando para reset-password');
            }
            navigateAfterProcess(event.url);
          } else {
            // Mesmo se falhar, navega para reset-password para mostrar o erro
            if (__DEV__) { 
              logger.debug('[useDeepLinkHandler] ========== Falha ao processar tokens ==========');
              console.log('[DEBUG] useDeepLinkHandler - Falhou mas navegando mesmo assim');
            }
            navigateAfterProcess(event.url);
          }
        } catch (error: unknown) {
          if (__DEV__) {
            logger.error('[useDeepLinkHandler] ========== ERRO ao processar tokens ==========');
            console.error('[DEBUG] useDeepLinkHandler - Erro:', error);
          }
          // Se for erro do Supabase, navega para reset-password mesmo assim
          if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' && error.message.startsWith('SUPABASE_ERROR:')) {
            if (__DEV__) {
              console.log('[DEBUG] useDeepLinkHandler - Erro do Supabase, navegando mesmo assim');
            }
            navigateAfterProcess(event.url);
          }
        }
      }
    };
    
    // Registra o listener global
    const subscription = Linking.addEventListener('url', handleDeepLink);
    
    // Também verifica getInitialURL() periodicamente para warm start
    let checkInterval: NodeJS.Timeout | null = null;
    let checkCount = 0;
    const maxChecks = 20; // 6 segundos (20 * 300ms)
    
    const startPeriodicCheck = () => {
      checkInterval = setInterval(async () => {
        checkCount++;
        
        // Para se já processou ou excedeu o limite
        if (deepLinkProcessedRef.current || checkCount >= maxChecks) {
          if (checkInterval) {
            clearInterval(checkInterval);
            checkInterval = null;
          }
          return;
        }
        
        try {
          const checkUrl = await Linking.getInitialURL();
          
          if (checkUrl && isAuthLink(checkUrl) && !checkUrl.includes('expo-development-client') && !deepLinkProcessedRef.current) {
            if (__DEV__) { 
              logger.debug('[useDeepLinkHandler] URL encontrada na verificação periódica, processando...');
            }
            deepLinkProcessedRef.current = true;
            
            if (checkInterval) {
              clearInterval(checkInterval);
              checkInterval = null;
            }
            
            try {
              const success = await processAuthTokensFromUrl(checkUrl);
              if (success) {
                if (__DEV__) { 
                  logger.debug('[useDeepLinkHandler] Tokens processados com sucesso na verificação periódica, navegando');
                }
                navigateAfterProcess(checkUrl);
              } else {
                navigateAfterProcess(checkUrl);
              }
            } catch (error: unknown) {
              if (__DEV__) {
                logger.error('[useDeepLinkHandler] Erro ao processar tokens na verificação periódica:', error);
              }
              if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' && error.message.startsWith('SUPABASE_ERROR:')) {
                navigateAfterProcess(checkUrl);
              }
            }
          }
        } catch (error) {
          if (__DEV__) {
            logger.warn('[useDeepLinkHandler] Erro na verificação periódica:', error);
          }
        }
      }, 300);
    };
    
    // Inicia a verificação periódica após 500ms
    setTimeout(() => {
      if (!deepLinkProcessedRef.current) {
        startPeriodicCheck();
      }
    }, 500);
    
    return () => {
      subscription.remove();
      if (checkInterval) {
        clearInterval(checkInterval);
      }
      deepLinkProcessedRef.current = false;
    };
  }, [router]);
}
