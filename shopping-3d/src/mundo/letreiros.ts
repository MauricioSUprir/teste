/**
 * Letreiros, adesivos e telas do shopping, desenhados em canvas com as fontes
 * da página (Poppins e Playfair Display). Cada marca do grupo tem o desenho
 * da própria identidade (as mesmas recriações do site); lojas montadas na
 * prévia usam o nome com a letra escolhida.
 */
import * as THREE from "three";
import type { Inquilino, Unidade } from "../dados/lojas";
import { textos } from "../copy/textos";

export const FONTE = "Poppins, system-ui, sans-serif";
export const FONTE_TITULO = "'Playfair Display', Georgia, serif";

export const COR_SHOPPING = { ameixa: "#3B1E54", rose: "#E8B4A0", creme: "#FBF6F1", dourado: "#C9A26B", roxo: "#7A2D9C", lilas: "#B89BD6", lilasClaro: "#EDE3F6" };

/** no celular, letreiros largos (1024 px ou mais) vão para a placa de vídeo em meia resolução */
let texturasLeves = false;
export function usarTexturasLeves(sim: boolean) {
  texturasLeves = sim;
}

/** `redesenha`: o canvas muda depois (telão) e precisa ir inteiro */
export function canvasTextura(c: HTMLCanvasElement, anisotropia = 8, redesenha = false) {
  if (texturasLeves && !redesenha && c.width >= 1024) {
    const m = document.createElement("canvas");
    m.width = Math.round(c.width / 2);
    m.height = Math.round(c.height / 2);
    m.getContext("2d")?.drawImage(c, 0, 0, m.width, m.height);
    c = m;
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = anisotropia;
  return t;
}

function novo(l: number, a: number) {
  const c = document.createElement("canvas");
  c.width = l;
  c.height = a;
  return { c, g: c.getContext("2d")! };
}

/** luminância relativa aproximada (para escolher texto claro ou escuro) */
export function ehEscura(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b < 150;
}

function espacado(g: CanvasRenderingContext2D, texto: string, x: number, y: number, espaco: number, alinhar: "left" | "center" = "left") {
  const larg = [...texto].reduce((s, ch) => s + g.measureText(ch).width + espaco, -espaco);
  let px = alinhar === "center" ? x - larg / 2 : x;
  g.textAlign = "left";
  for (const ch of texto) {
    g.fillText(ch, px, y);
    px += g.measureText(ch).width + espaco;
  }
  return larg;
}

/** marca desenhada num retângulo (cx, cy = centro; h = altura disponível) */
export function desenharMarca(g: CanvasRenderingContext2D, q: Pick<Inquilino, "nome" | "slogan" | "estilo">, cx: number, cy: number, h: number, corTexto?: string) {
  const e = q.estilo;
  g.textBaseline = "middle";
  if (e.letreiro === "beautynow") {
    // monograma "BN" num quadrado arredondado + "BEAUTY NOW"
    const lado = h * 0.78;
    g.font = `700 ${h * 0.5}px ${FONTE}`;
    const palavra = "BEAUTY NOW";
    const larg = lado + h * 0.3 + [...palavra].reduce((s, ch) => s + g.measureText(ch).width + h * 0.05, 0);
    let x = cx - larg / 2;
    g.fillStyle = e.primaria;
    g.beginPath();
    g.roundRect(x, cy - lado / 2, lado, lado, lado * 0.24);
    g.fill();
    g.fillStyle = "#ffffff";
    g.font = `800 ${lado * 0.5}px ${FONTE}`;
    g.textAlign = "center";
    g.fillText("BN", x + lado / 2, cy + lado * 0.03);
    x += lado + h * 0.3;
    g.fillStyle = corTexto ?? e.primaria;
    g.font = `700 ${h * 0.5}px ${FONTE}`;
    espacado(g, palavra, x, cy + h * 0.02, h * 0.05);
    return;
  }
  if (e.letreiro === "be2beauty") {
    g.fillStyle = corTexto ?? "#ffffff";
    g.font = `800 ${h * 0.56}px ${FONTE}`;
    const a = "BE2";
    g.textAlign = "left";
    const la = g.measureText(a).width;
    g.font = `300 ${h * 0.56}px ${FONTE}`;
    const lb = g.measureText("BEAUTY").width;
    const x = cx - (la + lb) / 2;
    g.font = `800 ${h * 0.56}px ${FONTE}`;
    g.fillText(a, x, cy - h * 0.1);
    g.font = `300 ${h * 0.56}px ${FONTE}`;
    g.fillText("BEAUTY", x + la, cy - h * 0.1);
    g.font = `500 ${h * 0.15}px ${FONTE}`;
    g.globalAlpha = 0.85;
    espacado(g, "ONLY PROFESSIONAL", cx, cy + h * 0.33, h * 0.07, "center");
    g.globalAlpha = 1;
    return;
  }
  if (e.letreiro === "pulse") {
    const r = h * 0.44;
    g.font = `700 ${h * 0.6}px ${FONTE}`;
    const lw = g.measureText("pulse.").width;
    const total = r * 2 + h * 0.35 + lw;
    const x0 = cx - total / 2;
    g.fillStyle = "#1c1714";
    g.strokeStyle = "rgba(217, 154, 78, 0.8)";
    g.lineWidth = h * 0.025;
    g.beginPath();
    g.arc(x0 + r, cy, r, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = "#f3ede6";
    g.font = `400 ${r * 0.34}px ${FONTE}`;
    espacado(g, "PULSE", x0 + r, cy + r * 0.02, r * 0.1, "center");
    const xt = x0 + r * 2 + h * 0.35;
    g.textAlign = "left";
    g.font = `700 ${h * 0.6}px ${FONTE}`;
    g.fillStyle = corTexto ?? "#f3ede6";
    g.fillText("pulse", xt, cy - h * 0.08);
    g.fillStyle = e.secundaria;
    g.fillText(".", xt + g.measureText("pulse").width, cy - h * 0.08);
    g.fillStyle = corTexto ?? "#f3ede6";
    g.globalAlpha = 0.8;
    g.font = `600 ${h * 0.13}px ${FONTE}`;
    espacado(g, "BEAUTY STORE", xt + h * 0.02, cy + h * 0.33, h * 0.07);
    g.globalAlpha = 1;
    return;
  }
  // lojas da prévia: o nome com a letra escolhida + a frase
  const claro = corTexto ?? (ehEscura(e.faixa) ? "#ffffff" : "#1d1b22");
  g.fillStyle = claro;
  g.textAlign = "center";
  const nome = e.letreiro === "forte" ? q.nome.toUpperCase() : q.nome;
  const fonte = e.letreiro === "classica" ? `italic 600 ${h * 0.56}px ${FONTE_TITULO}` : e.letreiro === "forte" ? `800 ${h * 0.5}px ${FONTE}` : `600 ${h * 0.54}px ${FONTE}`;
  g.font = fonte;
  const comFrase = !!q.slogan;
  g.fillText(nome, cx, cy - (comFrase ? h * 0.1 : 0));
  if (comFrase) {
    g.globalAlpha = 0.8;
    g.font = `500 ${h * 0.15}px ${FONTE}`;
    espacado(g, q.slogan.toUpperCase(), cx, cy + h * 0.34, h * 0.04, "center");
    g.globalAlpha = 1;
  }
}

/** faixa do letreiro da fachada (12 m × 1,1 m) */
export function letreiroFachada(q: Inquilino): HTMLCanvasElement {
  const { c, g } = novo(2048, 188);
  g.fillStyle = q.estilo.faixa;
  g.fillRect(0, 0, c.width, c.height);
  // filete de luz embaixo da faixa
  g.fillStyle = q.estilo.letreiro === "pulse" ? q.estilo.secundaria : q.estilo.primaria;
  g.globalAlpha = 0.9;
  g.fillRect(0, c.height - 8, c.width, 8);
  g.globalAlpha = 1;
  desenharMarca(g, q, c.width / 2, c.height / 2 - 2, 150);
  return c;
}

export function letreiroVago(u: Unidade): HTMLCanvasElement {
  const { c, g } = novo(2048, 188);
  const grad = g.createLinearGradient(0, 0, 0, c.height);
  grad.addColorStop(0, "#efe9e3");
  grad.addColorStop(1, "#e2d9d0");
  g.fillStyle = grad;
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = COR_SHOPPING.ameixa;
  g.textBaseline = "middle";
  g.font = `600 70px ${FONTE}`;
  espacado(g, `${textos.aluguel.unidade(u.numero).toUpperCase()}  ·  ${textos.aluguel.disponivel.toUpperCase()}`, c.width / 2, c.height / 2, 10, "center");
  return c;
}

/** adesivo "ALUGA-SE" na vitrine (fundo transparente) */
export function adesivoAluguel(u: Unidade): HTMLCanvasElement {
  const { c, g } = novo(1024, 640);
  g.textBaseline = "middle";
  g.fillStyle = "rgba(59, 30, 84, 0.86)";
  g.beginPath();
  g.roundRect(40, 60, 944, 520, 40);
  g.fill();
  g.strokeStyle = COR_SHOPPING.rose;
  g.lineWidth = 6;
  g.beginPath();
  g.roundRect(64, 84, 896, 472, 28);
  g.stroke();
  g.fillStyle = "#ffffff";
  g.font = `800 150px ${FONTE}`;
  espacado(g, textos.aluguel.aluga, 512, 240, 14, "center");
  g.fillStyle = COR_SHOPPING.rose;
  g.font = `italic 600 70px ${FONTE_TITULO}`;
  g.textAlign = "center";
  g.fillText(textos.aluguel.suaMarca, 512, 380);
  g.fillStyle = "rgba(255,255,255,0.85)";
  g.font = `500 40px ${FONTE}`;
  g.fillText(`${textos.aluguel.unidade(u.numero)} · ${u.area} m²`, 512, 470);
  return c;
}

/** cabeçalho de prateleira com o nome da marca */
export function cabecalhoMarca(nome: string, cor: string): HTMLCanvasElement {
  const { c, g } = novo(512, 96);
  g.fillStyle = cor;
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = ehEscura(cor) ? "#ffffff" : "#1d1b22";
  g.textBaseline = "middle";
  g.font = `600 44px ${FONTE}`;
  let t = nome.toUpperCase();
  while (g.measureText(t).width > 460 && t.length > 4) t = t.slice(0, -2) + "…";
  espacado(g, t, 256, 50, 4, "center");
  return c;
}

/** quadro grande da parede lateral: a marca e a frase */
export function quadroLoja(q: Inquilino): HTMLCanvasElement {
  const { c, g } = novo(1024, 1024);
  const e = q.estilo;
  const grad = g.createLinearGradient(0, 0, 1024, 1024);
  grad.addColorStop(0, e.primaria);
  grad.addColorStop(1, e.letreiro === "pulse" ? "#3a2b22" : shade(e.primaria, -0.35));
  g.fillStyle = grad;
  g.fillRect(0, 0, 1024, 1024);
  // arcos suaves de fundo
  g.globalAlpha = 0.12;
  g.strokeStyle = "#ffffff";
  for (let i = 0; i < 9; i++) {
    g.lineWidth = 3 + i;
    g.beginPath();
    g.arc(1024, 1024, 220 + i * 95, Math.PI, Math.PI * 1.5);
    g.stroke();
  }
  g.globalAlpha = 1;
  desenharMarca(g, { ...q, estilo: { ...e, faixa: e.primaria } }, 512, 430, 190, "#ffffff");
  g.fillStyle = "rgba(255,255,255,0.9)";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = `italic 500 64px ${FONTE_TITULO}`;
  if (q.slogan && e.letreiro !== "be2beauty" && e.letreiro !== "pulse") g.fillText(q.slogan, 512, 640);
  g.font = `500 34px ${FONTE}`;
  g.globalAlpha = 0.75;
  espacado(g, textos.shopping.nome.toUpperCase(), 512, 900, 8, "center");
  g.globalAlpha = 1;
  return c;
}

export function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k))));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

// ---- marca do shopping (Beauty Shopping): as imagens do logo, baixadas antes de montar o prédio

type ImagemMarca = "logo-roxo" | "logo-branco" | "folhas-roxo" | "folhas-branco" | "nome-roxo" | "nome-branco";
const imagensMarca = new Map<ImagemMarca, HTMLImageElement>();

/** baixa as imagens do logo (public/marca); sem elas, os letreiros saem com o nome escrito */
export async function carregarMarca(base = "./marca/") {
  const nomes: ImagemMarca[] = ["logo-roxo", "logo-branco", "folhas-roxo", "folhas-branco", "nome-roxo", "nome-branco"];
  await Promise.all(
    nomes.map(
      (n) =>
        new Promise<void>((ok) => {
          const img = new Image();
          img.onload = () => {
            imagensMarca.set(n, img);
            ok();
          };
          img.onerror = () => ok();
          img.src = `${base}${n}.png`;
        })
    )
  );
}

/** desenha uma imagem da marca com altura h, centrada em (cx, cy); devolve a largura (0 se não baixou) */
export function desenharImagemMarca(g: CanvasRenderingContext2D, nome: ImagemMarca, cx: number, cy: number, h: number) {
  const img = imagensMarca.get(nome);
  if (!img) return 0;
  const w = (h * img.naturalWidth) / img.naturalHeight;
  g.drawImage(img, cx - w / 2, cy - h / 2, w, h);
  return w;
}

/** logo do shopping, centrado em (cx, cy), com altura h (a largura é ~3,7 h) */
export function desenharLogoShopping(g: CanvasRenderingContext2D, cx: number, cy: number, h: number, claro = false) {
  if (desenharImagemMarca(g, claro ? "logo-branco" : "logo-roxo", cx, cy, h)) return;
  g.fillStyle = claro ? "#ffffff" : COR_SHOPPING.roxo;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = `300 ${h * 0.42}px ${FONTE}`;
  espacado(g, "BEAUTY", cx, cy - h * 0.24, h * 0.04, "center");
  g.font = `400 ${h * 0.42}px ${FONTE}`;
  espacado(g, "SHOPPING", cx, cy + h * 0.26, h * 0.02, "center");
}

/** seta simples (para o totem de pisos) */
function seta(g: CanvasRenderingContext2D, x: number, y: number, t: number, cor: string) {
  g.strokeStyle = cor;
  g.lineWidth = t * 0.16;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(x, y + t * 0.5);
  g.lineTo(x, y - t * 0.5);
  g.moveTo(x - t * 0.32, y - t * 0.18);
  g.lineTo(x, y - t * 0.5);
  g.lineTo(x + t * 0.32, y - t * 0.18);
  g.stroke();
}

/** tela do totem: o logo, os três pisos, as lojas abertas e as que estão para alugar */
export function telaTotem(ocupadas: { numero: string; nome: string; cor: string }[], vagas: string[]): HTMLCanvasElement {
  const { c, g } = novo(512, 1024);
  const grad = g.createLinearGradient(0, 0, 0, 1024);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(1, "#f1e9f8");
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 1024);
  g.strokeStyle = COR_SHOPPING.roxo;
  g.lineWidth = 10;
  g.strokeRect(5, 5, 502, 1014);
  desenharLogoShopping(g, 256, 92, 92);
  g.fillStyle = COR_SHOPPING.lilas;
  g.fillRect(40, 168, 432, 3);
  let y = 212;
  g.textBaseline = "middle";
  for (const p of textos.totem.pisos) {
    g.textAlign = "left";
    g.fillStyle = COR_SHOPPING.roxo;
    g.font = `700 30px ${FONTE}`;
    g.fillText(p.piso.toUpperCase(), 44, y);
    g.fillStyle = "#2b2233";
    g.font = `600 25px ${FONTE}`;
    g.fillText(p.titulo, 44, y + 38);
    g.fillStyle = "rgba(43,34,51,0.62)";
    g.font = `500 19px ${FONTE}`;
    g.fillText(p.texto, 44, y + 70);
    seta(g, 448, y + 30, 36, COR_SHOPPING.roxo);
    y += 128;
    g.fillStyle = "rgba(122,45,156,0.18)";
    g.fillRect(40, y - 22, 432, 2);
  }
  y += 18;
  g.fillStyle = COR_SHOPPING.roxo;
  g.font = `600 24px ${FONTE}`;
  g.textAlign = "left";
  g.fillText(textos.totem.lojas.toUpperCase(), 44, y);
  y += 50;
  for (const o of ocupadas) {
    g.fillStyle = o.cor;
    g.beginPath();
    g.roundRect(44, y - 18, 36, 36, 9);
    g.fill();
    g.fillStyle = "#2b2233";
    g.font = `600 26px ${FONTE}`;
    g.textAlign = "left";
    g.fillText(o.nome, 96, y);
    g.fillStyle = "rgba(43,34,51,0.55)";
    g.font = `500 19px ${FONTE}`;
    g.textAlign = "right";
    g.fillText(textos.aluguel.unidade(o.numero), 468, y);
    y += 54;
  }
  y += 16;
  g.textAlign = "left";
  g.fillStyle = COR_SHOPPING.roxo;
  g.font = `600 24px ${FONTE}`;
  g.fillText(textos.totem.alugue.toUpperCase(), 44, y);
  y += 38;
  g.fillStyle = "rgba(43,34,51,0.7)";
  g.font = `500 20px ${FONTE}`;
  g.fillText(textos.totem.alugueTexto, 44, y);
  y += 40;
  g.font = `600 24px ${FONTE}`;
  g.fillStyle = "#2b2233";
  g.fillText(vagas.join("  ·  "), 44, y);
  return c;
}

/** tela de LED (é redesenhada aos poucos): o logo e, em seguida, cada loja aberta */
export function desenharLed(g: CanvasRenderingContext2D, l: number, a: number, t: number, lojas: { nome: string; cor: string; slogan: string }[]) {
  const fase = Math.floor(t / 7) % (lojas.length + 1);
  const k = (t % 7) / 7;
  const grad = g.createLinearGradient(0, 0, l, a);
  const base = fase === 0 ? COR_SHOPPING.roxo : lojas[fase - 1].cor;
  grad.addColorStop(0, base);
  grad.addColorStop(1, shade(base, -0.5));
  g.fillStyle = grad;
  g.fillRect(0, 0, l, a);
  // brilho que passa
  const x = (k * 1.6 - 0.3) * l;
  const brilho = g.createLinearGradient(x - l * 0.15, 0, x + l * 0.15, 0);
  brilho.addColorStop(0, "rgba(255,255,255,0)");
  brilho.addColorStop(0.5, "rgba(255,255,255,0.12)");
  brilho.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = brilho;
  g.fillRect(0, 0, l, a);
  g.textAlign = "center";
  g.textBaseline = "middle";
  if (fase === 0) {
    desenharLogoShopping(g, l / 2, a * 0.42, a * 0.42, true);
    g.fillStyle = "rgba(255,255,255,0.9)";
    g.font = `500 ${a * 0.075}px ${FONTE}`;
    g.fillText(textos.led.linha2, l / 2, a * 0.84);
  } else {
    const q = lojas[fase - 1];
    g.fillStyle = "#ffffff";
    g.font = `700 ${a * 0.2}px ${FONTE}`;
    g.fillText(q.nome, l / 2, a * 0.42);
    g.font = `italic 500 ${a * 0.09}px ${FONTE_TITULO}`;
    g.globalAlpha = 0.9;
    g.fillText(q.slogan, l / 2, a * 0.66);
    g.globalAlpha = 1;
  }
}

// ---- pisos 2 e 3: vitrines acesas (atlas com 8 fachadas de ~10 × 5 m)

/** cores do interior de cada categoria (paredes, prateleiras e o tom dos produtos) */
const TONS_CATEGORIA = [
  { fundo: "#f8efe2", destaque: "#c99a5b", produtos: ["#d8b27a", "#8b5a2b", "#f1d9a8", "#b8865a"] }, // perfumaria
  { fundo: "#fbecef", destaque: "#d3607f", produtos: ["#e66a8c", "#3b1e2a", "#f3b6c4", "#b23a5a"] }, // maquiagem
  { fundo: "#eef6f1", destaque: "#6fae95", produtos: ["#9dd0bb", "#ffffff", "#5e9c83", "#dcefe6"] }, // skincare
  { fundo: "#f3ecfa", destaque: "#8f5cc2", produtos: ["#b48fd8", "#5b2f78", "#e3d3f3", "#7a2d9c"] }, // cabelos
  { fundo: "#fdeee8", destaque: "#e07a5f", produtos: ["#f2a28b", "#c8553d", "#ffd6c9", "#9e3b2a"] }, // unhas
  { fundo: "#edf3fa", destaque: "#6b9bd1", produtos: ["#a9c6e8", "#ffffff", "#4f7cb0", "#dbe7f5"] }, // estética
  { fundo: "#f0f4ea", destaque: "#8aa26a", produtos: ["#b9c99d", "#6d8450", "#e7eedb", "#a3b58a"] }, // spa
  { fundo: "#f7f1ea", destaque: "#b89a6b", produtos: ["#d9c3a0", "#2b2233", "#efe3cf", "#9c7f52"] }, // acessórios
];

export const CELULAS_ATLAS = { colunas: 2, linhas: 4, largura: 1024, altura: 512 };

/** interior aceso visto pelo vidro: parede do fundo, prateleiras com produtos, mesa no meio, luzes */
function interiorAceso(g: CanvasRenderingContext2D, x0: number, y0: number, l: number, a: number, tom: (typeof TONS_CATEGORIA)[number], semente: number) {
  let s = semente;
  const acaso = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const grad = g.createLinearGradient(0, y0, 0, y0 + a);
  grad.addColorStop(0, "#fffaf3");
  grad.addColorStop(0.55, tom.fundo);
  grad.addColorStop(1, shade(tom.fundo, -0.12));
  g.fillStyle = grad;
  g.fillRect(x0, y0, l, a);
  // prateleiras no fundo, com produtos coloridos
  const baias = 5;
  const lb = l / baias;
  for (let b = 0; b < baias; b++) {
    if (b === 2) continue; // no meio, a porta e a mesa
    const bx = x0 + b * lb + lb * 0.08;
    g.fillStyle = "rgba(255,255,255,0.75)";
    g.fillRect(bx, y0 + a * 0.12, lb * 0.84, a * 0.6);
    for (let pr = 0; pr < 4; pr++) {
      const py = y0 + a * (0.2 + pr * 0.14);
      g.fillStyle = shade(tom.destaque, 0.55);
      g.fillRect(bx, py + a * 0.07, lb * 0.84, a * 0.012);
      for (let k = 0; k < 7; k++) {
        const pw = lb * 0.07;
        const ph = a * (0.045 + acaso() * 0.035);
        g.fillStyle = tom.produtos[Math.floor(acaso() * tom.produtos.length)];
        g.fillRect(bx + lb * 0.05 + k * lb * 0.115, py + a * 0.07 - ph, pw, ph);
      }
    }
    // faixa da marca em cima da gôndola
    g.fillStyle = tom.destaque;
    g.fillRect(bx, y0 + a * 0.12, lb * 0.84, a * 0.035);
  }
  // mesa de destaques no meio e uma pessoa olhando (silhueta)
  const mx = x0 + l * 0.5;
  g.fillStyle = shade(tom.destaque, 0.3);
  g.beginPath();
  g.ellipse(mx, y0 + a * 0.78, lb * 0.42, a * 0.05, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = shade(tom.destaque, -0.1);
  g.fillRect(mx - lb * 0.22, y0 + a * 0.78, lb * 0.44, a * 0.16);
  for (const [px, cor] of [
    [x0 + l * (0.25 + acaso() * 0.12), "rgba(60,44,70,0.55)"],
    [x0 + l * (0.66 + acaso() * 0.1), "rgba(80,56,64,0.5)"],
  ] as [number, string][]) {
    g.fillStyle = cor;
    g.beginPath();
    g.arc(px, y0 + a * 0.5, a * 0.04, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.roundRect(px - a * 0.05, y0 + a * 0.55, a * 0.1, a * 0.38, a * 0.03);
    g.fill();
  }
  // luzes do teto (pontos fortes) e o brilho que elas fazem
  for (let k = 0; k < 6; k++) {
    const lx = x0 + l * (0.09 + k * 0.165);
    const halo = g.createRadialGradient(lx, y0 + a * 0.03, 0, lx, y0 + a * 0.03, a * 0.22);
    halo.addColorStop(0, "rgba(255,255,255,0.95)");
    halo.addColorStop(0.15, "rgba(255,246,230,0.5)");
    halo.addColorStop(1, "rgba(255,240,220,0)");
    g.fillStyle = halo;
    g.fillRect(lx - a * 0.22, y0, a * 0.44, a * 0.25);
  }
  // reflexo no vidro: faixas diagonais claras
  g.save();
  g.beginPath();
  g.rect(x0, y0, l, a);
  g.clip();
  g.globalAlpha = 0.14;
  g.fillStyle = "#ffffff";
  for (let k = 0; k < 3; k++) {
    const rx = x0 + l * (0.1 + k * 0.33 + acaso() * 0.05);
    g.beginPath();
    g.moveTo(rx, y0);
    g.lineTo(rx + l * 0.08, y0);
    g.lineTo(rx - l * 0.06, y0 + a);
    g.lineTo(rx - l * 0.14, y0 + a);
    g.fill();
  }
  g.restore();
}

/**
 * Atlas das fachadas dos pisos de cima (2 colunas × 4 linhas de 1024 × 512):
 * 0–5 lojas "em breve" por categoria, 6 "Sua marca aqui · Aluga-se", 7 parede com o logo.
 */
export function atlasVitrines(): HTMLCanvasElement {
  const { colunas, linhas, largura: L, altura: A } = CELULAS_ATLAS;
  const { c, g } = novo(L * colunas, A * linhas);
  const cats = textos.andares.categorias;
  for (let i = 0; i < colunas * linhas; i++) {
    const x0 = (i % colunas) * L;
    const y0 = Math.floor(i / colunas) * A;
    // parede branca em volta
    g.fillStyle = "#f7f4f8";
    g.fillRect(x0, y0, L, A);
    const faixa = A * 0.17;
    if (i < 6) {
      const tom = TONS_CATEGORIA[i % TONS_CATEGORIA.length];
      interiorAceso(g, x0 + 18, y0 + faixa + 14, L - 36, A - faixa - 34, tom, 17 + i * 31);
      // caixilhos do vidro e a porta no meio
      g.fillStyle = "rgba(40,36,44,0.75)";
      for (let k = 0; k <= 4; k++) g.fillRect(x0 + 18 + ((L - 36) * k) / 4 - 3, y0 + faixa + 14, 6, A - faixa - 34);
      g.fillRect(x0 + 18, y0 + faixa + 10, L - 36, 6);
      // faixa do letreiro: categoria + "em breve"
      g.fillStyle = "#ffffff";
      g.fillRect(x0 + 18, y0 + 12, L - 36, faixa - 8);
      g.fillStyle = tom.destaque;
      g.fillRect(x0 + 18, y0 + faixa, L - 36, 5);
      g.fillStyle = COR_SHOPPING.ameixa;
      g.textBaseline = "middle";
      g.font = `600 46px ${FONTE}`;
      const nome = cats[i % cats.length].toUpperCase();
      const lt = espacado(g, nome, x0 + L / 2 - 70, y0 + faixa / 2 + 6, 9, "center");
      g.fillStyle = COR_SHOPPING.lilas;
      g.beginPath();
      g.roundRect(x0 + L / 2 - 70 + lt / 2 + 26, y0 + faixa / 2 - 14, 128, 40, 20);
      g.fill();
      g.fillStyle = "#ffffff";
      g.font = `600 20px ${FONTE}`;
      g.textAlign = "center";
      g.fillText(textos.andares.emBreve.toUpperCase(), x0 + L / 2 - 70 + lt / 2 + 90, y0 + faixa / 2 + 7);
    } else if (i === 6) {
      // vidro jateado com adesivo lilás: "Sua marca aqui · Aluga-se"
      const grad = g.createLinearGradient(0, y0, 0, y0 + A);
      grad.addColorStop(0, "#f6f1fa");
      grad.addColorStop(1, "#e7dcf0");
      g.fillStyle = grad;
      g.fillRect(x0 + 18, y0 + 18, L - 36, A - 36);
      g.fillStyle = "rgba(40,36,44,0.6)";
      for (let k = 0; k <= 4; k++) g.fillRect(x0 + 18 + ((L - 36) * k) / 4 - 3, y0 + 18, 6, A - 36);
      g.fillStyle = "rgba(122,45,156,0.9)";
      g.beginPath();
      g.roundRect(x0 + L * 0.2, y0 + A * 0.26, L * 0.6, A * 0.48, 26);
      g.fill();
      desenharImagemMarca(g, "folhas-branco", x0 + L * 0.29, y0 + A * 0.5, A * 0.3);
      g.fillStyle = "#ffffff";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.font = `600 52px ${FONTE}`;
      g.fillText(textos.andares.suaMarca, x0 + L * 0.56, y0 + A * 0.44);
      g.font = `500 34px ${FONTE}`;
      g.globalAlpha = 0.9;
      espacado(g, textos.andares.aluga.toUpperCase(), x0 + L * 0.56, y0 + A * 0.58, 8, "center");
      g.globalAlpha = 1;
    } else {
      // parede do logo: aletas lilás nas pontas e o logo no meio
      g.fillStyle = "#ffffff";
      g.fillRect(x0, y0, L, A);
      for (const lado of [0, 1]) {
        const fx = x0 + (lado ? L - 190 : 20);
        for (let k = 0; k < 7; k++) {
          g.fillStyle = k % 2 ? "#c7acdf" : COR_SHOPPING.roxo;
          g.fillRect(fx + k * 24, y0 + 20, 16, A - 40);
        }
      }
      desenharLogoShopping(g, x0 + L / 2, y0 + A / 2, A * 0.34);
    }
  }
  return c;
}

/** faixa da coroa da fachada (36 × 5,5 m): branca com o logo grande no meio e o filete de luz embaixo */
export function bandaFachada(): HTMLCanvasElement {
  const { c, g } = novo(4096, 600);
  const grad = g.createLinearGradient(0, 0, 0, 600);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(1, "#f1ebf5");
  g.fillStyle = grad;
  g.fillRect(0, 0, 4096, 600);
  desenharLogoShopping(g, 2048, 290, 430);
  g.fillStyle = COR_SHOPPING.lilas;
  g.fillRect(0, 586, 4096, 14);
  return c;
}

/** bandeira pendurada no átrio (2,2 × 6,6 m): folhas e o nome em roxo sobre branco-lilás */
export function bandeira(): HTMLCanvasElement {
  const { c, g } = novo(512, 1536);
  const grad = g.createLinearGradient(0, 0, 0, 1536);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(1, "#eee4f6");
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 1536);
  g.fillStyle = COR_SHOPPING.roxo;
  g.fillRect(0, 0, 512, 26);
  g.fillRect(0, 1510, 512, 26);
  if (!desenharImagemMarca(g, "folhas-roxo", 256, 520, 300)) desenharLogoShopping(g, 256, 520, 110);
  desenharImagemMarca(g, "nome-roxo", 256, 820, 136);
  g.fillStyle = COR_SHOPPING.lilas;
  g.fillRect(150, 950, 212, 4);
  return c;
}

/** janelas acesas das alas da fachada (12 × 3 m, repete na horizontal) */
export function janelasAcesas(): HTMLCanvasElement {
  const { c, g } = novo(1024, 256);
  const tom = TONS_CATEGORIA[3];
  interiorAceso(g, 0, 0, 1024, 256, { ...tom, fundo: "#f6ede6" }, 77);
  g.fillStyle = "rgba(235,232,238,0.9)";
  for (let k = 0; k <= 6; k++) g.fillRect((1024 * k) / 6 - 5, 0, 10, 256);
  g.fillRect(0, 0, 1024, 8);
  g.fillRect(0, 248, 1024, 8);
  return c;
}
