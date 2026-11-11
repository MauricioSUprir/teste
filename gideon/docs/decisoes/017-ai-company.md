# 017 — AI Company: a equipe de agentes da GIDEON

**Data:** 11/11/2026 · **Fase:** 3 (AI Company) · **Situação:** aceita (falta o dono testar uma missão de verdade)

## Decisão
- A equipe roda **dentro da própria função `gideon` no Supabase** (arquivo `equipe.ts`), com o mesmo Gemini grátis. Nada de CrewAI ou LangGraph: precisariam de um servidor Python ligado o tempo todo (pago ou que dorme no plano grátis), e o padrão "diretor divide → agentes fazem → revisor confere" cabe em poucas centenas de linhas.
- **Quem faz o quê:**
  - **Diretor:** recebe o objetivo, monta o plano (2 a 6 tarefas, com quem depende de quem) e, no fim, escreve a entrega.
  - **Pesquisador:** pesquisa na internet (`pesquisar_web`, `ler_pagina`) e na memória do dono.
  - **Analista:** compara opções, faz contas, recomenda.
  - **Programador:** escreve o código inteiro e explica como rodar.
  - **Testador:** confere o código linha por linha e escreve os testes.
  - **Revisor final:** dá nota e pode mandar refazer até 2 tarefas, uma vez só.
- **OK do dono antes de gastar:** `equipe_iniciar` primeiro só planeja; o plano aparece com **Aprovar / Negar** no Telegram (ou "sim" na conversa, por voz ou no iPhone). Negar cancela a missão.
- **Cada tarefa roda numa chamada separada da função** (rota `equipe-passo`). O plano grátis do Supabase corta cada chamada em ~150 s. Ao terminar uma tarefa, a função chama a próxima. Para não travar, o **agendador** (`gideon-equipe`, a cada minuto) também chama, mas só quando há missão andando; sem missão, nenhuma chamada é feita.
- **Uma tarefa por vez em cada missão.** A função `gideon_equipe_pegar_tarefa` (com trava) entrega a próxima tarefa cujas dependências terminaram. Tarefa presa por mais de 4 min volta para a fila; na 3ª vez vira erro.
- **Painel:**
  - **Telegram:** uma mensagem de andamento é editada a cada passo (⬜ ⏳ ✅ por agente) e tem o botão **⛔ Cancelar a equipe**. O comando `/equipe` mostra a situação.
  - **Web:** `https://gideon-home.onrender.com/equipe.html`, com a mesma chave do GIDEON Home. Atualiza a cada 5 s enquanto há missão andando e mostra o trabalho completo de cada agente.
- **Entrega:**
  - resumo no Telegram;
  - arquivo HTML com a entrega do diretor, o trabalho de cada agente (o código inteiro), o parecer do revisor e as fontes;
  - uma cópia na memória (tipo `pesquisa`, origem `equipe`).
- **Registro:** cada agente vira uma linha em `gideon_execucoes` (`ferramenta = equipe:<agente>`, `workflow = supabase:gideon/equipe`), com modelo, tokens e tempo. A missão soma os tokens.
- **Modelos:**
  - Pesquisador e analista usam o modelo da conversa: `gideon_config.modelo_equipe`, ou `modelo_conversa` se não estiver definido.
  - Diretor, programador, testador e revisor usam um modelo mais forte: `modelo_equipe_forte`, ou `modelo_relatorio`, ou `gemini-3.5-flash`.
  - Todos com reserva automática.
- **Segurança:**
  - A equipe só pesquisa, analisa, escreve e confere. Cada agente tem uma lista fechada de ferramentas (`pesquisar_web`, `ler_pagina`, `buscar_memoria`): sem PC, sem WhatsApp, sem apagar nada.
  - O que vem de sites, da memória e das outras tarefas é dado, nunca ordem.
- **Testes:** missão com canal `sistema` é silenciosa: não manda nada no Telegram e não guarda na memória.

## Custo
- Uma missão de 3 tarefas usa ~10 a 15 chamadas de IA: plano, até 4 voltas por agente, revisor e entrega. O limite grátis do Gemini é por modelo e por dia; por isso o plano só roda depois do OK.
- Para crescer até 20 agentes (fase 3.3): um de cada vez, só depois que os 5 primeiros passarem nos testes.

## Alternativas descartadas
- **CrewAI / LangGraph / AutoGen:** precisam de um servidor Python sempre ligado; o Render grátis dorme e corta processos longos.
- **Rodar tudo numa chamada só:** passa dos ~150 s do plano grátis.
- **Tarefas em paralelo:** estoura o limite de pedidos por minuto do Gemini grátis.

## Testes (11/11/2026)
- **Missão 1:** o testador achou problemas, mas o revisor deu 10/10 e a entrega disse "corrigido e testado". Era falso.
  - **Correções (v38):**
    - testador "com problemas" → o programador corrige sozinho;
    - revisor reprova código não corrigido;
    - diretor escreve "conferido", nunca "testado".
- **Missão 2:** os testes do testador, rodados de verdade, passaram (10 de 10). O programa calculou certo.
- **Missão 3** (repete o caso da missão 1):
  - o programador corrigiu sozinho, os testes e o código batem, e o testador aprovou;
  - a entrega diz "conferido".
- **Falta:** o dono pedir uma missão de verdade pelo Telegram, para ver o plano com Aprovar/Negar, a mensagem de andamento e o arquivo final.

