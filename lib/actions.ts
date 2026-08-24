"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { reviewCard } from "@/lib/sm2";

// ── Matérias ─────────────────────────────────────────────────

export async function criarMateria(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const color = String(formData.get("color") ?? "#2E6E54");
  if (!name) return;
  await db.subject.create({ data: { name, color } });
  revalidatePath("/", "layout");
}

export async function excluirMateria(id: string) {
  await db.subject.delete({ where: { id } });
  revalidatePath("/", "layout");
}

export async function criarTopico(subjectId: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await db.topic.create({ data: { name, subjectId } });
  revalidatePath("/materias");
}

export async function alternarTopico(id: string, done: boolean) {
  await db.topic.update({ where: { id }, data: { done } });
  revalidatePath("/materias");
}

export async function excluirTopico(id: string) {
  await db.topic.delete({ where: { id } });
  revalidatePath("/materias");
}

// ── Tarefas ──────────────────────────────────────────────────

export async function criarTarefa(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  const dueDateRaw = String(formData.get("dueDate") ?? "");
  const subjectId = String(formData.get("subjectId") ?? "");
  await db.task.create({
    data: {
      title,
      priority: String(formData.get("priority") ?? "MEDIA"),
      dueDate: dueDateRaw ? new Date(dueDateRaw + "T23:59:00") : null,
      subjectId: subjectId || null,
      description: String(formData.get("description") ?? "").trim() || null,
    },
  });
  revalidatePath("/", "layout");
}

export async function moverTarefa(id: string, status: string) {
  await db.task.update({
    where: { id },
    data: { status, completedAt: status === "DONE" ? new Date() : null },
  });
  revalidatePath("/", "layout");
}

export async function excluirTarefa(id: string) {
  await db.task.delete({ where: { id } });
  revalidatePath("/", "layout");
}

// ── Cronograma ───────────────────────────────────────────────

export async function criarBloco(formData: FormData) {
  const subjectId = String(formData.get("subjectId") ?? "");
  const dayOfWeek = Number(formData.get("dayOfWeek"));
  const [h, m] = String(formData.get("start") ?? "08:00").split(":").map(Number);
  const durationMin = Number(formData.get("durationMin") ?? 60);
  if (!subjectId || Number.isNaN(dayOfWeek)) return;
  await db.studyBlock.create({
    data: { subjectId, dayOfWeek, startMin: h * 60 + m, durationMin },
  });
  revalidatePath("/", "layout");
}

export async function excluirBloco(id: string) {
  await db.studyBlock.delete({ where: { id } });
  revalidatePath("/", "layout");
}

// ── Pomodoro ─────────────────────────────────────────────────

export async function registrarSessao(focusMin: number, subjectId: string | null) {
  if (focusMin < 1) return;
  await db.pomodoroSession.create({
    data: { focusMin, subjectId: subjectId || null },
  });
  revalidatePath("/", "layout");
}

// ── Notas ────────────────────────────────────────────────────

export async function criarNota(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  const subjectId = String(formData.get("subjectId") ?? "");
  await db.note.create({
    data: { title, subjectId: subjectId || null },
  });
  revalidatePath("/notas");
}

export async function salvarNota(id: string, content: string) {
  await db.note.update({ where: { id }, data: { content } });
  revalidatePath("/notas");
}

export async function excluirNota(id: string) {
  await db.note.delete({ where: { id } });
  revalidatePath("/notas");
}

// ── Flashcards ───────────────────────────────────────────────

export async function criarFlashcard(formData: FormData) {
  const front = String(formData.get("front") ?? "").trim();
  const back = String(formData.get("back") ?? "").trim();
  if (!front || !back) return;
  const subjectId = String(formData.get("subjectId") ?? "");
  await db.flashcard.create({
    data: { front, back, subjectId: subjectId || null },
  });
  revalidatePath("/flashcards");
}

// Cria vários cartões de uma vez (usado pelo assistente de IA)
export async function criarFlashcardsEmLote(
  cards: { front: string; back: string }[],
  subjectId: string | null
) {
  const validos = cards.filter((c) => c.front.trim() && c.back.trim());
  if (validos.length === 0) return 0;
  await db.flashcard.createMany({
    data: validos.map((c) => ({
      front: c.front.trim(),
      back: c.back.trim(),
      subjectId: subjectId || null,
    })),
  });
  revalidatePath("/flashcards");
  return validos.length;
}

export async function revisarFlashcard(id: string, quality: number) {
  const card = await db.flashcard.findUnique({ where: { id } });
  if (!card) return;
  const resultado = reviewCard(
    {
      easiness: card.easiness,
      intervalDays: card.intervalDays,
      repetitions: card.repetitions,
    },
    quality
  );
  await db.flashcard.update({
    where: { id },
    data: {
      easiness: resultado.easiness,
      intervalDays: resultado.intervalDays,
      repetitions: resultado.repetitions,
      dueDate: resultado.dueDate,
    },
  });
  revalidatePath("/flashcards");
}

export async function excluirFlashcard(id: string) {
  await db.flashcard.delete({ where: { id } });
  revalidatePath("/flashcards");
}

// ── Configurações ────────────────────────────────────────────

export async function salvarMetaSemanal(formData: FormData) {
  const minutos = Number(formData.get("minutos") ?? 0);
  await db.setting.upsert({
    where: { key: "metaSemanalMin" },
    update: { value: String(minutos) },
    create: { key: "metaSemanalMin", value: String(minutos) },
  });
  revalidatePath("/", "layout");
}

// ── Google ───────────────────────────────────────────────────

export async function desconectarGoogle() {
  await db.googleAccount.deleteMany({});
  revalidatePath("/integracoes");
}
