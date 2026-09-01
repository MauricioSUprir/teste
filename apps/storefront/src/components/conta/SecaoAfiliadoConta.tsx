"use client";

/**
 * Seção "Programa de afiliados" da página Minha Conta — qualquer cliente
 * logado pode pedir para virar afiliado: confirma a própria senha, valida o
 * e-mail com um código e a solicitação cai na fila do admin (aba Afiliados).
 * Aprovado, o painel abre direto daqui (o e-mail já foi confirmado).
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { copy } from "@/lib/copy";
import { useConta } from "@/lib/conta/contexto";
import {
  cadastrarAfiliado,
  consultarStatusAfiliado,
  emailRealAtivo,
  solicitarCodigoPorEmail,
  verificarCodigoNoServidor,
} from "@/lib/servidor";

/** validação oficial de CNPJ (mesma regra do servidor) — só roda se preenchido */
function cnpjValido(cnpj: string): boolean {
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (tamanho: number) => {
    const pesos =
      tamanho === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = pesos.reduce((s, p, i) => s + p * Number(d[i]), 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}

const classeCampo =
  "h-11 w-full rounded-[6px] border border-linha bg-white px-3 text-[0.9375rem] outline-none focus:border-violeta";

type Etapa = "resumo" | "formulario" | "codigo";

export function SecaoAfiliadoConta() {
  const conta = useConta();
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [etapa, setEtapa] = useState<Etapa>("resumo");
  const [senha, setSenha] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const email = conta.usuario?.email ?? null;

  const carregarStatus = useCallback(async () => {
    if (!email) return;
    const r = await consultarStatusAfiliado(email);
    setStatus(r.status);
  }, [email]);

  useEffect(() => {
    void carregarStatus();
  }, [carregarStatus]);

  if (!conta.usuario || conta.usuario.admin) return null;
  const u = conta.usuario;

  async function iniciarPedido(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setErro(null);
    const digitos = cnpj.replace(/\D/g, "");
    if (digitos && !cnpjValido(digitos)) return setErro(copy.afiliado.cnpjInvalido);
    if (!whatsapp.trim()) return setErro("Informe seu WhatsApp.");
    setEnviando(true);
    // 1) a dona da conta confirma a senha
    if (!u.viaGoogle && !(await conta.validarSenha(senha))) {
      setEnviando(false);
      return setErro(copy.afiliado.conta.senhaErrada);
    }
    // 2) código por e-mail (quando o servidor de e-mail está no ar)
    if (await emailRealAtivo()) {
      const r = await solicitarCodigoPorEmail(u.email);
      setEnviando(false);
      if (!r.ok) return setErro(r.erro ?? copy.afiliado.falha);
      setEtapa("codigo");
      return;
    }
    setEnviando(false);
    await enviarSolicitacao();
  }

  async function confirmarCodigo(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setErro(null);
    setEnviando(true);
    const r = await verificarCodigoNoServidor(u.email, codigo.trim());
    setEnviando(false);
    if (!r.ok) return setErro(r.erro ?? "Código incorreto. Confira os 6 dígitos.");
    await enviarSolicitacao();
  }

  /** 3) a solicitação vai para a fila do admin */
  async function enviarSolicitacao() {
    setEnviando(true);
    const r = await cadastrarAfiliado({
      email: u.email,
      nome: u.nome,
      whatsapp: whatsapp.trim(),
      cnpj: cnpj.replace(/\D/g, "") || undefined,
    });
    setEnviando(false);
    if (!r.ok) return setErro(r.erro ?? copy.afiliado.falha);
    setEtapa("resumo");
    setStatus("pendente");
  }

  /** aprovado: o e-mail já foi confirmado — abre o painel sem novo login */
  function abrirPainel() {
    try {
      localStorage.setItem("afiliado-email", u.email.toLowerCase());
      localStorage.setItem("afiliado-status", "aprovado");
    } catch {
      // sem storage, a página /afiliado pede o código normalmente
    }
    router.push("/afiliado");
  }

  return (
    <section className="mt-4 rounded-[16px] border border-linha bg-white p-6">
      <h2 className="font-titulo text-[1.125rem] font-semibold">{copy.afiliado.conta.titulo}</h2>

      {status === "aprovado" && (
        <>
          <p className="mt-2 text-[0.9375rem] font-medium text-sucesso">{copy.afiliado.conta.aprovada}</p>
          <p className="mt-1 text-[0.875rem] text-grafite">{copy.afiliado.conta.aprovadaTexto}</p>
          <button
            type="button"
            onClick={abrirPainel}
            className="mt-4 h-11 rounded-[999px] bg-roxo px-6 text-[0.875rem] font-semibold text-white hover:bg-roxo-escuro"
          >
            {copy.afiliado.conta.abrirPainel} →
          </button>
        </>
      )}

      {status === "pendente" && (
        <>
          <p className="mt-2 text-[0.9375rem] font-medium text-alerta">{copy.afiliado.conta.pendente}</p>
          <p className="mt-1 text-[0.875rem] text-grafite">{copy.afiliado.conta.pendenteTexto}</p>
          <button
            type="button"
            onClick={() => void carregarStatus()}
            className="mt-3 h-10 rounded-[999px] border border-linha px-4 text-[0.8125rem] font-medium text-grafite hover:border-roxo"
          >
            {copy.afiliado.verificarNovamente}
          </button>
        </>
      )}

      {status === "recusado" && (
        <>
          <p className="mt-2 text-[0.9375rem] font-medium text-erro">{copy.afiliado.conta.recusada}</p>
          <p className="mt-1 text-[0.875rem] text-grafite">{copy.afiliado.conta.recusadaTexto}</p>
        </>
      )}

      {(status === "nao_cadastrado" || status === null) && etapa === "resumo" && (
        <>
          <p className="mt-2 text-[0.9375rem] text-grafite">{copy.afiliado.conta.texto}</p>
          <button
            type="button"
            onClick={() => setEtapa("formulario")}
            className="mt-4 h-11 rounded-[999px] bg-roxo px-6 text-[0.875rem] font-semibold text-white hover:bg-roxo-escuro"
          >
            {copy.afiliado.conta.botao}
          </button>
        </>
      )}

      {etapa === "formulario" && (
        <form onSubmit={iniciarPedido} className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-[0.8125rem] font-medium text-tinta">{copy.afiliado.formWhatsapp}</span>
              <input
                type="tel"
                required
                inputMode="tel"
                placeholder="(21) 99999-9999"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                className={`${classeCampo} num mt-1`}
              />
            </label>
            <label className="block">
              <span className="text-[0.8125rem] font-medium text-tinta">{copy.afiliado.formCnpj}</span>
              <input
                type="text"
                inputMode="numeric"
                placeholder="00.000.000/0000-00"
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
                className={`${classeCampo} num mt-1`}
              />
            </label>
            {!u.viaGoogle && (
              <label className="block sm:col-span-2">
                <span className="text-[0.8125rem] font-medium text-tinta">
                  {copy.afiliado.conta.senhaRotulo}
                </span>
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className={`${classeCampo} mt-1`}
                />
              </label>
            )}
          </div>
          {erro && (
            <p role="alert" className="text-[0.875rem] font-medium text-erro">
              {erro}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={enviando}
              className="h-11 rounded-[999px] bg-roxo px-6 text-[0.875rem] font-semibold text-white hover:bg-roxo-escuro disabled:opacity-60"
            >
              {enviando ? copy.afiliado.enviando : copy.afiliado.enviar}
            </button>
            <button
              type="button"
              onClick={() => {
                setEtapa("resumo");
                setErro(null);
              }}
              className="h-11 rounded-[999px] border border-linha px-5 text-[0.875rem] font-medium text-grafite hover:border-roxo"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {etapa === "codigo" && (
        <form onSubmit={confirmarCodigo} className="mt-4 space-y-3">
          <p className="text-[0.9375rem] text-grafite">{copy.conta.codigoTexto(u.email)}</p>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
            aria-label={copy.conta.codigoRotulo}
            className="num h-12 w-full max-w-[240px] rounded-[6px] border border-linha bg-white px-3 text-center text-[1.25rem] tracking-[0.4em] outline-none focus:border-violeta"
            autoFocus
          />
          {erro && (
            <p role="alert" className="text-[0.875rem] font-medium text-erro">
              {erro}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={codigo.length !== 6 || enviando}
              className="h-11 rounded-[999px] bg-roxo px-6 text-[0.875rem] font-semibold text-white hover:bg-roxo-escuro disabled:bg-cinza"
            >
              {enviando ? copy.conta.botaoConfirmando : copy.conta.codigoBotao}
            </button>
            <button
              type="button"
              onClick={() => {
                setEtapa("formulario");
                setCodigo("");
                setErro(null);
              }}
              className="h-11 rounded-[999px] border border-linha px-5 text-[0.875rem] font-medium text-grafite hover:border-roxo"
            >
              Voltar
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
