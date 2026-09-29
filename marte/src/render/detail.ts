// Detalhe PBR realista para objetos procedurais: textura de detalhe (luminância, rugosidade, AO) +
// normal map aplicados por projeção triplanar em espaço do objeto (metros), sem depender das UVs.
// A cor continua vindo do material (tinta branca, ouro, alumínio) — o detalhe só module.
import * as THREE from 'three';

export type DetailSet = 'panel' | 'plate' | 'fabric' | 'tread';
export interface DetailOpts { set: DetailSet; tile: number; albedo?: number; normal?: number; rough?: number }

const TEX: Partial<Record<DetailSet, { d: THREE.Texture; n: THREE.Texture }>> = {};
const SETS: DetailSet[] = ['panel', 'plate', 'fabric', 'tread'];

export async function loadDetailTextures(load: (url: string, srgb: boolean) => Promise<THREE.Texture>, base: string, tier: '1k' | '2k') {
  await Promise.all(SETS.map(async (s) => {
    const [d, n] = await Promise.all([load(`${base}/tex/obj/${tier}/${s}_d.webp`, false), load(`${base}/tex/obj/${tier}/${s}_n.webp`, false)]);
    for (const t of [d, n]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; t.needsUpdate = true; }
    TEX[s] = { d, n };
  }));
}

/** marca o material para receber detalhe (aplicado no onBeforeCompile por render/materials.ts) */
export function detail<T extends THREE.Material>(mat: T, o: DetailOpts): T {
  mat.userData.detail = { albedo: 0.85, normal: 0.8, rough: 0.7, ...o };
  return mat;
}

export function detailKey(mat: THREE.Material) {
  const d = mat.userData.detail as DetailOpts | undefined;
  return d ? `|det` : '';
}

/** injeta a projeção triplanar no shader (deve rodar ANTES do patch de poeira, que age em color_fragment) */
export function applyDetail(shader: THREE.WebGLProgramParametersWithUniforms, mat: THREE.Material) {
  const o = mat.userData.detail as Required<DetailOpts> | undefined;
  const tx = o && TEX[o.set];
  if (!o || !tx) return;
  shader.uniforms.uDetD = { value: tx.d };
  shader.uniforms.uDetN = { value: tx.n };
  shader.uniforms.uDetP = { value: new THREE.Vector4(1 / o.tile, o.albedo, o.normal, o.rough) };
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>
      varying vec3 vDetPos; varying vec3 vDetNrm; varying vec3 vDetAX; varying vec3 vDetAY; varying vec3 vDetAZ;`)
    .replace('#include <project_vertex>', `#include <project_vertex>
      {
        vec4 dp = vec4(transformed, 1.0);
        mat3 dn = mat3(1.0);
        #ifdef USE_INSTANCING
          dp = instanceMatrix * dp; dn = mat3(instanceMatrix);
        #endif
        // escala real do objeto (esferas achatadas etc.) mantém o tamanho do detalhe em metros
        vec3 sc = vec3(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz), length(modelMatrix[2].xyz));
        vDetPos = dp.xyz * sc;
        vDetNrm = normalize(dn * objectNormal);
        mat3 nm = normalMatrix * dn;
        vDetAX = nm[0]; vDetAY = nm[1]; vDetAZ = nm[2];
      }`);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>
      uniform sampler2D uDetD; uniform sampler2D uDetN; uniform vec4 uDetP;
      varying vec3 vDetPos; varying vec3 vDetNrm; varying vec3 vDetAX; varying vec3 vDetAY; varying vec3 vDetAZ;
      vec3 detD; vec3 detW;
      vec3 detSample(sampler2D t, vec3 p, vec3 w) {
        vec3 r = vec3(0.0);
        // pula projeções com peso desprezível (superfícies planas pagam 1 leitura, não 3)
        if (w.x > 0.02) r += texture2D(t, p.zy).rgb * w.x;
        if (w.y > 0.02) r += texture2D(t, p.xz).rgb * w.y;
        if (w.z > 0.02) r += texture2D(t, p.xy).rgb * w.z;
        return r;
      }`)
    .replace('#include <map_fragment>', `#include <map_fragment>
      {
        vec3 n = normalize(vDetNrm);
        detW = pow(abs(n), vec3(4.0)); detW /= (detW.x + detW.y + detW.z);
        vec3 p = vDetPos * uDetP.x;
        detD = detSample(uDetD, p, detW);
        float lum = detD.r * 2.0;
        diffuseColor.rgb *= mix(1.0, lum * mix(1.0, detD.b, 0.6), uDetP.y);
      }`)
    .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor = clamp(mix(roughnessFactor, roughnessFactor * (0.55 + 0.9 * detD.g), uDetP.w), 0.04, 1.0);`)
    .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      {
        vec3 p = vDetPos * uDetP.x;
        vec3 tn = vec3(0.0); vec3 w = detW;
        vec3 n0 = normalize(vDetNrm);
        vec3 pert = vec3(0.0);
        if (w.x > 0.02) { vec2 t = texture2D(uDetN, p.zy).rg * 2.0 - 1.0; pert += vec3(0.0, t.y, t.x) * w.x; }
        if (w.y > 0.02) { vec2 t = texture2D(uDetN, p.xz).rg * 2.0 - 1.0; pert += vec3(t.x, 0.0, t.y) * w.y; }
        if (w.z > 0.02) { vec2 t = texture2D(uDetN, p.xy).rg * 2.0 - 1.0; pert += vec3(t.x, t.y, 0.0) * w.z; }
        pert -= n0 * dot(pert, n0); // só a componente tangente
        vec3 vp = (vDetAX * pert.x + vDetAY * pert.y + vDetAZ * pert.z) * faceDirection;
        normal = normalize(normal + vp * uDetP.z);
      }`);
}
