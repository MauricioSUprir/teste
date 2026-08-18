import { Suspense } from "react";
import type { Metadata } from "next";
import { buscar, maisVendidos } from "@/lib/catalogo/consultas";
import { copy } from "@/lib/copy";
import { GradeFiltrada } from "@/components/catalogo/GradeFiltrada";
import { Breadcrumb } from "@/components/layout/Breadcrumb";

export const metadata: Metadata = { title: "Busca" };

export default async function PaginaBusca({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const termo = (q ?? "").trim();
  const ehAtalhoMaisVendidos = termo.toLowerCase() === "mais vendidos";
  const resultados = ehAtalhoMaisVendidos ? maisVendidos() : termo ? buscar(termo) : [];

  return (
    <div className="container-bn py-6">
      <Breadcrumb itens={[{ rotulo: "Busca" }]} />
      <h1 className="font-titulo mt-2 text-[clamp(1.625rem,3.5vw,2.25rem)] font-semibold">
        {ehAtalhoMaisVendidos ? "Mais vendidos" : `${copy.busca.titulo} “${termo}”`}
      </h1>
      <div className="mt-6">
        {resultados.length === 0 ? (
          <p className="rounded-[10px] bg-superficie px-6 py-12 text-center text-[0.9375rem] text-grafite">
            {copy.busca.nenhum(termo)}
          </p>
        ) : (
          <Suspense>
            <GradeFiltrada produtos={resultados} />
          </Suspense>
        )}
      </div>
    </div>
  );
}
