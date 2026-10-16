"use client";

import Link from "next/link";
import { copy } from "@/lib/copy";
import { notaMedia, obterMarca, temEstoque } from "@/lib/catalogo/consultas";
import { useProdutoAjustado } from "@/lib/catalogo/useProdutoAjustado";
import type { Produto } from "@/lib/catalogo/tipos";
import { DESCONTO_PIX_PCT, formatarPreco, parcelamento, percentualDesconto, precoPix } from "@/lib/preco";
import { useCarrinho } from "@/lib/carrinho/contexto";
import { PrecoProtegido } from "@/components/b2b/PrecoProtegido";
import { BotaoFavorito } from "./BotaoFavorito";
import { ImagemProduto } from "./ImagemProduto";
import { NotaEstrelas } from "./NotaEstrelas";

/** URL da página do produto — locais (criados no admin) usam a rota client /p */
export function urlProduto(produto: Produto): string {
  return produto.local ? `/p/?slug=${produto.slug}` : `/produto/${produto.slug}`;
}

/**
 * CardProduto — anatomia do design system (seção "Card de produto"):
 * selo dourado de desconto e coração no topo, foto em fundo branco com
 * "+ N opções", MARCA em caixa alta, nome em 2 linhas, estrelas, preço
 * De/Por, preço Pix em destaque com "ou R$ X no cartão", e botão
 * "Adicionar" de largura total.
 *
 * O card é um <article>: o link cobre foto e texto; o coração e o botão ficam
 * fora do link (botão dentro de link é HTML inválido). Produto com mais de uma
 * opção leva à página dele em vez de adicionar uma opção às cegas. Com preço
 * fechado (LOJA.precoFechado) preço e botão só aparecem com o CNPJ aprovado (PrecoProtegido).
 * Após a hidratação aplica os ajustes manuais do admin (editar/excluir).
 */
export function CardProduto({
  produto: produtoBase,
  prioridade = false,
}: {
  produto: Produto;
  /** cards da primeira dobra: a foto carrega na frente, sem esperar o scroll */
  prioridade?: boolean;
}) {
  const ajustado = useProdutoAjustado(produtoBase);
  const carrinho = useCarrinho();
  if (ajustado === null) return null;
  const produto = ajustado;

  const marca = obterMarca(produto.marca);
  const variante = produto.variantes.find((v) => v.estoque > 0) ?? produto.variantes[0];
  const { media, total } = notaMedia(produto);
  const disponivel = temEstoque(produto);
  const temOpcoes = produto.variantes.length > 1;
  const desconto =
    variante.precoDe && variante.precoDe > variante.precoPor
      ? percentualDesconto(variante.precoDe, variante.precoPor)
      : null;
  const parcela = parcelamento(variante.precoPor);
  const alt = `${marca?.nome ?? ""} ${produto.titulo} ${variante.tituloVariacao}`.trim();
  const url = urlProduto(produto);


  return (
    <article className="group relative flex flex-col rounded-[8px] border border-linha bg-white p-4 transition-colors hover:border-[#d6d6d6]">
      <div className="absolute right-3 top-3 z-10">
        <BotaoFavorito slug={produto.slug} />
      </div>

      <Link href={url} className="flex grow flex-col rounded-[4px]">
        <div className="relative">
          <div className="absolute left-0 top-0 z-10 flex flex-col items-start gap-1">
            {desconto !== null && disponivel && (
              <span className="rounded-[4px] bg-selo px-1 py-0.5 text-[0.6875rem] font-medium leading-none text-tinta num">
                -{desconto}%
              </span>
            )}
          </div>
          <div className={disponivel ? "" : "opacity-45 grayscale"}>
            <ImagemProduto produto={produto} alt={alt} prioridade={prioridade} />
          </div>
          {!disponivel && (
            <span className="absolute bottom-2 left-1/2 z-10 -translate-x-1/2 rounded-[40px] bg-tinta/80 px-3 py-1 text-[0.75rem] font-medium text-white">
              {copy.card.esgotado}
            </span>
          )}
          {disponivel && temOpcoes && (
            <span className="absolute bottom-1 left-0 z-10 rounded-[4px] bg-white/95 px-1.5 py-0.5 text-[0.75rem] text-grafite num">
              + {produto.variantes.length} {copy.card.opcoes}
            </span>
          )}
        </div>

        <div className="mt-3 flex grow flex-col">
          {produto.lancamento && (
            <span className="mb-1.5 self-start rounded-[40px] border border-violeta px-2 py-0.5 text-[0.6875rem] font-medium text-violeta">
              {copy.card.lancamento}
            </span>
          )}
          <span className="text-[0.875rem] font-bold uppercase leading-tight text-tinta">{marca?.nome}</span>
          <h3 className="mt-0.5 line-clamp-2 min-h-[2.86em] text-[0.875rem] leading-[1.43] text-grafite">
            {produto.titulo}
          </h3>

          {/* nota só com ≥ 3 avaliações — docs/03 */}
          <div className="mt-1 min-h-[1.25rem] text-[0.75rem] text-grafite">
            {total >= 3 && (
              <span className="inline-flex items-center gap-1">
                <NotaEstrelas nota={media} tamanho={13} />
                <span className="sr-only">
                  {copy.card.nota(media.toFixed(1).replace(".", ","))}
                </span>
                <span className="num">({total})</span>
              </span>
            )}
          </div>

          {disponivel ? (
            <div className="mt-1">
              <PrecoProtegido comLink={false} compacto>
                {variante.precoDe && variante.precoDe > variante.precoPor ? (
                  <s className="num block text-[0.75rem] text-cinza">
                    {copy.card.de} {formatarPreco(variante.precoDe)}
                  </s>
                ) : (
                  <span className="block min-h-[1.0625rem]" aria-hidden="true" />
                )}
                <p className="num text-[1rem] font-bold leading-snug text-roxo">
                  {formatarPreco(precoPix(variante.precoPor))}{" "}
                  <span className="text-[0.75rem] font-medium">
                    {copy.card.noPix}
                    {/* no celular o card é estreito: o "% OFF" quebrava a linha */}
                    <span className="hidden sm:inline"> {DESCONTO_PIX_PCT}% OFF</span>
                  </span>
                </p>
                <p className="num text-[0.75rem] text-grafite">
                  {copy.card.ouNoCartao(formatarPreco(variante.precoPor))}
                  {parcela.vezes > 1 && (
                    <>
                      {" "}
                      {copy.card.ate} {parcela.vezes}x {copy.card.semJuros}
                    </>
                  )}
                </p>
              </PrecoProtegido>
            </div>
          ) : (
            <p className="mt-1 text-[0.875rem] text-cinza">{copy.pdp.aviseMe}</p>
          )}
        </div>
      </Link>

      {disponivel && (
        <PrecoProtegido comLink={false} compacto oculto>
          {temOpcoes ? (
            <Link
              href={url}
              tabIndex={-1}
              className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-[4px] border border-roxo text-[1rem] font-medium text-roxo hover:bg-roxo-claro"
            >
              {copy.card.verOpcoes}
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => carrinho.adicionar(produto.slug, variante.sku, 1)}
              aria-label={`${copy.card.adicionar} ${alt}`}
              className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-[4px] bg-roxo text-[1rem] font-medium text-white hover:bg-roxo-escuro"
            >
              <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
                <path d="M3.5 6 H14.5 L13.6 15.2 a1.5 1.5 0 0 1 -1.5 1.3 H5.9 a1.5 1.5 0 0 1 -1.5 -1.3 Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M6.2 6 V5 a2.8 2.8 0 0 1 5.6 0 V6" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              {copy.card.adicionar}
            </button>
          )}
        </PrecoProtegido>
      )}
    </article>
  );
}
