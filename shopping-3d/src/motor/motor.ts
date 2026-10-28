/**
 * Renderizador, pós-processamento e qualidade.
 *
 * Caminho da imagem: cena (HDR, com antisserrilhado) → brilho (bloom só no
 * que passa de branco: luzes, LED, letreiros) → tela (ACES + sRGB).
 * Qualidade "alta" no computador (sombra 2048, reflexo no piso), "media" no
 * celular. Se a média de quadros cair, desce um degrau sozinha.
 */
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { Qualidade } from "../mundo/materiais";
import { textos } from "../copy/textos";

export const ehToque = () => matchMedia("(pointer: coarse)").matches;

/** tratamento de cor no fim: um pouco mais de contraste e de cor, e um tom quente (luz de fim de tarde) */
const TRATAMENTO_COR = {
  uniforms: { tDiffuse: { value: null }, contraste: { value: 1.07 }, saturacao: { value: 1.12 }, tom: { value: new THREE.Vector3(1.025, 1.0, 0.965) } },
  vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: `uniform sampler2D tDiffuse; uniform float contraste; uniform float saturacao; uniform vec3 tom; varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 x = (c.rgb - 0.5) * contraste + 0.5;
      float l = dot(x, vec3(0.2126, 0.7152, 0.0722));
      x = mix(vec3(l), x, saturacao) * tom;
      gl_FragColor = vec4(clamp(x, 0.0, 1.0), c.a);
    }`,
};

export class Motor {
  readonly renderer: THREE.WebGLRenderer;
  readonly camera = new THREE.PerspectiveCamera(55, 1, 0.1, 900);
  readonly composer: EffectComposer;
  readonly passagem: RenderPass;
  readonly bloom: UnrealBloomPass;
  readonly celular: boolean;
  qualidade: Qualidade;
  readonly ambiente: THREE.Texture;
  private medias: number[] = [];
  aoMudarQualidade: ((q: Qualidade) => void) | null = null;

  constructor(readonly pai: HTMLElement) {
    this.celular = ehToque() || Math.min(innerWidth, innerHeight) < 600;
    this.qualidade = this.celular ? "media" : "alta";
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance", stencil: false });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.8;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.info.autoReset = false;
    this.renderer.domElement.setAttribute("aria-label", textos.shopping.nomeCurto);
    this.renderer.domElement.tabIndex = 0;
    pai.appendChild(this.renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.ambiente = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const alvo = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: this.celular ? 2 : 4 });
    this.composer = new EffectComposer(this.renderer, alvo);
    this.passagem = new RenderPass(new THREE.Scene(), this.camera);
    this.composer.addPass(this.passagem);
    // só o que passa bem do branco brilha (luz, LED, letreiro); parede clara ao sol não
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.35, 0.45, 2.2);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.composer.addPass(new ShaderPass(TRATAMENTO_COR));
    this.aplicarQualidade();
    this.redimensionar();
    addEventListener("resize", () => this.redimensionar());
  }

  get pixelRatio() {
    const dpr = devicePixelRatio || 1;
    // no "baixa" ainda fica acima de 1 (tela de celular a 1× fica borrada); o que sai é sombra e brilho
    return this.qualidade === "alta" ? Math.min(dpr, 1.75) : this.qualidade === "media" ? Math.min(dpr, 1.5) : Math.min(dpr, 1.25);
  }

  aplicarQualidade() {
    this.renderer.setPixelRatio(this.pixelRatio);
    this.composer.setPixelRatio(this.pixelRatio);
    this.bloom.enabled = this.qualidade !== "baixa";
    this.redimensionar();
    this.aoMudarQualidade?.(this.qualidade);
  }

  redimensionar() {
    const l = this.pai.clientWidth || innerWidth;
    const a = this.pai.clientHeight || innerHeight;
    this.renderer.setSize(l, a, false);
    this.composer.setSize(l, a);
    this.camera.aspect = l / a;
    this.camera.updateProjectionMatrix();
  }

  usar(cena: THREE.Scene) {
    this.passagem.scene = cena;
  }

  desenhar() {
    // conta o quadro inteiro (sombra, reflexo, cena e pós) para o teste de desempenho
    this.renderer.info.reset();
    this.composer.render();
  }

  /** chamado a cada quadro com o tempo dele; desce a qualidade se ficar lento por uns segundos */
  medir(dt: number) {
    this.medias.push(dt);
    if (this.medias.length < 120) return;
    const media = this.medias.reduce((a, b) => a + b, 0) / this.medias.length;
    this.medias = [];
    if (media > 1 / 26 && this.qualidade !== "baixa") {
      this.qualidade = this.qualidade === "alta" ? "media" : "baixa";
      this.aplicarQualidade();
    }
  }
}
