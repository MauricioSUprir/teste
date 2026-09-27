import type RAPIER from '@dimforge/rapier3d-compat';
import { WORLD } from '../world/config';

export type Rapier = typeof RAPIER;
let ready: Promise<Rapier> | null = null;
/** carregado sob demanda (chunk separado) para a página inicial abrir mais rápido */
export function initRapier() {
  if (!ready) ready = import('@dimforge/rapier3d-compat').then(async (m) => { const R = ((m as unknown as { default?: Rapier }).default ?? m) as Rapier; await R.init(); return R; });
  return ready;
}

export class Physics {
  world: RAPIER.World;
  terrainCollider!: RAPIER.Collider;
  constructor(public R: Rapier) {
    this.world = new R.World({ x: 0, y: -WORLD.gravity, z: 0 });
    this.world.timestep = 1 / 60;
  }

  addHeightfield(heights: Float32Array, res: number, size: number) {
    // Rapier/parry: matriz coluna-maior com linhas ao longo de Z e colunas ao longo de X
    const t = new Float32Array(res * res);
    for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) t[i * res + j] = heights[j * res + i];
    const desc = this.R.ColliderDesc.heightfield(res - 1, res - 1, t, { x: size, y: 1, z: size }).setFriction(0.8);
    this.terrainCollider = this.world.createCollider(desc);
  }

  addRocks(list: { x: number; y: number; z: number; r: number; h: number }[]) {
    const body = this.world.createRigidBody(this.R.RigidBodyDesc.fixed());
    for (const r of list) {
      const hy = Math.max(r.h * 0.5, 0.15);
      const desc = r.h > r.r * 1.2
        ? this.R.ColliderDesc.capsule(Math.max(0.01, hy - r.r), r.r)
        : this.R.ColliderDesc.ball(r.r);
      desc.setTranslation(r.x, r.y, r.z).setFriction(0.7);
      this.world.createCollider(desc, body);
    }
  }

  addBoxes(list: { pos: { x: number; y: number; z: number }; half: { x: number; y: number; z: number }; quat: { x: number; y: number; z: number; w: number } }[]) {
    const body = this.world.createRigidBody(this.R.RigidBodyDesc.fixed());
    for (const b of list)
      this.world.createCollider(this.R.ColliderDesc.cuboid(b.half.x, b.half.y, b.half.z).setTranslation(b.pos.x, b.pos.y, b.pos.z).setRotation(b.quat).setFriction(0.7), body);
  }

  addBounds(size: number) {
    const body = this.world.createRigidBody(this.R.RigidBodyDesc.fixed());
    const h = size / 2 - 12, t = 2, H = 400;
    for (const [x, z, hx, hz] of [[h + t, 0, t, h], [-h - t, 0, t, h], [0, h + t, h, t], [0, -h - t, h, t]])
      this.world.createCollider(this.R.ColliderDesc.cuboid(hx, H, hz).setTranslation(x, 0, z), body);
  }

  castDown(x: number, y: number, z: number, maxToi = 200, exclude?: RAPIER.Collider) {
    const ray = new this.R.Ray({ x, y, z }, { x: 0, y: -1, z: 0 });
    const hit = this.world.castRay(ray, maxToi, true, undefined, undefined, exclude);
    return hit ? y - hit.timeOfImpact : null;
  }

  castRay(o: { x: number; y: number; z: number }, d: { x: number; y: number; z: number }, max: number, exclude?: RAPIER.Collider, excludeBody?: RAPIER.RigidBody) {
    const ray = new this.R.Ray(o, d);
    const hit = this.world.castRay(ray, max, true, undefined, undefined, exclude, excludeBody);
    return hit ? hit.timeOfImpact : null;
  }

  step() {
    this.world.step();
  }
}
