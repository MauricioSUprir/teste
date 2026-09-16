/**
 * Renderer, sky and lighting, plus the adaptive quality controller.
 *
 * Targets 60 fps on a mid-range phone, so: one shadow-casting light with a
 * tight shadow camera that follows the player, a gradient sky shader instead of
 * a cubemap, and a quality manager that quietly gives up render scale before it
 * gives up frame rate.
 */
import * as THREE from 'three';
import { MapAmbient } from '../shared/mapdef';
import { clamp, damp } from '../shared/math';

export type QualityLevel = 'low' | 'medium' | 'high' | 'ultra';

export interface QualitySettings {
  level: QualityLevel;
  renderScale: number;
  shadows: boolean;
  shadowSize: number;
  antialias: boolean;
  particles: number;
  drawDistance: number;
}

export const QUALITY_PRESETS: Record<QualityLevel, QualitySettings> = {
  low:    { level: 'low',    renderScale: 0.68, shadows: false, shadowSize: 512,  antialias: false, particles: 0.35, drawDistance: 170 },
  medium: { level: 'medium', renderScale: 0.85, shadows: true,  shadowSize: 1024, antialias: false, particles: 0.7,  drawDistance: 240 },
  high:   { level: 'high',   renderScale: 1.0,  shadows: true,  shadowSize: 2048, antialias: true,  particles: 1.0,  drawDistance: 320 },
  ultra:  { level: 'ultra',  renderScale: 1.0,  shadows: true,  shadowSize: 4096, antialias: true,  particles: 1.4,  drawDistance: 420 },
};

const SKY_VERT = /* glsl */`
  varying vec3 vWorld;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const SKY_FRAG = /* glsl */`
  uniform vec3 topColor;
  uniform vec3 bottomColor;
  uniform vec3 sunDir;
  uniform float sunPower;
  uniform float night;
  varying vec3 vWorld;

  // Cheap value noise - enough for a soft cloud deck, no texture needed.
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
    return v;
  }

  void main() {
    vec3 dir = normalize(vWorld);
    float h = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
    vec3 col = mix(bottomColor, topColor, pow(h, 0.85));

    // Cloud deck sitting just below the horizon - this map floats above it.
    float band = smoothstep(0.02, -0.16, dir.y) * smoothstep(-0.55, -0.18, dir.y);
    vec2 uv = dir.xz / max(abs(dir.y) + 0.12, 0.06);
    float clouds = fbm(uv * 1.35);
    clouds = smoothstep(0.42, 0.78, clouds);
    col = mix(col, vec3(1.0, 0.97, 0.95), clouds * band * 0.85);
    // A soft sun bloom baked into the gradient - far cheaper than a light shaft.
    float s = max(dot(dir, normalize(sunDir)), 0.0);
    col += vec3(1.0, 0.92, 0.78) * pow(s, sunPower) * 0.55;
    col = mix(col, col * 0.22 + vec3(0.02, 0.03, 0.09), night);
    gl_FragColor = vec4(col, 1.0);
  }
`;

export class SceneRig {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly sun: THREE.DirectionalLight;
  readonly ambient: THREE.HemisphereLight;
  readonly fill: THREE.DirectionalLight;
  private skyMat: THREE.ShaderMaterial;
  private sky: THREE.Mesh;
  private quality: QualitySettings = QUALITY_PRESETS.high;
  private fpsSamples: number[] = [];
  private adaptiveTimer = 0;
  private autoQuality = true;
  private targetExposure = 1;
  /** Screen shake state. */
  private shake = 0;
  private shakeDecay = 3.2;
  shakeScale = 1;

  constructor(canvas: HTMLCanvasElement, quality: QualityLevel = 'high') {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: QUALITY_PRESETS[quality].antialias,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.camera = new THREE.PerspectiveCamera(62, 1, 0.12, 600);

    this.ambient = new THREE.HemisphereLight(0xbcd8ff, 0x4a4f63, 0.9);
    this.scene.add(this.ambient);

    this.sun = new THREE.DirectionalLight(0xfff0d8, 2.1);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 120;
    this.sun.shadow.bias = -0.0009;
    this.sun.shadow.normalBias = 0.035;
    const c = this.sun.shadow.camera as THREE.OrthographicCamera;
    c.left = -26; c.right = 26; c.top = 26; c.bottom = -26;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    // A cool rim light from behind keeps silhouettes readable against the sky.
    this.fill = new THREE.DirectionalLight(0x9fc4ff, 0.55);
    this.fill.position.set(-0.4, 0.5, -0.8);
    this.scene.add(this.fill);

    this.skyMat = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(0x2f6fd0) },
        bottomColor: { value: new THREE.Color(0xffe0bd) },
        sunDir: { value: new THREE.Vector3(-0.45, 0.82, -0.36) },
        sunPower: { value: 48 },
        night: { value: 0 },
      },
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    // Unit sphere, scaled to sit just inside the far plane every frame. A fixed
    // radius silently vanishes the moment a quality preset shortens draw distance.
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), this.skyMat);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -1000;
    this.scene.add(this.sky);

    this.setQuality(quality);
  }

  applyAmbient(a: MapAmbient): void {
    this.skyMat.uniforms.topColor.value.setHex(a.skyTop);
    this.skyMat.uniforms.bottomColor.value.setHex(a.skyBottom);
    this.skyMat.uniforms.sunDir.value.set(a.sunDir[0], a.sunDir[1], a.sunDir[2]);
    this.scene.fog = new THREE.FogExp2(a.fog, a.fogDensity);
    this.sun.color.setHex(a.sunColor);
    this.sun.intensity = a.sunIntensity;
    this.ambient.color.setHex(a.ambientColor);
    this.ambient.intensity = a.ambientIntensity;
  }

  /** Blackout / storm hooks for Round Director phase events. */
  setNight(amount: number): void {
    this.skyMat.uniforms.night.value = clamp(amount, 0, 1);
    this.targetExposure = 1 - clamp(amount, 0, 1) * 0.45;
  }

  addShake(amount: number): void {
    this.shake = Math.min(1.4, this.shake + amount);
  }

  setQuality(level: QualityLevel): void {
    const q = QUALITY_PRESETS[level];
    this.quality = q;
    this.renderer.shadowMap.enabled = q.shadows;
    this.sun.castShadow = q.shadows;
    if (q.shadows && this.sun.shadow.mapSize.width !== q.shadowSize) {
      this.sun.shadow.mapSize.set(q.shadowSize, q.shadowSize);
      this.sun.shadow.map?.dispose();
      (this.sun.shadow as unknown as { map: THREE.WebGLRenderTarget | null }).map = null;
    }
    this.camera.far = q.drawDistance;
    this.camera.updateProjectionMatrix();
    this.resize();
  }

  getQuality(): QualitySettings { return this.quality; }
  setAutoQuality(on: boolean): void { this.autoQuality = on; }

  resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(dpr * this.quality.renderScale);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Keeps the shadow frustum tight around wherever the action is. */
  followShadow(x: number, y: number, z: number): void {
    const d = this.skyMat.uniforms.sunDir.value as THREE.Vector3;
    this.sun.position.set(x + d.x * 45, y + d.y * 45, z + d.z * 45);
    this.sun.target.position.set(x, y, z);
    this.sun.target.updateMatrixWorld();
  }

  /**
   * Adaptive quality: sample frame times and step down before the player
   * notices, then recover slowly so it never oscillates visibly.
   */
  tickQuality(dt: number): void {
    if (!this.autoQuality) return;
    this.fpsSamples.push(1 / Math.max(dt, 1e-4));
    if (this.fpsSamples.length > 90) this.fpsSamples.shift();
    this.adaptiveTimer += dt;
    if (this.adaptiveTimer < 2.5 || this.fpsSamples.length < 60) return;
    this.adaptiveTimer = 0;
    const sorted = [...this.fpsSamples].sort((a, b) => a - b);
    const p10 = sorted[Math.floor(sorted.length * 0.1)];
    const order: QualityLevel[] = ['low', 'medium', 'high', 'ultra'];
    const idx = order.indexOf(this.quality.level);
    if (p10 < 45 && idx > 0) {
      this.setQuality(order[idx - 1]);
      this.fpsSamples.length = 0;
    } else if (p10 > 58 && idx < order.length - 1 && sorted[0] > 52) {
      this.setQuality(order[idx + 1]);
      this.fpsSamples.length = 0;
    }
  }

  render(dt: number): void {
    // Keep the sky centred on the camera and inside the far plane.
    this.sky.position.copy(this.camera.position);
    const r = this.camera.far * 0.92;
    this.sky.scale.set(r, r, r);

    // Shake is applied to the camera *after* the controller has posed it, so
    // camera logic stays clean and shake never fights it.
    if (this.shake > 0.0001) {
      const s = this.shake * this.shake * 0.35 * this.shakeScale;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
      this.camera.rotation.z += (Math.random() - 0.5) * s * 0.08;
      this.shake = Math.max(0, this.shake - this.shakeDecay * dt);
    }
    this.renderer.toneMappingExposure = damp(this.renderer.toneMappingExposure, this.targetExposure, 3, dt);
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.skyMat.dispose();
    this.sky.geometry.dispose();
    this.renderer.dispose();
  }
}
