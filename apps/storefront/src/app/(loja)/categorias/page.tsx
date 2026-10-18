import type { Metadata } from "next";
import Link from "next/link";
import { LOJA } from "@/lib/loja";
import { copy } from "@/lib/copy";
import { categorias, produtosPorCategoria } from "@/lib/catalogo/consultas";
import type { CategoriaSlug, Produto } from "@/lib/catalogo/tipos";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ImagemProduto } from "@/components/produto/ImagemProduto";

export const metadata: Metadata = {
  title: "Categorias",
  description: `Compre por categoria na ${LOJA.nome}: encontre o que precisa pelo tipo de produto.`,
};

const t = copy.home;
const comFoto = (p: Produto) => (p.imagens?.length ?? 0) > 0;
const temEstoque = (p: Produto) => p.variantes.some((v) => v.estoque > 0);

/** Índice de todas as categorias, cada uma com uma foto que a representa. */
export default function PaginaCategorias() {
  const lista = categorias
    .map((c) => {
      const produtos = produtosPorCategoria(c.slug as CategoriaSlug);
      return { ...c, total: produtos.length, foto: produtos.find((p) => comFoto(p) && temEstoque(p)) ?? produtos.find(comFoto) };
    })
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total);

  return (
    <div className="container-bn py-6">
      <Breadcrumb itens={[{ rotulo: t.porCategoria }]} />
      <h1 className="font-titulo mt-2 text-[clamp(1.625rem,3.5vw,2.25rem)] font-semibold">
        {t.porCategoria}
      </h1>
      <p className="mt-1 max-w-[70ch] text-[0.9375rem] text-grafite">
        Escolha pelo tipo de produto e veja tudo da categoria.
      </p>

      <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4">
        {lista.map((c, i) => (
          <li key={c.slug}>
            <Link
              href={`/categoria/${c.slug}`}
              className="group flex h-full flex-col overflow-hidden rounded-[8px] border border-roxo/25 bg-white transition-colors hover:border-roxo/60"
            >
              <div className="bg-white">
                {c.foto ? (
                  <ImagemProduto produto={c.foto} alt="" prioridade={i < 4} />
                ) : (
                  <span className="flex aspect-square items-center justify-center text-[0.75rem] text-cinza">
                    {c.nome}
                  </span>
                )}
              </div>
              <div className="border-t border-linha px-3 py-3">
                <span className="block text-[0.9375rem] font-semibold leading-tight text-tinta group-hover:text-roxo">
                  {c.nome}
                </span>
                <span className="mt-0.5 block text-[0.75rem] text-grafite num">
                  {c.total} {c.total === 1 ? "produto" : "produtos"}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
