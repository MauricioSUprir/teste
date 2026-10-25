/**
 * Ficha do produto na loja 3D (lib/catalogo/ficha.ts): tipo, público, cabelo
 * ou pele, ação, acabamento, tom, tamanho e selos. Em linhas no balão do
 * mouse; em etiquetas curtas no card (onde o espaço é pouco, como no celular).
 */
import { copy } from "@/lib/copy";
import type { Ficha } from "@/lib/catalogo/ficha";

const t = copy.loja3d.ficha;

/** as linhas que a ficha tem, na ordem em que interessam */
function linhas(f: Ficha): [string, string][] {
  const lista: [string, string | null][] = [
    [t.tipo, f.tipo],
    [t.para, f.para.join(", ") || null],
    [t.cabelo, f.cabelo.join(", ") || null],
    [t.pele, f.pele.join(", ") || null],
    [t.tom, f.tom],
    [t.acao, f.acao.join(", ") || null],
    [t.acabamento, f.acabamento.join(", ") || null],
    [t.tamanho, f.tamanho],
  ];
  return lista.filter((l): l is [string, string] => !!l[1]);
}

export function FichaProduto({ ficha, compacta = false }: { ficha: Ficha; compacta?: boolean }) {
  const itens = linhas(ficha);
  if (compacta) {
    const etiquetas = [...itens.map(([, v]) => v), ...ficha.selos];
    if (!etiquetas.length) return null;
    return (
      <ul className="flex flex-wrap gap-1.5">
        {etiquetas.map((e) => (
          <li key={e} className="rounded-[40px] bg-roxo-claro px-2 py-0.5 text-[0.6875rem] font-medium text-roxo">
            {e}
          </li>
        ))}
      </ul>
    );
  }
  return (
    <>
      {itens.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[0.75rem]">
          {itens.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-cinza">{k}</dt>
              <dd className="font-medium text-tinta">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {ficha.selos.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {ficha.selos.map((s) => (
            <li key={s} className="rounded-[40px] bg-roxo-claro px-2 py-0.5 text-[0.6875rem] font-medium text-roxo">
              {s}
            </li>
          ))}
        </ul>
      )}
      {ficha.resumo && <p className="mt-2 line-clamp-3 text-[0.75rem] leading-snug text-grafite">{ficha.resumo}</p>}
    </>
  );
}
