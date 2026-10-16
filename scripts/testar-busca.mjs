#!/usr/bin/env node
/**
 * Mede a qualidade da busca do site com buscas reais de cliente e de
 * profissional. Cada busca tem um critério do que é resultado certo; o
 * relatório mostra, para cada uma, quantos resultados vieram e quantos dos 10
 * primeiros estão certos.
 *
 *   node --experimental-strip-types scripts/testar-busca.mjs [--antiga] [--detalhe]
 *
 * --antiga roda também a busca anterior (texto inteiro dentro do nome), para
 * comparar.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pesquisar, normalizar } from "../apps/storefront/src/lib/catalogo/busca.ts";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const hub = JSON.parse(readFileSync(join(RAIZ, "apps/storefront/src/lib/catalogo/dados-hub.json"), "utf8"));
const nomeMarca = Object.fromEntries(hub.marcas.map((m) => [m.slug, m.nome]));
const nomeCategoria = Object.fromEntries(hub.categorias.map((c) => [c.slug, c.nome]));
const fonte = { nomeMarca: (s) => nomeMarca[s] ?? s, nomeCategoria: (s) => nomeCategoria[s] ?? s };
const produtos = hub.produtos.map((p) => ({ ...p, imagens: p.imagens ?? [] }));

const n = (s) => normalizar(String(s ?? ""));
const t = (re) => (p) => re.test(n(p.titulo));
const marca = (slug) => (p) => p.marca === slug;
const cat = (slug) => (p) => p.categorias[0] === slug;
const e = (...fs) => (p) => fs.every((f) => f(p));
const ou = (...fs) => (p) => fs.some((f) => f(p));

/** [busca, critério de resultado certo] */
const CASOS = [
  // marca, com e sem erro de digitação / pontuação
  ["widi care", marca("widi-care")],
  ["widicare", marca("widi-care")],
  ["kpro", marca("k-pro")],
  ["k pro", marca("k-pro")],
  ["dvence", marca("d-vence")],
  ["d vence", marca("d-vence")],
  ["senscience", marca("senscience")],
  ["senciense", marca("senscience")],
  ["oceani", marca("oceane")],
  ["mari maria", marca("mari-maria")],
  ["mari maira", marca("mari-maria")],
  ["jacques janine", marca("jacques-janine")],
  ["jaques janine", marca("jacques-janine")],
  ["bruna tavares", marca("bruna-tavares")],
  ["hidratei", marca("hidratei")],
  ["theoric", marca("theoric")],
  ["joico", marca("joico")],
  ["wahl", marca("wahl")],
  ["batiste", marca("batiste")],
  ["latika", marca("latika")],
  ["rituaria", marca("rituaria")],
  ["arvensis", marca("arvensis")],
  // tipo de produto
  ["shampoo", t(/\b(shampoo|sh)\b/)],
  ["shampoos", t(/\b(shampoo|sh)\b/)],
  ["shampo", t(/\b(shampoo|sh)\b/)],
  ["condicionador", t(/\b(condicionador|cond|cd|conditioner)\b/)],
  ["condicionadores", t(/\b(condicionador|cond|cd|conditioner)\b/)],
  ["mascara capilar", e(cat("cabelos"), t(/\b(mascara|mask|masque|masc)\b/))],
  ["leave in", t(/leave/)],
  ["leave-in", t(/leave/)],
  ["oleo capilar", e(cat("cabelos"), t(/\b(oleo|oil|serum|fluido)\b/))],
  ["creme de pentear", t(/creme de pentear|creme ativador|ativador/)],
  ["protetor solar", t(/protetor solar|fps|spf|sun/)],
  ["batom", t(/\b(batom|bto|lip|lipstick|tint|matte|gloss)\b/)],
  ["base liquida", t(/\bbase\b/)],
  ["corretivo", t(/corretivo|concealer|corret/)],
  ["po compacto", t(/\bpo\b.*compacto|compact/)],
  ["pincel", t(/pincel|pinceis|brush/)],
  ["perfume", ou(cat("perfumaria"), t(/perfum/))],
  ["body splash", t(/body splash/)],
  ["hidratante corporal", e(ou(cat("corpo-e-banho"), t(/corporal|body/)), t(/hidrat|lotion|locao|cream|creme|manteiga|butter/))],
  ["maquina de cortar cabelo", ou(cat("maquinas-e-aparadores"), t(/maquina/))],
  ["aparador", t(/aparador|trimmer/)],
  ["po descolorante", t(/descolorante|po desc|white blond/)],
  ["descolorante", t(/descolorante|po desc/)],
  ["ox 20 volumes", e(t(/oxi|ox\b|emulsao|oxigenada|reveladora/), t(/20/))],
  ["agua oxigenada", t(/oxigenada|oxi\b|emulsao reveladora/)],
  ["matizador", t(/matiz|desamarel|violet|platinum|blond/)],
  ["tonalizante", t(/tonalizante|color|coloracao/)],
  ["acidificante", t(/acidificante|ph balancer/)],
  ["gelatina", t(/gelatina/)],
  ["pomada", t(/pomada|cera|wax|style stick/)],
  ["kit", t(/\bkit\b/)],
  ["esmalte", ou(cat("unhas"), t(/esmalte|unha/))],
  ["shampoo a seco", e(marca("batiste"))],
  // combinações marca + tipo (a busca antiga falhava em todas)
  ["shampoo widi", e(marca("widi-care"), t(/\b(shampoo|sh)\b/))],
  ["batom mari maria", e(marca("mari-maria"), t(/\b(batom|bto|lip)\b/))],
  ["kpro caviar", e(marca("k-pro"), t(/caviar/))],
  ["condicionador senscience", e(marca("senscience"), t(/\b(condicionador|conditioner|cond)\b/))],
  ["mascara jacques janine", e(marca("jacques-janine"), t(/\b(mascara|mask)\b/))],
  ["oleo widi care", e(marca("widi-care"), t(/\b(oleo|oil)\b/))],
  ["base oceane", e(marca("oceane"), t(/\bbase\b|foundation/))],
  ["leave in hidratei", marca("hidratei")], // a Hidratei não tem leave-in com esse nome: vale mostrar a marca
  ["shampoo 1 litro", e(t(/\b(shampoo|sh)\b/), t(/\b(1\s?l|1\s?litro|1000\s?ml)\b/))],
  ["shampoo 1l", e(t(/\b(shampoo|sh)\b/), t(/\b(1\s?l|1\s?litro|1000\s?ml)\b/))],
  ["true hue", t(/true hue/)],
  ["juba", t(/juba/)],
  ["cachos", t(/cacho|cachinho|curl|curvatura/)],
  ["anti frizz", t(/frizz/)],
  ["antifrizz", t(/frizz/)],
  ["vitamina c", t(/vitamin|vitamina c/)],
  ["serum facial", e(ou(cat("skincare"), t(/facial/)), t(/serum|elixir/))],
  ["savior blond", e(marca("d-vence"), t(/savior/))],
  ["pó descolorante dvence", e(marca("d-vence"), t(/descolorante/))],
  ["evoly", marca("evoly")],
  ["magnesio", t(/mag/)],
];

function buscaAntiga(termo) {
  const sin = {
    xampu: ["shampoo"], shampoo: ["xampu"], capilar: ["cabelo"], cabelo: ["capilar"],
    "filtro solar": ["protetor solar"], fps: ["protetor solar"], labial: ["batom"],
    cacho: ["cacheado"], crespo: ["cacheado"], hialuronico: ["acido hialuronico"],
  };
  const tt = n(termo.trim());
  if (!tt) return [];
  const termos = [tt, ...(sin[tt] ?? [])];
  return produtos
    .map((p) => {
      const alvos = [n(p.titulo), n(fonte.nomeMarca(p.marca)), n(p.linha ?? ""), n(p.descricao), p.categorias.join(" ")];
      let pontos = 0;
      for (const q of termos) {
        if (alvos[0].includes(q)) pontos += 10;
        if (alvos[1].includes(q)) pontos += 6;
        if (alvos[2].includes(q)) pontos += 4;
        if (alvos.slice(3).some((a) => a.includes(q))) pontos += 2;
      }
      return { p, pontos };
    })
    .filter((r) => r.pontos > 0)
    .sort((a, b) => b.pontos - a.pontos)
    .map((r) => r.p);
}

const comAntiga = process.argv.includes("--antiga");
const detalhe = process.argv.includes("--detalhe");
let okNova = 0, okAntiga = 0;
const linhas = [];
const falhas = [];
for (const [termo, certo] of CASOS) {
  const existem = produtos.filter(certo).length;
  const avaliar = (lista) => {
    const top = lista.slice(0, 10);
    const certos = top.filter(certo).length;
    const precisao = top.length ? certos / top.length : 0;
    const passou = existem === 0 ? lista.length === 0 : lista.length > 0 && certo(lista[0]) && precisao >= 0.8;
    return { total: lista.length, certos, top: top.length, precisao, passou };
  };
  const r = pesquisar(produtos, termo, fonte);
  const nova = avaliar(r.produtos);
  if (nova.passou) okNova++;
  else falhas.push({ termo, nova, top: r.produtos.slice(0, 5).map((p) => `${p.marca}: ${p.titulo}`) });
  let antiga = null;
  if (comAntiga) {
    antiga = avaliar(buscaAntiga(termo));
    if (antiga.passou) okAntiga++;
  }
  linhas.push(
    `${nova.passou ? "OK  " : "FALHA"} ${termo.padEnd(28)} nova: ${String(nova.total).padStart(4)} result., ${nova.certos}/${nova.top} certos` +
      (antiga ? ` | antiga: ${String(antiga.total).padStart(4)} result., ${antiga.certos}/${antiga.top} certos ${antiga.passou ? "ok" : "falha"}` : "") +
      `  (existem ${existem})${r.aproximado ? " [aproximado]" : ""}`
  );
}
console.log(linhas.join("\n"));
console.log(`\nbusca nova: ${okNova}/${CASOS.length} certas` + (comAntiga ? ` · busca antiga: ${okAntiga}/${CASOS.length}` : ""));
if (detalhe) for (const f of falhas) console.log(`\n✗ ${f.termo}\n   ${f.top.join("\n   ")}`);
process.exitCode = okNova === CASOS.length ? 0 : 1;
