"use client";

/**
 * Faixa promocional do topo (design system, "Topbar promocional"): faixa
 * baixa, fundo branco, UMA mensagem por vez no centro, em caixa alta peso 900
 * com o gradiente da marca, girando sozinha.
 *
 * As mensagens são regras que o checkout cumpre de verdade (cupom, Pix,
 * brinde, parcelas — ou cadastro de CNPJ no B2B): vêm de copy.header.vantagens.
 * Pausa com o mouse/foco em cima e não gira para quem pede menos movimento.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { copy } from "@/lib/copy";

const vantagens = copy.header.vantagens;
const INTERVALO_MS = 5_000;

export function FaixaVantagens() {
  const [atual, setAtual] = useState(0);
  const [pausado, setPausado] = useState(false);

  useEffect(() => {
    if (pausado || vantagens.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setAtual((a) => (a + 1) % vantagens.length), INTERVALO_MS);
    return () => clearInterval(id);
  }, [pausado]);

  const v = vantagens[atual];
  const texto = (
    <>
      <span className="font-black">{v.destaque}</span> <span className="font-bold">{v.texto}</span>
    </>
  );

  return (
    <div
      role="region"
      aria-label={copy.header.vantagensRotulo}
      className="border-b border-linha bg-white"
      onPointerEnter={() => setPausado(true)}
      onPointerLeave={() => setPausado(false)}
      onFocus={() => setPausado(true)}
      onBlur={() => setPausado(false)}
    >
      {/* altura fixa: no celular a frase longa do B2B quebra em duas linhas
          sem a faixa mudar de tamanho a cada troca (senão empurra a página) */}
      <div className="container-bn flex h-10 items-center justify-center text-center md:h-8">
        <p className="texto-gradiente text-[0.6875rem] uppercase leading-tight tracking-wide md:text-[0.8125rem]">
          {v.link ? (
            <Link href={v.link} className="hover:underline">
              {texto}
            </Link>
          ) : (
            texto
          )}
        </p>
      </div>
    </div>
  );
}
