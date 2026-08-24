import { NextRequest, NextResponse } from "next/server";
import { enviarEmail, enviarPush, resumoDoDia } from "@/lib/notificacoes";
import { COOKIE_SESSAO, senhaConfigurada, tokenDeAcesso } from "@/lib/auth";

export const maxDuration = 300;

// Dispara o resumo do dia por push e e-mail.
// Chamado pelo cron da Vercel (Authorization: Bearer CRON_SECRET)
// ou pelo botão "Enviar agora" na página Notificações (sessão logada).
async function autorizado(request: NextRequest): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true;

  const senha = senhaConfigurada();
  if (!senha) return true; // uso local, sem senha
  const cookie = request.cookies.get(COOKIE_SESSAO)?.value;
  return cookie === (await tokenDeAcesso(senha));
}

async function disparar(request: NextRequest) {
  if (!(await autorizado(request))) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const resumo = await resumoDoDia();
  const somenteSePendente = request.nextUrl.searchParams.get("sempre") !== "1";
  if (somenteSePendente && !resumo.temPendencias) {
    return NextResponse.json({ ok: true, pulado: "nada pendente hoje" });
  }

  const [push, email] = await Promise.all([
    enviarPush(resumo.titulo, resumo.corpo),
    enviarEmail(resumo.titulo, resumo.corpo),
  ]);

  return NextResponse.json({
    ok: true,
    titulo: resumo.titulo,
    push,
    email,
  });
}

export async function GET(request: NextRequest) {
  return disparar(request); // o cron da Vercel chama via GET
}

export async function POST(request: NextRequest) {
  return disparar(request);
}
