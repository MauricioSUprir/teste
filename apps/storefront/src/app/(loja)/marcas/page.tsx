import type { Metadata } from "next";
import Link from "next/link";
import { copy } from "@/lib/copy";
import { marcas, produtosPorMarca } from "@/lib/catalogo/consultas";
import { Breadcrumb } from "@/components/layout/Breadcrumb";

export const metadata: Metadata = {
  title: "Nossas marcas",
  description:
    "Todas as marcas da BeautyNow: distribuição autorizada com garantia de originalidade.",
};

/** Vitrine de todas as marcas, com foto real de cada uma. */
export default function PaginaMarcas() {
  const lista = [...marcas].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  return (
    <div className="container-bn py-6">
      <Breadcrumb itens={[{ rotulo: copy.nav.marcas }]} />
      <h1 className="font-titulo mt-2 text-[clamp(1.625rem,3.5vw,2.25rem)] font-semibold">
        Nossas marcas
      </h1>
      <p className="mt-1 max-w-[70ch] text-[0.9375rem] text-grafite">
        Distribuição autorizada: todo produto é 100% original, direto do fabricante.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {lista.map((m) => {
          const total = produtosPorMarca(m.slug).length;
          return (
            <Link
              key={m.slug}
              href={`/marca/${m.slug}`}
              className="group flex flex-col items-center rounded-[16px] border border-linha bg-white p-4 text-center transition-shadow hover:shadow-card"
            >
              <span className="flex h-32 w-full items-center justify-center overflow-hidden rounded-[10px] bg-superficie">
                {m.imagem ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={m.imagem}
                    alt={`Produto ${m.nome}`}
                    loading="lazy"
                    className="h-full w-full object-contain p-2 transition-transform group-hover:scale-105"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="flex h-14 w-14 items-center justify-center rounded-full text-[1.5rem] font-bold text-white"
                    style={{ background: m.cor }}
                  >
                    {m.nome.charAt(0)}
                  </span>
                )}
              </span>
              <span className="mt-3 text-[0.9375rem] font-semibold text-tinta">{m.nome}</span>
              <span className="num mt-0.5 text-[0.75rem] text-cinza">
                {total} {total === 1 ? copy.plp.produto : copy.plp.produtos}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
