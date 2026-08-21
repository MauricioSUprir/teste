"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { obterMarca, obterProduto } from "@/lib/catalogo/consultas";
import type { Produto } from "@/lib/catalogo/tipos";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ColunaCompra } from "./ColunaCompra";
import { ImagemProduto } from "./ImagemProduto";

/**
 * PDP dos produtos criados manualmente no painel admin. Eles vivem no
 * navegador (não têm página estática própria), então a rota /p renderiza
 * tudo no cliente a partir do slug em ?slug=.
 */
export function ProdutoLocalDetalhe() {
  const params = useSearchParams();
  const slug = params.get("slug") ?? "";
  const [produto, setProduto] = useState<Produto | null>(null);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    setProduto(obterProduto(slug) ?? null);
    setCarregado(true);
  }, [slug]);

  if (!carregado) return <div className="container-bn py-16" aria-busy="true" />;

  if (!produto) {
    return (
      <div className="container-bn flex flex-col items-center gap-4 py-24 text-center">
        <p className="text-[1rem] text-grafite">
          Produto não encontrado. Ele pode ter sido removido do catálogo.
        </p>
        <Link
          href="/"
          className="rounded-[999px] bg-roxo px-6 py-3 text-[0.9375rem] font-semibold text-white hover:bg-roxo-escuro"
        >
          Voltar para a loja
        </Link>
      </div>
    );
  }

  const marca = obterMarca(produto.marca);

  return (
    <div className="container-bn py-6 pb-32 md:pb-6">
      <Breadcrumb itens={[{ rotulo: produto.titulo }]} />
      <div className="mt-4 grid gap-8 md:grid-cols-2">
        <div className="overflow-hidden rounded-[16px] border border-linha bg-white">
          <ImagemProduto produto={produto} alt={produto.titulo} />
        </div>
        <div>
          {marca && (
            <Link
              href={`/marca/${marca.slug}`}
              className="text-[0.8125rem] font-medium uppercase tracking-wide text-violeta hover:underline"
            >
              {marca.nome}
            </Link>
          )}
          <h1 className="font-titulo mt-1 text-[clamp(1.375rem,3vw,1.875rem)] font-semibold leading-snug">
            {produto.titulo}
          </h1>
          <ColunaCompra produto={produto} />
        </div>
      </div>

      {produto.descricao && (
        <section className="mt-10 max-w-[70ch]">
          <h2 className="font-titulo text-[1.25rem] font-semibold">Sobre o produto</h2>
          <p className="mt-3 whitespace-pre-line text-[0.9375rem] leading-relaxed text-grafite">
            {produto.descricao}
          </p>
        </section>
      )}
    </div>
  );
}
