"use client";

/**
 * Efeito "vidro" — os momentos de "deu certo" do site.
 *
 * Cartão escuro translúcido sobre uma luz que flui nas cores da loja (com um
 * toque dourado), escudo que acende em verde e check que se desenha.
 *
 * - <Celebracao />: montada uma vez no layout. Quando alguém chama
 *   celebrar("codigo" | "pagamento"), o cartão aparece por cima da página e
 *   some sozinho (ou ao tocar, Esc ou no botão). Fica no layout para seguir
 *   na tela enquanto a página troca por baixo (login → minha conta).
 * - <PalcoVidro> / <CartaoVidro>: o mesmo visual dentro da página.
 * - <EscudoVidro>: o selo do escudo (aguardando ou verificado).
 * - <CheckAnimado>: check pequeno para botões e avisos de sucesso.
 *
 * Tudo em CSS (globals.css, seção "Efeito vidro"), só transform e opacity
 * animam; quem pede menos movimento no sistema vê tudo parado.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { copy } from "@/lib/copy";

export type TipoCelebracao = keyof typeof copy.celebracao.tipos;

const EVENTO = "bn:celebrar";
const DURACAO_MS = 3000;
const SAIDA_MS = 220;

/**
 * Mostra o cartão de sucesso por cima da página. Vai no próximo tique: quem
 * chama ao abrir a página roda antes de a <Celebracao /> do layout ouvir.
 */
export function celebrar(tipo: TipoCelebracao) {
  window.setTimeout(() => window.dispatchEvent(new CustomEvent<TipoCelebracao>(EVENTO, { detail: tipo })), 0);
}

/** cantos em "L" do cartão (detalhe de vidro técnico) */
function Cantos() {
  return (
    <>
      <span aria-hidden="true" className="vidro-canto vidro-canto-1" />
      <span aria-hidden="true" className="vidro-canto vidro-canto-2" />
      <span aria-hidden="true" className="vidro-canto vidro-canto-3" />
      <span aria-hidden="true" className="vidro-canto vidro-canto-4" />
    </>
  );
}

export function PalcoVidro({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`vidro-palco ${className}`}>{children}</div>;
}

export function CartaoVidro({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`vidro-cartao ${className}`}>
      <Cantos />
      {children}
    </div>
  );
}

/** escudo: lilás com cadeado enquanto espera; verde com check quando confirma */
export function EscudoVidro({ estado }: { estado: "aguardando" | "ok" }) {
  return (
    <span aria-hidden="true" className={`vidro-escudo ${estado === "ok" ? "vidro-escudo-ok" : ""}`}>
      <svg viewBox="0 0 48 48" width="40" height="40" fill="none">
        <path d="M24 4.5 39.5 10v11.5c0 10.4-6.6 18.4-15.5 22-8.9-3.6-15.5-11.6-15.5-22V10Z" className="vidro-escudo-forma" />
        {estado === "ok" ? (
          <path d="m16.8 24.4 5 5 9.6-10.6" pathLength={1} className="vidro-traco" />
        ) : (
          <g className="vidro-cadeado">
            <rect x="17.5" y="21.5" width="13" height="10" rx="2.2" />
            <path d="M20.5 21.5v-3a3.5 3.5 0 0 1 7 0v3" />
          </g>
        )}
      </svg>
    </span>
  );
}

/** check pequeno que se desenha (herda a cor do texto) */
export function CheckAnimado({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className={`check-animado ${className}`}>
      <circle cx="12" cy="12" r="10" pathLength={1} className="check-animado-aro" />
      <path d="m7.6 12.4 3 3 5.8-6.4" pathLength={1} className="check-animado-traco" />
    </svg>
  );
}

function IconeEscudo() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.5 20 5.5v6c0 5.2-3.4 9.2-8 11-4.6-1.8-8-5.8-8-11v-6Z" />
      <path d="m8.6 12.2 2.4 2.4 4.6-5" />
    </svg>
  );
}

export function Celebracao() {
  const [tipo, setTipo] = useState<TipoCelebracao | null>(null);
  const [saindo, setSaindo] = useState(false);
  // muda a cada chamada: remonta o cartão para a animação começar do zero
  const [vez, setVez] = useState(0);
  const botao = useRef<HTMLButtonElement>(null);
  const focoAntes = useRef<HTMLElement | null>(null);

  const fechar = useCallback(() => setSaindo(true), []);

  useEffect(() => {
    const ouvir = (e: Event) => {
      const novo = (e as CustomEvent<TipoCelebracao>).detail;
      if (!(novo in copy.celebracao.tipos)) return;
      focoAntes.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setSaindo(false);
      setTipo(novo);
      setVez((v) => v + 1);
    };
    window.addEventListener(EVENTO, ouvir);
    return () => window.removeEventListener(EVENTO, ouvir);
  }, []);

  // aberto: foco no botão, Esc fecha e some sozinho depois de alguns segundos
  useEffect(() => {
    if (!tipo || saindo) return;
    botao.current?.focus({ preventScroll: true });
    const tempo = setTimeout(fechar, DURACAO_MS);
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") fechar();
    };
    window.addEventListener("keydown", tecla);
    return () => {
      clearTimeout(tempo);
      window.removeEventListener("keydown", tecla);
    };
  }, [tipo, saindo, vez, fechar]);

  // saindo: espera o fade e devolve o foco para onde estava (se ainda existir)
  useEffect(() => {
    if (!saindo) return;
    const tempo = setTimeout(() => {
      setTipo(null);
      setSaindo(false);
      const antes = focoAntes.current;
      if (antes?.isConnected) antes.focus({ preventScroll: true });
    }, SAIDA_MS);
    return () => clearTimeout(tempo);
  }, [saindo]);

  if (!tipo) return null;
  const t = copy.celebracao.tipos[tipo];

  return (
    <div
      key={vez}
      className={`vidro-palco vidro-overlay fixed inset-0 z-[100] flex items-center justify-center p-4 ${saindo ? "vidro-sair" : ""}`}
      onClick={fechar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="celebracao-titulo"
        aria-describedby="celebracao-texto"
        className="vidro-cartao vidro-entrar w-full max-w-[380px] px-6 pb-6 pt-8 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <Cantos />
        <EscudoVidro estado="ok" />
        <h2 id="celebracao-titulo" className="font-titulo mt-5 text-[1.5rem] font-semibold leading-tight text-white">
          {t.titulo} <span className="vidro-gradiente">{t.destaque}</span>
        </h2>
        <p id="celebracao-texto" className="mx-auto mt-2 max-w-[30ch] text-[0.9375rem] text-[#E4E1EC]">
          {t.texto}
        </p>
        <span aria-hidden="true" className="vidro-caixa mx-auto mt-5">
          <svg viewBox="0 0 40 40" width="34" height="34" fill="none">
            <path d="m11 20.5 6 6 12-13" pathLength={1} className="vidro-traco vidro-traco-tarde" />
          </svg>
        </span>
        <p className="mt-4 text-[0.8125rem] text-[#CFCADB]">{t.nota}</p>
        <button ref={botao} type="button" onClick={fechar} className="vidro-botao mt-5">
          <IconeEscudo />
          {t.botao}
        </button>
      </div>
    </div>
  );
}
