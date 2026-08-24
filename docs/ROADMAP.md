# Roadmap

## ✅ Fase 1 — Fundação (entregue)
- Projeto Next.js + Prisma/SQLite estruturado, tema claro/escuro
- Matérias com tópicos e progresso
- Tarefas em kanban com prioridades, prazos e vínculo com matéria

## ✅ Fase 2 — Execução (entregue)
- Cronograma semanal por blocos
- Pomodoro com registro automático de sessões
- Painel com meta semanal, sequência de dias e prazos próximos
- Estatísticas: horas por matéria e evolução diária

## ✅ Fase 3 — Retenção (entregue)
- Notas por matéria
- Flashcards com repetição espaçada (SM-2)

## ✅ Fase 4 — Inteligência (entregue)
- Assistente IA com contexto real dos estudos (planos, replanejamento, quizzes, tutor)

## ✅ Fase 5 — Integrações Google (entregue)
- OAuth com escopos somente leitura
- Classroom → tarefas (sincronização sem duplicar, cursos viram matérias)
- Gmail → e-mails de estudo recentes
- Drive → arquivos recentes

## ✅ Fase 6 — Pedidos do dia a dia (entregue)
- Tarefas com tipo (casa × avaliativo), dificuldade 1-5 e **urgência automática**
- Classroom já importa classificando tipo/dificuldade/prioridade
- **Calendário** mensal com eventos manuais e importação por **foto** (IA lê as datas)
- **Modos de estudo**: quiz por IA e técnica Feynman
- Suporte a **Gemini (gratuito)** além do Claude, com seleção por variável
- **Notificações**: push na tela (Web Push + service worker) e e-mail diário via Gmail
  do próprio usuário; cron diário na Vercel

## 🔜 Próximos passos (ideias priorizadas)

1. **IA gera flashcards direto no banco** — hoje o assistente sugere cartões em texto
   ("P: … / R: …"); o próximo passo é um botão "salvar cartões" que usa a action
   `criarFlashcardsEmLote` (já existe em `lib/actions.ts`).
2. **IA monta o cronograma sozinha** — o plano sugerido no chat vira blocos de
   `StudyBlock` com um clique.
3. **Google Calendar** — espelhar os blocos de estudo na agenda.
4. **Sincronização automática do Classroom** — rodar ao abrir o app, não só no botão.
5. **PWA / celular** — instalar como app e receber lembretes de revisão.
6. **Exportar/importar dados** — backup em JSON.
7. **Anexar arquivos do Drive** a matérias e notas específicas.
