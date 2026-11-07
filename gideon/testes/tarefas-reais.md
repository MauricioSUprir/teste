# Tarefas reais (base da Fase 8)

Pedidos reais feitos ao GIDEON + a resposta esperada. Toda falha real e todo "Não útil" vira uma linha aqui.

> **Status:** os 10 pedidos abaixo são **rascunhos baseados nas capacidades listadas no kickoff**, não pedidos reais do histórico. O dono deve substituí-los/confirmá-los com os pedidos que realmente fez (histórico do Telegram e do WhatsApp).

| # | Pedido | Resposta esperada | Área | Confirmado pelo dono |
| --- | --- | --- | --- | --- |
| 1 | "Resuma o PDF da aula de história" (anexo) | Resumo curto com os pontos principais; não inventa conteúdo fora do PDF | Arquivos | ☐ |
| 2 | "O que tenho na agenda amanhã?" | Lista de compromissos de amanhã do Google Agenda, com horário | Agenda | ☐ |
| 3 | "Me lembra de ligar para o dentista sexta às 15h" | Cria o lembrete em `jarvis_lembretes` e confirma dia e hora | Lembretes | ☐ |
| 4 | "Tem e-mail novo do Classroom?" | Resume as postagens do Classroom recebidas por e-mail | Gmail | ☐ |
| 5 | "Pesquisa o preço médio de X" | Resposta com fontes clicáveis (URL completa) | Pesquisa | ☐ |
| 6 | "Resuma esse vídeo do YouTube: <link>" | Resumo fiel ao vídeo, sem inventar | YouTube | ☐ |
| 7 | "Manda no WhatsApp para <contato>: <texto>" | Pede confirmação antes de enviar; depois envia e confirma | WhatsApp | ☐ |
| 8 | "O que tem nessa foto?" (anexo) | Descrição fiel da imagem | Visão | ☐ |
| 9 | "Anota: <tarefa>" | Cria a tarefa em `jarvis_tarefas` e confirma | Tarefas | ☐ |
| 10 | "Resuma essa planilha" (Excel) | Resumo com totais/estrutura reais da planilha | Arquivos | ☐ |

## Testes reais já feitos

| Data | Pedido | Resposta esperada | Resultado | Tempo |
| --- | --- | --- | --- | --- |
| 06/11/2026 | "oi, quem é vc?" | Apresenta-se como GIDEON, curto | ✅ "Sou o GIDEON, seu assistente pessoal. Como posso ajudar?" | 1,3 s |
| 06/11/2026 | "o que eu te perguntei antes?" | Lembra a mensagem anterior | ✅ Repetiu a pergunta anterior | 0,9 s |
| 06/11/2026 | Mensagem de quem não é o dono | Não responde | ✅ Filtro barrou (primeiro "oi", antes de configurar o ID) | — |


## Testes internos do Claude (não contam como pedidos reais do dono)

06/11/2026, pelo Núcleo, sessão de teste, sem passar pelo Telegram:

| Pedido | Esperado | Resultado | Tempo |
| --- | --- | --- | --- |
| "quando começou o projeto da loja Bradeco?" (com uma nota de teste na memória) | Responder pela memória | ✅ "começou em agosto de 2026" | 1,7 s |
| "me lembra de revisar o plano do GIDEON amanhã às 9h" | Criar lembrete 07/11 09:00 (Brasília) | ✅ gravado 07/11 09:00 | 2,0 s |
| "anota uma tarefa: configurar o servidor no Hugging Face" | Criar tarefa | ✅ | 2,0 s |
| "quais são minhas tarefas abertas?" | Listar | ✅ | 1,7 s |
| "cancela o lembrete..." / "marca como feita a tarefa..." | Cancelar / concluir | ✅ | ~2 s |
| Busca sem relação ("receita de bolo de cenoura") | Similaridade baixa, não usar | ✅ 0,51 (limite 0,60) | — |
| Guardar a mesma nota duas vezes | Não duplicar | ✅ | — |

## Falhas reais que viraram teste

| Data | Falha | Teste que impede a volta |
| --- | --- | --- |
| 06/11/2026 | Disparador mandou "⏰ Lembrete:" vazio a cada minuto | Rodar o disparador sem lembretes vencidos: nada pode chegar ao Telegram |

## Arquivos e áudios (07/11/2026) — testados ao vivo pela rota `home-arquivo` (sem gravar na memória)
| Pedido | Esperado | Resultado |
| --- | --- | --- |
| Print de erro do React, sem legenda | Explica a causa e o próximo passo | ✅ 2,7 s |
| PDF de aviso + "quando é a prova e o que cai?" | Data, hora, sala e conteúdo | ✅ 2,5 s |
| Word sem legenda | Diz o que é, os pontos importantes e oferece ajuda | ✅ 1,4 s (ofereceu criar lembrete da entrega) |
| Excel + "quanto gastei no total e qual o maior gasto?" | R$ 447,40; Mercado R$ 312,50 | ✅ 3,4 s |
| Mensagem de voz (.ogg) | Transcreve e responde | ✅ 3,6 s |
| Arquivo .doc antigo | Aviso simples: salvar como .docx ou PDF | ✅ (teste local) |
| Falta: dono mandar pelo Telegram (foto, PDF e áudio de verdade) e conferir o resumo na memória | | ⬜ |
