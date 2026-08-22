"use client";

/** "Compre junto" — bundle com 10% de desconto, adiciona tudo de uma vez (ticket 3.6). */
import Link from "next/link";
import { copy } from "@/lib/copy";
import { useB2B } from "@/lib/b2b/contexto";
import { useCarrinho } from "@/lib/carrinho/contexto";
import type { Produto } from "@/lib/catalogo/tipos";
import { formatarPreco } from "@/lib/preco";
import { ImagemProduto } from "./ImagemProduto";

const DESCONTO_COMBO_PCT = 10;

export function CompreJunto({
  principal,
  companheiros,
}: {
  principal: Produto;
  companheiros: Produto[];
}) {
  const carrinho = useCarrinho();
  const { liberado } = useB2B();
  const itens = [principal, ...companheiros].filter((p) =>
    p.variantes.some((v) => v.estoque > 0)
  );
  // combo é atalho de compra — sem preço liberado (Be2Beauty) não aparece
  if (!liberado || itens.length < 2) return null;

  const variantes = itens.map((p) => p.variantes.find((v) => v.estoque > 0)!);
  const totalCheio = variantes.reduce((acc, v) => acc + v.precoPor, 0);
  const totalCombo = Math.round(totalCheio * (1 - DESCONTO_COMBO_PCT / 100));

  function adicionarCombo() {
    itens.forEach((p, i) => carrinho.adicionar(p.slug, variantes[i].sku, 1));
  }

  return (
    <section aria-labelledby="compre-junto-titulo" className="rounded-[16px] border border-linha p-5">
      <h2 id="compre-junto-titulo" className="font-titulo text-[1.375rem] font-semibold">
        {copy.pdp.compreJunto}
      </h2>
      <p className="mt-1 text-[0.875rem] text-sucesso">{copy.pdp.compreJuntoDesconto}</p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {itens.map((p, i) => (
          <div key={p.slug} className="flex items-center gap-3">
            {i > 0 && (
              <span aria-hidden="true" className="text-[1.25rem] font-light text-cinza">
                +
              </span>
            )}
            <Link
              href={`/produto/${p.slug}`}
              className="block w-24 overflow-hidden rounded-[10px] border border-linha hover:border-roxo sm:w-28"
              title={p.titulo}
            >
              <ImagemProduto produto={p} alt={p.titulo} />
            </Link>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <p>
          <s className="num text-[0.875rem] text-cinza">{formatarPreco(totalCheio)}</s>{" "}
          <span className="num text-[1.25rem] font-bold text-tinta">{formatarPreco(totalCombo)}</span>{" "}
          <span className="text-[0.8125rem] font-medium text-sucesso">
            (-{DESCONTO_COMBO_PCT}%)
          </span>
        </p>
        <button
          type="button"
          onClick={adicionarCombo}
          className="rounded-[999px] border-2 border-roxo px-6 py-2.5 text-[0.9375rem] font-semibold text-roxo transition-colors hover:bg-roxo hover:text-white"
        >
          {copy.pdp.adicionarCombo}
        </button>
      </div>
    </section>
  );
}
