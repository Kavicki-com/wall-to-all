// Mock react-native Alert before importing the module
jest.mock('react-native', () => ({
    Alert: { alert: jest.fn() },
}));

// Mock the logger
jest.mock('../../lib/logger', () => ({
    logger: {
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
    },
}));

import {
    handleError,
    handleSupabaseError,
    safeAsync,
    ProcessedError,
} from '../../lib/errorHandler';

// ─── handleError – classification ────────────────────────────────────
describe('handleError – error classification', () => {
    it('classifies network errors', () => {
        const result = handleError(new Error('Network request failed'));
        expect(result.category).toBe('network');
        expect(result.isNetworkError).toBe(true);
        expect(result.shouldRetry).toBe(true);
    });

    it('classifies timeout errors', () => {
        const result = handleError(new Error('Request timed out'));
        expect(result.category).toBe('timeout');
        expect(result.isTimeout).toBe(true);
        expect(result.shouldRetry).toBe(true);
    });

    it('classifies auth errors', () => {
        const result = handleError(new Error('Invalid login credentials'));
        expect(result.category).toBe('auth');
        expect(result.isAuthError).toBe(true);
        expect(result.shouldRetry).toBe(false);
    });

    it('classifies validation errors', () => {
        const result = handleError({ message: 'validation failed', code: '23505' });
        expect(result.category).toBe('validation');
        expect(result.shouldRetry).toBe(false);
    });

    it('classifies not-found errors', () => {
        const result = handleError(new Error('does not exist'));
        expect(result.category).toBe('notFound');

        const result2 = handleError(new Error('no rows'));
        expect(result2.category).toBe('notFound');

        const result3 = handleError(new Error('Resource not found'));
        expect(result3.category).toBe('notFound');
    });

    it('classifies permission errors', () => {
        const result = handleError(new Error('Access denied'));
        expect(result.category).toBe('permission');
        expect(result.shouldRetry).toBe(false);
    });

    it('classifies unknown errors as "unknown"', () => {
        const result = handleError(new Error('Something completely unexpected'));
        expect(result.category).toBe('unknown');
        expect(result.shouldRetry).toBe(false);
    });

    it('handles null/undefined gracefully', () => {
        const result = handleError(null);
        expect(result.category).toBe('unknown');
    });
});

// ─── handleError – ProcessedError shape ──────────────────────────────
describe('handleError – ProcessedError shape', () => {
    it('returns a proper ProcessedError object', () => {
        const original = new Error('test');
        const result = handleError(original, 'login');

        expect(result).toHaveProperty('category');
        expect(result).toHaveProperty('userMessage');
        expect(result).toHaveProperty('shouldRetry');
        expect(result).toHaveProperty('originalError', original);
        expect(result).toHaveProperty('isNetworkError');
        expect(result).toHaveProperty('isTimeout');
        expect(result).toHaveProperty('isAuthError');
        expect(typeof result.userMessage).toBe('string');
        expect(result.userMessage.length).toBeGreaterThan(0);
    });

    it('uses context-specific messages when available', () => {
        const result = handleError(new Error('Invalid login credentials'), 'login');
        // login + auth context should give "E-mail ou senha inválidos"
        expect(result.userMessage).toBe('E-mail ou senha inválidos');
    });
});

// ─── handleSupabaseError ─────────────────────────────────────────────
describe('handleSupabaseError', () => {
    it('passes through successful results', () => {
        const result = handleSupabaseError({ data: { id: 1 }, error: null });
        expect(result.data).toEqual({ id: 1 });
        expect(result.error).toBeNull();
    });

    it('wraps PostgrestError into ProcessedError', () => {
        const pgError = {
            message: 'duplicate key value violates unique constraint',
            code: '23505',
            details: null,
            hint: null,
        };
        const result = handleSupabaseError({ data: null, error: pgError as any });
        expect(result.data).toBeNull();
        expect(result.error).not.toBeNull();
        expect(result.error!.category).toBe('validation');
    });
});

// ─── safeAsync ───────────────────────────────────────────────────────
describe('safeAsync', () => {
    it('returns data on resolved promise', async () => {
        const result = await safeAsync(Promise.resolve('hello'));
        expect(result.data).toBe('hello');
        expect(result.error).toBeNull();
    });

    it('returns ProcessedError on rejected promise', async () => {
        const result = await safeAsync(
            Promise.reject(new Error('Network request failed')),
            'general'
        );
        expect(result.data).toBeNull();
        expect(result.error).not.toBeNull();
        expect(result.error!.category).toBe('network');
    });
});
