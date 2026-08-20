"use client";

import { useState } from "react";
import Link from "next/link";
import { copy } from "@/lib/copy";
import { comBase } from "@/lib/caminho";
import { categorias, marcas, necessidades } from "@/lib/catalogo/consultas";
import { useCarrinho } from "@/lib/carrinho/contexto";
import { useConta } from "@/lib/conta/contexto";
import { Logo } from "./Logo";
import { BuscaHeader } from "./BuscaHeader";

/** Header + megamenu (categoria/marca/necessidade) — ticket 2.1. */
export function Header() {
  const { totalItens, abrir } = useCarrinho();
  const { usuario } = useConta();
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);
  const rotuloConta = usuario ? usuario.nome.split(" ")[0] : copy.conta.entrar;

  return (
    <header className="sticky top-0 z-40 border-b border-linha bg-white">
      {/* barra de anúncio */}
      <p className="bg-tinta px-4 py-1.5 text-center text-[0.75rem] font-medium text-white">
        {copy.header.anuncio}
      </p>

      <div className="container-bn flex h-16 items-center gap-4">
        {/* menu mobile */}
        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded-[6px] hover:bg-superficie lg:hidden"
          aria-label={menuMobileAberto ? copy.header.fecharMenu : copy.header.menu}
          aria-expanded={menuMobileAberto}
          onClick={() => setMenuMobileAberto((v) => !v)}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
            {menuMobileAberto ? (
              <path d="M4 4 L16 16 M16 4 L4 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            ) : (
              <path d="M3 5 H17 M3 10 H17 M3 15 H17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            )}
          </svg>
        </button>

        <Link href="/" aria-label="BeautyNow — página inicial" className="shrink-0">
          <Logo />
        </Link>

        <div className="hidden grow justify-center md:flex">
          <BuscaHeader />
        </div>

        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <Link
            href="/conta"
            className="flex h-11 items-center gap-2 rounded-[6px] px-3 text-[0.875rem] text-grafite hover:bg-superficie"
            aria-label={rotuloConta}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <circle cx="9" cy="6" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <path d="M3 15.5 a6 6 0 0 1 12 0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span className="hidden sm:inline">{rotuloConta}</span>
          </Link>
          <button
            type="button"
            onClick={abrir}
            className="relative flex h-11 items-center gap-2 rounded-[6px] px-3 text-[0.875rem] text-grafite hover:bg-superficie"
            aria-label={`${copy.header.sacola}${totalItens > 0 ? `, ${totalItens} itens` : ""}`}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path d="M3.5 6 H14.5 L13.6 15.2 a1.5 1.5 0 0 1 -1.5 1.3 H5.9 a1.5 1.5 0 0 1 -1.5 -1.3 Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M6.2 6 V5 a2.8 2.8 0 0 1 5.6 0 V6" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <span className="hidden sm:inline">{copy.header.sacola}</span>
            {totalItens > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-[999px] bg-roxo px-1 text-[0.6875rem] font-semibold text-white num">
                {totalItens}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* busca mobile */}
      <div className="container-bn pb-3 md:hidden">
        <BuscaHeader />
      </div>

      {/* megamenu desktop */}
      <nav aria-label="Navegação principal" className="hidden border-t border-linha lg:block">
        <div className="container-bn flex items-center gap-1">
          <Link
            href="/"
            className="flex h-12 items-center px-3 text-[0.9375rem] font-medium text-tinta hover:text-roxo"
          >
            {copy.nav.inicio}
          </Link>
          <div className="group relative">
            <button
              type="button"
              className="flex h-12 items-center gap-1.5 px-3 text-[0.9375rem] font-medium text-tinta hover:text-roxo"
              aria-haspopup="true"
            >
              {copy.nav.categorias}
              <Seta />
            </button>
            <MegaPainel>
              <div className="grid grid-cols-3 gap-x-8 gap-y-2">
                {categorias.map((c) => (
                  <Link
                    key={c.slug}
                    href={`/categoria/${c.slug}`}
                    className="rounded-[6px] px-3 py-2 hover:bg-superficie"
                  >
                    <span className="block text-[0.9375rem] font-medium text-tinta">{c.nome}</span>
                    <span className="mt-0.5 block text-[0.8125rem] leading-snug text-cinza">
                      {c.descricao}
                    </span>
                  </Link>
                ))}
              </div>
            </MegaPainel>
          </div>

          <div className="group relative">
            <button
              type="button"
              className="flex h-12 items-center gap-1.5 px-3 text-[0.9375rem] font-medium text-tinta hover:text-roxo"
              aria-haspopup="true"
            >
              {copy.nav.marcas}
              <Seta />
            </button>
            <MegaPainel>
              <div className="grid grid-cols-3 gap-1">
                {marcas.slice(0, 15).map((m) => (
                  <Link
                    key={m.slug}
                    href={`/marca/${m.slug}`}
                    className="flex items-center gap-2 rounded-[6px] px-3 py-2 text-[0.9375rem] text-tinta hover:bg-superficie"
                  >
                    {m.logo ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={comBase(m.logo)}
                        alt=""
                        aria-hidden="true"
                        loading="lazy"
                        className="h-5 w-5 shrink-0 rounded-[4px] object-contain"
                      />
                    ) : (
                      <span
                        aria-hidden="true"
                        className="inline-block h-2.5 w-2.5 rounded-full"
                        style={{ background: m.cor }}
                      />
                    )}
                    {m.nome}
                  </Link>
                ))}
              </div>
              <Link
                href="/marcas"
                className="mt-2 block rounded-[6px] px-3 py-2 text-[0.9375rem] font-semibold text-violeta hover:bg-superficie"
              >
                {copy.nav.todasMarcas} →
              </Link>
            </MegaPainel>
          </div>

          {necessidades.length > 0 && (
          <div className="group relative">
            <button
              type="button"
              className="flex h-12 items-center gap-1.5 px-3 text-[0.9375rem] font-medium text-tinta hover:text-roxo"
              aria-haspopup="true"
            >
              {copy.nav.necessidades}
              <Seta />
            </button>
            <MegaPainel>
              <div className="grid grid-cols-2 gap-1">
                {necessidades.map((n) => (
                  <Link
                    key={n.slug}
                    href={`/necessidade/${n.slug}`}
                    className="rounded-[6px] px-3 py-2 text-[0.9375rem] text-tinta hover:bg-superficie"
                  >
                    {n.nome}
                  </Link>
                ))}
              </div>
            </MegaPainel>
          </div>
          )}

          {categorias.slice(0, 4).map((c) => (
            <Link
              key={c.slug}
              href={`/categoria/${c.slug}`}
              className="flex h-12 items-center px-3 text-[0.9375rem] text-grafite hover:text-roxo"
            >
              {c.nome}
            </Link>
          ))}
        </div>
      </nav>

      {/* drawer de navegação mobile */}
      {menuMobileAberto && (
        <nav
          aria-label="Navegação principal"
          className="border-t border-linha bg-white pb-4 lg:hidden"
        >
          <div className="container-bn flex flex-col gap-4 pt-3">
            <Link
              href="/conta"
              onClick={() => setMenuMobileAberto(false)}
              className="flex items-center gap-2.5 rounded-[10px] bg-roxo-claro px-3 py-3 text-[0.9375rem] font-semibold text-roxo"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <circle cx="9" cy="6" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <path d="M3 15.5 a6 6 0 0 1 12 0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              {usuario ? `${copy.conta.ola(usuario.nome)} Ver minha conta` : `${copy.conta.entrar} ou criar conta`}
            </Link>
            <Link
              href="/"
              onClick={() => setMenuMobileAberto(false)}
              className="block rounded-[6px] px-2 py-2.5 text-[0.9375rem] font-semibold text-tinta hover:bg-superficie"
            >
              {copy.nav.inicio}
            </Link>
            <div>
              <p className="pb-1 text-[0.75rem] font-semibold uppercase tracking-wide text-cinza">
                {copy.nav.categorias}
              </p>
              {categorias.map((c) => (
                <Link
                  key={c.slug}
                  href={`/categoria/${c.slug}`}
                  onClick={() => setMenuMobileAberto(false)}
                  className="block rounded-[6px] px-2 py-2.5 text-[0.9375rem] text-tinta hover:bg-superficie"
                >
                  {c.nome}
                </Link>
              ))}
            </div>
            <div>
              <p className="pb-1 text-[0.75rem] font-semibold uppercase tracking-wide text-cinza">
                {copy.nav.marcas}
              </p>
              {marcas.slice(0, 15).map((m) => (
                <Link
                  key={m.slug}
                  href={`/marca/${m.slug}`}
                  onClick={() => setMenuMobileAberto(false)}
                  className="block rounded-[6px] px-2 py-2.5 text-[0.9375rem] text-tinta hover:bg-superficie"
                >
                  {m.nome}
                </Link>
              ))}
              <Link
                href="/marcas"
                onClick={() => setMenuMobileAberto(false)}
                className="block rounded-[6px] px-2 py-2.5 text-[0.9375rem] font-semibold text-violeta hover:bg-superficie"
              >
                {copy.nav.todasMarcas} →
              </Link>
            </div>
            {necessidades.length > 0 && (
            <div>
              <p className="pb-1 text-[0.75rem] font-semibold uppercase tracking-wide text-cinza">
                {copy.nav.necessidades}
              </p>
              {necessidades.map((n) => (
                <Link
                  key={n.slug}
                  href={`/necessidade/${n.slug}`}
                  onClick={() => setMenuMobileAberto(false)}
                  className="block rounded-[6px] px-2 py-2.5 text-[0.9375rem] text-tinta hover:bg-superficie"
                >
                  {n.nome}
                </Link>
              ))}
            </div>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}

function Seta() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <path d="M2 3.5 L5 6.5 L8 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MegaPainel({ children }: { children: React.ReactNode }) {
  return (
    <div className="invisible absolute left-0 top-full z-50 w-max min-w-[520px] rounded-b-[10px] border border-t-0 border-linha bg-white p-4 opacity-0 shadow-card transition-opacity duration-150 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
      {children}
    </div>
  );
}
