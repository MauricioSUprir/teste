/**
 * O provador em 3D: um estúdio com tablado redondo, ring light (a luz de
 * anel dos maquiadores) e fundo em degradê. O avatar fica no meio, girando
 * devagar até a pessoa arrastar; cada troca de pessoa ou de cor refaz o modelo.
 */
import * as THREE from "three";
import { criarModelo, type Visual } from "./avatares";
import { Personagem } from "./personagem";
import { COR_SHOPPING } from "../mundo/letreiros";

export class Provador {
  readonly cena = new THREE.Scene();
  private atual: Personagem | null = null;
  private pedido = 0;
  private giro = 0.35;
  private girando = true;
  private alvoGiro = 0;
  carregando = false;
  aoCarregar: ((sim: boolean) => void) | null = null;

  constructor(ambiente: THREE.Texture) {
    this.cena.environment = ambiente;
    this.cena.environmentIntensity = 0.5;
    const c = document.createElement("canvas");
    c.width = 16;
    c.height = 512;
    const g = c.getContext("2d")!;
    const grad = g.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, "#2b1640");
    grad.addColorStop(0.55, "#6d3f86");
    grad.addColorStop(1, "#e8b4a0");
    g.fillStyle = grad;
    g.fillRect(0, 0, 16, 512);
    const fundo = new THREE.CanvasTexture(c);
    fundo.colorSpace = THREE.SRGBColorSpace;
    this.cena.background = fundo;

    const piso = new THREE.Mesh(new THREE.CircleGeometry(14, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: "#d9c3c9", roughness: 0.55 }));
    piso.receiveShadow = true;
    const tablado = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.1, 0.14, 64), new THREE.MeshStandardMaterial({ color: "#fbf7f4", roughness: 0.3 }));
    tablado.position.y = 0.07;
    tablado.receiveShadow = true;
    tablado.castShadow = true;
    const filete = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.012, 8, 96).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.2, 1.9) }));
    filete.position.y = 0.02;
    const anel = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.05, 16, 128), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.4, 3.2, 3.1) }));
    anel.position.set(0, 1.35, -1.6);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.1, 24), new THREE.MeshStandardMaterial({ color: "#222", metalness: 0.8, roughness: 0.3 }));
    base.position.set(0, 0.05, -1.6);
    this.cena.add(piso, tablado, filete, anel, base);

    this.cena.add(new THREE.HemisphereLight("#fff4fb", "#6b4a63", 1.3));
    const chave = new THREE.DirectionalLight("#fff3ea", 2.6);
    chave.position.set(1.6, 3.2, 3.2);
    chave.castShadow = true;
    chave.shadow.mapSize.set(1024, 1024);
    const sc = chave.shadow.camera;
    sc.left = sc.bottom = -1.6;
    sc.right = sc.top = 1.6;
    sc.near = 0.5;
    sc.far = 10;
    chave.shadow.bias = -0.0005;
    chave.shadow.normalBias = 0.02;
    const recorte = new THREE.DirectionalLight(COR_SHOPPING.rose, 2.2);
    recorte.position.set(-2.4, 2.2, -2.4);
    const frente = new THREE.PointLight("#ffffff", 3.5, 6, 2);
    frente.position.set(0, 1.35, -1.4);
    this.cena.add(chave, recorte, frente);
  }

  /** troca o avatar ou as cores (o último pedido vence se a pessoa clicar rápido) */
  async vestir(visual: Visual, lado: number) {
    const meu = ++this.pedido;
    this.carregando = true;
    this.aoCarregar?.(true);
    try {
      const modelo = await criarModelo(visual, { lado });
      if (meu !== this.pedido) {
        modelo.descartar();
        return;
      }
      const p = new Personagem(modelo, { variarParado: true });
      p.posicao.y = 0.14;
      p.virarJa(this.giro);
      this.atual?.descartar();
      this.atual = p;
      this.cena.add(p.objeto);
    } finally {
      if (meu === this.pedido) {
        this.carregando = false;
        this.aoCarregar?.(false);
      }
    }
  }

  girar(dx: number) {
    if (Math.abs(dx) > 0) {
      this.girando = false;
      this.alvoGiro = 0;
    }
    this.giro += dx * 0.01;
  }

  enquadrar(camera: THREE.PerspectiveCamera, largura: number, altura: number, painelLado: boolean) {
    camera.fov = 34;
    if (painelLado) {
      // painel à esquerda: o avatar vai para a direita
      camera.setViewOffset(largura, altura, -largura * 0.2, 0, largura, altura);
      camera.position.set(0, 1.15, 4.9);
      camera.lookAt(0, 0.95, 0);
    } else {
      // painel embaixo (metade da tela): o avatar inteiro cabe na metade de cima
      // a metade de cima da imagem mostra d·tan(fov/2) metros: cabe a pessoa (1,9 m) com folga
      const d = 2.15 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      camera.setViewOffset(largura, altura, 0, altura * 0.25, largura, altura);
      camera.position.set(0, 1.2, d);
      camera.lookAt(0, 0.98, 0);
    }
    camera.updateProjectionMatrix();
  }

  atualizar(dt: number) {
    if (this.girando) this.giro += dt * 0.35;
    else {
      this.alvoGiro += dt;
      if (this.alvoGiro > 6) this.girando = true;
    }
    if (this.atual) {
      this.atual.virarJa(this.giro);
      this.atual.atualizar(dt, 0);
    }
  }

  visualAtual() {
    return this.atual;
  }

  descartar() {
    this.atual?.descartar();
    this.atual = null;
  }
}
