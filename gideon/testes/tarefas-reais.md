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

