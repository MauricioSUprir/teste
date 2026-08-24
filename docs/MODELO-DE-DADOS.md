# Modelo de dados

Banco SQLite local (`prisma/dev.db`), definido em `prisma/schema.prisma`. Como o Prisma não
suporta enums no SQLite, os campos de estado usam `String` com os valores listados abaixo.

## Tabelas

### Subject (matéria)
Disciplina de estudo. Tem cor própria usada em toda a interface.
- `name`, `color`
- Relações: tópicos, tarefas, blocos de cronograma, sessões de pomodoro, notas, flashcards

### Topic (tópico)
Item do conteúdo de uma matéria. O progresso da matéria = tópicos concluídos / total.
- `name`, `done`

### Task (tarefa)
- `status`: `TODO` | `DOING` | `DONE`
- `priority`: `BAIXA` | `MEDIA` | `ALTA`
- `source`: `LOCAL` (criada no app) | `CLASSROOM` (importada)
- `externalId` (único): `classroom:<cursoId>:<atividadeId>` — garante importação sem duplicar
- `dueDate`, `link`, `completedAt`

### StudyBlock (bloco do cronograma)
Compromisso fixo semanal de estudo.
- `dayOfWeek`: 0 (domingo) a 6 (sábado)
- `startMin`: minutos desde 00:00 (ex.: 19h = 1140)
- `durationMin`

### PomodoroSession (sessão de foco)
Registrada automaticamente ao fim de cada ciclo de foco. Alimenta estatísticas, meta
semanal e sequência de dias.
- `startedAt`, `focusMin`, matéria opcional

### Note (nota)
Anotação em texto/markdown, opcionalmente ligada a uma matéria.
- `title`, `content`, `updatedAt`

### Flashcard
Cartão de revisão com estado do algoritmo SM-2:
- `easiness` (fator de facilidade, mín. 1.3), `intervalDays`, `repetitions`
- `dueDate`: quando o cartão vence para revisão
- Notas de revisão: Errei (1) · Difícil (3) · Lembrei (4) · Fácil (5)

### GoogleAccount
Uma única linha (`id = 1`) com os tokens OAuth da conta conectada:
- `email`, `accessToken`, `refreshToken`, `expiresAt`

### Setting
Chave/valor para configurações simples.
- `metaSemanalMin`: meta semanal de minutos de foco (padrão: 600)

## Comandos úteis

```bash
npm run db:push    # aplica o schema ao banco (cria/atualiza tabelas)
npm run db:studio  # abre o Prisma Studio para inspecionar os dados
```
