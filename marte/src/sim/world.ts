// Pontos de coleta (loot), estruturas construídas e interação. Mantém cena + física em sincronia com o estado.
import * as THREE from 'three';
import type { GameState, Building } from './state';
import { BAL, COSTS, type BuildId, type ItemId } from './balance';
import { BUILDERS, FOOTPRINT, HAB_R, buildGypsum, buildWreck, makeStructMats, type StructMats } from '../world/structures';
import type { LanderMats } from '../world/lander';
import type { Terrain } from '../world/terrain';
import type { Physics } from '../core/physics';
import { enhanceObject } from '../render/materials';
import type RAPIER from '@dimforge/rapier3d-compat';

export type LootKind = 'crate' | 'wreck' | 'gypsum' | 'antenna' | 'door' | 'panel_clean';
export interface LootPoint { id: string; kind: LootKind; pos: THREE.Vector3; give: Partial<Record<ItemId, number>>; uses?: number; label: string; obj?: THREE.Object3D; site?: string }

export interface Site { id: string; name: string; pos: THREE.Vector3 }

export class WorldSim {
  group = new THREE.Group();
  mats: StructMats;
  loot: LootPoint[] = [];
  sites: Site[] = [];
  private buildingObjs = new Map<number, { obj: THREE.Object3D; colliders: RAPIER.Collider[] }>();
  private body: RAPIER.RigidBody;
  ghost: THREE.Object3D | null = null;
  ghostType: BuildId | null = null;
  ghostValid = false;
  /** motivo (chave de texto) quando o local é inválido */
  ghostReason = '';
  antennaPos = new THREE.Vector3();

  constructor(lm: LanderMats, private terrain: Terrain, private phys: Physics, crates: THREE.Vector3[], landerPos: THREE.Vector3, nasa: Partial<Record<'perse' | 'inge' | 'viking', THREE.Object3D | null>> = {}) {
    this.mats = makeStructMats(lm);
    this.body = phys.world.createRigidBody(phys.R.RigidBodyDesc.fixed());
    // caixas do local da queda
    const crateLoot: Partial<Record<ItemId, number>>[] = [
      { kit_habitat: 1, kit_panel: 1 },
      { culture: 1, electronics: 2 },
      { scrap: 3, electronics: 2 },
      { scrap: 2, electronics: 2 },
      { scrap: 3, electronics: 1 },
    ];
    crates.forEach((p, i) => this.loot.push({ id: `crate${i}`, kind: 'crate', pos: p.clone(), give: crateLoot[i] ?? { scrap: 1 }, label: 'loot_crate', site: 'crash' }));
    this.antennaPos.set(landerPos.x - 1.0, this.terrain.heightAt(landerPos.x, landerPos.z) + 1.0, landerPos.z + 2.4);
    this.loot.push({ id: 'antenna', kind: 'antenna', pos: this.antennaPos.clone(), give: {}, label: 'loot_antenna', site: 'crash' });

    // locais de destroços (a distâncias crescentes)
    const wreckSites: { id: string; name: string; x: number; z: number; n: number; give: Partial<Record<ItemId, number>> }[] = [
      { id: 'crash', name: 'site_crash', x: -4, z: 2, n: 5, give: { scrap: 2 } },
      { id: 'shield', name: 'site_shield', x: 62, z: 78, n: 5, give: { scrap: 3, electronics: 1 } },
      { id: 'chute', name: 'site_chute', x: 118, z: -18, n: 5, give: { scrap: 2, electronics: 1 } },
      { id: 'cruise', name: 'site_cruise', x: -330, z: -390, n: 6, give: { scrap: 2, electronics: 2 } },
      { id: 'probe', name: 'site_probe', x: 470, z: -360, n: 4, give: { scrap: 2, electronics: 3 } },
    ];
    let seed = 11;
    for (const w of wreckSites) {
      this.sites.push({ id: w.id, name: w.name, pos: new THREE.Vector3(w.x, this.terrain.heightAt(w.x, w.z), w.z) });
      for (let i = 0; i < w.n; i++) {
        const a = (i / w.n) * Math.PI * 2 + seed * 0.7, r = 4 + ((seed * 37) % 9);
        const x = w.x + Math.cos(a) * r, z = w.z + Math.sin(a) * r;
        const obj = buildWreck(this.mats, seed++ * 7919);
        this.placeOnGround(obj, x, z, a);
        this.group.add(obj);
        this.loot.push({ id: `${w.id}${i}`, kind: 'wreck', pos: obj.position.clone(), give: w.give, label: 'loot_wreck', obj, site: w.id });
        this.terrain.addOccluder(x, z, 1.5, 0.45, () => obj.visible);
      }
    }
    // marcos grandes visíveis de longe
    {
      const M = this.mats;
      const cruise = new THREE.Group();
      const disk = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.9, 32, 1, true, 0, Math.PI * 1.6), M.silver);
      (disk.material as THREE.Material).side = THREE.DoubleSide;
      const top = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.06, 32, 1, false, 0, Math.PI * 1.6), M.solar);
      top.position.y = 0.46;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.08, 8, 40, Math.PI * 1.6), M.metal);
      ring.rotation.x = Math.PI / 2;
      cruise.add(disk, top, ring);
      for (let i = 0; i < 4; i++) { const tk = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 12), M.white); tk.position.set(Math.cos(i * 1.4) * 1.2, 0, Math.sin(i * 1.4) * 1.2); cruise.add(tk); }
      cruise.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      this.placeOnGround(cruise, -330, -390, 0.7);
      cruise.position.y += 0.2;
      cruise.rotateX(0.5);
      this.group.add(cruise);
      const probe = new THREE.Group();
      const deck = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.35, 6), M.gold);
      deck.position.y = 1.0;
      probe.add(deck);
      for (const s of [-1, 1]) {
        const arr = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.03, 10, 1, false, 0, Math.PI), M.solar);
        arr.position.set(s * 1.6, 1.1, 0);
        arr.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2;
        probe.add(arr);
      }
      for (let i = 0; i < 3; i++) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 8), M.metal); const a = i * 2.1; leg.position.set(Math.cos(a) * 0.6, 0.5, Math.sin(a) * 0.6); leg.rotation.z = 0.3; probe.add(leg); }
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 8), M.white); arm.position.set(0.4, 1.5, 0.6); arm.rotation.x = 0.9; probe.add(arm);
      probe.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      // "sonda antiga": modelo oficial da NASA do Viking (se carregou), senão a versão procedural
      const viking = nasa.viking ? this.fitModel(nasa.viking, 2.1) : probe;
      this.placeOnGround(viking, 470, -360, 2.2);
      this.terrain.addOccluder(470, -360, 2.4, 0.5);
      this.group.add(viking);
      // Perseverance + Ingenuity abandonados num campo de dunas (modelos oficiais da NASA)
      if (nasa.perse) {
        const P = this.fitModel(nasa.perse, 2.2);
        this.placeOnGround(P, -210, 235, 2.6);
        this.terrain.addOccluder(-210, 235, 2.8, 0.5);
        this.group.add(P);
        this.sites.push({ id: 'perse', name: 'site_perse', pos: new THREE.Vector3(-210, this.terrain.heightAt(-210, 235), 235) });
        this.loot.push({ id: 'perse0', kind: 'wreck', pos: P.position.clone().add(new THREE.Vector3(0, 1, 0)), give: { electronics: 4, scrap: 2 }, label: 'loot_perse', site: 'perse' });
        if (nasa.inge) { const I = this.fitModel(nasa.inge, 0.49); this.placeOnGround(I, -204, 239, 0.4); this.group.add(I); }
        this.colliderBox(-210, 235, 1.4, 1.1, 1.6, 2.6);
      }
      if (nasa.viking) this.colliderBox(470, -360, 1.2, 0.9, 1.2, 2.2);
    }
    // afloramentos de gesso (base de escarpas / paredes de crateras)
    const gyps = [[-560, 40], [-530, -120], [255, 60], [-120, -440], [120, 150], [-600, 260], [300, 215]];
    gyps.forEach(([x, z], i) => {
      const obj = buildGypsum(this.mats, 1000 + i * 17);
      this.placeOnGround(obj, x, z, i);
      this.group.add(obj);
      this.loot.push({ id: `gyp${i}`, kind: 'gypsum', pos: obj.position.clone(), give: { gypsum: BAL.gypsumPerHarvest }, uses: 4, label: 'loot_gypsum', obj, site: 'gypsum' });
    });
    this.sites.push({ id: 'gypsum', name: 'site_gypsum', pos: new THREE.Vector3(120, this.terrain.heightAt(120, 150), 150) });
    enhanceObject(this.group);
  }

  /** normaliza um modelo: altura desejada em metros, base no chão (y = 0), centrado em x/z */
  private fitModel(src: THREE.Object3D, height: number) {
    const holder = new THREE.Group();
    const m = src;
    const box = new THREE.Box3().setFromObject(m);
    const size = box.getSize(new THREE.Vector3());
    const k = height / Math.max(0.01, size.y);
    m.scale.multiplyScalar(k);
    const b2 = new THREE.Box3().setFromObject(m);
    const c = b2.getCenter(new THREE.Vector3());
    m.position.x -= c.x; m.position.z -= c.z; m.position.y -= b2.min.y;
    holder.add(m);
    enhanceObject(holder);
    return holder;
  }
  private colliderBox(x: number, z: number, hx: number, hy: number, hz: number, yaw: number) {
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    this.phys.addBoxes([{ pos: { x, y: this.terrain.heightAt(x, z) + hy, z }, half: { x: hx, y: hy, z: hz }, quat: { x: q.x, y: q.y, z: q.z, w: q.w } }]);
  }

  placeOnGround(o: THREE.Object3D, x: number, z: number, yaw: number) {
    o.position.set(x, this.terrain.heightAt(x, z), z);
    const n = this.terrain.normalAt(x, z);
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw));
  }

  /** aplica estado salvo: remove loot já coletado e cria construções */
  sync(st: GameState) {
    for (const l of this.loot) {
      const used = st.looted.filter((x) => x === l.id).length;
      const gone = l.kind === 'gypsum' ? used >= (l.uses ?? 1) : used > 0;
      if (l.obj) l.obj.visible = !gone || l.kind === 'crate';
    }
    const want = new Set(st.buildings.map((b) => b.id));
    for (const [id, o] of this.buildingObjs) if (!want.has(id)) { this.group.remove(o.obj); o.colliders.forEach((c) => this.phys.world.removeCollider(c, false)); this.buildingObjs.delete(id); }
    for (const b of st.buildings) if (!this.buildingObjs.has(b.id)) this.spawnBuilding(b);
  }

  private spawnBuilding(b: Building) {
    const obj = BUILDERS[b.type](this.mats);
    obj.position.set(b.x, this.terrain.heightAt(b.x, b.z) - (b.type === 'habitat' ? 0.15 : 0.05), b.z);
    obj.rotation.y = b.rot;
    enhanceObject(obj);
    this.terrain.addOccluder(b.x, b.z, FOOTPRINT[b.type] * (b.type === 'habitat' ? 0.95 : 0.8), 0.5, () => obj.parent !== null);
    this.group.add(obj);
    const R = this.phys.R;
    const colliders: RAPIER.Collider[] = [];
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, b.rot, 0));
    if (b.type === 'habitat') {
      colliders.push(this.phys.world.createCollider(R.ColliderDesc.cylinder(1.6, HAB_R).setTranslation(b.x, obj.position.y + 1.6, b.z), this.body));
      colliders.push(this.phys.world.createCollider(R.ColliderDesc.ball(HAB_R * 0.92).setTranslation(b.x, obj.position.y + 2.2, b.z), this.body));
      const lock = new THREE.Vector3(0, 1.15, HAB_R + 0.8).applyQuaternion(q);
      colliders.push(this.phys.world.createCollider(R.ColliderDesc.cuboid(1.0, 1.1, 1.1).setTranslation(b.x + lock.x, obj.position.y + 1.15, b.z + lock.z).setRotation(q), this.body));
    } else {
      const f = FOOTPRINT[b.type] / 2;
      const h = b.type === 'panel' ? 0.7 : 0.6;
      colliders.push(this.phys.world.createCollider(R.ColliderDesc.cuboid(f, h, f * (b.type === 'panel' ? 0.75 : 0.8)).setTranslation(b.x, obj.position.y + h, b.z).setRotation(q), this.body));
    }
    this.buildingObjs.set(b.id, { obj, colliders });
  }

  habitat(st: GameState) { return st.buildings.find((b) => b.type === 'habitat') ?? null; }
  doorPos(st: GameState) {
    const h = this.habitat(st);
    if (!h) return null;
    const d = new THREE.Vector3(0, 0, 3.6 + 2.3).applyAxisAngle(new THREE.Vector3(0, 1, 0), h.rot);
    return new THREE.Vector3(h.x + d.x, this.terrain.heightAt(h.x + d.x, h.z + d.z), h.z + d.z);
  }

  /** ponto interativo mais próximo à frente do jogador */
  nearest(st: GameState, pos: THREE.Vector3, fwd: THREE.Vector3, max = 2.8): LootPoint | null {
    let best: LootPoint | null = null, bd = max;
    const cands: LootPoint[] = [...this.loot];
    const door = this.doorPos(st);
    if (door) cands.push({ id: 'door', kind: 'door', pos: door, give: {}, label: 'act_enter' });
    for (const b of st.buildings) if (b.type === 'panel' && b.dust > 0.05) cands.push({ id: `clean${b.id}`, kind: 'panel_clean', pos: new THREE.Vector3(b.x, this.terrain.heightAt(b.x, b.z), b.z), give: {}, label: 'act_clean' });
    for (const l of cands) {
      const used = st.looted.filter((x) => x === l.id).length;
      if (l.kind === 'gypsum' ? used >= (l.uses ?? 1) : (l.kind === 'crate' || l.kind === 'wreck') && used > 0) continue;
      if (l.kind === 'antenna' && st.antennaFixedSol !== null) continue;
      const dx = l.pos.x - pos.x, dz = l.pos.z - pos.z;
      const d = Math.hypot(dx, dz);
      const reach = l.kind === 'antenna' ? 4.5 : l.kind === 'door' ? 2.5 : l.kind === 'panel_clean' ? 2.8 : max;
      if (d > reach) continue;
      const facing = d < 1.2 ? 1 : (dx * fwd.x + dz * fwd.z) / d;
      if (facing < 0.2) continue;
      const score = d - facing;
      if (score < bd) { bd = score; best = l; }
    }
    return best;
  }

  markUsed(st: GameState, l: LootPoint) {
    st.looted.push(l.id);
    this.sync(st);
    if (l.kind === 'wreck' && l.obj) l.obj.visible = false;
  }

  // ---------- construção
  canAfford(st: GameState, t: BuildId) {
    const c = COSTS[t];
    if (t === 'panel' && st.inv.kit_panel > 0) return true;
    return Object.entries(c).every(([k, v]) => st.inv[k as ItemId] >= (v as number));
  }
  pay(st: GameState, t: BuildId) {
    if (t === 'panel' && st.inv.kit_panel > 0) { st.inv.kit_panel--; return; }
    for (const [k, v] of Object.entries(COSTS[t])) st.inv[k as ItemId] -= v as number;
  }

  startGhost(t: BuildId) {
    this.cancelGhost();
    const obj = BUILDERS[t](this.mats);
    obj.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.material = this.mats.ghostOk; m.castShadow = false; } if ((o as THREE.Light).isLight) o.visible = false; });
    this.ghost = obj;
    this.ghostType = t;
    this.group.add(obj);
  }
  cancelGhost() {
    if (this.ghost) this.group.remove(this.ghost);
    this.ghost = null;
    this.ghostType = null;
  }
  updateGhost(st: GameState, player: THREE.Vector3, yaw: number) {
    if (!this.ghost || !this.ghostType) return;
    const t = this.ghostType;
    const dist = t === 'habitat' ? 6 : 3.5;
    const x = player.x - Math.sin(yaw) * dist, z = player.z - Math.cos(yaw) * dist;
    this.ghost.position.set(x, this.terrain.heightAt(x, z), z);
    this.ghost.rotation.y = yaw + Math.PI;
    // validade: inclinação, sobreposição, raio do habitat, dentro do mapa (guarda o motivo para o jogador)
    const r = FOOTPRINT[t];
    let reason = '';
    const fail = (k: string) => { if (!reason) reason = k; };
    if (!this.canAfford(st, t)) fail('build_bad_cost');
    if (t === 'habitat' && this.habitat(st)) fail('build_bad_hab');
    if (!this.terrain.inBounds(x, z, 30)) fail('build_bad_far');
    const hab = this.habitat(st);
    if (t !== 'habitat' && (!hab || Math.hypot(hab.x - x, hab.z - z) > BAL.buildRadius)) fail('build_bad_far');
    for (const b of st.buildings) if (Math.hypot(b.x - x, b.z - z) < FOOTPRINT[b.type] + r + 0.6) fail('build_bad_overlap');
    if (Math.hypot(x + 8, z + 4) < 7 + r) fail('build_bad_overlap'); // módulo de pouso
    let maxSlope = 0;
    for (const [ox, oz] of [[r, 0], [-r, 0], [0, r], [0, -r], [0, 0]]) maxSlope = Math.max(maxSlope, 1 - this.terrain.normalAt(x + ox * 0.7, z + oz * 0.7).y);
    const hmin = Math.min(...[[r, 0], [-r, 0], [0, r], [0, -r]].map(([ox, oz]) => this.terrain.heightAt(x + ox, z + oz)));
    const hmax = Math.max(...[[r, 0], [-r, 0], [0, r], [0, -r]].map(([ox, oz]) => this.terrain.heightAt(x + ox, z + oz)));
    if (maxSlope > (t === 'habitat' ? 0.08 : 0.05) || hmax - hmin > (t === 'habitat' ? 1.0 : 0.6)) fail('build_bad_slope');
    const ok = !reason;
    this.ghostReason = reason;
    this.ghostValid = ok;
    const mat = ok ? this.mats.ghostOk : this.mats.ghostBad;
    this.ghost.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.material = mat; });
  }
  placeGhost(st: GameState): Building | null {
    if (!this.ghost || !this.ghostType || !this.ghostValid) return null;
    const t = this.ghostType;
    this.pay(st, t);
    const b: Building = { id: st.nextId++, type: t, x: this.ghost.position.x, z: this.ghost.position.z, rot: this.ghost.rotation.y, dust: 0 };
    st.buildings.push(b);
    st.stats.built++;
    this.cancelGhost();
    this.sync(st);
    return b;
  }
}
