# Migração para Supabase

Guia passo a passo para migrar do Google Apps Script + Sheets para o Supabase.

## 1. Criar projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) e crie uma conta (ou faça login).
2. Clique em **New Project**.
3. Preencha:
   - **Name**: `fantasy-control` (ou outro nome)
   - **Database Password**: gere uma senha forte
   - **Region**: `South America (São Paulo)` — importante para latência
4. Aguarde o projeto ser criado (~2 minutos).

## 2. Executar o script SQL

1. No dashboard do Supabase, vá em **SQL Editor** → **New query**.
2. Copie o conteúdo de `supabase/migrations/001_initial_schema.sql`.
3. Cole no editor e clique em **Run**.
4. Verifique se não há erros. O script cria:
   - Tabelas: `times`, `jogadores`, `picks`, `trocas`, `standings`, `config`, `profiles`
   - RLS (Row Level Security) com leitura para autenticados e escrita só para admin
   - Funções RPC que replicam as actions do GAS
   - Seed com dados demo (10 times, 20 jogadores, picks, standings)
5. Execute também `supabase/migrations/002_link_user_to_team.sql` para adicionar a função de vínculo de usuário a time.
6. Execute também `supabase/migrations/003_free_agents.sql` para adicionar a função do Free Agent Tracker (todos os jogadores por ano de expiração).

## 3. Configurar autenticação

### Google OAuth

1. No dashboard, vá em **Authentication** → **Providers** → **Google**.
2. Clique em **Enable**.
3. Siga as instruções para criar um OAuth Client ID no Google Cloud Console:
   - **Authorized redirect URIs**: adicione `https://SEU-PROJETO.supabase.co/auth/v1/callback`
   - Copie o **Client ID** e **Client Secret** de volta para o Supabase.
4. Salve.

### Magic Link (e-mail)

1. No dashboard, vá em **Authentication** → **Providers** → **Email**.
2. Certifique-se de que está habilitado.
3. Em **Authentication** → **URL Configuration**, defina:
   - **Site URL**: `https://SEU-USUARIO.github.io` (URL do GitHub Pages)
   - **Redirect URLs**: adicione `https://SEU-USUARIO.github.io/FantasyControl/` (se o site estiver em subpasta)

> **⚠️ Importante**: O Supabase **valida** o `redirect_to` enviado pelo frontend contra a lista de **Redirect URLs** configurada no painel. Se a URL não estiver na lista, o Supabase **ignora** o `redirect_to` e usa o **Site URL** como fallback. Se o Site URL estiver como `http://localhost:5173` (ou similar), o Google vai redirecionar para o localhost mesmo com `DYNASTY_REDIRECT_URL` correto no `index.html`.

> **Como verificar**: No painel do Supabase, vá em **Authentication → URL Configuration** e confirme:
> - **Site URL** = `https://leofonsecap.github.io`
> - **Redirect URLs** contém exatamente `https://leofonsecap.github.io/FantasyControl/` (com a barra final)
>
> Se o Site URL ainda estiver como `http://localhost:5173`, o Supabase vai usar essa URL como fallback quando o `redirect_to` não for permitido.

## 4. Configurar o frontend

1. No dashboard, vá em **Project Settings** → **API**.
2. Copie:
   - **Project URL** (ex: `https://abcdefgh.supabase.co`)
   - **anon public key** (começa com `eyJ...`)
3. Abra `frontend/index.html` e preencha:

```html
<script>
  window.DYNASTY_SUPABASE_URL = 'https://SEU-PROJETO.supabase.co';
  window.DYNASTY_SUPABASE_ANON_KEY = 'SUA-ANON-KEY';
  // URL de redirect pós-login (GitHub Pages)
  window.DYNASTY_REDIRECT_URL = 'https://SEU-USUARIO.github.io/FantasyControl/';
</script>
```

> **Importante**: `DYNASTY_REDIRECT_URL` deve apontar para a URL do GitHub Pages (não localhost), para que o redirect pós-login funcione corretamente.

## 5. Definir admin

Após o primeiro login, o trigger `handle_new_user` cria um profile automaticamente.

Para tornar um usuário admin:

1. No dashboard, vá em **Table Editor** → **profiles**.
2. Encontre o usuário pelo e-mail.
3. Marque `is_admin = true`.

> **Importante**: O primeiro usuário que fizer login não é admin automaticamente. Você precisa marcar manualmente no Table Editor.

## 6. Associar e-mails aos times

1. No dashboard, vá em **Table Editor** → **times**.
2. Para cada time, preencha a coluna `email` com o e-mail do GM.
3. Isso permite que o `rpc_me` identifique o time de cada usuário.

## 7. Deploy no GitHub Pages

1. Faça commit e push das alterações.
2. No GitHub, vá em **Settings** → **Pages**.
3. Selecione a branch `main` e pasta `/docs` (ou `/root` se o frontend estiver na raiz).
4. Aguarde o deploy.

## 8. Testar

1. Acesse o site no GitHub Pages.
2. Clique em **Entrar com Google** ou use **Magic Link**.
3. Verifique se o dashboard carrega com os dados do seed.
4. Teste as páginas: Dashboard, Alertas, Nova troca, Keeps, Histórico, Standings, Gestão.

## Mapeamento de actions GAS → RPC Supabase

| Action GAS | Função RPC |
|------------|------------|
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

## Segurança

- **RLS**: leitura para qualquer usuário autenticado; escrita apenas para admin.
- **RPC functions**: usam `security definer` e verificam `is_admin()` internamente.
- **Anon key**: é pública por design (usada no frontend). A segurança real vem do RLS.
- **Nunca** exponha a `service_role` key no frontend.

## Migração de dados existentes

Se você já tem dados no Google Sheets, exporte cada aba como CSV e importe no Supabase:

1. No Google Sheets: **Arquivo** → **Baixar** → **CSV**.
2. No Supabase: **Table Editor** → selecione a tabela → **Import data from CSV**.
3. Mapeie as colunas conforme o schema.

**Atenção**: os IDs (`T001`, `J001`, etc.) devem ser preservados para manter as referências.