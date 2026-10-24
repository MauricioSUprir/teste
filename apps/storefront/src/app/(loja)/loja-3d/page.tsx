import type { Metadata } from "next";
import { copy } from "@/lib/copy";
import { LOJA } from "@/lib/loja";
import { comBase } from "@/lib/caminho";
import { categorias, marcas, produtos } from "@/lib/catalogo/consultas";
import type { Produto } from "@/lib/catalogo/tipos";
import { Loja3D, type Categoria3D, type Setor3D } from "@/components/loja3d/Loja3D";

// versão de teste: fora do Google até ser aprovada
export const metadata: Metadata = {
  title: copy.loja3d.titulo,
  description: copy.loja3d.descricao(LOJA.nome),
  robots: { index: false, follow: false },
};

/** por seção, no máximo isso de produtos diferentes (as frentes repetem) */
const POR_SECAO = 48;

const vitrinavel = (p: Produto) => (p.imagens?.length ?? 0) > 0 && p.variantes.some((v) => v.estoque > 0);

/**
 * Loja 3D — uma seção por marca, com a logo em cima. As marcas vão da maior para
 * a menor (a cena põe as maiores nos melhores lugares e junta as da mesma
 * categoria lado a lado); os botões de baixo levam a cada categoria.
 */
export default function PaginaLoja3D() {
  const porMarca = new Map<string, Produto[]>();
  for (const p of produtos) {
    if (!vitrinavel(p)) continue;
    porMarca.set(p.marca, [...(porMarca.get(p.marca) ?? []), p]);
  }

  const setores: Setor3D[] = [...porMarca.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([slug, lista]) => {
      const marca = marcas.find((m) => m.slug === slug);
      // categoria principal: a que mais aparece entre os produtos da marca
      const contagem = new Map<string, number>();
      for (const p of lista) contagem.set(p.categorias[0], (contagem.get(p.categorias[0]) ?? 0) + 1);
      const categoria = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0][0];
      return {
        slug,
        nome: marca?.nome ?? slug,
        logo: marca?.logo ? comBase(marca.logo) : undefined,
        categoria,
        produtos: lista.slice(0, POR_SECAO),
      };
    });

  // categorias na ordem do tamanho, só as que têm alguma marca na loja
  const peso = new Map<string, number>();
  for (const s of setores) peso.set(s.categoria, (peso.get(s.categoria) ?? 0) + s.produtos.length);
  const cats: Categoria3D[] = categorias
    .filter((c) => peso.has(c.slug))
    .sort((a, b) => (peso.get(b.slug) ?? 0) - (peso.get(a.slug) ?? 0))
    .map((c) => ({ slug: c.slug, nome: c.nome }));

  return (
    <>
      <h1 className="sr-only">{copy.loja3d.titulo}</h1>
      <Loja3D setores={setores} categorias={cats} />
    </>
  );
}
