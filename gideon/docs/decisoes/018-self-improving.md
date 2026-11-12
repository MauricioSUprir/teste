# 018 — Self-Improving: a GIDEON se testa e propõe melhorias

**Data:** 12/11/2026 · **Fase:** 5 (Self-Improving) · **Situação:** aceita, no ar (nenhuma melhoria passou no filtro até agora, então ainda não houve nada para o dono aprovar)

## Decisão
- **Tudo dentro da própria função `gideon`** (arquivo `testes.ts`) e do banco (migração 014). Nada de servidor novo.
- **Bateria de testes:**
  - os pedidos ficam na tabela `gideon_testes` (pedido, o que se espera, área, ferramentas que deve ou não deve usar). Começou com 30 pedidos do dia a dia;
  - **pedidos marcados 👎 na semana viram testes sozinhos** (área `nao_util`);
  - toda semana o agendador `gideon-testes-semanal` roda a bateria **domingo às 17h30**, antes do relatório das 19h. O dono também pode pedir: "roda os testes agora";
  - cada pedido passa pelo **núcleo de verdade**, no canal `teste`. Nesse canal, tudo o que teria efeito fora do banco é **simulado**: mandar mensagem, criar lembrete, mexer no PC, chamar a equipe;
  - um **juiz** (modelo mais forte, `modelo_juiz` ou `modelo_relatorio`) dá nota e motivo. O teste também reprova se não usou a ferramenta certa ou usou uma proibida;
  - **nota da bateria** = testes que passaram ÷ total × 10;
  - um teste por vez, com pausa de 4 s (limite por minuto do Gemini grátis). Cada passo roda até ~85 s e chama o próximo; o agendador `gideon-testes-passo` só age enquanto há bateria rodando.
- **Melhorias (uma de cada vez):**
  - com as falhas da bateria, os erros mais frequentes da semana e os pedidos 👎, o modelo forte propõe **uma** melhoria;
  - **regra:** 1 ou 2 frases a mais no prompt da GIDEON. **Antes de propor, ela é testada:**
    - roda nos testes que falharam + até 5 que passavam;
    - **o que melhorou ou piorou roda mais uma vez** (o modelo varia de uma vez para outra). Só conta o que se repetir nas duas vezes;
    - só vira proposta se consertar pelo menos 1 teste e não quebrar nenhum. Senão fica "sem ganho" e não é proposta;
  - **código:** erro técnico ou ferramenta que falta vira um pedido pronto para o Claude, que aparece no relatório.
- **OK do dono:**
  - a melhoria testada vai no **relatório de domingo**, com **Aprovar / Negar** (ou "sim" na conversa: `melhoria_ativar`);
  - aprovada, a regra entra no prompt de todos os canais (Telegram, iPhone, voz no GIDEON Home), na seção "Regras aprendidas com os testes";
  - negada, fica recusada.
- **Volta automática:** na bateria seguinte, se a nota cair 0,6 ou mais (2 testes em 30) em relação à nota de quando a regra foi proposta, a regra é desfeita sozinha e o relatório avisa. O dono também pode pedir "desfaz a melhoria" (`melhoria_reverter`).
- **Registro:**
  - testes em `gideon_testes_rodadas` e `gideon_testes_resultados`;
  - melhorias em `gideon_melhorias`;
  - ativar e desfazer em `gideon_acoes`.
  - Os pedidos dos testes ficam em `gideon_execucoes` com canal `teste`, fora do relatório semanal de uso.

## Custo
- Uma bateria de 30 testes usa ~60 a 70 chamadas de IA (conversa + juiz), em ~10 minutos. Testar uma melhoria usa mais ~10 a 15.
- Tudo dentro do plano grátis do Gemini, uma vez por semana.

## Alternativas descartadas
- **A IA mudar o próprio código sozinha:** arriscado demais. Código só muda pelo Claude, com o pedido que ela mesma escreve.
- **Ativar a regra sem OK:** contra a regra do projeto ("OK antes de mexer em produção").
- **Comparar só uma rodada:** a primeira bateria mostrou que o modelo varia. Uma regra boa consertou o teste 25, mas na mesma rodada o teste 2 falhou por acaso. Por isso existe a confirmação.

## Testes
- **1ª bateria (11/11/2026, rodada 1):** nota **9,3** (28 de 30). Regra proposta: "pc_controlar sempre avisa que o resultado chega no Telegram". Ela consertou o teste 25, mas na mesma rodada o teste 2 falhou por acaso (rodada 2). Por isso nasceu a **confirmação** (o que mudou roda mais uma vez).
- **2ª bateria (12/11/2026, rodada 3):** nota **9,7** (29 de 30).
  - A única falha foi o teste 14 ("procura no meu Drive o trabalho de história"). O juiz achou que ela tinha inventado o arquivo, mas o juiz não via o que a ferramenta devolveu. **Juiz corrigido:** agora ele recebe o resultado de cada ferramenta. Na rodada 6, o teste 14 passou.
  - Regra proposta: "em buscas, responder só com o que a ferramenta devolveu". Na rodada 4 consertou o alvo; na confirmação (rodada 5), quebrou 2 testes que passavam. Ficou **sem ganho** e não foi proposta. Era mesmo desnecessária: o problema estava no juiz.
- **Relatório de domingo conferido** (rota `relatorio` com `enviar:false`, sem mandar nada): traz a nota (9,7, antes 9,3), a falha e as duas tentativas "sem ganho", sem botões (nada a aprovar).
- **Achado para depois:** na parte "Erros mais frequentes" do relatório aparecem os diagnósticos da voz do GIDEON Home em formato técnico (texto com chaves). Melhorar quando mexer no relatório.

