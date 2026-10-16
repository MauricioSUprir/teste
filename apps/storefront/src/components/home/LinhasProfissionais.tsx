import Link from "next/link";
import { copy } from "@/lib/copy";
import type { Destaque } from "@/lib/catalogo/destaques";
import { ImagemProduto } from "@/components/produto/ImagemProduto";

/**
 * Cartões das linhas profissionais (Evoly, 1 litro, finalizadores,
 * descoloração D'vence, Theoric). No celular deslizam de lado; no desktop
 * ficam os cinco na mesma fileira.
 */
export function LinhasProfissionais({ destaques, prioridade = false }: { destaques: Destaque[]; prioridade?: boolean }) {
  return (
    <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-5 md:gap-4 md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden">
      {destaques.map((d) => {
        const vitrine = d.produtos.find((p) => (p.imagens?.length ?? 0) > 0) ?? d.produtos[0];
        return (
          <li key={d.slug} className="w-[44%] shrink-0 snap-start sm:w-[30%] md:w-auto">
            <Link
              href={`/destaques/${d.slug}`}
              className="group flex h-full flex-col overflow-hidden rounded-[8px] border border-linha bg-white transition-colors hover:border-roxo"
            >
              <span className="block overflow-hidden p-3">
                <ImagemProduto
                  produto={vitrine}
                  alt=""
                  prioridade={prioridade}
                  className="transition-transform duration-300 group-hover:scale-[1.04]"
                />
              </span>
              <span className="flex grow flex-col gap-0.5 border-t border-linha px-3 py-3">
                <span className="text-[0.9375rem] font-bold uppercase leading-tight text-tinta">{d.nome}</span>
                <span className="text-[0.8125rem] leading-snug text-grafite">{d.chamada}</span>
                <span className="num mt-auto pt-1 text-[0.75rem] font-medium text-roxo">
                  {copy.destaques.produtos(d.produtos.length)} →
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
