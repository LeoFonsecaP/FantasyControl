# Liga Dynasty — Gestão de Keepers & Draft Picks

Site interno da liga (10 times): elenco, keeps, trocas, picks e standings, com **Google Sheets** como banco e **Google Apps Script** como API. Frontend estático para **GitHub Pages**.

## Estrutura

```
docs/schema.md      # Schema das abas
gas/                # Apps Script (backend)
frontend/           # Site estático
```

## Setup rápido

> **Passo 1 confuso?** Guia detalhado: [`docs/SETUP-PASSO-1.md`](docs/SETUP-PASSO-1.md)  
> Eu **não consigo** criar a planilha na sua conta Google — você faz em ~5 min com o guia abaixo.

### 1. Planilha (você faz — ~5 min)

1. Abra [sheets.new](https://sheets.new) e crie uma planilha em branco.
2. **Extensões → Apps Script** → apague o `Código.gs` padrão.
3. Copie e cole o conteúdo de [`gas/bundle/AllInOne.gs`](gas/bundle/AllInOne.gs) → **Salvar**.
4. Volte na planilha (F5) → menu **Liga Dynasty → 1. Criar abas (setup)** → autorize.
5. (Opcional) **Liga Dynasty → 2. Popular dados demo**.
6. Edite **Times**: nomes reais + coluna **Email** (Gmail de cada GM).

Detalhes, prints e troubleshooting: [`docs/SETUP-PASSO-1.md`](docs/SETUP-PASSO-1.md).

### 2. Deploy do Web App

1. Implantar → Nova implantação → Tipo: **App da Web**.
2. Executar como: **Usuário que acessa o app da web**.
3. Quem tem acesso: **Qualquer pessoa** (a allowlist de e-mail restringe o uso).
4. Copie a URL `…/exec`.

Com [clasp](https://github.com/google/clasp):

```bash
cd gas
npm i -g @google/clasp
clasp login
# edite .clasp.json com o scriptId
clasp push
clasp deploy --description "dynasty-api"
```

### 3. Seed (opcional)

Com você como admin, no editor rode `actionSeed_` via teste, ou chame a API:

```json
{ "action": "seed", "token": "SEU_TOKEN", "reset": false }
```

Isso cria 10 times demo, jogadores, picks 2026–2028 e standings 2025. **Substitua os e-mails** dos times pelos reais.

### 4. Frontend (GitHub Pages)

1. Publique a pasta `frontend/` (Settings → Pages → Deploy from branch / folder `frontend`, ou action que publica `frontend`).
2. Abra o site, cole a URL do Web App e clique **Entrar com Google**.
3. (Opcional) fixe a URL em `frontend/index.html`:

```js
window.DYNASTY_API_URL = 'https://script.google.com/macros/s/XXXX/exec';
```

## Auth

1. O site abre um popup em `?action=authBridge`.
2. O Apps Script lê o e-mail Google, valida na allowlist (`Times.Email` + `Config.admins`) e devolve um token (CacheService, 6h).
3. As chamadas seguintes enviam `{ token, action, … }` via POST `text/plain` (evita preflight CORS).

## API (actions)

| action | Quem | Descrição |
|--------|------|-----------|
| `me` | liga | Sessão atual |
| `getDashboard` | liga | Resumo dos times |
| `getTeam` | liga | Elenco + picks (`timeId`) |
| `getExpiring` | liga | Alertas (`ano` opcional) |
| `getTrades` / `createTrade` | liga | Histórico / nova troca |
| `getKeepCandidates` / `setKeeps` | liga | Keeps |
| `getStandings` / `upsertStanding` | liga / admin | Standings |
| `listTeams` | liga | Lista de times |
| `seed` | admin | Carga inicial |

## Regras de keeper

| Rodada do draft | Anos de keep | Limite |
|-----------------|--------------|--------|
| 1ª | 4 | Ano_Draft + 4 |
| 2ª–3ª | 3 | Ano_Draft + 3 |
| 4ª+ | 2 | Ano_Draft + 2 |

Elegível se `temporada_atual <= Limite` (ano do draft não consome keep).

## Demo local (sem Google)

Abra `frontend/index.html` (ou sirva a pasta), informe `mock` como URL da API e entre. O mock cobre dashboard, time, alertas, trocas, keeps e standings em memória.

```bash
py -m http.server 5173 --directory frontend
# abra http://localhost:5173 — URL da API: mock
```

## Checklist de teste

- [ ] Demo `mock`: navegar todas as telas e registrar uma troca
- [ ] Login com e-mail autorizado e negação com e-mail fora da lista
- [ ] Dashboard lista 10 times com contagens
- [ ] Página do time: semáforo verde/amarelo/vermelho
- [ ] Alertas filtrando por ano-limite
- [ ] Troca 2 times atualiza donos e aparece no histórico
- [ ] Keep bloqueia jogador fora do limite
- [ ] Admin grava standing + campeão no hall of fame
- [ ] Duas trocas quase simultâneas (LockService)

## Licença

Uso interno da liga.
