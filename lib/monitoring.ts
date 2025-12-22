/**
 * Sistema de monitoramento e error tracking
 * Integra com Sentry quando disponível em produção
 */

import * as Sentry from '@sentry/react-native';
import { logger } from './logger';

/**
 * Inicializa o sistema de monitoramento
 * Deve ser chamado no início do app (app/_layout.tsx)
 * ANTES de qualquer outro código que possa gerar erros
 */
export function initMonitoring(): void {
  try {
    const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN || 
      'https://5069c633ad6038272af713324b9e62ee@o4510571980521472.ingest.us.sentry.io/4510571988254720';

    if (__DEV__) {
      // Em desenvolvimento, ainda inicializa mas com configuração reduzida
      logger.info('[Monitoring] Modo desenvolvimento - Sentry inicializado com configuração reduzida');
      Sentry.init({
        dsn: sentryDsn,
        environment: 'development',
        enableAutoSessionTracking: false,
        tracesSampleRate: 0,
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 0,
        // Desabilita integrações pesadas em dev
        integrations: [],
      });
      return;
    }

    // Configuração de produção
    Sentry.init({
      dsn: sentryDsn,
      environment: process.env.EXPO_PUBLIC_ENV || 'production',
      
      // Adds more context data to events (IP address, cookies, user, etc.)
      // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
      sendDefaultPii: true,

      // Enable Logs
      enableLogs: true,

      // Configure Session Replay
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1,
      integrations: [Sentry.mobileReplayIntegration(), Sentry.feedbackIntegration()],

      // Sample rate para performance monitoring
      tracesSampleRate: 0.1, // 10% das transações

      // uncomment the line below to enable Spotlight (https://spotlightjs.com)
      // spotlight: __DEV__,
    });
    
    logger.info('[Monitoring] Sentry inicializado em produção');
  } catch (error) {
    logger.error('[Monitoring] Erro ao inicializar monitoramento:', error);
  }
}

/**
 * Captura uma exceção para monitoramento
 * @param error - Erro a ser capturado
 * @param context - Contexto adicional (opcional)
 */
export function captureException(
  error: Error | unknown,
  context?: Record<string, unknown>
): void {
  // Sempre loga no console em desenvolvimento
  if (__DEV__) {
    logger.error('[Error]', error, context);
  }

  try {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    Sentry.captureException(errorObj, {
      extra: context,
    });
    
    if (!__DEV__) {
      logger.error('[Monitoring] Exceção capturada:', errorObj.message);
    }
  } catch (e) {
    logger.error('[Monitoring] Erro ao capturar exceção:', e);
  }
}

/**
 * Adiciona contexto adicional para próximas capturas
 * @param key - Chave do contexto
 * @param value - Valor do contexto
 */
export function setContext(key: string, value: unknown): void {
  if (__DEV__) {
    logger.debug(`[Monitoring] Contexto: ${key} =`, value);
  }

  try {
    // Garantir que value é um objeto válido ou null
    const contextValue = (value && typeof value === 'object') ? value as Record<string, unknown> : null;
    Sentry.setContext(key, contextValue);
  } catch (e) {
    logger.error('[Monitoring] Erro ao definir contexto:', e);
  }
}

