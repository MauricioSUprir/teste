import * as THREE from 'three';
import { ATMOS_GLSL } from './atmosphere';
import { Simplex2 } from './noise';

const skyVert = /* glsl */ `
varying vec3 vDir;
void main(){
  vDir = normalize((modelMatrix * vec4(position,0.0)).xyz);
  vec4 p = projectionMatrix * viewMatrix * vec4(cameraPosition + vDir*1000.0, 1.0);
  gl_Position = p.xyww; // no plano distante
}`;

const skyFrag = /* glsl */ `
uniform vec3 uSun; uniform float uTau; uniform float uSunPower; uniform float uSunCos; uniform float uEnv;
uniform vec3 uEarth; uniform mat3 uStarRot; uniform float uStorm;
varying vec3 vDir;
${ATMOS_GLSL}
float hash13(vec3 p){ p = fract(p*0.1031); p += dot(p, p.zyx+31.32); return fract((p.x+p.y)*p.z); }
float vn3(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(hash13(i),hash13(i+vec3(1,0,0)),f.x), mix(hash13(i+vec3(0,1,0)),hash13(i+vec3(1,1,0)),f.x), f.y),
             mix(mix(hash13(i+vec3(0,0,1)),hash13(i+vec3(1,0,1)),f.x), mix(hash13(i+vec3(0,1,1)),hash13(i+vec3(1,1,1)),f.x), f.y), f.z); }
float fbm3(vec3 p){ return vn3(p)*0.5 + vn3(p*2.03)*0.25 + vn3(p*4.1)*0.125 + vn3(p*8.3)*0.0625; }
vec3 stars(vec3 d){
  vec3 p = uStarRot * d * 420.0;
  vec3 c = floor(p); vec3 f = fract(p)-0.5;
  float h = hash13(c);
  if(h < 0.993) return vec3(0.0);
  vec3 o = vec3(hash13(c+1.3), hash13(c+7.1), hash13(c+3.7)) - 0.5;
  float r = length(f - o*0.6);
  float b = pow((h-0.993)/0.007, 4.0) * 3.0 + 0.04;
  vec3 tint = mix(vec3(1.0,0.8,0.65), vec3(0.75,0.85,1.0), hash13(c+9.0));
  return tint * b * smoothstep(0.14, 0.0, r);
}
void main(){
  vec3 v = normalize(vDir);
  vec3 col;
  float horizonFade = smoothstep(-0.02, 0.02, v.y);
  vec3 sky = marsSky(v, uSun, uTau, uSunPower);
  vec3 ground = marsGround(uSun, uTau, uSunPower);
  col = mix(ground, sky, horizonFade);
  float dark = 1.0 - smoothstep(-0.25, 0.02, uSun.y);
  float starVis = dark * exp(-uTau*1.2) * (1.0 - uStorm);
  if (uEnv < 0.5) {
    col += stars(v) * starVis * horizonFade * (0.4 + 0.6*smoothstep(0.0,0.3,v.y)) * 0.06;
    // Via Láctea: faixa difusa ao longo de um grande círculo (plano galáctico inclinado)
    vec3 gp = uStarRot * v;
    float band = exp(-pow(dot(gp, normalize(vec3(0.3, 0.55, 0.78))) * 7.0, 2.0));
    float cloud = fbm3(gp*7.0 + 3.0);
    float dustLane = smoothstep(0.45, 0.7, fbm3(gp*11.0 - 5.0));
    float mw = band * smoothstep(0.3, 0.85, cloud) * (1.0 - 0.7*dustLane*band);
    col += vec3(0.78, 0.8, 0.9) * mw * (0.6 + 0.4*vn3(gp*40.0)) * 0.00125 * starVis * horizonFade;
    // Terra: "estrela" azul brilhante, mag ~ -2,5
    float e = dot(v, uEarth);
    col += vec3(0.35,0.55,1.0) * smoothstep(0.999992, 0.999998, e) * 3.5 * starVis * horizonFade;
    // disco solar (diâmetro ~0,35°) com escurecimento de limbo
    float mu = dot(v, uSun);
    if (mu > uSunCos) {
      float rr = sqrt(max(0.0, 1.0 - (1.0-mu)/(1.0-uSunCos)));
      vec3 T = sunTransmit(uSun.y, uTau);
      col += vec3(1.0,0.97,0.92) * T * (0.4 + 0.6*rr) * 900.0 * uSunPower * horizonFade;
    }
  } else {
    float mu = dot(v, uSun);
    col += sunTransmit(uSun.y,uTau) * smoothstep(uSunCos-0.002, uSunCos, mu) * 40.0 * uSunPower * horizonFade;
  }
  gl_FragColor = vec4(col, 1.0);
}`;

export class Sky {
  readonly mesh: THREE.Mesh;
  readonly envMesh: THREE.Mesh;
  readonly uniforms = {
    uSun: { value: new THREE.Vector3(0, 1, 0) },
    uTau: { value: 0.5 },
    uSunPower: { value: 1 },
    uSunCos: { value: Math.cos(THREE.MathUtils.degToRad(0.35 / 2)) },
    uEnv: { value: 0 },
    uEarth: { value: new THREE.Vector3(0, 1, 0) },
    uStarRot: { value: new THREE.Matrix3() },
    uStorm: { value: 0 },
  };
  readonly phobos: THREE.Mesh;
  readonly deimos: THREE.Mesh;

  constructor() {
    const geo = new THREE.SphereGeometry(1, 64, 32);
    const mat = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: skyVert, fragmentShader: skyFrag, side: THREE.BackSide, depthWrite: false, depthTest: true });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;
    const envUniforms = { ...this.uniforms, uEnv: { value: 1 } };
    this.envMesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: envUniforms, vertexShader: skyVert, fragmentShader: skyFrag, side: THREE.BackSide, depthWrite: false }));
    this.envMesh.frustumCulled = false;

    // luas: corpos irregulares escuros (albedo ~0,07), iluminados pelo Sol
    this.phobos = this.makeMoon(11, 1.0);
    this.deimos = this.makeMoon(22, 0.6);
  }

  private makeMoon(seed: number, lumpy: number) {
    const g = new THREE.IcosahedronGeometry(1, 5);
    const n = new Simplex2(seed);
    const p = g.attributes.position as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const d = 1 + lumpy * (0.16 * n.fbm(v.x * 1.3 + v.z, v.y * 1.3, 3) + 0.05 * n.noise(v.x * 6, v.y * 6 + v.z * 3));
      v.multiplyScalar(d);
      v.x *= 1.25; // Fobos ~27×22×18 km
      v.z *= 0.85;
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: new THREE.Color(0.075, 0.065, 0.06), roughness: 1, fog: false }));
    m.frustumCulled = false;
    m.renderOrder = -999;
    return m;
  }

  /** posiciona as luas presas à câmera com o tamanho angular correto */
  placeMoon(m: THREE.Mesh, dir: THREE.Vector3, cam: THREE.Vector3, angDiamDeg: number) {
    const dist = 5000;
    m.position.copy(cam).addScaledVector(dir, dist);
    const r = Math.tan(THREE.MathUtils.degToRad(angDiamDeg / 2)) * dist;
    m.scale.setScalar(r);
    m.visible = dir.y > -0.05;
    m.lookAt(cam);
  }
}
