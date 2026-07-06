-- Cria a tabela de rate limits
create table if not exists public.rate_limits (
  identifier text primary key,
  count integer not null default 1,
  reset_at timestamp with time zone not null,
  created_at timestamp with time zone default now()
);

-- Ativa o RLS (mesmo que seja acessada apenas via functions_role)
alter table public.rate_limits enable row level security;

-- Permite acesso apenas ao service_role para essa tabela (usada pela edge function)
-- Nenhuma policy pro anon/authenticated para manter invisível aos clientes

-- RPC para incrementar limites atomicamente
create or replace function public.check_rate_limit(
  p_identifier text,
  p_max_requests int,
  p_window_ms int
) returns json
language plpgsql
security definer
as $$
declare
  v_now timestamp with time zone := now();
  v_reset_at timestamp with time zone;
  v_count int;
begin
  -- Bloqueio row-level (atomicidade)
  select count, reset_at into v_count, v_reset_at
  from public.rate_limits
  where identifier = p_identifier
  for update;

  if not found then
    -- Primeira requisição
    v_reset_at := v_now + (p_window_ms || ' milliseconds')::interval;
    insert into public.rate_limits (identifier, count, reset_at)
    values (p_identifier, 1, v_reset_at);
    
    return json_build_object(
      'success', true,
      'remaining', p_max_requests - 1,
      'resetAt', extract(epoch from v_reset_at) * 1000
    );
  end if;

  -- Janela de tempo expirou?
  if v_now >= v_reset_at then
    v_reset_at := v_now + (p_window_ms || ' milliseconds')::interval;
    update public.rate_limits
    set count = 1, reset_at = v_reset_at
    where identifier = p_identifier;

    return json_build_object(
      'success', true,
      'remaining', p_max_requests - 1,
      'resetAt', extract(epoch from v_reset_at) * 1000
    );
  end if;

  -- Excedeu o limite?
  if v_count >= p_max_requests then
    return json_build_object(
      'success', false,
      'error', 'Rate limit exceeded',
      'resetAt', extract(epoch from v_reset_at) * 1000
    );
  end if;

  -- Dentro do limite, incrementa
  update public.rate_limits
  set count = count + 1
  where identifier = p_identifier;

  return json_build_object(
    'success', true,
    'remaining', p_max_requests - (v_count + 1),
    'resetAt', extract(epoch from v_reset_at) * 1000
  );
end;
$$;
