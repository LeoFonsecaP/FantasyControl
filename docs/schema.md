# Schema — Liga Dynasty (Google Sheets)

Uma spreadsheet com 6 abas. IDs: prefixo + sequencial (`T001`, `J001`, `P001`, `X001`, `S001`).

## Times

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| ID | string | Ex.: T001 |
| Nome_Time | string | Nome do time |
| Responsavel | string | Nome do GM |
| Email | string | E-mail Google (allowlist) |

## Jogadores

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| ID | string | Ex.: J001 |
| Jogador | string | Nome do jogador |
| Time_ID | string | FK → Times.ID |
| Round | number | Rodada do draft (1–7+) |
| Ano_Draft | number | Ano em que foi draftado |
| Limite | number | Ano_Draft + anos permitidos |
| Status | string | `ativo` \| `mantido` \| `dispensado` |

**Limite:** Round 1 → +4; Round 2–3 → +3; Round 4+ → +2.

## Picks

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| ID | string | Ex.: P001 |
| Time_Dono_Atual | string | FK → Times.ID |
| Time_Original | string | FK → Times.ID |
| Rodada | number | 1–7 |
| Ano | number | Ano do draft |
| Usado | string | `sim` \| `nao` |

## Trocas

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| ID | string | Ex.: X001 |
| Data | string | ISO date |
| Descricao | string | Resumo legível |
| Times_Envolvidos | string | IDs separados por vírgula |
| Payload_JSON | string | JSON dos lados |

## Standings

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| ID | string | Ex.: S001 |
| Ano | number | Temporada |
| Time_ID | string | FK → Times.ID |
| Vitorias | number | |
| Derrotas | number | |
| Posicao_Final | number | |
| Campeao | string | `sim` \| `nao` |

## Config

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| Chave | string | Ex.: `temporada_atual`, `admins` |
| Valor | string | Ex.: `2026`, `email1@gmail.com,email2@gmail.com` |
