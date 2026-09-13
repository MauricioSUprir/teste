import Link from "next/link";
import { NEGOCIO } from "@/lib/negocio";

export interface ItemBreadcrumb {
  rotulo: string;
  href?: string;
}

export function Breadcrumb({ itens }: { itens: ItemBreadcrumb[] }) {
  // marcação de trilha para o Google (mostra o caminho no resultado de busca)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: NEGOCIO.site + "/" },
      ...itens.map((item, i) => ({
        "@type": "ListItem",
        position: i + 2,
        name: item.rotulo,
        ...(item.href ? { item: NEGOCIO.site + item.href } : {}),
      })),
    ],
  };

  return (
    <nav aria-label="Trilha de navegação" className="text-[0.8125rem] text-cinza">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ol className="flex flex-wrap items-center gap-1.5">
        <li>
          <Link href="/" className="hover:text-roxo">
            Início
          </Link>
        </li>
        {itens.map((item, i) => (
          <li key={`${item.rotulo}-${i}`} className="flex items-center gap-1.5">
            <span aria-hidden="true">/</span>
            {item.href ? (
              <Link href={item.href} className="hover:text-roxo">
                {item.rotulo}
              </Link>
            ) : (
              <span aria-current="page" className="text-grafite">
                {item.rotulo}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
