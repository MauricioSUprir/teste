import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  necessidades,
  obterNecessidade,
  produtosPorNecessidade,
} from "@/lib/catalogo/consultas";
import { GradeFiltrada } from "@/components/catalogo/GradeFiltrada";
import { Breadcrumb } from "@/components/layout/Breadcrumb";

export function generateStaticParams() {
  // com o catálogo do Hub as necessidades (curadoria editorial) podem estar
  // vazias — o export estático exige ao menos 1 rota, então gera um
  // marcador que cai em notFound()
  if (necessidades.length === 0) return [{ slug: "nenhuma" }];
  return necessidades.map((n) => ({ slug: n.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const necessidade = obterNecessidade(slug);
  if (!necessidade) return {};
  return { title: `${necessidade.nome} — produtos selecionados` };
}

export default async function PaginaNecessidade({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const necessidade = obterNecessidade(slug);
  if (!necessidade) notFound();
  const produtos = produtosPorNecessidade(necessidade.slug);

  return (
    <div className="container-bn py-6">
      <Breadcrumb itens={[{ rotulo: necessidade.nome }]} />
      <h1 className="font-titulo mt-2 text-[clamp(1.625rem,3.5vw,2.25rem)] font-semibold">
        {necessidade.nome}
      </h1>
      <p className="mt-1 max-w-[70ch] text-[0.9375rem] text-grafite">
        Seleção da nossa curadoria para {necessidade.nome.toLowerCase()}.
      </p>
      <div className="mt-6">
        <Suspense>
          <GradeFiltrada produtos={produtos} />
        </Suspense>
      </div>
    </div>
  );
}
