import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { categorias, obterCategoria, produtosPorCategoria } from "@/lib/catalogo/consultas";
import type { CategoriaSlug } from "@/lib/catalogo/tipos";
import { GradeFiltrada } from "@/components/catalogo/GradeFiltrada";
import { Breadcrumb } from "@/components/layout/Breadcrumb";

export function generateStaticParams() {
  return categorias.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const categoria = obterCategoria(slug as CategoriaSlug);
  if (!categoria) return {};
  return {
    title: categoria.nome,
    description: categoria.descricao,
  };
}

export default async function PaginaCategoria({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const categoria = obterCategoria(slug as CategoriaSlug);
  if (!categoria) notFound();
  const produtos = produtosPorCategoria(categoria.slug);

  return (
    <div className="container-bn py-6">
      <Breadcrumb itens={[{ rotulo: categoria.nome }]} />
      <h1 className="font-titulo mt-2 text-[clamp(1.625rem,3.5vw,2.25rem)] font-semibold">
        {categoria.nome}
      </h1>
      <p className="mt-1 max-w-[70ch] text-[0.9375rem] text-grafite">{categoria.descricao}</p>
      <div className="mt-6">
        <Suspense>
          <GradeFiltrada produtos={produtos} />
        </Suspense>
      </div>
    </div>
  );
}
