/**
 * Ficha do produto na loja 3D (lib/catalogo/ficha.ts). No balão do mouse, a
 * explicação completa (o que é, para quem, cabelo ou pele, ação, tamanho,
 * como usar); no card, etiquetas curtas (o espaço é pouco, como no celular).
 */
import { copy } from "@/lib/copy";
import { EXPLICACAO_TIPO, textosFicha as tf } from "@/lib/copy/ficha";
import type { Ficha } from "@/lib/catalogo/ficha";

const t = copy.loja3d.ficha;
const QUEM: Record<string, string> = { Masculino: "Homens", Feminino: "Mulheres", Infantil: "Crianças" };

/**
 * A explicação completa do balão: o que é e para que serve, para quem, o tipo
 * de cabelo ou de pele (ou que não é específico), ação, tom, acabamento,
 * tamanho e como usar. O que o produto não diz fica com a resposta honesta
 * ("homens e mulheres", "não é específico") em vez de sumir.
 */
function explicacao(f: Ficha): [string, string][] {
  const tipo = f.tipo ? EXPLICACAO_TIPO[f.tipo] : undefined;
  const lista: [string, string | null][] = [
    [tf.oQueE, f.tipo ? `${f.tipo}${tipo ? `: ${tipo.serve.charAt(0).toLowerCase()}${tipo.serve.slice(1)}` : ""}` : null],
    [tf.paraQuem, f.para.length ? f.para.map((p) => QUEM[p] ?? p).join(", ") : tf.unissex],
    [tf.cabelo, f.area === "cabelo" ? f.cabelo.join(", ") || tf.cabeloQualquer : null],
    [tf.pele, f.area === "pele" ? f.pele.join(", ") || tf.peleQualquer : null],
    [tf.tom, f.tom],
    [tf.acao, f.acao.join(", ") || null],
    [tf.acabamento, f.acabamento.join(", ") || null],
    [tf.tamanho, f.tamanho],
    [tf.comoUsar, tipo?.uso ?? null],
  ];
  return lista.filter((l): l is [string, string] => !!l[1]);
}

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
  if (compacta) {
    const etiquetas = [...linhas(ficha).map(([, v]) => v), ...ficha.selos];
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
  const completa = explicacao(ficha);
  return (
    <>
      {completa.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[0.75rem] leading-snug">
          {completa.map(([k, v]) => (
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
