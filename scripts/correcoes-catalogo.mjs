/**
 * Correções do catálogo do Hub Suprir — aplicadas na sincronização diária
 * (scripts/sincronizar-catalogo.mjs) e, de imediato, no catálogo já gerado
 * (scripts/aplicar-correcoes.mjs). Os erros nascem no cadastro do Hub; corrigir
 * lá é o ideal, mas enquanto isso o site não mostra o erro.
 *
 * Duas fontes:
 * 1. regras automáticas (provadores fora da vitrine, cadastros duplicados do
 *    mesmo item, nome sem código de barras e sem CAIXA ALTA);
 * 2. scripts/correcoes-catalogo.json — decisões da revisão visual, produto a
 *    produto (fotos erradas, marca/categoria/nome errados, item fora de venda).
 *    Para desfazer uma correção (ex.: o Hub corrigiu a foto), apague a entrada.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
export const ARQUIVO_CORRECOES = join(RAIZ, "scripts/correcoes-catalogo.json");

export function lerCorrecoes() {
  if (!existsSync(ARQUIVO_CORRECOES)) return {};
  return JSON.parse(readFileSync(ARQUIVO_CORRECOES, "utf8"));
}

/** "PROV MM …", "PROVADOR …", "TESTER …": testers de balcão, com preço de brinde no Hub */
export const ehProvador = (titulo) => /^\s*(prov|provador|tester)\b/i.test(String(titulo));

/** id da foto no Hub, venha ela como URL completa ou só o número */
const idFoto = (u) => String(u).split("/").pop();

const MINUSCULAS = new Set(["de", "da", "do", "das", "dos", "e", "com", "para", "sem", "em", "a", "o", "os", "as", "ao", "aos", "à", "às", "no", "na", "nos", "nas", "por", "ou", "and"]);
const UNIDADES = new Set(["ml", "g", "kg", "l", "un", "mg"]);
// siglas que ficam em maiúsculas (marcas abreviadas, fatores, linhas)
const SIGLAS = new Set(["mm", "jj", "bb", "cc", "bt", "wd", "ph", "uv", "fps", "spf", "aha", "bha", "nv", "snc", "sns", "dd", "ii", "iii", "hd", "led", "usb", "kp", "rrb", "mmc", "lt", "dv", "sh", "sos"]);

const MARCAS_PONTO = new Set(["k.pro"]);

/** uma palavra (sem espaço, sem hífen/barra): mantém pontuação das pontas */
function capitalizarParte(parte, primeira) {
  const m = parte.match(/^([^\p{L}\d]*)(.*?)([^\p{L}\d]*)$/u);
  const [, antes, miolo, depois] = m;
  if (!miolo) return parte;
  // abreviação colada ("ESC.ACOBREADO") vira "Esc.Acobreado"; marcas (K.PRO, D'VENCE) e siglas (S.H.R.P) ficam
  if (/^\p{L}{2,}(\.\p{L}+)+$/u.test(miolo) && !MARCAS_PONTO.has(miolo.toLowerCase()))
    return antes + miolo.split(".").map((x) => capitalizarParte(x, true)).join(".") + depois;
  if (/[.'’&+]/.test(miolo)) return parte;
  const so = miolo.toLowerCase();
  if (SIGLAS.has(so)) return antes + miolo + depois;
  if (UNIDADES.has(so)) return antes + (so === "l" ? "L" : so) + depois; // litro é L maiúsculo
  if (!primeira && MINUSCULAS.has(so) && !depois.startsWith(".")) return antes + so + depois; // "No. 51" fica
  return antes + so.charAt(0).toUpperCase() + so.slice(1) + depois;
}

const emCaixaAlta = (w) => w === w.toUpperCase() && w !== w.toLowerCase();

/**
 * "SHAMPOO TEC OIL - 1L" → "Shampoo Tec Oil - 1L". Vale para nomes com metade
 * ou mais das palavras em CAIXA ALTA ("Hidratei H SOLAR SHAMPOO 60ML"); as
 * palavras já escritas normalmente ficam como estão.
 */
function capitalizar(titulo) {
  const palavras = titulo.split(" ").filter((w) => /\p{L}.*\p{L}/u.test(w) && !/\d/.test(w));
  if (!palavras.length || palavras.filter(emCaixaAlta).length / palavras.length < 0.5) return titulo;
  return titulo
    .split(" ")
    .map((palavra, i) => {
      if (/\d/.test(palavra) || !emCaixaAlta(palavra)) return palavra; // códigos e medidas: BM-301-2, MM29A, 300ML
      return palavra
        .split(/([-/])/)
        .map((parte, k) => (parte === "-" || parte === "/" ? parte : capitalizarParte(parte, i === 0 && k === 0)))
        .join("");
    })
    .join(" ");
}

/** tira código de barras e códigos internos do nome; capitaliza o que vier todo em maiúsculas */
export function limparTitulo(titulo) {
  let t = String(titulo)
    .replace(/^\s*\(\s*[\w.-]+\s*\)\s*/, "") // "(504) K.PRO …"
    .replace(/\s*[-/|]?\s*\b\d{12,14}\b/g, "") // " - 7898749570501", "/ 7898…"
    .replace(/\.\/\s*/g, " - ") // padrão Oceane "Base Liquida./440T" → "Base Liquida - 440T"
    .replace(/\s{2,}/g, " ")
    .replace(/(\s*-\s*){2,}/g, " - ")
    .replace(/[\s\-/.,]+$/, "")
    .trim();
  t = capitalizar(t);
  return t || String(titulo).trim();
}

/** nota de "qual cadastro fica" entre duplicados do mesmo item: com estoque, depois mais fotos */
function pontuacao(p, tituloHub = p.titulo) {
  const estoque = (p.variantes ?? []).some((v) => (v.estoque ?? 0) > 0);
  const fotos = p.imagens?.length ?? 0;
  const caixaAlta = tituloHub === tituloHub.toUpperCase();
  return (estoque ? 1000 : 0) + fotos * 10 + (caixaAlta ? 0 : 1) - (/[()]/.test(p.variantes[0]?.sku ?? "") ? 1 : 0);
}

/**
 * Aplica as correções. `nomesMarca` / `nomesCategoria` (slug → nome) servem
 * para a sincronização preencher o nome quando a marca/categoria muda.
 * Devolve { produtos, relatorio }.
 */
export function aplicarCorrecoes(produtos, correcoes = lerCorrecoes(), { nomesMarca = {}, nomesCategoria = {} } = {}) {
  const regras = correcoes.regras ?? {};
  const rel = { provadores: 0, duplicados: [], ocultados: 0, fotosRemovidas: 0, semFotoDepois: 0, marcas: 0, categorias: 0, titulos: 0 };
  const sku = (p) => String(p.variantes?.[0]?.sku ?? "");
  const porSku = (lista) => new Map((lista ?? []).map((c) => [String(c.sku), c]));

  let lista = produtos;
  const tituloHub = new Map(produtos.map((p) => [p, p.titulo]));

  if (regras.ocultarProvadores !== false) {
    const antes = lista.length;
    lista = lista.filter((p) => !ehProvador(p.titulo));
    rel.provadores = antes - lista.length;
  }

  const ocultar = porSku(correcoes.ocultarProdutos);
  const antesOcultar = lista.length;
  lista = lista.filter((p) => !ocultar.has(sku(p)));
  rel.ocultados = antesOcultar - lista.length;

  const fotos = porSku(correcoes.ocultarFotos);
  const marcas = porSku(correcoes.marca);
  const categorias = porSku(correcoes.categoria);
  const titulos = porSku(correcoes.titulo);
  for (const p of lista) {
    const s = sku(p);
    const f = fotos.get(s);
    if (f && p.imagens?.length) {
      const fora = new Set((f.fotos ?? []).map(String));
      const antes = p.imagens.length;
      p.imagens = p.imagens.filter((u) => !fora.has(idFoto(u)));
      rel.fotosRemovidas += antes - p.imagens.length;
      if (!p.imagens.length) {
        p.imagens = undefined;
        rel.semFotoDepois += 1;
      }
    }
    const m = marcas.get(s);
    if (m && m.marca !== p.marca) {
      p.marca = m.marca;
      if ("_marcaNome" in p) p._marcaNome = nomesMarca[m.marca] ?? m.nome ?? p._marcaNome;
      rel.marcas += 1;
    }
    const c = categorias.get(s);
    if (c && c.categoria !== p.categorias?.[0]) {
      p.categorias = [c.categoria];
      if ("_categoriaNome" in p) p._categoriaNome = nomesCategoria[c.categoria] ?? p._categoriaNome;
      rel.categorias += 1;
    }
    const t = titulos.get(s);
    if (t?.titulo) {
      p.titulo = regras.limparTitulo !== false ? limparTitulo(t.titulo) : t.titulo;
      rel.titulos += 1;
    } else if (regras.limparTitulo !== false) {
      const limpo = limparTitulo(p.titulo);
      if (limpo !== p.titulo) {
        p.titulo = limpo;
        rel.titulos += 1;
      }
    }
  }

  // o mesmo item (mesmo código de barras) cadastrado mais de uma vez no Hub:
  // fica o cadastro com mais fotos (e nome melhor)
  if (regras.unificarDuplicadosPorEAN !== false) {
    const grupos = new Map();
    for (const p of lista) {
      const ean = p.especificacoes?.EAN;
      if (ean && /^\d{8,14}$/.test(String(ean))) {
        if (!grupos.has(ean)) grupos.set(ean, []);
        grupos.get(ean).push(p);
      }
    }
    const fora = new Set();
    for (const [ean, g] of grupos) {
      if (g.length < 2) continue;
      const ordenados = [...g].sort((a, b) => pontuacao(b, tituloHub.get(b)) - pontuacao(a, tituloHub.get(a)) || sku(a).localeCompare(sku(b)));
      for (const p of ordenados.slice(1)) fora.add(p);
      rel.duplicados.push({ ean, fica: sku(ordenados[0]), saem: ordenados.slice(1).map(sku) });
    }
    lista = lista.filter((p) => !fora.has(p));
  }

  return { produtos: lista, relatorio: rel };
}
