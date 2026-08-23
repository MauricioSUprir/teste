# 00 — PRD: BeautyNow Store

## 1. Problema

A BeautyNow vende hoje através de marketplaces e canais de terceiros. Isso significa: comissão de 12–20% sobre o GMV, zero propriedade sobre o dado do cliente, impossibilidade de retargeting próprio, guerra de preço com concorrentes na mesma página, e nenhuma construção de marca. O canal próprio resolve os quatro.

## 2. Objetivo do produto

Um e-commerce de cosméticos que um cliente que compra na Beleza na Web não perceba como "inferior". Isso quer dizer: catálogo bem estruturado, filtro que funciona, página de produto que responde as dúvidas antes que o cliente pergunte, checkout de 1 tela, Pix instantâneo, frete calculado no CEP dentro da PDP, e prazo de entrega real.

## 3. Métricas de sucesso (90 dias pós-lançamento)

| Métrica | Alvo | Como medir |
|---|---|---|
| Taxa de conversão | ≥ 1,4% | GA4, sessões → pedidos pagos |
| Ticket médio | ≥ R$ 220 | Bling |
| Abandono de checkout | ≤ 65% | PostHog funil |
| LCP mobile p75 | < 2,5s | CrUX / Vercel Analytics |
| % pedidos via Pix | ≥ 45% | Mercado Pago |
| Erro de estoque (venda de item indisponível) | < 0,5% dos pedidos | Bling vs. site |
| Base de e-mails opt-in | 5.000 | Plataforma de CRM |

## 4. Personas

**Rafaela, 31, RJ — consumidora final informada.**
Usa produto profissional em casa. Sabe o nome do ativo que procura ("preciso de acidificante", "quero um leave-in sem silicone"). Compara preço entre 3 sites antes de comprar. Decide por: preço + prazo + confiança de que o produto é original. Abandona se o frete surpreende no checkout.

**Camila, 24, interior de SP — descobrindo skincare.**
Não sabe o nome de nada. Chega por Instagram/TikTok. Precisa de curadoria: "para pele oleosa", "para cabelo cacheado". Compra kit e rotina, não item avulso. Precisa de prova social (avaliação, foto de cliente) para converter.

**Márcia, 44 — cliente recorrente.**
Já comprou 3+ vezes. Quer recomprar rápido o mesmo item. Precisa de: histórico de pedidos, "comprar novamente" em 2 cliques, cupom de fidelidade. É a persona de maior LTV e a mais barata de servir.

## 5. Escopo — v1 (lançamento)

### Descoberta
- Home com hero editorial, faixas de categoria, ofertas do dia, mais vendidos, marcas em destaque.
- Menu de navegação por **categoria** (Cabelos, Skincare, Maquiagem, Perfumaria, Corpo e Banho, Masculino), por **marca** e por **necessidade** (ex.: "cabelo com química", "pele oleosa", "anti-idade").
- Busca com autocomplete, correção de digitação, sugestão de marca/categoria e resultado facetado.
- PLP com filtros: categoria, marca, preço, tipo de cabelo, tipo de pele, necessidade, linha, faixa de volume, avaliação, disponibilidade. Ordenação: relevância, mais vendidos, menor preço, maior preço, lançamentos, melhor avaliados.

### Conversão
- PDP completa (ver spec detalhada em `docs/03-design-system.md` e ficha de benchmark).
- Cálculo de frete e prazo por CEP **dentro da PDP**, antes do carrinho.
- Variações de tamanho/tom com troca de imagem e preço sem reload.
- Cross-sell: "compre junto" (kit dinâmico com desconto), "quem viu também viu", "produtos da mesma linha".
- Carrinho lateral (drawer) com barra de progresso de frete grátis e faixa de brinde.
- Checkout em página única: identificação → entrega → pagamento, com resumo fixo.
- Pagamento: Pix (com desconto), cartão até 6x, boleto à vista.
- Compra como visitante (sem obrigar cadastro).

### Confiança
- Avaliações com nota, texto, foto e verificação de compra.
- Selo de originalidade / distribuidor autorizado.
- Página de marca com storytelling.
- Política de troca, prazo, rastreio e canal de atendimento visíveis em toda página.

### Pós-compra
- Página de confirmação com resumo, prazo estimado e código Pix/boleto.
- E-mails transacionais: pedido recebido, pagamento aprovado, nota emitida, pedido enviado com rastreio, pedido entregue, pedido de avaliação (D+7 da entrega).
- Área do cliente: pedidos, rastreio, endereços, dados, favoritos, "comprar novamente".

### Conteúdo
- Blog/editorial (rotinas, guias de ingrediente, comparativos) — motor de SEO orgânico.

## 6. Fora de escopo — v1

Marketplace multi-seller · assinatura recorrente · app nativo · programa de pontos · quiz de diagnóstico com IA · live commerce · B2B/atacado no mesmo domínio · internacionalização.

*(Quiz de diagnóstico e programa de pontos entram na v2 — desenhar o modelo de dados já prevendo, mas não implementar.)*

## 7. Requisitos não funcionais

- **Performance:** LCP < 2,5s, INP < 200ms, CLS < 0,1 no p75 mobile.
- **Disponibilidade:** 99,5% mensal. Degradação graciosa se Bling ou Meilisearch cair (site continua vendendo com estoque em cache).
- **Escala:** suportar pico de 10x o tráfego médio (campanha de influenciador) sem queda — ISR + cache de borda Cloudflare.
- **Acessibilidade:** WCAG 2.1 AA no fluxo de compra.
- **Segurança:** nenhum dado de cartão trafega ou é armazenado no nosso servidor (tokenização Mercado Pago). Rate limit em login, cupom e cálculo de frete.
- **Mobile-first:** 75%+ do tráfego será mobile. Desenhar mobile primeiro, sempre.

## 8. Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| Estoque dessincronizado do Bling | Venda de item indisponível, cancelamento | Webhook + polling a cada 10min + reserva de estoque no checkout |
| Catálogo mal cadastrado (foto ruim, descrição pobre) | Conversão morre independente do site | Sprint dedicada de enriquecimento de catálogo antes do lançamento |
| Custo de aquisição alto vs. marketplace | Canal não paga | Começar com base de clientes existente + Larissa + orgânico antes de escalar mídia |
| Concorrer em preço com BLZ/Época | Margem esmagada | Não competir em preço puro: competir em curadoria de nicho, kit exclusivo e atendimento |
| Complexidade fiscal (ST, NF-e) | Multa, atraso | Toda emissão pelo Bling, que já está parametrizado |
