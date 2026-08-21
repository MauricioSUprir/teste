import Link from "next/link";
import { copy } from "@/lib/copy";
import { comBase } from "@/lib/caminho";
import {
  categorias,
  lancamentos,
  maisVendidos,
  marcas,
  necessidades,
  produtos,
} from "@/lib/catalogo/consultas";
import { CardProduto } from "@/components/produto/CardProduto";
import { ProdutosLocaisDestaque } from "@/components/produto/ProdutosLocaisDestaque";
import { NewsletterForm } from "@/components/home/NewsletterForm";
import { CarrosselBanners } from "@/components/home/CarrosselBanners";

/** Home — hero editorial, categorias, mais vendidos, marcas (ticket 2.2). */
export default function Home() {
  // com o catálogo real, "mais vendidos" pode não ter sinal ainda — cai para os primeiros produtos
  const destaques = maisVendidos().length > 0 ? maisVendidos() : produtos;
  const novidades = lancamentos();
  return (
    <>
      {/* Carrossel de banners do lojista (troca a cada 20s) */}
      <CarrosselBanners />

      {/* atalhos rápidos no lugar do antigo hero roxo */}
      <section className="border-b border-linha bg-white">
        <div className="container-bn flex flex-wrap items-center gap-3 py-4">
          <Link
            href="#mais-vendidos"
            className="rounded-[999px] bg-roxo px-6 py-2.5 text-[0.9375rem] font-semibold text-white hover:bg-roxo-escuro"
          >
            {copy.home.heroCta}
          </Link>
          {categorias.slice(0, 3).map((c) => (
            <Link
              key={c.slug}
              href={`/categoria/${c.slug}`}
              className="rounded-[999px] border border-linha px-5 py-2.5 text-[0.9375rem] font-medium text-grafite hover:border-roxo hover:text-roxo"
            >
              {c.nome}
            </Link>
          ))}
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
          <ProdutosLocaisDestaque />
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
          <div className="flex items-baseline justify-between">
            <h2 className="font-titulo text-[clamp(1.375rem,2.5vw,1.75rem)] font-semibold">
              {copy.home.marcasDestaque}
            </h2>
            <Link href="/marcas" className="text-[0.875rem] font-medium text-violeta hover:underline">
              {copy.nav.todasMarcas} →
            </Link>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {marcas.slice(0, 6).map((m) => (
              <Link
                key={m.slug}
                href={`/marca/${m.slug}`}
                className="flex flex-col items-center gap-2 rounded-[10px] border border-linha bg-white p-4 text-center transition-shadow hover:shadow-card"
              >
                {m.logo ? (
                  <span className="flex h-20 w-full items-center justify-center overflow-hidden rounded-[6px] bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={comBase(m.logo)}
                      alt={`Logo ${m.nome}`}
                      loading="lazy"
                      className="max-h-16 max-w-[85%] object-contain"
                    />
                  </span>
                ) : (
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 items-center justify-center rounded-full text-[1.125rem] font-bold text-white"
                    style={{ background: m.cor }}
                  >
                    {m.nome.charAt(0)}
                  </span>
                )}
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
