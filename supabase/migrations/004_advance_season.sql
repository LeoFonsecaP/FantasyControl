-- =========================================
-- AVANÇAR TEMPORADA
-- =========================================

-- Função para avançar temporada (apenas admin)
create or replace function public.rpc_advance_season()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_temporada_atual int;
  v_nova_temporada int;
  v_time_id text;
  v_round int;
  v_pick_id text;
  v_count int;
begin
  if not public.is_admin() then
    raise exception 'Ação restrita a administradores.';
  end if;

  v_temporada_atual := public.get_temporada_atual();
  v_nova_temporada := v_temporada_atual + 1;

  -- Atualiza temporada na tabela config
  update config set valor = v_nova_temporada::text where chave = 'temporada_atual';

  -- Remove jogadores não mantidos (dispensados e ativos) de TODOS os times
  -- Mantém apenas jogadores com status 'mantido'
  delete from jogadores 
  where status != 'mantido';

  -- Deleta todas as picks do ano que virou o atual (nova temporada)
  delete from picks where ano = v_nova_temporada;

  -- Cria novas picks 1-8 para todos os times para temporada Atual+3
  -- Exemplo: de 25 para 26, cria picks para 29
  for v_time_id in select id from times loop
    for v_round in 1..8 loop
      -- Gera ID único para a pick
      select 'P' || lpad((coalesce(max(substring(id from 2)::int), 0) + 1)::text, 3, '0')
      into v_pick_id from picks;

      insert into picks (id, time_dono_atual, time_original, rodada, ano, usado)
      values (v_pick_id, v_time_id, v_time_id, v_round, v_nova_temporada + 3, false);
    end loop;
  end loop;

  return jsonb_build_object(
    'temporadaAnterior', v_temporada_atual,
    'temporadaAtual', v_nova_temporada,
    'mensagem', 'Temporada avançada de ' || v_temporada_atual || ' para ' || v_nova_temporada || '. Novas picks criadas para ' || (v_nova_temporada + 3) || '.'
  );
end;
$$;

-- =========================================
-- FUNÇÃO PARA EDITAR TIME (PRÓPRIA EQUIPE)
-- =========================================

-- Função para usuário editar seu próprio time
create or replace function public.rpc_update_own_team(
  p_nome text default null,
  p_responsavel text default null,
  p_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_time record;
begin
  -- Busca email do usuário logado
  select email into v_email from auth.users where id = auth.uid();
  if v_email is null then
    raise exception 'Faça login com sua conta.';
  end if;

  -- Busca time vinculado ao email do usuário
  select * into v_time from times where lower(email) = lower(v_email) limit 1;
  if v_time is null then
    raise exception 'Você não está vinculado a nenhum time.';
  end if;

  -- Atualiza o time
  if p_nome is not null and trim(p_nome) != '' then
    update times set nome_time = trim(p_nome) where id = v_time.id;
  end if;
  
  if p_responsavel is not null then
    update times set responsavel = trim(p_responsavel) where id = v_time.id;
  end if;
  
  if p_email is not null then
    update times set email = trim(p_email) where id = v_time.id;
  end if;

  -- Retorna time atualizado
  return jsonb_build_object(
    'team', jsonb_build_object(
      'id', v_time.id,
      'nome', coalesce(trim(p_nome), v_time.nome_time),
      'responsavel', coalesce(trim(p_responsavel), v_time.responsavel),
      'email', coalesce(trim(p_email), v_time.email)
    )
  );
end;
$$;