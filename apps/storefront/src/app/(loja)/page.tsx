import Link from "next/link";
import { copy } from "@/lib/copy";
import {
  categorias,
  lancamentos,
  maisVendidos,
  marcas,
  necessidades,
} from "@/lib/catalogo/consultas";
import { CardProduto } from "@/components/produto/CardProduto";
import { NewsletterForm } from "@/components/home/NewsletterForm";

/** Home — hero editorial, categorias, mais vendidos, marcas (ticket 2.2). */
export default function Home() {
  return (
    <>
      {/* Hero editorial — a única ênfase visual da tela (docs/03 §1) */}
      <section className="bg-rosa-claro">
        <div className="container-bn grid items-center gap-8 py-12 md:grid-cols-2 md:py-16">
          <div>
            <p className="text-[0.8125rem] font-semibold uppercase tracking-widest text-rosa-escuro">
              {copy.marca.nome}
            </p>
            <h1 className="font-titulo mt-3 text-[clamp(2rem,5vw,3.25rem)] font-semibold leading-[1.1] text-tinta">
              {copy.home.heroTitulo}
            </h1>
            <p className="mt-4 max-w-[46ch] text-[1.0625rem] leading-relaxed text-grafite">
              {copy.home.heroTexto}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="#mais-vendidos"
                className="rounded-[999px] bg-rosa px-7 py-3.5 text-[1rem] font-semibold text-white hover:bg-rosa-escuro"
              >
                {copy.home.heroCta}
              </Link>
              <Link
                href="/necessidade/hidratacao"
                className="rounded-[999px] border-2 border-tinta px-7 py-3.5 text-[1rem] font-semibold text-tinta hover:bg-white"
              >
                {copy.home.heroCtaSecundario}
              </Link>
            </div>
          </div>
          <div aria-hidden="true" className="hidden justify-center md:flex">
            {/* composição gráfica com a gota da marca */}
            <svg viewBox="0 0 360 320" className="w-full max-w-md">
              <path d="M180 20 C240 110 285 170 285 230 a105 105 0 0 1 -210 0 C75 170 120 110 180 20 Z" fill="#E8467C" opacity="0.9" />
              <circle cx="145" cy="225" r="34" fill="#FFFFFF" opacity="0.85" />
              <path d="M300 60 c10 16 17 27 17 38 a17 17 0 0 1 -34 0 c0 -11 7 -22 17 -38 Z" fill="#2B4C7E" opacity="0.8" />
              <path d="M60 90 c7 11 12 19 12 27 a12 12 0 0 1 -24 0 c0 -8 5 -16 12 -27 Z" fill="#C22D5F" opacity="0.6" />
            </svg>
          </div>
        </div>
      </section>

      {/* Selos de confiança */}
      <section aria-label="Vantagens da loja" className="border-b border-linha">
        <ul className="container-bn grid grid-cols-2 gap-4 py-5 md:grid-cols-4">
          {[
            [copy.home.seloOriginal, copy.home.seloOriginalTexto, "✓"],
            [copy.home.seloEnvio, copy.home.seloEnvioTexto, "🚚"],
            [copy.home.seloTroca, copy.home.seloTrocaTexto, "↺"],
            [copy.home.seloPix, copy.home.seloPixTexto, "◆"],
          ].map(([titulo, texto, icone]) => (
            <li key={titulo} className="flex items-start gap-2.5">
              <span aria-hidden="true" className="mt-0.5 text-azul">{icone}</span>
              <span>
                <span className="block text-[0.875rem] font-semibold text-tinta">{titulo}</span>
                <span className="block text-[0.75rem] leading-snug text-cinza">{texto}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Mais vendidos */}
      <section id="mais-vendidos" className="container-bn pt-12">
        <div className="flex items-baseline justify-between">
          <h2 className="font-titulo text-[clamp(1.375rem,2.5vw,1.75rem)] font-semibold">
            {copy.home.maisVendidos}
          </h2>
          <Link href="/busca?q=mais+vendidos" className="text-[0.875rem] font-medium text-azul hover:underline">
            {copy.home.verTudo} →
          </Link>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {maisVendidos().slice(0, 5).map((p) => (
            <CardProduto key={p.slug} produto={p} />
          ))}
        </div>
      </section>

      {/* Categorias */}
      <section className="container-bn pt-12">
        <h2 className="font-titulo text-[clamp(1.375rem,2.5vw,1.75rem)] font-semibold">
          {copy.home.porCategoria}
        </h2>
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {categorias.map((c) => (
            <Link
              key={c.slug}
              href={`/categoria/${c.slug}`}
              className="rounded-[10px] border border-linha bg-superficie p-4 text-center transition-colors hover:border-rosa hover:bg-rosa-claro"
            >
              <span className="block text-[0.9375rem] font-semibold text-tinta">{c.nome}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Necessidades */}
      <section className="container-bn pt-12">
        <h2 className="font-titulo text-[clamp(1.375rem,2.5vw,1.75rem)] font-semibold">
          {copy.home.porNecessidade}
        </h2>
        <ul className="mt-5 flex flex-wrap gap-2">
          {necessidades.map((n) => (
            <li key={n.slug}>
              <Link
                href={`/necessidade/${n.slug}`}
                className="inline-block rounded-[999px] border border-linha px-4 py-2.5 text-[0.9375rem] text-grafite transition-colors hover:border-rosa hover:text-rosa"
              >
                {n.nome}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Lançamentos */}
      <section className="container-bn pt-12">
        <div className="flex items-baseline justify-between">
          <h2 className="font-titulo text-[clamp(1.375rem,2.5vw,1.75rem)] font-semibold">
            {copy.home.lancamentos}
          </h2>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
          {lancamentos().slice(0, 3).map((p) => (
            <CardProduto key={p.slug} produto={p} />
          ))}
        </div>
      </section>

      {/* Marcas */}
      <section className="mt-12 bg-superficie py-12">
        <div className="container-bn">
          <h2 className="font-titulo text-[clamp(1.375rem,2.5vw,1.75rem)] font-semibold">
            {copy.home.marcasDestaque}
          </h2>
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {marcas.map((m) => (
              <Link
                key={m.slug}
                href={`/marca/${m.slug}`}
                className="flex flex-col items-center gap-2 rounded-[10px] border border-linha bg-white p-5 text-center transition-shadow hover:shadow-card"
              >
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 items-center justify-center rounded-full text-[1.125rem] font-bold text-white"
                  style={{ background: m.cor }}
                >
                  {m.nome.charAt(0)}
                </span>
                <span className="text-[0.875rem] font-medium text-tinta">{m.nome}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <section className="container-bn pt-12">
        <div className="rounded-[16px] bg-azul-claro px-6 py-10 text-center md:px-12">
          <h2 className="font-titulo text-[clamp(1.375rem,2.5vw,1.75rem)] font-semibold text-tinta">
            {copy.home.newsletterTitulo}
          </h2>
          <p className="mt-2 text-[0.9375rem] text-grafite">{copy.home.newsletterTexto}</p>
          <NewsletterForm />
        </div>
      </section>
    </>
  );
}
