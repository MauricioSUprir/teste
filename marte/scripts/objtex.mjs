// Texturas de DETALHE para objetos (Poly Haven CC0). Guardamos só o detalhe (luminância normalizada),
// rugosidade e AO — a cor vem do material (tinta branca, ouro MLI, alumínio...). Uso: node scripts/objtex.mjs
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const CACHE = path.join(ROOT, '.cache/obj');
const OUT = path.join(ROOT, 'public/assets/tex/obj');
const SETS = [
  { id: 'panel', src: 'blue_metal_plate' },
  { id: 'plate', src: 'metal_plate_02' },
  { id: 'fabric', src: 'rough_linen' },
  { id: 'tread', src: 'metal_plate' },
];
const SIZES = { '1k': 1024, '2k': 2048 };
async function dl(url, dest) {
  try { await fs.access(dest); return dest; } catch { /* baixar */ }
  await fs.mkdir(path.dirname(dest), { recursive: true });
  for (let i = 0; i < 4; i++) {
    try { const r = await fetch(url); if (!r.ok) throw new Error(`${r.status} ${url}`); await fs.writeFile(dest, Buffer.from(await r.arrayBuffer())); return dest; }
    catch (e) { if (i === 3) throw e; await new Promise((res) => setTimeout(res, 2000 * 2 ** i)); }
  }
}
const url = (src, map, res) => `https://dl.polyhaven.org/file/ph-assets/Textures/jpg/${res}/${src}/${src}_${map}_${res}.jpg`;
for (const s of SETS) {
  for (const [tier, px] of Object.entries(SIZES)) {
    const f = {};
    for (const m of ['diff', 'nor_gl', 'rough', 'ao']) f[m] = await dl(url(s.src, m, tier), path.join(CACHE, `${s.src}_${m}_${tier}.jpg`)).catch(() => null);
    const g = async (file) => file ? sharp(file).resize(px, px).removeAlpha().greyscale().raw().toBuffer() : null;
    const L = await g(f.diff), Rg = await g(f.rough), A = await g(f.ao);
    let mean = 0; for (let i = 0; i < L.length; i++) mean += L[i]; mean /= L.length;
    const d = Buffer.alloc(px * px * 3);
    for (let i = 0; i < px * px; i++) {
      d[i * 3] = Math.max(0, Math.min(255, Math.round((L[i] / mean) * 128))); // 128 = neutro
      d[i * 3 + 1] = Rg ? Rg[i] : 160;
      d[i * 3 + 2] = A ? A[i] : 255;
    }
    await fs.mkdir(path.join(OUT, tier), { recursive: true });
    await sharp(d, { raw: { width: px, height: px, channels: 3 } }).webp({ quality: 88 }).toFile(path.join(OUT, tier, `${s.id}_d.webp`));
    await sharp(f.nor_gl).resize(px, px).removeAlpha().webp({ quality: 90 }).toFile(path.join(OUT, tier, `${s.id}_n.webp`));
    console.log('ok', s.id, tier);
  }
}
