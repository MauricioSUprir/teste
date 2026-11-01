"use client";

/**
 * Tela do código de 6 dígitos no visual "vidro" — usada no login/cadastro
 * (conta/EtapaCodigo) e na área de afiliados (afiliado/EtapaCodigo).
 *
 * Mostra o status do envio, as 6 casas do código, a contagem para reenviar
 * ("Não recebeu o código? Reenviar em 00:28") e, quando o código confere,
 * chama a celebração (cartão "Verificado com sucesso") antes de seguir.
 *
 * O campo é um só (acessível, aceita colar e o preenchimento automático do
 * celular); as 6 casas são só o desenho por baixo dele.
 */
import { useEffect, useState } from "react";
import { copy } from "@/lib/copy";
import { CartaoVidro, EscudoVidro, PalcoVidro, celebrar } from "@/components/efeitos/Vidro";

const ESPERA_REENVIO_S = 30;
const CASAS = 6;

type Resultado = { ok: boolean; erro?: string };

interface Props {
  idCampo: string;
  email: string;
  codigoDemo: string | null;
  /** o contexto ainda espera um código (falhou sem cancelar a verificação) */
  aguardando: boolean;
  confirmar: (codigo: string) => Promise<Resultado>;
  reenviar: () => Promise<Resultado>;
  cancelar: () => void;
  aoConcluir?: () => void;
  /** encaixa no cartão branco com p-6 (login, cadastro, painel): ocupa o cartão todo */
  sangrar?: boolean;
}

const doisDigitos = (s: number) => String(Math.max(0, s)).padStart(2, "0");

export function CodigoVidro({ idCampo, email, codigoDemo, aguardando, confirmar, reenviar, cancelar, aoConcluir, sangrar = false }: Props) {
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [reenviando, setReenviando] = useState(false);
  const [foco, setFoco] = useState(false);
  // status do último envio: o fluxo só chega nesta tela após um envio bem-sucedido
  const [statusEnvio, setStatusEnvio] = useState<"enviado" | "reenviado" | "falha">("enviado");
  const [erroEnvio, setErroEnvio] = useState("");
  const [esperaReenvio, setEsperaReenvio] = useState(ESPERA_REENVIO_S);

  // contagem regressiva para liberar o reenvio
  useEffect(() => {
    if (esperaReenvio <= 0) return;
    const timer = setTimeout(() => setEsperaReenvio((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [esperaReenvio]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando || codigo.length !== CASAS) return;
    setEnviando(true);
    setErro("");
    const r = await confirmar(codigo);
    setEnviando(false);
    if (r.ok) {
      celebrar("codigo");
      aoConcluir?.();
    } else {
      setErro(r.erro ?? "");
      if (!aguardando) setCodigo("");
    }
  }

  async function pedirOutro() {
    if (reenviando || esperaReenvio > 0) return;
    setReenviando(true);
    setErro("");
    const r = await reenviar();
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

  const casas = Array.from({ length: CASAS }, (_, i) => codigo[i] ?? "");
  const casaAtiva = Math.min(codigo.length, CASAS - 1);

  return (
    <PalcoVidro className={`rounded-[12px] p-4 sm:p-6 ${sangrar ? "-m-6" : ""}`}>
      <CartaoVidro className="mx-auto max-w-[440px] px-5 pb-6 pt-7 sm:px-7">
        <form onSubmit={enviar} className="text-center">
          <EscudoVidro estado="aguardando" />
          <h2 className="font-titulo mt-4 text-[1.375rem] font-semibold leading-tight text-white">
            {copy.conta.codigoTitulo}
          </h2>
          <p className="mx-auto mt-2 max-w-[34ch] text-[0.9375rem] text-[#E4E1EC]">
            {copy.conta.codigoTexto(email)}
          </p>

          {/* status do envio — sempre visível: enviado ou não enviado */}
          {codigoDemo === null &&
            (statusEnvio === "falha" ? (
              <p role="status" className="vidro-aviso vidro-aviso-erro mt-4">
                {copy.conta.codigoNaoEnviado}
                {erroEnvio && <span className="block font-normal">{erroEnvio}</span>}
              </p>
            ) : (
              <p role="status" className="vidro-aviso vidro-aviso-ok mt-4">
                {statusEnvio === "reenviado" ? copy.conta.codigoReenviado : copy.conta.codigoEnviado}
              </p>
            ))}

          {/* aviso de demonstração — em produção o código chega por e-mail */}
          {codigoDemo && (
            <div className="vidro-aviso mt-4">
              <p>{copy.conta.codigoDemoAviso}</p>
              <p className="num mt-1 text-[1.25rem] font-bold tracking-[0.3em] text-white">{codigoDemo}</p>
            </div>
          )}

          <label htmlFor={idCampo} className="mt-5 block text-[0.8125rem] font-medium text-[#E4E1EC]">
            {copy.conta.codigoRotulo}
          </label>
          <div className="relative mx-auto mt-2 max-w-[340px]">
            <input
              id={idCampo}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={CASAS}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, CASAS))}
              onFocus={() => setFoco(true)}
              onBlur={() => setFoco(false)}
              aria-invalid={erro ? true : undefined}
              aria-describedby={erro ? `${idCampo}-erro` : undefined}
              className="vidro-campo-codigo"
              autoFocus
            />
            <div aria-hidden="true" className="flex justify-between gap-2">
              {casas.map((d, i) => (
                <span
                  key={i}
                  className={`vidro-casa num ${d ? "vidro-casa-cheia" : ""} ${foco && i === casaAtiva && !(d && i === CASAS - 1) ? "vidro-casa-ativa" : ""} ${erro ? "vidro-casa-erro" : ""}`}
                >
                  {d || (foco && i === casaAtiva ? <span className="vidro-cursor" /> : null)}
                </span>
              ))}
            </div>
          </div>

          {erro && (
            <p id={`${idCampo}-erro`} role="alert" className="vidro-aviso vidro-aviso-erro mt-4">
              {erro}
            </p>
          )}

          <button
            type="submit"
            disabled={codigo.length !== CASAS || enviando}
            aria-busy={enviando}
            className="vidro-botao-marca mt-5"
          >
            {enviando ? copy.conta.botaoConfirmando : copy.conta.codigoBotao}
          </button>

          <p className="mt-4 text-[0.875rem] text-[#CFCADB]">
            {copy.conta.codigoNaoRecebeu}{" "}
            {esperaReenvio > 0 ? (
              <span className="num font-semibold text-white" aria-live="off">
                {copy.conta.codigoReenviarEm(`00:${doisDigitos(esperaReenvio)}`)}
              </span>
            ) : (
              <button
                type="button"
                onClick={pedirOutro}
                disabled={reenviando}
                aria-busy={reenviando}
                className="vidro-link font-semibold"
              >
                {reenviando ? copy.conta.codigoReenviando : copy.conta.codigoReenviar}
              </button>
            )}
          </p>

          <button
            type="button"
            onClick={() => {
              cancelar();
              setCodigo("");
              setErro("");
            }}
            className="vidro-link mt-3 text-[0.8125rem]"
          >
            {copy.conta.codigoVoltar}
          </button>
        </form>
      </CartaoVidro>
    </PalcoVidro>
  );
}
