/**
 * A explicação do produto (mesma regra da loja 3D do site): o que é, para
 * quem, tipo de cabelo ou de pele, tom, ação, acabamento, tamanho e como usar.
 * O que o produto não diz fica com a resposta honesta ("homens e mulheres",
 * "não é específico") em vez de sumir.
 */
import type { Ficha } from "../dados/ficha";
import { EXPLICACAO_TIPO, textosFicha as tf } from "../copy/ficha";
import { h } from "./dom";

const QUEM: Record<string, string> = { Masculino: "Homens", Feminino: "Mulheres", Infantil: "Crianças" };

export function explicacao(f: Ficha): [string, string][] {
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

export function fichaEmHtml(f: Ficha) {
  const linhas = explicacao(f);
  return h(
    "div",
    { class: "ficha" },
    linhas.length ? h("dl", {}, linhas.flatMap(([k, v]) => [h("dt", {}, k), h("dd", {}, v)])) : null,
    f.selos.length ? h("ul", { class: "selos" }, f.selos.map((s) => h("li", {}, s))) : null,
    f.resumo ? h("p", { class: "resumo" }, f.resumo) : null
  );
}
