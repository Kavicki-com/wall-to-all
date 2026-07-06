/**
 * Supabase Edge Function: Send Push Notification
 * 
 * Recebe um payload com dados de notificação e envia push nativo
 * via Expo Push API para todos os dispositivos do usuário.
 * 
 * Pode ser chamado como:
 * 1. Database Webhook (trigger no INSERT da tabela notifications)
 * 2. Chamada direta via supabase.functions.invoke('send-push-notification', {...})
 */

// @ts-expect-error - Deno import from URL
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// @ts-expect-error - Deno import from URL
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationPayload {
    user_id: string;
    type: string;
    title: string;
    message: string;
    related_appointment_id?: number | null;
    related_reschedule_id?: number | null;
}

/**
 * Envia push notifications via Expo Push API.
 * Docs: https://docs.expo.dev/push-notifications/sending-notifications/
 */
async function sendExpoPush(
    tokens: string[],
    title: string,
    body: string,
    data: Record<string, unknown>
): Promise<{ success: boolean; errors?: string[] }> {
    if (tokens.length === 0) {
        return { success: true }; // Nenhum token para enviar
    }

    const messages = tokens.map((token) => ({
        to: token,
        sound: 'default',
        title,
        body,
        data,
        priority: 'high',
        channelId: 'default',
    }));

    try {
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Accept-Encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(messages),
        });

        const result = await response.json();

        if (!response.ok) {
            console.error('[Push] Expo API error:', result);
            return { success: false, errors: [JSON.stringify(result)] };
        }

        // Verificar erros individuais nos tickets
        const errors: string[] = [];
        if (result.data) {
            for (const ticket of result.data) {
                if (ticket.status === 'error') {
                    errors.push(ticket.message || 'Unknown error');
                    console.error('[Push] Ticket error:', ticket);
                }
            }
        }

        return {
            success: errors.length === 0,
            errors: errors.length > 0 ? errors : undefined,
        };
    } catch (error) {
        console.error('[Push] Fetch error:', error);
        return { success: false, errors: [(error as Error).message] };
    }
}

serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // Criar client com service_role para ler push_tokens de qualquer usuário
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

        const body = await req.json();

        // Suporte para Database Webhook (payload vem em record/table)
        // e chamada direta (payload vem no body)
        let notification: NotificationPayload;

        if (body.type === 'INSERT' && body.record) {
            // Database Webhook format
            notification = body.record as NotificationPayload;
        } else {
            // Direct invocation format
            notification = body as NotificationPayload;
        }

        const { user_id, type, title, message, related_appointment_id, related_reschedule_id } = notification;

        if (!user_id || !title || !message) {
            return new Response(
                JSON.stringify({ error: 'Missing required fields: user_id, title, message' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Buscar push tokens do usuário
        const { data: tokens, error: tokenError } = await supabaseAdmin
            .from('push_tokens')
            .select('token')
            .eq('user_id', user_id);

        if (tokenError) {
            console.error('[Push] Erro ao buscar tokens:', tokenError);
            return new Response(
                JSON.stringify({ error: 'Failed to fetch push tokens', details: tokenError.message }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        if (!tokens || tokens.length === 0) {
            console.log('[Push] Nenhum token encontrado para user:', user_id);
            return new Response(
                JSON.stringify({ success: true, message: 'No push tokens registered for user' }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Enviar push via Expo API
        const tokenList = tokens.map((t: { token: string }) => t.token);
        const pushData = {
            type,
            appointment_id: related_appointment_id,
            reschedule_id: related_reschedule_id,
        };

        const result = await sendExpoPush(tokenList, title, message, pushData);

        return new Response(
            JSON.stringify({
                success: result.success,
                tokens_sent: tokenList.length,
                errors: result.errors,
            }),
            {
                status: result.success ? 200 : 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        );
    } catch (error) {
        console.error('[Push] Edge function error:', error);
        return new Response(
            JSON.stringify({ error: (error as Error).message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
