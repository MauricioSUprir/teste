# BeautyNow Store

E-commerce próprio (D2C) de cosméticos da **BeautyNow**. Storefront Next.js 15 construído a partir do pacote de especificação em `docs/` (PRD, design system, arquitetura, roadmap).

> O pacote de especificação original está descrito em `README-especificacao.md`. O contexto permanente do projeto está em `CLAUDE.md`.

## Como rodar

```bash
npm install
npm run dev        # desenvolvimento em http://localhost:3000
npm run build      # build de produção
npm start          # servir o build
npm run typecheck  # TypeScript estrito
```

Requer Node 20+.

## O que está implementado (storefront)

| Área | Entrega |
|---|---|
| Design system | Tokens de `docs/03-design-system.md` em `src/styles/tokens.css` + Tailwind 4; guia vivo em `/estilo` (ticket 0.4) |
| Home | Hero editorial, selos de confiança, mais vendidos, categorias, necessidades, lançamentos, marcas, newsletter (ticket 2.2) |
| Header/Megamenu | Navegação por categoria, marca e necessidade; busca com autocomplete navegável por teclado; drawer mobile (tickets 2.1, 2.5) |
| PLP | `/categoria/[slug]`, `/necessidade/[slug]`, `/marca/[slug]`, `/busca` com filtros facetados refletidos na URL, ordenação e contagem (tickets 2.3, 2.6) |
| CardProduto | Anatomia fixa da spec com todos os estados: desconto, esgotado, variações, sem avaliação, lançamento (ticket 2.4) |
| PDP | Galeria, seletor de variação em chips, preço com Pix/parcelamento, frete por CEP na página, estoque baixo, avise-me, compre junto com desconto, avaliações com compra verificada, blocos colapsáveis, mesma linha, quem viu também viu, JSON-LD Product/Offer/AggregateRating (Sprint 3) |
| Carrinho | Drawer lateral com barra de frete grátis + faixa de brinde, pedido mínimo R$ 99, persistência local (tickets 4.1, 4.2) |
| Checkout | Página única (identificação → entrega → pagamento), sem navegação, ViaCEP, escolha de frete, Pix/cartão/boleto, resumo fixo, confirmação com Pix copia-e-cola (tickets 4.4, 4.5, 4.9) |
| Institucional | Central de atendimento com FAQ, quem somos, políticas (rascunhos a revisar juridicamente antes do go-live) |
| SEO | Metadata por rota, sitemap.xml, robots.txt, dados estruturados |
| Regras de negócio | Preços em centavos, Pix -5%, até 6x sem juros, frete grátis ≥ R$ 199, brinde ≥ R$ 250, pedido mínimo R$ 99 (`src/lib/preco.ts`) |

Todos os textos de interface estão centralizados em `src/lib/copy/` (pt-BR), conforme o CLAUDE.md.

## O que é demonstração (e o caminho para produção)

O storefront roda hoje **sem backend**, com uma camada de dados substituível:

- **Catálogo** — `src/lib/catalogo/dados.ts` traz 18 produtos e 6 marcas fictícios. Na integração real, `consultas.ts` passa a chamar o **Medusa v2** (réplica do **Bling** via n8n) e a busca vai para o **Meilisearch** (ADRs em `docs/02-arquitetura.md`).
- **Imagens** — placeholders SVG determinísticos (`ImagemProduto`). Substituir por fotos reais no Cloudflare R2 + `next/image`.
- **Frete** — tabela simulada em `src/lib/frete.ts` (motoboy RJ + transportadora). Substituir por Melhor Envio.
- **Pagamento** — o checkout registra o pedido localmente e mostra um Pix ilustrativo. Substituir pelo SDK do Mercado Pago com tokenização no cliente e webhook assinado (tickets 4.6–4.8 — exigem aprovação prévia, ver CLAUDE.md §4).
- **Conta do cliente** — placeholder; chega com o backend (Sprint 5).

## Estrutura

```
apps/storefront/          # Next.js 15 (App Router) + TypeScript + Tailwind 4
  src/app/(loja)/         # rotas com header/footer/drawer
  src/app/checkout/       # checkout sem navegação (spec docs/03 §5)
  src/components/         # layout/, produto/, catalogo/, carrinho/, checkout/, home/
  src/lib/                # catalogo/, carrinho/, copy/, preco.ts, frete.ts
  src/styles/tokens.css   # tokens do design system
docs/                     # especificação completa (PRD, design system, ADRs, sprints…)
prompts/                  # prompts de kickoff e de sprint
```
