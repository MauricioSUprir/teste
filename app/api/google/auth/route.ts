import { NextResponse } from "next/server";
import { googleConfigurado, GOOGLE_SCOPES, oauthClient } from "@/lib/google";

// Inicia o fluxo de conexão com o Google: redireciona para a tela de consentimento.
export async function GET() {
  if (!googleConfigurado()) {
    return NextResponse.json(
      { error: "Credenciais do Google ausentes. Veja docs/INTEGRACOES.md." },
      { status: 503 }
    );
  }

  const url = oauthClient().generateAuthUrl({
    access_type: "offline", // garante refresh_token para renovar o acesso
    prompt: "consent",
    scope: GOOGLE_SCOPES,
  });

  return NextResponse.redirect(url);
}
