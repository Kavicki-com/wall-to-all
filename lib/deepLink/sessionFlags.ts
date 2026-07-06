import { logger } from '../logger';

// Flag para indicar que estamos em uma sessão de recuperação de senha
// Isso permite pular a busca de user_role durante o reset de senha
let isRecoverySession = false;
let recoverySessionTimeout: NodeJS.Timeout | null = null;

// Flag para indicar que estamos em um signup via OAuth (Google)
// Isso permite pular a busca de user_role (que não existirá para novos usuários)
let isOAuthSignupSession = false;
let oauthSignupSessionTimeout: NodeJS.Timeout | null = null;

export const setIsRecoverySession = (value: boolean) => {
    isRecoverySession = value;

    // Limpa timeout anterior se existir
    if (recoverySessionTimeout) {
        clearTimeout(recoverySessionTimeout);
    }

    // Limpa a flag após 5 minutos (tempo suficiente para completar o reset)
    if (value) {
        recoverySessionTimeout = setTimeout(() => {
            isRecoverySession = false;
            recoverySessionTimeout = null;
        }, 5 * 60 * 1000);
    } else {
        recoverySessionTimeout = null;
    }
};

export const getIsRecoverySession = (): boolean => {
    return isRecoverySession;
};

export const setIsOAuthSignupSession = (value: boolean) => {
    isOAuthSignupSession = value;

    // Limpa timeout anterior se existir
    if (oauthSignupSessionTimeout) {
        clearTimeout(oauthSignupSessionTimeout);
    }

    // Limpa a flag após 10 minutos (tempo suficiente para completar o signup)
    if (value) {
        oauthSignupSessionTimeout = setTimeout(() => {
            isOAuthSignupSession = false;
            oauthSignupSessionTimeout = null;
        }, 10 * 60 * 1000);
    } else {
        oauthSignupSessionTimeout = null;
    }
};

export const getIsOAuthSignupSession = (): boolean => {
    return isOAuthSignupSession;
};

// Flag para indicar que o callback (app/auth/callback.tsx) já processou a URL
// Isso evita double processing com useDeepLinkHandler
let callbackProcessed = false;

export const setCallbackProcessed = (value: boolean) => {
    callbackProcessed = value;
    if (__DEV__) {
        logger.debug('[useDeepLinking] callbackProcessed:', value);
    }
};

export const getCallbackProcessed = (): boolean => {
    return callbackProcessed;
};
