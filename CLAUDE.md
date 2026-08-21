# CLAUDE.md — BeautyNow Store

Contexto permanente do projeto. Leia este arquivo antes de qualquer tarefa.

## 1. O que estamos construindo

E-commerce próprio (D2C) de cosméticos da **BeautyNow**, marca do grupo. Objetivo: sair da dependência de marketplaces (Mercado Livre, Amazon, TikTok Shop, Shopee) e ter canal direto, com margem cheia, base de clientes própria e capacidade de retargeting.

**Benchmark de referência:** Beleza na Web (belezanaweb.com.br) — maior e-commerce de beleza do Brasil, fundado em 2008, adquirido pelo Grupo Boticário em 2019, +17 mil SKUs. É o padrão de qualidade que temos que igualar em experiência de compra.

**Não é um clone.** Ver `docs/01-benchmark-belezanaweb.md`, seção "Regras de originalidade". Copiar código, HTML/CSS, imagens, textos de produto ou identidade visual da BLZ está proibido e é motivo de rollback imediato do commit.

## 2. Contexto de negócio

- Operação de distribuição de cosméticos com ~15 anos de mercado (RJ/ES no B2B, nacional no B2C).
- Marcas profissionais no portfólio: haircare profissional, tratamento, finalizadores, skincare.
- ERP em uso: **Bling** (estoque, pedidos, NF-e). O site **não** é fonte da verdade de estoque nem emite nota — o Bling é.
- Já existe agente de IA de vendas B2C no WhatsApp (**Larissa**) rodando em n8n + Evolution API. O site precisa conversar com ela, não competir com ela.
- Ticket médio B2C atual: ~R$200. Meta com o site: R$220–260 (via kits, brindes por faixa e frete grátis progressivo).
- Regra comercial B2C: pedido mínimo R$99, boleto só à vista, cartão até 6x, Pix com desconto.

## 3. Stack (decidida — ver ADRs em `docs/02-arquitetura.md`)

| Camada | Escolha |
|---|---|
| Storefront | Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui |
| Backend de commerce | Medusa v2 (Node/TS, open source) |
| Banco | PostgreSQL 16 |
| Cache/fila | Redis |
| Busca | Meilisearch (facetada, tolerante a typo, PT-BR) |
| Mídia | Cloudflare R2 + Next/Image |
| Pagamento | Mercado Pago (Pix, cartão, boleto) |
| Frete | Melhor Envio + tabela própria de motoboy RJ |
| ERP | Bling API v3 (produtos, estoque, pedidos, NF-e) |
| Automação | n8n (já existente na VPS) |
| Deploy | Docker + Dokploy na VPS Hostinger, Cloudflare na frente |
| Analytics | GA4 + Meta CAPI + PostHog |

## 4. Regras de trabalho

**Antes de codar qualquer coisa nova:**
1. Confirme em qual sprint/ticket você está (`docs/06-roadmap-sprints.md`).
2. Se a feature tem equivalente na BLZ, releia a ficha de benchmark correspondente em `docs/benchmark/` antes de desenhar.
3. Escreva o plano em bullets e espere aprovação em features de checkout, pagamento e fiscal. Nessas três áreas, nunca improvise.

**Padrões de código:**
- TypeScript estrito (`strict: true`), sem `any` sem comentário justificando.
- Server Components por padrão; `"use client"` só quando há estado/evento.
- Preços **sempre** em centavos (inteiro), nunca float. Formatação só na borda de apresentação.
- Nada de segredo em código. Tudo em `.env`, com `.env.example` atualizado no mesmo commit.
- Textos de interface em `pt-BR`, centralizados em `src/lib/copy/` — nada de string solta em JSX.
- Commits em português, formato conventional: `feat(pdp): adiciona seletor de tamanho`.

**Qualidade obrigatória (bloqueia merge):**
- Lighthouse mobile ≥ 90 em Performance e ≥ 95 em Acessibilidade nas rotas Home, PLP, PDP e Checkout.
- LCP < 2,5s em 4G simulado. CLS < 0,1.
- Navegação por teclado funcional e foco visível em todo fluxo de compra.
- Testes E2E do fluxo crítico passando (ver `docs/09-qa-testes-dod.md`).

## 5. Vocabulário do projeto

| Termo | Significado |
|---|---|
| PLP | Product Listing Page (categoria/busca) |
| PDP | Product Detail Page (página do produto) |
| Kit | Agrupamento vendável de SKUs com preço próprio |
| Faixa de brinde | Regra de brinde automático por valor de carrinho |
| Rotina | Conjunto curado de produtos para um objetivo (ex.: "rotina anti-frizz") |
| Larissa | Agente de IA B2C no WhatsApp (n8n + Evolution API) |
| Bling | ERP — fonte da verdade de estoque, pedido e NF-e |

## 6. O que NÃO fazer

- Não criar tela de admin de catálogo do zero. O admin é o **Bling** + o admin nativo do Medusa.
- Não implementar marketplace/multi-seller. Fora de escopo até 2ª fase.
- Não implementar programa de assinatura na v1.
- Não copiar nada da Beleza na Web além de aprendizado estrutural.
- Não subir para produção sem os textos legais de `docs/08-juridico-fiscal-lgpd.md` publicados.
