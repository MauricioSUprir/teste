"use client";

import { useEffect, useState } from "react";
import { EVENTO_AJUSTES, aplicarAjustesProduto } from "./ajustes";
import type { Produto } from "./tipos";

/**
 * Produto com os ajustes manuais do admin (preço editado, produto excluído)
 * aplicados depois da hidratação. Devolve `null` quando o admin escondeu o
 * produto. Os preços manuais podem chegar do servidor depois da montagem,
 * por isso escuta EVENTO_AJUSTES.
 */
export function useProdutoAjustado(produtoBase: Produto): Produto | null {
  const [produto, setProduto] = useState<Produto | null>(produtoBase);

  useEffect(() => {
    if (produtoBase.local) return; // produto local já vem com os dados finais
    const aplicar = () => setProduto(aplicarAjustesProduto(produtoBase));
    aplicar();
    window.addEventListener(EVENTO_AJUSTES, aplicar);
    return () => window.removeEventListener(EVENTO_AJUSTES, aplicar);
  }, [produtoBase]);

  return produto;
}
