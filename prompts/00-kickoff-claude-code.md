# Prompt de kickoff — cole isto no Claude Code

---

Você vai construir o e-commerce da **BeautyNow**, uma loja online de cosméticos. Todo o contexto está neste repositório. Comece lendo, nesta ordem: `CLAUDE.md`, `docs/00-PRD.md`, `docs/01-benchmark-belezanaweb.md`, `docs/02-arquitetura.md`, `docs/03-design-system.md`, `docs/06-roadmap-sprints.md`.

## Sua primeira tarefa é pesquisa, não código

O benchmark do projeto é a **Beleza na Web** (`https://www.belezanaweb.com.br`) — o maior e-commerce de beleza do Brasil, 18 anos de otimização de conversão, hoje do Grupo Boticário. Antes de escrever qualquer linha de código, você vai estudar aquele site a fundo e documentar o que aprendeu.

Execute integralmente o protocolo da **Fase 0** descrito em `docs/01-benchmark-belezanaweb.md`:

- **0.1** Mapeamento macro: navegação, megamenu, sequência de blocos da home, rodapé.
- **0.2** PLP: lista completa de filtros e valores, ordenação, anatomia do card, paginação.
- **0.3** PDP: ordem exata dos elementos acima e abaixo da dobra, apresentação de preço, cálculo de frete, cross-sell, avaliações. Abra pelo menos 5 produtos de perfis diferentes (simples, com variação de tamanho, com variação de tom, kit, esgotado).
- **0.4** Carrinho e checkout: quantos passos, quais campos, meios de pagamento, barra de frete grátis, cupom.
- **0.5** SEO, conteúdo editorial e performance (rode PageSpeed em uma home, uma PLP e uma PDP deles).

Use WebFetch nas URLs públicas. Se tiver Playwright MCP disponível, use para o que depende de interação (megamenu, drawer, cálculo de frete, checkout) — tire screenshot, descreva em texto no documento, e não versione as imagens. Respeite o robots.txt e navegue como um usuário navegaria.

Depois faça uma passada mais rápida em Época Cosméticos, Sephora Brasil, Ikesaki, Sallve e Creamy (só navegação e PDP).

**Grave tudo em `docs/benchmark/`**, terminando em `99-sintese.md` com: tabela de paridade de funcionalidades classificadas em P0/P1/P2/NÃO, lista de decisões de UX adotadas com justificativa, e os 3 pontos onde a BeautyNow vai ser deliberadamente diferente (não igual) à BLZ.

## Regra que não se negocia

A Beleza na Web é referência de **padrão de qualidade**, não modelo de cópia. Você extrai aprendizado de estrutura, ordem de informação, taxonomia de filtro e padrões de fluxo. Você **não** copia código, HTML, CSS, imagem, foto, texto de produto, copy de banner, conteúdo editorial, logo, paleta ou tipografia. A identidade visual da BeautyNow está definida em `docs/03-design-system.md` e é completamente própria. Se em algum momento você se pegar reproduzindo algo da BLZ em vez de reimplementar do zero com a nossa identidade, pare.

## Depois da pesquisa

Quando a Fase 0 estiver documentada, me apresente:

1. Um resumo em até 15 bullets do que você aprendeu e que vai mudar as decisões do projeto.
2. As divergências que você encontrou entre a realidade da BLZ e o que os documentos deste repositório assumem — os docs foram escritos antes da pesquisa e devem ser corrigidos por ela, não o contrário.
3. O plano do Sprint 0 (fundação técnica), ticket a ticket.

Aguarde minha aprovação antes de começar o Sprint 0. Depois disso, seguimos sprint a sprint, e você para para revisão ao fim de cada um.

## Como trabalhar comigo

- Fale em português.
- Antes de features de checkout, pagamento ou fiscal: plano primeiro, código depois, sempre.
- Se um documento deste repositório estiver errado ou desatualizado, corrija o documento no mesmo commit da mudança de código.
- Se algo depender de uma decisão de negócio que só eu posso tomar (preço, marca, política comercial), pergunte — não assuma.
- Prefira entregar uma coisa funcionando ponta a ponta a cinco pela metade.
