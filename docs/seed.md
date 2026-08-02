# Seed e migração

## Opção A — Seed pelo Apps Script

1. Coloque seu e-mail em `Config.admins`.
2. Faça login no site (ou use o editor).
3. Chame `action: "seed"` (admin). Times demo vêm com `Email` vazio — edite na aba **Times**.

## Opção B — Import manual

1. Rode `setupSpreadsheet` para criar cabeçalhos.
2. Importe CSVs nas abas (Arquivo → Importar → Anexar).
3. Calcule `Limite` = `Ano_Draft` + (4 se Round=1; 3 se Round 2–3; 2 caso contrário), ou deixe o seed/scripts calcularem.

## Picks anuais

Cada time deve ter 7 picks por ano futuro (rodadas 1–7). O seed gera 2026–2028 automaticamente.
