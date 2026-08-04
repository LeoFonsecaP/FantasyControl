-- =========================================
-- FreeAgentTracker: todos os jogadores por ano de expiração
-- =========================================
create or replace function public.rpc_get_free_agents(p_ano int default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_temporada int := public.get_temporada_atual();
  v_result jsonb;
begin
  select jsonb_build_object(
    'temporadaAtual', v_temporada,
    'filtroAno', p_ano,
    'anos', coalesce((
      select jsonb_agg(distinct j.limite order by j.limite)
      from jogadores j
      where j.status != 'dispensado'
    ), '[]'::jsonb),
    'resumo', coalesce((
      select jsonb_agg(jsonb_build_object(
        'ano', j.limite,
        'total', count(*)
      ) order by j.limite)
      from jogadores j
      where j.status != 'dispensado'
      group by j.limite
    ), '[]'::jsonb),
    'jogadores', coalesce(jsonb_agg(
      jsonb_build_object(
        'id', j.id,
        'jogador', j.jogador,
        'timeId', j.time_id,
        'timeNome', t.nome_time,
        'round', j.round,
        'anoDraft', j.ano_draft,
        'limite', j.limite,
        'status', j.status,
        'elegivel', j.limite >= v_temporada,
        'anosRestantes', j.limite - v_temporada,
        'nivel', case
          when j.limite - v_temporada <= 0 then 'red'
          when j.limite - v_temporada = 1 then 'yellow'
          else 'green'
        end
      ) order by j.limite, j.jogador
    ), '[]'::jsonb)
  ) into v_result
  from jogadores j
  join times t on t.id = j.time_id
  where j.status != 'dispensado'
    and (p_ano is null or j.limite = p_ano);

  return v_result;
end;
$$;