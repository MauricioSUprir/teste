"use client";

import { useEffect, useState } from "react";
import { produtosLocais } from "@/lib/catalogo/ajustes";
import type { Produto } from "@/lib/catalogo/tipos";
import { ItemPrateleira } from "@/components/home/Prateleira";
import { CardProduto } from "./CardProduto";

/**
 * Cards dos produtos criados no painel admin com "destacar na home" marcado.
 * Renderiza nada no HTML estático; entra na grade após a hidratação.
 */
export function ProdutosLocaisDestaque({
  limite = 5,
  emPrateleira = false,
}: {
  limite?: number;
  /** dentro de uma <Prateleira>: cada card vira um item da lista */
  emPrateleira?: boolean;
}) {
  const [locais, setLocais] = useState<Produto[]>([]);

  useEffect(() => {
    setLocais(produtosLocais().filter((p) => p.maisVendido).slice(0, limite));
  }, [limite]);

  return (
    <>
      {locais.map((p) =>
        emPrateleira ? (
          <ItemPrateleira key={p.slug}>
            <CardProduto produto={p} />
          </ItemPrateleira>
        ) : (
          <CardProduto key={p.slug} produto={p} />
        )
      )}
    </>
  );
}
