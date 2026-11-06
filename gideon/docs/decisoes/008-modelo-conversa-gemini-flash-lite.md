# 008 — Conversa do GIDEON com Gemini 3.5 Flash-Lite

- **Data:** 06/11/2026
- **Contexto:** a regra de rendimento manda começar pelo modelo mais barato que acerta. Na documentação do Google (https://ai.google.dev/gemini-api/docs/models), o Flash-Lite atual é o `gemini-3.5-flash-lite` (US$ 0,30 por 1M de tokens de entrada e US$ 2,50 por 1M de saída), cinco vezes mais barato que o `gemini-3.6-flash`. O `gemini-2.5-flash` passa a ser redirecionado a partir de 01/12/2026.
- **Decisão:** a conversa do dia a dia usa `gemini-3.5-flash-lite`, temperatura 0,4.
- **Quando subir de modelo:** se falhar nos testes reais (`testes/tarefas-reais.md`). Próximo degrau: `gemini-3.6-flash` ou Claude Haiku.
- **Teste:** 06/11/2026, duas mensagens no Telegram, respostas corretas em 0,9 s e 1,3 s, memória funcionando.
