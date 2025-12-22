/**
 * Supabase Edge Function: Rate Limiting
 * 
 * Esta função implementa rate limiting no servidor para proteger contra abuso de API.
 * Complementa o rate limiting do cliente implementado em lib/hooks/useRateLimit.ts
 * 
 * Uso:
 *   - Chamar esta função antes de operações críticas (login, signup, etc)
 *   - A função retorna status 429 se o limite for excedido
 *   - A função retorna status 200 se a requisição pode prosseguir
 * 
 * Configuração:
 *   - RATE_LIMIT_WINDOW: Janela de tempo em milissegundos (padrão: 1 minuto)
 *   - MAX_REQUESTS: Número máximo de requisições por janela (padrão: 10)
 */

// @ts-expect-error - Deno import from URL
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// @ts-expect-error - Deno import from URL
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minuto
const MAX_REQUESTS = 10; // 10 requisições por minuto

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetAt: number;
  };
}

// Store em memória (em produção, considere usar Redis ou banco de dados)
const store: RateLimitStore = {};

serve(async (req: Request) => {
  try {
    // Obter IP do cliente
    const ip = req.headers.get('x-forwarded-for') || 
               req.headers.get('x-real-ip') || 
               'unknown';
    
    // Obter identificador único (pode ser IP, email, userId, etc)
    const identifier = req.headers.get('x-rate-limit-key') || ip;
    
    const now = Date.now();
    
    // Limpar entradas expiradas (limpeza periódica)
    Object.keys(store).forEach(key => {
      if (store[key].resetAt < now) {
        delete store[key];
      }
    });
    
    // Verificar rate limit
    if (!store[identifier]) {
      // Primeira requisição
      store[identifier] = { 
        count: 1, 
        resetAt: now + RATE_LIMIT_WINDOW 
      };
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          remaining: MAX_REQUESTS - 1,
          resetAt: store[identifier].resetAt
        }), 
        { 
          status: 200,
          headers: { 
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': String(MAX_REQUESTS),
            'X-RateLimit-Remaining': String(MAX_REQUESTS - 1),
            'X-RateLimit-Reset': String(store[identifier].resetAt),
          }
        }
      );
    }
    
    const entry = store[identifier];
    
    // Se a janela expirou, resetar
    if (now >= entry.resetAt) {
      entry.count = 1;
      entry.resetAt = now + RATE_LIMIT_WINDOW;
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          remaining: MAX_REQUESTS - 1,
          resetAt: entry.resetAt
        }), 
        { 
          status: 200,
          headers: { 
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': String(MAX_REQUESTS),
            'X-RateLimit-Remaining': String(MAX_REQUESTS - 1),
            'X-RateLimit-Reset': String(entry.resetAt),
          }
        }
      );
    }
    
    // Verificar se excedeu o limite
    if (entry.count >= MAX_REQUESTS) {
      const remainingMs = entry.resetAt - now;
      const remainingMinutes = Math.ceil(remainingMs / 60000);
      
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Rate limit exceeded',
          message: `Muitas requisições. Aguarde ${remainingMinutes} minuto(s) antes de tentar novamente.`,
          resetAt: entry.resetAt
        }), 
        { 
          status: 429,
          headers: { 
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': String(MAX_REQUESTS),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(entry.resetAt),
            'Retry-After': String(Math.ceil(remainingMs / 1000)),
          }
        }
      );
    }
    
    // Incrementar contador
    entry.count++;
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        remaining: MAX_REQUESTS - entry.count,
        resetAt: entry.resetAt
      }), 
      { 
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(MAX_REQUESTS),
          'X-RateLimit-Remaining': String(MAX_REQUESTS - entry.count),
          'X-RateLimit-Reset': String(entry.resetAt),
        }
      }
    );
  } catch (error) {
    // Em caso de erro, permitir a requisição (fail open)
    // Mas logar o erro para investigação
    console.error('[RateLimit] Erro:', error);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        error: 'Rate limit check failed, allowing request',
        remaining: MAX_REQUESTS
      }), 
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
});



