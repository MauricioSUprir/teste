/**
 * Uma pessoa andando no shopping: o modelo, as animações e o movimento.
 *
 * A animação de andar é "no lugar" (o conversor tirou o avanço do quadril);
 * quem anda é o jogo, e o passo acelera junto com a velocidade para o pé não
 * escorregar no piso. Parado e andando se misturam pelo quanto a pessoa anda.
 */
import * as THREE from "three";
import { ANIMACAO } from "../dados/avatares";
import type { Modelo } from "./avatares";

export class Personagem {
  readonly objeto = new THREE.Group();
  readonly modelo: Modelo;
  readonly mixer: THREE.AnimationMixer;
  private andar: THREE.AnimationAction;
  private parado: THREE.AnimationAction;
  private parado2: THREE.AnimationAction | null;
  /** direção para onde olha (radianos; 0 = +z) */
  rumo = 0;
  private rumoAlvo = 0;
  velocidade = 0;
  /** velocidade da animação de andar (m/s): o passo do clipe */
  readonly passo: number;
  private tempoParado = 0;
  private usandoParado2 = false;

  constructor(modelo: Modelo, op: { variarParado?: boolean } = {}) {
    this.modelo = modelo;
    this.objeto.add(modelo.raiz);
    this.mixer = new THREE.AnimationMixer(modelo.raiz);
    this.passo = ANIMACAO[modelo.info.genero].velocidade;
    this.andar = this.mixer.clipAction(modelo.clipes.andar);
    this.parado = this.mixer.clipAction(modelo.clipes.parado);
    this.parado2 = op.variarParado && modelo.clipes.parado2 ? this.mixer.clipAction(modelo.clipes.parado2) : null;
    for (const a of [this.andar, this.parado, this.parado2]) if (a) a.play();
    this.andar.setEffectiveWeight(0);
    this.parado2?.setEffectiveWeight(0);
    // cada pessoa começa num ponto diferente do ciclo (ninguém respira junto)
    this.mixer.setTime(Math.random() * 10);
  }

  get posicao() {
    return this.objeto.position;
  }

  /** vira para a direção (suave, no próximo atualizar) */
  olharPara(rumo: number) {
    this.rumoAlvo = rumo;
  }

  virarJa(rumo: number) {
    this.rumo = this.rumoAlvo = rumo;
    this.objeto.rotation.y = rumo;
  }

  /** dt em segundos; velocidade em m/s (0 = parado) */
  atualizar(dt: number, velocidade: number) {
    this.velocidade = velocidade;
    let d = this.rumoAlvo - this.rumo;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.rumo += d * Math.min(1, dt * 10);
    this.objeto.rotation.y = this.rumo;
    const k = THREE.MathUtils.clamp(velocidade / (this.passo * 0.6), 0, 1);
    // peso andando: sobe rápido, desce um pouco mais devagar (não "trava" ao parar)
    const atual = this.andar.getEffectiveWeight();
    const alvo = k;
    const peso = atual + (alvo - atual) * Math.min(1, dt * (alvo > atual ? 9 : 6));
    this.andar.setEffectiveWeight(peso);
    this.andar.setEffectiveTimeScale(THREE.MathUtils.clamp(velocidade / this.passo, 0.55, 1.9));
    // parado: de vez em quando a pessoa troca de pé, olha em volta (só quem tem a variação)
    if (peso < 0.05) this.tempoParado += dt;
    else this.tempoParado = 0;
    if (this.parado2) {
      const quer2 = this.tempoParado > 6;
      if (quer2 !== this.usandoParado2) {
        this.usandoParado2 = quer2;
        if (quer2) this.parado2.reset();
      }
      const p2 = this.parado2.getEffectiveWeight();
      const alvo2 = quer2 ? 1 - peso : 0;
      const novo2 = p2 + (alvo2 - p2) * Math.min(1, dt * 2);
      this.parado2.setEffectiveWeight(novo2);
      this.parado.setEffectiveWeight(Math.max(0, 1 - peso - novo2));
      if (quer2 && this.tempoParado > 6 + this.modelo.clipes.parado2.duration) this.tempoParado = 0;
    } else {
      this.parado.setEffectiveWeight(1 - peso);
    }
    this.mixer.update(dt);
  }

  descartar() {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.modelo.raiz);
    this.objeto.removeFromParent();
    this.modelo.descartar();
  }
}

/** placa com o nome em cima da cabeça */
export function placaDeNome(nome: string, cor: string): THREE.Sprite {
  const c = document.createElement("canvas");
  const g = c.getContext("2d")!;
  const fonte = "600 44px Poppins, system-ui, sans-serif";
  g.font = fonte;
  const largura = Math.ceil(g.measureText(nome).width) + 56;
  c.width = Math.max(120, largura);
  c.height = 76;
  g.font = fonte;
  g.fillStyle = "rgba(20, 14, 32, 0.62)";
  const r = 30;
  g.beginPath();
  g.roundRect(4, 6, c.width - 8, c.height - 12, r);
  g.fill();
  g.fillStyle = cor;
  g.beginPath();
  g.arc(30, c.height / 2, 9, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#ffffff";
  g.textBaseline = "middle";
  g.fillText(nome, 46, c.height / 2 + 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false, transparent: true }));
  const altura = 0.2;
  s.scale.set((altura * c.width) / c.height, altura, 1);
  s.renderOrder = 10;
  return s;
}
