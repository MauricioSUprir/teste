/**
 * Visitantes que passeiam sozinhos: escolhem um lugar (uma loja, a praça,
 * a entrada), vão pelo mapa de caminhos, param um pouco olhando as
 * prateleiras e seguem. Cada um com uma roupa sorteada, para a multidão não
 * parecer de gêmeos. Esperam quando o visitante de verdade está na frente.
 */
import * as THREE from "three";
import { AVATARES } from "../dados/avatares";
import type { Shopping } from "../mundo/shopping";
import { CORES_CALCA, CORES_CABELO, CORES_ROUPA, criarModelo } from "./avatares";
import { Personagem } from "./personagem";

interface Visitante {
  p: Personagem;
  rota: [number, number][];
  espera: number;
  velocidade: number;
}

let semente = 12345;
const acaso = () => {
  semente = (semente * 16807) % 2147483647;
  return semente / 2147483647;
};
const sorteio = <T,>(lista: T[]) => lista[Math.floor(acaso() * lista.length)];

/**
 * Os avatares que os visitantes podem usar. No celular, poucos (cada pessoa
 * diferente é mais um modelo com fotos de 1024 px na placa de vídeo); a roupa
 * sorteada continua diferenciando um do outro.
 */
function poucosAvatares(evitar: string, variedade?: number) {
  const ids = AVATARES.map((a) => a.id).filter((id) => id !== evitar);
  if (!variedade || variedade >= ids.length) return ids;
  const passo = ids.length / variedade;
  return Array.from({ length: variedade }, (_, k) => ids[Math.floor(k * passo + passo / 2)]);
}

export class Visitantes {
  private lista: Visitante[] = [];
  readonly grupo = new THREE.Group();

  constructor(private shopping: Shopping) {}

  async criar(quantos: number, evitar: string, lado: number, variedade?: number) {
    const ids = poucosAvatares(evitar, variedade);
    for (let i = 0; i < quantos; i++) {
      const id = ids[(i * 5 + 3) % ids.length];
      try {
        const modelo = await criarModelo(
          { avatar: id, cabelo: acaso() < 0.25 ? sorteio(CORES_CABELO)[1] : null, cima: acaso() < 0.7 ? sorteio(CORES_ROUPA)[1] : null, baixo: acaso() < 0.5 ? sorteio(CORES_CALCA)[1] : null },
          { lado, sombra: true }
        );
        const p = new Personagem(modelo, { variarParado: true });
        const n = this.shopping.nos[Math.floor(acaso() * this.shopping.nos.length)];
        p.posicao.set(n.x, 0, n.z);
        p.virarJa(acaso() * Math.PI * 2);
        this.grupo.add(p.objeto);
        this.lista.push({ p, rota: [], espera: acaso() * 4, velocidade: p.passo * (0.85 + acaso() * 0.25) });
      } catch {
        /* um visitante a menos */
      }
    }
  }

  private novaRota(v: Visitante) {
    const s = this.shopping;
    const pos = v.p.posicao;
    // pouco mais da metade das vezes entra numa loja aberta; senão, passeia pela galeria e pela praça
    const lojas = s.destinosPasseio();
    let alvo: [number, number];
    if (acaso() < 0.55 && lojas.length) alvo = sorteio(lojas);
    else {
      const n = s.nos[Math.floor(acaso() * s.nos.length)];
      alvo = [n.x, n.z];
    }
    v.rota = s.rotaAte(pos.x, pos.z, alvo[0], alvo[1]);
  }

  atualizar(dt: number, jogador: THREE.Vector3 | null) {
    for (const v of this.lista) {
      let vel = 0;
      if (v.espera > 0) {
        v.espera -= dt;
        if (v.espera <= 0 && !v.rota.length) this.novaRota(v);
      } else if (v.rota.length) {
        const [x, z] = v.rota[0];
        const pos = v.p.posicao;
        const dx = x - pos.x;
        const dz = z - pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.25) {
          v.rota.shift();
          if (!v.rota.length) {
            v.espera = 3 + acaso() * 9;
            // dentro da loja: fica olhando as prateleiras do fundo
            if (Math.abs(pos.x) > 9.5) v.p.olharPara((Math.sign(pos.x) * Math.PI) / 2);
          }
        } else {
          // gente na frente: espera um instante em vez de atravessar
          const bloqueado =
            (jogador && Math.hypot(jogador.x - (pos.x + (dx / d) * 0.6), jogador.z - (pos.z + (dz / d) * 0.6)) < 0.7) ||
            this.lista.some((o) => o !== v && Math.hypot(o.p.posicao.x - (pos.x + (dx / d) * 0.7), o.p.posicao.z - (pos.z + (dz / d) * 0.7)) < 0.5 && o.p.velocidade < 0.1);
          if (!bloqueado) {
            vel = v.velocidade;
            const passo = Math.min(d, vel * dt);
            pos.x += (dx / d) * passo;
            pos.z += (dz / d) * passo;
            v.p.olharPara(Math.atan2(dx, dz));
          }
        }
      } else v.espera = 1 + acaso() * 3;
      v.p.atualizar(dt, vel);
    }
  }

  /** onde está cada um (para as portas automáticas) */
  posicoes() {
    return this.lista.map((v) => ({ x: v.p.posicao.x, z: v.p.posicao.z }));
  }

  descartar() {
    this.lista.forEach((v) => v.p.descartar());
    this.lista = [];
  }
}

interface Laco {
  pontos: THREE.Vector2[];
  /** comprimento acumulado até cada ponto (o último fecha o laço) */
  acumulado: number[];
  y: number;
}

interface DaVaranda {
  p: Personagem;
  laco: Laco;
  s: number;
  sentido: 1 | -1;
  velocidade: number;
  espera: number;
  proximaParada: number;
}

/**
 * Gente nas varandas dos pisos de cima (de enfeite: lá ainda não se sobe).
 * Cada um dá a volta no átrio pela varanda, de vez em quando para no vidro
 * olhando o movimento lá embaixo e segue.
 */
export class VisitantesVaranda {
  readonly grupo = new THREE.Group();
  private lista: DaVaranda[] = [];
  private lacos: Laco[];

  constructor(caminhos: { pontos: THREE.Vector2[]; y: number }[]) {
    this.lacos = caminhos.map(({ pontos, y }) => {
      const acumulado = [0];
      for (let i = 1; i <= pontos.length; i++) acumulado.push(acumulado[i - 1] + pontos[i % pontos.length].distanceTo(pontos[i - 1]));
      return { pontos, acumulado, y };
    });
  }

  async criar(quantos: number, evitar: string, lado: number, variedade?: number) {
    const ids = poucosAvatares(evitar, variedade);
    for (let i = 0; i < quantos; i++) {
      const id = ids[(i * 7 + 5) % ids.length];
      try {
        const modelo = await criarModelo(
          { avatar: id, cabelo: acaso() < 0.25 ? sorteio(CORES_CABELO)[1] : null, cima: acaso() < 0.7 ? sorteio(CORES_ROUPA)[1] : null, baixo: acaso() < 0.5 ? sorteio(CORES_CALCA)[1] : null },
          { lado, sombra: true }
        );
        const p = new Personagem(modelo, { variarParado: true });
        const laco = this.lacos[i % this.lacos.length];
        const total = laco.acumulado[laco.acumulado.length - 1];
        this.grupo.add(p.objeto);
        this.lista.push({ p, laco, s: acaso() * total, sentido: acaso() < 0.5 ? 1 : -1, velocidade: p.passo * (0.8 + acaso() * 0.25), espera: 0, proximaParada: 8 + acaso() * 20 });
      } catch {
        /* um a menos */
      }
    }
  }

  private ponto(l: Laco, s: number) {
    const total = l.acumulado[l.acumulado.length - 1];
    s = ((s % total) + total) % total;
    let i = 1;
    while (l.acumulado[i] < s) i++;
    const a = l.pontos[(i - 1) % l.pontos.length];
    const b = l.pontos[i % l.pontos.length];
    const k = (s - l.acumulado[i - 1]) / (l.acumulado[i] - l.acumulado[i - 1] || 1);
    return { x: a.x + (b.x - a.x) * k, z: a.y + (b.y - a.y) * k, dx: b.x - a.x, dz: b.y - a.y };
  }

  atualizar(dt: number) {
    for (const v of this.lista) {
      let vel = 0;
      if (v.espera > 0) {
        v.espera -= dt;
      } else {
        v.s += v.sentido * v.velocidade * dt;
        v.proximaParada -= dt;
        vel = v.velocidade;
        if (v.proximaParada <= 0) {
          v.espera = 3 + acaso() * 6;
          v.proximaParada = 10 + acaso() * 25;
          if (acaso() < 0.3) v.sentido = v.sentido > 0 ? -1 : 1;
        }
      }
      const q = this.ponto(v.laco, v.s);
      v.p.posicao.set(q.x, v.laco.y, q.z);
      // andando, olha para a frente; parado, para o vazio do átrio (o meio da galeria)
      if (vel > 0) v.p.olharPara(Math.atan2(q.dx * v.sentido, q.dz * v.sentido));
      else v.p.olharPara(Math.atan2(-q.x, THREE.MathUtils.clamp(q.z, -33, 31) - q.z));
      v.p.atualizar(dt, vel);
    }
  }

  descartar() {
    this.lista.forEach((v) => v.p.descartar());
    this.lista = [];
  }
}
