// Baixa texturas/modelos CC0 da Poly Haven e gera as versões "marcianas" empacotadas.
// Uso: node scripts/assets.mjs   (idempotente; usa cache em .cache/)
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { MeshoptSimplifier } from 'meshoptimizer';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const CACHE = path.join(ROOT, '.cache');
const OUT = path.join(ROOT, 'public/assets');
const PH = 'https://dl.polyhaven.org/file/ph-assets';

// Camadas do terreno. target = cor média sRGB desejada (regolito marciano, albedo ~0,2-0,3).
const LAYERS = [
  { id: 'dust', src: 'red_sand', target: [178, 134, 102], chroma: 0.18, contrast: 1.0 },
  { id: 'soil', src: 'red_laterite_soil_stones', target: [166, 124, 94], chroma: 0.2, contrast: 1.1 },
  { id: 'gravel', src: 'dry_ground_rocks', target: [158, 118, 90], chroma: 0.2, contrast: 1.15 },
  { id: 'cliff', src: 'cliff_side', target: [166, 124, 94], chroma: 0.25, contrast: 1.1 },
];
const ROCKS = [
  { id: 'rock_a', src: 'namaqualand_boulder_02' },
  { id: 'rock_b', src: 'namaqualand_boulder_03' },
  { id: 'rock_c', src: 'namaqualand_boulder_05' },
  { id: 'rock_d', src: 'moon_rock_01' },
  { id: 'rock_e', src: 'moon_rock_03' },
  { id: 'rock_f', src: 'moon_rock_05' },
];
const ROCK_TARGET = [132, 102, 84];
const SIZES = { '1k': 1024, '2k': 2048, '4k': 4096 };

async function exists(p) { try { await fs.access(p); return true; } catch { return false; } }
async function dl(url, dest) {
  if (await exists(dest)) return dest;
  await fs.mkdir(path.dirname(dest), { recursive: true });
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      await fs.writeFile(dest, Buffer.from(await r.arrayBuffer()));
      return dest;
    } catch (e) {
      if (i === 3) throw e;
      await new Promise((res) => setTimeout(res, 2000 * 2 ** i));
    }
  }
}

async function raw(file, size, channels = 3) {
  const img = sharp(file).resize(size, size, { kernel: 'lanczos3' }).removeAlpha();
  const buf = await (channels === 1 ? img.greyscale().raw().toBuffer() : img.raw().toBuffer());
  return buf;
}

// Transferência de cor preservando a luminância (detalhe) e parte do croma original.
function marsify(rgb, target, chroma, contrast) {
  const n = rgb.length / 3;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += 0.2126 * rgb[i * 3] + 0.7152 * rgb[i * 3 + 1] + 0.0722 * rgb[i * 3 + 2];
  const mean = sum / n;
  const out = Buffer.alloc(rgb.length);
  for (let i = 0; i < n; i++) {
    const r = rgb[i * 3], g = rgb[i * 3 + 1], b = rgb[i * 3 + 2];
    const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const k = Math.pow(Math.max(L, 1) / mean, contrast);
    for (let c = 0; c < 3; c++) {
      const orig = rgb[i * 3 + c];
      const v = target[c] * k + (orig - L) * chroma;
      out[i * 3 + c] = Math.max(0, Math.min(255, Math.round(v)));
    }
  }
  return out;
}

async function buildLayer(L) {
  const base = `${PH}/Textures/jpg/4k/${L.src}/${L.src}`;
  const f = {};
  for (const m of ['diff', 'nor_gl', 'arm', 'disp']) f[m] = await dl(`${base}_${m}_4k.jpg`, path.join(CACHE, `${L.src}_${m}_4k.jpg`));
  for (const [tier, size] of Object.entries(SIZES)) {
    const dir = path.join(OUT, 'tex', tier);
    await fs.mkdir(dir, { recursive: true });
    const aOut = path.join(dir, `${L.id}_a.webp`), nOut = path.join(dir, `${L.id}_n.webp`);
    if ((await exists(aOut)) && (await exists(nOut))) continue;
    const diff = marsify(await raw(f.diff, size), L.target, L.chroma, L.contrast);
    const disp = await raw(f.disp, size, 1);
    const nor = await raw(f.nor_gl, size);
    const arm = await raw(f.arm, size);
    const n = size * size;
    // Sem canal alfa (evita pré-multiplicação em alguns navegadores):
    // A = albedo com AO leve embutido; N = (normal.x, normal.y, altura)
    const A = Buffer.alloc(n * 3), N = Buffer.alloc(n * 3);
    for (let i = 0; i < n; i++) {
      const ao = Math.sqrt(arm[i * 3] / 255);
      for (let c = 0; c < 3; c++) A[i * 3 + c] = Math.round(diff[i * 3 + c] * ao);
      N[i * 3] = nor[i * 3]; N[i * 3 + 1] = nor[i * 3 + 1]; N[i * 3 + 2] = disp[i];
    }
    const q = tier === '4k' ? 86 : 90;
    await sharp(A, { raw: { width: size, height: size, channels: 3 } }).webp({ quality: q, effort: 5 }).toFile(aOut);
    await sharp(N, { raw: { width: size, height: size, channels: 3 } }).webp({ quality: 94, effort: 5 }).toFile(nOut);
    console.log('layer', L.id, tier);
  }
}

async function buildRock(R) {
  const info = await (await fetch(`https://api.polyhaven.com/files/${R.src}`)).json();
  const g = info.gltf['2k'].gltf;
  const gltfFile = await dl(g.url, path.join(CACHE, R.src, `${R.src}_2k.gltf`));
  const gltf = JSON.parse(await fs.readFile(gltfFile, 'utf8'));
  const bin = gltf.buffers[0].uri;
  const tex = {};
  for (const [rel, v] of Object.entries(g.include)) {
    const p = await dl(v.url, path.join(CACHE, R.src, rel));
    if (rel.endsWith('.bin')) continue;
    tex[/diff/.test(rel) ? 'diff' : /nor/.test(rel) ? 'nor' : 'arm'] = p;
  }
  const dir = path.join(OUT, 'rocks');
  await fs.mkdir(dir, { recursive: true });
  // Geometria: copia o .bin e extrai só o necessário (posição, normal, uv, índices) em JSON simples.
  const b = await fs.readFile(path.join(CACHE, R.src, bin));
  const prim = gltf.meshes[0].primitives[0];
  const acc = (i) => {
    const a = gltf.accessors[i], v = gltf.bufferViews[a.bufferView];
    const comps = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
    const off = (v.byteOffset || 0) + (a.byteOffset || 0);
    const Arr = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array }[a.componentType];
    return Array.from(new Arr(b.buffer.slice(b.byteOffset + off, b.byteOffset + off + a.count * comps * Arr.BYTES_PER_ELEMENT)));
  };
  const node = gltf.nodes.find((nd) => nd.mesh === 0) || {};
  const pos = new Float32Array(acc(prim.attributes.POSITION));
  const nrm = new Float32Array(acc(prim.attributes.NORMAL));
  const uv = new Float32Array(acc(prim.attributes.TEXCOORD_0));
  const idx = new Uint32Array(acc(prim.indices));
  // aplica escala/rotação do nó, centraliza em XZ, base em y=0 e normaliza raio horizontal = 1
  const [qx, qy, qz, qw] = node.rotation || [0, 0, 0, 1];
  const sc = node.scale || [1, 1, 1];
  const rot = (x, y, z) => { // q * v * q^-1
    const ix = qw * x + qy * z - qz * y, iy = qw * y + qz * x - qx * z, iz = qw * z + qx * y - qy * x, iw = -qx * x - qy * y - qz * z;
    return [ix * qw + iw * -qx + iy * -qz - iz * -qy, iy * qw + iw * -qy + iz * -qx - ix * -qz, iz * qw + iw * -qz + ix * -qy - iy * -qx];
  };
  const vc = pos.length / 3;
  let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (let i = 0; i < vc; i++) {
    const r = rot(pos[i * 3] * sc[0], pos[i * 3 + 1] * sc[1], pos[i * 3 + 2] * sc[2]);
    for (let c = 0; c < 3; c++) { pos[i * 3 + c] = r[c]; mn[c] = Math.min(mn[c], r[c]); mx[c] = Math.max(mx[c], r[c]); }
    const rn = rot(nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]);
    nrm.set(rn, i * 3);
  }
  const cx = (mn[0] + mx[0]) / 2, cz = (mn[2] + mx[2]) / 2;
  const rad = Math.max(mx[0] - mn[0], mx[2] - mn[2]) / 2;
  for (let i = 0; i < vc; i++) { pos[i * 3] = (pos[i * 3] - cx) / rad; pos[i * 3 + 1] = (pos[i * 3 + 1] - mn[1]) / rad; pos[i * 3 + 2] = (pos[i * 3 + 2] - cz) / rad; }
  await MeshoptSimplifier.ready;
  const lods = [];
  const targets = [Math.min(idx.length, 24000 * 3), 4000 * 3, 700 * 3, 120 * 3];
  for (const t of targets) {
    const [out] = t >= idx.length ? [idx] : MeshoptSimplifier.simplify(idx, pos, 3, t, 0.05, ['LockBorder']);
    lods.push(out);
  }
  // compacta vértices usados
  const used = new Int32Array(vc).fill(-1); let nv = 0;
  for (const l of lods) for (const v of l) if (used[v] < 0) used[v] = nv++;
  const P = new Float32Array(nv * 3), Nn = new Float32Array(nv * 3), U = new Float32Array(nv * 2);
  for (let i = 0; i < vc; i++) if (used[i] >= 0) { const j = used[i]; P.set(pos.subarray(i * 3, i * 3 + 3), j * 3); Nn.set(nrm.subarray(i * 3, i * 3 + 3), j * 3); U.set(uv.subarray(i * 2, i * 2 + 2), j * 2); }
  const I = lods.map((l) => Uint32Array.from(l, (v) => used[v]));
  const meta = { vertexCount: nv, height: (mx[1] - mn[1]) / rad, lods: [] };
  let off = nv * 8 * 4;
  for (const l of I) { meta.lods.push({ offset: off, count: l.length }); off += l.length * 4; }
  const buf = Buffer.concat([Buffer.from(P.buffer), Buffer.from(Nn.buffer), Buffer.from(U.buffer), ...I.map((l) => Buffer.from(l.buffer))]);
  await fs.writeFile(path.join(dir, `${R.id}.bin`), buf);
  await fs.writeFile(path.join(dir, `${R.id}.json`), JSON.stringify(meta));
  const geo = { index: idx };
  for (const [tier, size] of Object.entries({ '1k': 1024, '2k': 2048 })) {
    const aOut = path.join(dir, `${R.id}_${tier}_a.webp`), nOut = path.join(dir, `${R.id}_${tier}_n.webp`);
    if ((await exists(aOut)) && (await exists(nOut))) continue;
    const diff = marsify(await raw(tex.diff, size), ROCK_TARGET, 0.2, 1.05);
    const nor = await raw(tex.nor, size), arm = await raw(tex.arm, size);
    const n = size * size, N = Buffer.alloc(n * 3);
    for (let i = 0; i < n; i++) {
      const ao = Math.sqrt(arm[i * 3] / 255);
      for (let c = 0; c < 3; c++) diff[i * 3 + c] = Math.round(diff[i * 3 + c] * ao);
      N[i * 3] = nor[i * 3]; N[i * 3 + 1] = nor[i * 3 + 1]; N[i * 3 + 2] = arm[i * 3 + 1];
    }
    await sharp(diff, { raw: { width: size, height: size, channels: 3 } }).webp({ quality: 90 }).toFile(aOut);
    await sharp(N, { raw: { width: size, height: size, channels: 3 } }).webp({ quality: 94 }).toFile(nOut);
  }
  console.log('rock', R.id, geo.index.length / 3, 'tris');
}

await Promise.all(LAYERS.map(buildLayer));
for (const R of ROCKS) await buildRock(R);
console.log('ok');
