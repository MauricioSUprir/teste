# 04 — Modelo de Dados

> A taxonomia de atributos deve ser **validada contra `docs/benchmark/taxonomia-facetas.md`** (Fase 0.2) antes da implementação. O que está aqui é a base; a pesquisa da BLZ completa e corrige.

## 1. Catálogo

### Produto (`product`)
Entidade conceitual — "Shampoo Reconstrutor Linha X".

| Campo | Tipo | Origem | Nota |
|---|---|---|---|
| id | uuid | Medusa | |
| slug | string | gerado | `marca-nome-caracteristica` |
| titulo | string | Bling | |
| marca_id | fk | Bling | |
| linha_id | fk | manual | ex.: "Blond Care" |
| descricao_rica | html | fabricante/manual | |
| modo_de_uso | html | fabricante | |
| composicao | text | fabricante | INCI completo |
| categorias | fk[] | manual | multi |
| atributos | jsonb | manual | ver §2 |
| registro_anvisa | string? | Bling | quando aplicável |
| status | enum | | rascunho / ativo / arquivado |
| destaque_ate | timestamp? | | para "lançamento" |

### Variante (`product_variant`)
O que é efetivamente vendido. Todo produto tem ao menos uma.

| Campo | Tipo | Origem |
|---|---|---|
| sku | string | Bling (é a chave de integração) |
| ean | string | Bling |
| titulo_variacao | string | ex.: "300ml", "Tom 7.1" |
| preco_de | int (centavos) | site |
| preco_por | int (centavos) | site |
| preco_pix | int (centavos) | calculado do desconto Pix |
| custo | int | Bling (nunca exposto) |
| estoque | int | Bling (réplica) |
| estoque_reservado | int | Medusa |
| peso_g / altura / largura / comprimento | int | Bling — obrigatório para frete |
| ativo | bool | |

**Regra:** variante sem dimensão e peso **não pode ficar ativa** — quebra o cálculo de frete. Validar no sync.

### Kit (`kit`)
Agrupamento vendável com preço próprio. Tem SKU próprio no Bling (kit real, com estoque próprio) ou é virtual (composto por SKUs, com estoque derivado do menor componente). Sinalizar qual dos dois em `tipo_kit` — a lógica de estoque muda completamente.

## 2. Taxonomia de atributos de beleza

O que faz o filtro de um e-commerce de beleza funcionar. Cada atributo é uma faceta de busca.

**Transversais:** categoria (árvore) · marca · linha · faixa de preço · avaliação · disponibilidade · vegano · cruelty-free · nacional/importado · tamanho de viagem.

**Cabelos:** tipo de cabelo (liso / ondulado / cacheado / crespo) · condição (oleoso / seco / misto / danificado / quimicamente tratado / com progressiva / descolorido / grisalho) · necessidade (hidratação / nutrição / reconstrução / anti-frizz / anti-queda / crescimento / brilho / definição de cacho / matização / proteção térmica / anticaspa) · tipo de produto (shampoo / condicionador / máscara / leave-in / óleo / sérum / ampola / acidificante / tônico / finalizador / spray / coloração / descolorante / oxidante) · com/sem sulfato · com/sem silicone · com/sem parabeno · low/no poo · volume.

**Skincare:** tipo de pele (oleosa / seca / mista / normal / sensível) · preocupação (acne / manchas / linhas finas / poros / oleosidade / vermelhidão / olheiras / desidratação) · etapa da rotina (limpeza / tônico / tratamento / hidratação / proteção solar / esfoliação / máscara) · ativo principal (vitamina C / ácido hialurônico / retinol / niacinamida / ácido salicílico / AHA-BHA / peptídeos / ceramidas) · FPS · textura (gel / creme / sérum / óleo / bruma).

**Maquiagem:** área (rosto / olhos / lábios / unhas) · tipo · cobertura · acabamento (matte / natural / luminoso) · subtom · à prova d'água · tom (com swatch de cor real, não nome).

**Perfumaria:** gênero · família olfativa · concentração (EDT / EDP / parfum / cologne) · nota de topo/coração/fundo · ocasião · volume.

Armazenar em `product.atributos` (jsonb) com esquema validado por Zod, e espelhar no índice do Meilisearch como facetas. Um atributo novo é uma chave nova no schema — não uma tabela nova.

## 3. Pedido

Máquina de estados (não inventar estados novos):

```
rascunho → aguardando_pagamento → pago → em_separacao → faturado
        → enviado → entregue
        ↘ cancelado (de qualquer estado antes de enviado)
        ↘ devolvido (de entregue)
```

Cada transição grava evento em `pedido_evento` (quem, quando, origem: site / bling / n8n / manual). Sem isso não há como auditar divergência com o ERP.

Campos além do padrão Medusa: `bling_pedido_id`, `nfe_numero`, `nfe_chave`, `nfe_url`, `codigo_rastreio`, `transportadora`, `origem` (organico / meta / google / larissa / instagram), `cupom_usado`.

## 4. Cliente

`cliente`: id, email (único), nome, cpf, telefone (E.164, chave de ligação com a Larissa), data_nascimento (para campanha de aniversário), aceite_marketing (bool + timestamp + origem — exigência de LGPD), aceite_termos.

`endereco`: multi por cliente, um marcado como padrão. Campos brasileiros completos (CEP, logradouro, número, complemento, bairro, cidade, UF, referência).

**Perfil de beleza** (`cliente_perfil`) — opcional, alimenta recomendação: tipo de cabelo, tipo de pele, preocupações, marcas favoritas. Preencher progressivamente, nunca com um formulário obrigatório no cadastro.

## 5. Promoções

- `cupom`: código, tipo (percentual / valor / frete grátis), valor, mínimo de pedido, limite de uso total e por cliente, validade, restrição por categoria/marca/SKU, acumulável (bool), primeira compra apenas (bool).
- `faixa_brinde`: valor mínimo, SKU do brinde, estoque de brinde, prioridade, período.
- `regra_frete_gratis`: valor mínimo por região (o mínimo do RJ pode ser menor que o do Norte).
- `preco_pix`: percentual global com override por produto.

**Ordem de aplicação (fixar e testar):** desconto de produto → cupom → frete grátis → brinde → desconto Pix (sempre por último, sobre o total já descontado).

## 6. Conteúdo

`artigo`: slug, titulo, resumo, corpo (MDX), capa, autor, categoria editorial, produtos_relacionados (fk[]), publicado_em, seo_title, seo_description.

O vínculo `artigo → produto` é o que transforma conteúdo em receita. Todo artigo precisa de pelo menos 3 produtos relacionados; validar na publicação.

## 7. Avaliações

`avaliacao`: pedido_id (obriga compra verificada), variante_id, nota (1–5), titulo, texto, fotos[], atributos avaliados (ex.: "cheiro", "rendimento", "resultado" — nota individual), status de moderação, resposta_da_loja, util_sim/util_nao.

Só aceitar avaliação de quem comprou. Isso reduz volume, mas é o que faz o bloco valer alguma coisa.

## 8. Índice de busca (Meilisearch)

Documento achatado por variante: `sku, titulo, marca, linha, categorias[], atributos achatados, preco_por, preco_pix, tem_estoque, nota_media, qtd_avaliacoes, vendas_30d, imagem, slug`.

- **Ordenáveis:** preco_por, nota_media, vendas_30d, criado_em.
- **Facetáveis:** todos os atributos de §2.
- **Buscáveis, por peso:** titulo > marca > linha > categorias > atributos > composicao.
- **Sinônimos PT-BR obrigatórios:** cabelo/capilar, shampoo/xampu, hidratante/creme hidratante, protetor solar/filtro solar/FPS, batom/labial, cacheado/cacho/crespo, tinta/coloração, ácido hialurônico/hialuronico. Ampliar com os termos reais de busca do site depois de 30 dias no ar.
