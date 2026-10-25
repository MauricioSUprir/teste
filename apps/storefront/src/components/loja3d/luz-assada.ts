/**
 * Luz assada da loja 3D, calculada no próprio navegador quando a loja abre
 * (e de novo sempre que o arranjo muda, porque é refeita a cada montagem):
 *
 *  - sombra suave de contato: para cada ponto do piso e das paredes, quanto do
 *    "céu" em volta fica tampado por móveis a menos de um metro e pouco. Sai de
 *    dezenas de mapas de profundidade, um por direção, cada um só com a fatia de
 *    móveis perto da superfície (planos de corte) — assim um móvel longe nunca
 *    esconde um perto;
 *  - poças de luz: cada spot do teto tem o próprio mapa de sombra; o cone de
 *    luz que chega no piso e nas paredes vira o canal verde da textura.
 *
 * O trabalho é dividido em pedaços pequenos (alguns por quadro), para a loja
 * não travar enquanto assa. É o que os programas 3D chamam de "bake", só que
 * automático: mudou a loja, a luz acompanha.
 */
import * as THREE from "three";
import type { Receptor } from "./superficie";

export interface ReceptorAssado extends Receptor {
  /** resolução da textura de luz */
  largura: number;
  altura: number;
  /** até que distância um móvel faz sombra de contato (m) */
  raio: number;
  /** quantas direções de céu */
  direcoes: number;
}

export interface OpcoesAssada {
  receptores: ReceptorAssado[];
  /** posição de cada spot do teto (apontam para baixo) */
  spots: THREE.Vector3[];
  /** camada dos objetos que fazem sombra de contato (os outros não entram no cálculo) */
  camada: number;
  /** camada do que tampa a luz dos spots (sem as paredes: elas nunca ficam entre o spot e a loja) */
  camadaSpot: number;
  ladoProfundidade: number;
  ladoSpot: number;
}

export interface LuzAssada {
  texturas: THREE.Texture[];
  /** faz até `pedacos` pedaços de trabalho; devolve true quando terminou */
  passo: (pedacos: number) => boolean;
  descartar: () => void;
}

const vertice = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const fragmento = /* glsl */ `
uniform sampler2D tProf;
uniform mat4 uLuz;
uniform vec3 uOrigem;
uniform vec3 uEixoU;
uniform vec3 uEixoV;
uniform vec3 uNormal;
uniform float uPeso;
uniform int uTipo;
uniform vec3 uSpot;
uniform float uPerto;
uniform float uLonge;
uniform float uTexel;
varying vec2 vUv;
float distancia(float z) { return uPerto * uLonge / (uLonge - z * (uLonge - uPerto)); }
void main() {
  vec3 p = uOrigem + uEixoU * vUv.x + uEixoV * vUv.y + uNormal * (uTipo == 0 ? 0.01 : 0.04);
  vec4 c = uLuz * vec4(p, 1.0);
  vec3 ndc = c.xyz / c.w;
  vec2 uvs = ndc.xy * 0.5 + 0.5;
  float zp = ndc.z * 0.5 + 0.5;
  float vis = 1.0;
  bool dentro = uvs.x > 0.0 && uvs.y > 0.0 && uvs.x < 1.0 && uvs.y < 1.0 && zp < 1.0 && zp > 0.0;
  if (uTipo == 0) {
    // céu: a fatia já só tem o que está perto, então qualquer coisa na frente tampa
    if (dentro) {
      float soma = 0.0;
      for (int i = 0; i < 4; i++) {
        vec2 o = vec2(i == 1 || i == 3 ? 0.5 : -0.5, i >= 2 ? 0.5 : -0.5) * uTexel;
        soma += texture2D(tProf, uvs + o).r < zp - 0.0004 ? 0.0 : 1.0;
      }
      vis = soma * 0.25;
    }
    gl_FragColor = vec4(uPeso * vis, 0.0, 0.0, 1.0);
  } else {
    if (dentro) {
      float lp = distancia(zp);
      float soma = 0.0;
      for (int i = -1; i <= 1; i++) {
        for (int j = -1; j <= 1; j++) {
          float zo = texture2D(tProf, uvs + vec2(float(i), float(j)) * uTexel).r;
          soma += distancia(zo) < lp - 0.04 ? 0.0 : 1.0;
        }
      }
      vis = soma / 9.0;
    }
    vec3 L = uSpot - p;
    float d2 = max(dot(L, L), 0.25);
    vec3 l = L * inversesqrt(d2);
    // cone de um spot de loja (~40°) com um pouco de luz em volta
    float cone = smoothstep(0.72, 0.96, l.y) * 0.85 + smoothstep(0.25, 0.75, l.y) * 0.15;
    float e = uPeso * cone * max(dot(uNormal, l), 0.0) / d2;
    gl_FragColor = vec4(0.0, e * vis, 0.0, 1.0);
  }
}`;

/** direções de céu bem espalhadas (Hammersley), mais densas perto da normal (cosseno) */
function direcoesDoCeu(normal: THREE.Vector3, n: number) {
  const t = new THREE.Vector3(Math.abs(normal.y) < 0.9 ? 0 : 1, Math.abs(normal.y) < 0.9 ? 1 : 0, 0).cross(normal).normalize();
  const b = new THREE.Vector3().crossVectors(normal, t);
  const lista: THREE.Vector3[] = [];
  for (let k = 0; k < n; k++) {
    let bits = k;
    bits = ((bits << 16) | (bits >>> 16)) >>> 0;
    bits = (((bits & 0x55555555) << 1) | ((bits & 0xaaaaaaaa) >>> 1)) >>> 0;
    bits = (((bits & 0x33333333) << 2) | ((bits & 0xcccccccc) >>> 2)) >>> 0;
    bits = (((bits & 0x0f0f0f0f) << 4) | ((bits & 0xf0f0f0f0) >>> 4)) >>> 0;
    bits = (((bits & 0x00ff00ff) << 8) | ((bits & 0xff00ff00) >>> 8)) >>> 0;
    const u1 = (k + 0.5) / n;
    const u2 = bits / 4294967296;
    const r = Math.sqrt(u1);
    const fi = 2 * Math.PI * u2;
    const z = Math.sqrt(1 - u1);
    lista.push(new THREE.Vector3().addScaledVector(t, r * Math.cos(fi)).addScaledVector(b, r * Math.sin(fi)).addScaledVector(normal, z).normalize());
  }
  return lista;
}

export function criarLuzAssada(renderer: THREE.WebGLRenderer, cena: THREE.Scene, o: OpcoesAssada): LuzAssada {
  const alvos = o.receptores.map(
    (r) =>
      new THREE.WebGLRenderTarget(r.largura, r.altura, {
        type: THREE.HalfFloatType,
        depthBuffer: false,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
      })
  );
  const comProfundidade = (lado: number) =>
    new THREE.WebGLRenderTarget(lado, lado, {
      depthTexture: new THREE.DepthTexture(lado, lado, THREE.UnsignedIntType),
      depthBuffer: true,
    });
  const prof = comProfundidade(o.ladoProfundidade);
  const profSpot = comProfundidade(o.ladoSpot);
  const oclusor = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, colorWrite: false });
  const camOrto = new THREE.OrthographicCamera();
  camOrto.layers.set(o.camada);
  const camSpot = new THREE.PerspectiveCamera(150, 1, 0.05, 8);
  camSpot.layers.set(o.camadaSpot);
  camSpot.up.set(0, 0, -1);

  const acumular = new THREE.ShaderMaterial({
    vertexShader: vertice,
    fragmentShader: fragmento,
    uniforms: {
      tProf: { value: null },
      uLuz: { value: new THREE.Matrix4() },
      uOrigem: { value: new THREE.Vector3() },
      uEixoU: { value: new THREE.Vector3() },
      uEixoV: { value: new THREE.Vector3() },
      uNormal: { value: new THREE.Vector3() },
      uPeso: { value: 0 },
      uTipo: { value: 0 },
      uSpot: { value: new THREE.Vector3() },
      uPerto: { value: 0.05 },
      uLonge: { value: 8 },
      uTexel: { value: 1 / o.ladoProfundidade },
    },
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
    transparent: true,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), acumular);
  quad.frustumCulled = false;
  const cenaQuad = new THREE.Scene().add(quad);
  const camQuad = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const u = acumular.uniforms;

  const corAntes = new THREE.Color();
  function comEstado<T>(f: () => T): T {
    const alvoAntes = renderer.getRenderTarget();
    const autoClear = renderer.autoClear;
    const alfa = renderer.getClearAlpha();
    renderer.getClearColor(corAntes);
    const fundo = cena.background;
    const sobrepor = cena.overrideMaterial;
    try {
      return f();
    } finally {
      renderer.setRenderTarget(alvoAntes);
      renderer.autoClear = autoClear;
      renderer.setClearColor(corAntes, alfa);
      renderer.clippingPlanes = [];
      cena.background = fundo;
      cena.overrideMaterial = sobrepor;
    }
  }

  function profundidade(alvo: THREE.WebGLRenderTarget, camera: THREE.Camera, planos: THREE.Plane[]) {
    cena.background = null;
    cena.overrideMaterial = oclusor;
    renderer.clippingPlanes = planos;
    renderer.setRenderTarget(alvo);
    renderer.autoClear = true;
    renderer.clear();
    renderer.render(cena, camera);
    renderer.clippingPlanes = [];
    cena.overrideMaterial = null;
  }
  function somar(i: number, r: ReceptorAssado) {
    u.uOrigem.value.copy(r.origem);
    u.uEixoU.value.copy(r.eixoU);
    u.uEixoV.value.copy(r.eixoV);
    u.uNormal.value.copy(r.normal);
    renderer.setRenderTarget(alvos[i]);
    renderer.autoClear = false;
    renderer.render(cenaQuad, camQuad);
  }

  // ---- a lista de pedaços de trabalho: céu de cada receptor + cada spot
  const pedacos: (() => void)[] = [];
  pedacos.push(() => {
    renderer.setClearColor(0x000000, 0);
    for (const a of alvos) {
      renderer.setRenderTarget(a);
      renderer.clear();
    }
  });
  const ceu: (() => void)[] = [];
  o.receptores.forEach((r, i) => {
    const cantos = [r.origem.clone(), r.origem.clone().add(r.eixoU), r.origem.clone().add(r.eixoV), r.origem.clone().add(r.eixoU).add(r.eixoV)];
    const centro = r.origem.clone().addScaledVector(r.eixoU, 0.5).addScaledVector(r.eixoV, 0.5);
    const dirs = direcoesDoCeu(r.normal, r.direcoes);
    for (const d of dirs) {
      ceu.push(() => {
        camOrto.position.copy(centro).addScaledVector(d, 60);
        camOrto.up.set(0, 1, 0);
        if (Math.abs(d.y) > 0.98) camOrto.up.set(0, 0, -1);
        camOrto.lookAt(centro);
        camOrto.updateMatrixWorld();
        const inv = camOrto.matrixWorldInverse;
        let x0 = Infinity;
        let x1 = -Infinity;
        let y0 = Infinity;
        let y1 = -Infinity;
        let z0 = Infinity;
        let z1 = -Infinity;
        for (const c of cantos) {
          for (const t of [0, r.raio]) {
            const v = c.clone().addScaledVector(d, t).applyMatrix4(inv);
            x0 = Math.min(x0, v.x);
            x1 = Math.max(x1, v.x);
            y0 = Math.min(y0, v.y);
            y1 = Math.max(y1, v.y);
            z0 = Math.min(z0, v.z);
            z1 = Math.max(z1, v.z);
          }
        }
        Object.assign(camOrto, { left: x0 - 0.1, right: x1 + 0.1, bottom: y0 - 0.1, top: y1 + 0.1, near: -z1 - 0.5, far: -z0 + 0.5 });
        camOrto.updateProjectionMatrix();
        // só a fatia perto da superfície: entre 2 cm e raio·cos da normal
        const k = r.origem.dot(r.normal);
        const planos = [
          new THREE.Plane(r.normal.clone(), -k - 0.02),
          new THREE.Plane(r.normal.clone().negate(), k + r.raio * d.dot(r.normal)),
        ];
        profundidade(prof, camOrto, planos);
        u.tProf.value = prof.depthTexture;
        u.uLuz.value.multiplyMatrices(camOrto.projectionMatrix, camOrto.matrixWorldInverse);
        u.uPeso.value = 1 / dirs.length;
        u.uTipo.value = 0;
        u.uTexel.value = 1 / o.ladoProfundidade;
        somar(i, r);
      });
    }
  });
  const luzes = o.spots.map((s) => () => {
    camSpot.position.copy(s);
    camSpot.lookAt(s.x, s.y - 1, s.z);
    camSpot.updateMatrixWorld();
    profundidade(profSpot, camSpot, []);
    u.tProf.value = profSpot.depthTexture;
    u.uLuz.value.multiplyMatrices(camSpot.projectionMatrix, camSpot.matrixWorldInverse);
    // normalizado para dar 1 bem embaixo de um spot a 4 m
    u.uPeso.value = 16;
    u.uTipo.value = 1;
    u.uSpot.value.copy(s);
    u.uPerto.value = camSpot.near;
    u.uLonge.value = camSpot.far;
    u.uTexel.value = 1.5 / o.ladoSpot;
    o.receptores.forEach((r, i) => somar(i, r));
  });
  // intercalados: a luz vai assando por igual
  for (let k = 0; k < Math.max(ceu.length, luzes.length); k++) {
    if (ceu[k]) pedacos.push(ceu[k]);
    if (luzes[k]) pedacos.push(luzes[k]);
  }

  let feito = 0;
  return {
    texturas: alvos.map((a) => a.texture),
    passo(n) {
      if (feito >= pedacos.length) return true;
      comEstado(() => {
        for (let k = 0; k < n && feito < pedacos.length; k++) pedacos[feito++]();
      });
      return feito >= pedacos.length;
    },
    descartar() {
      alvos.forEach((a) => a.dispose());
      prof.depthTexture?.dispose();
      prof.dispose();
      profSpot.depthTexture?.dispose();
      profSpot.dispose();
      oclusor.dispose();
      acumular.dispose();
      quad.geometry.dispose();
    },
  };
}
