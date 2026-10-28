// Gera src/dados/catalogo.json — os produtos das lojas de demonstração do
// shopping, tirados do mesmo catálogo do Hub que os sites usam
// (apps/storefront/src/lib/catalogo/dados-hub.json).
//
// Preço: em centavos, com a política das lojas do grupo (Hub × 1,3, a mesma
// de BeautyNow, Be2Beauty e Pulse). Só entram produtos com foto e estoque.
//
//   node scripts/gerar-catalogo.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const origem = path.resolve(aqui, "../../apps/storefront/src/lib/catalogo/dados-hub.json");
const destino = path.resolve(aqui, "../src/dados/catalogo.json");
const hub = JSON.parse(fs.readFileSync(origem, "utf8"));
const MULTIPLICADOR = 1.3;

// marcas de cada loja, na ordem em que aparecem nas prateleiras, e quantos produtos de cada
const LOJAS = {
  beautynow: { total: 48, marcas: ["widi-care", "hidratei", "arvensis", "latika", "sallve", "bioderma", "beleza-brasileira", "rituaria", "mari-maria", "oceane"] },
  be2beauty: { total: 48, marcas: ["k-pro", "jacques-janine", "senscience", "theoric", "mawwal", "kess", "joico", "d-vence", "wahl"] },
  pulse: { total: 48, marcas: ["mari-maria", "ruby-rose", "oceane", "bruna-tavares", "byem", "nina", "melu", "ricca"] },
};

const usados = new Set();
const temFoto = (p) => Array.isArray(p.imagens) && p.imagens.length > 0;
const variante = (p) => p.variantes?.[0];
const produtosDa = (marca) =>
  hub.produtos
    .filter((p) => p.marca === marca && temFoto(p) && (variante(p)?.estoque ?? 0) > 0 && variante(p)?.precoPor > 0)
    // varia os tipos: ordena pelo nome, que no Hub começa pela linha do produto
    .sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR"));

const saida = { atualizadoEm: hub.atualizadoEm, baseImagem: hub.baseImagem, marcas: {}, lojas: {} };
for (const [loja, cfg] of Object.entries(LOJAS)) {
  const porMarca = cfg.marcas.map((m) => produtosDa(m).filter((p) => loja !== "pulse" || !usados.has(p.slug)));
  const escolhidos = [];
  // reparte por igual entre as marcas, pulando produtos parecidos (mesma linha seguida)
  for (let rodada = 0; escolhidos.length < cfg.total && rodada < 60; rodada++) {
    for (const lista of porMarca) {
      if (escolhidos.length >= cfg.total) break;
      const passo = Math.max(1, Math.floor(lista.length / 8));
      const p = lista[(rodada * passo + Math.floor(rodada / 8)) % Math.max(1, lista.length)];
      if (p && !escolhidos.includes(p)) escolhidos.push(p);
    }
  }
  // agrupa por marca de novo para a prateleira ficar organizada
  escolhidos.sort((a, b) => cfg.marcas.indexOf(a.marca) - cfg.marcas.indexOf(b.marca));
  saida.lojas[loja] = escolhidos.map((p) => {
    usados.add(p.slug);
    const v = variante(p);
    return {
      id: p.slug,
      titulo: p.titulo,
      marca: p.marca,
      categorias: p.categorias,
      descricao: p.descricao || "",
      preco: Math.round(v.precoPor * MULTIPLICADOR),
      precoDe: v.precoDe ? Math.round(v.precoDe * MULTIPLICADOR) : null,
      foto: p.imagens[0],
      atributos: p.atributos ?? {},
      especificacoes: Object.fromEntries(Object.entries(p.especificacoes ?? {}).filter(([k]) => k === "Volume" || k === "Peso")),
    };
  });
}
for (const m of hub.marcas) if (Object.values(saida.lojas).some((l) => l.some((p) => p.marca === m.slug))) saida.marcas[m.slug] = { nome: m.nome, cor: m.cor };
fs.writeFileSync(destino, JSON.stringify(saida));
for (const [loja, lista] of Object.entries(saida.lojas)) console.log(loja, lista.length, "produtos", [...new Set(lista.map((p) => p.marca))].join(", "));
console.log("→", path.relative(process.cwd(), destino), (fs.statSync(destino).size / 1024).toFixed(0), "KB");
