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
import { BotaoGoogle } from "./BotaoGoogle";

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

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    const r = await conta.confirmarCodigo(codigo);
    setEnviando(false);
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

      <BotaoGoogle aoEntrar={() => router.push(destino)} />

      <p className="text-center text-[0.875rem] text-grafite">
        {copy.conta.aindaSemConta}{" "}
        <Link href="/conta/criar" className="font-medium text-violeta underline">
          {copy.conta.criarConta}
        </Link>
      </p>
    </form>
  );
}
