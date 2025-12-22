/**
 * Sistema de logging centralizado
 * Protege logs em produção e integra com Sentry quando disponível
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private shouldLog(level: LogLevel): boolean {
    if (__DEV__) return true;
    // Em produção, apenas erros são logados no console
    return level === 'error';
  }

  debug(...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      console.log('[DEBUG]', ...args);
    }
  }

  info(...args: unknown[]): void {
    if (this.shouldLog('info')) {
      console.info('[INFO]', ...args);
    }
  }

  warn(...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      console.warn('[WARN]', ...args);
    }
  }

  error(...args: unknown[]): void {
    // Erros sempre são logados
    console.error('[ERROR]', ...args);
    
    // Em produção, enviar para Sentry se disponível
    if (!__DEV__) {
      try {
        // @ts-expect-error - Sentry pode não estar instalado
        if (typeof Sentry !== 'undefined' && Sentry.captureException) {
          const error = args[0] instanceof Error 
            ? args[0] 
            : new Error(String(args[0]));
          // @ts-expect-error - Sentry pode não estar instalado
          Sentry.captureException(error, {
            extra: args.slice(1),
          });
        }
      } catch {
        // Silenciosamente falhar se Sentry não estiver disponível
      }
    }
  }
}

export const logger = new Logger();

