/**
 * Uma pessoa andando no shopping: o modelo, as animações e o movimento.
 *
 * A animação de andar é "no lugar" (o conversor tirou o avanço do quadril);
 * quem anda é o jogo, e o passo acelera junto com a velocidade para o pé não
 * escorregar no piso. Parado e andando se misturam pelo quanto a pessoa anda;
 * acima do passo rápido entra a corrida (outra animação, no mesmo ritmo).
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
  private correr: THREE.AnimationAction | null;
  private pesoCorrida = 0;
  /** velocidade da animação de correr (m/s) */
  readonly passoCorrida: number;
  /** direção para onde olha (radianos; 0 = +z) */
  rumo = 0;
  private rumoAlvo = 0;
  velocidade = 0;
  /** velocidade da animação de andar (m/s): o passo do clipe */
  readonly passo: number;
  private tempoParado = 0;
  private usandoParado2 = false;
  /** gesto em andamento (acenar, dançar…): mistura por cima do parado e some quando a pessoa anda */
  private gestoAcao: THREE.AnimationAction | null = null;
  private pesoGesto = 0;
  private gestoRestante = 0;
  gestoNome: string | null = null;

  constructor(modelo: Modelo, op: { variarParado?: boolean } = {}) {
    this.modelo = modelo;
    this.objeto.add(modelo.raiz);
    this.mixer = new THREE.AnimationMixer(modelo.raiz);
    this.passo = ANIMACAO[modelo.info.genero].velocidade;
    this.andar = this.mixer.clipAction(modelo.clipes.andar);
    this.parado = this.mixer.clipAction(modelo.clipes.parado);
    this.parado2 = op.variarParado && modelo.clipes.parado2 ? this.mixer.clipAction(modelo.clipes.parado2) : null;
    this.correr = modelo.clipes.correr ? this.mixer.clipAction(modelo.clipes.correr) : null;
    this.passoCorrida = ANIMACAO[modelo.info.genero].corrida;
    for (const a of [this.andar, this.parado, this.parado2, this.correr]) if (a) a.play();
    this.andar.setEffectiveWeight(0);
    this.correr?.setEffectiveWeight(0);
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

  fazerGesto(nome: string, clipe: THREE.AnimationClip, segundos: number) {
    if (this.gestoAcao && this.gestoAcao.getClip() !== clipe) this.gestoAcao.stop();
    this.gestoAcao = this.mixer.clipAction(clipe);
    this.gestoAcao.reset();
    this.gestoAcao.setLoop(THREE.LoopRepeat, Infinity);
    this.gestoAcao.play();
    this.gestoAcao.setEffectiveWeight(this.pesoGesto);
    this.gestoRestante = segundos;
    this.gestoNome = nome;
  }

  pararGesto() {
    this.gestoRestante = 0;
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
    if (this.gestoAcao) {
      if (velocidade > 0.3) this.gestoRestante = 0;
      this.gestoRestante -= dt;
      const alvoG = this.gestoRestante > 0 ? 1 : 0;
      this.pesoGesto += (alvoG - this.pesoGesto) * Math.min(1, dt * 5);
      if (!alvoG && this.pesoGesto < 0.02) {
        this.gestoAcao.stop();
        this.gestoAcao = null;
        this.gestoNome = null;
        this.pesoGesto = 0;
      } else this.gestoAcao.setEffectiveWeight(this.pesoGesto);
    }
    const resto = 1 - this.pesoGesto;
    // correndo: a partir de ~1,5× o passo de andar a corrida assume (e começa no mesmo ponto do ciclo)
    let corre = 0;
    if (this.correr) {
      const alvoC = THREE.MathUtils.clamp((velocidade - this.passo * 1.5) / (this.passoCorrida * 0.85 - this.passo * 1.5), 0, 1);
      if (this.pesoCorrida < 0.01 && alvoC > 0) this.correr.time = (this.andar.time / this.modelo.clipes.andar.duration) * this.correr.getClip().duration;
      this.pesoCorrida += (alvoC - this.pesoCorrida) * Math.min(1, dt * 7);
      corre = this.pesoCorrida;
      this.correr.setEffectiveWeight(peso * resto * corre);
      this.correr.setEffectiveTimeScale(THREE.MathUtils.clamp(velocidade / this.passoCorrida, 0.75, 1.35));
    }
    this.andar.setEffectiveWeight(peso * resto * (1 - corre));
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
      this.parado2.setEffectiveWeight(novo2 * resto);
      this.parado.setEffectiveWeight(Math.max(0, 1 - peso - novo2) * resto);
      if (quer2 && this.tempoParado > 6 + this.modelo.clipes.parado2.duration) this.tempoParado = 0;
    } else {
      this.parado.setEffectiveWeight((1 - peso) * resto);
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
