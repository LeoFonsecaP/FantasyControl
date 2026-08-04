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
begin
  if not public.is_admin() then
    raise exception 'Ação restrita a administradores.';
  end if;

  if v_email is null or v_email = '' then
    raise exception 'Informe o e-mail do usuário.';
  end if;

  -- Se time_id vazio, desvincula (limpa email do time)
  if v_time_id is null or v_time_id = '' then
    update times set email = null where lower(email) = v_email;
    return jsonb_build_object(
      'ok', true,
      'message', 'Usuário desvinculado.',
      'email', v_email
    );
  end if;

  if not exists (select 1 from times where id = v_time_id) then
    raise exception 'Time inválido.';
  end if;

  -- Remove o email de outros times (evita duplicidade)
  update times set email = null where lower(email) = v_email and id != v_time_id;

  -- Vincula o email ao time
  update times set email = v_email where id = v_time_id;

  return jsonb_build_object(
    'ok', true,
    'message', 'Usuário vinculado ao time.',
    'teamId', v_time_id,
    'email', v_email
  );
end;
$$;