import * as THREE from 'three';
import { enhance } from '../render/materials';
import type { Terrain } from './terrain';

/** Pegadas das botas no regolito (anel de instâncias). */
export class Footprints {
  mesh: THREE.InstancedMesh;
  private idx = 0;
  private count = 0;
  private dist = 0;
  private last = new THREE.Vector3();
  private left = false;
  private m = new THREE.Matrix4();
  constructor(private terrain: Terrain, max = 600) {
    const tex = Footprints.makeTexture();
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.52, 0.3, 0.19), roughness: 1, transparent: true, alphaMap: tex.alpha, normalMap: tex.normal, normalScale: new THREE.Vector2(1.6, 1.6), depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    enhance(mat, 'footprint');
    const g = new THREE.PlaneGeometry(0.16, 0.34);
    g.rotateX(-Math.PI / 2);
    this.mesh = new THREE.InstancedMesh(g, mat, max);
    this.mesh.count = 0;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
  }

  static makeTexture() {
    const S = 128;
    const c = document.createElement('canvas'); c.width = 64; c.height = S;
    const g = c.getContext('2d')!;
    g.fillStyle = '#000'; g.fillRect(0, 0, 64, S);
    // contorno da bota (alfa)
    g.fillStyle = '#fff';
    g.beginPath(); g.ellipse(32, 36, 24, 32, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(32, 96, 20, 26, 0, 0, Math.PI * 2); g.fill();
    g.fillRect(14, 36, 36, 60);
    const alpha = new THREE.CanvasTexture(c);
    // relevo das garras (normal)
    const n = document.createElement('canvas'); n.width = 64; n.height = S;
    const h = n.getContext('2d')!;
    const img = h.createImageData(64, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < 64; x++) {
      const lug = Math.sin(y * 0.55) > 0.3 ? 1 : 0;
      const hy = (Math.sin((y + 1) * 0.55) > 0.3 ? 1 : 0) - lug;
      const edge = Math.abs(x - 32) > 22 ? (x < 32 ? 1 : -1) : 0;
      const nx = edge * 0.6, ny = hy * 0.9;
      const l = Math.hypot(nx, ny, 1);
      const i = (y * 64 + x) * 4;
      img.data[i] = (nx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (ny / l * 0.5 + 0.5) * 255; img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
    }
    h.putImageData(img, 0, 0);
    const normal = new THREE.CanvasTexture(n);
    normal.colorSpace = THREE.NoColorSpace;
    return { alpha, normal };
  }

  /** chame a cada passo; cria pegada alternando pés quando o personagem anda no chão */
  update(feet: THREE.Vector3, yaw: number, grounded: boolean, speed: number) {
    if (!grounded || speed < 0.3) { this.last.copy(feet); return; }
    this.dist += feet.distanceTo(this.last);
    this.last.copy(feet);
    const stride = speed > 2 ? 1.25 : 0.72;
    if (this.dist < stride) return;
    this.dist = 0;
    this.left = !this.left;
    const side = this.left ? -0.13 : 0.13;
    const x = feet.x + Math.cos(yaw) * side, z = feet.z - Math.sin(yaw) * side;
    const y = this.terrain.heightAt(x, z) + 0.012;
    const n = this.terrain.normalAt(x, z);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw));
    this.m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1));
    this.mesh.setMatrixAt(this.idx, this.m);
    this.idx = (this.idx + 1) % this.mesh.instanceMatrix.count;
    this.count = Math.min(this.count + 1, this.mesh.instanceMatrix.count);
    this.mesh.count = this.count;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/** Poeira em suspensão ao redor da câmera, levada pelo vento (visível contra a luz). */
export class Dust {
  points: THREE.Points;
  uniforms = {
    uTime: { value: 0 },
    uWind: { value: new THREE.Vector3(2.5, 0, 1.2) },
    uCam: { value: new THREE.Vector3() },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunCol: { value: new THREE.Color(1, 1, 1) },
    uAmb: { value: new THREE.Color(0.2, 0.12, 0.07) },
    uDensity: { value: 1 },
    uBox: { value: 26 },
    uExposureHint: { value: 1 },
  };
  constructor(count: number) {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(count * 3), r = new Float32Array(count);
    for (let i = 0; i < count; i++) { p[i * 3] = Math.random(); p[i * 3 + 1] = Math.random(); p[i * 3 + 2] = Math.random(); r[i] = Math.random(); }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    g.setAttribute('aRand', new THREE.BufferAttribute(r, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      vertexShader: /* glsl */ `
        uniform float uTime; uniform vec3 uWind; uniform vec3 uCam; uniform float uBox;
        attribute float aRand; varying float vA; varying vec3 vDir;
        void main(){
          vec3 p = position * uBox;
          p += uWind * uTime * (0.6 + aRand*0.8) + vec3(sin(uTime*0.7+aRand*40.0), sin(uTime*0.5+aRand*17.0)*0.4, cos(uTime*0.6+aRand*29.0))*0.6;
          vec3 rel = mod(p - uCam + uBox*0.5, uBox) - uBox*0.5;
          vec3 wp = uCam + rel;
          vec4 mv = viewMatrix * vec4(wp, 1.0);
          gl_Position = projectionMatrix * mv;
          float d = length(rel);
          vA = smoothstep(uBox*0.5, uBox*0.25, d) * smoothstep(0.6, 2.5, d);
          vDir = normalize(rel);
          gl_PointSize = clamp((0.6 + aRand*1.2) * 22.0 / max(-mv.z, 0.1), 1.0, 5.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uAmb; uniform float uDensity;
        varying float vA; varying vec3 vDir;
        void main(){
          vec2 c = gl_PointCoord - 0.5; float r = dot(c,c);
          if (r > 0.25) discard;
          float soft = smoothstep(0.25, 0.0, r);
          float fwd = pow(max(dot(vDir, uSunDir), 0.0), 8.0); // espalhamento frontal
          vec3 col = uAmb + uSunCol * (0.25 + 3.5*fwd);
          gl_FragColor = vec4(col * vec3(0.95,0.7,0.5), soft * vA * 0.5 * uDensity);
        }`,
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }
  update(dt: number, cam: THREE.Vector3, sunDir: THREE.Vector3, sunCol: THREE.Color, amb: THREE.Color, density: number) {
    this.uniforms.uTime.value += dt;
    this.uniforms.uCam.value.copy(cam);
    this.uniforms.uSunDir.value.copy(sunDir);
    this.uniforms.uSunCol.value.copy(sunCol);
    this.uniforms.uAmb.value.copy(amb);
    this.uniforms.uDensity.value = density;
  }
}
