/**
 * Baixa miniatura da foto de TODOS os produtos (runner do GitHub) para a
 * revisão visual completa foto × nome. Reduz com sharp para ~120px (leve).
 *
 * Uso: npm i --no-save sharp && node scripts/baixar-todas-fotos.mjs
 */
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import sharp from "sharp";

const dados = JSON.parse(
  readFileSync("apps/storefront/src/lib/catalogo/dados-hub.json", "utf8")
);

mkdirSync("fotos-todas", { recursive: true });
const indice = [];
let ok = 0;
let falha = 0;

const fila = dados.produtos.map((p, i) => ({ p, i }));
const LOTE = 12;

async function baixar({ p, i }) {
  const url = p.imagens?.[0];
  const id = String(i).padStart(4, "0");
  if (!url) {
    indice.push({ id, marca: p.marca, titulo: p.titulo, semFoto: true });
    return;
  }
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const bruto = Buffer.from(await r.arrayBuffer());
    const mini = await sharp(bruto).resize(120, 120, { fit: "inside" }).jpeg({ quality: 70 }).toBuffer();
    writeFileSync(`fotos-todas/${id}.jpg`, mini);
    indice.push({ id, marca: p.marca, titulo: p.titulo });
    ok += 1;
  } catch (erro) {
    indice.push({ id, marca: p.marca, titulo: p.titulo, erro: String(erro.message).slice(0, 60) });
    falha += 1;
  }
}

while (fila.length) {
  await Promise.all(fila.splice(0, LOTE).map(baixar));
  if ((ok + falha) % 240 < LOTE) console.log(`progresso: ${ok + falha}/${dados.produtos.length}`);
}

indice.sort((a, b) => (a.id < b.id ? -1 : 1));
writeFileSync("fotos-todas/indice.json", JSON.stringify(indice));
console.log(`fotos: ${ok} ok, ${falha} falhas`);
