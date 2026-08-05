-- =========================================
-- 1. TIMES
-- =========================================
create table times (
  id text primary key,
  nome_time text not null,
  responsavel text not null,
  email text,
  user_id uuid references auth.users(id),
  created_at timestamptz default now()
);

-- =========================================
-- 2. JOGADORES
-- =========================================
create table jogadores (
  id text primary key,
  jogador text not null,
  time_id text references times(id) on delete set null,
  round int,
  ano_draft int,
  limite int,
  status text default 'ativo' check (status in ('ativo', 'mantido', 'dispensado')),
  created_at timestamptz default now()
);

-- =========================================
-- 3. PICKS
-- =========================================
create table picks (
  id text primary key,
  time_dono_atual text references times(id) on delete set null,
  time_original text references times(id) on delete set null,
  rodada int not null,
  ano int not null,
  usado boolean default false,
  created_at timestamptz default now()
);

-- =========================================
-- 4. TROCAS (sempre 2 times)
-- =========================================
create table trocas (
  id text primary key,
  data date not null default current_date,
  descricao text,
  time_1_id text references times(id),
  time_2_id text references times(id),
  payload_json jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- =========================================
-- 5. STANDINGS
-- =========================================
create table standings (
  id text primary key,
  ano int not null,
  time_id text references times(id) on delete set null,
  vitorias int default 0,
  derrotas int default 0,
  empates int default 0,
  posicao_final int,
  pontos numeric,
  campeao boolean default false,
  unique (ano, time_id)
);

-- =========================================
-- 6. CONFIG
-- =========================================
create table config (
  chave text primary key,
  valor text
);

insert into config (chave, valor) values
  ('temporada_atual', '2026');

-- =========================================
-- 7. PROFILES (liga cada login, seja Google ou magic link, a um usuário)
-- =========================================
create table profiles (
  id uuid primary key references auth.users(id),
  email text,
  is_admin boolean default false
);

create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =========================================
-- ROW LEVEL SECURITY
-- =========================================
alter table times enable row level security;
alter table jogadores enable row level security;
alter table picks enable row level security;
alter table trocas enable row level security;
alter table standings enable row level security;
alter table config enable row level security;
alter table profiles enable row level security;

-- Leitura liberada pra qualquer usuário autenticado
create policy "leitura_geral_times" on times for select using (auth.role() = 'authenticated');
create policy "leitura_geral_jogadores" on jogadores for select using (auth.role() = 'authenticated');
create policy "leitura_geral_picks" on picks for select using (auth.role() = 'authenticated');
create policy "leitura_geral_trocas" on trocas for select using (auth.role() = 'authenticated');
create policy "leitura_geral_standings" on standings for select using (auth.role() = 'authenticated');
create policy "leitura_geral_config" on config for select using (auth.role() = 'authenticated');

-- Cada um vê só o próprio profile
create policy "leitura_proprio_profile" on profiles for select using (auth.uid() = id);

-- Escrita: só admin
create policy "escrita_admin_times" on times for all
  using (exists (select 1 from profiles where id = auth.uid() and is_admin))
  with check (exists (select 1 from profiles where id = auth.uid() and is_admin));

create policy "escrita_admin_jogadores" on jogadores for all
  using (exists (select 1 from profiles where id = auth.uid() and is_admin))
  with check (exists (select 1 from profiles where id = auth.uid() and is_admin));

create policy "escrita_admin_picks" on picks for all
  using (exists (select 1 from profiles where id = auth.uid() and is_admin))
  with check (exists (select 1 from profiles where id = auth.uid() and is_admin));

create policy "escrita_admin_trocas" on trocas for all
  using (exists (select 1 from profiles where id = auth.uid() and is_admin))
  with check (exists (select 1 from profiles where id = auth.uid() and is_admin));

create policy "escrita_admin_standings" on standings for all
  using (exists (select 1 from profiles where id = auth.uid() and is_admin))
  with check (exists (select 1 from profiles where id = auth.uid() and is_admin));

create policy "escrita_admin_config" on config for all
  using (exists (select 1 from profiles where id = auth.uid() and is_admin))
  with check (exists (select 1 from profiles where id = auth.uid() and is_admin));

-- =========================================
-- FUNÇÕES AUXILIARES
-- =========================================

-- Retorna a temporada atual
create or replace function public.get_temporada_atual()
returns int
language sql
stable
as $$
  select coalesce((select valor::int from config where chave = 'temporada_atual'), extract(year from now())::int);
$$;

-- Verifica se o usuário atual é admin
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (select 1 from profiles where id = auth.uid() and is_admin);
$$;

-- Calcula anos permitidos por round
create or replace function public.anos_permitidos(round int)
returns int
language sql
immutable
as $$
  select case
    when round = 1 then 4
    when round in (2, 3) then 3
    else 2
  end;
$$;

-- Calcula limite (ano_draft + anos permitidos)
create or replace function public.calcular_limite(round int, ano_draft int)
returns int
language sql
immutable
as $$
  select ano_draft + public.anos_permitidos(round);
$$;

-- =========================================
-- FUNÇÕES RPC (replicam as actions do GAS)
-- =========================================

-- getDashboard: lista times com contagens
create or replace function public.rpc_get_dashboard()
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
    'times', coalesce(jsonb_agg(
      jsonb_build_object(
        'id', t.id,
        'nome', t.nome_time,
        'responsavel', t.responsavel,
        'email', t.email,
        'numJogadores', (select count(*) from jogadores j where j.time_id = t.id and j.status != 'dispensado'),
        'numPicksFuturos', (select count(*) from picks p where p.time_dono_atual = t.id and p.usado = false and p.ano >= v_temporada),
        'proximosDoLimite', (select count(*) from jogadores j where j.time_id = t.id and j.limite - v_temporada <= 1)
      )
    ), '[]'::jsonb)
  ) into v_result
  from times t;

  return v_result;
end;
$$;

-- getTeam: elenco + picks de um time
create or replace function public.rpc_get_team(p_time_id text)
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
    'time', jsonb_build_object(
      'id', t.id,
      'nome', t.nome_time,
      'responsavel', t.responsavel,
      'email', t.email
    ),
    'jogadores', coalesce((
      select jsonb_agg(jsonb_build_object(
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
      ) order by j.jogador)
      from jogadores j
      where j.time_id = p_time_id and j.status != 'dispensado'
    ), '[]'::jsonb),
    'picks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pk.id,
        'rodada', pk.rodada,
        'ano', pk.ano,
        'timeOriginal', pk.time_original,
        'timeOriginalNome', (select nome_time from times where id = pk.time_original),
        'timeDonoAtual', pk.time_dono_atual,
        'timeDonoAtualNome', (select nome_time from times where id = pk.time_dono_atual),
        'original', pk.time_original = p_time_id,
        'usado', pk.usado
      ) order by pk.ano, pk.rodada)
      from picks pk
      where pk.time_dono_atual = p_time_id and pk.usado = false
    ), '[]'::jsonb)
  ) into v_result
  from times t
  where t.id = p_time_id;

  if v_result is null then
    raise exception 'Time não encontrado: %', p_time_id;
  end if;

  return v_result;
end;
$$;

-- getExpiring: jogadores próximos do limite
-- Quando p_ano é null (próxima temporada), inclui dispensados
-- Quando p_ano é específico, inclui apenas ativos (não dispensados)
create or replace function public.rpc_get_expiring(p_ano int default null)
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
  where 
    -- Próxima temporada (p_ano is null): inclui todos (ativos + dispensados)
    (p_ano is null and (j.limite = v_temporada or j.limite = v_temporada + 1))
    -- Ano específico: apenas ativos (não dispensados)
    or (p_ano is not null and j.status != 'dispensado' and j.limite = p_ano);

  return v_result;
end;
$$;

-- getTrades: histórico de trocas
create or replace function public.rpc_get_trades(p_time_id text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'trades', coalesce(jsonb_agg(
      jsonb_build_object(
        'id', tr.id,
        'data', tr.data,
        'descricao', tr.descricao,
        'timesEnvolvidos', coalesce(
          (select jsonb_agg(l->>'timeId') from jsonb_array_elements(tr.payload_json->'lados') l),
          jsonb_build_array(tr.time_1_id, tr.time_2_id)
        ),
        'timesNomes', coalesce(
          (select jsonb_agg((select nome_time from times where id = l->>'timeId'))
           from jsonb_array_elements(tr.payload_json->'lados') l),
          jsonb_build_array(
            (select nome_time from times where id = tr.time_1_id),
            (select nome_time from times where id = tr.time_2_id)
          )
        ),
        'payload', tr.payload_json,
        'criadoPor', coalesce(
          (select email from auth.users where id = tr.created_by),
          'Sistema'
        )
      ) order by tr.data desc
    ), '[]'::jsonb)
  ) into v_result
  from trocas tr
  where p_time_id is null
     or tr.time_1_id = p_time_id
     or tr.time_2_id = p_time_id
     or (tr.payload_json is not null and exists (
       select 1 from jsonb_array_elements(tr.payload_json->'lados') l
       where l->>'timeId' = p_time_id
     ));

  return v_result;
end;
$$;

-- createTrade: registra troca e atualiza jogadores/picks
create or replace function public.rpc_create_trade(p_lados jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lados jsonb := p_lados;
  v_time_ids text[] := '{}';
  v_descricao text;
  v_trade_id text;
  v_payload jsonb;
  v_lado jsonb;
  v_envia jsonb;
  v_jogadores jsonb;
  v_picks jsonb;
  v_jid text;
  v_pid text;
  v_receiver_id text;
  v_nome_time text;
  v_items text[] := '{}';
  v_item text;
  v_player_name text;
  v_pick_desc text;
  v_round int;
  v_ano int;
  v_original_team text;
  v_count int;
begin
  -- Validações
  if jsonb_array_length(v_lados) < 2 then
    raise exception 'Uma troca precisa de pelo menos 2 times.';
  end if;

  -- Verifica times duplicados
  for v_lado in select * from jsonb_array_elements(v_lados)
  loop
    if array_position(v_time_ids, v_lado->>'timeId') is not null then
      raise exception 'Time duplicado na troca: %', v_lado->>'timeId';
    end if;
    v_time_ids := array_append(v_time_ids, v_lado->>'timeId');
  end loop;

  -- Valida jogadores e picks
  for v_lado in select * from jsonb_array_elements(v_lados)
  loop
    v_envia := coalesce(v_lado->'envia', '{}'::jsonb);
    v_jogadores := coalesce(v_envia->'jogadores', '[]'::jsonb);
    v_picks := coalesce(v_envia->'picks', '[]'::jsonb);

    -- Valida jogadores (suporta formato antigo e novo)
    if jsonb_typeof(v_jogadores->0) = 'object' then
      -- Novo formato: array de objetos {id, receiver}
      for v_j in 0..jsonb_array_length(v_jogadores) - 1
      loop
        v_jid := v_jogadores->v_j->>'id';
        if not exists (select 1 from jogadores where id = v_jid and time_id = v_lado->>'timeId' and status != 'dispensado') then
          raise exception 'Jogador % não pertence ao time % ou está dispensado', v_jid, v_lado->>'timeId';
        end if;
      end loop;
    else
      -- Formato antigo: array simples de IDs
      for v_jid in select jsonb_array_elements_text(v_jogadores)
      loop
        if not exists (select 1 from jogadores where id = v_jid and time_id = v_lado->>'timeId' and status != 'dispensado') then
          raise exception 'Jogador % não pertence ao time % ou está dispensado', v_jid, v_lado->>'timeId';
        end if;
      end loop;
    end if;

    -- Valida picks (suporta formato antigo e novo)
    if jsonb_typeof(v_picks->0) = 'object' then
      -- Novo formato: array de objetos {id, receiver}
      for v_p in 0..jsonb_array_length(v_picks) - 1
      loop
        v_pid := v_picks->v_p->>'id';
        if not exists (select 1 from picks where id = v_pid and time_dono_atual = v_lado->>'timeId' and usado = false) then
          raise exception 'Pick % não pertence ao time % ou já foi usado', v_pid, v_lado->>'timeId';
        end if;
      end loop;
    else
      -- Formato antigo: array simples de IDs
      for v_pid in select jsonb_array_elements_text(v_picks)
      loop
        if not exists (select 1 from picks where id = v_pid and time_dono_atual = v_lado->>'timeId' and usado = false) then
          raise exception 'Pick % não pertence ao time % ou já foi usado', v_pid, v_lado->>'timeId';
        end if;
      end loop;
    end if;
  end loop;

  -- Aplica a troca
  for v_count in 0..jsonb_array_length(v_lados) - 1
  loop
    v_lado := v_lados->v_count;
    v_envia := coalesce(v_lado->'envia', '{}'::jsonb);
    
    -- Processa jogadores (suporta formato antigo array e novo objeto com receiver)
    v_jogadores := coalesce(v_envia->'jogadores', '[]'::jsonb);
    if jsonb_typeof(v_jogadores->0) = 'object' then
      -- Novo formato: array de objetos {id, receiver}
      for v_j in 0..jsonb_array_length(v_jogadores) - 1
      loop
        v_jid := v_jogadores->v_j->>'id';
        v_receiver_id := v_jogadores->v_j->>'receiver';
        update jogadores set time_id = v_receiver_id where id = v_jid;
      end loop;
    else
      -- Formato antigo: array simples de IDs
      for v_jid in select jsonb_array_elements_text(v_jogadores)
      loop
        v_receiver_id := v_lados->((v_count + 1) % jsonb_array_length(v_lados))->>'timeId';
        update jogadores set time_id = v_receiver_id where id = v_jid;
      end loop;
    end if;
    
    -- Processa picks (suporta formato antigo array e novo objeto com receiver)
    v_picks := coalesce(v_envia->'picks', '[]'::jsonb);
    if jsonb_typeof(v_picks->0) = 'object' then
      -- Novo formato: array de objetos {id, receiver}
      for v_p in 0..jsonb_array_length(v_picks) - 1
      loop
        v_pid := v_picks->v_p->>'id';
        v_receiver_id := v_picks->v_p->>'receiver';
        update picks set time_dono_atual = v_receiver_id where id = v_pid;
      end loop;
    else
      -- Formato antigo: array simples de IDs
      for v_pid in select jsonb_array_elements_text(v_picks)
      loop
        v_receiver_id := v_lados->((v_count + 1) % jsonb_array_length(v_lados))->>'timeId';
        update picks set time_dono_atual = v_receiver_id where id = v_pid;
      end loop;
    end if;
  end loop;

  -- Gera descrição
  v_descricao := '';
  for v_count in 0..jsonb_array_length(v_lados) - 1
  loop
    v_lado := v_lados->v_count;
    v_envia := coalesce(v_lado->'envia', '{}'::jsonb);
    v_jogadores := coalesce(v_envia->'jogadores', '[]'::jsonb);
    v_picks := coalesce(v_envia->'picks', '[]'::jsonb);
    v_items := '{}';

    select nome_time into v_nome_time from times where id = v_lado->>'timeId';

    -- Processa jogadores (suporta formato antigo e novo)
    if jsonb_typeof(v_jogadores->0) = 'object' then
      -- Novo formato: array de objetos {id, receiver}
      for v_j in 0..jsonb_array_length(v_jogadores) - 1
      loop
        select v_jogadores->v_j->>'id' into v_jid;
        select jogador into v_player_name from jogadores where id = v_jid;
        select nome_time into v_receiver_id from times where id = v_jogadores->v_j->>'receiver';
        v_items := array_append(v_items, coalesce(v_player_name, v_jid) || ' → ' || coalesce(v_receiver_id, '?'));
      end loop;
    else
      -- Formato antigo: array simples de IDs
      for v_jid in select jsonb_array_elements_text(v_jogadores)
      loop
        select jogador into v_player_name from jogadores where id = v_jid;
        v_items := array_append(v_items, coalesce(v_player_name, v_jid));
      end loop;
    end if;

    -- Processa picks (suporta formato antigo e novo)
    if jsonb_typeof(v_picks->0) = 'object' then
      -- Novo formato: array de objetos {id, receiver}
      for v_p in 0..jsonb_array_length(v_picks) - 1
      loop
        select v_picks->v_p->>'id' into v_pid;
        select rodada, ano into v_round, v_ano from picks where id = v_pid;
        select nome_time into v_receiver_id from times where id = v_picks->v_p->>'receiver';
        v_pick_desc := v_round || 'ª ' || v_ano || ' → ' || coalesce(v_receiver_id, '?');
        v_items := array_append(v_items, v_pick_desc);
      end loop;
    else
      -- Formato antigo: array simples de IDs
      for v_pid in select jsonb_array_elements_text(v_picks)
      loop
        select rodada, ano into v_round, v_ano from picks where id = v_pid;
        v_pick_desc := v_round || 'ª ' || v_ano;
        v_items := array_append(v_items, v_pick_desc);
      end loop;
    end if;

    if v_count > 0 then
      v_descricao := v_descricao || ' | ';
    end if;
    v_descricao := v_descricao || coalesce(v_nome_time, v_lado->>'timeId') || ' envia: ' ||
      case when array_length(v_items, 1) > 0 then array_to_string(v_items, ', ') else '(nada)' end;
  end loop;

  -- Gera ID
  select 'X' || lpad((coalesce(max(substring(id from 2)::int), 0) + 1)::text, 3, '0')
  into v_trade_id from trocas;

  v_payload := jsonb_build_object('lados', v_lados);

  insert into trocas (id, data, descricao, time_1_id, time_2_id, payload_json, created_by)
  values (
    v_trade_id,
    current_date,
    v_descricao,
    v_time_ids[1],
    case when array_length(v_time_ids, 1) > 1 then v_time_ids[2] else null end,
    v_payload,
    auth.uid()
  );

  return jsonb_build_object(
    'trade', jsonb_build_object(
      'id', v_trade_id,
      'data', current_date,
      'descricao', v_descricao,
      'timesEnvolvidos', v_time_ids,
      'payload', v_payload
    )
  );
end;
$$;

-- getKeepCandidates: elenco de um time para decisões de keep
create or replace function public.rpc_get_keep_candidates(p_time_id text)
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
    'timeId', p_time_id,
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
      ) order by j.jogador
    ), '[]'::jsonb)
  ) into v_result
  from jogadores j
  join times t on t.id = j.time_id
  where j.time_id = p_time_id and j.status != 'dispensado';

  return v_result;
end;
$$;

-- setKeeps: atualiza status dos jogadores
create or replace function public.rpc_set_keeps(p_time_id text, p_decisoes jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_temporada int := public.get_temporada_atual();
  v_decisao jsonb;
  v_pid text;
  v_status text;
  v_limite int;
  v_updated jsonb := '[]'::jsonb;
begin
  if jsonb_array_length(p_decisoes) = 0 then
    raise exception 'Informe as decisões de keep.';
  end if;

  for v_decisao in select * from jsonb_array_elements(p_decisoes)
  loop
    v_pid := coalesce(v_decisao->>'playerId', v_decisao->>'id');
    v_status := lower(coalesce(v_decisao->>'status', ''));

    if v_status not in ('mantido', 'dispensado', 'ativo') then
      raise exception 'Status inválido: %', v_status;
    end if;

    select limite into v_limite from jogadores where id = v_pid and time_id = p_time_id;
    if v_limite is null then
      raise exception 'Jogador não está no elenco: %', v_pid;
    end if;

    if v_status = 'mantido' and v_limite < v_temporada then
      raise exception 'Jogador % não é elegível a keep (limite %)', v_pid, v_limite;
    end if;

    update jogadores set status = v_status where id = v_pid;
    v_updated := v_updated || jsonb_build_object('id', v_pid, 'status', v_status);
  end loop;

  return jsonb_build_object(
    'timeId', p_time_id,
    'temporada', v_temporada,
    'updated', v_updated
  );
end;
$$;

-- getStandings: standings + campeões
create or replace function public.rpc_get_standings(p_ano int default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'ano', p_ano,
    'anos', coalesce((
      select jsonb_agg(distinct ano order by ano desc) from standings
    ), '[]'::jsonb),
    'standings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'ano', s.ano,
        'timeId', s.time_id,
        'timeNome', t.nome_time,
        'vitorias', s.vitorias,
        'derrotas', s.derrotas,
        'posicaoFinal', s.posicao_final,
        'campeao', s.campeao
      ) order by s.ano desc, s.posicao_final asc)
      from standings s
      join times t on t.id = s.time_id
      where p_ano is null or s.ano = p_ano
    ), '[]'::jsonb),
    'campeoes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'ano', s.ano,
        'timeId', s.time_id,
        'timeNome', t.nome_time,
        'vitorias', s.vitorias,
        'derrotas', s.derrotas,
        'posicaoFinal', s.posicao_final,
        'campeao', s.campeao
      ) order by s.ano desc)
      from standings s
      join times t on t.id = s.time_id
      where s.campeao = true
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

-- upsertStanding: cria ou atualiza standing (admin)
create or replace function public.rpc_upsert_standing(
  p_ano int,
  p_time_id text,
  p_vitorias int default 0,
  p_derrotas int default 0,
  p_posicao_final int default 0,
  p_campeao boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_id text;
  v_id text;
begin
  if not public.is_admin() then
    raise exception 'Ação restrita a administradores.';
  end if;

  if not exists (select 1 from times where id = p_time_id) then
    raise exception 'Time inválido.';
  end if;
  if p_ano is null or p_ano = 0 then
    raise exception 'Informe o ano.';
  end if;

  -- Se campeão, desmarca outros campeões do mesmo ano
  if p_campeao then
    update standings set campeao = false where ano = p_ano and campeao = true;
  end if;

  select id into v_existing_id from standings where ano = p_ano and time_id = p_time_id;

  if v_existing_id is not null then
    update standings
    set vitorias = p_vitorias,
        derrotas = p_derrotas,
        posicao_final = p_posicao_final,
        campeao = p_campeao
    where id = v_existing_id;

    return jsonb_build_object(
      'standing', jsonb_build_object(
        'id', v_existing_id,
        'ano', p_ano,
        'timeId', p_time_id,
        'vitorias', p_vitorias,
        'derrotas', p_derrotas,
        'posicaoFinal', p_posicao_final,
        'campeao', p_campeao
      )
    );
  end if;

  select 'S' || lpad((coalesce(max(substring(id from 2)::int), 0) + 1)::text, 3, '0')
  into v_id from standings;

  insert into standings (id, ano, time_id, vitorias, derrotas, posicao_final, campeao)
  values (v_id, p_ano, p_time_id, p_vitorias, p_derrotas, p_posicao_final, p_campeao);

  return jsonb_build_object(
    'standing', jsonb_build_object(
      'id', v_id,
      'ano', p_ano,
      'timeId', p_time_id,
      'vitorias', p_vitorias,
      'derrotas', p_derrotas,
      'posicaoFinal', p_posicao_final,
      'campeao', p_campeao
    )
  );
end;
$$;

-- getManagementData: dados para gestão (admin)
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

-- upsertTeam: cria ou atualiza time (admin)
create or replace function public.rpc_upsert_team(
  p_id text default null,
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
  v_id text;
  v_existing_id text;
begin
  if not public.is_admin() then
    raise exception 'Ação restrita a administradores.';
  end if;

  if p_nome is null or trim(p_nome) = '' then
    raise exception 'Informe o nome do time.';
  end if;

  -- Busca por ID ou nome
  select id into v_existing_id
  from times
  where (p_id is not null and id = p_id)
     or (p_id is null and lower(nome_time) = lower(trim(p_nome)))
  limit 1;

  if v_existing_id is not null then
    update times
    set nome_time = trim(p_nome),
        responsavel = coalesce(trim(p_responsavel), ''),
        email = coalesce(trim(p_email), '')
    where id = v_existing_id;

    return jsonb_build_object(
      'team', jsonb_build_object(
        'id', v_existing_id,
        'nome', trim(p_nome),
        'responsavel', coalesce(trim(p_responsavel), ''),
        'email', coalesce(trim(p_email), '')
      )
    );
  end if;

  select 'T' || lpad((coalesce(max(substring(id from 2)::int), 0) + 1)::text, 3, '0')
  into v_id from times;

  insert into times (id, nome_time, responsavel, email)
  values (v_id, trim(p_nome), coalesce(trim(p_responsavel), ''), coalesce(trim(p_email), ''));

  return jsonb_build_object(
    'team', jsonb_build_object(
      'id', v_id,
      'nome', trim(p_nome),
      'responsavel', coalesce(trim(p_responsavel), ''),
      'email', coalesce(trim(p_email), '')
    )
  );
end;
$$;

-- upsertPlayer: cria ou atualiza jogador (admin)
create or replace function public.rpc_upsert_player(
  p_id text default null,
  p_jogador text default null,
  p_time_id text default null,
  p_round int default 1,
  p_ano_draft int default null,
  p_status text default 'ativo'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text;
  v_existing_id text;
  v_limite int;
  v_ano int;
begin
  if not public.is_admin() then
    raise exception 'Ação restrita a administradores.';
  end if;

  if p_jogador is null or trim(p_jogador) = '' then
    raise exception 'Informe o nome do jogador.';
  end if;
  if p_time_id is null or trim(p_time_id) = '' then
    raise exception 'Selecione um time para o jogador.';
  end if;

  v_ano := coalesce(p_ano_draft, public.get_temporada_atual());
  v_limite := public.calcular_limite(p_round, v_ano);

  -- Busca por ID ou nome
  select id into v_existing_id
  from jogadores
  where (p_id is not null and id = p_id)
     or (p_id is null and lower(jogador) = lower(trim(p_jogador)))
  limit 1;

  if v_existing_id is not null then
    update jogadores
    set jogador = trim(p_jogador),
        time_id = p_time_id,
        round = p_round,
        ano_draft = v_ano,
        limite = v_limite,
        status = lower(p_status)
    where id = v_existing_id;

    return jsonb_build_object(
      'player', jsonb_build_object(
        'id', v_existing_id,
        'jogador', trim(p_jogador),
        'timeId', p_time_id,
        'round', p_round,
        'anoDraft', v_ano,
        'limite', v_limite,
        'status', lower(p_status)
      )
    );
  end if;

  select 'J' || lpad((coalesce(max(substring(id from 2)::int), 0) + 1)::text, 3, '0')
  into v_id from jogadores;

  insert into jogadores (id, jogador, time_id, round, ano_draft, limite, status)
  values (v_id, trim(p_jogador), p_time_id, p_round, v_ano, v_limite, lower(p_status));

  return jsonb_build_object(
    'player', jsonb_build_object(
      'id', v_id,
      'jogador', trim(p_jogador),
      'timeId', p_time_id,
      'round', p_round,
      'anoDraft', v_ano,
      'limite', v_limite,
      'status', lower(p_status)
    )
  );
end;
$$;

-- listTeams: lista simples de times
create or replace function public.rpc_list_teams()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'times', coalesce(jsonb_agg(
      jsonb_build_object(
        'id', t.id,
        'nome', t.nome_time,
        'responsavel', t.responsavel,
        'email', t.email
      ) order by t.id
    ), '[]'::jsonb)
  ) into v_result
  from times t;

  return v_result;
end;
$$;

-- me: dados do usuário logado
create or replace function public.rpc_me()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_team record;
  v_is_admin boolean;
  v_temporada int;
begin
  select email into v_email from auth.users where id = auth.uid();
  if v_email is null then
    raise exception 'Faça login com sua conta.';
  end if;

  select is_admin into v_is_admin from profiles where id = auth.uid();

  select * into v_team from times where lower(email) = lower(v_email) limit 1;

  v_temporada := public.get_temporada_atual();

  return jsonb_build_object(
    'email', v_email,
    'teamId', v_team.id,
    'teamName', v_team.nome_time,
    'role', case when v_is_admin then 'admin' else 'member' end,
    'isAdmin', coalesce(v_is_admin, false),
    'temporadaAtual', v_temporada
  );
end;
$$;

-- =========================================
-- SEED (opcional, executar manualmente)
-- =========================================

-- Times demo
insert into times (id, nome_time, responsavel, email) values
  ('T001', 'Lakers Legacy', 'GM 1', ''),
  ('T002', 'Celtics Crown', 'GM 2', ''),
  ('T003', 'Heat Wave', 'GM 3', ''),
  ('T004', 'Nets Night', 'GM 4', ''),
  ('T005', 'Suns Empire', 'GM 5', ''),
  ('T006', 'Bucks Dynasty', 'GM 6', ''),
  ('T007', 'Warriors Gold', 'GM 7', ''),
  ('T008', 'Mavs Mavericks', 'GM 8', ''),
  ('T009', 'Nuggets Peak', 'GM 9', ''),
  ('T010', 'Thunder Storm', 'GM 10', '')
on conflict (id) do nothing;

-- Jogadores demo
insert into jogadores (id, jogador, time_id, round, ano_draft, limite, status) values
  ('J001', 'Shai Gilgeous-Alexander', 'T001', 1, 2023, 2027, 'ativo'),
  ('J002', 'Luka Doncic', 'T001', 2, 2024, 2027, 'ativo'),
  ('J003', 'Jayson Tatum', 'T002', 1, 2023, 2027, 'ativo'),
  ('J004', 'Nikola Jokic', 'T002', 3, 2024, 2027, 'ativo'),
  ('J005', 'Giannis Antetokounmpo', 'T003', 1, 2023, 2027, 'ativo'),
  ('J006', 'Anthony Edwards', 'T003', 2, 2024, 2027, 'ativo'),
  ('J007', 'Victor Wembanyama', 'T004', 1, 2023, 2027, 'ativo'),
  ('J008', 'Tyrese Haliburton', 'T004', 4, 2024, 2026, 'ativo'),
  ('J009', 'Donovan Mitchell', 'T005', 1, 2023, 2027, 'ativo'),
  ('J010', 'Devin Booker', 'T005', 2, 2024, 2027, 'ativo'),
  ('J011', 'Jaylen Brown', 'T006', 1, 2023, 2027, 'ativo'),
  ('J012', 'Paolo Banchero', 'T006', 3, 2024, 2027, 'ativo'),
  ('J013', 'Cade Cunningham', 'T007', 1, 2023, 2027, 'ativo'),
  ('J014', 'Franz Wagner', 'T007', 2, 2024, 2027, 'ativo'),
  ('J015', 'Chet Holmgren', 'T008', 1, 2023, 2027, 'ativo'),
  ('J016', 'LaMelo Ball', 'T008', 4, 2024, 2026, 'ativo'),
  ('J017', 'Zion Williamson', 'T009', 1, 2023, 2027, 'ativo'),
  ('J018', 'Ja Morant', 'T009', 2, 2024, 2027, 'ativo'),
  ('J019', 'Bam Adebayo', 'T010', 1, 2023, 2027, 'ativo'),
  ('J020', 'Domantas Sabonis', 'T010', 3, 2024, 2027, 'ativo')
on conflict (id) do nothing;

-- Picks demo (7 rounds × 3 anos × 10 times)
insert into picks (id, time_dono_atual, time_original, rodada, ano, usado)
select
  'P' || lpad(row_number() over (order by t.id, y.ano, r.rodada)::text, 3, '0'),
  t.id,
  t.id,
  r.rodada,
  y.ano,
  false
from times t
cross join (select generate_series(2026, 2028) as ano) y
cross join (select generate_series(1, 7) as rodada) r
on conflict (id) do nothing;

-- Standings demo
insert into standings (id, ano, time_id, vitorias, derrotas, posicao_final, campeao) values
  ('S001', 2025, 'T001', 14, 0, 1, true),
  ('S002', 2025, 'T002', 13, 1, 2, false),
  ('S003', 2025, 'T003', 12, 2, 3, false),
  ('S004', 2025, 'T004', 11, 3, 4, false),
  ('S005', 2025, 'T005', 10, 4, 5, false),
  ('S006', 2025, 'T006', 9, 5, 6, false),
  ('S007', 2025, 'T007', 8, 6, 7, false),
  ('S008', 2025, 'T008', 7, 7, 8, false),
  ('S009', 2025, 'T009', 6, 8, 9, false),
  ('S010', 2025, 'T010', 5, 9, 10, false)
on conflict (id) do nothing;
