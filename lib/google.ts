import { Auth, google } from "googleapis";
import { db } from "@/lib/db";

type OAuth2Client = Auth.OAuth2Client;

// Escopos pedidos ao Google — somente leitura, o app nunca altera nada na sua conta.
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/classroom.courses.readonly",
  "https://www.googleapis.com/auth/classroom.coursework.me.readonly",
  "https://www.googleapis.com/auth/classroom.announcements.readonly",
  "https://www.googleapis.com/auth/drive.metadata.readonly",
  "https://www.googleapis.com/auth/gmail.readonly",
];

export function googleConfigurado(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function oauthClient(): OAuth2Client {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/google/callback"
  );
}

// Cliente autenticado com a conta conectada (tokens guardados no banco).
// Devolve null se nenhuma conta estiver conectada ainda.
export async function contaConectada(): Promise<OAuth2Client | null> {
  const account = await db.googleAccount.findUnique({ where: { id: 1 } });
  if (!account) return null;

  const client = oauthClient();
  client.setCredentials({
    access_token: account.accessToken,
    refresh_token: account.refreshToken,
    expiry_date: account.expiresAt.getTime(),
  });

  // Persiste tokens renovados automaticamente pelo googleapis
  client.on("tokens", async (tokens) => {
    await db.googleAccount.update({
      where: { id: 1 },
      data: {
        accessToken: tokens.access_token ?? account.accessToken,
        refreshToken: tokens.refresh_token ?? account.refreshToken,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : account.expiresAt,
      },
    });
  });

  return client;
}

// ── Classroom ────────────────────────────────────────────────

// Importa as atividades dos cursos do Classroom como tarefas.
// Usa externalId para nunca duplicar uma atividade já importada.
export async function sincronizarClassroom(auth: OAuth2Client) {
  const classroom = google.classroom({ version: "v1", auth });

  const { data: cursosData } = await classroom.courses.list({
    courseStates: ["ACTIVE"],
    pageSize: 30,
  });
  const cursos = cursosData.courses ?? [];

  let importadas = 0;
  for (const curso of cursos) {
    if (!curso.id) continue;

    // Garante uma matéria correspondente ao curso
    const nomeCurso = curso.name ?? "Curso do Classroom";
    let subject = await db.subject.findFirst({ where: { name: nomeCurso } });
    if (!subject) {
      subject = await db.subject.create({ data: { name: nomeCurso, color: "#3B6EA5" } });
    }

    const { data: courseworkData } = await classroom.courses.courseWork.list({
      courseId: curso.id,
      pageSize: 60,
      orderBy: "dueDate desc",
    });

    for (const work of courseworkData.courseWork ?? []) {
      if (!work.id) continue;
      const externalId = `classroom:${curso.id}:${work.id}`;
      const existe = await db.task.findUnique({ where: { externalId } });
      if (existe) continue;

      let dueDate: Date | null = null;
      if (work.dueDate?.year && work.dueDate.month && work.dueDate.day) {
        dueDate = new Date(
          work.dueDate.year,
          work.dueDate.month - 1,
          work.dueDate.day,
          work.dueTime?.hours ?? 23,
          work.dueTime?.minutes ?? 59
        );
      }

      await db.task.create({
        data: {
          title: work.title ?? "Atividade do Classroom",
          description: work.description ?? null,
          dueDate,
          source: "CLASSROOM",
          externalId,
          link: work.alternateLink ?? null,
          subjectId: subject.id,
          priority: "ALTA",
        },
      });
      importadas++;
    }
  }

  return { cursos: cursos.length, importadas };
}

// ── Gmail ────────────────────────────────────────────────────

// Busca e-mails recentes relacionados a estudos (Classroom, professores, prazos).
export async function emailsDeEstudo(auth: OAuth2Client, maxResults = 15) {
  const gmail = google.gmail({ version: "v1", auth });

  const { data } = await gmail.users.messages.list({
    userId: "me",
    q: "newer_than:14d (from:classroom.google.com OR subject:(prova OR trabalho OR prazo OR atividade OR aula))",
    maxResults,
  });

  const mensagens = [];
  for (const msg of data.messages ?? []) {
    if (!msg.id) continue;
    const { data: detalhe } = await gmail.users.messages.get({
      userId: "me",
      id: msg.id,
      format: "metadata",
      metadataHeaders: ["Subject", "From", "Date"],
    });
    const header = (nome: string) =>
      detalhe.payload?.headers?.find((h) => h.name === nome)?.value ?? "";
    mensagens.push({
      id: msg.id,
      assunto: header("Subject"),
      de: header("From"),
      data: header("Date"),
      resumo: detalhe.snippet ?? "",
      link: `https://mail.google.com/mail/u/0/#inbox/${msg.id}`,
    });
  }
  return mensagens;
}

// ── Drive ────────────────────────────────────────────────────

// Lista arquivos recentes do Drive (materiais de estudo).
export async function arquivosRecentes(auth: OAuth2Client, maxResults = 20) {
  const drive = google.drive({ version: "v3", auth });

  const { data } = await drive.files.list({
    pageSize: maxResults,
    orderBy: "modifiedTime desc",
    q: "trashed = false",
    fields: "files(id, name, mimeType, webViewLink, modifiedTime, iconLink)",
  });

  return (data.files ?? []).map((f) => ({
    id: f.id ?? "",
    nome: f.name ?? "",
    tipo: f.mimeType ?? "",
    link: f.webViewLink ?? "",
    modificado: f.modifiedTime ?? "",
    icone: f.iconLink ?? "",
  }));
}
