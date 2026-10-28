/**
 * Texturas próprias do shopping (além do porcelanato e da madeira de
 * texturas.ts): cimento queimado, gesso das paredes e a água da fonte.
 * Tudo gerado no navegador, sem arquivo para baixar.
 */
import * as THREE from "three";
import { canvas, criarRuido, fbm, normaisDe, paraTextura } from "./texturas";

/** "#rrggbb" → [r, g, b] de 0 a 255, como o canvas desenha (sRGB) */
const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/**
 * texturas.ts converte a cor para linear antes de pintar o canvas (fica mais
 * escura que o hex); esta é a cor a passar para sair exatamente `hex`.
 */
export function corParaTexturas(hex: string) {
  const [r, g, b] = rgb(hex);
  return `#${new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.LinearSRGBColorSpace).getHexString()}`;
}

export interface TexturasCimento {
  cor: THREE.Texture;
  normal: THREE.Texture;
  rugosidade: THREE.Texture;
  metros: number;
}

/** cimento queimado: manchas grandes de desempenadeira, poros e um brilho irregular */
export function texturasCimento(base: string, semente: number, lado = 512): TexturasCimento {
  const L = lado;
  const r = criarRuido(semente);
  const { c, g, dados } = canvas(L);
  const rug = canvas(L);
  const px = dados.data;
  const pr = rug.dados.data;
  const alt = new Float32Array(L * L);
  const [br, bg, bb] = rgb(base);
  for (let y = 0; y < L; y++) {
    for (let x = 0; x < L; x++) {
      const i = y * L + x;
      const u = x / L;
      const v = y / L;
      const mancha = fbm(r, u * 3, v * 3, 4, 3);
      const fino = fbm(r, u * 64 + 31, v * 64, 2, 64);
      const poro = fbm(r, u * 128 + 7, v * 128 + 3, 1, 128) > 0.86 ? 1 : 0;
      const k = 0.86 + (mancha - 0.5) * 0.22 + (fino - 0.5) * 0.06 - poro * 0.08;
      px[i * 4] = br * k;
      px[i * 4 + 1] = bg * k;
      px[i * 4 + 2] = bb * k;
      px[i * 4 + 3] = 255;
      const brilho = 150 + (mancha - 0.5) * 120 + poro * 60;
      pr[i * 4] = pr[i * 4 + 1] = pr[i * 4 + 2] = Math.max(60, Math.min(230, brilho));
      pr[i * 4 + 3] = 255;
      alt[i] = 0.5 + (fino - 0.5) * 0.4 - poro * 0.5;
    }
  }
  g.putImageData(dados, 0, 0);
  rug.g.putImageData(rug.dados, 0, 0);
  return { cor: paraTextura(c, true), normal: normaisDe(alt, L, L, 0.8), rugosidade: paraTextura(rug.c, false), metros: 4 };
}

/** gesso/massa corrida: quase liso, só um relevo bem leve que pega luz rasante */
export function normalGesso(semente: number) {
  const L = 256;
  const r = criarRuido(semente);
  const alt = new Float32Array(L * L);
  for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) alt[y * L + x] = fbm(r, (x / L) * 16, (y / L) * 16, 3, 16);
  return normaisDe(alt, L, L, 0.35);
}

/** ondinhas da água (normal que desliza com o tempo) */
export function normalAgua(semente: number) {
  const L = 256;
  const r = criarRuido(semente);
  const alt = new Float32Array(L * L);
  for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) alt[y * L + x] = fbm(r, (x / L) * 8, (y / L) * 8, 4, 8);
  return normaisDe(alt, L, L, 3);
}

/** gradiente vertical de céu para a cúpula (lado de cima = azul, horizonte claro) */
export function texturaCeu() {
  const c = document.createElement("canvas");
  c.width = 32;
  c.height = 512;
  const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, "#3f78c4");
  grad.addColorStop(0.35, "#79a8de");
  grad.addColorStop(0.5, "#cfe1f2");
  grad.addColorStop(0.52, "#e9eef2");
  grad.addColorStop(1, "#d9d6d0");
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** nuvens (alfa) para a cúpula, vistas pela claraboia */
export function texturaNuvens(semente: number) {
  const L = 512;
  const r = criarRuido(semente);
  const { c, g, dados } = canvas(L, L / 2);
  const px = dados.data;
  for (let y = 0; y < L / 2; y++) {
    for (let x = 0; x < L; x++) {
      const i = (y * L + x) * 4;
      const n = fbm(r, (x / L) * 8, (y / (L / 2)) * 4, 5, 8, 4);
      const a = Math.max(0, Math.min(1, (n - 0.52) * 3.2));
      px[i] = px[i + 1] = px[i + 2] = 255;
      px[i + 3] = a * 235;
    }
  }
  g.putImageData(dados, 0, 0);
  const t = paraTextura(c, true);
  t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// ---- escada rolante e elevador

/** inox escovado: riscos finos na horizontal (o brilho do metal varia risco a risco); 1 m por repetição */
export function texturasEscovado(semente: number) {
  const L = 512;
  const r = criarRuido(semente);
  const rug = canvas(L);
  const pr = rug.dados.data;
  const alt = new Float32Array(L * L);
  for (let y = 0; y < L; y++) {
    for (let x = 0; x < L; x++) {
      const i = y * L + x;
      // esticado no x: risco comprido e fino
      const n = fbm(r, (x / L) * 4, (y / L) * 256, 3, 4, 256);
      const m = fbm(r, (x / L) * 2 + 17, (y / L) * 2, 2, 2);
      alt[i] = n;
      const v = 92 + n * 36 + (m - 0.5) * 18;
      pr[i * 4] = pr[i * 4 + 1] = pr[i * 4 + 2] = Math.max(70, Math.min(150, v));
      pr[i * 4 + 3] = 255;
    }
  }
  rug.g.putImageData(rug.dados, 0, 0);
  return { rugosidade: paraTextura(rug.c, false), normal: normaisDe(alt, L, L, 0.6) };
}

/**
 * Pisada do degrau da escada rolante (256 × 512 = 0,385 × 1 m): alumínio com
 * os frisos no sentido do movimento e a faixa amarela de segurança nas bordas.
 */
export function texturasDegrau() {
  const A = 256; // profundidade (sentido do movimento)
  const B = 512; // largura do degrau
  const { c, g } = canvas(A, B);
  g.fillStyle = "#9da2a8";
  g.fillRect(0, 0, A, B);
  const alt = new Float32Array(A * B).fill(0.8);
  // frisos: um a cada 8 px (~1,6 cm), fundo mais escuro
  for (let y = 0; y < B; y += 8) {
    g.fillStyle = "#4b4f55";
    g.fillRect(0, y, A, 3);
    for (let yy = y; yy < Math.min(B, y + 3); yy++) for (let x = 0; x < A; x++) alt[yy * A + x] = 0.2;
  }
  // faixa amarela: na borda de trás e nos dois lados
  g.fillStyle = "#e5b22a";
  g.fillRect(A - 22, 0, 22, B);
  g.fillRect(0, 0, A, 18);
  g.fillRect(0, B - 18, A, 18);
  return { cor: paraTextura(c, true, false), normal: normaisDe(alt, A, B, 2.2) };
}

/** espelho (frente) do degrau: frisos verticais, alumínio mais escuro */
export function texturaEspelhoDegrau() {
  const { c, g } = canvas(512, 64);
  g.fillStyle = "#6b7077";
  g.fillRect(0, 0, 512, 64);
  g.fillStyle = "#3d4046";
  for (let x = 0; x < 512; x += 8) g.fillRect(x, 0, 3, 64);
  return paraTextura(c, true, false);
}

/** pente e chapa de piso das pontas: chapa xadrez de alumínio com os dentes amarelos do lado do degrau */
export function texturasChapa() {
  const L = 256;
  const { c, g } = canvas(L);
  g.fillStyle = "#a9adb3";
  g.fillRect(0, 0, L, L);
  const alt = new Float32Array(L * L).fill(0.3);
  // xadrez em diagonal (gomos de 2,5 cm)
  for (let y = 0; y < L; y += 16) {
    for (let x = (y / 16) % 2 ? 8 : 0; x < L; x += 16) {
      g.fillStyle = "#c9ccd1";
      g.beginPath();
      g.ellipse(x + 4, y + 4, 6, 2, Math.PI / 4, 0, Math.PI * 2);
      g.fill();
      for (let yy = -3; yy <= 3; yy++) for (let xx = -6; xx <= 6; xx++) {
        const px = Math.round(x + 4 + (xx - yy) * 0.7);
        const py = Math.round(y + 4 + (xx + yy) * 0.7);
        if (px >= 0 && py >= 0 && px < L && py < L) alt[py * L + px] = 0.9;
      }
    }
  }
  return { cor: paraTextura(c, true), normal: normaisDe(alt, L, L, 1.6) };
}

/** granito escuro polido (piso da cabine do elevador e base da torre); 1 m por repetição */
export function texturaGranito(semente: number) {
  const L = 512;
  const r = criarRuido(semente);
  const { c, g, dados } = canvas(L);
  const px = dados.data;
  for (let y = 0; y < L; y++) {
    for (let x = 0; x < L; x++) {
      const i = (y * L + x) * 4;
      const n = fbm(r, (x / L) * 16, (y / L) * 16, 3, 16);
      const grao = fbm(r, (x / L) * 128 + 5, (y / L) * 128, 1, 128);
      let v = 34 + n * 22;
      if (grao > 0.78) v = 150 + (grao - 0.78) * 400;
      else if (grao < 0.2) v = 18;
      px[i] = v;
      px[i + 1] = v * 0.98;
      px[i + 2] = v * 1.02;
      px[i + 3] = 255;
    }
  }
  g.putImageData(dados, 0, 0);
  return paraTextura(c, true);
}
