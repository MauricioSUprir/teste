import { copy } from "@/lib/copy";
import type { Produto } from "@/lib/catalogo/tipos";
import { NotaEstrelas } from "./NotaEstrelas";

/** Bloco de avaliações com distribuição de notas e compra verificada (ticket 3.7). */
export function Avaliacoes({ produto }: { produto: Produto }) {
  const total = produto.avaliacoes.length;
  if (total === 0) return null;
  const media = produto.avaliacoes.reduce((acc, a) => acc + a.nota, 0) / total;
  const distribuicao = [5, 4, 3, 2, 1].map((n) => ({
    nota: n,
    qtd: produto.avaliacoes.filter((a) => a.nota === n).length,
  }));

  return (
    <section id="avaliacoes" aria-labelledby="avaliacoes-titulo">
      <h2 id="avaliacoes-titulo" className="font-titulo text-[1.375rem] font-semibold">
        Avaliações
      </h2>

      <div className="mt-4 grid gap-6 md:grid-cols-[220px_1fr]">
        <div>
          <p className="flex items-baseline gap-2">
            <span className="num text-[2.5rem] font-bold leading-none">
              {media.toFixed(1).replace(".", ",")}
            </span>
            <NotaEstrelas nota={media} tamanho={18} />
          </p>
          <p className="num mt-1 text-[0.875rem] text-cinza">
            {total} {total === 1 ? copy.pdp.avaliacao : copy.pdp.avaliacoes}
          </p>
          <ul className="mt-4 space-y-1.5">
            {distribuicao.map((d) => (
              <li key={d.nota} className="flex items-center gap-2 text-[0.8125rem] text-grafite">
                <span className="num w-3">{d.nota}</span>
                <span aria-hidden="true" style={{ color: "#E8A317" }}>★</span>
                <span className="h-1.5 grow overflow-hidden rounded-[999px] bg-linha">
                  <span
                    className="block h-full rounded-[999px] bg-roxo"
                    style={{ width: `${total ? (d.qtd / total) * 100 : 0}%` }}
                  />
                </span>
                <span className="num w-5 text-right text-cinza">{d.qtd}</span>
              </li>
            ))}
          </ul>
        </div>

        <ul className="space-y-4">
          {produto.avaliacoes.map((a, i) => (
            <li key={i} className="rounded-[10px] border border-linha p-4">
              <div className="flex flex-wrap items-center gap-2">
                <NotaEstrelas nota={a.nota} />
                <strong className="text-[0.9375rem]">{a.titulo}</strong>
              </div>
              <p className="mt-2 text-[0.9375rem] leading-relaxed text-grafite">{a.texto}</p>
              <p className="mt-3 flex flex-wrap items-center gap-2 text-[0.75rem] text-cinza">
                <span>{a.autor}</span>
                <span aria-hidden="true">·</span>
                <time dateTime={a.data}>
                  {new Date(`${a.data}T12:00:00`).toLocaleDateString("pt-BR")}
                </time>
                {a.compraVerificada && (
                  <span className="rounded-[999px] bg-violeta-claro px-2 py-0.5 font-medium text-violeta">
                    ✓ {copy.pdp.compraVerificada}
                  </span>
                )}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
