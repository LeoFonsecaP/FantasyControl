-- =========================================
-- 1. Atualiza rpc_get_management_data para incluir usuários (profiles)
-- =========================================
create or replace function public.rpc_get_management_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Ação restrita a administradores.';
  end if;

  select jsonb_build_object(
    'times', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id,
        'nome', t.nome_time,
        'responsavel', t.responsavel,
        'email', t.email
      ) order by t.id)
      from times t
    ), '[]'::jsonb),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', j.id,
        'jogador', j.jogador,
        'timeId', j.time_id,
        'round', j.round,
        'anoDraft', j.ano_draft,
        'status', j.status
      ) order by j.jogador)
      from jogadores j
    ), '[]'::jsonb),
    'admins', coalesce((
      select jsonb_agg(email) from profiles where is_admin = true
    ), '[]'::jsonb),
    'users', coalesce((
      select jsonb_agg(jsonb_build_object(
        'email', p.email,
        'isAdmin', p.is_admin
      ) order by p.email)
      from profiles p
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

-- =========================================
-- 2. Nova função: vincula/desvincula usuário a um time
--    Também atualiza user_id para um vínculo robusto
-- =========================================
create or replace function public.rpc_link_user_to_team(
  p_email text,
  p_time_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
  v_time_id text := p_time_id;
  v_user_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Ação restrita a administradores.';
  end if;

  if v_email is null or v_email = '' then
    raise exception 'Informe o e-mail do usuário.';
  end if;

  -- Busca o user_id correspondente ao email em auth.users
  select id into v_user_id from auth.users where lower(email) = v_email limit 1;

  -- Se time_id vazio, desvincula (limpa email e user_id do time)
  if v_time_id is null or v_time_id = '' then
    update times set email = null, user_id = null where lower(email) = v_email or user_id = v_user_id;
    return jsonb_build_object(
      'ok', true,
      'message', 'Usuário desvinculado.',
      'email', v_email
    );
  end if;

  if not exists (select 1 from times where id = v_time_id) then
    raise exception 'Time inválido.';
  end if;

  -- Remove o vínculo de outros times (evita duplicidade)
  update times set email = null, user_id = null
  where (lower(email) = v_email or user_id = v_user_id) and id != v_time_id;

  -- Vincula o email e user_id ao time
  update times set email = v_email, user_id = v_user_id where id = v_time_id;

  return jsonb_build_object(
    'ok', true,
    'message', 'Usuário vinculado ao time.',
    'teamId', v_time_id,
    'email', v_email
  );
end;
$$;

-- =========================================
-- 3. Corrige rpc_me para tratar usuário sem time vinculado (convidado)
--    Usa variáveis escalares e verifica por user_id E email (robusto)
-- =========================================
create or replace function public.rpc_me()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_team_id text;
  v_team_name text;
  v_is_admin boolean;
  v_temporada int;
  v_uid uuid := auth.uid();
begin
  select email into v_email from auth.users where id = v_uid;
  if v_email is null then
    raise exception 'Faça login com sua conta.';
  end if;

  select is_admin into v_is_admin from profiles where id = v_uid;

  select t.id, t.nome_time into v_team_id, v_team_name
  from times t
  where t.user_id = v_uid
     or lower(trim(coalesce(t.email, ''))) = lower(trim(v_email))
  limit 1;

  v_temporada := public.get_temporada_atual();

  return jsonb_build_object(
    'email', v_email,
    'teamId', v_team_id,
    'teamName', v_team_name,
    'role', case when v_is_admin then 'admin' else 'member' end,
    'isAdmin', coalesce(v_is_admin, false),
    'temporadaAtual', v_temporada
  );
end;
$$;
