# 05 — Integrações

## 1. Bling (ERP) — API v3

OAuth 2.0, token com refresh. Guardar refresh token criptografado; renovação automática no n8n com alerta se falhar.

### Fluxos

**A. Sync de catálogo (Bling → site).** Diário às 5h + sob demanda. Puxa produtos ativos, mapeia por SKU, cria/atualiza produto e variante no Medusa. Campos que o Bling manda: título, SKU, EAN, marca, dimensões, peso, NCM, imagens. Campos que o **site** controla e o sync não sobrescreve: descrição rica, atributos de beleza, slug, preço de venda, destaque.

> Regra: sync nunca sobrescreve conteúdo curado. Se o Bling trouxer título diferente, gera item de revisão, não sobrescreve.

**B. Sync de estoque (Bling → site).** A cada 10 minutos, incremental. Puxa saldo por SKU. Se disponível, ativar webhook do Bling para tempo quase real; o polling continua como rede de segurança.

Regra de exibição: `estoque_disponivel = saldo_bling − reservado_no_checkout`. Se ≤ 0, produto vira "avise-me quando chegar" — nunca some da PLP (o produto morto ainda traz tráfego orgânico).

**C. Envio de pedido (site → Bling).** Disparado quando o pedido vira `pago`. Cria pedido de venda no Bling com cliente, itens, valores, frete, forma de pagamento e observações. Retorna `bling_pedido_id`, gravado no pedido.

Idempotência obrigatória: chave = `pedido.id`. Retry com backoff. Se falhar 3 vezes, alerta no Telegram e fila de reprocessamento manual — **nunca** duplicar pedido no ERP.

**D. NF-e e rastreio (Bling → site).** Webhook de emissão de nota atualiza `nfe_*` e dispara e-mail. Webhook de expedição atualiza `codigo_rastreio` e dispara e-mail de "pedido enviado".

## 2. Mercado Pago

Checkout Transparente (não redirect — o cliente não sai do site).

| Meio | Detalhe |
|---|---|
| Pix | QR + copia-e-cola na tela de confirmação. Expiração 30 min. Desconto configurável (sugestão inicial: 5%). |
| Cartão | Tokenização no cliente. Até 6x sem juros, parcela mínima R$ 30. Bandeiras: Visa, Master, Elo, Amex, Hipercard. |
| Boleto | À vista apenas. Vencimento em 2 dias úteis. Estoque reservado até vencer. |

**Webhook de pagamento** (`/api/webhooks/mercadopago`): validar assinatura, ser idempotente por `payment_id`, e **sempre reconsultar a API** antes de mudar estado — nunca confiar no payload cru. Mapear: `approved → pago` · `pending/in_process → aguardando_pagamento` · `rejected/cancelled → falha` (mantém carrinho recuperável) · `refunded → devolvido`.

**Antifraude.** Ativar a análise do Mercado Pago. Pedido em revisão manual **não** vai para o Bling até aprovar. Cosmético importado de ticket alto é alvo clássico de fraude — não pular esta etapa.

## 3. Melhor Envio

Cotação com Correios (PAC/SEDEX), Jadlog, Loggi e demais transportadoras da conta.

- **Cotação:** chamada na PDP (por CEP, com o item) e no carrinho (pacote completo). Cache de 1h por combinação CEP+peso+valor no Redis — reduz custo de API e latência.
- **Regras próprias:** frete grátis acima de R$ X (variável por região) · entrega própria por motoboy na Grande Rio com tabela fixa e prazo de 24h, exibida como opção destacada quando o CEP for da região · prazo exibido = prazo da transportadora + prazo de manuseio (2 dias úteis) — sempre prometer com folga.
- **Exibição:** sempre em data ("chega até quarta, 22/08"), não em "5 a 8 dias úteis". Data converte melhor e gera menos ticket de atendimento.
- **Etiqueta:** geração e impressão no painel do Melhor Envio; o site só consome o código de rastreio de volta.

## 4. n8n — workflows a construir

| Workflow | Gatilho | O que faz |
|---|---|---|
| `bling-sync-catalogo` | cron 5h | Sync completo de produtos |
| `bling-sync-estoque` | cron 10min | Sync incremental de saldo |
| `pedido-para-bling` | webhook do site | Cria pedido de venda, com retry |
| `nfe-e-rastreio` | webhook Bling | Atualiza pedido, dispara e-mail |
| `carrinho-abandonado` | cron 30min | E-mail em D+1h, D+24h, D+72h e handoff para a Larissa |
| `pos-compra` | evento de pedido | Sequência transacional completa |
| `pedido-avaliacao` | D+7 da entrega | E-mail pedindo avaliação, com link direto |
| `alerta-operacional` | cron/eventos | Falhas de sync, zero pedidos, erro de pagamento |
| `relatorio-diario` | cron 7h | Resumo de vendas no Telegram do Stevie |

Todos os workflows exportados em JSON e versionados em `infra/n8n-workflows/`.

## 5. Larissa (WhatsApp B2C)

A Larissa e o site são o mesmo funil, não dois canais separados.

- **Site → Larissa:** botão de WhatsApp flutuante na PDP e no checkout, com link `wa.me` carregando o SKU e a origem no parâmetro, para ela já entrar na conversa sabendo o que a cliente estava vendo. No carrinho abandonado, a Larissa entra em D+24h quando há telefone.
- **Larissa → site:** ela envia link direto do produto e link de carrinho pré-montado (`/carrinho/compartilhado?itens=SKU:qtd,...`). O pedido pode fechar no site com a atribuição da Larissa preservada em `pedido.origem`.
- **Contexto compartilhado:** ela precisa consultar estoque e preço em tempo real. Expor endpoint interno `GET /api/interno/produto/:sku` com autenticação por token, retornando preço, preço Pix, estoque e prazo por CEP.

Sem essa ponte, o cliente recebe dois preços diferentes em dois canais — é o pior erro possível para a confiança da marca.

## 6. Analytics

- **GA4** com e-commerce completo: `view_item_list`, `view_item`, `select_item`, `add_to_cart`, `remove_from_cart`, `view_cart`, `begin_checkout`, `add_shipping_info`, `add_payment_info`, `purchase`. Sem esse conjunto completo não há diagnóstico de funil possível.
- **Meta CAPI** server-side, com deduplicação por `event_id` contra o pixel do navegador. Bloqueador de anúncio derruba 30%+ dos eventos de browser — sem CAPI a otimização de campanha fica cega.
- **Google Merchant Center**: feed XML em `/feed/google.xml`, atualizado a cada 6h, com `availability`, `price`, `sale_price`, `gtin` (o EAN), `brand`, `condition`. Habilita Shopping e Performance Max.
- **PostHog** para funil, gravação de sessão (com máscara em campos sensíveis) e testes A/B.
- **Consent Mode v2** — nenhum evento de marketing dispara antes do aceite do banner de cookies.
