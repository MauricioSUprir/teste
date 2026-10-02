// Estruturas construíveis da base + pontos de coleta. Geometria procedural PBR.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { LanderMats } from './lander';
import { beacon, BEACON_MAT, WINDOW_MAT } from './nightfx';
import { detail } from '../render/detail';
import { crumpledSheet } from './debris';
import { holoMaterial, HOLO_OK, HOLO_BAD } from '../render/holo';
import type { BuildId } from '../sim/balance';

const shadow = <T extends THREE.Object3D>(o: T): T => { o.traverse((c) => { if ((c as THREE.Mesh).isMesh) { c.castShadow = true; c.receiveShadow = true; } }); return o; };

export function makeStructMats(M: LanderMats) {
  return {
    ...M,
    // tecido beta (fibra de vidro revestida) das camadas externas de habitats infláveis
    fabric: detail(new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0.86, 0.85, 0.82), roughness: 0.85, sheen: 1, sheenRoughness: 0.6, sheenColor: new THREE.Color(0.9, 0.9, 0.88) }), { set: 'fabric', tile: 0.35, albedo: 0.7 }),
    glassGreen: new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0.15, 0.55, 0.22), roughness: 0.08, transmission: 0, metalness: 0, clearcoat: 1, emissive: new THREE.Color(0.02, 0.12, 0.03), emissiveIntensity: 1 }),
    lamp: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: new THREE.Color(1, 0.9, 0.75), emissiveIntensity: 6 }),
    ledGreen: new THREE.MeshStandardMaterial({ color: 0x103010, emissive: new THREE.Color(0.2, 1, 0.3), emissiveIntensity: 5 }),
    ghostOk: holoMaterial(HOLO_OK),
    ghostBad: holoMaterial(HOLO_BAD),
  };
}
export type StructMats = ReturnType<typeof makeStructMats>;

export const FOOTPRINT: Record<BuildId, number> = { habitat: 6.0, panel: 2.2, battery: 1.1, moxie: 1.2, extractor: 1.4, bioreactor: 1.8, residence: 3.4, turret: 1.3 };

/** raio do habitat inflável (o interior percorrível usa o mesmo tamanho) */
export const HAB_R = 4.4;

export function buildHabitat(M: StructMats) {
  const g = new THREE.Group();
  const R = HAB_R;
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 2.4, 48, 1, true), M.fabric);
  wall.position.y = 1.2;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(R, 48, 20, 0, Math.PI * 2, 0, Math.PI / 2), M.fabric);
  dome.position.y = 2.4;
  dome.scale.y = 0.62;
  // costuras / cintas de restrição
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.07, 2.4, 0.07), M.metal);
    rib.position.set(Math.cos(a) * (R + 0.02), 1.2, Math.sin(a) * (R + 0.02));
    g.add(rib);
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R + 0.03, 0.08, 10, 64), M.metal);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 2.4;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.25, R + 0.4, 0.35, 48), M.silver);
  base.position.y = 0.1;
  // eclusa (airlock) apontando para +Z
  const lock = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 2.2, 32), M.white);
  lock.rotation.x = Math.PI / 2;
  lock.position.set(0, 1.15, R + 0.8);
  const door = new THREE.Mesh(new RoundedBoxGeometry(1.0, 1.55, 0.12, 3, 0.12), M.metal);
  door.position.set(0, 1.1, R + 1.92);
  const light = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.06, 0.06), M.lamp);
  light.position.set(0, 2.05, R + 1.92);
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), M.ledGreen);
  led.position.set(0.62, 1.2, R + 1.93);
  // janela circular
  const win = new THREE.Mesh(new THREE.CircleGeometry(0.45, 32), WINDOW_MAT);
  win.position.set(R + 0.01, 1.5, 0);
  win.rotation.y = Math.PI / 2;
  const bc = beacon(0.08); bc.position.set(0, 2.4 + R * 0.62 + 0.06, 0);
  g.add(wall, dome, ring, base, lock, door, light, led, win, bc);
  g.userData.door = new THREE.Vector3(0, 0, R + 2.3);
  return shadow(g);
}

export function buildPanel(M: StructMats) {
  const g = new THREE.Group();
  const frame = new THREE.Group();
  const panel = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.05, 1.9), M.solar);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(2.66, 0.04, 1.96), M.metal);
  edge.position.y = -0.03;
  frame.add(panel, edge);
  frame.position.y = 1.05;
  frame.rotation.x = THREE.MathUtils.degToRad(18); // inclinação ≈ latitude, voltado para o equador
  for (const [x, z, h] of [[-1.1, -0.7, 1.35], [1.1, -0.7, 1.35], [-1.1, 0.7, 0.75], [1.1, 0.7, 0.75]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, h, 8), M.metal);
    leg.position.set(x, h / 2, z);
    g.add(leg);
  }
  g.add(frame);
  g.userData.panel = panel;
  return shadow(g);
}

export function buildBattery(M: StructMats) {
  const g = new THREE.Group();
  const box = new THREE.Mesh(new RoundedBoxGeometry(1.1, 0.9, 0.8, 3, 0.05), M.white);
  box.position.y = 0.45;
  for (let i = 0; i < 6; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.7, 0.6), M.metal);
    fin.position.set(-0.4 + i * 0.16, 0.45, 0.42);
    fin.rotation.y = Math.PI / 2;
    g.add(fin);
  }
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.02), M.ledGreen);
  led.position.set(0, 0.8, 0.41);
  g.add(box, led);
  return shadow(g);
}

export function buildMoxie(M: StructMats) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new RoundedBoxGeometry(1.0, 0.8, 0.9, 3, 0.06), M.gold);
  body.position.y = 0.55;
  const top = new THREE.Mesh(new RoundedBoxGeometry(1.02, 0.1, 0.92, 2, 0.03), M.silver);
  top.position.y = 0.98;
  const intake = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.4, 20, 1, true), M.metal);
  intake.position.set(0.3, 1.2, 0);
  const tank = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.7, 6, 16), M.white);
  tank.rotation.z = Math.PI / 2;
  tank.position.set(0, 0.25, 0.62);
  const rad = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.03), M.silver);
  rad.position.set(0, 0.6, -0.5);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.15, 0.95), M.metal);
  legs.position.y = 0.08;
  g.add(body, top, intake, tank, rad, legs);
  return shadow(g);
}

export function buildExtractor(M: StructMats) {
  const g = new THREE.Group();
  const hopper = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.2, 0.6, 24, 1, true), M.metal);
  (hopper.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
  hopper.position.y = 1.5;
  const oven = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.0, 32), M.silver);
  oven.position.y = 0.75;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.47, 0.12, 32), M.orange);
  band.position.y = 0.9;
  const pipe = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.04, 8, 24, Math.PI), M.metal);
  pipe.position.set(0.5, 0.6, 0);
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.7, 24), new THREE.MeshPhysicalMaterial({ color: 0x5aa0d8, roughness: 0.1, clearcoat: 1, transparent: true, opacity: 0.75 }));
  tank.position.set(0.95, 0.35, 0);
  const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 0.25, 24), M.metal);
  legs.position.y = 0.12;
  g.add(hopper, oven, band, pipe, tank, legs);
  return shadow(g);
}

export function buildBioreactor(M: StructMats) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new RoundedBoxGeometry(2.4, 0.3, 1.2, 2, 0.05), M.white);
  base.position.y = 0.15;
  for (let i = 0; i < 6; i++) {
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.4, 20), M.glassGreen);
    tube.position.set(-0.95 + i * 0.38, 1.0, 0);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.08, 20), M.metal);
    cap.position.set(tube.position.x, 1.74, 0);
    g.add(tube, cap);
  }
  const bar = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.06, 0.1), M.metal);
  bar.position.y = 1.8;
  const light = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.04, 0.25), M.lamp);
  light.position.set(0, 1.86, 0.12);
  g.add(base, bar, light);
  return shadow(g);
}

/** módulo residencial: cilindro deitado estilo módulos da ISS (r 1,6 m × 6 m), sobre berço, coberto de regolito no topo.
 *  Sem luz própria (só janelas e lâmpada emissiva) — luzes novas recompilam tudo no iPhone. */
export function buildResidence(M: StructMats) {
  const g = new THREE.Group();
  const R = 1.6, L = 6;
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(R, R, L, 40, 1, true), M.white);
  hull.rotation.z = Math.PI / 2; hull.position.y = R + 0.35;
  for (const sx of [-1, 1]) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(R, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.white);
    cap.scale.y = 0.35; cap.rotation.z = -sx * Math.PI / 2; cap.position.set(sx * L / 2, R + 0.35, 0);
    g.add(cap);
  }
  // anéis estruturais e corrimãos
  for (let i = 0; i < 5; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R + 0.03, 0.05, 8, 40), M.metal);
    ring.rotation.y = Math.PI / 2; ring.position.set(-L / 2 + 0.4 + i * (L - 0.8) / 4, R + 0.35, 0);
    g.add(ring);
  }
  for (const sz of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, L - 0.6, 6), M.gold);
    rail.rotation.z = Math.PI / 2; rail.position.set(0, R + 0.35 + 0.9, sz * (R * 0.6));
    g.add(rail);
  }
  // berço e sapatas
  for (const x of [-L / 2 + 0.8, 0, L / 2 - 0.8]) {
    const cradle = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, R * 1.7), M.metal);
    cradle.position.set(x, 0.3, 0); g.add(cradle);
  }
  // janelas (acendem à noite) dos dois lados
  for (const sz of [-1, 1]) for (let i = 0; i < 3; i++) {
    const w = new THREE.Mesh(new THREE.CircleGeometry(0.22, 20), WINDOW_MAT);
    w.position.set(-1.6 + i * 1.6, R + 0.55, sz * (R + 0.01)); w.rotation.y = sz > 0 ? 0 : Math.PI;
    g.add(w);
  }
  // escotilha + lâmpada da porta
  const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.12, 24), M.metal);
  hatch.rotation.z = Math.PI / 2; hatch.position.set(L / 2 + 0.55, R + 0.1, 0);
  const lampM = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.3), M.lamp); lampM.position.set(L / 2 + 0.6, R + 0.85, 0);
  // camada de regolito ensacado no topo (proteção contra radiação)
  const bags = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.12, R + 0.12, L * 0.9, 24, 1, true, -Math.PI * 0.32, Math.PI * 0.64), new THREE.MeshStandardMaterial({ color: new THREE.Color(0.42, 0.24, 0.15), roughness: 0.95, side: THREE.DoubleSide }));
  bags.rotation.z = Math.PI / 2; bags.rotation.x = Math.PI / 2; bags.position.y = R + 0.35;
  const bc = beacon(0.06); bc.position.set(0, R * 2 + 0.5, 0);
  g.add(hull, hatch, lampM, bags, bc);
  return shadow(g);
}

/** torre de defesa: tripé de treliça (3 m), cabeça com cúpula de sensor e cano duplo. head = parte que gira */
export function buildTurret(M: StructMats) {
  const g = new THREE.Group();
  const H = 2.6;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const foot = new THREE.Vector3(Math.cos(a) * 1.0, 0, Math.sin(a) * 1.0), top = new THREE.Vector3(0, H, 0);
    const len = foot.distanceTo(top);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, len, 8), M.metal);
    leg.position.copy(foot).lerp(top, 0.5); leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), top.clone().sub(foot).normalize());
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.08, 12), M.metal); pad.position.copy(foot).setY(0.04);
    g.add(leg, pad);
    // travessas da treliça
    const n = foot.clone().lerp(top, 0.45), m = new THREE.Vector3(Math.cos(a + 2.094) * 1.0, 0, Math.sin(a + 2.094) * 1.0).lerp(top, 0.45);
    const br = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, n.distanceTo(m), 6), M.metal);
    br.position.copy(n).lerp(m, 0.5); br.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), m.clone().sub(n).normalize());
    g.add(br);
  }
  const bat = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.35, 0.4, 2, 0.04), M.white); bat.position.y = 1.0; g.add(bat);
  const head = new THREE.Group(); head.position.y = H;
  const yoke = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.25, 20), M.dark); yoke.position.y = 0.12;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.white); dome.position.y = 0.25;
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), BEACON_MAT); eye.position.set(0, 0.36, -0.24);
  head.add(yoke, dome, eye);
  for (const sx of [-1, 1]) {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.9, 10), M.dark);
    barrel.rotation.x = Math.PI / 2; barrel.position.set(sx * 0.12, 0.3, -0.55);
    const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.08, 10), M.metal);
    muzzle.rotation.x = Math.PI / 2; muzzle.position.set(sx * 0.12, 0.3, -1.0);
    head.add(barrel, muzzle);
  }
  g.add(head);
  g.userData.head = head;
  return shadow(g);
}

export const BUILDERS: Record<BuildId, (M: StructMats) => THREE.Group> = {
  habitat: buildHabitat, panel: buildPanel, battery: buildBattery, moxie: buildMoxie, extractor: buildExtractor, bioreactor: buildBioreactor,
  residence: buildResidence, turret: buildTurret,
};

/** afloramento de gesso (veios brancos de sulfato de cálcio) */
export function buildGypsum(M: StructMats, seed: number) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.86, 0.8, 0.7), roughness: 0.75 });
  let s = seed;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 9; i++) {
    const geo = new THREE.DodecahedronGeometry(0.25 + r() * 0.35, 0);
    geo.scale(1.4, 0.45 + r() * 0.3, 0.8);
    const m = new THREE.Mesh(geo, mat);
    m.position.set((r() - 0.5) * 2.2, 0.05, (r() - 0.5) * 2.2);
    m.rotation.set(r() * 0.4, r() * 6, r() * 0.4);
    g.add(m);
  }
  void M;
  return shadow(g);
}

/** fragmento de sucata grande (painéis, treliças) para os locais de destroços */
export function buildWreck(M: StructMats, seed: number) {
  const g = new THREE.Group();
  let s = seed;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  // ~70% chapa pintada/compósito, ~30% manta térmica (realismo de destroços de espaçonave)
  const mats = [M.hull, M.white, M.metal, M.burnt, M.white, M.hull, M.gold, M.silver];
  for (let i = 0; i < 4; i++) {
    const m = crumpledSheet(0.5 + r() * 1.5, 0.35 + r() * 1.0, seed + i * 31, mats[Math.floor(r() * mats.length)]);
    m.position.set((r() - 0.5) * 1.6, 0, (r() - 0.5) * 1.6);
    m.rotation.y = r() * 6;
    g.add(m);
  }
  const box = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.3, 0.4, 2, 0.03), M.dark);
  box.position.set(0.2, 0.15, -0.2);
  box.rotation.y = r() * 6;
  const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 8), M.metal);
  strut.position.set(-0.3, 0.3, 0.3);
  strut.rotation.z = 1.2;
  g.add(box, strut);
  return shadow(g);
}
