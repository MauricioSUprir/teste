import * as THREE from 'three';
import { WORLD, type TerrainData } from './config';
import { enhance } from '../render/materials';

export const LAYER_IDS = ['dust', 'soil', 'gravel', 'cliff'] as const;
const CHUNK = 128;
const NCH = WORLD.size / CHUNK;
const LOD_STEPS = [1, 2, 4, 8];

export interface TerrainTextures { a: THREE.Texture[]; n: THREE.Texture[] }

const terrainGLSL_pars = /* glsl */ `
uniform sampler2D tA0; uniform sampler2D tN0; uniform sampler2D tA1; uniform sampler2D tN1;
uniform sampler2D tA2; uniform sampler2D tN2; uniform sampler2D tA3; uniform sampler2D tN3;
uniform vec4 uTile; uniform vec4 uRough;
varying vec3 vTW; varying vec3 vTN; varying vec2 vMask;
float thash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(thash(i),thash(i+vec2(1,0)),u.x), mix(thash(i+vec2(0,1)),thash(i+vec2(1,1)),u.x), u.y); }
// Quebra de repetição (Í. Quílez, "texture repetition" técnica 3): duas amostras com deslocamentos
// escolhidos por ruído, misturadas suavemente, com gradientes da UV original (sem costura de mip).
vec4 texNT(sampler2D t, vec2 uv, float k){
#ifdef ANTI_TILING
  vec2 dx = dFdx(uv), dy = dFdy(uv);
  float l = k*8.0; float f = fract(l);
  float ia = floor(l), ib = ia + 1.0;
  vec2 offa = sin(vec2(3.0,7.0)*ia); vec2 offb = sin(vec2(3.0,7.0)*ib);
  vec4 ca = textureGrad(t, uv + offa, dx, dy);
  vec4 cb = textureGrad(t, uv + offb, dx, dy);
  return mix(ca, cb, smoothstep(0.2, 0.8, f - 0.1*dot(ca.rgb-cb.rgb, vec3(1.0))));
#else
  return texture(t, uv);
#endif
}
`;

const terrainGLSL_main = /* glsl */ `
  vec3 nW = normalize(vTN);
  float tdist = length(vTW - cameraPosition);
  float kN = vnoise(vTW.xz*0.07);
  // máscaras macro
  float macro = vnoise(vTW.xz*0.006)*0.6 + vnoise(vTW.xz*0.023)*0.4;
  float slope = 1.0 - nW.y;
  float wCliff = smoothstep(0.10, 0.26, slope + (vnoise(vTW.xz*0.05)-0.5)*0.08);
  float wDust = clamp(vMask.x*1.4 + (macro-0.52)*2.2, 0.0, 1.0);
  float wGravel = clamp(vMask.y*1.6 + (0.47-macro)*2.0 + (vnoise(vTW.xz*0.11)-0.5)*0.6, 0.0, 1.0);
  vec2 uv0 = vTW.xz / uTile.x; vec2 uv1 = vTW.xz / uTile.y; vec2 uv2 = vTW.xz / uTile.z;
  vec4 A1 = texNT(tA1, uv1, kN); vec4 N1 = texNT(tN1, uv1, kN);
  vec4 A0 = vec4(0.0), N0 = vec4(0.5,0.5,0.0,1.0), A2 = vec4(0.0), N2 = vec4(0.5,0.5,0.0,1.0);
  if (wDust > 0.01) { A0 = texNT(tA0, uv0, kN); N0 = texNT(tN0, uv0, kN); }
  if (wGravel > 0.01) { A2 = texNT(tA2, uv2, kN); N2 = texNT(tN2, uv2, kN); }
  // mistura por altura (height-lerp) para transições nítidas e naturais
  float h0 = N0.b + wDust*1.2, h1 = N1.b + 0.6, h2 = N2.b + wGravel*1.3;
  float hm = max(max(h0*step(0.01,wDust), h1), h2*step(0.01,wGravel)) - 0.25;
  float b0 = max(h0 - hm, 0.0)*step(0.01,wDust), b1 = max(h1 - hm, 0.0), b2 = max(h2 - hm, 0.0)*step(0.01,wGravel);
  float bs = b0 + b1 + b2 + 1e-5;
  vec4 A = (A0*b0 + A1*b1 + A2*b2)/bs;
  vec4 N = (N0*b0 + N1*b1 + N2*b2)/bs;
  vec3 tn = vec3(N.rg*2.0-1.0, 0.0);
  float nStr = mix(1.25, 0.35, smoothstep(30.0, 500.0, tdist));
  vec3 terrN = normalize(nW + vec3(tn.x, 0.0, tn.y)*nStr);
  vec3 terrAlb = A.rgb;
  float terrRough = (uRough.x*b0 + uRough.y*b1 + uRough.z*b2)/bs; float terrAO = 1.0;
  // ondulações eólicas (ripples ~0,5-0,8 m) nas áreas de areia, somem com a distância
  {
    float sand = clamp((b0*1.0 + b1*0.45)/bs, 0.0, 1.0) * (1.0 - wCliff);
    float rmask = smoothstep(0.25, 0.7, vnoise(vTW.xz*0.045 + 3.1));
    float rf = sand * rmask * (1.0 - smoothstep(6.0, 34.0, tdist));
    if (rf > 0.01) {
      vec2 wd = normalize(vec2(0.83, 0.56));
      float warp = vnoise(vTW.xz*0.35)*5.0 + vnoise(vTW.xz*1.7)*0.8;
      float ph = dot(vTW.xz, wd)*(9.0 + 3.0*vnoise(vTW.xz*0.02)) + warp;
      float sl = cos(ph) + 0.35*cos(2.0*ph + 1.3); // perfil assimétrico (barlavento suave, sotavento íngreme)
      vec2 perp = vec2(-wd.y, wd.x);
      float ph2 = dot(vTW.xz, perp)*3.1 + warp*0.5;
      terrN = normalize(terrN + (vec3(wd.x,0.0,wd.y)*sl*0.13 + vec3(perp.x,0.0,perp.y)*cos(ph2)*0.03) * rf);
      terrAlb *= 1.0 + 0.05*sin(ph)*rf;
    }
  }
  if (wCliff > 0.01) {
    // biplanar para paredões: estratos horizontais em XY/ZY + topo em XZ
    vec3 bw = pow(abs(nW), vec3(4.0)); bw /= (bw.x+bw.y+bw.z);
    vec2 uxy = vec2(vTW.x, -vTW.y)/uTile.w; vec2 uzy = vec2(vTW.z, -vTW.y)/uTile.w; vec2 uxz = vTW.xz/uTile.w;
    vec4 cA = vec4(0.0), cN = vec4(0.0);
    if (bw.z > 0.02) { cA += texNT(tA3, uxy, kN)*bw.z; vec4 n = texNT(tN3, uxy, kN); cN += vec4(n.rg*2.0-1.0, n.b, 1.0)*bw.z; }
    if (bw.x > 0.02) { cA += texNT(tA3, uzy, kN)*bw.x; vec4 n = texNT(tN3, uzy, kN); cN += vec4(n.rg*2.0-1.0, n.b, 1.0)*bw.x; }
    if (bw.y > 0.02) { cA += texNT(tA3, uxz, kN)*bw.y; vec4 n = texNT(tN3, uxz, kN); cN += vec4(n.rg*2.0-1.0, n.b, 1.0)*bw.y; }
    vec3 cn = normalize(nW + (vec3(cN.x*sign(nW.z)*bw.z, -cN.y*(bw.z+bw.x), cN.x*sign(nW.x)*bw.x) + vec3(cN.x,0.0,cN.y)*bw.y)*nStr*1.2);
    float hc = cN.z + wCliff*1.4;
    float hb = N.b;
    float wc = smoothstep(hb + 0.55, hb + 1.05, hc);
    terrAlb = mix(terrAlb, cA.rgb, wc);
    terrN = normalize(mix(terrN, cn, wc));
    terrRough = mix(terrRough, uRough.w, wc);
  }
  // variação macro de cor/brilho (quebra repetição a grande distância)
  float mv = vnoise(vTW.xz*0.0021)*0.55 + vnoise(vTW.xz*0.0137)*0.45;
  terrAlb *= mix(0.80, 1.14, mv);
  terrAlb = mix(terrAlb, terrAlb*vec3(1.06,0.97,0.9), smoothstep(0.4,0.8,vnoise(vTW.xz*0.004+7.0)));
  diffuseColor.rgb *= terrAlb;
`;

export class Terrain {
  readonly group = new THREE.Group();
  readonly heights: Float32Array;
  readonly res = WORLD.res;
  readonly size = WORLD.size;
  material: THREE.MeshStandardMaterial;
  farMaterial: THREE.MeshStandardMaterial;
  private chunks: { cx: number; cz: number; lod: number; meshes: (THREE.Mesh | null)[]; center: THREE.Vector3 }[] = [];
  readonly uniforms: Record<string, THREE.IUniform>;
  private buildQueue = 0;
  private lastCam = new THREE.Vector3(1e9, 0, 0);

  constructor(public data: TerrainData, tex: TerrainTextures, antiTiling: boolean) {
    this.heights = data.heights;
    this.uniforms = {
      uTile: { value: new THREE.Vector4(3.2, 2.6, 2.4, 9.0) },
      uRough: { value: new THREE.Vector4(0.96, 0.9, 0.86, 0.8) },
    };
    for (let i = 0; i < 4; i++) {
      this.uniforms[`tA${i}`] = { value: tex.a[i] };
      this.uniforms[`tN${i}`] = { value: tex.n[i] };
    }
    this.material = this.makeMaterial(antiTiling, false);
    this.farMaterial = this.makeMaterial(false, true);
    for (let cz = 0; cz < NCH; cz++)
      for (let cx = 0; cx < NCH; cx++) {
        const x0 = -this.size / 2 + cx * CHUNK, z0 = -this.size / 2 + cz * CHUNK;
        const hc = this.heightAt(x0 + CHUNK / 2, z0 + CHUNK / 2);
        this.chunks.push({ cx, cz, lod: -1, meshes: [null, null, null, null], center: new THREE.Vector3(x0 + CHUNK / 2, hc, z0 + CHUNK / 2) });
      }
    this.group.add(this.makeFar());
  }

  setAntiTiling(on: boolean) {
    const d = this.material.defines!;
    if (on) d.ANTI_TILING = ''; else delete d.ANTI_TILING;
    this.material.needsUpdate = true;
  }

  setTextures(tex: TerrainTextures) {
    for (let i = 0; i < 4; i++) {
      const oa = this.uniforms[`tA${i}`].value as THREE.Texture, on = this.uniforms[`tN${i}`].value as THREE.Texture;
      this.uniforms[`tA${i}`].value = tex.a[i];
      this.uniforms[`tN${i}`].value = tex.n[i];
      if (oa !== tex.a[i]) oa.dispose();
      if (on !== tex.n[i]) on.dispose();
    }
  }

  private makeMaterial(antiTiling: boolean, far: boolean) {
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0 });
    mat.defines = { ...(antiTiling ? { ANTI_TILING: '' } : {}), ...(far ? { TERRAIN_FAR: '' } : {}) };
    const u = this.uniforms;
    enhance(mat, far ? 'terrainFar' : 'terrain', (shader) => {
      Object.assign(shader.uniforms, u);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vTW; varying vec3 vTN; varying vec2 vMask; attribute vec2 aMask;')
        .replace('#include <project_vertex>', '#include <project_vertex>\n vTW = (modelMatrix * vec4(transformed,1.0)).xyz; vTN = normalize(mat3(modelMatrix)*objectNormal); vMask = aMask;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\n' + terrainGLSL_pars)
        .replace('#include <map_fragment>', terrainGLSL_main)
        .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = clamp(terrRough, 0.5, 1.0);')
        .replace('#include <normal_fragment_maps>', 'normal = normalize((viewMatrix * vec4(terrN, 0.0)).xyz);')
        .replace('#include <aomap_fragment>', 'float ambientOcclusion = mix(1.0, terrAO, 0.9); reflectedLight.indirectDiffuse *= ambientOcclusion; reflectedLight.indirectSpecular *= ambientOcclusion;');
    });
    return mat;
  }

  // ---------- consultas
  sample(i: number, j: number) {
    i = Math.max(0, Math.min(this.res - 1, i));
    j = Math.max(0, Math.min(this.res - 1, j));
    return this.heights[j * this.res + i];
  }
  heightAt(x: number, z: number): number {
    const fx = x + this.size / 2, fz = z + this.size / 2;
    const i = Math.floor(fx), j = Math.floor(fz);
    const tx = fx - i, tz = fz - j;
    const h00 = this.sample(i, j), h10 = this.sample(i + 1, j), h01 = this.sample(i, j + 1), h11 = this.sample(i + 1, j + 1);
    // mesma triangulação da malha/Rapier: diagonal (i,j)-(i+1,j+1)
    if (tx > tz) return h00 + (h10 - h00) * tx + (h11 - h10) * tz;
    return h00 + (h11 - h01) * tx + (h01 - h00) * tz;
  }
  normalAt(x: number, z: number, out = new THREE.Vector3()) {
    const e = 1;
    return out.set(this.heightAt(x - e, z) - this.heightAt(x + e, z), 2 * e, this.heightAt(x, z - e) - this.heightAt(x, z + e)).normalize();
  }
  inBounds(x: number, z: number, margin = 0) {
    const h = this.size / 2 - margin;
    return x > -h && x < h && z > -h && z < h;
  }

  // ---------- malha por chunks com LOD + saias
  private buildChunk(cx: number, cz: number, lod: number): THREE.Mesh {
    const step = LOD_STEPS[lod];
    const n = CHUNK / step + 1;
    const i0 = cx * CHUNK, j0 = cz * CHUNK;
    const skirtN = 4 * (n - 1);
    const vcount = n * n + skirtN + 4;
    const pos = new Float32Array(vcount * 3);
    const nor = new Float32Array(vcount * 3);
    const mask = new Float32Array(vcount * 2);
    const H = (i: number, j: number) => this.sample(i, j);
    let v = 0;
    const put = (gi: number, gj: number, dy: number) => {
      const h = H(gi, gj);
      pos[v * 3] = gi - i0; pos[v * 3 + 1] = h + dy; pos[v * 3 + 2] = gj - j0;
      const e = Math.max(step, 1);
      const nx = H(gi - e, gj) - H(gi + e, gj), nz = H(gi, gj - e) - H(gi, gj + e), ny = 2 * e;
      const l = Math.hypot(nx, ny, nz);
      nor[v * 3] = nx / l; nor[v * 3 + 1] = ny / l; nor[v * 3 + 2] = nz / l;
      const r = 3;
      const curv = (H(gi - r, gj) + H(gi + r, gj) + H(gi, gj - r) + H(gi, gj + r) - 4 * h) / (r * r);
      mask[v * 2] = Math.min(1, Math.max(0, curv * 6)); // côncavo → poeira acumulada
      mask[v * 2 + 1] = Math.min(1, Math.max(0, -curv * 5)); // convexo/cristas → cascalho exposto
      return v++;
    };
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) put(i0 + i * step, j0 + j * step, 0);
    const idx: number[] = [];
    for (let j = 0; j < n - 1; j++)
      for (let i = 0; i < n - 1; i++) {
        const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
        idx.push(a, c, d, a, d, b); // diagonal (i,j)-(i+1,j+1) — igual ao heightAt
      }
    // saias nas 4 bordas (escondem fendas entre LODs)
    const skirt = (edge: number[]) => {
      const s: number[] = edge.map((ei) => {
        const gx = i0 + Math.round(pos[ei * 3]), gz = j0 + Math.round(pos[ei * 3 + 2]);
        return put(gx, gz, -2.5 * step);
      });
      for (let k = 0; k < edge.length - 1; k++) idx.push(edge[k], s[k], s[k + 1], edge[k], s[k + 1], edge[k + 1]);
    };
    const top = [...Array(n).keys()];
    skirt(top); // z = j0
    skirt(top.map((i) => (n - 1) * n + i).reverse());
    skirt(top.map((j) => j * n).reverse());
    skirt(top.map((j) => j * n + n - 1));
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0, v * 3), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor.subarray(0, v * 3), 3));
    g.setAttribute('aMask', new THREE.BufferAttribute(mask.subarray(0, v * 2), 2));
    g.setIndex(v > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    const m = new THREE.Mesh(g, this.material);
    m.position.set(-this.size / 2 + i0, 0, -this.size / 2 + j0);
    m.castShadow = lod <= 2;
    m.receiveShadow = true;
    m.matrixAutoUpdate = false;
    m.updateMatrix();
    return m;
  }

  private makeFar(): THREE.Mesh {
    const { farRes, farSize } = WORLD;
    const g = new THREE.PlaneGeometry(farSize, farSize, farRes - 1, farRes - 1);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position as THREE.BufferAttribute;
    const mask = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      // fx: índice no grid distante (PlaneGeometry: linhas de -z..+z? após rotação, z cresce com a linha)
      const gi = Math.round((x + farSize / 2) / (farSize / (farRes - 1)));
      const gj = Math.round((z + farSize / 2) / (farSize / (farRes - 1)));
      let h = this.data.far[gj * farRes + gi];
      const inside = Math.max(Math.abs(x), Math.abs(z)) < this.size / 2 + 40;
      if (inside) h -= 6; // afunda sob a área jogável
      p.setY(i, h);
      mask[i * 2] = 0.3;
    }
    g.setAttribute('aMask', new THREE.BufferAttribute(mask, 2));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, this.farMaterial);
    m.receiveShadow = true;
    m.castShadow = false;
    m.matrixAutoUpdate = false;
    m.frustumCulled = false;
    return m;
  }

  /** Atualiza LODs; build limitado por quadro para não travar. */
  update(cam: THREE.Vector3, lodScale: number, budget = 3, force = false) {
    const d0 = 170 * lodScale, d1 = 400 * lodScale, d2 = 850 * lodScale;
    if (!force && this.lastCam.distanceToSquared(cam) < 16 && this.buildQueue === 0) return 0;
    this.lastCam.copy(cam);
    let built = 0;
    // ordena por distância para construir primeiro os mais próximos
    const order = this.chunks
      .map((c) => ({ c, d: Math.hypot(c.center.x - cam.x, c.center.z - cam.z) }))
      .sort((a, b) => a.d - b.d);
    for (const { c, d } of order) {
      const want = d < d0 ? 0 : d < d1 ? 1 : d < d2 ? 2 : 3;
      if (want === c.lod) continue;
      if (!c.meshes[want]) {
        if (!force && built >= budget) continue;
        c.meshes[want] = this.buildChunk(c.cx, c.cz, want);
        built++;
      }
      if (c.lod >= 0 && c.meshes[c.lod]) this.group.remove(c.meshes[c.lod]!);
      this.group.add(c.meshes[want]!);
      c.lod = want;
      // libera LODs muito diferentes
      for (let l = 0; l < 4; l++)
        if (Math.abs(l - want) >= 2 && c.meshes[l]) { c.meshes[l]!.geometry.dispose(); c.meshes[l] = null; }
    }
    this.buildQueue = built;
    return built;
  }
}
