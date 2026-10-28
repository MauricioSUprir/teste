/**
 * As outras pessoas que estão no shopping agora (vindas do servidor): cada
 * uma com o avatar e as cores que escolheu, o nome em cima da cabeça, o balão
 * do que falou no chat e os gestos (acenar, aplaudir, dançar…). A posição
 * chega ~10 vezes por segundo e é suavizada aqui, quadro a quadro.
 *
 * Para não pesar: até 30 pessoas com o avatar completo (as mais perto);
 * as outras aparecem só com o nome até chegarem mais perto.
 */
import * as THREE from "three";
import { infoAvatar } from "../dados/avatares";
import type { Pessoa } from "../rede/rede";
import { carregarGestos, criarModelo, type Visual } from "./avatares";
import { Personagem, placaDeNome } from "./personagem";
import { FONTE } from "../mundo/letreiros";

const MAX_MODELOS = 30;
const CORES_NOME = ["#e8467c", "#7a4bd6", "#2f9e6a", "#2f6fd6", "#d97706", "#0f766e", "#c2185b", "#4d7c0f"];
export const DURACAO_GESTO: Record<string, number> = { acenar: 3.2, aplaudir: 4, dancar: 12, rir: 4, comemorar: 4.5, falar: 4 };

interface Remota {
  id: string;
  nome: string;
  visual: Visual;
  cor: string;
  grupo: THREE.Group;
  p: Personagem | null;
  carregando: boolean;
  alvo: { x: number; z: number; r: number; v: number };
  placa: THREE.Sprite;
  balao: THREE.Sprite | null;
  balaoAte: number;
  toque: THREE.Mesh;
  velocidade: number;
}

const corDe = (id: string) => CORES_NOME[[...id].reduce((s, c) => s + c.charCodeAt(0), 0) % CORES_NOME.length];

/** balão de fala (sprite) com o texto quebrado em até 3 linhas */
export function balaoDeFala(texto: string): THREE.Sprite {
  const c = document.createElement("canvas");
  const g = c.getContext("2d")!;
  const fonte = `500 34px ${FONTE}`;
  g.font = fonte;
  const palavras = texto.split(" ");
  const linhas: string[] = [];
  let linha = "";
  for (const w of palavras) {
    const t = linha ? `${linha} ${w}` : w;
    if (g.measureText(t).width > 420 && linha) {
      linhas.push(linha);
      linha = w;
    } else linha = t;
  }
  if (linha) linhas.push(linha);
  if (linhas.length > 3) {
    linhas.length = 3;
    linhas[2] = `${linhas[2].slice(0, -1)}…`;
  }
  const largura = Math.min(460, Math.max(...linhas.map((l) => g.measureText(l).width))) + 48;
  c.width = Math.ceil(largura);
  c.height = linhas.length * 44 + 48;
  g.font = fonte;
  g.fillStyle = "rgba(255,255,255,0.96)";
  g.beginPath();
  g.roundRect(2, 2, c.width - 4, c.height - 22, 22);
  g.fill();
  // biquinho do balão
  g.beginPath();
  g.moveTo(c.width / 2 - 14, c.height - 21);
  g.lineTo(c.width / 2, c.height - 2);
  g.lineTo(c.width / 2 + 14, c.height - 21);
  g.fill();
  g.fillStyle = "#231a2e";
  g.textBaseline = "top";
  linhas.forEach((l, i) => g.fillText(l, 24, 16 + i * 44));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false, transparent: true }));
  const altura = (c.height / 76) * 0.2;
  s.scale.set((altura * c.width) / c.height, altura, 1);
  s.center.set(0.5, 0);
  s.renderOrder = 11;
  return s;
}

export class OutrosVisitantes {
  readonly grupo = new THREE.Group();
  private pessoas = new Map<string, Remota>();
  private relogio = 0;
  private toqueGeo = new THREE.CylinderGeometry(0.38, 0.38, 1.85, 10).translate(0, 0.92, 0);
  private toqueMat = new THREE.MeshBasicMaterial({ visible: false });

  constructor(private lado: number) {}

  get quantidade() {
    return this.pessoas.size;
  }

  adicionar(p: Pessoa): void {
    if (this.pessoas.has(p.id)) return this.mudarVisual(p);
    const grupo = new THREE.Group();
    grupo.position.set(p.x, 0, p.z);
    const cor = corDe(p.id);
    const placa = placaDeNome(p.nome, cor);
    placa.position.y = infoAvatar(p.visual.avatar).altura + 0.28;
    grupo.add(placa);
    const toque = new THREE.Mesh(this.toqueGeo, this.toqueMat);
    toque.userData = { pessoa: p.id };
    grupo.add(toque);
    this.grupo.add(grupo);
    this.pessoas.set(p.id, { id: p.id, nome: p.nome, visual: p.visual, cor, grupo, p: null, carregando: false, alvo: { x: p.x, z: p.z, r: p.r, v: p.v }, placa, balao: null, balaoAte: 0, toque, velocidade: 0 });
  }

  remover(id: string) {
    const r = this.pessoas.get(id);
    if (!r) return;
    r.p?.descartar();
    this.liberarSprite(r.placa);
    if (r.balao) this.liberarSprite(r.balao);
    r.grupo.removeFromParent();
    this.pessoas.delete(id);
  }

  limpar() {
    for (const id of [...this.pessoas.keys()]) this.remover(id);
  }

  private liberarSprite(s: THREE.Sprite) {
    s.material.map?.dispose();
    s.material.dispose();
    s.removeFromParent();
  }

  mudarVisual(p: Pessoa): void {
    const r = this.pessoas.get(p.id);
    if (!r) return this.adicionar(p);
    const trocouNome = r.nome !== p.nome;
    const trocouVisual = JSON.stringify(r.visual) !== JSON.stringify(p.visual);
    r.nome = p.nome;
    r.visual = p.visual;
    if (trocouNome || trocouVisual) {
      this.liberarSprite(r.placa);
      r.placa = placaDeNome(p.nome, r.cor);
      r.placa.position.y = infoAvatar(p.visual.avatar).altura + 0.28;
      r.grupo.add(r.placa);
    }
    if (trocouVisual && r.p) {
      r.p.descartar();
      r.p = null;
    }
  }

  estados(l: [string, number, number, number, number][]) {
    for (const [id, x, z, rr, v] of l) {
      const r = this.pessoas.get(id);
      if (!r) continue;
      r.alvo = { x, z, r: rr, v };
    }
  }

  falou(id: string, texto: string) {
    const r = this.pessoas.get(id);
    if (!r) return;
    if (r.balao) this.liberarSprite(r.balao);
    r.balao = balaoDeFala(texto);
    r.balao.position.y = infoAvatar(r.visual.avatar).altura + 0.42;
    r.grupo.add(r.balao);
    r.balaoAte = this.relogio + 7;
  }

  async gesto(id: string, g: string) {
    const r = this.pessoas.get(id);
    if (!r?.p) return;
    const clipes = await carregarGestos(infoAvatar(r.visual.avatar).genero).catch(() => null);
    const clipe = clipes?.[g];
    if (clipe && r.p) r.p.fazerGesto(g, clipe, DURACAO_GESTO[g] ?? 4);
  }

  /** objetos para o clique (um cilindro invisível em cada pessoa) */
  alvos(): THREE.Object3D[] {
    return [...this.pessoas.values()].map((r) => r.toque);
  }

  dados(id: string) {
    const r = this.pessoas.get(id);
    return r ? { id, nome: r.nome, visual: r.visual, posicao: r.grupo.position } : null;
  }

  lista() {
    return [...this.pessoas.values()].map((r) => ({ id: r.id, nome: r.nome, x: r.grupo.position.x, z: r.grupo.position.z }));
  }

  atualizar(dt: number, perto: THREE.Vector3) {
    this.relogio += dt;
    // quem ganha o avatar completo: as 30 pessoas mais perto
    const ordem = [...this.pessoas.values()].sort((a, b) => a.grupo.position.distanceToSquared(perto) - b.grupo.position.distanceToSquared(perto));
    ordem.forEach((r, i) => {
      const quer = i < MAX_MODELOS;
      if (quer && !r.p && !r.carregando) {
        r.carregando = true;
        const visual = r.visual;
        void criarModelo(visual, { lado: this.lado })
          .then((m) => {
            if (!this.pessoas.has(r.id) || r.visual !== visual) return m.descartar();
            r.p = new Personagem(m, { variarParado: true });
            r.p.virarJa(r.alvo.r);
            r.grupo.add(r.p.objeto);
          })
          .catch(() => undefined)
          .finally(() => (r.carregando = false));
      } else if (!quer && r.p) {
        r.p.descartar();
        r.p = null;
      }
    });
    for (const r of this.pessoas.values()) {
      const pos = r.grupo.position;
      const dx = r.alvo.x - pos.x;
      const dz = r.alvo.z - pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 8) pos.set(r.alvo.x, 0, r.alvo.z);
      else {
        const k = Math.min(1, dt * 7);
        pos.x += dx * k;
        pos.z += dz * k;
      }
      // velocidade da animação: a que o servidor mandou, suavizada (chega a 0 quando para)
      const alvoV = r.alvo.v > 0 ? Math.max(r.alvo.v, d / 0.25) : d > 0.05 ? d / 0.25 : 0;
      r.velocidade += (Math.min(alvoV, 4) - r.velocidade) * Math.min(1, dt * 6);
      if (r.p) {
        r.p.olharPara(r.alvo.r);
        r.p.atualizar(dt, r.velocidade < 0.08 ? 0 : r.velocidade);
      }
      if (r.balao && this.relogio > r.balaoAte) {
        this.liberarSprite(r.balao);
        r.balao = null;
      }
    }
  }
}
