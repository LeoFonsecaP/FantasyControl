# Passo 1 — Planilha + Apps Script (5–10 min)

**Eu não consigo criar a planilha na sua conta Google** — isso só você faz, logado no Gmail. O que já está pronto no repo: todo o código. Você só cola e clica.

---

## O que você vai ter no final

- 1 Google Sheet com 6 abas (`Times`, `Jogadores`, `Picks`, `Trocas`, `Standings`, `Config`)
- Apps Script vinculado à planilha
- Menu **Liga Dynasty** na planilha para setup em 2 cliques

---

## Passo a passo

### A. Criar a planilha (1 min)

1. Abra [sheets.new](https://sheets.new) (cria planilha em branco).
2. Renomeie para algo como **Liga Dynasty 2026**.

Pronto. Pode apagar a aba `Planilha1` depois — o script cria as abas certas.

---

### B. Colar o código (3 min)

**Opção fácil — um arquivo só**

1. Abra a pasta `gas/bundle/` neste repo.
2. Abra `AllInOne.gs` → **Ctrl+A, Ctrl+C** (copiar tudo).
3. Na planilha: **Extensões → Apps Script**.
4. Apague o conteúdo do arquivo `Código.gs` padrão e **cole** o que copiou.
5. **Salvar** (Ctrl+S). Nome do projeto: `Liga Dynasty API`.

**Opção avançada — vários arquivos**

Se preferir manter arquivos separados, copie cada `.gs` de `gas/` para um arquivo com o mesmo nome no editor Apps Script. Também copie `appsscript.json` (Projeto → Configurações do projeto → manifest).

---

### C. Autorizar e criar abas (2 min)

1. **Recarregue a planilha** (F5). Deve aparecer o menu **Liga Dynasty** no topo.
2. Clique **Liga Dynasty → 1. Criar abas (setup)**.
3. O Google pede permissão → **Continuar** → escolha sua conta → **Avançado** → **Ir para Liga Dynasty API (não seguro)** → **Permitir**.
4. Confirme o alerta “Setup concluído”.

Você deve ver as abas: `Times`, `Jogadores`, `Picks`, `Trocas`, `Standings`, `Config`.

---

### D. Dados demo (opcional, 1 min)

1. **Liga Dynasty → 2. Popular dados demo**
2. Cria 10 times, jogadores e picks de exemplo.

Depois edite a aba **Times**: troque nomes e preencha a coluna **Email** com o Gmail de cada GM (quem pode entrar no site).

---

### E. Configurar admin e temporada

Na aba **Config**:

| Chave | Valor exemplo |
|-------|----------------|
| `temporada_atual` | `2026` |
| `admins` | `seu@gmail.com` |

O setup já preenche isso com seu e-mail na primeira vez.

---

## Se o menu não aparecer

1. Extensões → Apps Script.
2. Selecione a função `onOpen` ou `setupSpreadsheet` no dropdown.
3. Clique **Executar** (▶).
4. Autorize de novo se pedir.
5. Volte na planilha e recarregue (F5).

---

## Problemas comuns

| Problema | Solução |
|----------|---------|
| “Aba não encontrada” | Rode **1. Criar abas (setup)** de novo |
| Menu não aparece | Execute `onOpen` no editor ou recarregue a planilha |
| Seed falha | Confira se `admins` tem seu e-mail em Config |
| Código muito grande para colar | Use `gas/bundle/AllInOne.gs` (arquivo único) |

---

## Próximo passo

Depois do passo 1, siga o **Passo 2** no [README](../README.md): publicar o Web App e copiar a URL `…/exec`.
