/**
 * Type Guards e Transformadores de Tipos Seguros
 * 
 * Este módulo fornece funções para validar e transformar dados vindos do Supabase,
 * eliminando a necessidade de usar 'as any' e garantindo type safety em runtime.
 * 
 * Todas as funções retornam null em caso de falha, nunca lançam exceções.
 */

import type {
  WorkDays,
  AcceptedPaymentMethods,
  Service,
  DbService,
  LocationType,
} from './types';

/**
 * Normaliza dados que podem vir como string JSON ou objeto
 * Tenta fazer parse se for string, retorna o objeto se já for objeto
 */
function normalizeJsonData(data: unknown): unknown {
  if (data === null || data === undefined) {
    return null;
  }

  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  return data;
}

/**
 * Valida se um valor é um objeto (não array, não null)
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === '[object Object]'
  );
}

/**
 * Valida se uma string está no formato de hora (HH:MM ou HH:MM:SS)
 */
function isValidTimeFormat(time: string): boolean {
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;
  return timeRegex.test(time);
}

// ===== WORK DAYS =====

/**
 * Type guard para WorkDays
 * Valida se o dado é um Record<string, { start: string; end: string; active?: boolean }>
 */
export function isWorkDays(data: unknown): data is WorkDays {
  if (!isPlainObject(data)) {
    return false;
  }

  // Verificar se todas as propriedades são objetos com start e end
  for (const key in data) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      const value = data[key];

      // Verificar se é um objeto
      if (!isPlainObject(value)) {
        return false;
      }

      // Verificar se tem start e end como strings válidas
      if (
        typeof value.start !== 'string' ||
        typeof value.end !== 'string' ||
        !isValidTimeFormat(value.start) ||
        !isValidTimeFormat(value.end)
      ) {
        return false;
      }

      // Verificar se active é boolean ou undefined (opcional)
      if (value.active !== undefined && typeof value.active !== 'boolean') {
        return false;
      }
    }
  }

  return true;
}

/**
 * Transforma dados do Supabase em WorkDays
 * Trata casos onde o dado vem como string JSON ou objeto
 * Retorna null se falhar na validação
 */
export function parseWorkDays(data: unknown): WorkDays | null {
  const normalized = normalizeJsonData(data);

  if (normalized === null) {
    return null;
  }

  if (isWorkDays(normalized)) {
    return normalized;
  }

  return null;
}

// ===== ACCEPTED PAYMENT METHODS =====

/**
 * Type guard para AcceptedPaymentMethods
 * Valida se o dado é um objeto com propriedades opcionais pix, card, cash (todas boolean)
 */
export function isAcceptedPaymentMethods(data: unknown): data is AcceptedPaymentMethods {
  if (!isPlainObject(data)) {
    return false;
  }

  // Verificar se todas as propriedades são boolean ou undefined
  // Permitir apenas pix, card, cash
  const allowedKeys = ['pix', 'card', 'cash'];
  const keys = Object.keys(data);

  // Verificar se todas as chaves são permitidas
  for (const key of keys) {
    if (!allowedKeys.includes(key)) {
      return false;
    }
  }

  // Verificar se os valores são boolean ou undefined
  if (data.pix !== undefined && typeof data.pix !== 'boolean') {
    return false;
  }
  if (data.card !== undefined && typeof data.card !== 'boolean') {
    return false;
  }
  if (data.cash !== undefined && typeof data.cash !== 'boolean') {
    return false;
  }

  return true;
}

/**
 * Transforma dados do Supabase em AcceptedPaymentMethods
 * Trata casos onde o dado vem como string JSON ou objeto
 * Retorna null se falhar na validação
 */
export function parseAcceptedPaymentMethods(data: unknown): AcceptedPaymentMethods | null {
  const normalized = normalizeJsonData(data);

  if (normalized === null) {
    return null;
  }

  if (isAcceptedPaymentMethods(normalized)) {
    return normalized;
  }

  return null;
}

// ===== SERVICE =====

/**
 * Valida se um valor é um LocationType válido
 */
function isValidLocationType(value: unknown): value is LocationType {
  return value === 'shop' || value === 'home';
}

/**
 * Valida se um objeto é um DbService válido (campos base)
 */
function isDbService(data: unknown): data is DbService {
  if (!isPlainObject(data)) {
    return false;
  }

  // Campos obrigatórios do DbService
  if (
    typeof data.id !== 'number' ||
    typeof data.name !== 'string' ||
    typeof data.business_id !== 'number' ||
    typeof data.duration_minutes !== 'number' ||
    typeof data.price !== 'number' ||
    typeof data.is_active !== 'boolean' ||
    typeof data.created_at !== 'string' ||
    typeof data.updated_at !== 'string' ||
    !isValidLocationType(data.location_type)
  ) {
    return false;
  }

  // Campos opcionais do DbService
  if (data.category_id !== null && data.category_id !== undefined && typeof data.category_id !== 'number') {
    return false;
  }
  if (data.description !== null && data.description !== undefined && typeof data.description !== 'string') {
    return false;
  }
  if (data.is_featured !== null && data.is_featured !== undefined && typeof data.is_featured !== 'boolean') {
    return false;
  }
  if (data.is_trending !== null && data.is_trending !== undefined && typeof data.is_trending !== 'boolean') {
    return false;
  }
  if (data.price_type !== null && data.price_type !== undefined && typeof data.price_type !== 'string') {
    return false;
  }
  if (data.photos !== null && data.photos !== undefined) {
    if (!Array.isArray(data.photos)) {
      return false;
    }
    // Verificar se todos os elementos são strings
    if (!data.photos.every((photo: unknown) => typeof photo === 'string')) {
      return false;
    }
  }

  return true;
}

/**
 * Valida se um objeto tem a estrutura de categories join
 */
function isValidCategoriesJoin(data: unknown): data is { id: number; name: string } {
  if (!isPlainObject(data)) {
    return false;
  }

  return (
    typeof data.id === 'number' &&
    typeof data.name === 'string'
  );
}

/**
 * Valida se um objeto tem a estrutura de business_profiles join
 */
function isValidBusinessProfilesJoin(data: unknown): data is {
  business_name: string;
  logo_url: string | null;
} {
  if (!isPlainObject(data)) {
    return false;
  }

  return (
    typeof data.business_name === 'string' &&
    (data.logo_url === null || typeof data.logo_url === 'string')
  );
}

/**
 * Type guard para Service
 * Valida campos base do DbService e joins opcionais (categories, business_profiles, rating, review_count, recommendation_score)
 */
export function isService(data: unknown): data is Service {
  if (!isDbService(data)) {
    return false;
  }

  // Validar categories join se presente
  const d = data as any;
  if (d.categories !== null && d.categories !== undefined) {
    if (!isValidCategoriesJoin(d.categories)) {
      return false;
    }
  }

  // Validar business_profiles join se presente
  if (d.business_profiles !== null && d.business_profiles !== undefined) {
    if (!isValidBusinessProfilesJoin(d.business_profiles)) {
      return false;
    }
  }

  // Validar campos opcionais de rating
  if (d.rating !== undefined && (typeof d.rating !== 'number' || isNaN(d.rating))) {
    return false;
  }
  if (d.review_count !== undefined && (typeof d.review_count !== 'number' || isNaN(d.review_count) || d.review_count < 0)) {
    return false;
  }
  if (d.recommendation_score !== undefined && (typeof d.recommendation_score !== 'number' || isNaN(d.recommendation_score))) {
    return false;
  }

  return true;
}

/**
 * Transforma dados do Supabase em Service
 * Trata casos onde o dado vem como string JSON ou objeto
 * Retorna null se falhar na validação
 */
export function parseService(data: unknown): Service | null {
  const normalized = normalizeJsonData(data);

  if (normalized === null) {
    return null;
  }

  if (isService(normalized)) {
    return normalized;
  }

  return null;
}
