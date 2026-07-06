import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from './logger';

const CACHE_PREFIX = '@walltoall_cache_';
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutos

/**
 * TTLs padrão para diferentes tipos de dados (em ms)
 */
export const CACHE_TTLS = {
  categories: 10 * 60 * 1000,   // 10 minutos - raramente muda
  profile: 5 * 60 * 1000,       // 5 minutos
  business: 5 * 60 * 1000,      // 5 minutos
  services: 5 * 60 * 1000,      // 5 minutos
  appointments: 2 * 60 * 1000,  // 2 minutos - muda com frequência
} as const;

/**
 * Chaves de cache padronizadas
 */
export const CACHE_KEYS = {
  categories: 'categories',
  profile: (userId: string) => `profile_${userId}`,
  business: (userId: string) => `business_${userId}`,
  services: (businessId: string | number) => `services_${businessId}`,
  appointments: (userId: string) => `appointments_${userId}`,
} as const;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

/**
 * Sistema de cache usando AsyncStorage
 * Suporta TTL (Time To Live) para expiração automática
 */
export class Cache {
  private static async getKey(key: string): Promise<string> {
    return `${CACHE_PREFIX}${key}`;
  }

  /**
   * Obtém dados do cache
   * @param key - Chave do cache
   * @returns Dados cacheados ou null se não existir ou expirado
   */
  static async get<T>(key: string): Promise<T | null> {
    try {
      const cacheKey = await this.getKey(key);
      const cached = await AsyncStorage.getItem(cacheKey);

      if (!cached) {
        logger.debug('[Cache] Cache miss:', key);
        return null;
      }

      const entry: CacheEntry<T> = JSON.parse(cached);
      const now = Date.now();

      // Verificar se expirou
      if (now - entry.timestamp > entry.ttl) {
        logger.debug('[Cache] Cache expirado:', key);
        await AsyncStorage.removeItem(cacheKey);
        return null;
      }

      logger.debug('[Cache] Cache hit:', key);
      return entry.data;
    } catch (error) {
      logger.error('[Cache] Erro ao ler cache:', error);
      return null;
    }
  }

  /**
   * Salva dados no cache
   * @param key - Chave do cache
   * @param data - Dados a serem cacheados
   * @param ttl - Time to live em milissegundos (padrão: 5 minutos)
   */
  static async set<T>(key: string, data: T, ttl: number = DEFAULT_TTL): Promise<void> {
    try {
      const cacheKey = await this.getKey(key);
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl,
      };
      await AsyncStorage.setItem(cacheKey, JSON.stringify(entry));
      logger.debug('[Cache] Cache salvo:', key, `TTL: ${ttl}ms`);
    } catch (error) {
      logger.error('[Cache] Erro ao salvar cache:', error);
    }
  }

  /**
   * Obtém dados do cache ou busca via fetchFn caso estejam ausentes/expirados.
   * Cacheia o resultado automaticamente.
   * @param key - Chave do cache
   * @param fetchFn - Função assíncrona para buscar os dados
   * @param ttl - Time to live em milissegundos
   */
  static async getOrFetch<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl: number = DEFAULT_TTL,
  ): Promise<T> {
    // Tenta obter do cache
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Cache miss — busca e cacheia
    const data = await fetchFn();
    await this.set(key, data, ttl);
    return data;
  }

  /**
   * Remove um item específico do cache
   * @param key - Chave do cache a ser removida
   */
  static async clear(key: string): Promise<void> {
    try {
      const cacheKey = await this.getKey(key);
      await AsyncStorage.removeItem(cacheKey);
      logger.debug('[Cache] Cache limpo:', key);
    } catch (error) {
      logger.error('[Cache] Erro ao limpar cache:', error);
    }
  }

  /**
   * Limpa todo o cache do app
   */
  static async clearAll(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(CACHE_PREFIX));
      await AsyncStorage.multiRemove(cacheKeys);
      logger.debug('[Cache] Todo o cache foi limpo');
    } catch (error) {
      logger.error('[Cache] Erro ao limpar todo o cache:', error);
    }
  }
}

