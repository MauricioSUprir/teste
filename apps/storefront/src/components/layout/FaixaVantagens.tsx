"use client";

/**
 * Faixa de vantagens no topo de todas as páginas: cupom, Pix, brinde e
 * parcelas (varejo) ou cadastro de CNPJ e condições (B2B). Só regras que o
 * checkout cumpre de verdade — os textos vêm de copy.header.vantagens.
 *
 * Computador: todas lado a lado. Celular: uma por vez, trocando a cada 5s,
 * com pausa ao tocar/focar e parada total para quem pede menos movimento.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { copy } from "@/lib/copy";

const vantagens = copy.header.vantagens;
const INTERVALO_MS = 5_000;

function Item({ destaque, texto, link }: (typeof vantagens)[number]) {
  const conteudo = (
    <>
      <span className="shrink-0 whitespace-nowrap rounded-[999px] border border-dashed border-white/60 px-2 py-0.5 text-[0.75rem] font-bold tracking-wide">
        {destaque}
      </span>
      <span className="text-[0.8125rem] leading-tight">{texto}</span>
    </>
  );
  return link ? (
    <Link href={link} className="inline-flex items-center gap-2 hover:underline">
      {conteudo}
    </Link>
  ) : (
    <span className="inline-flex items-center gap-2">{conteudo}</span>
  );
}

export function FaixaVantagens() {
  const [atual, setAtual] = useState(0);
  const [pausado, setPausado] = useState(false);

  useEffect(() => {
    if (pausado || vantagens.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setAtual((a) => (a + 1) % vantagens.length), INTERVALO_MS);
    return () => clearInterval(id);
  }, [pausado]);

  return (
    <div className="bg-tinta text-white" aria-label={copy.header.vantagensRotulo} role="region">
      {/* computador: todas lado a lado */}
      <ul className="container-bn hidden h-10 items-center justify-center gap-x-8 md:flex">
        {vantagens.map((v) => (
          <li key={v.destaque}>
            <Item {...v} />
          </li>
        ))}
      </ul>

      {/* celular: uma por vez */}
      {/* altura fixa para duas linhas: frase longa (B2B) cabe, e a faixa não
          muda de tamanho a cada troca — senão empurraria a página toda */}
      <div
        className="flex h-12 items-center justify-center px-4 text-center md:hidden"
        onPointerEnter={() => setPausado(true)}
        onPointerLeave={() => setPausado(false)}
        onFocus={() => setPausado(true)}
        onBlur={() => setPausado(false)}
      >
        <Item {...vantagens[atual]} />
      </div>
    </div>
  );
}
