-- ============================================
-- Função RPC para inserir notificações
-- ============================================
-- Esta função contorna as políticas RLS usando SECURITY DEFINER
-- Execute este script no SQL Editor do Supabase

-- 1. Verificar se a função já existe
SELECT 
    proname as function_name,
    pg_get_function_arguments(oid) as arguments
FROM pg_proc
WHERE proname = 'insert_notification';

-- 2. Remover a função se já existir (opcional, para recriar)
DROP FUNCTION IF EXISTS insert_notification(
    p_user_id UUID,
    p_type TEXT,
    p_title TEXT,
    p_message TEXT,
    p_related_appointment_id INTEGER,
    p_related_reschedule_id INTEGER
);

-- 3. Criar a função RPC
CREATE OR REPLACE FUNCTION insert_notification(
    p_user_id UUID,
    p_type TEXT,
    p_title TEXT,
    p_message TEXT,
    p_related_appointment_id INTEGER DEFAULT NULL,
    p_related_reschedule_id INTEGER DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER -- Executa com permissões do criador da função (bypass RLS)
AS $$
DECLARE
    v_notification_id INTEGER;
    v_result JSON;
BEGIN
    -- Validar parâmetros obrigatórios
    IF p_user_id IS NULL OR p_type IS NULL OR p_title IS NULL OR p_message IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Parâmetros obrigatórios não fornecidos'
        );
    END IF;

    -- Inserir a notificação
    -- A coluna 'type' pode ser TEXT ou um enum notification_type
    -- O PostgreSQL fará a conversão automática se necessário
    INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        related_appointment_id,
        related_reschedule_id,
        read,
        created_at
    ) VALUES (
        p_user_id,
        p_type, -- PostgreSQL fará conversão automática se for enum
        p_title,
        p_message,
        p_related_appointment_id,
        p_related_reschedule_id,
        false,
        NOW()
    )
    RETURNING id INTO v_notification_id;

    -- Retornar resultado de sucesso
    v_result := json_build_object(
        'success', true,
        'id', v_notification_id
    );

    RETURN v_result;
EXCEPTION
    WHEN OTHERS THEN
        -- Retornar erro em formato JSON
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM,
            'error_code', SQLSTATE
        );
END;
$$;

-- 4. Garantir que usuários autenticados possam executar a função
GRANT EXECUTE ON FUNCTION insert_notification TO authenticated;
GRANT EXECUTE ON FUNCTION insert_notification TO anon;

-- 5. Verificar se a função foi criada corretamente
SELECT 
    proname as function_name,
    pg_get_function_arguments(oid) as arguments,
    prosecdef as is_security_definer
FROM pg_proc
WHERE proname = 'insert_notification';

-- ============================================
-- Teste da função (opcional - remover após testar)
-- ============================================
-- Descomente as linhas abaixo para testar a função:
/*
SELECT insert_notification(
    '00000000-0000-0000-0000-000000000000'::UUID, -- Substitua por um UUID válido
    'appointment_requested',
    'Teste',
    'Mensagem de teste',
    NULL,
    NULL
);
*/

