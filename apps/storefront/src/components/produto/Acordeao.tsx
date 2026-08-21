/** Bloco colapsável acessível — usa <details>, navegável por teclado nativamente. */
export function Acordeao({
  titulo,
  abertoPorPadrao = false,
  children,
}: {
  titulo: string;
  abertoPorPadrao?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open={abertoPorPadrao}
      className="group border-b border-linha py-1 open:pb-4"
    >
      <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-3 py-2 text-[1.0625rem] font-semibold text-tinta [&::-webkit-details-marker]:hidden">
        {titulo}
        <span
          aria-hidden="true"
          className="text-cinza transition-transform duration-150 group-open:rotate-180"
        >
          <svg width="14" height="14" viewBox="0 0 14 14">
            <path d="M3 5 L7 9 L11 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </summary>
      <div className="text-[0.9375rem] leading-relaxed text-grafite">{children}</div>
    </details>
  );
}
