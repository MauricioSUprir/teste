export const dynamic = "force-dynamic";

export default async function Entrar({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;

  return (
    <div style={{ maxWidth: 380, margin: "18vh auto 0" }}>
      <div className="cartao pilha">
        <div className="logo" style={{ padding: 0 }}>
          Estuda<span style={{ color: "var(--acento)" }}>Flow</span>
        </div>
        <p className="texto-suave">Este é um espaço pessoal. Digite a senha de acesso.</p>
        {erro && (
          <p style={{ color: "var(--perigo)", fontWeight: 700 }}>
            Senha incorreta. Tente de novo.
          </p>
        )}
        <form method="POST" action="/api/entrar" className="pilha">
          <input
            type="password"
            name="senha"
            placeholder="Senha"
            required
            autoFocus
            aria-label="Senha de acesso"
          />
          <button type="submit" className="btn-principal">
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}
