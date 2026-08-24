# Arquitetura

## Stack

| Camada | Tecnologia | Por quê |
|---|---|---|
| Framework | **Next.js 15** (App Router, TypeScript) | Front e back no mesmo projeto, um comando para rodar |
| Banco | **SQLite** via **Prisma** | Arquivo local, zero configuração, migrações fáceis |
| IA | **@anthropic-ai/sdk** (Claude) | Assistente com contexto dos dados do usuário |
| Google | **googleapis** (OAuth 2.0) | Classroom, Gmail e Drive com escopos somente leitura |
| Estilo | CSS puro com design tokens | Sem dependência extra; tema claro/escuro automático |

## Estrutura de pastas

```
teste/
├── app/                        # Páginas e rotas (Next.js App Router)
│   ├── page.tsx                # Painel (dashboard)
│   ├── materias/  tarefas/  cronograma/  pomodoro/
│   ├── flashcards/  notas/  assistente/  estatisticas/  integracoes/
│   └── api/
│       ├── assistente/route.ts # POST — chat com o Claude
│       └── google/
│           ├── auth/route.ts      # GET — inicia OAuth
│           ├── callback/route.ts  # GET — recebe tokens
│           ├── classroom/route.ts # POST — sincroniza atividades
│           ├── gmail/route.ts     # GET — e-mails de estudo
│           └── drive/route.ts     # GET — arquivos recentes
├── components/                 # Componentes de interface (client components)
├── lib/
│   ├── db.ts                   # Singleton do Prisma
│   ├── actions.ts              # Server Actions (todo o CRUD)
│   ├── sm2.ts                  # Algoritmo de repetição espaçada
│   ├── ai.ts                   # Cliente Claude + montagem de contexto
│   └── google.ts               # OAuth + Classroom/Gmail/Drive
├── prisma/schema.prisma        # Modelo de dados (docs/MODELO-DE-DADOS.md)
└── docs/                       # Esta documentação
```

## Decisões principais

**Server Components + Server Actions.** As páginas são componentes de servidor que leem o
banco direto com o Prisma; as mutações passam por Server Actions (`lib/actions.ts`) com
`revalidatePath`. Rotas de API só existem onde precisa de request/response de verdade:
o chat de IA e o fluxo OAuth do Google.

**Contexto do estudante para a IA.** `lib/ai.ts` monta um texto com o estado atual
(matérias, tarefas, cronograma, horas por matéria nos últimos 14 dias, flashcards vencidos)
e o injeta no `system` de cada conversa. O prompt fixo do tutor leva `cache_control` para
aproveitar o cache de prompt da API; o contexto variável fica depois dele.

**Tokens do Google no banco.** App de usuário único: uma linha na tabela `GoogleAccount`
com access/refresh token. O cliente OAuth renova sozinho e o evento `tokens` persiste a
renovação. Escopos pedidos são todos `readonly`.

**Sincronização idempotente do Classroom.** Cada atividade importada guarda
`externalId = classroom:<cursoId>:<atividadeId>` com índice único — rodar a sincronização dez
vezes não duplica nada. Cursos viram matérias automaticamente (por nome).

**SQLite sem enums.** O Prisma não suporta enums no SQLite, então `status`, `priority` e
`source` são `String` com valores documentados no modelo de dados.
