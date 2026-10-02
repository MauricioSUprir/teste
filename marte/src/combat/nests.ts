// Colmeias dos rastejadores: montes orgânicos de quitina úmida com bolsas que pulsam em vermelho-alaranjado.
// Ficam em locais de exploração e têm guardas que atacam DE DIA. Destruir dá núcleos alienígenas (torres de defesa)
// e a colmeia volta a crescer 2 sóis depois. Desempenho: 2 malhas por colmeia (casca + bolsas), materiais
// compartilhados (opacos, sem luz), só a colmeia mais próxima (até 80 m) fica "acordada".
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Terrain } from '../world/terrain';
import { enhance } from '../render/materials';
import { mulberry32 } from '../world/noise';
import type { GameState } from '../sim/state';
import type { Loot } from './creatures';

export interface NestDef { id: string; x: number; z: number; guards: number }
export const NESTS: NestDef[] = [
  { id: 'n1', x: 46, z: -64, guards: 2 },
  { id: 'n2', x: 168, z: 72, guards: 3 },
  { id: 'n3', x: -292, z: -348, guards: 4 },
];
export const NEST_HP = 300;
export const NEST_RADIUS = 2.8;
export const NEST_LOOT: Loot = { core: 2, chitin: 4, scrap: 4, electronics: 2 };
const REGROW_SOLS = 2;

export interface Nest {
  def: NestDef;
  pos: THREE.Vector3;
  hp: number;
  alive: boolean;
  shell: THREE.Mesh;
  pods: THREE.Mesh;
  spawned: number;   // guardas já criados nesta "vida" da colmeia
  reinforceT: number;
  flash: number;
}

function blob(rng: () => number, r: number) {
  // vértices soldados → normais suaves (superfície orgânica, não pedra facetada)
  const g0 = new THREE.IcosahedronGeometry(r, 4); g0.deleteAttribute('normal'); g0.deleteAttribute('uv');
  const g = mergeVertices(g0);
  const p = g.attributes.position as THREE.BufferAttribute;
  const f1 = 2 + rng() * 3, f2 = 5 + rng() * 4, ph = rng() * 6;
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(p, i);
    const n = v.clone().normalize();
    const d = 1 + 0.16 * Math.sin(n.x * f1 + ph) * Math.cos(n.z * f1 - ph) + 0.06 * Math.sin(n.y * f2 + n.x * f2);
    v.multiplyScalar(d);
    if (v.y < 0) v.y *= 0.35; // assenta no chão
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

function nestGeometry(seed: number) {
  const rng = mulberry32(seed);
  const shell: THREE.BufferGeometry[] = [], pods: THREE.BufferGeometry[] = [];
  const n = 6;
  for (let i = 0; i < n; i++) {
    const r = i === 0 ? 1.6 : 0.6 + rng() * 0.8;
    const a = rng() * Math.PI * 2, d = i === 0 ? 0 : 1.2 + rng() * 1.1;
    const b = blob(rng, r); b.scale(1, 0.75 + rng() * 0.4, 1); b.translate(Math.cos(a) * d, r * 0.35, Math.sin(a) * d);
    shell.push(b);
  }
  // costelas curvas saindo do monte (silhueta de "coisa viva")
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + rng() * 0.4;
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 6; k++) { const t = k / 6; pts.push(new THREE.Vector3(Math.cos(a) * (1.3 + t * 1.6), 0.2 + Math.sin(t * Math.PI) * 1.8, Math.sin(a) * (1.3 + t * 1.6))); }
    shell.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.07 * (1 - 0.3 * rng()), 5));
  }
  // bolsas brilhantes encrustadas
  for (let i = 0; i < 9; i++) {
    const a = rng() * Math.PI * 2, d = 0.6 + rng() * 1.6, y = 0.3 + rng() * 1.3;
    const s = new THREE.SphereGeometry(0.16 + rng() * 0.14, 10, 8); s.scale(1, 1.3, 1); s.translate(Math.cos(a) * d, y, Math.sin(a) * d);
    pods.push(s);
  }
  const clean = (l: THREE.BufferGeometry[]) => mergeGeometries(l.map((q) => { const m = q.index ? q.toNonIndexed() : q; m.deleteAttribute('uv'); return m; }))!;
  return { shell: clean(shell), pods: clean(pods) };
}

export class Nests {
  group = new THREE.Group();
  list: Nest[] = [];
  private shellMat: THREE.MeshStandardMaterial;
  private podMat: THREE.MeshStandardMaterial;
  private t = 0;

  constructor(private terrain: Terrain) {
    this.shellMat = enhance(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.12, 0.05, 0.04), roughness: 0.35, metalness: 0, envMapIntensity: 0.5, emissive: new THREE.Color(1, 0.35, 0.2), emissiveIntensity: 0 }), 'clean');
    this.podMat = enhance(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.18, 0.015, 0.01), roughness: 0.25, emissive: new THREE.Color(0.9, 0.06, 0.01), emissiveIntensity: 0.7 }), 'clean');
    NESTS.forEach((def, i) => {
      const geo = nestGeometry(101 + i * 977);
      const y = terrain.heightAt(def.x, def.z);
      const shell = new THREE.Mesh(geo.shell, this.shellMat), pods = new THREE.Mesh(geo.pods, this.podMat);
      for (const m of [shell, pods]) { m.position.set(def.x, y - 0.25, def.z); m.rotation.y = i * 1.7; m.scale.setScalar(1.6); m.castShadow = true; m.receiveShadow = true; this.group.add(m); }
      this.list.push({ def, pos: new THREE.Vector3(def.x, y, def.z), hp: NEST_HP, alive: true, shell, pods, spawned: 0, reinforceT: 0, flash: 0 });
    });
  }

  /** sincroniza com o save: colmeias destruídas há menos de 2 sóis ficam como cratera */
  sync(st: GameState) {
    const dead = st.nests ?? {};
    for (const n of this.list) {
      const s = dead[n.def.id];
      const alive = s === undefined || st.sol >= s + REGROW_SOLS;
      if (alive && s !== undefined) delete dead[n.def.id];
      if (alive && !n.alive) { n.hp = NEST_HP; n.spawned = 0; }
      n.alive = alive;
      n.shell.visible = n.pods.visible = alive;
    }
  }

  nearest(p: THREE.Vector3, max = 80) {
    let best: Nest | null = null, bd = max;
    for (const n of this.list) { if (!n.alive) continue; const d = Math.hypot(n.pos.x - p.x, n.pos.z - p.z); if (d < bd) { bd = d; best = n; } }
    return best ? { n: best, d: bd } : null;
  }

  raycast(o: THREE.Vector3, d: THREE.Vector3, max: number) {
    let best: Nest | null = null, bt = max;
    const oc = new THREE.Vector3();
    for (const n of this.list) {
      if (!n.alive) continue;
      oc.set(o.x - n.pos.x, o.y - (n.pos.y + 1.3), o.z - n.pos.z);
      const b = oc.dot(d), c = oc.lengthSq() - NEST_RADIUS * NEST_RADIUS, h = b * b - c;
      if (h < 0) continue;
      const t = -b - Math.sqrt(h);
      if (t > 0 && t < bt) { bt = t; best = n; }
    }
    return best ? { n: best, t: bt } : null;
  }

  /** retorna true se destruiu */
  damage(n: Nest, dmg: number, st: GameState) {
    if (!n.alive) return false;
    n.hp -= dmg; n.flash = 0.1;
    if (n.hp > 0) return false;
    n.alive = false; n.shell.visible = n.pods.visible = false;
    st.nests = { ...(st.nests ?? {}), [n.def.id]: st.sol };
    return true;
  }

  update(dt: number) {
    this.t += dt;
    let flash = 0;
    for (const n of this.list) { n.flash = Math.max(0, n.flash - dt); flash = Math.max(flash, n.flash); }
    // pulso lento (respiração) + clarão quando leva tiro; materiais compartilhados (sem recompilar)
    this.podMat.emissiveIntensity = 0.45 + 0.45 * (0.5 + 0.5 * Math.sin(this.t * 1.9)) + flash * 5;
    this.shellMat.emissiveIntensity = flash * 4;
  }

  warmup(scene: THREE.Scene) {
    const a = new THREE.Mesh(new THREE.SphereGeometry(0.1), this.shellMat), b = new THREE.Mesh(new THREE.SphereGeometry(0.1), this.podMat);
    a.position.y = b.position.y = -5000; scene.add(a, b);
    return () => scene.remove(a, b);
  }
}
