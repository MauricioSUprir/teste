import Link from "next/link";

export interface ItemBreadcrumb {
  rotulo: string;
  href?: string;
}

export function Breadcrumb({ itens }: { itens: ItemBreadcrumb[] }) {
  return (
    <nav aria-label="Trilha de navegação" className="text-[0.8125rem] text-cinza">
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
