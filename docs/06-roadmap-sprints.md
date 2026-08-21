# 06 — Roadmap e Sprints

8 sprints de 1 semana até o lançamento. Cada sprint termina em algo demonstrável em staging.

---

## Sprint 0 — Pesquisa e fundação

**Objetivo:** entender o benchmark e ter o ambiente rodando.

| # | Ticket | Aceite |
|---|---|---|
| 0.1 | Executar Fase 0 completa de `docs/01-benchmark-belezanaweb.md` | Todos os arquivos em `docs/benchmark/` criados, incluindo `99-sintese.md` com tabela de paridade priorizada |
| 0.2 | Confirmar ADR-0001 com o Mauricio (Medusa vs. plataforma pronta) | Decisão registrada no ADR |
| 0.3 | Monorepo + Docker Compose (Postgres, Redis, Meilisearch, Medusa, Next) | `docker compose up` sobe tudo; `/api/health` responde |
| 0.4 | Tokens de design em CSS + preset Tailwind | Página `/estilo` renderizando toda a paleta, escala tipográfica e componentes base |
| 0.5 | CI: lint, typecheck, build, Lighthouse CI | Pipeline verde no push |

---

## Sprint 1 — Catálogo

| # | Ticket | Aceite |
|---|---|---|
| 1.1 | Modelagem do catálogo no Medusa conforme `04-modelo-de-dados.md`, validada contra a taxonomia da Fase 0.2 | Migrations aplicadas; schema Zod dos atributos |
| 1.2 | Sync Bling → catálogo (n8n) | 100 SKUs reais importados com dimensões e EAN |
| 1.3 | Sync Bling → estoque, a cada 10 min | Divergência zero em amostra de 20 SKUs |
| 1.4 | Indexação no Meilisearch com facetas e sinônimos PT-BR | Busca por "xampu" retorna shampoos; typo tolerado |
| 1.5 | Seed de dados de demonstração | Staging navegável com catálogo real |

---

## Sprint 2 — Descoberta (Home, PLP, busca)

| # | Ticket | Aceite |
|---|---|---|
| 2.1 | Header + megamenu (categoria/marca/necessidade) | Navegação completa por teclado; mobile em drawer |
| 2.2 | Home com todos os blocos definidos na síntese do benchmark | LCP < 2,5s mobile |
| 2.3 | PLP com filtros facetados, ordenação e paginação | Filtro reflete na URL (compartilhável e indexável); resultado em < 300ms |
| 2.4 | `CardProduto` em todos os estados (desconto, esgotado, variações, sem avaliação) | Storybook ou página `/estilo` com os 8 estados; CLS zero |
| 2.5 | Busca com autocomplete (produto, marca, categoria, sugestão) | Resposta < 150ms; teclado navegável |
| 2.6 | Página de marca | Hero de marca + grade + texto de SEO |

---

## Sprint 3 — PDP

Sprint mais importante do projeto. É onde a compra é decidida.

| # | Ticket | Aceite |
|---|---|---|
| 3.1 | Layout da PDP conforme `03-design-system.md` e `docs/benchmark/02-pdp.md` | Preço e CTA visíveis sem rolagem em 360×640 |
| 3.2 | Galeria com zoom, carrossel mobile e vídeo | Sem CLS; imagens em AVIF/WebP responsivas |
| 3.3 | Seletor de variação (tamanho, tom) | Troca preço, imagem, estoque e URL sem reload |
| 3.4 | Cálculo de frete por CEP na PDP | Retorna opções com data de entrega; cache de 1h |
| 3.5 | Blocos de conteúdo (descrição, uso, composição, especificações) | Colapsáveis, acessíveis, com conteúdo real de 20 SKUs |
| 3.6 | "Compre junto" com desconto de bundle | Adiciona os itens de uma vez com o preço combinado |
| 3.7 | Avaliações (leitura + envio com compra verificada) | Distribuição de notas, filtro, foto, moderação |
| 3.8 | Estado esgotado com "avise-me" | Captura e-mail e dispara quando repõe |
| 3.9 | Dados estruturados `Product` + `Offer` + `AggregateRating` | Rich Results Test sem erro |

---

## Sprint 4 — Carrinho e checkout

| # | Ticket | Aceite |
|---|---|---|
| 4.1 | Drawer de carrinho com barra de frete grátis | Barra correta nos 3 estados; testado |
| 4.2 | Faixa de brinde automático | Brinde entra e sai conforme o valor muda |
| 4.3 | Cupom com todas as regras de `04-modelo-de-dados.md` §5 | Ordem de aplicação testada; erro claro |
| 4.4 | Checkout em página única, com compra como visitante | Concluir pedido em ≤ 8 campos preenchidos |
| 4.5 | Endereço com ViaCEP + escolha de frete | Autopreenchimento; validação inline |
| 4.6 | Mercado Pago: Pix, cartão, boleto | Pedido pago em sandbox nos 3 meios |
| 4.7 | Webhook de pagamento idempotente e assinado | Reenvio do mesmo evento não duplica |
| 4.8 | Reserva de estoque no início do checkout, com expiração | Sem overselling em teste de concorrência |
| 4.9 | Página de confirmação com Pix copia-e-cola | QR + código funcionando |

---

## Sprint 5 — Pós-compra e conta

| # | Ticket | Aceite |
|---|---|---|
| 5.1 | Envio de pedido para o Bling com retry e idempotência | 20 pedidos de teste, zero duplicata |
| 5.2 | Webhooks de NF-e e rastreio | Pedido atualizado automaticamente |
| 5.3 | 6 e-mails transacionais | Renderizam em Gmail, Outlook e mobile |
| 5.4 | Área do cliente (pedidos, rastreio, endereços, dados, favoritos) | Fluxo completo |
| 5.5 | "Comprar novamente" | Monta carrinho em 2 cliques |
| 5.6 | Recuperação de carrinho abandonado (e-mail + Larissa) | Sequência D+1h/D+24h/D+72h ativa |

---

## Sprint 6 — SEO, conteúdo e performance

| # | Ticket | Aceite |
|---|---|---|
| 6.1 | SEO técnico completo (ver `07-seo-conteudo-performance.md`) | Sitemap, robots, canonical, hreflang N/A, dados estruturados |
| 6.2 | Blog em MDX com vínculo produto↔artigo | 5 artigos publicados, 3 produtos cada |
| 6.3 | Otimização de Core Web Vitals | Lighthouse mobile ≥ 90 nas 4 rotas críticas |
| 6.4 | Feed do Google Merchant Center | Aprovado no GMC sem erro |
| 6.5 | GA4 + Meta CAPI + Consent Mode v2 | Funil completo visível; deduplicação confirmada |

---

## Sprint 7 — Conformidade e conteúdo institucional

| # | Ticket | Aceite |
|---|---|---|
| 7.1 | Páginas legais de `08-juridico-fiscal-lgpd.md` | Todas publicadas e linkadas no rodapé |
| 7.2 | Banner de cookies com granularidade | Bloqueia script antes do aceite |
| 7.3 | Central de atendimento (FAQ, trocas, contato, rastreio) | Busca no FAQ funcionando |
| 7.4 | Acessibilidade AA no fluxo de compra | axe-core sem violação crítica; teste com leitor de tela |
| 7.5 | Enriquecimento de catálogo: 300 SKUs prioritários | Foto, descrição, atributos e dimensões completos |

---

## Sprint 8 — Hardening e lançamento

| # | Ticket | Aceite |
|---|---|---|
| 8.1 | Suíte E2E do fluxo crítico (Playwright) | 12 cenários verdes no CI |
| 8.2 | Teste de carga (10x o tráfego previsto) | p95 < 800ms; sem erro 5xx |
| 8.3 | Sentry, uptime e alertas de negócio | Alerta chegando no Telegram |
| 8.4 | Backup + restore testado | Restore documentado e cronometrado |
| 8.5 | Beta fechado com 20 clientes reais | 10 pedidos reais concluídos ponta a ponta |
| 8.6 | Go-live: DNS, SSL, cache, remoção do noindex | Site no ar, primeiro pedido orgânico |

---

## Pós-lançamento (30–90 dias)

Prioridade por impacto: quiz de diagnóstico (cabelo/pele) que vira recomendação · programa de fidelidade · assinatura de recompra · itens P1 da tabela de paridade do benchmark · testes A/B contínuos em PDP e checkout · expansão editorial para busca de cauda longa.
