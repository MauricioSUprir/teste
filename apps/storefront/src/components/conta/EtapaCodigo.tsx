"use client";

/**
 * Etapa do código de verificação — compartilhada por login e cadastro.
 * Todo e-mail que entra na conta passa por aqui, sem exceção.
 * Na demo o código aparece na tela; com o servidor no ar, chega por e-mail.
 * Mostra o status do envio (enviado / não enviado) e permite reenviar.
 */
import { useEffect, useState } from "react";
import { copy } from "@/lib/copy";
import { useConta } from "@/lib/conta/contexto";

const ESPERA_REENVIO_S = 30;

export function EtapaCodigo({ aoConcluir }: { aoConcluir: () => void }) {
  const conta = useConta();
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [reenviando, setReenviando] = useState(false);
  // status do último envio: o fluxo só chega nesta tela após um envio bem-sucedido
  const [statusEnvio, setStatusEnvio] = useState<"enviado" | "reenviado" | "falha">("enviado");
  const [erroEnvio, setErroEnvio] = useState("");
  const [esperaReenvio, setEsperaReenvio] = useState(ESPERA_REENVIO_S);

  // contagem regressiva para liberar o botão de reenviar
  useEffect(() => {
    if (esperaReenvio <= 0) return;
    const timer = setTimeout(() => setEsperaReenvio((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [esperaReenvio]);

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
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

  async function reenviar() {
    if (reenviando || esperaReenvio > 0) return;
    setReenviando(true);
    setErro("");
    const r = await conta.reenviarCodigo();
    setReenviando(false);
    if (r.ok) {
      setStatusEnvio("reenviado");
      setErroEnvio("");
      setCodigo("");
      setEsperaReenvio(ESPERA_REENVIO_S);
    } else {
      setStatusEnvio("falha");
      setErroEnvio(r.erro ?? "");
      setEsperaReenvio(5);
    }
  }

  return (
    <form onSubmit={confirmar} className="space-y-4">
      <h2 className="font-titulo text-[1.25rem] font-semibold">{copy.conta.codigoTitulo}</h2>
      <p className="text-[0.9375rem] text-grafite">
        {copy.conta.codigoTexto(conta.emailAguardandoCodigo ?? "")}
      </p>

      {/* status do envio — sempre visível: enviado ou não enviado */}
      {conta.codigoDemo === null &&
        (statusEnvio === "falha" ? (
          <p
            role="status"
            className="rounded-[10px] border border-erro/40 bg-roxo-claro px-3 py-2.5 text-[0.875rem] font-medium text-erro"
          >
            {copy.conta.codigoNaoEnviado}
            {erroEnvio && <span className="block font-normal text-grafite">{erroEnvio}</span>}
          </p>
        ) : (
          <p
            role="status"
            className="rounded-[10px] border border-sucesso/40 bg-[#E7F5EE] px-3 py-2.5 text-[0.875rem] font-medium text-sucesso"
          >
            {statusEnvio === "reenviado" ? copy.conta.codigoReenviado : copy.conta.codigoEnviado}
          </p>
        ))}

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
        aria-busy={enviando}
        className="w-full rounded-[999px] bg-roxo py-3 text-[0.9375rem] font-semibold text-white hover:bg-roxo-escuro disabled:bg-cinza"
      >
        {enviando ? copy.conta.botaoConfirmando : copy.conta.codigoBotao}
      </button>

      <button
        type="button"
        onClick={reenviar}
        disabled={reenviando || esperaReenvio > 0}
        aria-busy={reenviando}
        className="block w-full rounded-[999px] border border-linha py-2.5 text-center text-[0.875rem] font-medium text-grafite hover:bg-superficie disabled:opacity-50"
      >
        {reenviando
          ? copy.conta.codigoReenviando
          : esperaReenvio > 0
            ? copy.conta.codigoReenviarEm(esperaReenvio)
            : copy.conta.codigoReenviar}
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
