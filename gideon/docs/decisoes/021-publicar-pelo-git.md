# 021 — Publicar a função `gideon` direto do Git (preso a um commit)

**Data:** 12/11/2026 · **Fase:** 0 (Base) · **Situação:** aceita (no ar na versão 41)

## Decisão
- A função `gideon` no Supabase tem **um arquivo só**, `index.ts`, com uma linha que importa o código do repositório no GitHub, **preso a um commit**:
  `import "https://raw.githubusercontent.com/MauricioSUprir/teste/<commit>/gideon/supabase/functions/gideon/index.ts";`
- **Publicar uma versão nova:** fazer o commit e o push, e publicar de novo trocando só o `<commit>`.
- **Voltar atrás:** publicar de novo com o commit anterior. O commit de cada versão fica no `docs/changelog.md`.
- **Função de teste `gideon-teste`:** mesma coisa, para provar um commit antes de levar à produção. Usa os mesmos segredos e as mesmas chaves de acesso; nenhum agendador chama ela.

## Por quê
- Antes, cada publicação mandava os 14 arquivos inteiros (~250 mil letras) e já estourou o limite de uma resposta do Claude no meio do envio. Agora a publicação tem 3 linhas.
- **Preso a um commit:** o conteúdo de um commit não muda; ninguém altera a produção só mexendo no repositório. Mudar o que roda exige publicar de novo.
- Segredos continuam fora do código (variáveis do Supabase e Vault). O repositório já era público.

## Cuidados
- **Só publicar commit que já está no GitHub** (push antes); senão a publicação falha.
- O código no Git tem que ser o mesmo que passou na conferência de tipos (`deno check`).
- O registro do que está no ar é o commit no `index.ts` da função (dá para ver com a ferramenta `get_edge_function`).

## Testes (12/11/2026)
- `gideon-teste` versão 1 (commit `453e7fe`): `pc_status` e uma conversa responderam.
- `gideon` versão 41 (commit `453e7fe`): webhook do Telegram em ordem, conversa simples e lembretes responderam 200.
