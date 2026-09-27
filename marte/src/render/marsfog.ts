// Névoa de poeira com perspectiva aérea: cor = radiância do céu no horizonte na direção vista
// (mesmo modelo do céu), densidade dependente de altura e de τ. Aplicada a todos os materiais via define.
import * as THREE from 'three';
import { ATMOS_GLSL } from '../world/atmosphere';

export const fogUniforms = {
  uFogSun: { value: new THREE.Vector3(0, 1, 0) },
  uFogTau: { value: 0.5 },
  uFogSunPower: { value: 1 },
  uFogDensity: { value: 0.00006 },
  uFogHeightFalloff: { value: 1 / 800 },
  uFogViewToWorld: { value: new THREE.Matrix3() },
  uFogCamY: { value: 0 },
  uFogStormTint: { value: 0 },
};

let installed = false;
export function installMarsFog() {
  if (installed) return;
  installed = true;
  const C = THREE.ShaderChunk as Record<string, string>;
  C.fog_pars_vertex = `#ifdef USE_FOG\n varying float vFogDepth;\n #ifdef MARS_FOG\n varying vec3 vFogView;\n #endif\n#endif`;
  C.fog_vertex = `#ifdef USE_FOG\n vFogDepth = - mvPosition.z;\n #ifdef MARS_FOG\n vFogView = mvPosition.xyz;\n #endif\n#endif`;
  C.fog_pars_fragment = `#ifdef USE_FOG
  uniform vec3 fogColor; varying float vFogDepth;
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #else
    uniform float fogNear; uniform float fogFar;
  #endif
  #ifdef MARS_FOG
    varying vec3 vFogView;
    uniform vec3 uFogSun; uniform float uFogTau; uniform float uFogSunPower; uniform float uFogDensity;
    uniform float uFogHeightFalloff; uniform mat3 uFogViewToWorld; uniform float uFogCamY;
    #ifndef MARS_ATMOS_DEFINED
    #define MARS_ATMOS_DEFINED
    ${ATMOS_GLSL}
    #endif
  #endif
#endif`;
  C.fog_fragment = `#ifdef USE_FOG
  #ifdef MARS_FOG
    vec3 fw = uFogViewToWorld * vFogView;
    float fdist = length(fw);
    vec3 fdir = fw / max(fdist, 1e-4);
    // integral analítica de densidade exponencial em altura
    float hk = uFogHeightFalloff;
    float fy0 = uFogCamY;
    float dy = fdir.y * fdist;
    float integ = abs(dy) > 0.01 ? (exp(-hk*fy0) - exp(-hk*(fy0+dy))) / (hk*fdir.y) : fdist*exp(-hk*fy0);
    float fogAmt = 1.0 - exp(-uFogDensity * max(integ, 0.0));
    vec3 hd = normalize(vec3(fdir.x, max(fdir.y, 0.02), fdir.z));
    vec3 fcol = marsSky(hd, uFogSun, uFogTau, uFogSunPower);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, fcol, fogAmt);
  #else
    #ifdef FOG_EXP2
      float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
    #else
      float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
    #endif
    gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
  #endif
#endif`;
}

/** Ativa névoa marciana num material (compartilha os mesmos objetos de uniforms). */
export function applyMarsFog(shader: { uniforms: Record<string, THREE.IUniform> }) {
  Object.assign(shader.uniforms, fogUniforms);
}
