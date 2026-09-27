import * as THREE from 'three';
import { enhance } from '../render/materials';
import { mulberry32, Simplex2 } from './noise';
import type { Terrain } from './terrain';
import { WORLD } from './config';

export const ROCK_IDS = ['rock_a', 'rock_b', 'rock_c', 'rock_d', 'rock_e', 'rock_f'] as const;

export interface RockAsset { lods: THREE.BufferGeometry[]; height: number; a: THREE.Texture; n: THREE.Texture }
export interface RockInstance { x: number; y: number; z: number; s: number; rot: number; tilt: number; type: number; tint: number }

const LOD_DIST = [22, 70, 220, 700];

export async function loadRockAsset(base: string, id: string, loadTex: (url: string, srgb: boolean) => Promise<THREE.Texture>, tier: '1k' | '2k'): Promise<RockAsset> {
  const [meta, bin, a, n] = await Promise.all([
    fetch(`${base}/rocks/${id}.json`).then((r) => r.json()),
    fetch(`${base}/rocks/${id}.bin`).then((r) => r.arrayBuffer()),
    loadTex(`${base}/rocks/${id}_${tier}_a.webp`, true),
    loadTex(`${base}/rocks/${id}_${tier}_n.webp`, false),
  ]);
  const vc = meta.vertexCount as number;
  const pos = new THREE.BufferAttribute(new Float32Array(bin, 0, vc * 3), 3);
  const nor = new THREE.BufferAttribute(new Float32Array(bin, vc * 12, vc * 3), 3);
  const uv = new THREE.BufferAttribute(new Float32Array(bin, vc * 24, vc * 2), 2);
  const lods = (meta.lods as { offset: number; count: number }[]).map((l) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', pos);
    g.setAttribute('normal', nor);
    g.setAttribute('uv', uv);
    g.setIndex(new THREE.BufferAttribute(new Uint32Array(bin, l.offset, l.count), 1));
    g.computeBoundingSphere();
    return g;
  });
  return { lods, height: meta.height, a, n };
}

function rockMaterial(a: THREE.Texture, n: THREE.Texture) {
  const m = new THREE.MeshStandardMaterial({ map: a, normalMap: n, roughness: 1, metalness: 0 });
  m.normalScale.set(1.2, 1.2);
  enhance(m, 'rock', (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRW; varying vec3 vRN;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n#ifdef USE_INSTANCING\n vRN = normalize(mat3(modelMatrix)*mat3(instanceMatrix)*objectNormal);\n vec4 rw = modelMatrix*instanceMatrix*vec4(transformed,1.0);\n#else\n vRN = normalize(mat3(modelMatrix)*objectNormal); vec4 rw = modelMatrix*vec4(transformed,1.0);\n#endif\n vRW = rw.xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRW; varying vec3 vRN;')
      .replace('vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;', 'vec4 rN = texture2D( normalMap, vNormalMapUv ); vec3 mapN = vec3(rN.rg*2.0-1.0, 0.0); mapN.z = sqrt(max(0.0, 1.0-dot(mapN.xy,mapN.xy)));')
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = clamp(texture2D(normalMap, vNormalMapUv).b*1.1, 0.45, 1.0);')
            .replace('#include <color_fragment>', `#include <color_fragment>
        // poeira acumulada nas faces voltadas para cima + base enterrada
        float up = smoothstep(0.35, 0.85, normalize(vRN).y);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62,0.38,0.24), up*0.55);`);
  });
  return m;
}

export class Rocks {
  readonly group = new THREE.Group();
  instances: RockInstance[] = [];
  private meshes: THREE.InstancedMesh[][] = []; // [tipo][lod]
  private lastCam = new THREE.Vector3(1e9, 0, 0);
  private byType: RockInstance[][] = [];
  private tmpM = new THREE.Matrix4();
  private tmpQ = new THREE.Quaternion();
  private tmpE = new THREE.Euler();
  private tmpS = new THREE.Vector3();
  private tmpP = new THREE.Vector3();
  private tmpC = new THREE.Color();

  constructor(private assets: RockAsset[], terrain: Terrain, density: number, avoid: { x: number; z: number; r: number }[]) {
    this.generate(terrain, density, avoid);
    this.byType = assets.map((_, t) => this.instances.filter((i) => i.type === t));
    assets.forEach((a, t) => {
      const mat = rockMaterial(a.a, a.n);
      const cap = this.byType[t].length;
      this.meshes[t] = a.lods.map((g, l) => {
        const im = new THREE.InstancedMesh(g, mat, Math.max(1, cap));
        im.count = 0;
        im.castShadow = l <= 1;
        im.receiveShadow = true;
        im.frustumCulled = false;
        im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, cap) * 3), 3);
        this.group.add(im);
        return im;
      });
    });
  }

  setTextures(t: number, a: THREE.Texture, n: THREE.Texture) {
    const mat = this.meshes[t][0].material as THREE.MeshStandardMaterial;
    const oa = mat.map, on = mat.normalMap;
    mat.map = a; mat.normalMap = n; mat.needsUpdate = true;
    oa?.dispose(); on?.dispose();
  }

  private generate(terrain: Terrain, density: number, avoid: { x: number; z: number; r: number }[]) {
    const rnd = mulberry32(WORLD.seed + 99);
    const nz = new Simplex2(WORLD.seed + 5);
    const half = WORLD.size / 2 - 8;
    const add = (x: number, z: number, d: number) => {
      if (!terrain.inBounds(x, z, 6)) return;
      for (const a of avoid) if (Math.hypot(x - a.x, z - a.z) < a.r + d) return;
      const type = Math.floor(rnd() * this.assets.length);
      const s = d / 2; // raio horizontal normalizado = 1
      const sink = this.assets[type].height * s * (0.18 + 0.2 * rnd());
      this.instances.push({ x, y: terrain.heightAt(x, z) - sink, z, s, rot: rnd() * Math.PI * 2, tilt: (rnd() - 0.5) * 0.35, type, tint: rnd() });
    };
    // campo difuso (distribuição exponencial de tamanho, tipo Golombek)
    const nBase = Math.floor(9000 * density);
    for (let i = 0; i < nBase; i++) {
      const x = (rnd() * 2 - 1) * half, z = (rnd() * 2 - 1) * half;
      const m = nz.fbm(x / 180, z / 180, 3) * 0.5 + 0.5;
      if (rnd() > m * m * 1.6) continue;
      const d = 0.25 + -Math.log(1 - rnd() * 0.999) * 0.45;
      add(x, z, Math.min(d, 3.2));
    }
    // ejecta ao redor das crateras (blocos maiores perto da borda)
    for (const c of terrain.data.craters) {
      if (c.r < 6) continue;
      const count = Math.floor(Math.min(120, c.r * 1.6) * density * (0.4 + c.age));
      for (let i = 0; i < count; i++) {
        const ang = rnd() * Math.PI * 2;
        const rr = c.r * (0.85 + Math.pow(rnd(), 2) * 1.4);
        const d = (0.3 + -Math.log(1 - rnd() * 0.99) * 0.25) * Math.min(3, 0.6 + c.r / 25);
        add(c.x + Math.cos(ang) * rr, c.z + Math.sin(ang) * rr, Math.min(d, 4));
      }
    }
    // tálus ao pé das escarpas
    for (let i = 0; i < 5000 * density; i++) {
      const x = (rnd() * 2 - 1) * half, z = (rnd() * 2 - 1) * half;
      const n = terrain.normalAt(x, z);
      if (n.y > 0.93) continue;
      add(x, z, 0.3 + rnd() * rnd() * 2.6);
    }
  }

  /** raios de colisão (esfera aproximada) para a física */
  colliders(minD = 0.5) {
    return this.instances
      .filter((i) => i.s * 2 >= minD)
      .map((i) => ({ x: i.x, y: i.y + this.assets[i.type].height * i.s * 0.45, z: i.z, r: Math.max(0.2, i.s * 0.78), h: this.assets[i.type].height * i.s }));
  }

  update(cam: THREE.Vector3, force = false) {
    if (!force && cam.distanceToSquared(this.lastCam) < 9) return;
    this.lastCam.copy(cam);
    for (let t = 0; t < this.byType.length; t++) {
      const counts = [0, 0, 0, 0];
      for (const inst of this.byType[t]) {
        const d = Math.hypot(inst.x - cam.x, inst.y - cam.y, inst.z - cam.z) / Math.max(0.35, inst.s);
        let l = 0;
        while (l < 4 && d > LOD_DIST[l] * 1.0) l++;
        if (l >= 4) {
          if (inst.s < 1.2 || d > LOD_DIST[3] * 3) continue;
          l = 3;
        }
        const im = this.meshes[t][l];
        this.tmpE.set(inst.tilt, inst.rot, inst.tilt * 0.6);
        this.tmpQ.setFromEuler(this.tmpE);
        this.tmpS.setScalar(inst.s);
        this.tmpP.set(inst.x, inst.y, inst.z);
        this.tmpM.compose(this.tmpP, this.tmpQ, this.tmpS);
        im.setMatrixAt(counts[l], this.tmpM);
        const k = 0.8 + inst.tint * 0.35;
        this.tmpC.setRGB(k, k * (0.96 + inst.tint * 0.04), k * (0.92 + inst.tint * 0.06));
        im.setColorAt(counts[l], this.tmpC);
        counts[l]++;
      }
      for (let l = 0; l < 4; l++) {
        const im = this.meshes[t][l];
        im.count = counts[l];
        im.instanceMatrix.needsUpdate = true;
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
      }
    }
  }
}
