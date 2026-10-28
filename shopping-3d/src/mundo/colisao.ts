/**
 * Colisão no plano do chão (x, z): paredes e vitrines são segmentos, vasos e
 * fonte são círculos. A pessoa é um círculo que escorrega rente à parede em
 * vez de travar. A câmera usa os mesmos segmentos para não atravessar parede.
 */

export interface Segmento {
  ax: number;
  az: number;
  bx: number;
  bz: number;
  /** altura da parede (a câmera passa por cima de balcão baixo) */
  altura: number;
}

export interface Circulo {
  x: number;
  z: number;
  r: number;
  altura: number;
}

export class Colisao {
  segmentos: Segmento[] = [];
  circulos: Circulo[] = [];

  parede(ax: number, az: number, bx: number, bz: number, altura = 4) {
    this.segmentos.push({ ax, az, bx, bz, altura });
  }

  /** retângulo alinhado aos eixos (balcão, banco, estante) */
  caixa(x0: number, z0: number, x1: number, z1: number, altura = 1) {
    this.parede(x0, z0, x1, z0, altura);
    this.parede(x1, z0, x1, z1, altura);
    this.parede(x1, z1, x0, z1, altura);
    this.parede(x0, z1, x0, z0, altura);
  }

  circulo(x: number, z: number, r: number, altura = 1) {
    this.circulos.push({ x, z, r, altura });
  }

  /** tira o círculo (x, z, r) de dentro das paredes; devolve a posição corrigida */
  resolver(x: number, z: number, r: number): [number, number] {
    for (let it = 0; it < 3; it++) {
      let mexeu = false;
      for (const s of this.segmentos) {
        const dx = s.bx - s.ax;
        const dz = s.bz - s.az;
        const l2 = dx * dx + dz * dz || 1;
        const t = Math.max(0, Math.min(1, ((x - s.ax) * dx + (z - s.az) * dz) / l2));
        const px = s.ax + dx * t;
        const pz = s.az + dz * t;
        const ex = x - px;
        const ez = z - pz;
        const d2 = ex * ex + ez * ez;
        if (d2 < r * r) {
          const d = Math.sqrt(d2) || 1e-4;
          const empurra = r - d;
          x += (ex / d) * empurra;
          z += (ez / d) * empurra;
          mexeu = true;
        }
      }
      for (const c of this.circulos) {
        const ex = x - c.x;
        const ez = z - c.z;
        const d = Math.hypot(ex, ez) || 1e-4;
        const min = c.r + r;
        if (d < min) {
          x += (ex / d) * (min - d);
          z += (ez / d) * (min - d);
          mexeu = true;
        }
      }
      if (!mexeu) break;
    }
    return [x, z];
  }

  /** fração (0–1) do caminho de (ax, az) até (bx, bz) antes de bater numa parede acima de `y` */
  raio(ax: number, az: number, bx: number, bz: number, y: number): number {
    let melhor = 1;
    const rx = bx - ax;
    const rz = bz - az;
    for (const s of this.segmentos) {
      if (s.altura < y) continue;
      const sx = s.bx - s.ax;
      const sz = s.bz - s.az;
      const den = rx * sz - rz * sx;
      if (Math.abs(den) < 1e-9) continue;
      const qx = s.ax - ax;
      const qz = s.az - az;
      const t = (qx * sz - qz * sx) / den;
      const u = (qx * rz - qz * rx) / den;
      if (t >= 0 && t < melhor && u >= 0 && u <= 1) melhor = t;
    }
    return melhor;
  }
}
