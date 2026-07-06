/**
 * Deep Linking - Módulo principal (re-exports)
 *
 * A lógica foi dividida em sub-módulos para melhor organização:
 * - sessionFlags: flags de sessão (recovery, OAuth, callback)
 * - deepLinkParser: parser de URLs e extração de parâmetros
 * - authTokenProcessor: processamento de tokens e configuração de sessão
 */

// Re-export session flags
export {
  setIsRecoverySession,
  getIsRecoverySession,
  setIsOAuthSignupSession,
  getIsOAuthSignupSession,
  setCallbackProcessed,
  getCallbackProcessed,
} from './deepLink/sessionFlags';

// Re-export URL parser
export { extractAuthParams, extractAndSaveReferralCode } from './deepLink/deepLinkParser';

// Re-export auth token processor
export { processAuthTokensFromUrl } from './deepLink/authTokenProcessor';
