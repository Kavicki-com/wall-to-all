-- ========================================
-- TRIGGER: Criação Automática de Perfil
-- ========================================
-- Este trigger cria automaticamente um registro na tabela 'profiles'
-- quando um novo usuário é criado em 'auth.users'

-- PASSO 1: Adicionar coluna email (se não existir)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS email text;

-- PASSO 2: Copiar emails existentes de auth.users
UPDATE public.profiles p
SET email = au.email
FROM auth.users au
WHERE p.id = au.id AND p.email IS NULL;

-- PASSO 3: Remover trigger e função antigos
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- PASSO 4: Criar função do trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Inserir perfil com dados do auth.users e metadados
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    user_type,
    avatar_url
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NULL),
    COALESCE((NEW.raw_user_meta_data->>'user_type')::user_type, 'client'::user_type),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NULL)
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log do erro sem bloquear o signup
    RAISE LOG 'ERRO ao criar perfil: % - %', SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$;

-- PASSO 5: Criar trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Comentários para documentação
COMMENT ON FUNCTION public.handle_new_user() IS 
  'Cria automaticamente um perfil na tabela profiles quando um novo usuário é criado. Campos: id, email, full_name, user_type, avatar_url';
COMMENT ON TRIGGER on_auth_user_created ON auth.users IS 
  'Trigger que executa handle_new_user() após INSERT em auth.users';

-- Verificação
SELECT 'Trigger configurado com sucesso!' as status;

