// Autenticação simples por senha única (app pessoal).
// Usa Web Crypto para funcionar tanto no middleware (edge) quanto nas rotas.

export const COOKIE_SESSAO = "estudaflow_sessao";

export function senhaConfigurada(): string | undefined {
  return process.env.SENHA_DE_ACESSO || undefined;
}

// Token derivado da senha — o que vai no cookie. Trocar a senha invalida as sessões.
export async function tokenDeAcesso(senha: string): Promise<string> {
  const dados = new TextEncoder().encode(`estudaflow-v1:${senha}`);
  const hash = await crypto.subtle.digest("SHA-256", dados);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
