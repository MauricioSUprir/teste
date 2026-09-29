import * as THREE from 'three';
import type { CSM } from 'three/examples/jsm/csm/CSM.js';
import { applyMarsFog } from './marsfog';
import { applyDetail, detailKey } from './detail';

type Patch = (shader: THREE.WebGLProgramParametersWithUniforms, renderer: THREE.WebGLRenderer) => void;

let csmRef: CSM | null = null;
const ORIG_LIGHTS_BEGIN = THREE.ShaderChunk.lights_fragment_begin;

/** O CSM do three/examples injeta uma cópia antiga de lights_fragment_begin (sem o LUT DFG → especular zerado).
 *  Reconstruímos: chunk atual do three + somente o bloco de luzes direcionais do CSM. */
export function patchCSMChunk() {
  const C = THREE.ShaderChunk as Record<string, string>;
  const csm = C.lights_fragment_begin;
  if (csm === ORIG_LIGHTS_BEGIN) return;
  const dirStart = ORIG_LIGHTS_BEGIN.indexOf('#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )');
  const rectStart = ORIG_LIGHTS_BEGIN.indexOf('#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )');
  const cStart = csm.indexOf('#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct ) && defined( USE_CSM )');
  const cEnd = csm.indexOf('#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )');
  if (dirStart < 0 || rectStart < 0 || cStart < 0 || cEnd < 0) { console.warn('patchCSMChunk: formato inesperado'); return; }
  C.lights_fragment_begin = ORIG_LIGHTS_BEGIN.slice(0, dirStart) + csm.slice(cStart, cEnd) + ORIG_LIGHTS_BEGIN.slice(rectStart);
}
const registry = new Set<THREE.Material>();
const patches = new WeakMap<THREE.Material, { key: string; patch?: Patch }>();

export function setCSM(csm: CSM | null) {
  csmRef = csm;
  patchCSMChunk();
  // reconfigura todos os materiais já registrados (troca de qualidade)
  for (const m of registry) wire(m);
}

function wire(mat: THREE.Material) {
  const info = patches.get(mat)!;
  const m = mat as THREE.Material & { defines?: Record<string, unknown> };
  m.defines = m.defines || {};
  delete m.defines.USE_CSM; delete m.defines.CSM_CASCADES; delete m.defines.CSM_FADE;
  let csmHook: ((s: THREE.WebGLProgramParametersWithUniforms) => void) | null = null;
  if (csmRef) {
    csmRef.setupMaterial(mat);
    csmHook = mat.onBeforeCompile as unknown as (s: THREE.WebGLProgramParametersWithUniforms) => void;
  }
  m.defines.MARS_FOG = '';
  const dusty = info.key === 'std';
  mat.onBeforeCompile = (shader, renderer) => {
    if (csmHook) csmHook(shader);
    applyMarsFog(shader);
    applyDetail(shader, mat);
    if (dusty) applyDust(shader);
    info.patch?.(shader, renderer);
  };
  mat.customProgramCacheKey = () => info.key + detailKey(mat) + (csmRef ? `|csm${csmRef.cascades}` : '');
  mat.needsUpdate = true;
}

/** Registra um material para névoa marciana + sombras em cascata (+ patch opcional de shader). */
export function enhance<T extends THREE.Material>(mat: T, key = 'std', patch?: Patch): T {
  patches.set(mat, { key, patch });
  registry.add(mat);
  wire(mat);
  return mat;
}

/** poeira marciana assentada nas faces voltadas para cima + véu leve em tudo (desgaste) */
function applyDust(shader: THREE.WebGLProgramParametersWithUniforms) {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vDustN;')
    .replace('#include <project_vertex>', '#include <project_vertex>\n vDustN = normalize(mat3(modelMatrix) * objectNormal);');
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vDustN;')
    .replace('#include <color_fragment>', `#include <color_fragment>
      float dustAmt = smoothstep(0.3, 0.9, normalize(vDustN).y) * 0.42 + 0.07;
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.58, 0.40, 0.28) * 0.9, dustAmt);`)
    .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = mix(roughnessFactor, 0.92, dustAmt);');
}

export function unregister(mat: THREE.Material) {
  registry.delete(mat);
}

export function enhanceObject(obj: THREE.Object3D) {
  obj.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) if (!registry.has(m) && (m as THREE.MeshStandardMaterial).isMeshStandardMaterial) enhance(m, m.userData.noDust || (m as THREE.MeshStandardMaterial).emissiveIntensity > 0.5 ? 'clean' : 'std');
  });
}
