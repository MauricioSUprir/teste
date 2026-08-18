# Prompts de abertura por sprint

Cole no início de cada sprint. Todos assumem que a Fase 0 já foi concluída e aprovada.

---

## Sprint 0 — Fundação

> Vamos ao Sprint 0 de `docs/06-roadmap-sprints.md`. Antes: confirme comigo o ADR-0001 (Medusa v2 vs. plataforma pronta) resumindo em 5 linhas o trade-off à luz do que você descobriu na pesquisa. Depois monte o monorepo, o Docker Compose com todos os serviços, os tokens de design em CSS, a página `/estilo` e o CI. Ao final quero `docker compose up` subindo tudo e `/estilo` renderizando a paleta e a escala tipográfica completas.

## Sprint 1 — Catálogo

> Sprint 1. Modele o catálogo conforme `docs/04-modelo-de-dados.md`, mas **corrigido pela taxonomia real que você levantou em `docs/benchmark/taxonomia-facetas.md`** — se houver divergência, a pesquisa vence e o documento é atualizado. Implemente os syncs do Bling (catálogo diário e estoque a cada 10 min) e a indexação no Meilisearch com facetas e sinônimos PT-BR. Aceite: 100 SKUs reais importados com dimensões e EAN, e busca por "xampu" retornando shampoos.

## Sprint 2 — Descoberta

> Sprint 2: header com megamenu, home, PLP com filtros facetados, `CardProduto` em todos os estados, busca com autocomplete e página de marca. Siga `docs/benchmark/01-plp.md` para a anatomia do card e a lista de filtros. Filtro tem que refletir na URL (compartilhável e indexável). Meça o Lighthouse ao final e me mostre o número.

## Sprint 3 — PDP

> Sprint 3 — o mais importante do projeto. Construa a PDP seguindo `docs/benchmark/02-pdp.md` e `docs/03-design-system.md`. Antes de codar, me mostre o wireframe em ASCII da versão mobile e desktop com a ordem exata dos blocos, e a justificativa de cada decisão que difere da BLZ. Requisito não negociável: preço e CTA visíveis sem rolagem em viewport 360×640.

## Sprint 4 — Carrinho e checkout

> Sprint 4: carrinho e checkout. **Plano completo antes de qualquer código** — quero ver o fluxo de estados, o tratamento de reserva de estoque, a ordem de aplicação de promoções e o desenho do webhook idempotente. Depois implemente. O cenário de concorrência (dois clientes, última unidade) precisa passar antes de você considerar o sprint fechado.

## Sprint 5 — Pós-compra

> Sprint 5: integração de pedido com o Bling (com retry e idempotência — nunca duplicar pedido no ERP), webhooks de NF-e e rastreio, os 6 e-mails transacionais, área do cliente e recuperação de carrinho abandonado incluindo o handoff para a Larissa no WhatsApp.

## Sprint 6 — SEO e performance

> Sprint 6: SEO técnico completo de `docs/07-seo-conteudo-performance.md`, blog em MDX com vínculo produto↔artigo, otimização de Core Web Vitals até o orçamento por rota, feed do Merchant Center e a stack de analytics com Consent Mode v2. Me traga a comparação de Lighthouse antes/depois em cada rota.

## Sprint 7 — Conformidade

> Sprint 7: páginas legais de `docs/08-juridico-fiscal-lgpd.md` (rascunhe os textos, marcando o que precisa de revisão jurídica), banner de cookies granular, central de atendimento, acessibilidade AA auditada com axe-core e enriquecimento dos 300 SKUs prioritários.

## Sprint 8 — Lançamento

> Sprint 8: suíte E2E com os 12 cenários, teste de carga a 10x, observabilidade completa, backup com restore cronometrado, e o checklist de go-live. Ao final quero o Definition of Done de lançamento de `docs/09-qa-testes-dod.md` respondido item a item, com evidência.

---

## Prompts avulsos úteis

**Revisar uma tela contra o benchmark:**
> Compare a nossa {tela} com o que está documentado em `docs/benchmark/`. Liste o que está faltando, classificado por impacto em conversão. Para cada item, diga se recomenda implementar ou deliberadamente não implementar, e por quê.

**Auditoria de performance:**
> Rode Lighthouse mobile em Home, PLP, PDP e Checkout. Para cada métrica fora do orçamento de `docs/07-seo-conteudo-performance.md`, identifique a causa raiz e proponha a correção ordenada por impacto/esforço.

**Antes de mexer em dinheiro:**
> Vou alterar {regra de preço/promoção/frete}. Antes de codar: liste todos os pontos do sistema afetados, os testes que precisam mudar, e o cenário de rollback.
