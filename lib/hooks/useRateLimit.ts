import { useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../logger';

const RATE_LIMIT_PREFIX = '@walltoall_rate_limit_';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * Hook para rate limiting de ações críticas
 * Usa AsyncStorage para rastrear tentativas por chave (ex: email, IP)
 * 
 * @param key - Chave única para identificar o limite (ex: email, userId)
 * @param maxAttempts - Número máximo de tentativas permitidas
 * @param windowMs - Janela de tempo em milissegundos (padrão: 15 minutos)
 * @returns Função para verificar e incrementar tentativas
 */
export function useRateLimit(
  key: string,
  maxAttempts: number = 5,
  windowMs: number = 15 * 60 * 1000 // 15 minutos
) {
  const storageKey = `${RATE_LIMIT_PREFIX}${key}`;
  const isCheckingRef = useRef(false);

  /**
   * Verifica se a ação pode ser executada
   * @returns true se pode executar, false se excedeu o limite
   */
  const canExecute = useCallback(async (): Promise<boolean> => {
    if (isCheckingRef.current) {
      return false;
    }

    try {
      isCheckingRef.current = true;
      const stored = await AsyncStorage.getItem(storageKey);
      const now = Date.now();

      if (!stored) {
        // Primeira tentativa
        const entry: RateLimitEntry = {
          count: 1,
          resetAt: now + windowMs,
        };
        await AsyncStorage.setItem(storageKey, JSON.stringify(entry));
        return true;
      }

      const entry: RateLimitEntry = JSON.parse(stored);

      // Se a janela expirou, resetar
      if (now >= entry.resetAt) {
        const newEntry: RateLimitEntry = {
          count: 1,
          resetAt: now + windowMs,
        };
        await AsyncStorage.setItem(storageKey, JSON.stringify(newEntry));
        return true;
      }

      // Verificar se excedeu o limite
      if (entry.count >= maxAttempts) {
        const remainingMs = entry.resetAt - now;
        const remainingMinutes = Math.ceil(remainingMs / 60000);
        
        if (__DEV__) {
          logger.warn(`[RateLimit] Limite excedido para ${key}. Aguarde ${remainingMinutes} minuto(s)`);
        }
        return false;
      }

      // Incrementar contador
      entry.count++;
      await AsyncStorage.setItem(storageKey, JSON.stringify(entry));
      return true;
    } catch (error) {
      logger.error('[RateLimit] Erro ao verificar rate limit:', error);
      // Em caso de erro, permitir a execução (fail open)
      return true;
    } finally {
      isCheckingRef.current = false;
    }
  }, [storageKey, maxAttempts, windowMs, key]);

  /**
   * Reseta o contador de tentativas
   */
  const reset = useCallback(async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(storageKey);
      if (__DEV__) {
        logger.debug(`[RateLimit] Contador resetado para ${key}`);
      }
    } catch (error) {
      logger.error('[RateLimit] Erro ao resetar rate limit:', error);
    }
  }, [storageKey, key]);

  /**
   * Obtém informações sobre o rate limit atual
   * @returns Informações sobre tentativas restantes e tempo até reset
   */
  const getInfo = useCallback(async (): Promise<{
    remaining: number;
    resetAt: number;
    isLimited: boolean;
  } | null> => {
    try {
      const stored = await AsyncStorage.getItem(storageKey);
      if (!stored) {
        return {
          remaining: maxAttempts,
          resetAt: Date.now() + windowMs,
          isLimited: false,
        };
      }

      const entry: RateLimitEntry = JSON.parse(stored);
      const now = Date.now();

      if (now >= entry.resetAt) {
        return {
          remaining: maxAttempts,
          resetAt: now + windowMs,
          isLimited: false,
        };
      }

      return {
        remaining: Math.max(0, maxAttempts - entry.count),
        resetAt: entry.resetAt,
        isLimited: entry.count >= maxAttempts,
      };
    } catch (error) {
      logger.error('[RateLimit] Erro ao obter informações:', error);
      return null;
    }
  }, [storageKey, maxAttempts, windowMs]);

  return {
    canExecute,
    reset,
    getInfo,
  };
}

