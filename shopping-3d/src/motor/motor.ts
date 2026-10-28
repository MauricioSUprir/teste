/**
 * Renderizador, pós-processamento e qualidade.
 *
 * Caminho da imagem: cena (HDR, com antisserrilhado) → brilho (bloom só no
 * que passa de branco: luzes, LED, letreiros) → tela (ACES + sRGB).
 * Qualidade "alta" no computador (sombra 4096, reflexo no piso), "media" no
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
  private amostras: number[] = [];
  /** só mede depois que o shopping terminou de montar (os primeiros segundos têm engasgos de carga) */
  medindo = false;
  private ultimaTroca = 0;
  private bons = 0;
  private readonly inicial: Qualidade;
  aoMudarQualidade: ((q: Qualidade) => void) | null = null;

  /** depois que o aparelho desligou o 3D por falta de memória: começa mais leve */
  readonly economia: boolean;

  constructor(readonly pai: HTMLElement, op: { economia?: boolean } = {}) {
    this.celular = ehToque() || Math.min(innerWidth, innerHeight) < 600;
    this.economia = !!op.economia;
    this.qualidade = this.economia ? "baixa" : this.celular ? "media" : "alta";
    this.inicial = this.qualidade;
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

  /**
   * Nitidez primeiro: a tela de celular (3×) desenhada a 1× fica borrada e
   * serrilhada. Quando o aparelho não aguenta, sai antes a sombra do sol e o
   * brilho; a resolução é a última a descer, e nunca abaixo de 1,3.
   */
  get pixelRatio() {
    const dpr = devicePixelRatio || 1;
    const teto: Record<Qualidade, number> = this.celular ? { alta: 1.75, media: 1.75, baixa: 1.5, minima: 1.3 } : { alta: 1.75, media: 1.5, baixa: 1.3, minima: 1.15 };
    return Math.min(dpr, teto[this.qualidade]);
  }

  aplicarQualidade() {
    this.renderer.setPixelRatio(this.pixelRatio);
    this.composer.setPixelRatio(this.pixelRatio);
    this.bloom.enabled = this.qualidade !== "minima";
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

  /**
   * Chamado a cada quadro com o tempo dele. Pela mediana de ~150 quadros (um
   * engasgo de carga não conta): lento (menos de 27 quadros/s) desce um
   * degrau; folgado (mais de 50/s) por duas janelas seguidas volta a subir,
   * até a qualidade com que começou. Entre uma troca e outra, 15 s.
   */
  medir(dt: number) {
    if (!this.medindo) return;
    this.amostras.push(dt);
    if (this.amostras.length < 150) return;
    const mediana = [...this.amostras].sort((a, b) => a - b)[75];
    this.amostras = [];
    const agora = performance.now();
    if (agora - this.ultimaTroca < 15000) return;
    const degraus: Qualidade[] = ["alta", "media", "baixa", "minima"];
    const i = degraus.indexOf(this.qualidade);
    if (mediana > 1 / 27 && i < degraus.length - 1) {
      this.bons = 0;
      this.trocar(degraus[i + 1], agora);
    } else if (mediana < 1 / 50 && i > degraus.indexOf(this.inicial)) {
      if (++this.bons >= 2) {
        this.bons = 0;
        this.trocar(degraus[i - 1], agora);
      }
    } else this.bons = 0;
  }

  private trocar(q: Qualidade, agora: number) {
    this.qualidade = q;
    this.ultimaTroca = agora;
    this.aplicarQualidade();
  }
}
