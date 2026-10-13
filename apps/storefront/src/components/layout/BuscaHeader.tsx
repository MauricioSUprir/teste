"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useB2B } from "@/lib/b2b/contexto";
import { buscar, obterMarca } from "@/lib/catalogo/consultas";
import { formatarPreco, precoPix } from "@/lib/preco";
import { copy } from "@/lib/copy";
import { ImagemProduto } from "@/components/produto/ImagemProduto";

/** Busca com autocomplete (produto, marca, preço) — ticket 2.5. */
export function BuscaHeader() {
  const { liberado } = useB2B();
  const [termo, setTermo] = useState("");
  const [focado, setFocado] = useState(false);
  const [indiceAtivo, setIndiceAtivo] = useState(-1);
  const router = useRouter();
  const raiz = useRef<HTMLDivElement>(null);

  const sugestoes = useMemo(() => (termo.length >= 2 ? buscar(termo).slice(0, 5) : []), [termo]);
  const aberto = focado && sugestoes.length > 0;

  useEffect(() => {
    function aoClicarFora(e: MouseEvent) {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setFocado(false);
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, []);

  function irParaBusca() {
    if (!termo.trim()) return;
    setFocado(false);
    router.push(`/busca?q=${encodeURIComponent(termo.trim())}`);
  }

  function aoTeclar(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndiceAtivo((i) => Math.min(i + 1, sugestoes.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndiceAtivo((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      if (indiceAtivo >= 0 && sugestoes[indiceAtivo]) {
        setFocado(false);
        router.push(`/produto/${sugestoes[indiceAtivo].slug}`);
      } else {
        irParaBusca();
      }
    } else if (e.key === "Escape") {
      setFocado(false);
    }
  }

  return (
    <div ref={raiz} className="relative w-full max-w-2xl">
      {/* design system: campo cinza claro, raio 8, lupa à direita (é o botão
          de buscar) — sem borda, a borda só aparece no foco */}
      <div className="flex items-center rounded-[8px] border border-transparent bg-campo pl-4 focus-within:border-violeta">
        <input
          type="search"
          role="combobox"
          aria-expanded={aberto}
          aria-controls="busca-sugestoes"
          aria-label={copy.header.busca}
          placeholder={copy.header.busca}
          value={termo}
          onChange={(e) => {
            setTermo(e.target.value);
            setIndiceAtivo(-1);
          }}
          onFocus={() => setFocado(true)}
          onKeyDown={aoTeclar}
          className="h-11 w-full bg-transparent text-[1rem] text-tinta outline-none placeholder:text-grafite"
        />
        <button
          type="button"
          onClick={irParaBusca}
          aria-label={copy.header.buscar}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px] text-tinta hover:text-roxo"
        >
          <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="7" cy="7" r="5.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M11 11 L15 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {aberto && (
        <div
          id="busca-sugestoes"
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-[8px] border border-linha bg-white shadow-drawer"
        >
          <p className="px-4 pb-1 pt-3 text-[0.75rem] font-medium uppercase tracking-wide text-cinza">
            {copy.busca.sugestoes}
          </p>
          <ul>
            {sugestoes.map((p, i) => {
              const marca = obterMarca(p.marca);
              return (
                <li key={p.slug} role="option" aria-selected={i === indiceAtivo}>
                  <Link
                    href={`/produto/${p.slug}`}
                    onClick={() => setFocado(false)}
                    className={`flex items-center gap-3 px-4 py-2 ${
                      i === indiceAtivo ? "bg-superficie" : "hover:bg-superficie"
                    }`}
                  >
                    <span className="w-12 shrink-0 overflow-hidden rounded-[4px] border border-linha">
                      <ImagemProduto produto={p} alt="" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[0.875rem] text-tinta">{p.titulo}</span>
                      <span className="block text-[0.75rem] text-cinza">
                        {marca?.nome}
                        {liberado && (
                          <>
                            {" · "}
                            <span className="num font-medium text-sucesso">
                              {formatarPreco(precoPix(p.variantes[0].precoPor))} no Pix
                            </span>
                          </>
                        )}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={irParaBusca}
            className="block w-full border-t border-linha px-4 py-3 text-left text-[0.875rem] font-medium text-violeta hover:bg-superficie"
          >
            {copy.busca.verTodos} →
          </button>
        </div>
      )}
    </div>
  );
}
