"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { buscar, maisVendidos } from "@/lib/catalogo/consultas";
import { copy } from "@/lib/copy";
import { GradeFiltrada } from "@/components/catalogo/GradeFiltrada";
import { Breadcrumb } from "@/components/layout/Breadcrumb";

export function BuscaResultados() {
  const params = useSearchParams();
  const termo = (params.get("q") ?? "").trim();
  const ehAtalhoMaisVendidos = termo.toLowerCase() === "mais vendidos";
  const resultados = useMemo(
    () => (ehAtalhoMaisVendidos ? maisVendidos() : termo ? buscar(termo) : []),
    [ehAtalhoMaisVendidos, termo]
  );

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
          <GradeFiltrada produtos={resultados} />
        )}
      </div>
    </div>
  );
}
