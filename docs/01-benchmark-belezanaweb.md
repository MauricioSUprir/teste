# 01 — Benchmark: Beleza na Web

> **Esta é a Fase 0 do projeto. Nada é codado antes de ela estar concluída e registrada.**

## 1. Por que a Beleza na Web

É o maior e mais maduro e-commerce de beleza do Brasil. Fundado em 2008 por Alexandre Serodio, adquirido pelo Grupo Boticário em 2019, opera com mais de 17 mil SKUs e centenas de marcas nacionais e importadas. Foi eleito o e-commerce mais admirado da categoria cosméticos e perfumaria no Prêmio E-Commerce Brasil, superando Época Cosméticos, Ikesaki, O Boticário e Sephora. Em 2020 abriu marketplace e em 2021 lançou o braço B2B (BLZ Pro).

Ou seja: 18 anos de otimização de conversão em beleza, com capital de um dos maiores grupos do setor por trás. Cada bloco daquela página existe porque foi testado. Nosso trabalho não é adivinhar o que converte em beleza — é **ler o que já foi provado** e reimplementar com a nossa identidade e o nosso catálogo.

## 2. Regras de originalidade — INEGOCIÁVEIS

O que **pode** ser extraído da BLZ:
- Arquitetura de informação (que categorias existem, como se aninham, que filtros aparecem).
- Ordem e presença de blocos de informação (o que aparece acima da dobra na PDP, o que vem depois).
- Padrões de UX e fluxo (quantos passos no checkout, onde o frete é calculado, como o cross-sell é apresentado).
- Taxonomia de atributos de beleza (tipo de cabelo, tipo de pele, necessidade, tipo de produto).
- Gatilhos de conversão usados (urgência, prova social, faixa de frete grátis, desconto Pix).

O que **NÃO pode**, em nenhuma hipótese:
- Copiar HTML, CSS, JavaScript, componentes ou qualquer código do site.
- Baixar ou reutilizar imagens, banners, ícones, fotos de produto ou de campanha.
- Copiar textos: descrições de produto, títulos, copy de banner, textos institucionais, textos de blog.
- Reproduzir logo, paleta, tipografia ou qualquer elemento da identidade visual da BLZ.
- Copiar a estrutura de URL, nomes de marca próprios ou conteúdo editorial.
- Fazer scraping em massa do catálogo ou de avaliações.

**Teste prático:** se alguém colocar o BeautyNow e a BLZ lado a lado, tem que ficar óbvio que são duas empresas diferentes com o mesmo nível de competência — não uma cópia da outra. A BeautyNow tem identidade própria (logo em gota, paleta rosa/cinza/azul) definida em `docs/03-design-system.md`.

**Descrição de produto:** usar sempre o material oficial do fabricante que a BeautyNow tem direito de usar como distribuidora autorizada, ou texto original escrito para o projeto. Nunca o texto da BLZ.

## 3. Protocolo de pesquisa

Execute nesta ordem, registrando cada achado em `docs/benchmark/` (criar a pasta).

### Fase 0.1 — Mapeamento macro (1 sessão)

Navegue por `https://www.belezanaweb.com.br` e mapeie:

1. **Header e navegação**
   - Estrutura do menu principal: quais eixos de navegação existem (categoria / marca / necessidade / preço / outlet).
   - Como o megamenu se organiza: quantos níveis, o que aparece em cada coluna, se há destaque de marca dentro do menu.
   - O que ocupa o topo: busca, minha conta, favoritos, carrinho, seletor de CEP/localização, barra de aviso.

2. **Home**
   - Sequência exata de blocos de cima para baixo. Nomeie cada um e diga qual trabalho ele faz.
   - Que tipo de oferta aparece no hero e como a chamada é construída.
   - Onde entra prova social, onde entra conteúdo editorial, onde entram marcas.

3. **Footer**
   - Todos os grupos de link. Isso revela o mapa completo de páginas institucionais e de SEO.

**Saída:** `docs/benchmark/00-macro.md` — com árvore de navegação completa e a sequência de blocos da home, em texto.

### Fase 0.2 — PLP (página de listagem)

Abra ao menos 3 PLPs diferentes (uma de cabelos, uma de skincare, uma de marca) e registre:

- Lista **completa** de filtros disponíveis em cada uma. Copie os nomes das facetas e os valores possíveis — essa é a taxonomia mais valiosa do exercício.
- Opções de ordenação, e qual é o padrão.
- Anatomia do card de produto: quais elementos aparecem, em que ordem, quais são condicionais (selo de desconto, "+N opções", nota de avaliação, badge de frete grátis, preço Pix vs. cartão, parcelamento, favoritar).
- Comportamento de paginação (numerada, infinita, "carregar mais") — importante para SEO.
- Quantos produtos por linha em desktop e mobile.
- Se há banner/conteúdo intercalado na grade.

**Saída:** `docs/benchmark/01-plp.md` + `docs/benchmark/taxonomia-facetas.md` (essa vira input direto do modelo de dados).

### Fase 0.3 — PDP (página de produto) — **a mais importante**

Abra ao menos 5 PDPs de perfis diferentes: item simples, item com variação de tamanho, item com variação de tom, kit, e item esgotado. Registre para cada:

- **Acima da dobra:** ordem exata dos elementos (breadcrumb, marca, título, avaliação, preço, preço Pix, parcelamento, seletor de variação, quantidade, CTA, cálculo de frete, selos).
- Como o preço é apresentado: preço "de/por", desconto percentual, preço Pix diferenciado, parcelamento — a hierarquia visual entre eles.
- Onde o cálculo de frete por CEP aparece e o que ele retorna (transportadora, prazo, valor, opções múltiplas).
- **Abaixo da dobra:** ordem das seções de conteúdo (descrição, como usar, ingredientes/composição, especificações, avaliações, perguntas e respostas, produtos relacionados).
- Estrutura de cross-sell: "compre junto", "quem viu também viu", "da mesma linha", "complete a rotina". Quantos, onde, e se há desconto no bundle.
- Anatomia do bloco de avaliações: distribuição de notas, filtros de avaliação, foto do cliente, marcação de compra verificada, atributos avaliados.
- Galeria de imagens: quantidade, zoom, vídeo, imagens de textura/aplicação.
- O que acontece quando o produto está esgotado (avise-me, sugestão de similar).

**Saída:** `docs/benchmark/02-pdp.md` — com wireframe em ASCII da PDP mobile e desktop, seção por seção.

### Fase 0.4 — Carrinho e checkout

- Carrinho é drawer lateral ou página? O que aparece nele além dos itens?
- Existe barra de progresso de frete grátis? Faixa de brinde? Cupom aplicável no carrinho?
- Quantos passos tem o checkout e o que se pede em cada um.
- Permite comprar sem cadastro?
- Meios de pagamento oferecidos e diferenciais de preço entre eles.
- Onde o cupom é aplicado e como o erro de cupom é comunicado.
- O que a tela de confirmação mostra.

**Saída:** `docs/benchmark/03-checkout.md` — com o fluxo passo a passo e todos os campos de formulário.

### Fase 0.5 — Camadas transversais

- **SEO:** padrão de URL de categoria, produto, marca e busca. Title e meta description. Uso de dados estruturados (Product, Offer, AggregateRating, BreadcrumbList). Presença de conteúdo textual em PLP.
- **Conteúdo:** como o editorial (guias, tutoriais, conteúdo de experts) se conecta ao catálogo — o link de conteúdo para produto é o que faz esse tipo de site rankear.
- **Performance:** rode PageSpeed Insights em uma home, uma PLP e uma PDP da BLZ. Anote os números. Esse é o nosso piso, não o nosso teto.
- **Retenção:** que mecanismos existem para trazer o cliente de volta (newsletter, alerta de preço, favoritos, cupom, app).

**Saída:** `docs/benchmark/04-seo-conteudo.md` e `docs/benchmark/05-performance.md`.

## 4. Ferramentas para a pesquisa

Na ordem de preferência:

1. **WebFetch** nas URLs públicas — suficiente para estrutura, textos de navegação, taxonomia de filtro e dados estruturados.
2. **Playwright MCP**, se disponível, para o que depende de interação: megamenu, drawer de carrinho, cálculo de frete, seletor de variação, checkout. Screenshot cada estado e descreva-o em texto no documento — **não versione os screenshots no repositório**.
3. **PageSpeed Insights** para os números de performance.
4. **Busca web** para material secundário: cases publicados, entrevistas, prêmios, análises de mercado.

Respeite `robots.txt`. Navegue como um usuário navegaria: sem paralelismo agressivo, sem scraping de catálogo em massa.

## 5. Referências secundárias

Depois da BLZ, faça uma passada mais rápida (só Fase 0.1 e 0.3) em:

- **Época Cosméticos** — arquitetura de informação e curadoria por necessidade.
- **Sephora Brasil** — PDP e prova social; padrão internacional.
- **Ikesaki** — profundidade em haircare profissional, que é o nosso forte.
- **Sallve / Creamy** — D2C de marca única: como constroem confiança sem catálogo gigante.

**Saída:** `docs/benchmark/06-concorrentes.md` — comparativo em tabela do que cada um faz melhor, com uma coluna final: "o que a BeautyNow adota".

## 6. Entregável final da Fase 0

Um documento `docs/benchmark/99-sintese.md` com:

1. **Tabela de paridade** — cada funcionalidade encontrada, classificada como:
   - `P0` — sem isso não lançamos (o cliente sente a falta na hora)
   - `P1` — importante, entra até 60 dias pós-lançamento
   - `P2` — desejável, backlog
   - `NÃO` — a BLZ tem mas não faz sentido para a BeautyNow (justificar)
2. **Lista de decisões de UX adotadas**, cada uma com a razão pela qual foi adotada.
3. **Lista dos nossos diferenciais** — os 3 pontos onde a BeautyNow vai ser deliberadamente diferente e melhor, não igual. Nosso tamanho é vantagem em: curadoria de nicho profissional, atendimento humano/Larissa no WhatsApp, e velocidade de entrega no RJ.

Só depois desse documento aprovado começa o Sprint 1.
