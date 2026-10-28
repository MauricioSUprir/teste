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
