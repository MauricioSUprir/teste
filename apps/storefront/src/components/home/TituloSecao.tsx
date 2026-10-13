import Link from "next/link";
import { copy } from "@/lib/copy";

/** Título de seção da home — design system: 32–36px, peso 400, centralizado. */
export function TituloSecao({ id, children, link }: { id?: string; children: React.ReactNode; link?: string }) {
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <h2 id={id} className="font-titulo text-[clamp(1.625rem,3vw,2.25rem)] font-normal leading-tight text-tinta">
        {children}
      </h2>
      {link && (
        <Link href={link} className="text-[0.875rem] font-medium text-violeta hover:underline">
          {copy.home.verTudo} →
        </Link>
      )}
    </div>
  );
}
