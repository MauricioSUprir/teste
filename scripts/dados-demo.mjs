// Insere dados de demonstração para visualizar o sistema preenchido.
// Uso: node scripts/dados-demo.mjs
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const jaTem = await db.subject.count();
if (jaTem > 0) {
  console.log("Banco já tem dados — nada a fazer.");
  process.exit(0);
}

const mat = await db.subject.create({
  data: {
    name: "Matemática",
    color: "#2E6E54",
    topics: {
      create: [
        { name: "Funções do 2º grau", done: true },
        { name: "Logaritmos", done: true },
        { name: "Trigonometria", done: false },
        { name: "Geometria analítica", done: false },
      ],
    },
  },
});
const fis = await db.subject.create({
  data: {
    name: "Física",
    color: "#B96F1E",
    topics: {
      create: [
        { name: "Cinemática", done: true },
        { name: "Leis de Newton", done: false },
        { name: "Termodinâmica", done: false },
      ],
    },
  },
});
const red = await db.subject.create({
  data: {
    name: "Redação",
    color: "#3B6EA5",
    topics: {
      create: [
        { name: "Estrutura dissertativa", done: true },
        { name: "Repertório sociocultural", done: false },
      ],
    },
  },
});

const hoje = new Date();
const dia = (n, h = 20) => {
  const d = new Date(hoje);
  d.setDate(d.getDate() + n);
  d.setHours(h, 0, 0, 0);
  return d;
};

await db.task.createMany({
  data: [
    { title: "Lista 5 — funções", subjectId: mat.id, priority: "ALTA", status: "DOING", dueDate: dia(1) },
    { title: "Resumo de termodinâmica", subjectId: fis.id, priority: "MEDIA", status: "TODO", dueDate: dia(2) },
    { title: "Redação: tema tecnologia", subjectId: red.id, priority: "ALTA", status: "TODO", dueDate: dia(3) },
    { title: "Simulado de cinemática", subjectId: fis.id, priority: "MEDIA", status: "DONE", completedAt: dia(-1), dueDate: dia(-1) },
    { title: "Revisar logaritmos", subjectId: mat.id, priority: "BAIXA", status: "DONE", completedAt: dia(-2) },
  ],
});

// Cronograma semanal
const blocos = [
  { dayOfWeek: 1, startMin: 19 * 60, durationMin: 90, subjectId: mat.id },
  { dayOfWeek: 2, startMin: 19 * 60, durationMin: 60, subjectId: fis.id },
  { dayOfWeek: 3, startMin: 19 * 60, durationMin: 90, subjectId: mat.id },
  { dayOfWeek: 4, startMin: 20 * 60, durationMin: 60, subjectId: red.id },
  { dayOfWeek: 5, startMin: 19 * 60, durationMin: 60, subjectId: fis.id },
  { dayOfWeek: 6, startMin: 9 * 60, durationMin: 120, subjectId: mat.id },
  { dayOfWeek: hoje.getDay(), startMin: 18 * 60, durationMin: 60, subjectId: red.id },
];
for (const b of blocos) await db.studyBlock.create({ data: b });

// Sessões de foco dos últimos 10 dias (para estatísticas e sequência)
const materias = [mat.id, fis.id, red.id, null];
for (let i = 9; i >= 0; i--) {
  if (i === 4) continue; // um dia sem estudar, para o gráfico variar
  const inicio = new Date(hoje);
  inicio.setDate(inicio.getDate() - i);
  inicio.setHours(19, 15, 0, 0);
  const qtd = 1 + ((i * 7) % 3);
  for (let s = 0; s < qtd; s++) {
    await db.pomodoroSession.create({
      data: {
        startedAt: new Date(inicio.getTime() + s * 30 * 60000),
        focusMin: 25,
        subjectId: materias[(i + s) % 3],
      },
    });
  }
}

// Flashcards — alguns vencidos para a tela de revisão aparecer
await db.flashcard.createMany({
  data: [
    { front: "Fórmula de Bhaskara?", back: "x = (-b ± √(b² - 4ac)) / 2a", subjectId: mat.id, dueDate: dia(-1, 4) },
    { front: "2ª Lei de Newton?", back: "F = m · a", subjectId: fis.id, dueDate: dia(0, 4) },
    { front: "log(a·b) = ?", back: "log a + log b", subjectId: mat.id, dueDate: dia(-2, 4), repetitions: 3, intervalDays: 6 },
    { front: "O que é calor sensível?", back: "Energia que altera a temperatura sem mudar o estado físico. Q = m·c·ΔT", subjectId: fis.id, dueDate: dia(3, 4), repetitions: 2, intervalDays: 6 },
  ],
});

await db.note.create({
  data: {
    title: "Aula 7 — Leis de Newton",
    subjectId: fis.id,
    content:
      "## Resumo\n- 1ª lei (inércia): corpo mantém seu estado se a força resultante for nula\n- 2ª lei: F = m·a\n- 3ª lei: ação e reação (mesma intensidade, sentidos opostos)\n\nDúvida para o professor: atrito estático vs. cinético.",
  },
});

await db.setting.upsert({
  where: { key: "metaSemanalMin" },
  update: { value: "600" },
  create: { key: "metaSemanalMin", value: "600" },
});

console.log("Dados de demonstração criados.");
await db.$disconnect();
