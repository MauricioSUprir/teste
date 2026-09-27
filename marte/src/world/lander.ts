// Módulo de pouso ARES IV (pouso forçado) + destroços. Geometria procedural com materiais PBR.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mulberry32 } from './noise';
import type { Terrain } from './terrain';

export interface BoxCollider { pos: THREE.Vector3; half: THREE.Vector3; quat: THREE.Quaternion }

function crinkleTexture(size = 512, seed = 3) {
  // manta térmica (MLI) amassada: normal map procedural
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const r = mulberry32(seed);
  const h = new Float32Array(size * size);
  for (let k = 0; k < 220; k++) {
    const cx = r() * size, cy = r() * size, rad = 8 + r() * 60, a = (r() - 0.5) * 1.2;
    for (let y = Math.max(0, cy - rad | 0); y < Math.min(size, cy + rad); y++)
      for (let x = Math.max(0, cx - rad | 0); x < Math.min(size, cx + rad); x++) {
        const d = Math.hypot(x - cx, y - cy) / rad;
        if (d < 1) h[y * size + x] += a * (1 - d) * (1 - d);
      }
  }
  const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const hx = h[y * size + Math.min(size - 1, x + 1)] - h[y * size + Math.max(0, x - 1)];
      const hy = h[Math.min(size - 1, y + 1) * size + x] - h[Math.max(0, y - 1) * size + x];
      const nx = -hx * 3, ny = -hy * 3, l = Math.hypot(nx, ny, 1);
      const i = (y * size + x) * 4;
      img.data[i] = (nx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (ny / l * 0.5 + 0.5) * 255; img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

function panelTexture() {
  // células solares
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#0b1530';
  g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    g.fillStyle = `hsl(${222 + (x * 7 + y * 3) % 8}, 55%, ${14 + ((x + y) % 3)}%)`;
    g.fillRect(x * 32 + 1.5, y * 32 + 1.5, 29, 29);
    g.fillStyle = 'rgba(200,210,230,0.35)';
    g.fillRect(x * 32 + 1.5, y * 32 + 15, 29, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function makeLanderMaterials() {
  const crinkle = crinkleTexture();
  crinkle.repeat.set(2, 2);
  return {
    gold: new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0.9, 0.66, 0.3), metalness: 1, roughness: 0.35, normalMap: crinkle, normalScale: new THREE.Vector2(0.8, 0.8) }),
    silver: new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0.85, 0.86, 0.88), metalness: 1, roughness: 0.2, normalMap: crinkle, normalScale: new THREE.Vector2(0.6, 0.6) }),
    white: new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0.82, 0.81, 0.78), roughness: 0.45, clearcoat: 0.3, clearcoatRoughness: 0.5 }),
    metal: new THREE.MeshStandardMaterial({ color: new THREE.Color(0.55, 0.56, 0.58), metalness: 0.9, roughness: 0.35 }),
    dark: new THREE.MeshStandardMaterial({ color: new THREE.Color(0.05, 0.05, 0.055), metalness: 0.4, roughness: 0.55 }),
    burnt: new THREE.MeshStandardMaterial({ color: new THREE.Color(0.1, 0.08, 0.07), metalness: 0.6, roughness: 0.7 }),
    shield: new THREE.MeshStandardMaterial({ color: new THREE.Color(0.18, 0.12, 0.09), metalness: 0.1, roughness: 0.9 }),
    solar: new THREE.MeshPhysicalMaterial({ map: panelTexture(), metalness: 0.3, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08 }),
    orange: new THREE.MeshStandardMaterial({ color: new THREE.Color(0.85, 0.3, 0.06), roughness: 0.6 }),
    cloth: new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0.9, 0.9, 0.88), roughness: 0.9, sheen: 1, sheenRoughness: 0.6, side: THREE.DoubleSide }),
    clothRed: new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0.75, 0.18, 0.08), roughness: 0.9, sheen: 1, sheenRoughness: 0.6, side: THREE.DoubleSide }),
  };
}
export type LanderMats = ReturnType<typeof makeLanderMaterials>;

function shadowAll(o: THREE.Object3D) {
  o.traverse((c) => { if ((c as THREE.Mesh).isMesh) { c.castShadow = true; c.receiveShadow = true; } });
  return o;
}

/** módulo principal: estágio de descida octogonal + cabine tripulada */
export function buildLander(M: LanderMats) {
  const g = new THREE.Group();
  // estágio de descida
  const base = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.5, 1.5, 8, 1), M.gold);
  base.position.y = 1.6;
  g.add(base);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(2.52, 2.52, 0.12, 8), M.metal);
  rim.position.y = 0.85;
  g.add(rim);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(2.32, 2.32, 0.1, 8), M.silver);
  top.position.y = 2.38;
  g.add(top);
  // tanques esféricos visíveis
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const tk = new THREE.Mesh(new THREE.SphereGeometry(0.55, 32, 20), M.white);
    tk.position.set(Math.cos(a) * 1.9, 1.35, Math.sin(a) * 1.9);
    g.add(tk);
  }
  // bocais de motor
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const nz = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.42, 0.7, 24, 1, true), M.burnt);
    nz.material.side = THREE.DoubleSide;
    nz.position.set(Math.cos(a) * 1.0, 0.55, Math.sin(a) * 1.0);
    g.add(nz);
  }
  // pernas (uma quebrada)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const leg = new THREE.Group();
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.6, 12), M.metal);
    strut.position.y = -1.1;
    strut.rotation.z = 0.5;
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.12, 24), M.metal);
    pad.position.set(0.62, -2.25, 0);
    const brace = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 8), M.metal);
    brace.position.set(0.25, -1.4, 0);
    brace.rotation.z = -0.6;
    leg.add(strut, pad, brace);
    leg.position.set(Math.cos(a) * 2.2, 2.2, Math.sin(a) * 2.2);
    leg.rotation.y = -a;
    if (i === 1) { leg.rotation.z = -0.9; leg.position.y = 1.4; } // perna dobrada no impacto
    g.add(leg);
  }
  // cabine tripulada (pressurizada)
  const cab = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.55, 2.4, 32), M.white);
  cab.position.y = 3.6;
  g.add(cab);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1.35, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), M.white);
  dome.position.y = 4.8;
  g.add(dome);
  const win = new THREE.Mesh(new RoundedBoxGeometry(0.8, 0.45, 0.2, 3, 0.08), new THREE.MeshPhysicalMaterial({ color: 0x0a0f14, metalness: 0.2, roughness: 0.05, clearcoat: 1 }));
  win.position.set(0, 4.3, 1.42);
  win.rotation.x = -0.12;
  g.add(win);
  const hatch = new THREE.Mesh(new RoundedBoxGeometry(0.9, 1.3, 0.14, 3, 0.1), M.metal);
  hatch.position.set(1.42, 3.4, 0);
  hatch.rotation.y = Math.PI / 2;
  g.add(hatch);
  // faixa laranja e antena de alto ganho danificada
  const band = new THREE.Mesh(new THREE.CylinderGeometry(1.37, 1.37, 0.25, 32, 1, true), M.orange);
  band.position.y = 3.0;
  g.add(band);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 8), M.metal);
  mast.position.set(-0.6, 5.9, 0.2);
  mast.rotation.z = 0.5;
  const dish = new THREE.Mesh(new THREE.SphereGeometry(0.6, 32, 12, 0, Math.PI * 2, 0, 0.9), M.white);
  dish.material = M.white.clone();
  (dish.material as THREE.MeshPhysicalMaterial).side = THREE.DoubleSide;
  dish.position.set(-1.0, 6.3, 0.3);
  dish.rotation.set(1.9, 0, 0.6);
  g.add(mast, dish);
  // painel solar dobrado
  const sp = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.05, 1.3), M.solar);
  sp.position.set(-2.6, 2.5, -1.2);
  sp.rotation.set(0.3, 0.5, -0.4);
  g.add(sp);
  return shadowAll(g);
}

export function buildCrate(M: LanderMats, w = 1.1, h = 0.7, d = 0.8) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, 0.04), M.white);
  const lid = new THREE.Mesh(new RoundedBoxGeometry(w * 1.02, 0.08, d * 1.02, 2, 0.02), M.metal);
  lid.position.y = h / 2;
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(w * 1.005, 0.1, d * 1.005), M.orange);
  stripe.position.y = h * 0.1;
  g.add(body, lid, stripe);
  for (const sx of [-1, 1]) {
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.015, 8, 16, Math.PI), M.metal);
    handle.position.set(sx * w / 2, h * 0.25, 0);
    handle.rotation.y = Math.PI / 2;
    g.add(handle);
  }
  return shadowAll(g);
}

/** Monta o local do pouso forçado. Retorna o grupo, colisores e as posições das caixas. */
export function buildCrashSite(terrain: Terrain, M: LanderMats) {
  const group = new THREE.Group();
  const colliders: BoxCollider[] = [];
  const rnd = mulberry32(4242);
  const place = (o: THREE.Object3D, x: number, z: number, yaw: number, sink = 0, tiltAlign = true) => {
    const y = terrain.heightAt(x, z) - sink;
    o.position.set(x, y, z);
    const n = terrain.normalAt(x, z);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tiltAlign ? n : new THREE.Vector3(0, 1, 0));
    o.quaternion.copy(q).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)));
    group.add(o);
    return o;
  };
  const lander = buildLander(M);
  place(lander, -8, -4, 0.4, 0.35);
  lander.rotateZ(0.12); // inclinado pela perna quebrada
  lander.updateMatrixWorld(true);
  colliders.push({ pos: new THREE.Vector3(-8, terrain.heightAt(-8, -4) + 2.3, -4), half: new THREE.Vector3(2.2, 2.3, 2.2), quat: lander.quaternion.clone() });
  colliders.push({ pos: new THREE.Vector3(-8, terrain.heightAt(-8, -4) + 4.5, -4), half: new THREE.Vector3(1.3, 1.6, 1.3), quat: lander.quaternion.clone() });

  // escudo térmico caído (visto a distância)
  const shield = new THREE.Mesh(new THREE.SphereGeometry(4.5, 48, 12, 0, Math.PI * 2, 0, 0.45), M.shield);
  (shield.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
  place(shield, 70, 84, 0.3, 0.8);
  shield.rotateX(Math.PI * 0.92);
  shadowAll(shield);

  // paraquedas estendido no solo
  const chute = new THREE.Mesh(new THREE.CircleGeometry(7, 48, 0, Math.PI * 2), M.cloth);
  const cp = chute.geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < cp.count; i++) cp.setZ(i, Math.sin(cp.getX(i) * 0.9) * 0.18 + Math.cos(cp.getY(i) * 1.3) * 0.12);
  chute.geometry.computeVertexNormals();
  chute.rotation.x = -Math.PI / 2;
  const chuteG = new THREE.Group();
  chute.position.y = 0.2;
  chuteG.add(chute);
  const gore = new THREE.Mesh(new THREE.RingGeometry(3, 4.2, 48, 1, 0, Math.PI * 0.7), M.clothRed);
  gore.rotation.x = -Math.PI / 2;
  gore.position.y = 0.26;
  chuteG.add(gore);
  place(chuteG, 126, -10, 1.2, 0, true);
  shadowAll(chuteG);

  // caixas de suprimentos espalhadas (interativas na etapa 2)
  const crates: THREE.Vector3[] = [];
  const spots = [[4, -10], [-16, 5], [9, 12], [-3, 18], [22, -6]];
  for (const [x, z] of spots) {
    const c = buildCrate(M);
    place(c, x, z, rnd() * 6, -0.33);
    c.rotateZ((rnd() - 0.5) * 0.25);
    crates.push(c.position.clone());
    colliders.push({ pos: c.position.clone().add(new THREE.Vector3(0, 0.35, 0)), half: new THREE.Vector3(0.55, 0.35, 0.4), quat: c.quaternion.clone() });
  }
  // fragmentos metálicos
  for (let i = 0; i < 26; i++) {
    const a = rnd() * Math.PI * 2, r = 6 + rnd() * 40;
    const x = -8 + Math.cos(a) * r, z = -4 + Math.sin(a) * r * 0.7;
    const w = 0.3 + rnd() * 1.4, d = 0.2 + rnd() * 0.9;
    const frag = new THREE.Mesh(new THREE.BoxGeometry(w, 0.03 + rnd() * 0.05, d), rnd() < 0.5 ? M.gold : rnd() < 0.5 ? M.silver : M.metal);
    frag.castShadow = true; frag.receiveShadow = true;
    place(frag, x, z, rnd() * 6, -0.02);
    frag.rotateX((rnd() - 0.5) * 0.6);
  }
  return { group, colliders, crates, landerPos: new THREE.Vector3(-8, 0, -4), mats: M };
}

/** marca de arrasto / cratera de impacto no relevo antes de gerar malha e física */
export function carveCrash(heights: Float32Array, res: number, size: number) {
  const half = size / 2;
  const S = (x: number, z: number) => (Math.round(z + half) * res + Math.round(x + half));
  // sulco de 45 m de leste para oeste terminando no módulo
  for (let z = -20; z <= 12; z++)
    for (let x = -14; x <= 45; x++) {
      const t = (x + 14) / 59;
      const w = 3.5 + t * 2;
      const dz = z - (-4 + t * 3);
      const k = Math.exp(-(dz * dz) / (w * w));
      const depth = 0.55 * k * (1 - Math.abs(t - 0.35) * 1.2);
      const berm = 0.35 * Math.exp(-((Math.abs(dz) - w * 1.3) ** 2) / 2);
      const i = S(x, z);
      if (i >= 0 && i < heights.length) heights[i] += -Math.max(0, depth) + berm * (t < 0.9 ? 1 : 0);
    }
}
