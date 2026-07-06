/**
 * Supabase Edge Function: Rate Limiting
 *
 * Esta função implementa rate limiting no servidor para proteger contra abuso de API.
 * Complementa o rate limiting do cliente; agora roda no banco de dados para
 * persistência entre workers.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minuto
const MAX_REQUESTS = 10; // 10 requisições por minuto

// Funções CORS Helper
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-rate-limit-key',
};

// @ts-expect-error - Deno is available in Edge Runtime
Deno.serve(async (req: Request) => {
  // Tratamento de preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('[RateLimit] Starting request check');

    // Obter IP do cliente
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';

    // Obter identificador único
    const identifier = req.headers.get('x-rate-limit-key') || ip;
    console.log('[RateLimit] Identifier:', identifier);

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    console.log('[RateLimit] Configured Supabase URL:', supabaseUrl ? 'Set' : 'Missing');

    const supabaseClient = createClient(
      // @ts-expect-error - Deno is available in the edge function environment
      supabaseUrl,
      // @ts-expect-error - Deno is available in the edge function environment
      supabaseKey,
    );

    console.log('[RateLimit] Calling check_rate_limit RPC for identifier:', identifier);

    // Chamar a RPC no banco de dados para checagem atômica
    const { data, error } = await supabaseClient.rpc('check_rate_limit', {
      p_identifier: identifier,
      p_max_requests: MAX_REQUESTS,
      p_window_ms: RATE_LIMIT_WINDOW,
    });

    console.log('[RateLimit] RPC returned:', { data, error });

    if (error) {
      console.error('[RateLimit] RPC Error:', error);
      throw error;
    }

    // A RPC retorna json_build_object('success', boolean, 'remaining', int, 'resetAt', int, ['error', string])
    // Precisamos checar se allowed
    if (!data.success) {
      const remainingMs = data.resetAt - Date.now();
      const remainingMinutes = Math.max(1, Math.ceil(remainingMs / 60000));

      return new Response(
        JSON.stringify({
          success: false,
          error: data.error || 'Rate limit exceeded',
          message: `Muitas requisições. Aguarde ${remainingMinutes} minuto(s) antes de tentar novamente.`,
          resetAt: data.resetAt,
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': String(MAX_REQUESTS),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(data.resetAt),
            'Retry-After': String(Math.ceil(remainingMs / 1000)),
          },
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        remaining: data.remaining,
        resetAt: data.resetAt,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(MAX_REQUESTS),
          'X-RateLimit-Remaining': String(data.remaining),
          'X-RateLimit-Reset': String(data.resetAt),
        },
      },
    );
  } catch (error) {
    // Em caso de erro, permitir a requisição (fail open)
    // Mas logar o erro para investigação
    console.error('[RateLimit] Erro:', error);

    return new Response(
      JSON.stringify({
        success: true,
        error: 'Rate limit check failed, allowing request',
        remaining: MAX_REQUESTS,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
});
