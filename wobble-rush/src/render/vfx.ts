/**
 * Pooled particle effects.
 *
 * Two InstancedMeshes (chunky puffs and confetti flakes) cover every effect in
 * the game. Nothing is ever allocated during gameplay - particles are recycled
 * from a fixed pool, which is the difference between smooth and stuttery on a
 * phone.
 */
import * as THREE from 'three';
import { clamp } from '../shared/math';

interface Particle {
  active: boolean;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number; maxLife: number;
  size: number; endSize: number;
  spin: number; spinSpeed: number;
  gravity: number;
  drag: number;
  r: number; g: number; b: number;
  kind: number;
}

export type VfxKind =
  | 'dust' | 'landPuff' | 'impact' | 'confetti' | 'spark'
  | 'checkpoint' | 'finish' | 'trail' | 'respawn' | 'bounce';

const MAX_PUFF = 420;
const MAX_FLAKE = 260;

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

export class VFX {
  readonly root = new THREE.Group();
  private puffs: Particle[] = [];
  private flakes: Particle[] = [];
  private puffMesh: THREE.InstancedMesh;
  private flakeMesh: THREE.InstancedMesh;
  private budget = 1;

  constructor() {
    const puffGeo = new THREE.IcosahedronGeometry(0.5, 0);
    const puffMat = new THREE.MeshStandardMaterial({
      roughness: 0.95, metalness: 0, transparent: true, opacity: 0.6, depthWrite: false,
    });
    this.puffMesh = new THREE.InstancedMesh(puffGeo, puffMat, MAX_PUFF);
    this.puffMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.puffMesh.frustumCulled = false;
    this.puffMesh.castShadow = false;
    this.puffMesh.receiveShadow = false;
    this.root.add(this.puffMesh);

    const flakeGeo = new THREE.BoxGeometry(0.16, 0.24, 0.03);
    const flakeMat = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.1, side: THREE.DoubleSide });
    this.flakeMesh = new THREE.InstancedMesh(flakeGeo, flakeMat, MAX_FLAKE);
    this.flakeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.flakeMesh.frustumCulled = false;
    this.root.add(this.flakeMesh);

    for (let i = 0; i < MAX_PUFF; i++) this.puffs.push(this.blank());
    for (let i = 0; i < MAX_FLAKE; i++) this.flakes.push(this.blank());
    this.hideAll();
  }

  private blank(): Particle {
    return {
      active: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1,
      size: 1, endSize: 0, spin: 0, spinSpeed: 0, gravity: 0, drag: 0,
      r: 1, g: 1, b: 1, kind: 0,
    };
  }

  private hideAll(): void {
    _m.makeScale(0, 0, 0);
    for (let i = 0; i < MAX_PUFF; i++) this.puffMesh.setMatrixAt(i, _m);
    for (let i = 0; i < MAX_FLAKE; i++) this.flakeMesh.setMatrixAt(i, _m);
    this.puffMesh.instanceMatrix.needsUpdate = true;
    this.flakeMesh.instanceMatrix.needsUpdate = true;
  }

  /** Scales all emissions - driven by the quality manager. */
  setBudget(b: number): void { this.budget = clamp(b, 0.15, 2); }

  private take(pool: Particle[]): Particle | null {
    for (let i = 0; i < pool.length; i++) if (!pool[i].active) return pool[i];
    return null;
  }

  /** Fires an effect. Count is advisory - the pool and budget have final say. */
  emit(kind: VfxKind, x: number, y: number, z: number, count = 8, color = 0xffffff,
       dirX = 0, dirY = 1, dirZ = 0, power = 1): void {
    const n = Math.max(1, Math.round(count * this.budget));
    _c.setHex(color);
    for (let i = 0; i < n; i++) {
      const flake = kind === 'confetti';
      const p = this.take(flake ? this.flakes : this.puffs);
      if (!p) return;
      p.active = true;
      p.x = x; p.y = y; p.z = z;
      p.r = _c.r; p.g = _c.g; p.b = _c.b;
      p.spin = Math.random() * Math.PI * 2;
      p.drag = 1.4;
      p.kind = flake ? 1 : 0;

      const rnd = () => (Math.random() - 0.5) * 2;
      switch (kind) {
        case 'dust':
          p.vx = rnd() * 1.1; p.vy = 0.5 + Math.random() * 0.9; p.vz = rnd() * 1.1;
          p.maxLife = 0.45 + Math.random() * 0.25;
          p.size = 0.1 + Math.random() * 0.07; p.endSize = 0.2;
          p.gravity = -1.2; p.drag = 3.2;
          break;
        case 'landPuff':
          p.vx = rnd() * 2.6 * power; p.vy = 0.6 + Math.random() * 1.4; p.vz = rnd() * 2.6 * power;
          p.maxLife = 0.5 + Math.random() * 0.3;
          p.size = 0.14 + Math.random() * 0.12; p.endSize = 0.34;
          p.gravity = -2.6; p.drag = 3.4;
          break;
        case 'impact':
        case 'spark':
          p.vx = rnd() * 5 * power; p.vy = 1.5 + Math.random() * 4 * power; p.vz = rnd() * 5 * power;
          p.maxLife = 0.4 + Math.random() * 0.35;
          p.size = 0.12 + Math.random() * 0.12; p.endSize = 0.02;
          p.gravity = -14; p.drag = 1.1;
          break;
        case 'bounce':
          p.vx = rnd() * 3; p.vy = 2 + Math.random() * 3; p.vz = rnd() * 3;
          p.maxLife = 0.45; p.size = 0.14; p.endSize = 0.02; p.gravity = -12;
          break;
        case 'confetti':
          p.vx = rnd() * 6; p.vy = 4 + Math.random() * 7; p.vz = rnd() * 6;
          p.maxLife = 2.4 + Math.random() * 1.8;
          p.size = 1; p.endSize = 1;
          p.gravity = -7.5; p.drag = 1.7;
          p.spinSpeed = rnd() * 16;
          break;
        case 'checkpoint':
          p.vx = rnd() * 2.2; p.vy = 2.6 + Math.random() * 2.4; p.vz = rnd() * 2.2;
          p.maxLife = 0.75; p.size = 0.16; p.endSize = 0.02; p.gravity = -3.4;
          break;
        case 'finish':
          p.vx = rnd() * 7; p.vy = 3 + Math.random() * 6; p.vz = rnd() * 7;
          p.maxLife = 1.3; p.size = 0.22; p.endSize = 0.02; p.gravity = -8;
          break;
        case 'respawn':
          p.vx = rnd() * 1.6; p.vy = Math.random() * 3.4; p.vz = rnd() * 1.6;
          p.maxLife = 0.7; p.size = 0.15; p.endSize = 0.02; p.gravity = 1.4;
          break;
        case 'trail':
          p.vx = rnd() * 0.5 + dirX * 0.4;
          p.vy = Math.random() * 0.5 + dirY * 0.4;
          p.vz = rnd() * 0.5 + dirZ * 0.4;
          p.maxLife = 0.35; p.size = 0.12; p.endSize = 0.02; p.gravity = -1; p.drag = 3;
          break;
      }
      p.life = p.maxLife;
    }
  }

  update(dt: number, camera: THREE.Camera): void {
    this.step(this.puffs, this.puffMesh, dt, camera, false);
    this.step(this.flakes, this.flakeMesh, dt, camera, true);
  }

  private step(pool: Particle[], mesh: THREE.InstancedMesh, dt: number,
               camera: THREE.Camera, flake: boolean): void {
    let dirty = false;
    for (let i = 0; i < pool.length; i++) {
      const p = pool[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        _m.makeScale(0, 0, 0);
        mesh.setMatrixAt(i, _m);
        dirty = true;
        continue;
      }
      const damping = Math.exp(-p.drag * dt);
      p.vx *= damping; p.vz *= damping;
      p.vy = (p.vy + p.gravity * dt) * (flake ? damping : 1);
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.spin += p.spinSpeed * dt;

      const t = 1 - p.life / p.maxLife;
      // Grow toward endSize but always collapse to nothing, so puffs dissolve
      // instead of popping out of existence at full size.
      const size = (p.size + (p.endSize - p.size) * t) * (1 - t * t);
      _p.set(p.x, p.y, p.z);
      if (flake) {
        _q.setFromEuler(new THREE.Euler(p.spin, p.spin * 0.7, p.spin * 0.4));
        _s.setScalar(1);
      } else {
        // Billboard-ish: puffs are round so only scale matters.
        _q.identity();
        _s.setScalar(Math.max(size, 0.001));
      }
      _m.compose(_p, _q, _s);
      mesh.setMatrixAt(i, _m);
      mesh.setColorAt(i, _c.setRGB(p.r, p.g, p.b));
      dirty = true;
    }
    if (dirty) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    void camera;
  }

  dispose(): void {
    this.puffMesh.geometry.dispose();
    (this.puffMesh.material as THREE.Material).dispose();
    this.flakeMesh.geometry.dispose();
    (this.flakeMesh.material as THREE.Material).dispose();
  }
}
