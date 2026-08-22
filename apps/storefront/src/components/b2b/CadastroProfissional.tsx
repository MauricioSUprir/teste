"use client";

/**
 * Cadastro profissional da Be2Beauty — formulário de CNPJ e painel de
 * situação. Aprovação acontece no painel do admin; aqui o profissional
 * acompanha e, quando aprovado, os preços liberam neste navegador.
 */
import { useState } from "react";
import { copy } from "@/lib/copy";
import { useB2B } from "@/lib/b2b/contexto";
import { cadastrarB2B } from "@/lib/servidor";

/** validação oficial de CNPJ (mesma regra do servidor) */
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

function formatarCnpj(valor: string): string {
  const d = valor.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

const classeCampo =
  "h-12 w-full rounded-[6px] border border-linha bg-white px-3 text-[0.9375rem] outline-none focus:border-violeta";

export function CadastroProfissional() {
  const { status, cnpj, registrar, verificar, limpar } = useB2B();
  const [form, setForm] = useState({ cnpj: "", razao: "", nome: "", email: "", whatsapp: "" });
  const [enviando, setEnviando] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const digitos = form.cnpj.replace(/\D/g, "");
    if (!cnpjValido(digitos)) {
      setErro(copy.b2b.cnpjInvalido);
      return;
    }
    setEnviando(true);
    const resultado = await cadastrarB2B({ ...form, cnpj: digitos });
    setEnviando(false);
    if (!resultado.ok) {
      setErro(resultado.erro ?? copy.b2b.falha);
      return;
    }
    registrar(digitos, resultado.status ?? "pendente");
    setEnviado(true);
  }

  // já tem CNPJ neste navegador → painel de situação
  if (cnpj) {
    return (
      <div className="rounded-[16px] border border-linha bg-superficie p-6">
        <h2 className="font-titulo text-[1.25rem] font-semibold text-tinta">
          {copy.b2b.statusTitulo}
        </h2>
        {enviado && (
          <p role="status" className="mt-2 text-[0.9375rem] font-medium text-sucesso">
            {copy.b2b.enviadoOk}
          </p>
        )}
        <p className="num mt-3 text-[0.9375rem] text-grafite">CNPJ {formatarCnpj(cnpj)}</p>
        <p className="mt-2 text-[1.0625rem] font-semibold text-tinta" aria-live="polite">
          {status === "aprovado"
            ? copy.b2b.statusAprovado
            : status === "recusado"
              ? copy.b2b.statusRecusado
              : copy.b2b.statusPendente}
        </p>
        {status !== "aprovado" && (
          <p className="mt-1 text-[0.875rem] text-grafite">
            {status === "recusado" ? copy.b2b.recusado : copy.b2b.aguardandoAprovacao}
          </p>
        )}
        <div className="mt-5 flex flex-wrap gap-3">
          {status !== "aprovado" && (
            <button
              type="button"
              disabled={verificando}
              onClick={async () => {
                setVerificando(true);
                await verificar();
                setVerificando(false);
              }}
              className="h-11 rounded-[999px] bg-roxo px-5 text-[0.875rem] font-semibold text-white hover:bg-roxo-escuro disabled:opacity-60"
            >
              {verificando ? "Verificando…" : copy.b2b.verificarNovamente}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              limpar();
              setEnviado(false);
            }}
            className="h-11 rounded-[999px] border border-linha px-5 text-[0.875rem] font-medium text-grafite hover:border-roxo"
          >
            {copy.b2b.trocarCnpj}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="rounded-[16px] border border-linha p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="text-[0.875rem] font-medium text-tinta">{copy.b2b.cnpj}</span>
          <input
            type="text"
            inputMode="numeric"
            required
            placeholder="00.000.000/0000-00"
            value={form.cnpj}
            onChange={(e) => setForm({ ...form, cnpj: formatarCnpj(e.target.value) })}
            className={`${classeCampo} num mt-1`}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-[0.875rem] font-medium text-tinta">{copy.b2b.razaoSocial}</span>
          <input
            type="text"
            required
            value={form.razao}
            onChange={(e) => setForm({ ...form, razao: e.target.value })}
            className={`${classeCampo} mt-1`}
          />
        </label>
        <label className="block">
          <span className="text-[0.875rem] font-medium text-tinta">{copy.b2b.nomeResponsavel}</span>
          <input
            type="text"
            required
            autoComplete="name"
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            className={`${classeCampo} mt-1`}
          />
        </label>
        <label className="block">
          <span className="text-[0.875rem] font-medium text-tinta">{copy.b2b.whatsapp}</span>
          <input
            type="tel"
            required
            autoComplete="tel"
            inputMode="tel"
            placeholder="(21) 99999-9999"
            value={form.whatsapp}
            onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
            className={`${classeCampo} num mt-1`}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-[0.875rem] font-medium text-tinta">{copy.b2b.email}</span>
          <input
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            placeholder="voce@empresa.com.br"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className={`${classeCampo} mt-1`}
          />
        </label>
      </div>
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
        {enviando ? copy.b2b.enviando : copy.b2b.enviar}
      </button>
      {enviando && (
        <p className="mt-2 text-[0.8125rem] text-cinza">{copy.conta.aguardeServidor}</p>
      )}
    </form>
  );
}
