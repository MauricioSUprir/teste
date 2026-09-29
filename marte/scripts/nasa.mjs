// Modelos 3D oficiais da NASA (domínio público, github.com/nasa/NASA-3D-Resources) otimizados para o jogo:
// simplificação (meshoptimizer), texturas webp ≤1024 px, compressão meshopt. O rover SEV tem as rodas
// separadas em nós próprios ("wheel_0..5") para girarem.
// Uso: node scripts/nasa.mjs <pasta "3D Models" do repositório>
import path from 'node:path';
import fs from 'node:fs/promises';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, simplify, simplifyPrimitive, prune, dedup, textureCompress, meshopt, compactPrimitive, resample } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { MeshoptSimplifier, MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';

const SRC = process.argv[2] || '/home/user/nasa/nasa-3d-resources/3D Models';
const OUT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../public/assets/models');
await MeshoptSimplifier.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
  'meshopt.encoder': MeshoptEncoder,
});

async function finish(doc, out, texSize) {
  await doc.transform(
    prune(), dedup(), resample(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [texSize, texSize], quality: 82 }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  );
  // sem Draco (evita decodificador wasm no cliente)
  for (const e of doc.getRoot().listExtensionsUsed()) if (e.extensionName === 'KHR_draco_mesh_compression') e.dispose();
  await io.write(out, doc);
  const st = await fs.stat(out);
  console.log('ok', path.basename(out), (st.size / 1e6).toFixed(2), 'MB');
}

async function simple(file, out, ratio, texSize = 1024) {
  const doc = await io.read(path.join(SRC, file));
  await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.002, lockBorder: false }));
  await finish(doc, out, texSize);
}

// ---------- rover SEV: separa as 6 rodas (componentes conexos baixos perto de cada eixo)
async function sev() {
  const doc = await io.read(path.join(SRC, 'Space Exploration Vehicle/Space Exploration Vehicle.glb'));
  await doc.transform(weld());
  const root = doc.getRoot();
  const mesh = root.listMeshes()[0];
  const prim = mesh.listPrimitives()[0];
  const bodyNode = root.listNodes().find((n) => n.getMesh() === mesh);
  const pos = prim.getAttribute('POSITION').getArray(), idx = prim.getIndices().getArray();
  const n = pos.length / 3, par = new Int32Array(n).map((_, i) => i);
  const f = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
  for (let t = 0; t < idx.length; t += 3) { const a = f(idx[t]); par[f(idx[t + 1])] = a; par[f(idx[t + 2])] = a; }
  const comps = new Map();
  for (let i = 0; i < n; i++) { const r = f(i); let c = comps.get(r); if (!c) { c = { min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9] }; comps.set(r, c); } for (let k = 0; k < 3; k++) { c.min[k] = Math.min(c.min[k], pos[i * 3 + k]); c.max[k] = Math.max(c.max[k], pos[i * 3 + k]); } }
  // centros dos eixos (coordenadas do modelo: x lateral, y longitudinal, z para baixo)
  const axY = [-2.57, -0.87, 0.83], side = [-1, 1];
  const centers = [];
  // pneus duplos (aro + pneu Ø0,77 m) abaixo dos motores; os motores/suspensão ficam fixos na carroceria
  for (const y of axY) for (const s of side) centers.push([s * 1.7, y, 1.86]);
  const label = new Map();
  for (const [r, c] of comps) {
    const cx = (c.min[0] + c.max[0]) / 2, cy = (c.min[1] + c.max[1]) / 2, cz = (c.min[2] + c.max[2]) / 2;
    const ey = c.max[1] - c.min[1], ez = c.max[2] - c.min[2];
    if (ey > 0.82 || ez > 0.82 || Math.abs(cx) < 1.25 || Math.abs(cx) > 2.1) continue;
    const w = centers.findIndex(([x, y, z]) => Math.sign(x) === Math.sign(cx) && Math.abs(cy - y) < 0.45 && Math.abs(cz - z) < 0.45);
    if (w >= 0) label.set(r, w);
  }
  const groups = Array.from({ length: 7 }, () => []);
  const wc = Array.from({ length: 6 }, () => ({ s: [0, 0, 0], n: 0 }));
  for (let t = 0; t < idx.length; t += 3) {
    const l = label.get(f(idx[t]));
    if (l === -1) continue;
    const g = l === undefined ? 0 : l + 1;
    groups[g].push(idx[t], idx[t + 1], idx[t + 2]);
    if (g > 0) for (let k = 0; k < 3; k++) { const v = idx[t + k]; wc[l].s[0] += pos[v * 3]; wc[l].s[1] += pos[v * 3 + 1]; wc[l].s[2] += pos[v * 3 + 2]; wc[l].n++; }
  }
  const buf = root.listBuffers()[0];
  const mkPrim = (tris) => {
    const p = prim.clone();
    p.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(tris)).setBuffer(buf));
    return compactPrimitive(p);
  };
  prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(groups[0])).setBuffer(buf));
  for (let w = 0; w < 6; w++) {
    if (!groups[w + 1].length) { console.warn('roda sem triângulos', w); continue; }
    const c = wc[w].s.map((v) => v / wc[w].n);
    const p = mkPrim(groups[w + 1]);
    // desloca os vértices para o centro da roda (o nó gira em torno da própria origem)
    const a = p.getAttribute('POSITION'); const arr = a.getArray().slice();
    for (let i = 0; i < arr.length; i += 3) { arr[i] -= c[0]; arr[i + 1] -= c[1]; arr[i + 2] -= c[2]; }
    a.setArray(arr);
    const m = doc.createMesh(`wheel_${w}`).addPrimitive(p);
    const node = doc.createNode(`wheel_${w}`).setMesh(m).setTranslation(c);
    bodyNode.addChild(node);
    console.log('roda', w, 'centro', c.map((v) => v.toFixed(2)).join(','), 'tris', groups[w + 1].length / 3);
  }
  compactPrimitive(prim);
  // carroceria reduzida; rodas (pneus finos) preservadas com mais cuidado
  for (const m of root.listMeshes()) for (const p of m.listPrimitives()) {
    const isWheel = m.getName().startsWith('wheel_');
    simplifyPrimitive(p, { simplifier: MeshoptSimplifier, ratio: isWheel ? 0.4 : 0.3, error: isWheel ? 0.0004 : 0.0015, lockBorder: isWheel });
  }
  await finish(doc, path.join(OUT, 'sev.glb'), 1024);
}

await sev();
if (!process.env.ONLY_SEV) await simple('Mars 2020 Perseverance Rover/Mars 2020 Perseverance Rover.glb', path.join(OUT, 'perseverance.glb'), 0.3);
if (!process.env.ONLY_SEV) await simple('Ingenuity Mars Helicopter/Ingenuity Mars Helicopter.glb', path.join(OUT, 'ingenuity.glb'), 1, 512);
if (!process.env.ONLY_SEV) await simple('Viking Lander/Viking Lander.glb', path.join(OUT, 'viking.glb'), 0.3);
