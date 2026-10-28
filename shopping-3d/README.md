# Beauty Shopping 3D

Shopping virtual de beleza, **todo em 3D**: o visitante monta o próprio avatar
no provador, chega pela praça da frente, entra pelas portas de vidro, passeia
pelo átrio de três andares, entra nas lojas, vê a ficha dos produtos, enche a
sacola e fecha a compra no caixa de cada loja — sem sair do 3D. As marcas
**alugam lojas** dentro do shopping e cada uma tem a sua loja com as próprias
cores, letreiro, piso, produtos e atendente. Quem está online ao mesmo tempo
se vê, conversa e faz gestos.

Projeto separado dos sites (BeautyNow, Be2Beauty, Pulse, Bradeco): não usa o
Next.js do `apps/storefront` nem faz parte do workspace `apps/*`.

## Rodar

```bash
cd shopping-3d
npm ci
npm run dev        # http://localhost:5173
npm run build      # gera dist/ (site estático)
npm run catalogo   # refaz os dados das lojas a partir do catálogo do Hub

# servidor dos visitantes online (WebSocket), em outro terminal
cd servidor && npm ci && node index.mjs   # ws://localhost:8787/ws

# contas (o servidor BeautyNow, com o código saindo no log), em outro terminal
cd ../apps/servidor && npm ci && EMAIL_MODO=console ORIGENS_SHOPPING=http://localhost:5173 node index.mjs   # http://localhost:4000
```

## O que já tem (prévia)

- **Lado de fora** (fim de tarde): fachada curva de vidro de três andares entre
  pilares roxos, coroa branca com o logo grande aceso, alas com janelas acesas,
  marquise roxa com LED, portas automáticas, praça da frente com canteiros,
  coqueiros e postes, estacionamento com carros, a rua e a cidade em volta com
  os morros no horizonte. Uma abertura de câmera mostra a fachada na chegada.
- **Átrio de três andares**: vazio curvo do saguão até a Praça da Beleza, com
  as varandas dos pisos 2 e 3 (testeira branca com LED quente, vidro e
  corrimão), vitrines acesas das lojas de cima (em breve), claraboia com grelha
  de aço, bandeiras com o logo, escadas rolantes cruzando o vazio, elevador
  panorâmico de vidro e gente passeando lá em cima.
- **Térreo**: saguão com provador e quadro de boas-vindas, galeria com 8 lojas
  de 144 m², Praça da Beleza com lounge (árvore, sofás lilás) e o quiosque roxo
  do Beauty Shopping, totens com os pisos e o mapa, visitantes passeando.
- **Lojas âncora**: BeautyNow e Be2Beauty no fundo da praça são a mesma loja 3D
  dos sites, com a Larissa no caixa. Na galeria fica a Pulse.
- **Compra**: cursor em cima do produto mostra a ficha; clique abre o produto e
  põe na sacola; no caixa de cada loja aparece o resumo. **Pix e cartão:
  próxima etapa** (nesta prévia nada é cobrado).
- **Aluguel**: as lojas vagas têm adesivo "ALUGA-SE" e totem; dá para **montar
  a própria loja na prévia** (nome, frase, cores, piso, letreiro, produtos).
- **Online**: outras pessoas aparecem com o avatar e o nome, conversa (balão em
  cima da cabeça), gestos (acenar, aplaudir, dançar, rir, comemorar), "ir até".
- **Conta**: entra com o e-mail e um código de 6 números (o mesmo login da
  loja BeautyNow, sem senha). Fica salvo o visual com o nome, a sacola, as
  lojas montadas e a música; em outro aparelho, tudo volta. Dá para sair e
  apagar a conta. O servidor é o da BeautyNow (`apps/servidor/contas-shopping.mjs`).
- Computador (teclado, mouse, clique no chão para ir) e celular (joystick,
  arrastar para olhar, tocar para ir), com a qualidade ajustada sozinha.

Os pisos 2 e 3 ainda são para olhar (não se sobe): as lojas de lá mostram as
categorias previstas e "em breve" — nenhuma marca de terceiros é usada sem
contrato de aluguel.

## Estrutura

| Pasta | O quê |
|---|---|
| `src/dados/` | planta e inquilinos (`lojas.ts`), catálogo, ficha do produto, sacola, avatares |
| `src/mundo/` | térreo (`estrutura.ts`), átrio de 3 andares (`atrio.ts`), lado de fora (`exterior.ts`), cidade (`cidade.ts`), lojas da galeria (`loja.ts`), lojas âncora (`loja-site.ts`), letreiros, materiais e texturas, colisão |
| `src/avatar/` | carregar/pintar avatares, animação, provador, visitantes (térreo e varandas), gente online |
| `src/motor/` | renderizador e tratamento de cor, câmera em 3ª pessoa (com a abertura), teclado/mouse/toque, som |
| `src/rede/` | conexão com o servidor dos visitantes online |
| `src/dados/conta.ts`, `sincronia.ts` | conta (login por código) e o que ela guarda |
| `src/ui/` | barra, painéis (produto, sacola, caixa, mapa, aluguel, editor), provador, conversa e gestos |
| `src/copy/` | todos os textos em pt-BR |
| `servidor/` | servidor WebSocket (Node + ws): posições, conversa e gestos |
| `public/marca/` | logo Beauty Shopping (roxo e branco, folhas, nome) |
| `public/avatares/` | avatares em GLB (Microsoft Rocketbox, MIT), máscaras de roupa e retratos |

Para pôr uma marca numa loja: acrescente um `Inquilino` em `MARCAS_DO_GRUPO`
(`src/dados/lojas.ts`) com a unidade, as cores, o letreiro e os produtos.

## Próximas etapas

1. Pagamento dentro do 3D: Pix (QR no caixa) e cartão (até 6x) pelo Mercado Pago.
2. Cadastro de lojistas: conta, contrato de aluguel e painel para montar a loja
   e subir os produtos (hoje a loja montada é só uma prévia no aparelho).
3. Subir de escada rolante e elevador para os pisos 2 e 3, com lojas de verdade.

## Créditos

- Avatares e animações: [Microsoft Rocketbox](https://github.com/microsoft/Microsoft-Rocketbox), licença MIT (`public/modelos/LICENCA-ROCKETBOX.txt`).
- Plantas: Poly Haven, CC0 (`public/modelos/CREDITOS.txt`).
- Música: composição própria gerada no navegador (sem música de terceiros).
- Fachada, átrio, cidade e letreiros: modelados no próprio código (sem modelos de terceiros).
