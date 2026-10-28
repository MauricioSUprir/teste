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
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { Qualidade } from "../mundo/materiais";

export const ehToque = () => matchMedia("(pointer: coarse)").matches;

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
    this.renderer.domElement.setAttribute("aria-label", "Shopping da Beleza em 3D");
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
    this.aplicarQualidade();
    this.redimensionar();
    addEventListener("resize", () => this.redimensionar());
  }

  get pixelRatio() {
    const dpr = devicePixelRatio || 1;
    return this.qualidade === "alta" ? Math.min(dpr, 1.75) : this.qualidade === "media" ? Math.min(dpr, 1.5) : Math.min(dpr, 1);
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
