# 023 — Cache por significado (pergunta geral repetida não gasta o modelo)

**Data:** 12/11/2026 · **Fase:** 0 (Base 0.4, qualidade e custos) · **Situação:** aceita (no ar na versão 43)

## Decisão
- Quando o dono faz uma **pergunta geral** que já foi respondida, mesmo escrita de outro jeito ("qual a capital da Austrália" e "Qual a capital da Austrália?"), a GIDEON responde com a resposta guardada, **sem chamar o modelo**: não gasta o limite grátis do Google e responde em menos de 1 s.
- Código em `supabase/functions/gideon/cache.ts`, ligado no `atender` (`core.ts`). Tabela `gideon_cache_respostas` e função `gideon_cache_buscar` (migração 017).
- O cache usa o **mesmo vetor** que a GIDEON já calcula para buscar na memória: não gasta nada a mais.

## O que entra no cache (tudo precisa valer)
- Pergunta **sem palavras pessoais, de tempo, de ação ou que dependem da conversa**: meu, eu, ele, isso, hoje, amanhã, agora, último, próximo, notícia, preço, dólar, clima, lembrete, agenda, e-mail, tarefa, projeto, arquivo, PC, GitHub, WhatsApp, manda, anota, pesquisa, procura, abre, liga, bom dia, obrigado...
- **Começo de conversa:** nada na mesma conversa nos últimos 20 minutos (senão pode ser continuação, como "e a da França?").
- A resposta foi feita **sem ferramenta** e **sem trecho forte da memória** (nada acima de 0,75), e sem a cobrança de "prometeu sem fazer".
- Nunca na bateria de testes (canal `teste`), com arquivo anexado nem com regra em teste.

## Quando a resposta guardada é usada
- **Mesmo canal** (o iPhone fala; o Telegram escreve).
- **Mesma versão do prompt:** um resumo do prompt + regras aprendidas. Mudou o prompt ou entrou uma regra nova, o cache antigo deixa de valer sozinho.
- **Significado parecido** ≥ `gideon_config.cache_limite` (0,90).
- **As mesmas palavras importantes** (pelo menos 70% iguais) **e os mesmos números**. Assim "capital da Austrália" nunca responde "capital da Áustria", e "15% de 200" nunca responde "15% de 300".
- Vale `gideon_config.cache_dias` (3 dias). Os vencidos são apagados quando entra uma resposta nova.

## Controle
- 👎 numa resposta tira ela do cache (a que foi guardada nessa conversa ou a que foi usada nela).
- `gideon_config.cache = nao` desliga tudo, sem publicar de novo.
- O registro (`gideon_execucoes`) marca `ferramenta = cache` e `modelo = cache`; o relatório de domingo mostra "Respondidos pelo cache (sem gastar IA)".

## Por quê
- Item da Base que faltava (0.4: "Cache por significado"). O limite grátis do Gemini é por minuto e por dia; cada pergunta repetida economizada é uma a mais para o que importa.
- Regras rígidas de propósito: é melhor perder uma economia do que dar uma resposta errada ou velha. Pergunta pessoal, de agora ou com ação nunca vem do cache.

## Testes (12/11/2026)
- **Função de teste `gideon-teste`:**
  - "qual é a capital da Austrália?" e "me explica o que é fotossíntese" foram para o modelo (6 a 7 s) e entraram no cache. "qual o meu nome?" não entrou (pessoal).
  - "Qual a capital da Austrália" veio do cache: 0,7 s, 0 tokens.
  - "qual é a capital da Áustria?" foi para o modelo e respondeu Viena (as duas perguntas se parecem 0,865 e têm palavras diferentes).
  - "o que é a fotossíntese?" × "me explica o que é fotossíntese" se parecem 0,918: com o limite em 0,93 não usava o cache; o limite passou para **0,90** e passou a usar (0,4 s).
  - "quais lembretes eu tenho?" chamou `listar_lembretes` e não entrou no cache.
- **Produção (versão 43, commit `e3e9700`):** Telegram ligado sem erros, lembretes respondendo; "quem pintou a Mona Lisa?" foi para o modelo (2 s) e "Quem pintou a Mona Lisa" veio do cache (0,55 s).
