/**
 * Câmera em terceira pessoa: fica atrás e um pouco acima do avatar, gira com
 * o arrastar e aproxima com a roda/pinça. Não atravessa parede (encurta a
 * distância quando a parede fica no meio) nem sobe acima do teto da loja.
 */
import * as THREE from "three";
import type { Colisao } from "../mundo/colisao";

export class CameraTerceira {
  /** ângulo em volta do avatar (0 = câmera no +z olhando para −z) */
  giro = 0;
  /** inclinação (0 = horizontal, positivo = de cima) */
  inclinacao = 0.22;
  distancia = 3.6;
  private distAtual = 3.6;
  private alvo = new THREE.Vector3();
  private iniciou = false;

  constructor(
    private camera: THREE.PerspectiveCamera,
    private colisao: Colisao,
    /** altura máxima da câmera em (x, z): teto da loja, da varanda ou da galeria */
    private tetoEm: (x: number, z: number) => number
  ) {}

  /** a direção "para a frente" da câmera no chão (para andar com WASD) */
  frente(): [number, number] {
    return [-Math.sin(this.giro), -Math.cos(this.giro)];
  }

  girar(dx: number, dy: number, zoom: number) {
    this.giro -= dx * 0.0055;
    this.inclinacao = THREE.MathUtils.clamp(this.inclinacao + dy * 0.004, -0.15, 1.05);
    this.distancia = THREE.MathUtils.clamp(this.distancia + zoom, 1.6, 9);
  }

  /** gira devagar para ficar atrás do avatar (quando ele anda e ninguém mexe na câmera) */
  seguirRumo(rumo: number, dt: number, forca: number) {
    const atras = rumo + Math.PI;
    let d = atras - this.giro;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.giro += d * Math.min(1, dt * forca);
  }

  atualizar(dt: number, pos: THREE.Vector3, altura: number) {
    const desejado = new THREE.Vector3(pos.x, pos.y + altura * 0.86, pos.z);
    if (!this.iniciou) {
      this.alvo.copy(desejado);
      this.iniciou = true;
    } else this.alvo.lerp(desejado, Math.min(1, dt * 10));
    const ch = Math.cos(this.inclinacao);
    const dir = new THREE.Vector3(Math.sin(this.giro) * ch, Math.sin(this.inclinacao), Math.cos(this.giro) * ch);
    // parede no meio: encurta (rápido para dentro, devagar para fora)
    const fim = this.alvo.clone().addScaledVector(dir, this.distancia);
    const t = this.colisao.raio(this.alvo.x, this.alvo.z, fim.x, fim.z, (this.alvo.y + fim.y) / 2);
    const livre = Math.max(0.6, this.distancia * t - 0.25);
    this.distAtual = livre < this.distAtual ? livre : this.distAtual + (livre - this.distAtual) * Math.min(1, dt * 2.5);
    const p = this.alvo.clone().addScaledVector(dir, this.distAtual);
    p.y = Math.min(p.y, this.tetoEm(p.x, p.z));
    p.y = Math.max(p.y, 0.4);
    this.camera.position.copy(p);
    this.camera.lookAt(this.alvo);
  }

  /** pula direto para a posição certa (ao entrar no shopping) */
  reiniciar() {
    this.iniciou = false;
    this.distAtual = this.distancia;
  }
}
