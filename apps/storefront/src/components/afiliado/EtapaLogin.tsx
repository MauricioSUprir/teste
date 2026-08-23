"use client";

/** Primeira etapa do acesso do afiliado: só o e-mail — sem senha. */
import { useState } from "react";
import { copy } from "@/lib/copy";
import { useAfiliado } from "@/lib/afiliado/contexto";

export function EtapaLogin() {
  const afiliado = useAfiliado();
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    const r = await afiliado.entrar(email);
    setEnviando(false);
    if (!r.ok) setErro(r.erro ?? copy.afiliado.falha);
  }

  return (
    <form onSubmit={enviar} className="rounded-[16px] border border-linha p-6">
      <h2 className="font-titulo text-[1.25rem] font-semibold text-tinta">{copy.afiliado.loginTitulo}</h2>
      <p className="mt-1 text-[0.9375rem] text-grafite">{copy.afiliado.loginTexto}</p>
      <label className="mt-4 block">
        <span className="text-[0.875rem] font-medium text-tinta">{copy.afiliado.loginEmailRotulo}</span>
        <input
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="voce@email.com.br"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 h-12 w-full rounded-[6px] border border-linha bg-white px-3 text-[0.9375rem] outline-none focus:border-violeta"
        />
      </label>
      {erro && (
        <p role="alert" className="mt-3 text-[0.875rem] font-medium text-erro">
          {erro}
        </p>
      )}
      <button
        type="submit"
        disabled={enviando}
        className="mt-5 h-12 w-full rounded-[999px] bg-roxo text-[1rem] font-semibold text-white hover:bg-roxo-escuro disabled:opacity-60 sm:w-auto sm:px-8"
      >
        {enviando ? copy.afiliado.loginEnviando : copy.afiliado.loginBotao}
      </button>
      {enviando && <p className="mt-2 text-[0.8125rem] text-cinza">{copy.conta.aguardeServidor}</p>}
    </form>
  );
}
