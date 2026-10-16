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
  // falhas encontradas pelos revisores (779 buscas) — não podem voltar
  ["tinta 6.0", t(/\b6\.0\b/)],
  ["tonalizante 6.0", t(/\b6\.0\b/)],
  ["kpro 6.0", e(marca("k-pro"), t(/\b6\.0\b/))],
  ["7.0", t(/\b7\.0\b/)],
  ["10.0", t(/\b10\.0\b/)],
  ["coloracao 9.2", t(/\b9\.2\b/)],
  ["tinta 7.38", t(/\b7\.38\b/)],
  ["tonalizante 6.66", t(/\b6\.66\b/)],
  ["tonalizante 8.01", t(/\b8\.01\b/)],
  ["30vol", t(/\b30 ?vol/)],
  ["30 volumes", t(/\b30 ?vol/)],
  ["oxidante 30 volumes", e(t(/oxi|oxigenada|emulsao/), t(/\b30 ?vol/))],
  ["agua oxigenada 30 volumes", e(t(/oxi|oxigenada|emulsao/), t(/\b30 ?vol/))],
  ["ox 30v", e(t(/oxi|oxigenada|emulsao/), t(/\b30 ?vol/))],
  ["oxidante 4 volumes", t(/emulsao 4v/)],
  ["oxidante", t(/\b(oxi|ox|oxidante|oxigenada|emulsao)\b/)],
  ["emulsao reveladora", t(/\b(oxi|ox|oxidante|oxigenada|emulsao)\b/)],
  ["oxidande", t(/\b(oxi|ox|oxidante|oxigenada|emulsao)\b/)],
  ["kpro hidratacao", e(marca("k-pro"), t(/hidra|moistur/))],
  ["jj hidratacao", e(marca("jacques-janine"), t(/hydra|hidrat/))],
  ["shampoo hidratacao 1 litro", e(t(/\bshampoo\b/), t(/hidra|moistur|hydra/), t(/\b1 ?l\b|1000 ?ml/))],
  ["progressiva", t(/progressiva|reduct/)],
  ["escova progressiva", t(/progressiva|reduct/)],
  ["alisante", t(/reduct/)],
  ["redutor de volume", t(/reduct/)],
  ["botox capilar", t(/\bbtx\b|botox/)],
  ["shampoo matizador", e(t(/\b(shampoo|sh)\b/), t(/matiz|desamarel|violet|silver/))],
  ["shampoo roxo", e(t(/\b(shampoo|sh)\b/), t(/matiz|desamarel|violet|silver/))],
  ["shampoo violeta", e(t(/\b(shampoo|sh)\b/), t(/matiz|desamarel|violet|silver/))],
  ["matisador", t(/matiz|desamarel|violet|silver/)],
  ["louro claro cinza", t(/acinz|\bacz\b|\bcza\b|\bacin\b|cinza/)],
  ["louro muito claro acinzentado", t(/\b9\.1\b/)],
  ["tinta de cabelo", t(/colora|tonaliz|color|\b\d{1,2}\.\d{1,2}\b/)],
  ["shampoo litro", e(t(/\b(shampoo|sh)\b/), t(/\b1 ?l\b|1000 ?ml|litro/))],
  ["finalizador", e(cat("cabelos"), t(/leave|pentear|ativador|gelatina|geleia|mousse|oleo|oil|serum|fluido|spray|pomada|finaliz|bruma|modelador/))],
  ["finalizador cachos", t(/cacho|curl|curvatura|juba|cachinho/)],
  ["protetor termico", t(/protector|termo ?ativado|termoativado|termic|termo/)],
  ["spray fixador", t(/fix/)],
  ["acidificante 1 kilo", e(t(/acidificante/), t(/1 ?kg/))],
  ["mascara 1 quilo", e(t(/mascara|masque|mask/), t(/1 ?kg/))],
  ["kaviar kpro", e(marca("k-pro"), t(/caviar/))],
  ["shampoo antiresiduo", t(/anti[ -]?residuo/)],
  ["cowash", t(/co.?wash/)],
  ["shampoo sem sulfato", t(/sulfat/)],
  ["umectacao", t(/umect|oleo|oil/)],
  ["rimel", t(/mascara (de|para) cilios|lash|cilios/)],
  ["rimmel", t(/mascara (de|para) cilios|lash|cilios/)],
  ["rimel mari maria", e(marca("mari-maria"), t(/cilios|lash/))],
  ["sérum vitamina c", t(/vitamin/)],
  ["batom matte", t(/\b(batom|lip matte|lipstick|lips)\b/)],
  ["batom latika", e(marca("latika"), t(/lip matte|batom|lipstick/))],
  ["batom vermelho", e(t(/batom|lip|lipstick/), t(/vermelh|red/))],
  ["batom nude", e(t(/batom|lip|lipstick/), t(/nude|naked/))],
  ["batons", t(/\b(batom|bto|lip|lipstick|tint|matte|gloss)\b/)],
  ["batons liquidos", e(t(/batom|lip/), t(/liq/))],
  ["creme corporal", t(/body|corporal|bumbum|corpo/)],
  ["creme bumbum", t(/bumbum/)],
  ["creme facial", e(cat("skincare"), t(/cream|creme|hidratante/))],
  ["suplemento", ou(marca("rituaria"), marca("denavita"))],
  ["contorno", t(/contour|contorno/)],
  ["contorno stick", t(/contour stick|stick.*contour|contorno/)],
  ["iluminador bastao", t(/stick|bastao/)],
  ["blush em bastao", e(t(/blush/), t(/stick|bastao/))],
  ["gloss", t(/gloss/)],
  ["lipgloss", t(/gloss/)],
  ["delineador preto", e(t(/delineador|eyeliner|lapis|lapiseira/), t(/preto|black/))],
  ["lapis marrom", e(t(/lapis|lapiseira|eyeliner/), t(/marrom|brown/))],
  ["oleo labial", t(/lip oil/)],
  ["lapis labial", t(/lapis contorno|lip liner|lapiseira labial|lapis labial/)],
  ["esfoliante labial", t(/lip scrub|esfoliante labial/)],
  ["sabonete corporal", t(/sabonete/)],
  ["body lotion", t(/locao|lotion/)],
  ["demaquilante", t(/demaquilante|micelar/)],
  ["removedor de maquiagem", t(/demaquilante|micelar/)],
  ["esponjinha", t(/esponja|sponge|blend|puff|drop/)],
  ["beauty blender", t(/esponja|sponge|blend|puff|drop/)],
  ["bodysplash", t(/body splash/)],
  ["hidratante rosto", t(/facial|face/)],
  ["pele oleosa", cat("skincare")],
  ["skin care", cat("skincare")],
  ["anti idade", t(/rejuvenescedor|retinol|bakuchiol/)],
  ["rugas", t(/rejuvenescedor|retinol|bakuchiol/)],
  ["filtro solar", t(/protetor solar|fps|spf|sun/)],
  ["bloqueador solar", t(/protetor solar|fps|spf|sun/)],
  ["kit maquiagem", t(/gift set|kit|trio/)],
  ["kit de maquiagem", t(/gift set|kit|trio/)],
  ["base clara", e(t(/\bbase\b/), t(/clar/))],
  ["creme para os pes", t(/pezinho|\bpes?\b/)],
  ["bronzeador", t(/bronze/)],
  ["espinha", t(/acne/)],
  ["sabonete facial", t(/sabonete|cleanser|cleansing|limpeza/)],
  ["limpeza facial", t(/sabonete|cleanser|cleansing|limpeza/)],
  ["lip tint", t(/\btint/)],
  ["base nina cor 5", e(marca("nina"), t(/\bbase\b/), t(/\b0?5\b/))],
  ["base mm 10n", t(/mm10n/)],
  ["mmc05", t(/mmc 05/)],
  ["perfume arabe", marca("mawwal")],
  ["pó facial", t(/\bpo\b|powder/)],
  ["pos compactos", t(/compact/)],
  ["shampu", t(/\b(shampoo|sh)\b/)],
  ["champo", t(/\b(shampoo|sh)\b/)],
  ["shampu widi", e(marca("widi-care"), t(/\b(shampoo|sh)\b/))],
  ["shampoo loiro", e(t(/\b(shampoo|sh)\b/), t(/blond|loir|desamarel|silver|matiz/))],
  ["shampoo para loiras", e(t(/\b(shampoo|sh)\b/), t(/blond|loir|desamarel|silver|matiz/))],
  ["sh jj", e(marca("jacques-janine"), t(/\bshampoo\b/))],
  ["cond widi", e(marca("widi-care"), t(/condicionador|\bcond\b|co wash/))],
  ["shampoo 500 ml", e(t(/\b(shampoo|sh)\b/), t(/500 ?ml/))],
  ["dry shampoo", t(/seco|dry/)],
  ["777", t(/juba transicao capilar shampoo/)],
  ["633", t(/higienizando a juba shampoo.*1 l/)],
  ["oleo para cabelo", e(cat("cabelos"), t(/\b(oleo|oil|serum|fluido)\b/))],
  ["perfumes arabes", marca("mawwal")],
  ["wal", marca("wahl")],
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
    // só existem N certos: os N primeiros bastam (o resto da lista são parecidos)
    const precisao = top.length ? certos / Math.min(top.length, Math.max(existem, 1)) : 0;
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
