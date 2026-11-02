"use client";

/**
 * Aviso de cookies (LGPD, docs/08): granular — necessários (sempre ligados),
 * desempenho (medição da navegação no PostHog) e marketing (nenhum script por
 * enquanto) — com "recusar" tão fácil quanto "aceitar". Nada de medição
 * carrega antes da escolha. Reabre pelo link "Preferências de cookies" do
 * rodapé (evento EVENTO_ABRIR_COOKIES).
 */
import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { copy } from "@/lib/copy";
import { gravarConsentimento, lerConsentimento } from "@/lib/rastreio";

export const EVENTO_ABRIR_COOKIES = "bn:abrir-cookies";
const t = copy.cookies;

export function AvisoCookies() {
  const [aberto, setAberto] = useState(false);
  const [detalhes, setDetalhes] = useState(false);
  const [desempenho, setDesempenho] = useState(true);
  const [marketing, setMarketing] = useState(false);
  const id = useId();

  useEffect(() => {
    // primeira visita (ou escolha apagada): pergunta; depois só pelo rodapé
    if (!lerConsentimento()) setAberto(true);
    const abrir = () => {
      const c = lerConsentimento();
      setDesempenho(c?.desempenho ?? true);
      setMarketing(c?.marketing ?? false);
      setDetalhes(true);
      setAberto(true);
    };
    window.addEventListener(EVENTO_ABRIR_COOKIES, abrir);
    return () => window.removeEventListener(EVENTO_ABRIR_COOKIES, abrir);
  }, []);

  if (!aberto) return null;

  const escolher = (d: boolean, m: boolean) => {
    gravarConsentimento(d, m);
    setAberto(false);
  };

  return (
    <section
      role="region"
      aria-labelledby={`${id}-titulo`}
      className="fixed inset-x-3 bottom-3 z-[90] mx-auto max-w-[760px] rounded-[12px] border border-linha bg-white p-4 shadow-[0_10px_40px_rgba(33,33,33,0.18)] sm:p-5"
    >
      <h2 id={`${id}-titulo`} className="font-titulo text-[1rem] font-semibold text-tinta">
        {t.titulo}
      </h2>
      <p className="mt-1 text-[0.8125rem] leading-relaxed text-grafite">
        {t.texto}{" "}
        <Link href="/institucional/politica-de-privacidade" className="font-medium text-violeta underline">
          {t.politica}
        </Link>
      </p>

      {detalhes && (
        <fieldset className="mt-3 space-y-2 border-t border-linha pt-3">
          <legend className="sr-only">{t.personalizar}</legend>
          <label className="flex items-start gap-2.5 text-[0.8125rem] text-grafite">
            <input type="checkbox" checked disabled className="mt-0.5 h-4 w-4 accent-[var(--color-roxo)]" />
            <span>
              <strong className="text-tinta">{t.necessarios.titulo}</strong> — {t.necessarios.texto}
            </span>
          </label>
          <label className="flex items-start gap-2.5 text-[0.8125rem] text-grafite">
            <input
              type="checkbox"
              checked={desempenho}
              onChange={(e) => setDesempenho(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[var(--color-roxo)]"
            />
            <span>
              <strong className="text-tinta">{t.desempenho.titulo}</strong> — {t.desempenho.texto}
            </span>
          </label>
          <label className="flex items-start gap-2.5 text-[0.8125rem] text-grafite">
            <input
              type="checkbox"
              checked={marketing}
              onChange={(e) => setMarketing(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[var(--color-roxo)]"
            />
            <span>
              <strong className="text-tinta">{t.marketing.titulo}</strong> — {t.marketing.texto}
            </span>
          </label>
        </fieldset>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {detalhes ? (
          <button
            type="button"
            onClick={() => escolher(desempenho, marketing)}
            className="h-10 rounded-[40px] bg-roxo px-5 text-[0.8125rem] font-semibold text-white hover:bg-roxo-escuro"
          >
            {t.salvar}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => escolher(true, true)}
            className="h-10 rounded-[40px] bg-roxo px-5 text-[0.8125rem] font-semibold text-white hover:bg-roxo-escuro"
          >
            {t.aceitar}
          </button>
        )}
        <button
          type="button"
          onClick={() => escolher(false, false)}
          className="h-10 rounded-[40px] border border-tinta px-5 text-[0.8125rem] font-semibold text-tinta hover:bg-superficie"
        >
          {t.recusar}
        </button>
        {!detalhes && (
          <button
            type="button"
            onClick={() => setDetalhes(true)}
            className="h-10 px-2 text-[0.8125rem] font-medium text-grafite underline"
          >
            {t.personalizar}
          </button>
        )}
      </div>
    </section>
  );
}

/** botão do rodapé que reabre as preferências */
export function BotaoPreferenciasCookies({ className = "" }: { className?: string }) {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event(EVENTO_ABRIR_COOKIES))} className={className}>
      {t.preferencias}
    </button>
  );
}
