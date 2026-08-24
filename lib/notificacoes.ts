import webpush from "web-push";
import { google } from "googleapis";
import { db } from "@/lib/db";
import { contaConectada } from "@/lib/google";
import { nivelUrgencia, ROTULO_URGENCIA } from "@/lib/urgencia";

export function pushConfigurado(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
  );
}

// Monta o resumo do dia: o que vence, o que revisar, o que estudar.
export async function resumoDoDia() {
  const agora = new Date();
  const em48h = new Date(agora.getTime() + 48 * 3600_000);
  const fimDeHoje = new Date(agora);
  fimDeHoje.setHours(23, 59, 59, 999);
  const fimDeAmanha = new Date(fimDeHoje.getTime() + 86400_000);

  const [tarefas, eventos, cardsVencidos, blocosHoje] = await Promise.all([
    db.task.findMany({
      where: { status: { not: "DONE" }, dueDate: { lte: em48h } },
      include: { subject: true },
      orderBy: { dueDate: "asc" },
    }),
    db.event.findMany({
      where: { date: { gte: agora, lte: fimDeAmanha } },
      include: { subject: true },
      orderBy: { date: "asc" },
    }),
    db.flashcard.count({ where: { dueDate: { lte: agora } } }),
    db.studyBlock.findMany({
      where: { dayOfWeek: agora.getDay() },
      include: { subject: true },
      orderBy: { startMin: "asc" },
    }),
  ]);

  const linhas: string[] = [];
  const atrasadas = tarefas.filter((t) => t.dueDate && t.dueDate < agora);
  const proximas = tarefas.filter((t) => !t.dueDate || t.dueDate >= agora);

  if (atrasadas.length > 0) {
    linhas.push(`⚠️ ${atrasadas.length} tarefa(s) ATRASADA(S):`);
    for (const t of atrasadas) {
      linhas.push(`  • ${t.title}${t.subject ? ` (${t.subject.name})` : ""}`);
    }
  }
  if (proximas.length > 0) {
    linhas.push(`📌 Vencendo em até 48h:`);
    for (const t of proximas) {
      const urg = ROTULO_URGENCIA[nivelUrgencia(t)];
      linhas.push(
        `  • ${t.title}${t.subject ? ` (${t.subject.name})` : ""} — ${t.dueDate?.toLocaleDateString("pt-BR")} · urgência ${urg}`
      );
    }
  }
  if (eventos.length > 0) {
    linhas.push(`📅 Hoje/amanhã no calendário:`);
    for (const e of eventos) {
      linhas.push(`  • ${e.title} — ${e.date.toLocaleDateString("pt-BR")}`);
    }
  }
  if (cardsVencidos > 0) {
    linhas.push(`🔁 ${cardsVencidos} flashcard(s) para revisar hoje.`);
  }
  if (blocosHoje.length > 0) {
    const fmt = (min: number) =>
      `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
    linhas.push(
      `⏰ Blocos de hoje: ${blocosHoje.map((b) => `${b.subject.name} às ${fmt(b.startMin)}`).join(", ")}.`
    );
  }

  const titulo =
    atrasadas.length > 0
      ? `⚠️ ${atrasadas.length} atrasada(s) e ${proximas.length} vencendo`
      : proximas.length > 0
        ? `📌 ${proximas.length} tarefa(s) vencendo em 48h`
        : cardsVencidos > 0
          ? `🔁 ${cardsVencidos} revisões esperando por você`
          : "✅ Tudo em dia — bom estudo!";

  return {
    titulo,
    corpo: linhas.join("\n") || "Nenhuma pendência. Aproveite para adiantar conteúdo!",
    temPendencias: linhas.length > 0,
  };
}

// ── Push (navegador/celular) ─────────────────────────────────

export async function enviarPush(titulo: string, corpo: string) {
  if (!pushConfigurado()) return { enviados: 0, erro: "push não configurado" };

  webpush.setVapidDetails(
    "mailto:notificacoes@pulso.local",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );

  const inscricoes = await db.pushSubscription.findMany();
  let enviados = 0;
  for (const sub of inscricoes) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify({ titulo, corpo })
      );
      enviados++;
    } catch (erro) {
      const status = (erro as { statusCode?: number }).statusCode;
      // Inscrição expirada/removida pelo navegador — limpa do banco
      if (status === 404 || status === 410) {
        await db.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
      }
    }
  }
  return { enviados };
}

// ── E-mail (via Gmail do próprio usuário) ────────────────────

export async function enviarEmail(titulo: string, corpo: string) {
  const auth = await contaConectada();
  if (!auth) return { ok: false, erro: "conta Google não conectada" };

  const conta = await db.googleAccount.findUnique({ where: { id: 1 } });
  if (!conta?.email) return { ok: false, erro: "e-mail da conta desconhecido" };

  const gmail = google.gmail({ version: "v1", auth });

  const assunto = `Pulso · ${titulo}`;
  // Assunto com acentos precisa de codificação MIME
  const assuntoMime = `=?UTF-8?B?${Buffer.from(assunto).toString("base64")}?=`;
  const mensagem = [
    `To: ${conta.email}`,
    `Subject: ${assuntoMime}`,
    "Content-Type: text/plain; charset=UTF-8",
    "",
    corpo,
    "",
    "— Pulso, seu sistema de estudos",
  ].join("\r\n");

  try {
    await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: Buffer.from(mensagem).toString("base64url"),
      },
    });
    return { ok: true };
  } catch (erro) {
    const msg = erro instanceof Error ? erro.message : "erro desconhecido";
    // Sem o escopo gmail.send (conta conectada antes da atualização): reconectar resolve
    return { ok: false, erro: msg };
  }
}
