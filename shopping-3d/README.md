# Shopping da Beleza 3D

Shopping virtual de beleza, **todo em 3D**: o visitante monta o próprio avatar
no provador, entra na galeria, passeia, entra nas lojas, vê a ficha dos
produtos, enche a sacola e fecha a compra no caixa de cada loja — sem sair do 3D.
As marcas **alugam lojas** dentro do shopping e cada uma tem a sua loja com as
próprias cores, letreiro, piso, produtos e atendente.

Projeto separado dos sites (BeautyNow, Be2Beauty, Pulse, Bradeco): não usa o
Next.js do `apps/storefront` nem faz parte do workspace `apps/*`.

## Rodar

```bash
cd shopping-3d
npm ci
npm run dev        # http://localhost:5173
npm run build      # gera dist/ (site estático)
npm run catalogo   # refaz src/dados/catalogo.json a partir do catálogo do Hub
```

## O que já tem (prévia)

- **Provador**: 16 pessoas (8 mulheres, 8 homens, tons de pele e cabelos
  variados), cor do cabelo, da blusa e da calça/saia, nome em cima da cabeça.
  Fica guardado no aparelho.
- **Shopping**: galeria de 16 m com claraboia em abóbada, varanda do 2º piso,
  8 lojas de 144 m², Praça da Beleza com fonte e telão de LED, totens com mapa,
  bancos, plantas, visitantes passeando sozinhos e música ambiente.
- **Lojas do grupo** (101 BeautyNow, 102 Be2Beauty, 103 Pulse): 48 produtos
  cada nas gôndolas, com etiqueta de preço, mesa de destaques, bancada de
  maquiagem e atendente no caixa.
- **Compra**: cursor em cima do produto mostra a ficha (o que é, para quem,
  tipo de cabelo/pele, como usar); clique abre o produto e põe na sacola;
  no caixa de cada loja aparece o resumo. **Pix e cartão: próxima etapa**
  (nesta prévia nada é cobrado).
- **Aluguel**: as lojas vagas têm adesivo "ALUGA-SE" e totem; quem entra vê o
  que vem junto e pode **montar a própria loja na prévia** (nome, frase, cores,
  piso, letreiro, categoria de produtos) — ela abre na hora, com atendente.
- Computador (teclado, mouse, clique no chão para ir) e celular (joystick,
  arrastar para olhar, tocar para ir), com a qualidade ajustada sozinha.

## Estrutura

| Pasta | O quê |
|---|---|
| `src/dados/` | planta e inquilinos (`lojas.ts`), catálogo, ficha do produto, sacola, avatares |
| `src/mundo/` | prédio (`estrutura.ts`), lojas (`loja.ts`), materiais e texturas, colisão, caminhos |
| `src/avatar/` | carregar/pintar avatares, animação, provador, visitantes |
| `src/motor/` | renderizador, câmera em 3ª pessoa, teclado/mouse/toque, som |
| `src/ui/` | barra, painéis (produto, sacola, caixa, mapa, aluguel, editor), provador |
| `src/copy/` | todos os textos em pt-BR |
| `public/avatares/` | avatares em GLB (Microsoft Rocketbox, MIT), máscaras de roupa e retratos |

Para pôr uma marca numa loja: acrescente um `Inquilino` em `MARCAS_DO_GRUPO`
(`src/dados/lojas.ts`) com a unidade, as cores, o letreiro e os produtos.

## Próximas etapas

1. Pagamento dentro do 3D: Pix (QR no caixa) e cartão (até 6x) pelo Mercado Pago.
2. Cadastro de lojistas: conta, contrato de aluguel e painel para montar a loja
   e subir os produtos (hoje a loja montada é só uma prévia no aparelho).
3. Visitantes de verdade juntos (multijogador), com chat e atendente ao vivo.
4. 2º piso e mais lojas.

## Créditos

- Avatares e animações: [Microsoft Rocketbox](https://github.com/microsoft/Microsoft-Rocketbox), licença MIT (`public/modelos/LICENCA-ROCKETBOX.txt`).
- Plantas: Poly Haven, CC0 (`public/modelos/CREDITOS.txt`).
- Música: composição própria gerada no navegador (sem música de terceiros).
