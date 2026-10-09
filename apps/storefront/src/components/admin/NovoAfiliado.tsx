"use client";

/**
 * Cadastro de afiliado feito pelo ADM — sem a pessoa precisar pedir entrada e
 * esperar aprovação. O afiliado já nasce aprovado, com o link pronto, e recebe
 * um e-mail com as instruções.
 */
import { useState } from "react";
import { copy } from "@/lib/copy";
import { cadastrarAfiliadoAdmin } from "@/lib/servidor";

const t = copy.afiliado.admin.novo;

const VAZIO = { nome: "", email: "", whatsapp: "", usuario: "", chavePix: "", cnpj: "", comissaoPct: "10" };

export function NovoAfiliado({ aoCadastrar }: { aoCadastrar: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [campos, setCampos] = useState(VAZIO);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [criado, setCriado] = useState<{ usuario: string; link: string } | null>(null);

  const mudar = (campo: keyof typeof VAZIO) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setCampos((c) => ({ ...c, [campo]: e.target.value }));

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCriado(null);
    setEnviando(true);
    const r = await cadastrarAfiliadoAdmin({
      nome: campos.nome,
      email: campos.email,
      whatsapp: campos.whatsapp,
      usuario: campos.usuario,
      chavePix: campos.chavePix,
      cnpj: campos.cnpj,
      comissaoPct: Number(campos.comissaoPct.replace(",", ".")),
    });
    setEnviando(false);
    if (!r.ok) {
      setErro(r.erro ?? "Não foi possível cadastrar.");
      return;
    }
    setCriado({ usuario: r.usuario ?? "", link: r.link ?? "" });
    setCampos(VAZIO);
    aoCadastrar();
  }

  const rotulo = "text-[0.8125rem] font-medium text-grafite";
  const entrada =
    "mt-1 h-10 w-full rounded-[6px] border border-linha bg-white px-3 text-[0.9375rem] text-tinta outline-none focus:border-roxo";

  return (
    <div className="mb-8">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="rounded-[999px] bg-roxo px-5 py-2.5 text-[0.875rem] font-semibold text-white hover:bg-roxo-escuro"
      >
        {aberto ? t.fechar : t.abrir}
      </button>

      {criado && (
        <div className="mt-3 rounded-[10px] border border-sucesso/40 bg-superficie p-4 text-[0.875rem]" role="status">
          <p className="font-semibold text-sucesso">{t.pronto}</p>
          <p className="mt-2 text-grafite">
            {t.usuarioCriado}: <b className="text-tinta">{criado.usuario}</b>
          </p>
          <p className="mt-1 break-all text-grafite">
            {t.link}: <b className="text-tinta">{criado.link}</b>
          </p>
        </div>
      )}

      {aberto && (
        <form onSubmit={enviar} className="mt-4 rounded-[16px] border border-linha p-5">
          <h3 className="text-[0.9375rem] font-semibold text-tinta">{t.titulo}</h3>
          <p className="mt-1 max-w-[70ch] text-[0.8125rem] text-grafite">{t.texto}</p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className={rotulo}>
              {t.nome}
              <input required value={campos.nome} onChange={mudar("nome")} className={entrada} autoComplete="off" />
            </label>
            <label className={rotulo}>
              {t.email}
              <input
                required
                type="email"
                value={campos.email}
                onChange={mudar("email")}
                className={entrada}
                autoComplete="off"
              />
            </label>
            <label className={rotulo}>
              {t.whatsapp}
              <input
                type="tel"
                value={campos.whatsapp}
                onChange={mudar("whatsapp")}
                className={entrada}
                placeholder="(21) 99999-9999"
              />
            </label>
            <label className={rotulo}>
              {t.comissao}
              <input
                required
                inputMode="decimal"
                value={campos.comissaoPct}
                onChange={mudar("comissaoPct")}
                className={entrada}
              />
            </label>
            <label className={rotulo}>
              {t.usuario}
              <input
                value={campos.usuario}
                onChange={(e) => setCampos((c) => ({ ...c, usuario: e.target.value.toUpperCase() }))}
                className={entrada}
                autoComplete="off"
                aria-describedby="dica-usuario"
              />
              <span id="dica-usuario" className="mt-1 block text-[0.75rem] font-normal text-cinza">
                {t.usuarioDica}
              </span>
            </label>
            <label className={rotulo}>
              {t.chavePix}
              <input value={campos.chavePix} onChange={mudar("chavePix")} className={entrada} autoComplete="off" />
            </label>
            <label className={rotulo}>
              {t.cnpj}
              <input value={campos.cnpj} onChange={mudar("cnpj")} className={entrada} inputMode="numeric" />
            </label>
          </div>

          {erro && (
            <p className="mt-4 text-[0.875rem] text-erro" role="alert">
              {erro}
            </p>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="mt-5 rounded-[999px] bg-roxo px-6 py-2.5 text-[0.9375rem] font-semibold text-white hover:bg-roxo-escuro disabled:opacity-60"
          >
            {enviando ? t.salvando : t.salvar}
          </button>
        </form>
      )}
    </div>
  );
}
