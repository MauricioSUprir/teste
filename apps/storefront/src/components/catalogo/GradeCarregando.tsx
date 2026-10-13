import type { Produto } from "@/lib/catalogo/tipos";
import { CardProduto } from "@/components/produto/CardProduto";
import { POR_PAGINA } from "@/lib/catalogo/paginacao";

/**
 * Fallback da <GradeFiltrada> no HTML estático. A grade lê os filtros da URL
 * (useSearchParams), então no export estático ela só aparece depois de o
 * JavaScript carregar — e, até lá, a página vinha vazia e o rodapé subia
 * para a tela, pulando para baixo quando os produtos chegavam (CLS 0,5).
 * Aqui a primeira página de produtos já vem pronta, no mesmo molde da grade.
 */
export function GradeCarregando({ produtos }: { produtos: Produto[] }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <div className="hidden lg:block" />
      <div>
        <div className="mb-4 h-10" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {produtos.slice(0, POR_PAGINA).map((p, i) => (
            <CardProduto key={p.slug} produto={p} prioridade={i < 4} />
          ))}
        </div>
      </div>
    </div>
  );
}
