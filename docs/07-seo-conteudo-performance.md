# 07 — SEO, Conteúdo e Performance

Num e-commerce de beleza, orgânico é o canal que separa quem tem margem de quem só compra tráfego. É também o único canal que não fica mais caro quando o concorrente aumenta o lance.

## 1. Arquitetura de URL

```
/                                       home
/cabelos                                categoria N1
/cabelos/shampoo                        categoria N2
/cabelos/shampoo/sem-sulfato            categoria N3 (faceta indexável)
/produto/{marca}-{nome}-{tamanho}       PDP
/marca/{slug}                           marca
/marca/{slug}/{categoria}               marca + categoria
/busca?q=                               busca (noindex)
/conteudo                               blog
/conteudo/{slug}                        artigo
/central-de-ajuda/{slug}                institucional
```

**Facetas:** apenas um conjunto curado vira URL indexável (as com volume real de busca: "sem sulfato", "para cabelo cacheado", "vegano", "pele oleosa"). Toda outra combinação de filtro fica em query string com `noindex, follow`. Sem essa regra, o site gera dezenas de milhares de URLs quase-duplicadas e o orçamento de rastreamento evapora.

Canonical sempre autorreferente na versão limpa. Paginação com `rel=next/prev` e canonical próprio por página (não para a página 1 — isso esconde produtos do índice).

## 2. Dados estruturados (JSON-LD)

| Página | Schema |
|---|---|
| Todas | `Organization`, `WebSite` com `SearchAction` |
| PDP | `Product` + `Offer` (com `priceCurrency`, `availability`, `priceValidUntil`) + `AggregateRating` + `Review` |
| PLP | `BreadcrumbList` + `ItemList` |
| Artigo | `Article` + `BreadcrumbList` |
| FAQ | `FAQPage` |

`AggregateRating` só quando há avaliação real. Marcar nota inexistente é penalidade certa.

## 3. On-page

- **Title PDP:** `{Marca} {Produto} {Tamanho} | BeautyNow` — até 60 caracteres.
- **Title PLP:** `{Categoria} — {N} produtos das melhores marcas | BeautyNow`.
- **Meta description:** escrita por página, com benefício + condição comercial (frete, parcelamento). Nunca gerar automaticamente cortando a descrição.
- **H1 único** por página, correspondendo à intenção de busca.
- **Texto de categoria:** 150–300 palavras abaixo da grade, original, respondendo "como escolher X". É o que faz PLP rankear contra concorrente maior.
- **Alt de imagem** derivado de `marca + produto + variação`.
- **Interlinks:** PDP → categoria, marca, linha e 2 artigos relacionados. Artigo → 3+ produtos.

## 4. Conteúdo editorial

Três formatos, escolhidos por intenção de busca:

1. **Guia de escolha** ("como escolher shampoo para cabelo com progressiva") — intenção comercial, converte direto.
2. **Guia de ingrediente** ("o que faz a niacinamida na pele") — intenção informacional, constrói autoridade e alimenta a busca de cauda longa.
3. **Rotina** ("rotina completa para cabelo cacheado ressecado") — vende kit, é o formato de maior ticket.

Cadência mínima: 4 artigos/mês. Cada um com produto vinculado e CTA de kit. Sem vínculo com catálogo, artigo é custo — não investimento.

## 5. Performance — orçamento por rota

| Métrica | Home | PLP | PDP | Checkout |
|---|---|---|---|---|
| LCP | < 2,0s | < 2,2s | < 2,0s | < 1,8s |
| INP | < 200ms | < 200ms | < 200ms | < 150ms |
| CLS | < 0,05 | < 0,05 | < 0,05 | < 0,02 |
| JS inicial | < 120KB | < 140KB | < 150KB | < 130KB |

Táticas: Server Components por padrão · imagem em AVIF com fallback WebP, `sizes` correto e `priority` só no LCP · fontes com `font-display: swap`, subset latino e preload da display · sem biblioteca de carrossel pesada (usar scroll-snap nativo) · script de terceiro com `afterInteractive` e Meta/GA via CAPI server-side · ISR + cache de borda no Cloudflare · prefetch de PDP no hover do card em desktop.

**Regra:** nenhum script de terceiro entra sem medir o impacto antes e depois no Lighthouse. Pixel de marketing é a causa número um de site de e-commerce lento.

## 6. Monitoramento

Lighthouse CI bloqueando o merge · CrUX/RUM real do p75 semanal · Search Console: cobertura, consultas, CTR por página · alerta se LCP p75 subir acima do orçamento por 3 dias seguidos.
