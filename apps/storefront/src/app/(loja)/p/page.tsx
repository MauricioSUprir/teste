import { Suspense } from "react";
import type { Metadata } from "next";
import { ProdutoLocalDetalhe } from "@/components/produto/ProdutoLocalDetalhe";

export const metadata: Metadata = { title: "Produto", robots: { index: false } };

/** Rota client-side dos produtos criados manualmente no admin (?slug=...). */
export default function PaginaProdutoLocal() {
  return (
    <Suspense>
      <ProdutoLocalDetalhe />
    </Suspense>
  );
}
