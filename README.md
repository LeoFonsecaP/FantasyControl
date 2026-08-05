# Liga Dynasty — Gestão de Keepers & Draft Picks

Site interno da liga (10 times): elenco, keeps, trocas, picks e standings, com **Supabase** como banco + API e **GitHub Pages** como frontend.

## Estrutura

```
supabase/migrations/  # Scripts SQL (schema + RPC + seed)
frontend/             # Site estático
docs/                 # Documentação
gas/                  # (legado) Apps Script — não é mais usado
```

## Setup rápido

> Guia detalhado: [`docs/SETUP-SUPABASE.md`](docs/SETUP-SUPABASE.md)

### 1. Criar projeto Supabase

1. Acesse [supabase.com](https://supabase.com) e crie um projeto.
2. Região: **South America (São Paulo)**.
3. No **SQL Editor**, execute o conteúdo de `supabase/migrations/001_initial_schema.sql`.
   - Cria tabelas, RLS, funções RPC e seed demo.

### 2. Configurar autenticação

1. **Authentication → Providers → Google**: habilite e configure o OAuth Client ID.
2. **Authentication → URL Configuration**:
   - **Site URL**: `https://SEU-USUARIO.github.io`
   - **Redirect URLs**: `https://SEU-USUARIO.github.io/FantasyControl/`

### 3. Configurar o frontend

Abra `frontend/index.html` e preencha:

```js
window.DYNASTY_SUPABASE_URL = 'https://SEU-PROJETO.supabase.co';
window.DYNASTY_SUPABASE_ANON_KEY = 'SUA-ANON-KEY';
window.DYNASTY_REDIRECT_URL = 'https://SEU-USUARIO.github.io/FantasyControl/';
```

### 4. Definir admin

1. Faça login no site.
2. No Supabase → **Table Editor → profiles**, marque `is_admin = true` para o seu usuário.

### 5. Associar e-mails aos times

1. No Supabase → **Table Editor → times**, preencha a coluna `email` de cada time com o e-mail do GM.

### 6. Deploy no GitHub Pages

1. Faça commit e push.
2. GitHub → **Settings → Pages** → selecione a branch e pasta do frontend.

## API (RPC functions)

| Action (frontend) | Função RPC |
|-------------------|------------|
| `me` | `rpc_me()` |
| `getDashboard` | `rpc_get_dashboard()` |
| `getTeam` | `rpc_get_team(p_time_id)` |
| `getExpiring` | `rpc_get_expiring(p_ano)` |
| `getFreeAgents` | `rpc_get_free_agents(p_ano)` |
| `getTrades` | `rpc_get_trades(p_time_id)` |
| `createTrade` | `rpc_create_trade(p_lados)` |
| `getKeepCandidates` | `rpc_get_keep_candidates(p_time_id)` |
| `setKeeps` | `rpc_set_keeps(p_time_id, p_decisoes)` |
| `getStandings` | `rpc_get_standings(p_ano)` |
| `upsertStanding` | `rpc_upsert_standing(...)` |
| `getManagementData` | `rpc_get_management_data()` |
| `upsertTeam` | `rpc_upsert_team(...)` |
| `upsertPlayer` | `rpc_upsert_player(...)` |
| `listTeams` | `rpc_list_teams()` |
| `linkUserToTeam` | `rpc_link_user_to_team(p_email, p_time_id)` |
| `updateOwnTeam` | `rpc_update_own_team(p_nome, p_responsavel, p_email)` |
| `advanceSeason` | `rpc_advance_season()` |

## Funcionalidades por perfil

### Usuário com time
- **Editar próprio time**: Clique no nome do time no header para editar nome, responsável e e-mail
- **Keeps**: Pode gerenciar keeps apenas do seu próprio time (seleção de time oculta)

### Administrador
- **Keeps**: Pode gerenciar keeps de qualquer time (com seletor de time)
- **Gestão**: Acesso à página de gestão completa com:
  - Cadastro e edição de times
  - Vinculação de usuários a times
  - **Avançar temporada**: Botão que automaticamente:
    - Incrementa o ano da temporada
    - Remove jogadores não mantidos (dispensados e ativos) de todos os times
    - Deleta todas as picks do ano atual
    - Cria novas picks 1-8 para todos os times para daqui a 3 temporadas

### Menu condicional
- **Keeps**: Visível apenas para usuários com time ou administradores
- **Gestão**: Visível apenas para administradores

## Regras de keeper

| Rodada do draft | Anos de keep | Limite |
|-----------------|--------------|--------|
| 1ª | 4 | Ano_Draft + 4 |
| 2ª–3ª | 3 | Ano_Draft + 3 |
| 4ª+ | 2 | Ano_Draft + 2 |

Elegível se `temporada_atual <= Limite` (ano do draft não consome keep).

## Segurança

- **RLS**: leitura para autenticados; escrita apenas para admin.
- **RPC functions**: `security definer` + verificação `is_admin()`.
- **Anon key** é pública por design; a segurança real vem do RLS.

## Demo local

Abra `frontend/index.html` (ou sirva a pasta) e faça login com Google ou magic link.

```bash
py -m http.server 5173 --directory frontend
# abra http://localhost:5173
```

## Checklist de teste

- [ ] Login com Google e magic link
- [ ] Dashboard lista 10 times com contagens
- [ ] Página do time: semáforo verde/amarelo/vermelho
- [ ] Alertas filtrando por ano-limite
- [ ] Free Agent Tracker listando jogadores por ano de expiração
- [ ] Troca 2 times atualiza donos e aparece no histórico
- [ ] Keep bloqueia jogador fora do limite
- [ ] Admin grava standing + campeão no hall of fame
- [ ] Usuário com time consegue editar próprio time clicando no nome no header
- [ ] Usuário sem time não vê opção de Keeps no menu
- [ ] Usuário com time vê apenas seu time na página de Keeps (sem seletor)
- [ ] Admin vê todos os times na página de Keeps (com seletor)
- [ ] Página de Gestão não aparece para não-admins
- [ ] Página de Gestão não tem formulário de jogador nem lista de jogadores
- [ ] Botão "Avançar temporada" funciona corretamente na gestão

## Licença

Uso interno da liga.