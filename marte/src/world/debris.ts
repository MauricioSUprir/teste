// Destroços realistas: chapas amassadas e rasgadas (em vez de caixas finas), dupla face, apoiadas no solo.
import * as THREE from 'three';

const dsCache = new WeakMap<THREE.Material, THREE.Material>();
/** versão dupla face do material (chapas finas são vistas dos dois lados) */
export function doubleSided<T extends THREE.Material>(m: T): T {
  let d = dsCache.get(m);
  if (!d) { d = m.clone(); d.side = THREE.DoubleSide; dsCache.set(m, d); }
  return d as T;
}

/** chapa w×d amassada: vincos, borda levantada/rasgada; base em y≈0 */
export function crumpledSheet(w: number, d: number, seed: number, mat: THREE.Material) {
  let s = seed | 0 || 1;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const nx = Math.max(4, Math.round(w * 7)), nz = Math.max(4, Math.round(d * 7));
  const g = new THREE.PlaneGeometry(w, d, nx, nz);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position as THREE.BufferAttribute;
  // vincos: poucas dobras em direções aleatórias + ruído fino
  const folds = Array.from({ length: 3 }, () => ({ a: r() * Math.PI, o: (r() - 0.5) * Math.min(w, d), k: (r() - 0.5) * 0.12 }));
  const curlEdge = r() < 0.6 ? Math.floor(r() * 4) : -1;
  const curlAmt = 0.15 + r() * 0.35;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    let y = 0;
    for (const f of folds) y += Math.abs((x * Math.cos(f.a) + z * Math.sin(f.a)) - f.o) * f.k;
    y += Math.sin(x * 11.3 + seed) * Math.cos(z * 9.7) * 0.012;
    // borda enrolada pelo impacto
    const u = [x / w + 0.5, 0.5 - x / w, z / d + 0.5, 0.5 - z / d][Math.max(0, curlEdge)];
    if (curlEdge >= 0) y += Math.pow(Math.max(0, 0.35 - u) / 0.35, 2) * curlAmt;
    // borda rasgada: puxa vértices da borda para dentro de forma irregular
    const ex = Math.abs(x) > w / 2 - 1e-4, ez = Math.abs(z) > d / 2 - 1e-4;
    if (ex || ez) { const k = r() * 0.12; p.setX(i, x * (1 - (ex ? k : k * 0.3))); p.setZ(i, z * (1 - (ez ? k : k * 0.3))); }
    p.setY(i, y);
  }
  // apoia no chão: o ponto mais baixo fica em y = 0
  let min = Infinity; for (let i = 0; i < p.count; i++) min = Math.min(min, p.getY(i));
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) - min + 0.01);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, doubleSided(mat));
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
