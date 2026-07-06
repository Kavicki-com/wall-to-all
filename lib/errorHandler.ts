import { Alert } from 'react-native';
import { PostgrestError } from '@supabase/supabase-js';
import { ErrorCategory, ErrorContext, getErrorMessage } from './errorMessages';
import { logger } from '../lib/logger';

/**
 * Type guard para verificar se um erro tem propriedades de erro
 */
const isErrorLike = (error: unknown): error is { message?: string; code?: string; name?: string; stack?: string } => {
  return typeof error === 'object' && error !== null;
};

/**
 * Obtém a mensagem de erro de forma segura
 */
const getErrorMessageSafe = (error: unknown): string => {
  if (isErrorLike(error)) {
    return error.message || String(error);
  }
  return String(error);
};

/**
 * Obtém o código de erro de forma segura
 */
const getErrorCodeSafe = (error: unknown): string => {
  if (isErrorLike(error)) {
    return error.code || '';
  }
  return '';
};

export interface ProcessedError {
  category: ErrorCategory;
  userMessage: string;
  shouldRetry: boolean;
  originalError: unknown;
  isNetworkError: boolean;
  isTimeout: boolean;
  isAuthError: boolean;
}

/**
 * Detecta se o erro é relacionado a rede/conexão
 */
const isNetworkError = (error: unknown): boolean => {
  if (!error) return false;

  const errorMessage = getErrorMessageSafe(error).toLowerCase();
  const errorCode = getErrorCodeSafe(error).toLowerCase();

  // Erros de rede comuns
  const networkIndicators = [
    'network',
    'fetch',
    'connection',
    'timeout',
    'econnrefused',
    'enotfound',
    'eai_again',
    'offline',
    'no internet',
    'internet connection',
    'network request failed',
    'networkerror',
  ];

  // Códigos de erro de rede
  const networkCodes = ['econnrefused', 'enotfound', 'eai_again', 'etimedout'];

  return (
    networkIndicators.some((indicator) => errorMessage.includes(indicator)) ||
    networkCodes.some((code) => errorCode.includes(code)) ||
    errorMessage.includes('failed to fetch') ||
    errorMessage.includes('networkerror')
  );
};

/**
 * Detecta se o erro é relacionado a timeout
 */
const isTimeoutError = (error: unknown): boolean => {
  if (!error) return false;

  const errorMessage = getErrorMessageSafe(error).toLowerCase();
  const errorCode = getErrorCodeSafe(error).toLowerCase();

  return (
    errorMessage.includes('timeout') ||
    errorMessage.includes('timed out') ||
    errorCode.includes('timeout') ||
    errorCode.includes('etimedout') ||
    getErrorMessageSafe(error) === 'Timeout ao buscar user_role'
  );
};

/**
 * Detecta se o erro é relacionado a autenticação
 */
const isAuthError = (error: unknown): boolean => {
  if (!error) return false;

  const errorMessage = getErrorMessageSafe(error).toLowerCase();
  const errorCode = getErrorCodeSafe(error).toLowerCase();

  const authIndicators = [
    'invalid login credentials',
    'invalid refresh token',
    'refresh token not found',
    'session not found',
    'unauthorized',
    'authentication',
    'auth',
    'token',
    'jwt',
    'expired',
    'user already registered',
    'new password should be different',
    'same_password',
  ];

  return (
    authIndicators.some((indicator) => errorMessage.includes(indicator)) ||
    errorCode === 'refresh_token_not_found' ||
    errorCode === 'invalid_credentials' ||
    errorCode === 'unauthorized' ||
    errorCode === 'same_password'
  );
};

/**
 * Detecta se o erro é relacionado a validação
 */
const isValidationError = (error: unknown): boolean => {
  if (!error) return false;

  const errorMessage = getErrorMessageSafe(error).toLowerCase();
  const errorCode = getErrorCodeSafe(error).toLowerCase();

  const validationIndicators = [
    'validation',
    'invalid',
    'required',
    'missing',
    'malformed',
    'bad request',
  ];

  return (
    validationIndicators.some((indicator) => errorMessage.includes(indicator)) ||
    errorCode === '23505' || // Unique violation (PostgreSQL)
    errorCode === '23503' || // Foreign key violation
    errorCode === '23502' || // Not null violation
    errorCode === '22P02' || // Invalid input syntax
    errorCode === 'PGRST116' // Not found (PostgREST)
  );
};

/**
 * Detecta se o erro é "não encontrado"
 */
const isNotFoundError = (error: unknown): boolean => {
  if (!error) return false;

  const errorMessage = getErrorMessageSafe(error).toLowerCase();
  const errorCode = getErrorCodeSafe(error).toLowerCase();

  return (
    errorCode === 'PGRST116' || // PostgREST not found
    errorMessage.includes('not found') ||
    errorMessage.includes('does not exist') ||
    errorMessage.includes('no rows')
  );
};

/**
 * Detecta se o erro é relacionado a permissões
 */
const isPermissionError = (error: unknown): boolean => {
  if (!error) return false;

  const errorMessage = getErrorMessageSafe(error).toLowerCase();
  const errorCode = getErrorCodeSafe(error).toLowerCase();

  const permissionIndicators = [
    'permission',
    'forbidden',
    'access denied',
    'unauthorized',
    'not allowed',
  ];

  return (
    permissionIndicators.some((indicator) => errorMessage.includes(indicator)) ||
    errorCode === '42501' || // PostgreSQL insufficient privilege
    errorCode === 'PGRST301' // PostgREST permission denied
  );
};

/**
 * Classifica o erro em uma categoria
 */
const classifyError = (error: unknown): ErrorCategory => {
  if (isNetworkError(error)) {
    return 'network';
  }
  if (isTimeoutError(error)) {
    return 'timeout';
  }
  if (isAuthError(error)) {
    return 'auth';
  }
  if (isValidationError(error)) {
    return 'validation';
  }
  if (isNotFoundError(error)) {
    return 'notFound';
  }
  if (isPermissionError(error)) {
    return 'permission';
  }
  return 'unknown';
};

/**
 * Processa um erro e retorna informações estruturadas
 */
export const handleError = (
  error: unknown,
  context: ErrorContext = 'general'
): ProcessedError => {
  const category = classifyError(error);
  const userMessage = getErrorMessage(category, context);
  const isNetwork = isNetworkError(error);
  const isTimeout = isTimeoutError(error);
  const isAuth = isAuthError(error);

  // Erros de rede e timeout geralmente podem ser retentados
  const shouldRetry = isNetwork || isTimeout;

  // Determina o nível de log baseado no tipo de erro
  // Erros esperados (como credenciais inválidas) usam console.warn
  // Erros inesperados usam console.error
  const errorCode = getErrorCodeSafe(error);
  const errorMessage = getErrorMessageSafe(error);
  const isExpectedError =
    (isAuth && (
      errorCode === 'invalid_credentials' ||
      errorCode === 'same_password' ||
      errorMessage.includes('Invalid login credentials') ||
      errorMessage.toLowerCase().includes('new password should be different')
    )) ||
    (category === 'validation' && context === 'login');

  if (isExpectedError) {
    // Log mais limpo para erros esperados (credenciais inválidas, etc)
    // Usa console.warn para não poluir o console com stack traces desnecessários
    logger.warn(`[ErrorHandler] ${context}: ${category} - ${errorMessage || userMessage}`);
  } else {
    // Log detalhado para erros inesperados
    const errorInfo = {
      category,
      code: errorCode,
      message: errorMessage,
    };
    logger.error(`[ErrorHandler] ${context}:`, errorInfo);

    // Log do erro completo apenas em desenvolvimento para debug
    if (typeof __DEV__ !== 'undefined' && __DEV__ && isErrorLike(error) && error.stack) {
      logger.debug('Stack trace:', error.stack);
    }
  }

  return {
    category,
    userMessage,
    shouldRetry,
    originalError: error,
    isNetworkError: isNetwork,
    isTimeout,
    isAuthError: isAuth,
  };
};

/**
 * Exibe erro usando Alert (para erros críticos que requerem ação do usuário)
 */
export const showErrorAlert = (
  error: unknown,
  context: ErrorContext = 'general',
  title: string = 'Erro'
): void => {
  const processed = handleError(error, context);
  Alert.alert(title, processed.userMessage);
};

/**
 * Exibe erro usando Toast (para erros informativos)
 * Esta função requer que o ToastProvider esteja disponível
 * Se não estiver, usa Alert como fallback
 */
export const showErrorToast = (
  error: unknown,
  context: ErrorContext = 'general'
): void => {
  const processed = handleError(error, context);

  // Tenta usar Toast se disponível (será injetado dinamicamente)
  // Por enquanto, usa Alert como fallback
  // O Toast será usado diretamente nos componentes via useToast hook
  Alert.alert('Erro', processed.userMessage);
};

/**
 * Wrapper para chamadas Supabase que automaticamente trata erros
 */
export const handleSupabaseError = <T>(
  result: { data: T | null; error: PostgrestError | null },
  context: ErrorContext = 'general'
): { data: T | null; error: ProcessedError | null } => {
  if (result.error) {
    const processed = handleError(result.error, context);
    return { data: null, error: processed };
  }
  return { data: result.data, error: null };
};

/**
 * Wrapper para promises que automaticamente trata erros
 */
export const safeAsync = async <T>(
  promise: Promise<T>,
  context: ErrorContext = 'general'
): Promise<{ data: T | null; error: ProcessedError | null }> => {
  try {
    const data = await promise;
    return { data, error: null };
  } catch (error) {
    const processed = handleError(error, context);
    return { data: null, error: processed };
  }
};

/**
 * Executa uma função com retry e exponential backoff.
 * Só tenta novamente para erros de rede ou timeout.
 * @param fn - Função assíncrona a ser executada
 * @param maxRetries - Número máximo de tentativas (padrão: 3)
 * @param baseDelay - Delay base em ms (padrão: 1000)
 * @returns O resultado da função ou lança o último erro
 */
export const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
): Promise<T> => {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Só faz retry se for erro de rede ou timeout
      if (!isNetworkError(error) && !isTimeoutError(error)) {
        throw error;
      }

      // Não faz retry na última tentativa
      if (attempt === maxRetries) {
        break;
      }

      // Exponential backoff: 1s, 2s, 4s...
      const delay = baseDelay * Math.pow(2, attempt);
      logger.debug(`[Retry] Tentativa ${attempt + 1}/${maxRetries} falhou. Retry em ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
};

