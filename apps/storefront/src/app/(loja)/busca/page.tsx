import { Suspense } from "react";
import type { Metadata } from "next";
import { BuscaResultados } from "@/components/catalogo/BuscaResultados";

export const metadata: Metadata = { title: "Busca" };

/**
 * A leitura do termo acontece no cliente (useSearchParams) para a rota ser
 * 100% estática — compatível com ISR/CDN e com export estático.
 */
export default function PaginaBusca() {
  return (
    <Suspense>
      <BuscaResultados />
    </Suspense>
  );
}
