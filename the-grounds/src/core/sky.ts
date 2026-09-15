/**
 * Céu procedural: cúpula com shader de espalhamento aproximado, sol, lua,
 * nuvens em duas camadas e nevoeiro coerente com o horário e o clima.
 */

import * as THREE from 'three'

const VERT = /* glsl */ `
varying vec3 vWorldDir;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldDir = normalize(wp.xyz - cameraPosition);
  gl_Position = projectionMatrix * viewMatrix * wp;
  gl_Position.z = gl_Position.w; // mantém a cúpula sempre no fundo
}
`

const FRAG = /* glsl */ `
precision highp float;
varying vec3 vWorldDir;

uniform vec3 uSunDir;
uniform vec3 uMoonDir;
uniform float uTime;
uniform float uCloudCover;   // 0..1
uniform float uCloudSpeed;
uniform float uHaze;         // bruma/poluição
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGround;
uniform vec3 uSunColor;
uniform float uStars;        // 0..1 intensidade das estrelas

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec3 dir = normalize(vWorldDir);
  float h = dir.y;

  // Gradiente base zênite -> horizonte -> chão
  float t = clamp(h, -1.0, 1.0);
  vec3 sky = mix(uHorizon, uZenith, pow(clamp(t, 0.0, 1.0), 0.55));
  sky = mix(uGround, sky, smoothstep(-0.12, 0.02, t));

  // Bruma no horizonte
  sky = mix(sky, uHorizon * 1.05, uHaze * pow(1.0 - clamp(abs(t), 0.0, 1.0), 3.0));

  // Estrelas (só quando escuro e acima do horizonte)
  if (uStars > 0.01 && h > 0.0) {
    vec2 sp = dir.xz / max(dir.y, 0.08) * 34.0;
    float s = hash(floor(sp));
    float star = smoothstep(0.9965, 1.0, s);
    float twinkle = 0.7 + 0.3 * sin(uTime * 2.2 + s * 62.8);
    sky += vec3(star * twinkle * uStars * 1.6);
  }

  // Lua
  float moonDot = dot(dir, normalize(uMoonDir));
  float moonDisc = smoothstep(0.9993, 0.99975, moonDot);
  float moonGlow = pow(max(moonDot, 0.0), 260.0) * 0.5;
  sky += vec3(0.85, 0.87, 0.95) * (moonDisc * 1.4 + moonGlow) * uStars;

  // Sol e halo
  float sunDot = dot(dir, normalize(uSunDir));
  float sunDisc = smoothstep(0.99965, 0.99992, sunDot);
  float halo = pow(max(sunDot, 0.0), 110.0) * 0.55 + pow(max(sunDot, 0.0), 8.0) * 0.12;
  sky += uSunColor * (sunDisc * 6.0 + halo);

  // Nuvens: duas camadas com paralaxe
  if (h > -0.02) {
    vec2 cp = dir.xz / max(h + 0.10, 0.10);
    float tt = uTime * uCloudSpeed;
    float lo = fbm(cp * 0.55 + vec2(tt * 0.015, tt * 0.008));
    float hi = fbm(cp * 1.35 + vec2(-tt * 0.03, tt * 0.017));
    float d = lo * 0.65 + hi * 0.35;
    float cover = smoothstep(0.62 - uCloudCover * 0.42, 0.86 - uCloudCover * 0.30, d);
    cover *= smoothstep(-0.02, 0.10, h);

    // Sombreamento simples: bordas iluminadas pelo sol, núcleo mais escuro
    float lit = clamp(0.45 + 0.65 * max(dot(normalize(uSunDir), vec3(0.0, 1.0, 0.0)), 0.0), 0.0, 1.4);
    vec3 cloudLight = mix(vec3(0.42, 0.44, 0.50), vec3(1.0, 0.98, 0.94), lit);
    vec3 cloudDark = cloudLight * mix(0.42, 0.72, lit);
    float edge = smoothstep(0.35, 0.95, d);
    vec3 cloud = mix(cloudDark, cloudLight, edge);
    cloud += uSunColor * pow(max(sunDot, 0.0), 22.0) * 0.35 * cover;
    sky = mix(sky, cloud, cover * 0.94);
  }

  gl_FragColor = vec4(sky, 1.0);
}
`

export interface SkyState {
  /** Hora do dia 0..24. */
  hour: number
  cloudCover: number
  haze: number
  windSpeed: number
}

export class Sky {
  readonly mesh: THREE.Mesh
  readonly material: THREE.ShaderMaterial
  readonly sunDirection = new THREE.Vector3(0.4, 0.8, 0.3).normalize()
  readonly moonDirection = new THREE.Vector3(-0.4, -0.8, -0.3).normalize()
  readonly sunColor = new THREE.Color(1, 0.96, 0.88)
  readonly ambientTop = new THREE.Color()
  readonly ambientBottom = new THREE.Color()
  readonly fogColor = new THREE.Color()
  /** 0 = noite fechada, 1 = sol a pino. */
  daylight = 1

  constructor() {
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uSunDir: { value: this.sunDirection },
        uMoonDir: { value: this.moonDirection },
        uTime: { value: 0 },
        uCloudCover: { value: 0.35 },
        uCloudSpeed: { value: 1 },
        uHaze: { value: 0.25 },
        uZenith: { value: new THREE.Color(0.13, 0.32, 0.72) },
        uHorizon: { value: new THREE.Color(0.68, 0.79, 0.92) },
        uGround: { value: new THREE.Color(0.22, 0.22, 0.24) },
        uSunColor: { value: this.sunColor },
        uStars: { value: 0 },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
    })
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), this.material)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = -1000
    this.mesh.name = 'ceu'
  }

  update(state: SkyState, elapsed: number): void {
    const u = this.material.uniforms
    u.uTime.value = elapsed
    u.uCloudCover.value = state.cloudCover
    u.uHaze.value = state.haze * 0.7
    u.uCloudSpeed.value = 0.5 + state.windSpeed * 1.6

    // Arco solar: nasce a leste (+X), põe a oeste (-X), com inclinação.
    const angle = ((state.hour - 6) / 24) * Math.PI * 2
    const elevation = Math.sin(angle)
    this.sunDirection.set(Math.cos(angle), elevation, 0.28).normalize()
    this.moonDirection.copy(this.sunDirection).multiplyScalar(-1)

    const day = Math.max(0, elevation)
    // Transição suave incluindo o crepúsculo abaixo do horizonte.
    const civil = THREE.MathUtils.smoothstep(elevation, -0.18, 0.10)
    this.daylight = civil

    // Cores do céu por horário
    const zenithDay = new THREE.Color(0.10, 0.31, 0.78)
    const zenithNight = new THREE.Color(0.018, 0.026, 0.055)
    const horizonDay = new THREE.Color(0.62, 0.78, 0.95)
    const horizonDusk = new THREE.Color(0.95, 0.52, 0.28)
    const horizonNight = new THREE.Color(0.05, 0.06, 0.11)

    const duskAmount = Math.pow(1 - Math.min(1, Math.abs(elevation) / 0.30), 2) * (elevation > -0.3 ? 1 : 0)

    const zen = zenithNight.clone().lerp(zenithDay, civil)
    let hor = horizonNight.clone().lerp(horizonDay, civil)
    hor.lerp(horizonDusk, duskAmount * 0.75)

    ;(u.uZenith.value as THREE.Color).copy(zen)
    ;(u.uHorizon.value as THREE.Color).copy(hor)
    ;(u.uGround.value as THREE.Color).copy(hor).multiplyScalar(0.35)
    u.uStars.value = 1 - civil

    // Cor da luz solar: quente no nascer/pôr, neutra ao meio-dia.
    const warm = new THREE.Color(1.0, 0.50, 0.24)
    const neutral = new THREE.Color(1.0, 0.965, 0.92)
    this.sunColor.copy(warm).lerp(neutral, THREE.MathUtils.smoothstep(day, 0.02, 0.45))
    ;(u.uSunColor.value as THREE.Color).copy(this.sunColor)

    this.ambientTop.copy(zen).multiplyScalar(1.15).lerp(new THREE.Color(0.55, 0.66, 0.85), civil * 0.35)
    this.ambientBottom.copy(hor).multiplyScalar(0.45)
    this.fogColor.copy(hor).lerp(zen, 0.22)
  }

  dispose(): void {
    this.mesh.geometry.dispose()
    this.material.dispose()
  }
}
