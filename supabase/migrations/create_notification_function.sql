-- Função para criar notificações com bypass de RLS
-- Esta função permite que qualquer usuário autenticado crie notificações para outros usuários
-- Execute esta função no SQL Editor do Supabase

-- Nota: Se a tabela notifications usar um tipo enum, ajuste o cast abaixo
-- Se não usar enum, remova o ::notification_type e use apenas p_type

CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_related_appointment_id INTEGER DEFAULT NULL,
  p_related_reschedule_id INTEGER DEFAULT NULL
)
RETURNS TABLE(id INTEGER) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id INTEGER;
BEGIN
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
    p_type::TEXT,  -- Se usar enum, mude para p_type::notification_type
    p_title,
    p_message,
    p_related_appointment_id,
    p_related_reschedule_id,
    false,
    NOW()
  )
  RETURNING notifications.id INTO v_notification_id;
  
  RETURN QUERY SELECT v_notification_id;
END;
$$;

-- Garantir que usuários autenticados possam executar a função
GRANT EXECUTE ON FUNCTION create_notification(UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER) TO authenticated;

