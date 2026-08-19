"use client";

/**
 * Etapa do código de verificação — compartilhada por login e cadastro.
 * Todo e-mail que entra na conta passa por aqui, sem exceção.
 * Na demo o código aparece na tela; com o servidor no ar, chega por e-mail.
 */
import { useState } from "react";
import { copy } from "@/lib/copy";
import { useConta } from "@/lib/conta/contexto";

export function EtapaCodigo({ aoConcluir }: { aoConcluir: () => void }) {
  const conta = useConta();
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    const r = await conta.confirmarCodigo(codigo);
    setEnviando(false);
    if (r.ok) {
      aoConcluir();
    } else {
      setErro(r.erro ?? "");
      if (!conta.aguardandoCodigo) setCodigo("");
    }
  }

  return (
    <form onSubmit={confirmar} className="space-y-4">
      <h2 className="font-titulo text-[1.25rem] font-semibold">{copy.conta.codigoTitulo}</h2>
      <p className="text-[0.9375rem] text-grafite">
        {copy.conta.codigoTexto(conta.emailAguardandoCodigo ?? "")}
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
        disabled={codigo.length !== 6 || enviando}
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
