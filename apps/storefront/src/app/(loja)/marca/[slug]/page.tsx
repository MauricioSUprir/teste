import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { comBase } from "@/lib/caminho";
import { marcas, obterMarca, produtosPorMarca } from "@/lib/catalogo/consultas";
import { GradeFiltrada } from "@/components/catalogo/GradeFiltrada";
import { Breadcrumb } from "@/components/layout/Breadcrumb";

export function generateStaticParams() {
  return marcas.map((m) => ({ slug: m.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const marca = obterMarca(slug);
  if (!marca) return {};
  return { title: marca.nome, description: marca.descricao };
}

/** Página de marca com hero + grade + texto de SEO — ticket 2.6. */
export default async function PaginaMarca({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const marca = obterMarca(slug);
  if (!marca) notFound();
  const produtos = produtosPorMarca(marca.slug);

  return (
    <div>
      {/* hero de marca */}
      <section className="border-b border-linha" style={{ background: `${marca.cor}14` }}>
        <div className="container-bn flex items-center gap-5 py-10">
          {marca.logo ? (
            <span className="flex h-24 w-40 shrink-0 items-center justify-center overflow-hidden rounded-[16px] border border-linha bg-white px-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={comBase(marca.logo)}
                alt={`Logo ${marca.nome}`}
                className="max-h-20 max-w-full object-contain"
              />
            </span>
          ) : (
            <span
              aria-hidden="true"
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-[1.75rem] font-bold text-white"
              style={{ background: marca.cor }}
            >
              {marca.nome.charAt(0)}
            </span>
          )}
          <div>
            <h1 className="font-titulo text-[clamp(1.625rem,3.5vw,2.25rem)] font-semibold">
              {marca.nome}
            </h1>
            <p className="mt-1 max-w-[70ch] text-[0.9375rem] leading-relaxed text-grafite">
              {marca.descricao}
            </p>
          </div>
        </div>
      </section>

      <div className="container-bn py-6">
        <Breadcrumb itens={[{ rotulo: marca.nome }]} />
        <div className="mt-4">
          <Suspense>
            <GradeFiltrada produtos={produtos} marca={marca.slug} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
