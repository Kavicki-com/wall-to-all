/**
 * Supabase Edge Function: Delete User
 * 
 * Esta função deleta um usuário do auth.users usando o Supabase Admin API.
 * Apenas o próprio usuário autenticado pode deletar sua conta.
 * 
 * Uso:
 *   - Chamar esta função após deletar todos os dados do usuário
 *   - A função requer autenticação (JWT token)
 *   - A função deleta o usuário do auth.users
 */

// @ts-expect-error - Deno import from URL
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// @ts-expect-error - Deno import from URL
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verificar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autenticado' }), 
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Criar cliente Supabase com token do usuário
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Obter usuário atual
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Usuário não encontrado' }), 
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Criar cliente admin para deletar usuário
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Deletar usuário do auth.users
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);

    if (deleteError) {
      console.error('[DeleteUser] Erro ao deletar usuário:', deleteError);
      return new Response(
        JSON.stringify({ 
          error: 'Erro ao deletar usuário',
          details: deleteError.message 
        }), 
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Usuário deletado com sucesso' 
      }), 
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('[DeleteUser] Erro:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno ao deletar usuário',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      }), 
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

