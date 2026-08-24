import { NextRequest, NextResponse } from "next/server";
import { COOKIE_SESSAO, senhaConfigurada, tokenDeAcesso } from "@/lib/auth";

// Protege o app inteiro com a senha definida em SENHA_DE_ACESSO.
// Sem a variável (uso local no computador), nada é bloqueado.
export async function middleware(request: NextRequest) {
  const senha = senhaConfigurada();
  if (!senha) return NextResponse.next();

  const { pathname } = request.nextUrl;
  // Rotas livres: login, service worker/ícones (o navegador busca sem cookie)
  // e o disparo de notificações, que valida o próprio acesso (CRON_SECRET ou sessão).
  if (
    pathname === "/entrar" ||
    pathname === "/api/entrar" ||
    pathname === "/sw.js" ||
    pathname.startsWith("/icone-") ||
    pathname === "/api/notificacoes/enviar"
  ) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(COOKIE_SESSAO)?.value;
  if (cookie && cookie === (await tokenDeAcesso(senha))) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Acesso negado. Entre com a senha." }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = "/entrar";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // Tudo, exceto arquivos estáticos do Next
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
