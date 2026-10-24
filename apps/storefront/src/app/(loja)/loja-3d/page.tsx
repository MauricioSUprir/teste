import type { Metadata } from "next";
import { copy } from "@/lib/copy";
import { LOJA } from "@/lib/loja";
import { categorias, produtosPorCategoria } from "@/lib/catalogo/consultas";
import type { CategoriaSlug, Produto } from "@/lib/catalogo/tipos";
import { Loja3D, type Corredor3D } from "@/components/loja3d/Loja3D";

// versão de teste: fora do Google até ser aprovada
export const metadata: Metadata = {
  title: copy.loja3d.titulo,
  description: copy.loja3d.descricao(LOJA.nome),
  robots: { index: false, follow: false },
};

/** por corredor, no máximo isso de produtos diferentes (as frentes repetem) */
const POR_CORREDOR = 48;

const vitrinavel = (p: Produto) => (p.imagens?.length ?? 0) > 0 && p.variantes.some((v) => v.estoque > 0);

/** alterna as marcas, para a prateleira não virar uma marca só */
function variados(lista: Produto[], n: number): Produto[] {
  const porMarca = new Map<string, Produto[]>();
  for (const p of lista) porMarca.set(p.marca, [...(porMarca.get(p.marca) ?? []), p]);
  const filas = [...porMarca.values()];
  const saida: Produto[] = [];
  for (let rodada = 0; saida.length < n && filas.some((f) => f.length > rodada); rodada++) {
    for (const fila of filas) {
      if (fila[rodada]) saida.push(fila[rodada]);
      if (saida.length === n) break;
    }
  }
  return saida;
}

/** Loja 3D — os corredores são as categorias, da mais cheia para a menor. */
export default function PaginaLoja3D() {
  const corredores: Corredor3D[] = categorias
    .map((c) => {
      const lista = produtosPorCategoria(c.slug as CategoriaSlug).filter(vitrinavel);
      return { slug: c.slug, nome: c.nome, produtos: variados(lista, POR_CORREDOR) };
    })
    .filter((c) => c.produtos.length >= 4)
    .sort((a, b) => b.produtos.length - a.produtos.length);

  return (
    <>
      <h1 className="sr-only">{copy.loja3d.titulo}</h1>
      <Loja3D corredores={corredores} />
    </>
  );
}
