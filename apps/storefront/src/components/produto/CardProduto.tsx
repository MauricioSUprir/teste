import Link from "next/link";
import { copy } from "@/lib/copy";
import { notaMedia, obterMarca, temEstoque } from "@/lib/catalogo/consultas";
import type { Produto } from "@/lib/catalogo/tipos";
import { formatarPreco, parcelamento, percentualDesconto, precoPix } from "@/lib/preco";
import { BotaoFavorito } from "./BotaoFavorito";
import { ImagemProduto } from "./ImagemProduto";

/**
 * CardProduto — anatomia fixa de docs/03 §5.
 * Em mobile o card inteiro é link; não há botão "Adicionar" (menos toque acidental).
 */
export function CardProduto({ produto }: { produto: Produto }) {
  const marca = obterMarca(produto.marca);
  const variante = produto.variantes[0];
  const { media, total } = notaMedia(produto);
  const disponivel = temEstoque(produto);
  const desconto =
    variante.precoDe && variante.precoDe > variante.precoPor
      ? percentualDesconto(variante.precoDe, variante.precoPor)
      : null;
  const parcela = parcelamento(variante.precoPor);
  const alt = `${marca?.nome ?? ""} ${produto.titulo} ${variante.tituloVariacao}`.trim();

  return (
    <Link
      href={`/produto/${produto.slug}`}
      className="group flex flex-col rounded-[10px] border border-linha bg-white p-3 transition-shadow hover:shadow-card"
    >
      <div className="relative">
        <div className="absolute right-0 top-0 z-10">
          <BotaoFavorito slug={produto.slug} />
        </div>
        <div className="absolute left-0 top-0 z-10 flex flex-col items-start gap-1">
          {desconto !== null && disponivel && (
            <span className="rounded-[6px] bg-oferta px-1.5 py-0.5 text-[0.75rem] font-semibold text-white num">
              -{desconto}%
            </span>
          )}
          {produto.lancamento && (
            <span className="rounded-[6px] bg-violeta px-1.5 py-0.5 text-[0.75rem] font-semibold text-white">
              {copy.card.lancamento}
            </span>
          )}
        </div>
        <div className={disponivel ? "" : "opacity-45 grayscale"}>
          <ImagemProduto produto={produto} alt={alt} />
        </div>
        {!disponivel && (
          <span className="absolute bottom-2 left-1/2 z-10 -translate-x-1/2 rounded-[999px] bg-tinta/80 px-3 py-1 text-[0.75rem] font-medium text-white">
            {copy.card.esgotado}
          </span>
        )}
      </div>

      <div className="mt-2 flex grow flex-col">
        <span className="text-[0.75rem] font-medium uppercase tracking-wide text-cinza">
          {marca?.nome}
        </span>
        <h3 className="mt-0.5 line-clamp-2 min-h-[2.6em] text-[0.9375rem] leading-snug text-tinta">
          {produto.titulo}
        </h3>

        {/* nota só com ≥ 3 avaliações — docs/03 */}
        <div className="mt-1 min-h-[1.25rem] text-[0.8125rem] text-grafite">
          {total >= 3 && (
            <span className="inline-flex items-center gap-1">
              <span aria-hidden="true" style={{ color: "#E8A317" }}>
                ★
              </span>
              <span className="num font-medium">{media.toFixed(1).replace(".", ",")}</span>
              <span className="num text-cinza">({total})</span>
            </span>
          )}
        </div>

        {disponivel ? (
          <div className="mt-1">
            <p className="flex items-baseline gap-2">
              <span className="num text-[1.0625rem] font-semibold text-tinta">
                {formatarPreco(variante.precoPor)}
              </span>
              {variante.precoDe && variante.precoDe > variante.precoPor && (
                <s className="num text-[0.8125rem] text-cinza">{formatarPreco(variante.precoDe)}</s>
              )}
            </p>
            <p className="num text-[0.875rem] font-medium text-sucesso">
              {formatarPreco(precoPix(variante.precoPor))} {copy.card.noPix}
            </p>
            <p className="num text-[0.75rem] text-cinza">
              ou {parcela.vezes}x de {formatarPreco(parcela.valor)} {copy.card.semJuros}
            </p>
          </div>
        ) : (
          <p className="mt-1 text-[0.875rem] text-cinza">{copy.pdp.aviseMe}</p>
        )}

        {produto.variantes.length > 1 && (
          <span className="mt-2 inline-block self-start rounded-[999px] border border-linha px-2 py-0.5 text-[0.75rem] text-grafite">
            + {produto.variantes.length} {copy.card.tamanhos}
          </span>
        )}
      </div>
    </Link>
  );
}
