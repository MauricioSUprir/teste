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

export class Visitantes {
  private lista: Visitante[] = [];
  readonly grupo = new THREE.Group();

  constructor(private shopping: Shopping) {}

  async criar(quantos: number, evitar: string, lado: number) {
    const ids = AVATARES.map((a) => a.id).filter((id) => id !== evitar);
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

  descartar() {
    this.lista.forEach((v) => v.p.descartar());
    this.lista = [];
  }
}
