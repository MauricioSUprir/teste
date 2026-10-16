import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { copy } from "@/lib/copy";
import { destaques, obterDestaque } from "@/lib/catalogo/destaques";
import { GradeFiltrada } from "@/components/catalogo/GradeFiltrada";
import { GradeCarregando } from "@/components/catalogo/GradeCarregando";
import { Breadcrumb } from "@/components/layout/Breadcrumb";

export function generateStaticParams() {
  // o export estático exige ao menos 1 rota: sem seleção, um marcador que cai em notFound()
  if (destaques.length === 0) return [{ slug: "nenhum" }];
  return destaques.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const destaque = obterDestaque(slug);
  if (!destaque) return {};
  return { title: `${destaque.nome} | ${copy.destaques.paginaTitulo}`, description: destaque.texto };
}

export default async function PaginaDestaque({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const destaque = obterDestaque(slug);
  if (!destaque) notFound();

  return (
    <div className="container-bn py-6">
      <Breadcrumb itens={[{ rotulo: copy.destaques.paginaTitulo, href: "/destaques" }, { rotulo: destaque.nome }]} />
      <h1 className="font-titulo mt-2 text-[clamp(1.625rem,3.5vw,2.25rem)] font-semibold">{destaque.nome}</h1>
      <p className="mt-1 max-w-[70ch] text-[0.9375rem] text-grafite">{destaque.texto}</p>
      <div className="mt-6">
        <Suspense fallback={<GradeCarregando produtos={destaque.produtos} />}>
          <GradeFiltrada produtos={destaque.produtos} />
        </Suspense>
      </div>
    </div>
  );
}
