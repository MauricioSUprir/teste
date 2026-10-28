/**
 * Cópia de apps/storefront/src/components/loja3d/texturas.ts.
 * Texturas da loja 3D geradas no próprio navegador (nada para baixar):
 * porcelanato com veios e rejunte, tecido do sofá, madeira clara, tapete e
 * terra dos vasos. Cada uma vem com o relevo (normal) e, quando precisa, com
 * o mapa de brilho (rugosidade) — é o relevo que faz o reflexo do piso
 * "quebrar" no rejunte e o sofá parecer tecido de perto.
 *
 * Tudo nasce de um ruído de valor periódico, então as que se repetem
 * (tecido, madeira) não mostram emenda.
 */
import * as THREE from "three";

/** ruído de valor 2D que se repete a cada `px` unidades em x e `py` em y (0 a 1) */
export function criarRuido(semente: number) {
  const tabela = new Float32Array(256 * 256);
  let s = semente * 9301 + 49297;
  for (let i = 0; i < tabela.length; i++) {
    s = (s * 9301 + 49297) % 233280;
    tabela[i] = s / 233280;
  }
  const suave = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number, px = 256, py = px) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = suave(x - xi);
    const fy = suave(y - yi);
    const p = Math.min(256, px);
    const q = Math.min(256, py);
    const x0 = ((xi % p) + p) % p;
    const y0 = ((yi % q) + q) % q;
    const x1 = (x0 + 1) % p;
    const y1 = (y0 + 1) % q;
    const a = tabela[y0 * 256 + x0];
    const b = tabela[y0 * 256 + x1];
    const c = tabela[y1 * 256 + x0];
    const d = tabela[y1 * 256 + x1];
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
}
export type Ruido = ReturnType<typeof criarRuido>;

/** soma de oitavas (fbm), também periódica (a faixa de x e y tem de ser múltiplo do período) */
export function fbm(r: Ruido, x: number, y: number, oitavas: number, px: number, py = px) {
  let soma = 0;
  let amp = 0.5;
  let f = 1;
  for (let o = 0; o < oitavas; o++) {
    soma += amp * r(x * f, y * f, px * f, py * f);
    amp *= 0.5;
    f *= 2;
  }
  return soma / (1 - Math.pow(0.5, oitavas));
}

export function paraTextura(c: HTMLCanvasElement, cor: boolean, repetir = true) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = cor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (repetir) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

export function canvas(lado: number, alto = lado) {
  const c = document.createElement("canvas");
  c.width = lado;
  c.height = alto;
  const g = c.getContext("2d");
  if (!g) throw new Error("canvas");
  return { c, g, dados: g.createImageData(lado, alto) };
}

/** relevo (altura 0 a 1 por pixel, linha de cima primeiro) → mapa de normais no padrão do three */
export function normaisDe(altura: Float32Array, lado: number, alto: number, forca: number) {
  const { c, g, dados } = canvas(lado, alto);
  const px = dados.data;
  const h = (x: number, y: number) => altura[((y + alto) % alto) * lado + ((x + lado) % lado)];
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < lado; x++) {
      const dx = (h(x + 1, y) - h(x - 1, y)) * forca;
      // a textura vira de cabeça para baixo ao subir (v cresce para cima)
      const dy = (h(x, y - 1) - h(x, y + 1)) * forca;
      const inv = 1 / Math.hypot(dx, dy, 1);
      const i = (y * lado + x) * 4;
      px[i] = (-dx * inv * 0.5 + 0.5) * 255;
      px[i + 1] = (-dy * inv * 0.5 + 0.5) * 255;
      px[i + 2] = (inv * 0.5 + 0.5) * 255;
      px[i + 3] = 255;
    }
  }
  g.putImageData(dados, 0, 0);
  return paraTextura(c, false);
}

export const corRgb = (hex: string) => {
  const c = new THREE.Color(hex);
  return [c.r * 255, c.g * 255, c.b * 255];
};

export interface TexturasPiso {
  cor: THREE.Texture;
  normal: THREE.Texture;
  /** no canal verde, como o three lê */
  rugosidade: THREE.Texture;
  /** metros que uma repetição da textura cobre */
  metros: number;
  descartar: () => void;
}

/**
 * Porcelanato polido: 2 × 2 placas por textura, cada placa com seus veios
 * (como placas de verdade, o veio não continua de uma para a outra), rejunte
 * fino e fosco e uma leve ondulação que entorta o reflexo nas emendas.
 */
export function texturasPorcelanato(o: { lado: number; base: string; veio: string; rejunte: string; placa: number; veios: number; semente: number }): TexturasPiso {
  const L = o.lado;
  const meia = L / 2;
  const r = criarRuido(o.semente);
  const { c, g, dados } = canvas(L);
  const px = dados.data;
  const altura = new Float32Array(L * L);
  const rug = canvas(L);
  const pr = rug.dados.data;
  const [br, bg, bb] = corRgb(o.base);
  const [vr, vg, vb] = corRgb(o.veio);
  const [jr, jg, jb] = corRgb(o.rejunte);
  const larguraRejunte = Math.max(1.5, L / 512);
  for (let y = 0; y < L; y++) {
    for (let x = 0; x < L; x++) {
      const qx = x < meia ? 0 : 1;
      const qy = y < meia ? 0 : 1;
      const placa = qy * 2 + qx;
      const lx = x - qx * meia;
      const ly = y - qy * meia;
      // distância até a borda da placa (o rejunte fica metade em cada placa)
      const borda = Math.min(lx, ly, meia - 1 - lx, meia - 1 - ly);
      const i = y * L + x;
      // veios: senoide entortada por ruído, cada placa com deslocamento e ângulo próprios
      const ox = placa * 37.1 + 11;
      const oy = placa * 19.7 + 5;
      const ang = 0.5 + placa * 1.3;
      const u = lx / meia;
      const v = ly / meia;
      const t = fbm(r, u * 3 + ox, v * 3 + oy, 5, 256);
      const t2 = fbm(r, u * 7 + oy, v * 7 + ox, 3, 256);
      const linha = (u * Math.cos(ang) + v * Math.sin(ang)) * o.veios + t * 4.5;
      const fino = Math.abs(Math.sin(linha * Math.PI));
      const veio = Math.pow(1 - Math.min(1, fino / 0.07), 2) * (0.35 + 0.65 * t2) * 0.55;
      const veio2 = Math.pow(1 - Math.min(1, Math.abs(Math.sin((linha * 2.3 + t2 * 3) * Math.PI)) / 0.03), 2) * 0.18;
      // nuvens bem leves e um tom por placa
      const nuvem = (fbm(r, u * 2 + ox * 2, v * 2 + oy * 2, 4, 256) - 0.5) * 0.035;
      const tom = 1 + ((placa * 7) % 5 - 2) * 0.004 + nuvem;
      const k = Math.min(1, veio + veio2);
      let cr = (br + (vr - br) * k) * tom;
      let cg = (bg + (vg - bg) * k) * tom;
      let cb = (bb + (vb - bb) * k) * tom;
      let h = 1 - 0.015 * (1 - Math.min(1, borda / (meia * 0.5))); // leve "travesseiro" da placa
      // nem tão liso: abaixo de ~0,15 o brilho do sol vira faíscas que piscam ao andar
      let rugo = 0.16 + 0.04 * t2 + veio * 0.04;
      if (borda < larguraRejunte) {
        cr = jr;
        cg = jg;
        cb = jb;
        h = 0;
        rugo = 0.9;
      } else if (borda < larguraRejunte + 1.5) {
        h *= 0.55; // quina arredondada da placa
        rugo = 0.4;
      }
      px[i * 4] = cr;
      px[i * 4 + 1] = cg;
      px[i * 4 + 2] = cb;
      px[i * 4 + 3] = 255;
      altura[i] = h;
      pr[i * 4] = 0;
      pr[i * 4 + 1] = rugo * 255;
      pr[i * 4 + 2] = 0;
      pr[i * 4 + 3] = 255;
    }
  }
  g.putImageData(dados, 0, 0);
  rug.g.putImageData(rug.dados, 0, 0);
  const cor = paraTextura(c, true);
  const normal = normaisDe(altura, L, L, L / 256);
  const rugosidade = paraTextura(rug.c, false);
  return {
    cor,
    normal,
    rugosidade,
    metros: o.placa * 2,
    descartar: () => [cor, normal, rugosidade].forEach((t) => t.dispose()),
  };
}

export interface TexturasTecido {
  cor: THREE.Texture;
  normal: THREE.Texture;
  /** metros que uma repetição cobre */
  metros: number;
  descartar: () => void;
}

/** tecido de trama aparente (bouclê fino): fios que passam por cima e por baixo, com fiapos */
export function texturasTecido(o: { base: string; fio: number; semente: number; pelo?: number }): TexturasTecido {
  const L = 256;
  const r = criarRuido(o.semente);
  const { c, g, dados } = canvas(L);
  const px = dados.data;
  const altura = new Float32Array(L * L);
  const [br, bg, bb] = corRgb(o.base);
  const n = L / o.fio; // fios por repetição
  const pelo = o.pelo ?? 0.35;
  for (let y = 0; y < L; y++) {
    for (let x = 0; x < L; x++) {
      const i = y * L + x;
      const cx = Math.floor(x / o.fio);
      const cy = Math.floor(y / o.fio);
      const fx = (x % o.fio) / o.fio;
      const fy = (y % o.fio) / o.fio;
      const urdume = (cx + cy) % 2 === 0; // fio vertical por cima
      const perfil = urdume ? Math.sin(Math.PI * fx) : Math.sin(Math.PI * fy);
      const fiapo = fbm(r, (x / L) * n * 2, (y / L) * n * 2, 3, n * 2);
      const h = perfil * (1 - pelo) + fiapo * pelo;
      altura[i] = h;
      const mescla = 0.9 + 0.1 * h + (fbm(r, (x / L) * 8 + 50, (y / L) * 8, 3, 8) - 0.5) * 0.08;
      px[i * 4] = br * mescla;
      px[i * 4 + 1] = bg * mescla;
      px[i * 4 + 2] = bb * mescla;
      px[i * 4 + 3] = 255;
    }
  }
  g.putImageData(dados, 0, 0);
  const cor = paraTextura(c, true);
  const normal = normaisDe(altura, L, L, 2.2);
  return { cor, normal, metros: 0.08, descartar: () => [cor, normal].forEach((t) => t.dispose()) };
}

/** madeira clara (carvalho): veio ao longo de u, poros finos e anéis entortados */
export function texturasMadeira(o: { clara: string; escura: string; semente: number }): TexturasTecido {
  const L = 512;
  const r = criarRuido(o.semente);
  const { c, g, dados } = canvas(L);
  const px = dados.data;
  const altura = new Float32Array(L * L);
  const [ar, ag, ab] = corRgb(o.clara);
  const [er, eg, eb] = corRgb(o.escura);
  for (let y = 0; y < L; y++) {
    for (let x = 0; x < L; x++) {
      const i = y * L + x;
      const u = x / L;
      const v = y / L;
      const torto = fbm(r, u * 4, v * 4, 4, 4) * 2.5;
      const anel = Math.abs(Math.sin((v * 14 + torto) * Math.PI));
      const poro = fbm(r, u * 6, v * 96, 2, 6, 96);
      const k = Math.min(1, Math.pow(1 - anel, 3) * 0.7 + (poro > 0.72 ? 0.25 : 0) + (fbm(r, u * 4 + 9, v * 16, 3, 4) - 0.5) * 0.3);
      px[i * 4] = ar + (er - ar) * k;
      px[i * 4 + 1] = ag + (eg - ag) * k;
      px[i * 4 + 2] = ab + (eb - ab) * k;
      px[i * 4 + 3] = 255;
      altura[i] = 1 - k * 0.6 - (poro > 0.72 ? 0.3 : 0);
    }
  }
  g.putImageData(dados, 0, 0);
  const cor = paraTextura(c, true);
  const normal = normaisDe(altura, L, L, 1.2);
  return { cor, normal, metros: 1.2, descartar: () => [cor, normal].forEach((t) => t.dispose()) };
}

/** terra escura com pedrinhas, para a boca dos vasos */
export function texturaTerra(semente: number) {
  const L = 128;
  const r = criarRuido(semente);
  const { c, g, dados } = canvas(L);
  const px = dados.data;
  for (let y = 0; y < L; y++) {
    for (let x = 0; x < L; x++) {
      const i = (y * L + x) * 4;
      const n = fbm(r, (x / L) * 16, (y / L) * 16, 4, 16);
      const pedra = fbm(r, (x / L) * 40 + 7, (y / L) * 40, 2, 40) > 0.74;
      const k = pedra ? 0.55 + n * 0.3 : 0.18 + n * 0.22;
      px[i] = 120 * k + 20;
      px[i + 1] = 92 * k + 14;
      px[i + 2] = 70 * k + 10;
      px[i + 3] = 255;
    }
  }
  g.putImageData(dados, 0, 0);
  return paraTextura(c, true);
}
