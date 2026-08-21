---
description: Auditoria completa da página de produto — a tela que decide a venda
---

Audite a PDP do produto **$ARGUMENTS** (ou uma PDP representativa, se nada for passado).

Verifique, um a um:

- [ ] Preço e CTA visíveis sem rolagem em viewport 360×640
- [ ] Ordem dos blocos igual à definida em `docs/benchmark/02-pdp.md`
- [ ] Preço "de/por", desconto percentual, preço Pix e parcelamento com a hierarquia correta
- [ ] Seletor de variação trocando preço, imagem, estoque e URL sem reload
- [ ] Cálculo de frete por CEP retornando **data** de entrega, não faixa de dias
- [ ] Cross-sell presente: compre junto, mesma linha, quem viu também viu
- [ ] Avaliações com distribuição, filtro e marcação de compra verificada
- [ ] Estado esgotado funcionando (avise-me + sugestão de similar)
- [ ] JSON-LD Product/Offer/AggregateRating sem erro no Rich Results Test
- [ ] CLS zero: imagem, preço e banner com espaço reservado
- [ ] Alt de imagem descritivo, foco visível, navegável por teclado
- [ ] Lighthouse mobile ≥ 90 performance

Para cada falha: causa raiz, correção proposta, esforço.
