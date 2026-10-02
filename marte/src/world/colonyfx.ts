// Visual da colônia: colonos andando entre os prédios (1 InstancedMesh, sem esqueleto, balanço por código),
// e a cápsula de colonos pousando com "queima suicida" (chama aditiva, sem luz nova; poeira pelo CombatVFX).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { enhance } from '../render/materials';
import type { Terrain } from './terrain';

const MAX_COLONISTS = 6;
const LAND_T = 12; // s de descida (80 m → 0, freando 2,5 m/s² no fim)
const LAND_H = 80;

function colonistGeometry() {
  const parts: { g: THREE.BufferGeometry; c: [number, number, number] }[] = [];
  const torso = new THREE.CapsuleGeometry(0.24, 0.55, 4, 10); torso.translate(0, 1.05, 0); parts.push({ g: torso, c: [0.9, 0.89, 0.86] });
  for (const s of [-1, 1]) {
    const leg = new THREE.CapsuleGeometry(0.1, 0.55, 3, 8); leg.translate(s * 0.12, 0.42, 0); parts.push({ g: leg, c: [0.86, 0.85, 0.82] });
    const arm = new THREE.CapsuleGeometry(0.075, 0.45, 3, 8); arm.rotateZ(s * 0.18); arm.translate(s * 0.33, 1.05, 0); parts.push({ g: arm, c: [0.86, 0.85, 0.82] });
  }
  const helmet = new THREE.SphereGeometry(0.2, 14, 10); helmet.translate(0, 1.62, 0); parts.push({ g: helmet, c: [0.92, 0.92, 0.9] });
  const visor = new THREE.SphereGeometry(0.16, 12, 8, -0.9, 1.8, 0.9, 1.0); visor.rotateY(Math.PI); visor.scale(1.05, 1, 1.05); visor.translate(0, 1.6, 0.03); parts.push({ g: visor, c: [0.75, 0.5, 0.12] });
  const pack = new THREE.BoxGeometry(0.42, 0.55, 0.22); pack.translate(0, 1.12, 0.26); parts.push({ g: pack, c: [0.8, 0.79, 0.76] });
  const stripe = new THREE.BoxGeometry(0.5, 0.06, 0.5); stripe.translate(0, 1.32, 0); parts.push({ g: stripe, c: [0.85, 0.3, 0.06] });
  return mergeGeometries(parts.map(({ g, c }) => {
    const n = g.index ? g.toNonIndexed() : g; n.deleteAttribute('uv');
    const col = new Float32Array(n.attributes.position.count * 3);
    for (let i = 0; i < col.length; i += 3) col.set(c, i);
    n.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return n;
  }))!;
}

function capsuleShip() {
  const g = new THREE.Group();
  const hull = enhance(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.78, 0.77, 0.74), roughness: 0.55, metalness: 0.1 }), 'clean');
  const shield = enhance(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.15, 0.1, 0.08), roughness: 0.9 }), 'clean');
  const dark = enhance(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.08, 0.08, 0.09), roughness: 0.5, metalness: 0.6 }), 'clean');
  // estilo Orion: tronco de cone com escudo térmico queimado embaixo
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 2.5, 3.0, 36), hull); body.position.y = 1.9;
  const heat = new THREE.Mesh(new THREE.CylinderGeometry(2.55, 2.4, 0.35, 36), shield); heat.position.y = 0.32;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.9, 0.5, 24), dark); top.position.y = 3.65;
  g.add(body, heat, top);
  // pernas de pouso
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    // perna: da borda do escudo (r 2,1, y 0,7) até a sapata (r 2,75, chão)
    const from = new THREE.Vector3(Math.cos(a) * 2.1, 0.75, Math.sin(a) * 2.1), to = new THREE.Vector3(Math.cos(a) * 2.75, 0.08, Math.sin(a) * 2.75);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, from.distanceTo(to), 8), dark);
    leg.position.copy(from).lerp(to, 0.5); leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.08, 14), dark); pad.position.set(Math.cos(a) * 2.75, 0.04, Math.sin(a) * 2.75);
    g.add(leg, pad);
  }
  // janela e escotilha
  const win = new THREE.Mesh(new THREE.CircleGeometry(0.25, 16), new THREE.MeshStandardMaterial({ color: 0x0a1016, emissive: new THREE.Color(1, 0.75, 0.45), emissiveIntensity: 0.8 }));
  win.position.set(0, 2.5, 1.62); win.rotation.x = -0.5;
  g.add(win);
  // chama dos retrofoguetes (aditiva, sem luz)
  const flameGeo = new THREE.ConeGeometry(0.6, 5, 20, 1, true); flameGeo.translate(0, -2.5, 0); flameGeo.rotateX(Math.PI);
  const flame = new THREE.Mesh(flameGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.85, 0.32, 0.07), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true, fog: false }));
  flame.position.y = 0.1; flame.scale.set(1, 1, 1);
  const core = new THREE.Mesh(new THREE.ConeGeometry(0.4, 3, 14, 1, true).translate(0, -1.5, 0).rotateX(Math.PI), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.45, 0.55, 0.85), transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  core.position.y = 0.1;
  flame.rotation.x = Math.PI; core.rotation.x = Math.PI;
  g.add(flame, core);
  g.userData.flame = flame; g.userData.core = core;
  g.traverse((o) => { if ((o as THREE.Mesh).isMesh && o !== flame && o !== core) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

interface Walker { pos: THREE.Vector3; tgt: THREE.Vector3; yaw: number; phase: number; wait: number }

export class ColonyFx {
  group = new THREE.Group();
  private people: THREE.InstancedMesh;
  private walkers: Walker[] = [];
  ship: THREE.Group;
  private landT = -1;
  private pad = new THREE.Vector3();
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  onTouchdown: (() => void) | null = null;
  dust: ((at: THREE.Vector3, n: number) => void) | null = null;

  constructor(private terrain: Terrain) {
    this.people = new THREE.InstancedMesh(colonistGeometry(), enhance(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), 'clean'), MAX_COLONISTS);
    this.people.count = 0; this.people.castShadow = true; this.people.frustumCulled = false;
    this.ship = capsuleShip();
    this.ship.visible = false;
    this.group.add(this.people, this.ship);
  }

  /** nave pousada continua no local do último pouso */
  showLanded(at: THREE.Vector3 | null) {
    if (this.landT >= 0) return;
    this.ship.visible = !!at;
    if (at) { this.pad.copy(at); this.ship.position.set(at.x, this.terrain.heightAt(at.x, at.z), at.z); this.flame(0); }
  }
  get landing() { return this.landT >= 0; }

  startLanding(at: THREE.Vector3) {
    this.pad.copy(at);
    this.landT = 0;
    this.ship.visible = true;
  }

  private flame(k: number) {
    const f = this.ship.userData.flame as THREE.Mesh, c = this.ship.userData.core as THREE.Mesh;
    f.visible = c.visible = k > 0.01;
    const flick = 0.85 + Math.random() * 0.3;
    f.scale.set(1, k * flick, 1); c.scale.set(1, k * flick, 1);
    (f.material as THREE.MeshBasicMaterial).opacity = 0.5 * Math.min(1, k * 2);
  }

  update(dt: number, places: THREE.Vector3[], colonists: number) {
    // ---- pouso
    if (this.landT >= 0) {
      this.landT += dt;
      const s = Math.min(1, this.landT / LAND_T);
      const h = LAND_H * (1 - s) * (1 - s); // velocidade cai a zero no toque (queima suicida)
      const gy = this.terrain.heightAt(this.pad.x, this.pad.z);
      this.ship.position.set(this.pad.x + Math.sin(this.landT * 0.7) * 0.15 * (1 - s), gy + h, this.pad.z);
      this.flame(h < 45 ? Math.min(1, (45 - h) / 20 + 0.3) : 0);
      if (h < 16 && this.dust) this.dust(new THREE.Vector3(this.pad.x + (Math.random() - 0.5) * 8, gy + 0.2, this.pad.z + (Math.random() - 0.5) * 8), Math.min(40, Math.ceil(6 / Math.max(0.4, h))));
      if (s >= 1) { this.landT = -1; this.flame(0); this.onTouchdown?.(); }
    }
    // ---- colonos (no máximo 6 visíveis), andando entre portas e prédios
    const n = Math.min(MAX_COLONISTS, colonists, places.length ? 99 : 0);
    while (this.walkers.length < n) {
      const p = places[this.walkers.length % places.length];
      this.walkers.push({ pos: p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 6, 0, (Math.random() - 0.5) * 6)), tgt: p.clone(), yaw: 0, phase: Math.random() * 6, wait: Math.random() * 3 });
    }
    this.walkers.length = n;
    for (let i = 0; i < n; i++) {
      const w = this.walkers[i];
      const dx = w.tgt.x - w.pos.x, dz = w.tgt.z - w.pos.z, d = Math.hypot(dx, dz);
      let moving = false;
      if (w.wait > 0) w.wait -= dt;
      else if (d < 0.6) { w.wait = 2 + Math.random() * 5; const p = places[Math.floor(Math.random() * places.length)]; w.tgt.copy(p).add(new THREE.Vector3((Math.random() - 0.5) * 5, 0, (Math.random() - 0.5) * 5)); }
      else {
        moving = true;
        const ty = Math.atan2(dx, dz); let dy = ty - w.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); w.yaw += dy * Math.min(1, dt * 4);
        w.pos.x += Math.sin(w.yaw) * 1.1 * dt; w.pos.z += Math.cos(w.yaw) * 1.1 * dt;
      }
      // empurrão simples entre colonos
      for (let j = 0; j < i; j++) { const o = this.walkers[j]; const ex = w.pos.x - o.pos.x, ez = w.pos.z - o.pos.z, ed = Math.hypot(ex, ez); if (ed < 0.8 && ed > 1e-3) { w.pos.x += ex / ed * (0.8 - ed) * 0.5; w.pos.z += ez / ed * (0.8 - ed) * 0.5; } }
      w.phase += dt * (moving ? 5.5 : 1.2);
      const bob = moving ? Math.abs(Math.sin(w.phase)) * 0.09 : 0; // galope marciano
      this.e.set(0, w.yaw, moving ? Math.sin(w.phase) * 0.06 : 0);
      this.q.setFromEuler(this.e);
      this.m.compose(new THREE.Vector3(w.pos.x, this.terrain.heightAt(w.pos.x, w.pos.z) + bob, w.pos.z), this.q, new THREE.Vector3(1, 1, 1));
      this.people.setMatrixAt(i, this.m);
    }
    this.people.count = n;
    this.people.instanceMatrix.needsUpdate = true;
  }

  warmup(scene: THREE.Scene) {
    const was = this.ship.visible; this.ship.visible = true; this.flame(1);
    this.group.position.y = -5000; this.people.count = 1;
    void scene;
    return () => { this.group.position.y = 0; this.ship.visible = was; this.flame(0); this.people.count = 0; };
  }
}
