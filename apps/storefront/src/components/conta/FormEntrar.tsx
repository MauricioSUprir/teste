"use client";

/**
 * Login em duas etapas: e-mail + senha → código de verificação de 6 dígitos.
 * Na demo o código é exibido na tela (aviso claro); em produção é enviado
 * por e-mail pelo backend.
 */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { copy } from "@/lib/copy";
import { useConta } from "@/lib/conta/contexto";

export function FormEntrar({ destino = "/conta" }: { destino?: string }) {
  const conta = useConta();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    const r = await conta.iniciarLogin(email, senha);
    setEnviando(false);
    setErro(r.ok ? "" : (r.erro ?? ""));
  }

  function confirmar(e: React.FormEvent) {
    e.preventDefault();
    const r = conta.confirmarCodigo(codigo);
    if (r.ok) {
      router.push(destino);
    } else {
      setErro(r.erro ?? "");
      if (!conta.aguardandoCodigo) setCodigo("");
    }
  }

  if (conta.aguardandoCodigo) {
    return (
      <form onSubmit={confirmar} className="space-y-4">
        <h2 className="font-titulo text-[1.25rem] font-semibold">{copy.conta.codigoTitulo}</h2>
        <p className="text-[0.9375rem] text-grafite">
          {copy.conta.codigoTexto(email.trim().toLowerCase())}
        </p>

        {/* aviso de demonstração — em produção o código chega por e-mail */}
        {conta.codigoDemo && (
          <div className="rounded-[10px] border border-violeta/30 bg-violeta-claro p-3 text-[0.8125rem] text-grafite">
            <p>{copy.conta.codigoDemoAviso}</p>
            <p className="num mt-1 text-[1.25rem] font-bold tracking-[0.3em] text-violeta">
              {conta.codigoDemo}
            </p>
          </div>
        )}

        <div>
          <label htmlFor="codigo" className="block text-[0.8125rem] font-medium text-grafite">
            {copy.conta.codigoRotulo}
          </label>
          <input
            id="codigo"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
            className="num mt-1 h-12 w-full rounded-[6px] border border-linha bg-white px-3 text-center text-[1.25rem] tracking-[0.4em] outline-none focus:border-violeta"
            autoFocus
          />
        </div>

        {erro && (
          <p role="alert" className="rounded-[6px] bg-roxo-claro px-3 py-2 text-[0.8125rem] font-medium text-erro">
            {erro}
          </p>
        )}

        <button
          type="submit"
          disabled={codigo.length !== 6}
          className="w-full rounded-[999px] bg-roxo py-3 text-[0.9375rem] font-semibold text-white hover:bg-roxo-escuro disabled:bg-cinza"
        >
          {copy.conta.codigoBotao}
        </button>
        <button
          type="button"
          onClick={() => {
            conta.cancelarVerificacao();
            setCodigo("");
            setErro("");
          }}
          className="block w-full text-center text-[0.875rem] text-grafite underline"
        >
          {copy.conta.codigoVoltar}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={entrar} className="space-y-4">
      <div>
        <label htmlFor="login-email" className="block text-[0.8125rem] font-medium text-grafite">
          {copy.conta.email}
        </label>
        <input
          id="login-email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 h-11 w-full rounded-[6px] border border-linha bg-white px-3 text-[0.9375rem] outline-none focus:border-violeta"
        />
      </div>
      <div>
        <label htmlFor="login-senha" className="block text-[0.8125rem] font-medium text-grafite">
          {copy.conta.senha}
        </label>
        <input
          id="login-senha"
          type="password"
          required
          autoComplete="current-password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          className="mt-1 h-11 w-full rounded-[6px] border border-linha bg-white px-3 text-[0.9375rem] outline-none focus:border-violeta"
        />
      </div>

      {erro && (
        <p role="alert" className="rounded-[6px] bg-roxo-claro px-3 py-2 text-[0.8125rem] font-medium text-erro">
          {erro}
        </p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="w-full rounded-[999px] bg-roxo py-3 text-[0.9375rem] font-semibold text-white hover:bg-roxo-escuro disabled:bg-cinza"
      >
        {copy.conta.botaoEntrar}
      </button>

      <div className="flex items-center gap-3 text-[0.75rem] uppercase tracking-wide text-cinza">
        <span className="h-px grow bg-linha" aria-hidden="true" />
        {copy.conta.ou}
        <span className="h-px grow bg-linha" aria-hidden="true" />
      </div>

      <button
        type="button"
        onClick={() => {
          conta.entrarComGoogle();
          router.push(destino);
        }}
        className="flex w-full items-center justify-center gap-2.5 rounded-[999px] border border-linha bg-white py-3 text-[0.9375rem] font-medium text-tinta hover:bg-superficie"
      >
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
        </svg>
        {copy.conta.entrarComGoogle}
      </button>

      <p className="text-center text-[0.875rem] text-grafite">
        {copy.conta.aindaSemConta}{" "}
        <Link href="/conta/criar" className="font-medium text-violeta underline">
          {copy.conta.criarConta}
        </Link>
      </p>
    </form>
  );
}
