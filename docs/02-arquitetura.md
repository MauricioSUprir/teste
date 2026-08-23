# 02 — Arquitetura

## 1. Visão geral

```
                        ┌─────────────────┐
   Cliente ──────────►  │   Cloudflare    │  CDN, WAF, cache de borda
                        └────────┬────────┘
                                 │
                    ┌────────────▼────────────┐
                    │  Next.js 15 Storefront  │  SSR/ISR, Server Components
                    │  (Docker, porta 3000)   │
                    └───┬────────────────┬────┘
                        │                │
          ┌─────────────▼──────┐   ┌─────▼──────────┐
          │   Medusa v2 API    │   │  Meilisearch   │  busca facetada
          │  cart, checkout,   │   └────────────────┘
          │  order, promoções  │
          └───┬────────┬───────┘
              │        │
    ┌─────────▼──┐  ┌──▼────────┐
    │ PostgreSQL │  │   Redis   │  cache, sessão, fila
    └────────────┘  └───────────┘
              │
    ┌─────────▼─────────────────────────────────────┐
    │  n8n (VPS existente) — camada de integração   │
    └──┬──────────┬───────────┬──────────┬──────────┘
       │          │           │          │
   ┌───▼───┐ ┌────▼─────┐ ┌───▼──────┐ ┌─▼─────────┐
   │ Bling │ │Mercado   │ │Melhor    │ │ Larissa   │
   │ (ERP) │ │Pago      │ │Envio     │ │(WhatsApp) │
   └───────┘ └──────────┘ └──────────┘ └───────────┘
```

## 2. ADRs (Architecture Decision Records)

### ADR-0001 — Medusa v2 como motor de commerce, não build from scratch

**Contexto.** Carrinho, checkout, máquina de estados de pedido, promoções, regiões, impostos, devolução e reserva de estoque somam facilmente 3–4 meses de desenvolvimento e são a área onde bug custa dinheiro real.

**Decisão.** Usar Medusa v2 (open source, Node/TypeScript, self-hosted) como backend de commerce. O time investe o esforço no storefront e nas integrações brasileiras — que é onde está a diferenciação.

**Consequências.** Ganha-se maturidade e velocidade; perde-se liberdade total de modelagem. Módulos brasileiros (Mercado Pago, Melhor Envio, Bling) precisam ser escritos como plugins nossos. Aceitável.

**Alternativas descartadas:**
- *Shopify / Nuvemshop:* rápido, mas comissão recorrente, limite de customização na PDP e menos controle sobre performance e SEO técnico — exatamente o que queremos dominar.
- *VTEX:* padrão do setor no enterprise brasileiro, mas custo e complexidade incompatíveis com o estágio atual.
- *Next.js + Prisma puro:* máximo controle, mas reescreve o que o Medusa já resolveu.

> **Ponto de decisão do Mauricio:** se a prioridade for velocidade de lançamento acima de tudo (site no ar em 30 dias), Nuvemshop com tema customizado é a escolha racional e este pacote vira spec de tema. Se a prioridade for ativo próprio, margem e controle de longo prazo, seguir com o Medusa. **Confirmar antes do Sprint 1.**

### ADR-0002 — Bling como fonte da verdade

O site nunca é a autoridade sobre estoque, preço de custo, pedido fiscal ou NF-e. O Medusa mantém uma **réplica de leitura** do catálogo e do estoque, sincronizada pelo n8n. Preço de venda é definido no site (permite promoção e preço Pix próprios); estoque e disponibilidade vêm do Bling.

Motivo: já existe operação rodando no Bling com estoque compartilhado entre marketplaces. Duas fontes de verdade de estoque = overselling garantido.

### ADR-0003 — n8n como camada de integração

Toda comunicação com sistema externo (Bling, Mercado Pago webhook, Melhor Envio, e-mail, WhatsApp) passa pelo n8n já existente na VPS, não por código dentro do Medusa. Motivo: fluxos ficam visíveis e editáveis sem deploy, o time já opera n8n, e falha de integração não derruba o site.

Exceção: callback de pagamento tem rota nativa no Medusa por segurança de assinatura; o n8n consome o evento depois.

### ADR-0004 — Renderização

| Rota | Estratégia | Revalidação |
|---|---|---|
| Home | ISR | 5 min |
| PLP categoria | ISR + filtros client-side via Meilisearch | 10 min |
| PDP | ISR por SKU | 5 min (preço/estoque hidratado client-side) |
| Busca | CSR (Meilisearch direto) | — |
| Carrinho / Checkout / Conta | SSR dinâmico, sem cache | — |
| Blog | SSG | on-demand via webhook |

Preço e estoque na PDP são revalidados no cliente ao montar, para nunca exibir dado velho no momento da decisão de compra.

### ADR-0005 — Deploy na VPS Hostinger com Dokploy

A VPS já roda n8n, Postgres, Redis e Evolution API com túneis Cloudflare. Adicionar o storefront e o Medusa ao mesmo host reduz latência de banco e custo. Dokploy dá deploy por git push, rollback e certificado automático.

**Guarda-corpo:** o e-commerce **não pode** compartilhar instância de Postgres com os agentes de produção (Laís/Larissa/Stevie). Banco dedicado, usuário dedicado, backup diário próprio com retenção de 14 dias e teste de restore mensal. Se o pico de tráfego começar a afetar os agentes, o storefront migra para Vercel — desenhar o Docker desde já para permitir essa migração sem refatoração.

## 3. Ambientes

| Ambiente | URL | Banco | Bling | Pagamento |
|---|---|---|---|---|
| Local | localhost:3000 | Postgres docker | mock | sandbox |
| Staging | staging.beautynow.com.br | staging (dump anonimizado) | sandbox | sandbox |
| Produção | beautynow.com.br | produção | produção | produção |

Staging protegido por Basic Auth e `noindex`. Nenhum dado pessoal real em staging.

## 4. Estrutura de pastas

```
beautynow-store/
├── apps/
│   ├── storefront/           # Next.js 15
│   │   ├── src/app/
│   │   │   ├── (loja)/[categoria]/
│   │   │   ├── produto/[slug]/
│   │   │   ├── marca/[slug]/
│   │   │   ├── busca/
│   │   │   ├── carrinho/
│   │   │   ├── checkout/
│   │   │   ├── conta/
│   │   │   └── conteudo/
│   │   ├── src/components/
│   │   │   ├── ui/           # primitivos shadcn
│   │   │   ├── produto/      # CardProduto, GaleriaPDP, SeletorVariacao
│   │   │   ├── catalogo/     # Filtros, Ordenacao, Grade
│   │   │   ├── carrinho/     # Drawer, BarraFreteGratis
│   │   │   └── layout/       # Header, Megamenu, Footer
│   │   ├── src/lib/
│   │   │   ├── medusa/       # client
│   │   │   ├── busca/        # Meilisearch
│   │   │   ├── analytics/
│   │   │   └── copy/         # todos os textos pt-BR
│   │   └── src/styles/tokens.css
│   └── backend/              # Medusa v2
│       └── src/modules/
│           ├── mercadopago/
│           ├── melhorenvio/
│           ├── bling-sync/
│           └── brindes/
├── packages/
│   ├── tipos/                # tipos compartilhados
│   └── config/               # eslint, tsconfig, tailwind preset
├── infra/
│   ├── docker-compose.yml
│   └── n8n-workflows/        # JSON exportado, versionado
└── docs/
```

## 5. Observabilidade

- **Erros:** Sentry no storefront e no backend, com alerta em canal do Telegram (Stevie já tem bot).
- **Logs:** stdout estruturado em JSON, coletado pelo Dokploy.
- **Uptime:** monitor externo em `/api/health` a cada minuto, alertando no Telegram.
- **Alertas de negócio (n8n):** zero pedidos em 3h no horário comercial · falha de sync do Bling · taxa de erro de pagamento > 5% em 30 min · produto vendido com estoque negativo.

## 6. Segurança

- Nenhum dado de cartão toca nosso servidor — tokenização no cliente pelo SDK do Mercado Pago.
- Rate limit: login (5/min/IP), cupom (10/min/sessão), frete (30/min/IP), busca (60/min/IP).
- Validação de webhook por assinatura em Mercado Pago e Bling.
- Secrets em variáveis de ambiente do Dokploy, nunca no repositório.
- Backup diário do Postgres com teste de restore mensal documentado.
- Cloudflare WAF com regra de bot em `/checkout` e `/api/cupom`.
