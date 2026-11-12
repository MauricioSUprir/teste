# 020 — Roteador de modelos: pedido difícil vai para o modelo forte

**Data:** 12/11/2026 · **Fase:** 0 (Base) · **Situação:** aceita (no ar na versão 41)

## Decisão
- Cada pedido é classificado **antes** de chamar o modelo, sem gastar IA (só uma lista de palavras, em `core.ts`, `nivelDoPedido`):
  - **difícil:** analisar, comparar, avaliar, recomendar, prós e contras, como funciona, código e programação, planejar, estratégia, calcular, matemática, escrever um texto (e-mail, carta, relatório, post), resumir, traduzir, explicar passo a passo; também **arquivo anexado** e **mensagem com mais de 600 letras**;
  - **simples:** todo o resto (conversa, lembretes, agenda, buscar no Drive, abrir apps...).
- Difícil → `gideon_config.modelo_dificil` (se vazio, `modelo_relatorio`, hoje `gemini-3.5-flash`). Simples → `modelo_conversa` (`gemini-3.5-flash-lite`). Os dois têm o `modelo_reserva` atrás.
- **Privado** (`privado:` no Telegram) continua indo direto para a IA do PC (decisão 016).
- **iPhone fica sempre no rápido:** a Siri espera a resposta e corta se demorar.
- **Desligar:** `gideon_config.roteador = nao` (vale em até 1 minuto, sem publicar de novo).
- O registro guarda qual modelo respondeu (`gideon_execucoes.modelo`); a resposta do núcleo traz `nivel`.

## Por quê
- O limite grátis do Gemini é **por modelo e por dia**. Mandar só o que precisa para o modelo forte poupa o limite dele e mantém a conversa comum rápida.
- Uma lista de palavras é grátis e instantânea. Um modelo para classificar gastaria uma chamada a mais em todo pedido.

## Testes (12/11/2026)
- 15 frases de exemplo classificadas certo (15/15), na máquina de testes.
- Em produção: "compara o plano gratuito e o pago do Spotify" → `dificil`, respondido pelo `gemini-3.5-flash`; "oi, tudo bem?" → `simples`, respondido pelo `gemini-3.5-flash-lite`.

## Limites
- Palavra fora da lista cai no modelo rápido. Se a nota dos testes semanais mostrar respostas fracas em algum tipo de pedido, é só acrescentar a palavra.
