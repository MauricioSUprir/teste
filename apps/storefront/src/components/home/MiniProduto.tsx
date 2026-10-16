"use client";

/**
 * Produto em linha, para os cards do "trio de vitrines" da home: foto
 * pequena, marca, nome e preço no Pix. O link cobre a linha toda; na loja de
 * preço fechado (LOJA.precoFechado) o preço só aparece com o CNPJ aprovado.
 */
import Link from "next/link";
import { obterMarca } from "@/lib/catalogo/consultas";
import { useProdutoAjustado } from "@/lib/catalogo/useProdutoAjustado";
import type { Produto } from "@/lib/catalogo/tipos";
import { copy } from "@/lib/copy";
import { formatarPreco, percentualDesconto, precoPix } from "@/lib/preco";
import { PrecoProtegido } from "@/components/b2b/PrecoProtegido";
import { urlProduto } from "@/components/produto/CardProduto";
import { ImagemProduto } from "@/components/produto/ImagemProduto";

export function MiniProduto({ produto: produtoBase }: { produto: Produto }) {
  const produto = useProdutoAjustado(produtoBase);
  if (!produto) return null;
  const marca = obterMarca(produto.marca);
  const variante = produto.variantes.find((v) => v.estoque > 0) ?? produto.variantes[0];
  const desconto =
    variante.precoDe && variante.precoDe > variante.precoPor
      ? percentualDesconto(variante.precoDe, variante.precoPor)
      : null;

  return (
    <li>
      <Link href={urlProduto(produto)} className="flex items-center gap-3 rounded-[4px] py-2 hover:bg-superficie">
        <span className="relative w-[72px] shrink-0">
          <ImagemProduto produto={produto} alt="" />
          {desconto !== null && (
            <span className="absolute left-0 top-0 rounded-[4px] bg-selo px-1 py-0.5 text-[0.6875rem] font-medium leading-none text-tinta num">
              -{desconto}%
            </span>
          )}
        </span>
        <div className="min-w-0">
          <span className="block text-[0.75rem] font-bold uppercase leading-tight text-tinta">{marca?.nome}</span>
          <span className="mt-0.5 line-clamp-2 block text-[0.8125rem] leading-snug text-grafite">{produto.titulo}</span>
          <div className="mt-1">
            <PrecoProtegido comLink={false} compacto>
              <p className="num text-[0.875rem] font-bold text-roxo">
                {formatarPreco(precoPix(variante.precoPor))}{" "}
                <span className="text-[0.75rem] font-medium">{copy.card.noPix}</span>
              </p>
            </PrecoProtegido>
          </div>
        </div>
      </Link>
    </li>
  );
}
