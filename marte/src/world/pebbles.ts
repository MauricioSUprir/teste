// Campo de pedrinhas e cascalho em volta da câmera (uma InstancedMesh, sem sombras próprias).
// Posições estáveis no mundo (grade toroidal): ao andar, só as pedras que saem do anel reaparecem do outro lado.
// Distribuição de tamanhos de regolito marciano: ~80% 1-4 cm, ~18% 5-10 cm, ~2% 15-25 cm (meio enterradas).
import * as THREE from 'three';
import type { Terrain } from './terrain';
import { enhance } from '../render/materials';

export class Pebbles {
  mesh: THREE.InstancedMesh;
  private base: { u: number; v: number; s: number; rot: THREE.Quaternion; sink: number }[] = [];
  private last = new THREE.Vector3(1e9, 0, 0);
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private p = new THREE.Vector3();
  private sc = new THREE.Vector3();

  constructor(private terrain: Terrain, count: number, private R: number, private blocked: (x: number, z: number) => boolean) {
    const geo = new THREE.IcosahedronGeometry(1, 1);
    // pedra irregular: deforma os vértices (mesma forma para todas; variedade vem da escala/rotação)
    const pa = geo.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < pa.count; i++) {
      v.fromBufferAttribute(pa, i);
      const k = 1 + 0.22 * Math.sin(v.x * 5.1 + v.y * 3.3) * Math.cos(v.z * 4.7) + 0.1 * Math.sin(v.y * 9.0);
      v.multiplyScalar(k); v.y *= 0.62; v.x *= 1.15;
      pa.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    const mat = enhance(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.2, 0.15, 0.12), roughness: 0.88, metalness: 0 }));
    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = true;
    const col = new THREE.Color();
    let seed = 1234567;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < count; i++) {
      const r = rnd();
      const s = r < 0.8 ? 0.01 + rnd() * 0.03 : r < 0.98 ? 0.05 + rnd() * 0.05 : 0.15 + rnd() * 0.1;
      this.base.push({ u: rnd() * 2 * R, v: rnd() * 2 * R, s, rot: new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() * 0.6, rnd() * 6.28, rnd() * 0.6)), sink: 0.3 + rnd() * 0.25 });
      // basalto escuro com variação e poeira
      const t = rnd();
      col.setRGB(0.55 + t * 0.35, 0.5 + t * 0.3, 0.45 + t * 0.3);
      this.mesh.setColorAt(i, col);
    }
    this.mesh.instanceColor!.needsUpdate = true;
  }

  update(cam: THREE.Vector3, force = false) {
    if (!force && Math.hypot(cam.x - this.last.x, cam.z - this.last.z) < 0.8) return;
    this.last.copy(cam);
    const S = this.R * 2, R = this.R;
    const wrap = (a: number) => ((a % S) + S) % S;
    for (let i = 0; i < this.base.length; i++) {
      const b = this.base[i];
      const x = cam.x + wrap(b.u - cam.x) - R, z = cam.z + wrap(b.v - cam.z) - R;
      const d = Math.hypot(x - cam.x, z - cam.z);
      // encolhe perto da borda do anel (sem "estalos") e some perto de itens coletáveis
      let k = 1 - THREE.MathUtils.smoothstep(d, R * 0.65, R);
      if (k > 0 && this.blocked(x, z)) k = 0;
      const s = b.s * k;
      this.p.set(x, this.terrain.heightAt(x, z) - s * 0.62 * b.sink, z);
      this.sc.set(s, s, s);
      this.m.compose(this.p, b.rot, this.sc);
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
