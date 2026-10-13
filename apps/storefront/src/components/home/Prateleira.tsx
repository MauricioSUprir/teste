"use client";

/**
 * Carrossel de cards da home (design system, "Paginação de carrossel"):
 * rolagem lateral com encaixe, setas quadradas de borda azul e raio 4 no
 * computador. No celular é o dedo que arrasta — as setas somem.
 */
import { useEffect, useRef, useState } from "react";
import { copy } from "@/lib/copy";

export function Prateleira({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  const trilho = useRef<HTMLUListElement>(null);
  const [inicio, setInicio] = useState(true);
  const [fim, setFim] = useState(false);

  useEffect(() => {
    const el = trilho.current;
    if (!el) return;
    const medir = () => {
      setInicio(el.scrollLeft <= 4);
      setFim(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
    };
    medir();
    el.addEventListener("scroll", medir, { passive: true });
    window.addEventListener("resize", medir);
    return () => {
      el.removeEventListener("scroll", medir);
      window.removeEventListener("resize", medir);
    };
  }, []);

  const rolar = (sentido: 1 | -1) => {
    const el = trilho.current;
    if (!el) return;
    const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: sentido * el.clientWidth * 0.9, behavior: reduzir ? "auto" : "smooth" });
  };

  return (
    <div className="relative">
      <ul
        ref={trilho}
        aria-label={rotulo}
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-2 [scrollbar-width:none] md:mx-0 md:scroll-px-0 md:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </ul>
      <div className="mt-4 hidden justify-center gap-2 md:flex">
        <SetaPrateleira sentido={-1} desativada={inicio} aoClicar={() => rolar(-1)} />
        <SetaPrateleira sentido={1} desativada={fim} aoClicar={() => rolar(1)} />
      </div>
    </div>
  );
}

/** cada card da prateleira: largura do doc (264px) no computador, ~meia tela no celular */
export function ItemPrateleira({ children }: { children: React.ReactNode }) {
  return <li className="flex w-[calc(50%-6px)] shrink-0 snap-start sm:w-[240px] lg:w-[264px]">{children}</li>;
}

function SetaPrateleira({
  sentido,
  desativada,
  aoClicar,
}: {
  sentido: 1 | -1;
  desativada: boolean;
  aoClicar: () => void;
}) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      disabled={desativada}
      aria-label={sentido === 1 ? copy.home.prateleiraProxima : copy.home.prateleiraAnterior}
      className="flex h-9 w-9 items-center justify-center rounded-[4px] border border-violeta bg-white text-violeta hover:bg-violeta-claro disabled:border-linha disabled:text-cinza disabled:hover:bg-white"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
        <path
          d={sentido === -1 ? "M9 2 L4 7 L9 12" : "M5 2 L10 7 L5 12"}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
