"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { copy } from "@/lib/copy";
import { useCarrinho } from "@/lib/carrinho/contexto";
import { PEDIDO_MINIMO_CENTAVOS, formatarPreco, precoPix } from "@/lib/preco";
import { ImagemProduto } from "@/components/produto/ImagemProduto";
import { BarraFreteGratis } from "./BarraFreteGratis";

/** Drawer lateral de carrinho — docs/03 §5, ticket 4.1. */
export function DrawerCarrinho() {
  const carrinho = useCarrinho();
  const painel = useRef<HTMLDivElement>(null);

  // fecha com Esc e move o foco para o painel ao abrir
  useEffect(() => {
    if (!carrinho.aberto) return;
    painel.current?.focus();
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") carrinho.fechar();
    }
    document.addEventListener("keydown", aoTeclar);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = "";
    };
  }, [carrinho.aberto, carrinho]);

  const abaixoDoMinimo =
    carrinho.itens.length > 0 && carrinho.subtotalCentavos < PEDIDO_MINIMO_CENTAVOS;

  return (
    <div
      aria-hidden={!carrinho.aberto}
      className={carrinho.aberto ? "" : "pointer-events-none invisible"}
    >
      {/* fundo */}
      <button
        type="button"
        tabIndex={-1}
        aria-label={copy.carrinho.fechar}
        onClick={carrinho.fechar}
        className={`fixed inset-0 z-40 bg-tinta/40 transition-opacity duration-200 ${
          carrinho.aberto ? "opacity-100" : "opacity-0"
        }`}
      />
      {/* painel */}
      <div
        ref={painel}
        role="dialog"
        aria-modal="true"
        aria-label={copy.carrinho.titulo}
        tabIndex={-1}
        className={`drawer-slide fixed right-0 top-0 z-50 flex h-dvh w-full max-w-[420px] flex-col bg-white shadow-drawer ${
          carrinho.aberto ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-linha px-4 py-3">
          <h2 className="font-titulo text-[1.25rem] font-semibold">
            {copy.carrinho.titulo}
            {carrinho.totalItens > 0 && (
              <span className="num ml-2 text-[0.875rem] font-normal text-cinza">
                ({carrinho.totalItens})
              </span>
            )}
          </h2>
          <button
            type="button"
            onClick={carrinho.fechar}
            aria-label={copy.carrinho.fechar}
            className="flex h-11 w-11 items-center justify-center rounded-[6px] hover:bg-superficie"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path d="M4 4 L14 14 M14 4 L4 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {carrinho.itens.length === 0 ? (
          <div className="flex grow flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="text-[0.9375rem] text-grafite">{copy.carrinho.vazio}</p>
            <Link
              href="/busca?q=mais+vendidos"
              onClick={carrinho.fechar}
              className="rounded-[999px] bg-rosa px-6 py-3 text-[0.9375rem] font-semibold text-white hover:bg-rosa-escuro"
            >
              {copy.carrinho.verMaisVendidos}
            </Link>
          </div>
        ) : (
          <>
            <div className="border-b border-linha px-4 py-3">
              <BarraFreteGratis subtotalCentavos={carrinho.subtotalCentavos} />
            </div>

            <ul className="grow overflow-y-auto px-4 py-2">
              {carrinho.itens.map((item) => (
                <li key={item.sku} className="flex gap-3 border-b border-linha py-3 last:border-0">
                  <Link
                    href={`/produto/${item.produtoSlug}`}
                    onClick={carrinho.fechar}
                    className="w-20 shrink-0 overflow-hidden rounded-[6px] border border-linha"
                  >
                    <ImagemProduto produto={item.produto} alt={item.produto.titulo} />
                  </Link>
                  <div className="flex min-w-0 grow flex-col">
                    <Link
                      href={`/produto/${item.produtoSlug}`}
                      onClick={carrinho.fechar}
                      className="line-clamp-2 text-[0.875rem] leading-snug text-tinta hover:text-rosa"
                    >
                      {item.produto.titulo}
                    </Link>
                    <span className="mt-0.5 text-[0.75rem] text-cinza">
                      {item.variante.tituloVariacao}
                    </span>
                    <div className="mt-auto flex items-center justify-between pt-2">
                      <div className="flex items-center rounded-[6px] border border-linha">
                        <button
                          type="button"
                          aria-label={`Diminuir quantidade de ${item.produto.titulo}`}
                          onClick={() => carrinho.alterarQuantidade(item.sku, item.quantidade - 1)}
                          disabled={item.quantidade <= 1}
                          className="h-8 w-8 text-grafite disabled:opacity-30"
                        >
                          −
                        </button>
                        <span className="num w-7 text-center text-[0.875rem]">{item.quantidade}</span>
                        <button
                          type="button"
                          aria-label={`Aumentar quantidade de ${item.produto.titulo}`}
                          onClick={() => carrinho.alterarQuantidade(item.sku, item.quantidade + 1)}
                          disabled={item.quantidade >= item.variante.estoque}
                          className="h-8 w-8 text-grafite disabled:opacity-30"
                        >
                          +
                        </button>
                      </div>
                      <span className="num text-[0.9375rem] font-semibold">
                        {formatarPreco(item.variante.precoPor * item.quantidade)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => carrinho.remover(item.sku)}
                      className="mt-1.5 self-start text-[0.75rem] text-cinza underline hover:text-erro"
                    >
                      {copy.carrinho.remover}
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <div className="border-t border-linha px-4 py-4">
              <dl className="space-y-1 text-[0.9375rem]">
                <div className="flex justify-between">
                  <dt className="text-grafite">{copy.carrinho.subtotal}</dt>
                  <dd className="num font-medium">{formatarPreco(carrinho.subtotalCentavos)}</dd>
                </div>
                <div className="flex justify-between text-sucesso">
                  <dt>{copy.carrinho.totalNoPix}</dt>
                  <dd className="num font-semibold">
                    {formatarPreco(precoPix(carrinho.subtotalCentavos))}
                  </dd>
                </div>
              </dl>

              {abaixoDoMinimo && (
                <p className="mt-3 rounded-[6px] bg-rosa-claro px-3 py-2 text-[0.8125rem] text-rosa-escuro">
                  {copy.carrinho.pedidoMinimo(formatarPreco(PEDIDO_MINIMO_CENTAVOS))}
                </p>
              )}

              <Link
                href="/checkout"
                onClick={carrinho.fechar}
                aria-disabled={abaixoDoMinimo}
                className={`mt-3 block rounded-[999px] py-3.5 text-center text-[1rem] font-semibold text-white ${
                  abaixoDoMinimo
                    ? "pointer-events-none bg-cinza"
                    : "bg-rosa hover:bg-rosa-escuro"
                }`}
              >
                {copy.carrinho.finalizarCompra}
              </Link>
              <button
                type="button"
                onClick={carrinho.fechar}
                className="mt-2 block w-full py-2 text-center text-[0.875rem] text-grafite underline"
              >
                {copy.carrinho.continuarComprando}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
