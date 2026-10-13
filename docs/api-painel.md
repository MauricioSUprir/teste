# API do painel — vendas ao vivo e administração das lojas

API para um painel de gestão acompanhar e administrar as quatro lojas
(BeautyNow, Be2Beauty, Pulse e Bradeco). Há dois tipos de token:

| Token | Variável no Render | O que pode |
|---|---|---|
| **Leitura** (`pnl_…`) | `PAINEL_API_TOKENS` | só a API `/api/v1` (resumo, pedidos, eventos ao vivo) |
| **Administração** (`adm_…`) | `PAINEL_ADMIN_TOKENS` | tudo o que o painel ADM do site faz (seção "Administração" abaixo) + a API `/api/v1` |

O token de administração altera dados reais: pedidos, preços, cupons,
banners, cadastros B2B e afiliados. Guarde-o só no **servidor** do painel,
nunca em página que roda no navegador.

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

## Administração (token `adm_…`)

Mesmas rotas que o painel ADM do site usa. O token de administração vai no
cabeçalho `Authorization: Bearer adm_…` e substitui a "chave" do painel —
não precisa mandar `chave` no corpo. Corpo sempre em JSON
(`Content-Type: application/json`). Endereço base: `https://beautynow-servidor.onrender.com`
(sem o `/api/v1`). Lojas: `beautynow`, `be2beauty`, `pulse`, `bradeco`.

As rotas de administração aceitam chamada vinda de servidor. Para chamar
direto do navegador de outro domínio, o domínio precisa entrar em
`ORIGENS_PERMITIDAS` no Render.

### Pedidos

| Método e rota | Corpo / parâmetros | O que faz |
|---|---|---|
| `GET /pedidos/lista` | — | todos os pedidos com dados completos de entrega (confere pagamentos pendentes no Mercado Pago antes de responder) |
| `POST /pedidos/status` | `{ "numero": "BN-123", "status": "pago" \| "cancelado" \| "aguardando_pagamento" }` | muda o status (venda paga fora do Mercado Pago, cancelamento) |
| `GET /pagamentos/pedido/{numero}` | — | o que o Mercado Pago diz do pedido: valor, aprovação, produção ou teste |

### Preços

| Método e rota | Corpo | O que faz |
|---|---|---|
| `GET /catalogo/precos` | — | preços definidos à mão, por loja |
| `POST /catalogo/precos` | `{ "loja", "slug", "precoPorCentavos", "precoDeCentavos"?, "titulo"? }` | define o preço de um produto numa loja. `precoPorCentavos: null` volta ao preço padrão |

### Catálogo

| Método e rota | Corpo | O que faz |
|---|---|---|
| `POST /catalogo/atualizacao` | `{ "acao": "pedir" }` | puxa o catálogo do Hub Suprir agora (em até ~10 min começa; ~15 min para publicar) |
| `GET /catalogo/atualizacao` | — | situação da última atualização |

### Cupons

| Método e rota | Corpo | O que faz |
|---|---|---|
| `GET /cupons/lista` | — | todos os cupons |
| `POST /cupons` | `{ "cupons": [ { "codigo": "PRIMAVERA15", "tipo": "percentual" \| "valor", "valor": 15, "minimoCentavos": 9900, "ativo": true } ] }` | grava a lista **inteira** (o que não vier é apagado). Percentual até 90; `valor` em centavos quando o tipo é `valor` |

### Banners da home

| Método e rota | Corpo | O que faz |
|---|---|---|
| `GET /banners?loja=beautynow` | — | banners no ar da loja |
| `POST /enviar-banners/salvar` | `{ "loja", "slot": "banner-1"…"banner-5" ou "banner-1-mobile"…, "mime": "image/jpeg", "base64": "…" }` | sobe ou troca um banner (até 7 MB) |
| `POST /enviar-banners/excluir` | `{ "loja", "slot" }` | tira um banner do ar |

### Profissionais (B2B)

| Método e rota | Corpo | O que faz |
|---|---|---|
| `GET /b2b/lista` | — | cadastros de CNPJ |
| `POST /b2b/decidir` | `{ "cnpj", "status": "aprovado" \| "recusado" \| "pendente" }` | libera ou bloqueia os preços para o CNPJ |
| `POST /b2b/excluir` | `{ "cnpj" }` | apaga o cadastro |

### Afiliados

| Método e rota | Corpo | O que faz |
|---|---|---|
| `GET /afiliados/admin` | — | afiliados, vendas, comissões e saques |
| `POST /afiliados/admin-cadastrar` | `{ "nome", "email", "whatsapp"?, "usuario"?, "chavePix"?, "cnpj"?, "comissaoPct", "loja"? }` | cadastra afiliado já aprovado (recebe e-mail com o link) |
| `POST /afiliados/decidir` | `{ "email", "status": "aprovado" \| "recusado" }` | aprova ou recusa pedido de entrada |
| `POST /afiliados/comissao` | `{ "email", "pct" }` | muda a comissão |
| `POST /afiliados/saque-decidir` | `{ "id", "status": "pago" \| "recusado" }` | registra o pagamento de um saque |
| `POST /afiliados/excluir` | `{ "email" }` | remove o afiliado |

### Bling

| Método e rota | O que faz |
|---|---|
| `GET /bling/status` | conexão com o Bling, pedidos enviados e último erro |

Exemplo — marcar um pedido como pago:

```bash
curl -X POST https://beautynow-servidor.onrender.com/pedidos/status \
  -H "Authorization: Bearer $TOKEN_ADMIN" -H "Content-Type: application/json" \
  -d '{"numero":"BN-363366","status":"pago"}'
```

## Erros

| Código | Significado |
|---|---|
| 401 | token ausente ou errado (API `/api/v1`) |
| 403 | token sem permissão de administração (rotas de administração) |
| 404 | pedido não encontrado |
| 503 | API não configurada (sem `PAINEL_API_TOKENS` no servidor) |
