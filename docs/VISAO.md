# Visão do projeto

## O problema

Estudar bem exige quatro coisas que costumam morar em lugares diferentes:

1. **Planejar** — o que estudar, quando, com que prioridade (agenda, papel, planilha)
2. **Executar** — sessões de foco de verdade (timer, força de vontade)
3. **Reter** — revisar no momento certo para não esquecer (Anki, resumos)
4. **Acompanhar** — saber se o esforço está indo para o lugar certo (ninguém faz)

Além disso, quem usa Google Classroom recebe atividades e prazos por lá e pelo Gmail, e os
materiais ficam no Drive — mais três lugares para olhar.

## A solução

O Pulso junta tudo em um único sistema local:

- Os quatro passos (planejar → executar → reter → acompanhar) viram módulos que conversam
  entre si: a sessão de Pomodoro alimenta as estatísticas e a sequência de dias; as tarefas
  aparecem no painel quando o prazo se aproxima; os flashcards vencem no dia certo.
- O **assistente de IA não é um chat genérico**: ele recebe, a cada conversa, o retrato real
  dos seus estudos (matérias, tópicos, tarefas pendentes, cronograma, horas de foco por
  matéria, revisões vencidas) e usa isso para montar planos realistas, replanejar semanas
  atrasadas e priorizar o dia.
- As **integrações Google** puxam o mundo externo para dentro: atividades do Classroom viram
  tarefas com prazo (sem duplicar), e-mails de estudo ficam visíveis, materiais do Drive a um
  clique.

## Princípios

- **Local e privado por padrão** — os dados ficam em um SQLite no seu computador. Só saem
  dados nas chamadas que você ativar (IA e Google), e as integrações Google são somente
  leitura.
- **Zero fricção para começar** — `npm run setup` e o núcleo inteiro funciona sem chave
  nenhuma. IA e Google são camadas opcionais.
- **Em português** — interface, dados e assistente.
