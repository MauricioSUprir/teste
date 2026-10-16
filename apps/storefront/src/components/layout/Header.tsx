"use client";

import { useState } from "react";
import Link from "next/link";
import { copy } from "@/lib/copy";
import { LOJA, LOJA_ID } from "@/lib/loja";
import { comBase } from "@/lib/caminho";
import { categorias, marcas, necessidades } from "@/lib/catalogo/consultas";
import { useCarrinho } from "@/lib/carrinho/contexto";
import { useConta } from "@/lib/conta/contexto";
import { useFavoritos } from "@/lib/favoritos/contexto";
import { NEGOCIO, linkWhatsapp } from "@/lib/negocio";
import { Logo } from "./Logo";
import { BuscaHeader } from "./BuscaHeader";
import { FaixaVantagens } from "./FaixaVantagens";

const atalhos = copy.header.atalhos;
/** motoboy em 1 dia útil é só no Rio — a Bradeco atende SP */
const entregaNoRio = LOJA_ID !== "bradeco";

/**
 * Topo em quatro camadas — ticket 2.1, estrutura estudada no benchmark
 * (docs/01 §3, "Header e navegação"), com texto e visual próprios:
 * 1. faixa de vantagens (cupom, Pix, brinde, parcelas — ou CNPJ no B2B);
 * 2. barra de atalhos (atendimento, WhatsApp, afiliado, pedidos, favoritos);
 * 3. logo, busca, favoritos, conta e sacola;
 * 4. menu de categorias/marcas com destaques à direita.
 * Só as camadas 3 e 4 ficam presas ao rolar, para não comer a tela.
 */
export function Header() {
  const { totalItens, abrir } = useCarrinho();
  const { usuario } = useConta();
  const { slugs: favoritos } = useFavoritos();
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);
  const rotuloConta = usuario ? usuario.nome.split(" ")[0] : copy.conta.entrar;
  const totalFavoritos = favoritos.length;

  return (
    <>
    <FaixaVantagens />

    {/* barra de atalhos — só no computador; no celular os mesmos links vão no menu */}
    <div className="hidden border-b border-linha bg-superficie lg:block">
      <nav
        aria-label={atalhos.rotulo}
        className="container-bn flex h-9 items-center justify-between text-[0.8125rem] text-grafite"
      >
        <ul className="flex items-center gap-6">
          {LOJA.b2b && (
            <li>
              <Link href="/profissional" className="font-semibold text-roxo hover:underline">
                {atalhos.profissional}
              </Link>
            </li>
          )}
          <li>
            <Link href="/atendimento" className="hover:text-roxo">
              {atalhos.atendimento}
            </Link>
          </li>
          {NEGOCIO.whatsapp && (
            <li>
              <a
                href={linkWhatsapp(NEGOCIO.whatsapp)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 hover:text-roxo"
              >
                <IconeWhatsapp />
                {atalhos.whatsapp} {NEGOCIO.whatsappVisivel}
              </a>
            </li>
          )}
          {entregaNoRio && (
            <li className="inline-flex items-center gap-1.5">
              <IconeEntrega />
              {atalhos.entregaRio}
            </li>
          )}
        </ul>
        <ul className="flex items-center gap-6">
          <li>
            <Link href="/afiliado" className="hover:text-roxo">
              {atalhos.afiliado}
            </Link>
          </li>
          <li>
            <Link href="/conta#pedidos" className="hover:text-roxo">
              {atalhos.pedidos}
            </Link>
          </li>
          <li>
            <Link href="/conta#favoritos" className="inline-flex items-center gap-1.5 hover:text-roxo">
              <IconeCoracao />
              {atalhos.favoritos}
              {totalFavoritos > 0 && <span className="num">({totalFavoritos})</span>}
            </Link>
          </li>
        </ul>
      </nav>
    </div>

    <header className="sticky top-0 z-40 border-b border-linha bg-white">
      <div className="container-bn flex h-16 items-center gap-4 md:h-[4.5rem] md:gap-6">
        {/* menu mobile */}
        <button
          type="button"
          /* text-tinta: sem cor própria o ícone herdava o preto da página e
             sumia no topo escuro da Pulse e da Bradeco */
          className="flex h-11 w-11 items-center justify-center rounded-[4px] text-tinta hover:bg-superficie lg:hidden"
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

        <Link href="/" className="shrink-0">
          <Logo />
        </Link>

        <div className="hidden grow justify-center md:flex">
          <BuscaHeader />
        </div>

        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <Link
            href="/conta#favoritos"
            className="relative hidden h-11 w-11 items-center justify-center rounded-[4px] text-grafite hover:bg-superficie sm:flex"
            aria-label={`${atalhos.favoritos}${totalFavoritos > 0 ? `, ${totalFavoritos}` : ""}`}
          >
            <IconeCoracao tamanho={18} />
            {totalFavoritos > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-[40px] bg-roxo px-1 text-[0.6875rem] font-semibold text-white num">
                {totalFavoritos}
              </span>
            )}
          </Link>
          <Link
            href="/conta"
            className="flex h-11 items-center gap-2 rounded-[4px] px-3 text-[0.875rem] text-grafite hover:bg-superficie"
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
            className="relative flex h-11 items-center gap-2 rounded-[4px] px-3 text-[0.875rem] text-grafite hover:bg-superficie"
            aria-label={`${copy.header.sacola}${totalItens > 0 ? `, ${totalItens} itens` : ""}`}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path d="M3.5 6 H14.5 L13.6 15.2 a1.5 1.5 0 0 1 -1.5 1.3 H5.9 a1.5 1.5 0 0 1 -1.5 -1.3 Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M6.2 6 V5 a2.8 2.8 0 0 1 5.6 0 V6" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <span className="hidden sm:inline">{copy.header.sacola}</span>
            {totalItens > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-[40px] bg-roxo px-1 text-[0.6875rem] font-semibold text-white num">
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
            className="flex h-12 items-center px-3 text-[1rem] font-medium text-tinta hover:text-roxo"
          >
            {copy.nav.inicio}
          </Link>
          <div className="group relative">
            <button
              type="button"
              className="flex h-12 items-center gap-1.5 px-3 text-[1rem] font-medium text-tinta hover:text-roxo"
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
                    className="rounded-[4px] px-3 py-2 hover:bg-superficie"
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
              className="flex h-12 items-center gap-1.5 px-3 text-[1rem] font-medium text-tinta hover:text-roxo"
              aria-haspopup="true"
            >
              {copy.nav.marcas}
              <Seta />
            </button>
            <MegaPainel>
              {/* só as logos, como na página de marcas; o nome fica no rótulo do link */}
              <div className="grid grid-cols-5 gap-2">
                {marcas.slice(0, 15).map((m) => (
                  <Link
                    key={m.slug}
                    href={`/marca/${m.slug}`}
                    aria-label={m.nome}
                    className="flex h-14 w-[120px] items-center justify-center rounded-[4px] border border-linha px-2 hover:border-roxo"
                  >
                    {m.logo ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={comBase(m.logo)} alt="" loading="lazy" className="max-h-10 max-w-full object-contain" />
                    ) : (
                      <span aria-hidden="true" className="text-center text-[0.75rem] font-bold uppercase leading-tight text-[#2b2b2b]">
                        {m.nome}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
              <Link
                href="/marcas"
                className="mt-2 block rounded-[4px] px-3 py-2 text-[0.9375rem] font-semibold text-violeta hover:bg-superficie"
              >
                {copy.nav.todasMarcas} →
              </Link>
            </MegaPainel>
          </div>

          {necessidades.length > 0 && (
          <div className="group relative">
            <button
              type="button"
              className="flex h-12 items-center gap-1.5 px-3 text-[1rem] font-medium text-tinta hover:text-roxo"
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
                    className="rounded-[4px] px-3 py-2 text-[0.9375rem] text-tinta hover:bg-superficie"
                  >
                    {n.nome}
                  </Link>
                ))}
              </div>
            </MegaPainel>
          </div>
          )}

          {/* a loja profissional tem duas pílulas à direita: cabem 3 categorias */}
          {categorias.slice(0, LOJA.b2b ? 3 : 4).map((c) => (
            <Link
              key={c.slug}
              href={`/categoria/${c.slug}`}
              className="hidden h-12 items-center whitespace-nowrap px-3 text-[1rem] font-medium text-grafite hover:text-roxo xl:flex"
            >
              {c.nome}
            </Link>
          ))}

          {/* destaques à direita — a pílula cheia é "Marcas Profissionais"
              (design system); na loja profissional a cheia leva às linhas
              profissionais (ou ao cadastro, se o preço é fechado) */}
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/busca/?q=mais+vendidos"
              className="hidden h-12 items-center whitespace-nowrap px-3 text-[1rem] font-medium text-grafite hover:text-roxo xl:flex"
            >
              {copy.header.destaques.maisVendidos}
            </Link>
            <Link
              href="/marcas"
              className={`whitespace-nowrap rounded-[40px] px-4 py-1.5 text-[0.875rem] font-medium ${
                LOJA.b2b
                  ? "border border-roxo text-roxo hover:bg-roxo-claro"
                  : "bg-roxo text-white hover:bg-roxo-escuro"
              }`}
            >
              {copy.header.destaques.marcasProfissionais}
            </Link>
            {LOJA.b2b && (
              <Link
                href={LOJA.precoFechado ? "/profissional" : "/destaques"}
                className="whitespace-nowrap rounded-[40px] bg-roxo px-4 py-1.5 text-[0.875rem] font-medium text-white hover:bg-roxo-escuro"
              >
                {copy.header.destaques.liberarPrecos}
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* drawer de navegação mobile */}
      {menuMobileAberto && (
        <nav
          aria-label="Navegação principal"
          className="max-h-[calc(100dvh-9rem)] overflow-y-auto overscroll-contain border-t border-linha bg-white pb-4 lg:hidden"
        >
          <div className="container-bn flex flex-col gap-4 pt-3">
            <Link
              href="/conta"
              onClick={() => setMenuMobileAberto(false)}
              className="flex items-center gap-2.5 rounded-[8px] bg-roxo-claro px-3 py-3 text-[0.9375rem] font-semibold text-roxo"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <circle cx="9" cy="6" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <path d="M3 15.5 a6 6 0 0 1 12 0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              {usuario ? `${copy.conta.ola(usuario.nome)} Ver minha conta` : `${copy.conta.entrar} ou criar conta`}
            </Link>
            <ul className="grid grid-cols-2 gap-2 text-[0.875rem]">
              {[
                ...(LOJA.b2b ? [{ href: "/profissional", rotulo: atalhos.profissional }] : []),
                ...(LOJA.vitrineProfissional ? [{ href: "/destaques", rotulo: copy.destaques.titulo }] : []),
                { href: "/conta#pedidos", rotulo: atalhos.pedidos },
                {
                  href: "/conta#favoritos",
                  rotulo: `${atalhos.favoritos}${totalFavoritos > 0 ? ` (${totalFavoritos})` : ""}`,
                },
                { href: "/atendimento", rotulo: atalhos.atendimento },
                { href: "/afiliado", rotulo: atalhos.afiliado },
              ].map((a) => (
                <li key={a.href}>
                  <Link
                    href={a.href}
                    onClick={() => setMenuMobileAberto(false)}
                    className="block rounded-[4px] border border-linha px-3 py-2.5 text-tinta hover:bg-superficie"
                  >
                    {a.rotulo}
                  </Link>
                </li>
              ))}
              {NEGOCIO.whatsapp && (
                <li>
                  <a
                    href={linkWhatsapp(NEGOCIO.whatsapp)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-[4px] border border-linha px-3 py-2.5 text-tinta hover:bg-superficie"
                  >
                    <IconeWhatsapp />
                    {atalhos.whatsapp}
                  </a>
                </li>
              )}
            </ul>
            <Link
              href="/"
              onClick={() => setMenuMobileAberto(false)}
              className="block rounded-[4px] px-2 py-2.5 text-[0.9375rem] font-semibold text-tinta hover:bg-superficie"
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
                  className="block rounded-[4px] px-2 py-2.5 text-[0.9375rem] text-tinta hover:bg-superficie"
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
                  className="block rounded-[4px] px-2 py-2.5 text-[0.9375rem] text-tinta hover:bg-superficie"
                >
                  {m.nome}
                </Link>
              ))}
              <Link
                href="/marcas"
                onClick={() => setMenuMobileAberto(false)}
                className="block rounded-[4px] px-2 py-2.5 text-[0.9375rem] font-semibold text-violeta hover:bg-superficie"
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
                  className="block rounded-[4px] px-2 py-2.5 text-[0.9375rem] text-tinta hover:bg-superficie"
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
    </>
  );
}

function IconeCoracao({ tamanho = 14 }: { tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 18 18" aria-hidden="true">
      <path
        d="M9 15.5 C3.5 12 2 9.3 2 6.8 A3.6 3.6 0 0 1 9 5.2 A3.6 3.6 0 0 1 16 6.8 C16 9.3 14.5 12 9 15.5 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconeWhatsapp() {
  return (
    <svg width="14" height="14" viewBox="0 0 18 18" aria-hidden="true">
      <path
        d="M9 2 A7 7 0 0 0 3 12.6 L2 16 L5.5 15 A7 7 0 1 0 9 2 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconeEntrega() {
  return (
    <svg width="16" height="14" viewBox="0 0 20 16" aria-hidden="true">
      <path
        d="M1.5 3 H12 V11 H1.5 Z M12 6 H15.5 L18.5 9 V11 H12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="5" cy="12.5" r="1.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="15" cy="12.5" r="1.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
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
    <div className="invisible absolute left-0 top-full z-50 w-max min-w-[520px] max-w-[720px] rounded-b-[8px] border border-t-0 border-linha bg-white p-4 opacity-0 shadow-card transition-opacity duration-150 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
      {children}
    </div>
  );
}
