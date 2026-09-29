// Material de holograma (fantasma de construção e miniaturas): borda fresnel, linhas de varredura discretas.
// Não usa luzes → nunca recompila por mudança de iluminação; válido/ inválido só troca um uniforme de cor.
import * as THREE from 'three';

export const HOLO_OK = new THREE.Color(0x7fe8ff);
export const HOLO_BAD = new THREE.Color(0xff5a3c);
export const holoTime = { value: 0 };

export function holoMaterial(color: THREE.Color, opacity = 1) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uCol: { value: color.clone() }, uTime: holoTime, uOp: { value: opacity } },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main(){
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - w.xyz);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uCol; uniform float uTime; uniform float uOp;
      varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main(){
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
        // varredura: uma linha a cada ~4 cm, subindo devagar; faixa brilhante percorrendo o objeto
        float scan = step(0.82, fract(vW.y * 24.0 - uTime * 0.8)) * 0.08;
        float sweep = exp(-pow(fract(vW.y * 0.35 - uTime * 0.25) - 0.5, 2.0) * 120.0) * 0.35;
        float a = (0.1 + f * 0.75 + scan + sweep) * uOp;
        gl_FragColor = vec4(uCol * a * 1.4, 1.0);
      }`,
  });
}

/** anel que acompanha o relevo (raio de construção, marca no chão do fantasma) */
export function groundRing(n: number, color: THREE.Color, opacity: number) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  const l = new THREE.LineLoop(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  l.frustumCulled = false;
  return l;
}
export function fitRing(l: THREE.LineLoop, cx: number, cz: number, r: number, h: (x: number, z: number) => number, lift = 0.12) {
  const p = l.geometry.attributes.position as THREE.BufferAttribute;
  const n = p.count;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    p.setXYZ(i, x, h(x, z) + lift, z);
  }
  p.needsUpdate = true;
}
