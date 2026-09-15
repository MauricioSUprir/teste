/**
 * Água do rio: superfície com ondulação em duas camadas, Fresnel, reflexo
 * aproximado do céu, brilho especular do sol e espuma nas margens.
 */

import * as THREE from 'three'
import { riverDistance, WATER_LEVEL } from './terrain'

const VERT = /* glsl */ `
varying vec3 vWorld;
varying vec2 vUv;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`

const FRAG = /* glsl */ `
precision highp float;
varying vec3 vWorld;
varying vec2 vUv;

uniform float uTime;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSkyColor;
uniform vec3 uHorizonColor;
uniform vec3 uDeepColor;
uniform vec3 uShallowColor;
uniform float uDaylight;
uniform float uRain;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
             mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
}

// Normal da superfície a partir de ondas cruzadas
vec3 waveNormal(vec2 p, float t) {
  float e = 0.35;
  float s = 0.0;
  vec2 dirs[4];
  dirs[0] = vec2(1.0, 0.25);
  dirs[1] = vec2(-0.4, 1.0);
  dirs[2] = vec2(0.7, -0.8);
  dirs[3] = vec2(-1.0, -0.3);
  float amp[4];
  amp[0] = 0.055; amp[1] = 0.040; amp[2] = 0.026; amp[3] = 0.018;
  float freq[4];
  freq[0] = 0.55; freq[1] = 0.95; freq[2] = 1.7; freq[3] = 3.1;

  float hL = 0.0, hR = 0.0, hD = 0.0, hU = 0.0;
  for (int i = 0; i < 4; i++) {
    vec2 d = normalize(dirs[i]);
    float f = freq[i];
    float a = amp[i];
    hL += a * sin(dot(p + vec2(-e, 0.0), d) * f + t * (0.8 + float(i) * 0.35));
    hR += a * sin(dot(p + vec2(e, 0.0), d) * f + t * (0.8 + float(i) * 0.35));
    hD += a * sin(dot(p + vec2(0.0, -e), d) * f + t * (0.8 + float(i) * 0.35));
    hU += a * sin(dot(p + vec2(0.0, e), d) * f + t * (0.8 + float(i) * 0.35));
  }
  s += noise(p * 2.0 + t * 0.25) * 0.02;
  return normalize(vec3(hL - hR, 2.0 * e * 0.45, hD - hU) + vec3(0.0, s, 0.0));
}

void main() {
  vec3 viewDir = normalize(cameraPosition - vWorld);
  vec3 n = waveNormal(vWorld.xz, uTime);
  n = normalize(mix(n, vec3(0.0, 1.0, 0.0), 0.25));

  float fres = pow(1.0 - clamp(dot(viewDir, n), 0.0, 1.0), 3.2);
  fres = clamp(0.03 + fres * 0.97, 0.0, 1.0);

  // Profundidade aproximada pela distância ao eixo do rio (vUv.x guarda 0..1)
  float shore = smoothstep(0.0, 0.32, vUv.x);
  vec3 body = mix(uShallowColor, uDeepColor, shore);

  vec3 reflCol = mix(uHorizonColor, uSkyColor, clamp(reflect(-viewDir, n).y, 0.0, 1.0));
  vec3 col = mix(body, reflCol, fres);

  // Especular do sol
  vec3 h = normalize(uSunDir + viewDir);
  float spec = pow(max(dot(n, h), 0.0), 220.0);
  col += uSunColor * spec * 2.6 * uDaylight;

  // Cintilação fina
  float glint = pow(noise(vWorld.xz * 3.0 + uTime * 0.6), 18.0);
  col += uSunColor * glint * 0.7 * uDaylight;

  // Espuma nas margens
  float foam = (1.0 - smoothstep(0.0, 0.14, vUv.x));
  float foamN = noise(vWorld.xz * 2.2 + uTime * 0.5);
  col = mix(col, vec3(0.92, 0.95, 0.96), foam * (0.35 + foamN * 0.45));

  // Chuva: quebra o reflexo e clareia levemente
  col = mix(col, mix(col, uHorizonColor, 0.35), uRain * 0.6);

  float d = length(cameraPosition - vWorld);
  float fogF = clamp((d - uFogNear) / max(uFogFar - uFogNear, 1.0), 0.0, 1.0);
  col = mix(col, uFogColor, fogF);

  gl_FragColor = vec4(col, 1.0);
}
`

export class Water {
  readonly mesh: THREE.Mesh
  readonly material: THREE.ShaderMaterial

  constructor(points: readonly { x: number; z: number }[], halfWidth: number) {
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) },
        uSunColor: { value: new THREE.Color(1, 0.96, 0.9) },
        uSkyColor: { value: new THREE.Color(0.15, 0.35, 0.72) },
        uHorizonColor: { value: new THREE.Color(0.7, 0.8, 0.9) },
        uDeepColor: { value: new THREE.Color(0.055, 0.14, 0.15) },
        uShallowColor: { value: new THREE.Color(0.16, 0.30, 0.28) },
        uDaylight: { value: 1 },
        uRain: { value: 0 },
        uFogColor: { value: new THREE.Color(0.7, 0.8, 0.9) },
        uFogNear: { value: 200 },
        uFogFar: { value: 800 },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      side: THREE.DoubleSide,
    })

    const geo = buildRiverSurface(points, halfWidth)
    this.mesh = new THREE.Mesh(geo, this.material)
    this.mesh.name = 'agua'
    this.mesh.renderOrder = 2
    this.mesh.receiveShadow = false
    this.mesh.castShadow = false
  }

  update(
    elapsed: number, sunDir: THREE.Vector3, sunColor: THREE.Color,
    sky: THREE.Color, horizon: THREE.Color, daylight: number, rain: number,
    fog: THREE.Fog,
  ): void {
    const u = this.material.uniforms
    u.uTime.value = elapsed
    ;(u.uSunDir.value as THREE.Vector3).copy(sunDir)
    ;(u.uSunColor.value as THREE.Color).copy(sunColor)
    ;(u.uSkyColor.value as THREE.Color).copy(sky)
    ;(u.uHorizonColor.value as THREE.Color).copy(horizon)
    u.uDaylight.value = daylight
    u.uRain.value = rain
    ;(u.uFogColor.value as THREE.Color).copy(fog.color)
    u.uFogNear.value = fog.near
    u.uFogFar.value = fog.far
  }

  dispose(): void {
    this.mesh.geometry.dispose()
    this.material.dispose()
  }
}

/** Faixa que acompanha o eixo do rio, com UV.x = distância normalizada à margem. */
function buildRiverSurface(points: readonly { x: number; z: number }[], halfWidth: number): THREE.BufferGeometry {
  const positions: number[] = []
  const uvs: number[] = []
  const normals: number[] = []
  const indices: number[] = []
  const CROSS = 6

  for (let i = 0; i < points.length; i++) {
    const p = points[i]
    const prev = points[Math.max(0, i - 1)]
    const next = points[Math.min(points.length - 1, i + 1)]
    let dx = next.x - prev.x
    let dz = next.z - prev.z
    const len = Math.hypot(dx, dz) || 1
    dx /= len; dz /= len
    const nx = -dz, nz = dx

    for (let j = 0; j <= CROSS; j++) {
      const t = (j / CROSS) * 2 - 1
      const x = p.x + nx * halfWidth * t
      const z = p.z + nz * halfWidth * t
      positions.push(x, WATER_LEVEL, z)
      normals.push(0, 1, 0)
      // UV.x: 0 na margem, 1 no meio do leito
      uvs.push(1 - Math.abs(t), i * 0.02)
    }
    if (i > 0) {
      const base = (i - 1) * (CROSS + 1)
      for (let j = 0; j < CROSS; j++) {
        const a = base + j
        const b = a + 1
        const c = a + CROSS + 1
        const d = c + 1
        indices.push(a, c, b, b, c, d)
      }
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setIndex(indices)
  geo.computeBoundingSphere()
  return geo
}

/** Amostra densa do eixo do rio para gerar a superfície. */
export function sampleRiverCenterline(): { x: number; z: number }[] {
  const pts: { x: number; z: number }[] = []
  // Marcha ao longo de X procurando o mínimo local da distância ao eixo.
  for (let x = -1200; x <= 1200; x += 24) {
    let bestZ = 0
    let bestD = Infinity
    for (let z = -700; z <= 700; z += 6) {
      const d = riverDistance(x, z)
      if (d < bestD) { bestD = d; bestZ = z }
    }
    pts.push({ x, z: bestZ })
  }
  return pts
}
