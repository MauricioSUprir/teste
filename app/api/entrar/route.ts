import { NextResponse } from "next/server";
import { COOKIE_SESSAO, senhaConfigurada, tokenDeAcesso } from "@/lib/auth";

// Recebe o formulário de login e cria a sessão (cookie de 30 dias).
export async function POST(request: Request) {
  const { origin } = new URL(request.url);
  const senha = senhaConfigurada();
  if (!senha) return NextResponse.redirect(origin, 303);

  const form = await request.formData();
  const tentativa = String(form.get("senha") ?? "");

  if (tentativa !== senha) {
    return NextResponse.redirect(`${origin}/entrar?erro=1`, 303);
  }

  const resposta = NextResponse.redirect(origin, 303);
  resposta.cookies.set(COOKIE_SESSAO, await tokenDeAcesso(senha), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return resposta;
}
