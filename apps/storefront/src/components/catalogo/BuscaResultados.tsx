"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { buscarDetalhado, lancamentos, maisVendidos, produtos } from "@/lib/catalogo/consultas";
import { copy } from "@/lib/copy";
import { GradeFiltrada } from "@/components/catalogo/GradeFiltrada";
import { Breadcrumb } from "@/components/layout/Breadcrumb";

export function BuscaResultados() {
  const params = useSearchParams();
  const termo = (params.get("q") ?? "").trim();
  const atalho = termo.toLowerCase();
  const ehAtalhoMaisVendidos = atalho === "mais vendidos";
  // atalhos das vitrines da home ("Ver produtos")
  const ehPromocoes = atalho === "promoções";
  const ehLancamentos = atalho === "lançamentos";
  const { resultados, aproximado } = useMemo(() => {
    if (ehPromocoes) {
      return {
        resultados: produtos.filter((p) => p.variantes.some((v) => v.precoDe != null && v.precoDe > v.precoPor)),
        aproximado: false,
      };
    }
    if (ehLancamentos) return { resultados: lancamentos(), aproximado: false };
    if (ehAtalhoMaisVendidos) {
      // o catálogo do Hub ainda não marca "mais vendido": a home já cai para a
      // vitrine geral nesse caso, e esta página precisa mostrar a mesma lista,
      // senão o "Ver tudo" da home abria uma página vazia
      const lista = maisVendidos();
      return { resultados: lista.length > 0 ? lista : produtos, aproximado: false };
    }
    if (!termo) return { resultados: [], aproximado: false };
    const r = buscarDetalhado(termo);
    return { resultados: r.produtos, aproximado: r.aproximado };
  }, [ehAtalhoMaisVendidos, ehPromocoes, ehLancamentos, termo]);

  return (
    <div className="container-bn py-6">
      <Breadcrumb itens={[{ rotulo: "Busca" }]} />
      <h1 className="font-titulo mt-2 text-[clamp(1.625rem,3.5vw,2.25rem)] font-semibold">
        {ehAtalhoMaisVendidos
          ? copy.home.maisVendidos
          : ehPromocoes
            ? copy.home.vitrinePromocoes
            : ehLancamentos
              ? copy.home.vitrineLancamentos
              : `${copy.busca.titulo} “${termo}”`}
      </h1>
      <div className="mt-6">
        {resultados.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-[8px] bg-superficie px-6 py-12 text-center">
            <p className="text-[0.9375rem] text-grafite">{copy.busca.nenhum(termo)}</p>
            <Link href="/busca?q=mais+vendidos" className="text-[0.9375rem] font-medium text-violeta underline">
              {copy.busca.explorar}
            </Link>
          </div>
        ) : (
          <>
            {aproximado && <p className="mb-4 text-[0.9375rem] text-grafite">{copy.busca.aproximado(termo)}</p>}
            <GradeFiltrada produtos={resultados} />
          </>
        )}
      </div>
    </div>
  );
}
