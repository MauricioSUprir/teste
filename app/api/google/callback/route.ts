import { NextResponse } from "next/server";
import { google } from "googleapis";
import { db } from "@/lib/db";
import { oauthClient } from "@/lib/google";

// Recebe o retorno do Google após o consentimento e guarda os tokens no banco.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const erro = searchParams.get("error");

  if (erro || !code) {
    return NextResponse.redirect(`${origin}/integracoes?erro=acesso-negado`);
  }

  const client = oauthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.access_token) {
    return NextResponse.redirect(`${origin}/integracoes?erro=sem-token`);
  }
  client.setCredentials(tokens);

  const { data: perfil } = await google
    .oauth2({ version: "v2", auth: client })
    .userinfo.get();

  const contaExistente = await db.googleAccount.findUnique({ where: { id: 1 } });

  await db.googleAccount.upsert({
    where: { id: 1 },
    update: {
      email: perfil.email ?? "conta conectada",
      accessToken: tokens.access_token,
      // O Google só devolve refresh_token no primeiro consentimento;
      // em reconexões, mantém o que já estava salvo.
      refreshToken: tokens.refresh_token ?? contaExistente?.refreshToken ?? "",
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : new Date(Date.now() + 3600_000),
    },
    create: {
      id: 1,
      email: perfil.email ?? "conta conectada",
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? "",
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : new Date(Date.now() + 3600_000),
    },
  });

  return NextResponse.redirect(`${origin}/integracoes?conectado=1`);
}
