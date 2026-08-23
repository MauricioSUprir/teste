# 03 — Design System BeautyNow

## 1. Direção

A BeautyNow vende produto profissional para quem cuida do cabelo e da pele com método. A referência de qualidade é a Beleza na Web; a personalidade não é. A BLZ é generalista e promocional — muita cor, muito selo, muita oferta empilhada. A BeautyNow ocupa o espaço oposto e mais defensável para uma operação do nosso tamanho: **clareza e curadoria**. Menos ruído por tela, hierarquia forte, produto em primeiro plano.

Isso não é escolha estética gratuita: um site limpo e rápido converte melhor que um site barulhento quando você não tem 17 mil SKUs para justificar a bagunça. Nossa vantagem é a seleção, então a interface tem que fazer a seleção parecer intencional.

**Regra de ouro por tela:** uma única ênfase visual. Na PDP é o CTA de compra. Na PLP é o produto. Na home é o hero. Tudo o mais recua.

## 2. Identidade

Logo BeautyNow: monograma **"BN"** em serifada elegante, roxo profundo, com wordmark **"BEAUTY NOW"** em caixa alta espaçada, violeta. As cores principais da marca são **roxo** (`#4A2882`, do monograma) e **violeta** (`#6847C8`, do wordmark). O monograma é o elemento gráfico recorrente (favicon, composições editoriais, selos), sempre com contenção. *(Identidade atualizada em ago/2026 a partir do logo oficial fornecido pelo Mauricio — substitui a gota rosa da versão inicial deste documento.)*

## 3. Tokens

```css
:root {
  /* Marca */
  --bn-roxo:          #4A2882;   /* ação primária, preço em destaque */
  --bn-roxo-escuro:   #381D65;   /* hover/pressed */
  --bn-roxo-claro:    #F2EDFA;   /* fundo de destaque suave */
  --bn-violeta:       #6847C8;   /* confiança: selos, informação, links */
  --bn-violeta-claro: #EFEBFA;

  /* Neutros */
  --bn-tinta:         #14161A;   /* texto principal */
  --bn-grafite:       #4A4F57;   /* texto secundário */
  --bn-cinza:         #8A9099;   /* texto terciário, placeholder */
  --bn-linha:         #E4E6EA;   /* bordas, divisores */
  --bn-superficie:    #F7F8FA;   /* fundo de seção */
  --bn-branco:        #FFFFFF;

  /* Semânticos */
  --bn-sucesso:       #1E8E5A;   /* em estoque, pagamento aprovado, Pix */
  --bn-alerta:        #B8730C;   /* últimas unidades, aviso */
  --bn-erro:          #C6273E;   /* erro de formulário, indisponível */
  --bn-oferta:        #381D65;   /* selo de desconto */

  /* Tipografia */
  --fonte-titulo: 'Fraunces', Georgia, serif;
  --fonte-texto:  'Inter', -apple-system, sans-serif;
  --fonte-numero: 'Inter', sans-serif;  /* tabular-nums em preço */

  /* Escala tipográfica (mobile → desktop com clamp) */
  --t-hero:   clamp(2rem, 5vw, 3.25rem);
  --t-h1:     clamp(1.625rem, 3.5vw, 2.25rem);
  --t-h2:     clamp(1.375rem, 2.5vw, 1.75rem);
  --t-h3:     1.125rem;
  --t-corpo:  1rem;
  --t-peq:    0.875rem;
  --t-micro:  0.75rem;

  /* Espaçamento — base 4px */
  --e-1: 4px;  --e-2: 8px;  --e-3: 12px; --e-4: 16px;
  --e-5: 24px; --e-6: 32px; --e-7: 48px; --e-8: 64px; --e-9: 96px;

  /* Raio */
  --r-sm: 6px; --r-md: 10px; --r-lg: 16px; --r-pill: 999px;

  /* Elevação — usar pouco */
  --sombra-card:  0 1px 2px rgba(20,22,26,.06), 0 4px 12px rgba(20,22,26,.04);
  --sombra-drawer: 0 0 0 1px rgba(20,22,26,.05), -8px 0 32px rgba(20,22,26,.12);

  /* Layout */
  --max-conteudo: 1280px;
  --alt-header: 64px;
}
```

**Tipografia — a decisão que carrega a personalidade.** Fraunces (serifada, com eixo óptico variável) em títulos editoriais e nomes de produto na PDP; Inter em toda a interface, preço e formulário. A serifada dá o registro de cuidado e curadoria que a categoria pede; a Inter dá legibilidade de dado. Nunca usar Fraunces em texto corrido nem em botão.

**Preço sempre com `font-variant-numeric: tabular-nums`** — sem isso os números dançam entre estados e a grade parece amadora.

## 4. Grade

- Container 1280px, gutter 16px (mobile) / 24px (desktop).
- Breakpoints: `sm 640` · `md 768` · `lg 1024` · `xl 1280`.
- Grade de produto: 2 colunas (mobile) → 3 (md) → 4 (lg) → 5 na PLP ampla (xl).
- Alvo de toque mínimo 44×44px em qualquer elemento interativo.

## 5. Componentes-chave

### CardProduto

Ordem fixa, de cima para baixo:

```
┌──────────────────────────┐
│ [selo -%]   [♡ favorito] │  ← selos no canto superior esquerdo
│                          │
│      imagem 1:1          │  ← fundo branco, produto centralizado
│                          │
├──────────────────────────┤
│ MARCA                    │  ← micro, caixa alta, cinza
│ Nome do produto 200ml    │  ← 2 linhas máx., clamp
│ ★ 4.8 (127)              │  ← só se houver ≥ 3 avaliações
│ R$ 89,90  de R$ 129,90   │  ← preço atual em destaque, riscado ao lado
│ R$ 84,50 no Pix          │  ← verde, --t-peq
│ ou 3x de R$ 29,96        │  ← cinza, --t-micro
│ [ + 3 tamanhos ]         │  ← condicional
└──────────────────────────┘
```

Hover em desktop: troca para a segunda imagem + revela botão "Adicionar". Em mobile não existe hover — o card inteiro é link e o "Adicionar" só aparece na PDP (menos erro de toque acidental).

Skeleton obrigatório com as mesmas dimensões, para CLS zero.

### PDP — estrutura acima da dobra

Mobile (ordem vertical):

```
breadcrumb
galeria (carrossel, dots, badge de vídeo se houver)
MARCA (link)
Nome completo do produto
★ 4.8 (127 avaliações) → âncora
─────────────────
R$ 89,90     [-31%]
de R$ 129,90
R$ 84,50 no Pix (5% off)
em até 6x de R$ 14,98 sem juros
─────────────────
Seletor de variação (tamanho/tom) — chips, não select
Quantidade [− 1 +]
[  ADICIONAR À SACOLA  ]  ← full width, --bn-roxo, sticky ao rolar
─────────────────
📍 Calcular frete e prazo
   [CEP________] [OK]
   → resultado: transportadora, prazo, valor
─────────────────
✓ Distribuidor autorizado  ✓ Troca em 7 dias  ✓ Envio em 24h
```

Desktop: galeria à esquerda (60%), coluna de compra à direita (40%) com `position: sticky`.

**Regra crítica:** o CTA e o preço precisam estar visíveis sem rolagem em viewport de 360×640. Se não couberem, corta-se conteúdo — não o CTA.

### PDP — abaixo da dobra

Ordem: 1) Sobre o produto (descrição rica, benefícios em bullets) · 2) Como usar (passo a passo numerado — aqui a numeração carrega informação real de sequência) · 3) Composição/ingredientes (colapsável, texto integral do fabricante) · 4) Especificações (tabela: volume, tipo de cabelo/pele, indicação, com/sem sulfato, vegano, registro ANVISA quando aplicável) · 5) Compre junto (bundle com desconto) · 6) Avaliações · 7) Perguntas e respostas · 8) Produtos da mesma linha · 9) Quem viu também viu.

### Carrinho (drawer lateral)

Topo: barra de progresso de frete grátis — "Faltam R$ 32,00 para frete grátis" com barra preenchendo. É o mecanismo isolado com maior impacto sobre ticket médio; implementar bem e testar em todos os estados (já atingido, quase, longe).

Abaixo: itens com miniatura, variação, quantidade editável, remover, subtotal. Depois: faixa de brinde (se ativa), campo de cupom colapsado, resumo, CTA de checkout, e uma faixa de cross-sell horizontal com 4 itens de baixo ticket.

### Checkout

Página única, três blocos empilhados com acordeão, resumo fixo à direita em desktop e colapsável no topo em mobile.

1. **Identificação** — e-mail primeiro (permite recuperação de carrinho abandonado mesmo se desistir), depois nome, CPF, telefone. Sem senha obrigatória.
2. **Entrega** — CEP com autopreenchimento via ViaCEP, opções de frete com prazo e valor, campo de complemento e ponto de referência.
3. **Pagamento** — Pix (destacado, com o desconto explícito), cartão, boleto.

Sem header de navegação e sem menu no checkout. Só logo, selo de segurança e telefone de atendimento. Cada distração custa conversão.

## 6. Microcopy

Voz: direta, informativa, sem infantilizar. Quem compra produto profissional sabe do que precisa.

| Situação | Escrever | Não escrever |
|---|---|---|
| CTA principal | Adicionar à sacola | Comprar agora! |
| Estoque baixo | Últimas 3 unidades | Corre que tá acabando!! 🔥 |
| Frete calculado | Chega até 22/08 por R$ 18,90 | Frete: R$ 18,90 |
| Erro de CEP | CEP não encontrado. Confira os 8 dígitos. | Ops! Algo deu errado |
| Carrinho vazio | Sua sacola está vazia. Comece pelos mais vendidos. | Nada por aqui... 😢 |
| Pagamento recusado | O banco recusou a transação. Tente outro cartão ou pague com Pix. | Erro no pagamento |

Regras: erro sempre diz **o que houve e o que fazer**. Ação mantém o mesmo nome do início ao fim do fluxo. Tela vazia é convite para agir, não lamento.

## 7. Piso de qualidade

- Foco visível (`outline` de 2px em `--bn-violeta`) em todo elemento navegável — nunca `outline: none` sem substituto.
- Contraste AA em texto e AAA em preço e CTA.
- `prefers-reduced-motion` respeitado; toda transição acima de 200ms tem fallback estático.
- Toda imagem de produto com `alt` descritivo gerado de `marca + nome + variação`.
- Formulário com `label` real, `autocomplete` correto e `inputmode` adequado (numérico em CEP, CPF e cartão).
- Zero layout shift: reservar altura de imagem, banner e bloco de preço.

## 8. Movimento

Contido e funcional. Três lugares apenas: drawer do carrinho (slide 240ms, `cubic-bezier(.32,.72,0,1)`), troca de imagem na galeria (fade 160ms), e feedback de "adicionado" (o item voa em miniatura até o ícone da sacola — 400ms, é a única animação decorativa permitida, e existe porque confirma a ação sem interromper a navegação). Nada mais anima. Carrossel automático em hero é proibido.
