# API do painel — vendas das lojas ao vivo

API **somente leitura** para um painel de gestão acompanhar os pedidos das
quatro lojas (BeautyNow, Be2Beauty, Pulse e Bradeco) em tempo real. Ela não
altera nada no site.

- **Endereço base:** `https://beautynow-servidor.onrender.com/api/v1`
- **Autenticação:** token no cabeçalho, em toda chamada:
  `Authorization: Bearer SEU_TOKEN` (ou `X-API-Key: SEU_TOKEN`)
- O token fica na variável `PAINEL_API_TOKENS` do servidor (Render). Para
  trocar ou revogar, edite essa variável: vários tokens podem ser separados
  por vírgula, assim dá para trocar sem derrubar quem já está conectado.
  **Nunca** coloque o token no repositório nem em código que roda no
  navegador de terceiros.
- Valores em **centavos** (inteiro): `27331` = R$ 273,31.
- Datas em ISO 8601 (UTC). Os filtros `desde`/`ate` usam o dia de Brasília.

## Dados do cliente

Para gestão, a API entrega só o necessário: nome, e-mail, cidade e UF.
CPF, telefone e endereço completo **não** saem por aqui (LGPD,
`docs/08-juridico-fiscal-lgpd.md`). O detalhe completo de entrega continua
no painel ADM do site.

## Endpoints

### `GET /resumo`

Totais do período. Filtros opcionais: `desde=AAAA-MM-DD`, `ate=AAAA-MM-DD`,
`loja=beautynow|be2beauty|pulse|bradeco`.

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://beautynow-servidor.onrender.com/api/v1/resumo?desde=2026-10-01"
```

```json
{
  "pedidos": 12,
  "pagos": 9,
  "aguardandoPagamento": 2,
  "cancelados": 1,
  "faturamentoCentavos": 248930,
  "ticketMedioCentavos": 27659,
  "porLoja": { "beautynow": { "pedidos": 7, "faturamentoCentavos": 190000 } },
  "porMeio": { "pix": { "pedidos": 6, "faturamentoCentavos": 150000 } },
  "porDia": { "2026-10-07": { "pedidos": 1, "faturamentoCentavos": 27331 } },
  "atualizadoEm": "2026-10-13T04:13:12.591Z"
}
```

Faturamento, ticket médio, `porLoja`, `porMeio` e `porDia` contam só pedidos **pagos**.

### `GET /pedidos`

Lista os pedidos, do mais novo para o mais antigo. Filtros: `desde`, `ate`,
`loja`, `status` (`aguardando_pagamento`, `pago`, `cancelado`) e `limite`
(padrão 100, máximo 500).

### `GET /pedidos/{numero}`

Um pedido. Exemplo: `/pedidos/BN-363366`.

Formato de cada pedido:

```json
{
  "numero": "BN-363366",
  "loja": "beautynow",
  "data": "2026-10-07T22:45:27.007Z",
  "status": "pago",
  "pagoEm": "2026-10-07T18:46:24.000-04:00",
  "meio": "pix",
  "totalCentavos": 27331,
  "descontoCentavos": 0,
  "cupom": null,
  "frete": "Motoboy",
  "afiliado": null,
  "vendedor": null,
  "cliente": { "nome": "…", "email": "…", "cidade": "Rio de Janeiro", "uf": "RJ" },
  "itens": [{ "sku": "CAMUMEDI1L", "titulo": "…", "quantidade": 1, "precoCentavos": 26780 }],
  "enviadoAoBling": false
}
```

### `GET /eventos` — ao vivo

Conexão aberta (Server-Sent Events). Cada novidade chega na hora:

| Evento | Quando |
|---|---|
| `pedido.criado` | cliente fechou o pedido (ainda sem pagamento) |
| `pedido.pago` | pagamento confirmado (Mercado Pago ou marcado pelo ADM) |
| `pedido.status` | outra mudança de status (ex.: cancelado) |

Cada evento traz `{ "tipo", "em", "pedido": { …mesmo formato acima… } }`. A cada
25 segundos chega um comentário `: ping` só para manter a conexão viva.

```bash
curl -N -H "Authorization: Bearer $TOKEN" \
  https://beautynow-servidor.onrender.com/api/v1/eventos
```

Em JavaScript (Node 18+ ou navegador do próprio painel):

```js
const resposta = await fetch("https://beautynow-servidor.onrender.com/api/v1/eventos", {
  headers: { Authorization: `Bearer ${TOKEN}` },
});
const leitor = resposta.body.pipeThrough(new TextDecoderStream()).getReader();
for (;;) {
  const { value, done } = await leitor.read();
  if (done) break; // caiu: reconecte depois de alguns segundos
  console.log(value); // linhas "event: pedido.pago" / "data: {…}"
}
```

Se a conexão cair (o servidor reinicia algumas vezes por dia), reconecte e
chame `/pedidos?desde=…` para buscar o que passou no intervalo.

### Webhook (opcional) — o servidor avisa o painel

Se o painel tiver um endereço HTTPS para receber avisos, coloque-o na
variável `PAINEL_WEBHOOK_URL` do servidor. A cada evento acima, o servidor
faz um `POST` com o mesmo JSON. O cabeçalho `X-Assinatura` traz o
HMAC-SHA256 (hex) do corpo, assinado com o **primeiro** token de
`PAINEL_API_TOKENS`. Confira a assinatura antes de aceitar o aviso.

## Erros

| Código | Significado |
|---|---|
| 401 | token ausente ou errado |
| 404 | pedido não encontrado |
| 503 | API não configurada (sem `PAINEL_API_TOKENS` no servidor) |
