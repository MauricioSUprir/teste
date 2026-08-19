import Link from "next/link";
import { copy } from "@/lib/copy";
import {
  categorias,
  lancamentos,
  maisVendidos,
  marcas,
  necessidades,
  produtos,
} from "@/lib/catalogo/consultas";
import { CardProduto } from "@/components/produto/CardProduto";
import { NewsletterForm } from "@/components/home/NewsletterForm";

/** Home — hero editorial, categorias, mais vendidos, marcas (ticket 2.2). */
export default function Home() {
  // com o catálogo real, "mais vendidos" pode não ter sinal ainda — cai para os primeiros produtos
  const destaques = maisVendidos().length > 0 ? maisVendidos() : produtos;
  const novidades = lancamentos();
  const ctaSecundarioHref =
    necessidades.length > 0 ? "/necessidade/hidratacao" : `/categoria/${categorias[0]?.slug ?? ""}`;
  return (
    <>
      {/* Hero editorial — a única ênfase visual da tela (docs/03 §1) */}
      <section className="bg-roxo-claro">
        <div className="container-bn grid items-center gap-8 py-12 md:grid-cols-2 md:py-16">
          <div>
            <p className="text-[0.8125rem] font-semibold uppercase tracking-widest text-roxo-escuro">
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
                className="rounded-[999px] bg-roxo px-7 py-3.5 text-[1rem] font-semibold text-white hover:bg-roxo-escuro"
              >
                {copy.home.heroCta}
              </Link>
              <Link
                href={ctaSecundarioHref}
                className="rounded-[999px] border-2 border-tinta px-7 py-3.5 text-[1rem] font-semibold text-tinta hover:bg-white"
              >
                {copy.home.heroCtaSecundario}
              </Link>
            </div>
          </div>
          <div aria-hidden="true" className="hidden justify-center md:flex">
            {/* composição gráfica com o monograma BN da marca */}
            <svg viewBox="0 0 360 320" className="w-full max-w-md">
              <defs>
                <linearGradient id="hero-bn" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#4A2882" />
                  <stop offset="100%" stopColor="#6847C8" />
                </linearGradient>
              </defs>
              <circle cx="180" cy="160" r="130" fill="#6847C8" opacity="0.12" />
              <circle cx="292" cy="70" r="26" fill="#6847C8" opacity="0.35" />
              <circle cx="66" cy="248" r="16" fill="#4A2882" opacity="0.3" />
              <text
                x="180"
                y="212"
                textAnchor="middle"
                fill="url(#hero-bn)"
                style={{ fontFamily: "var(--fonte-titulo)", fontSize: 170, fontWeight: 600, letterSpacing: "-0.04em" }}
              >
                BN
              </text>
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
              <span aria-hidden="true" className="mt-0.5 text-violeta">{icone}</span>
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
          <Link href="/busca?q=mais+vendidos" className="text-[0.875rem] font-medium text-violeta hover:underline">
            {copy.home.verTudo} →
          </Link>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {destaques.slice(0, 5).map((p) => (
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
              className="rounded-[10px] border border-linha bg-superficie p-4 text-center transition-colors hover:border-roxo hover:bg-roxo-claro"
            >
              <span className="block text-[0.9375rem] font-semibold text-tinta">{c.nome}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Necessidades */}
      {necessidades.length > 0 && (
      <section className="container-bn pt-12">
        <h2 className="font-titulo text-[clamp(1.375rem,2.5vw,1.75rem)] font-semibold">
          {copy.home.porNecessidade}
        </h2>
        <ul className="mt-5 flex flex-wrap gap-2">
          {necessidades.map((n) => (
            <li key={n.slug}>
              <Link
                href={`/necessidade/${n.slug}`}
                className="inline-block rounded-[999px] border border-linha px-4 py-2.5 text-[0.9375rem] text-grafite transition-colors hover:border-roxo hover:text-roxo"
              >
                {n.nome}
              </Link>
            </li>
          ))}
        </ul>
      </section>
      )}

      {/* Lançamentos */}
      {novidades.length > 0 && (
      <section className="container-bn pt-12">
        <div className="flex items-baseline justify-between">
          <h2 className="font-titulo text-[clamp(1.375rem,2.5vw,1.75rem)] font-semibold">
            {copy.home.lancamentos}
          </h2>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
          {novidades.slice(0, 3).map((p) => (
            <CardProduto key={p.slug} produto={p} />
          ))}
        </div>
      </section>
      )}

      {/* Marcas */}
      <section className="mt-12 bg-superficie py-12">
        <div className="container-bn">
          <h2 className="font-titulo text-[clamp(1.375rem,2.5vw,1.75rem)] font-semibold">
            {copy.home.marcasDestaque}
          </h2>
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {marcas.slice(0, 6).map((m) => (
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
        <div className="rounded-[16px] bg-violeta-claro px-6 py-10 text-center md:px-12">
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
