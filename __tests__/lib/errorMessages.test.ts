import {
    getErrorMessage,
    ERROR_MESSAGES,
    CONTEXT_MESSAGES,
    SUCCESS_MESSAGES,
} from '../../lib/errorMessages';

describe('getErrorMessage', () => {
    it('returns context-specific message when available', () => {
        const msg = getErrorMessage('auth', 'login');
        expect(msg).toBe('E-mail ou senha inválidos');
    });

    it('falls back to generic category message when context has no specific one', () => {
        // 'general' context only has 'network' and 'unknown' keys
        const msg = getErrorMessage('auth', 'general');
        // Should fall back to ERROR_MESSAGES.auth
        expect(msg).toBe(ERROR_MESSAGES.auth);
    });

    it('returns general context message when no context is provided', () => {
        const msg = getErrorMessage('network');
        // Default context is 'general', which has its own network message
        expect(msg).toBe('Erro de conexão. Verifique sua internet e tente novamente');
    });

    it('returns validation message for signup context', () => {
        const msg = getErrorMessage('validation', 'signup');
        expect(msg).toBe('Dados inválidos. Verifique as informações e tente novamente');
    });

    it('returns specific upload permission message', () => {
        const msg = getErrorMessage('permission', 'upload');
        expect(msg).toBe(
            'Permissão negada. Verifique as configurações do aplicativo para acessar fotos'
        );
    });
});

describe('ERROR_MESSAGES', () => {
    it('has messages for all categories', () => {
        const categories = [
            'network',
            'auth',
            'validation',
            'notFound',
            'permission',
            'timeout',
            'unknown',
        ] as const;
        for (const cat of categories) {
            expect(ERROR_MESSAGES[cat]).toBeDefined();
            expect(typeof ERROR_MESSAGES[cat]).toBe('string');
            expect(ERROR_MESSAGES[cat].length).toBeGreaterThan(0);
        }
    });
});

describe('SUCCESS_MESSAGES', () => {
    it('has standard success messages', () => {
        expect(SUCCESS_MESSAGES.profileUpdated).toBeDefined();
        expect(SUCCESS_MESSAGES.passwordChanged).toBeDefined();
        expect(SUCCESS_MESSAGES.appointmentCreated).toBeDefined();
    });
});
