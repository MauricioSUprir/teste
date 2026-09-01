"use client";

/** Galeria da PDP — carrossel com miniaturas/dots, sem CLS (ticket 3.2). */
import { useState } from "react";
import type { Produto } from "@/lib/catalogo/tipos";
import { ImagemProduto } from "./ImagemProduto";

export function GaleriaPDP({ produto, alt }: { produto: Produto; alt: string }) {
  const [ativa, setAtiva] = useState(0);
  // fotos reais quando existem; senão, 3 variações do placeholder
  const TOTAL_FOTOS = produto.imagens?.length ? produto.imagens.length : 3;

  return (
    <div>
      <div className="overflow-hidden rounded-[16px] border border-linha">
        <ImagemProduto produto={produto} alt={alt} variacao={ativa} />
      </div>
      {TOTAL_FOTOS > 1 && (
      // rola na horizontal quando não cabem — nada vaza da tela no celular
      <div
        className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1"
        role="tablist"
        aria-label="Fotos do produto"
      >
        {Array.from({ length: TOTAL_FOTOS }, (_, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === ativa}
            aria-label={`Foto ${i + 1} de ${TOTAL_FOTOS}`}
            onClick={() => setAtiva(i)}
            className={`w-16 shrink-0 overflow-hidden rounded-[6px] border-2 transition-colors ${
              i === ativa ? "border-roxo" : "border-linha hover:border-cinza"
            }`}
          >
            <ImagemProduto produto={produto} alt="" variacao={i} />
          </button>
        ))}
      </div>
      )}
    </div>
  );
}
