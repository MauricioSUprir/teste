import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { copy } from "@/lib/copy";
import {
  mesmaLinha,
  notaMedia,
  obterCategoria,
  obterMarca,
  obterProduto,
  produtos,
  relacionados,
  temEstoque,
} from "@/lib/catalogo/consultas";
import { precoPix } from "@/lib/preco";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Acordeao } from "@/components/produto/Acordeao";
import { Avaliacoes } from "@/components/produto/Avaliacoes";
import { CardProduto } from "@/components/produto/CardProduto";
import { ColunaCompra } from "@/components/produto/ColunaCompra";
import { CompreJunto } from "@/components/produto/CompreJunto";
import { GaleriaPDP } from "@/components/produto/GaleriaPDP";
import { NotaEstrelas } from "@/components/produto/NotaEstrelas";

export function generateStaticParams() {
  return produtos.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const produto = obterProduto(slug);
  if (!produto) return {};
  const marca = obterMarca(produto.marca);
  return {
    title: `${produto.titulo} — ${marca?.nome}`,
    description: produto.descricao.slice(0, 160),
  };
}

export default async function PaginaProduto({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const produto = obterProduto(slug);
  if (!produto) notFound();

  const marca = obterMarca(produto.marca);
  const categoria = obterCategoria(produto.categorias[0]);
  const { media, total } = notaMedia(produto);
  const companheiros = (produto.compreJunto ?? [])
    .map((s) => obterProduto(s))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));
  const linha = mesmaLinha(produto);
  const vistos = relacionados(produto).filter(
    (p) => !companheiros.some((c) => c.slug === p.slug) && !linha.some((l) => l.slug === p.slug)
  );
  const alt = `${marca?.nome ?? ""} ${produto.titulo}`.trim();

  // Dados estruturados Product + Offer + AggregateRating — ticket 3.9
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: produto.titulo,
    description: produto.descricao,
    brand: { "@type": "Brand", name: marca?.nome },
    sku: produto.variantes[0].sku,
    offers: produto.variantes.map((v) => ({
      "@type": "Offer",
      price: (precoPix(v.precoPor) / 100).toFixed(2),
      priceCurrency: "BRL",
      availability:
        v.estoque > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      sku: v.sku,
    })),
    ...(total > 0 && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: media,
        reviewCount: total,
      },
    }),
  };

  return (
    <div className="container-bn py-6 pb-32 md:pb-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Breadcrumb
        itens={[
          ...(categoria ? [{ rotulo: categoria.nome, href: `/categoria/${categoria.slug}` }] : []),
          { rotulo: produto.titulo },
        ]}
      />

      {/* acima da dobra: galeria 60% / coluna de compra 40% sticky (docs/03 §5) */}
      <div className="mt-4 grid gap-8 lg:grid-cols-[3fr_2fr]">
        <div>
          <GaleriaPDP produto={produto} alt={alt} />
        </div>
        <div className="lg:sticky lg:top-[120px] lg:self-start">
          {marca && (
            <Link
              href={`/marca/${marca.slug}`}
              className="text-[0.8125rem] font-semibold uppercase tracking-wide text-violeta hover:underline"
            >
              {marca.nome}
            </Link>
          )}
          <h1 className="font-titulo mt-1 text-[clamp(1.375rem,2.5vw,1.75rem)] font-semibold leading-tight">
            {produto.titulo}
          </h1>
          {total >= 1 && (
            <a
              href="#avaliacoes"
              className="mt-2 inline-flex items-center gap-2 text-[0.875rem] text-grafite hover:text-tinta"
            >
              <NotaEstrelas nota={media} />
              <span className="num font-medium">{media.toFixed(1).replace(".", ",")}</span>
              <span className="num text-cinza underline">
                ({total} {total === 1 ? copy.pdp.avaliacao : copy.pdp.avaliacoes})
              </span>
            </a>
          )}
          <Suspense>
            <ColunaCompra produto={produto} />
          </Suspense>
        </div>
      </div>

      {/* abaixo da dobra — ordem fixa de docs/03 §5 */}
      <div className="mt-12 grid gap-10 lg:grid-cols-[3fr_2fr]">
        <div>
          <Acordeao titulo={copy.pdp.sobre} abertoPorPadrao>
            <p>{produto.descricao}</p>
            <ul className="mt-3 space-y-1.5">
              {produto.beneficios.map((b) => (
                <li key={b} className="flex items-start gap-2">
                  {/* marcador de lista na cor da marca */}
                  <svg width="12" height="14" viewBox="0 0 12 14" aria-hidden="true" className="mt-1 shrink-0">
                    <path d="M6 1 C8.2 4.4 9.8 6.8 9.8 9 a3.8 3.8 0 0 1 -7.6 0 C2.2 6.8 3.8 4.4 6 1 Z" fill="#4A2882" />
                  </svg>
                  {b}
                </li>
              ))}
            </ul>
          </Acordeao>

          <Acordeao titulo={copy.pdp.comoUsar}>
            <ol className="list-decimal space-y-1.5 pl-5">
              {produto.modoDeUso.map((passo) => (
                <li key={passo}>{passo}</li>
              ))}
            </ol>
          </Acordeao>

          <Acordeao titulo={copy.pdp.composicao}>
            <p className="text-[0.875rem]">{produto.composicao}</p>
          </Acordeao>

          <Acordeao titulo={copy.pdp.especificacoes}>
            <table className="w-full text-[0.875rem]">
              <tbody>
                {Object.entries(produto.especificacoes).map(([chave, valor]) => (
                  <tr key={chave} className="border-b border-linha last:border-0">
                    <th scope="row" className="w-2/5 py-2 pr-4 text-left font-medium text-tinta">
                      {chave}
                    </th>
                    <td className="py-2 text-grafite">{valor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Acordeao>
        </div>

        <div>
          {companheiros.length > 0 && temEstoque(produto) && (
            <Suspense>
              <CompreJunto principal={produto} companheiros={companheiros} />
            </Suspense>
          )}
        </div>
      </div>

      <div className="mt-12">
        <Avaliacoes produto={produto} />
      </div>

      {linha.length > 0 && (
        <section className="mt-12" aria-label={copy.pdp.mesmaLinha}>
          <h2 className="font-titulo text-[1.375rem] font-semibold">{copy.pdp.mesmaLinha}</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {linha.slice(0, 4).map((p) => (
              <CardProduto key={p.slug} produto={p} />
            ))}
          </div>
        </section>
      )}

      {vistos.length > 0 && (
        <section className="mt-12" aria-label={copy.pdp.quemViuTambemViu}>
          <h2 className="font-titulo text-[1.375rem] font-semibold">{copy.pdp.quemViuTambemViu}</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {vistos.slice(0, 4).map((p) => (
              <CardProduto key={p.slug} produto={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
