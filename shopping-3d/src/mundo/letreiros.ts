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

export const COR_SHOPPING = { ameixa: "#3B1E54", rose: "#E8B4A0", creme: "#FBF6F1", dourado: "#C9A26B" };

export function canvasTextura(c: HTMLCanvasElement, anisotropia = 8) {
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

/** logo do shopping (para a entrada e a tela de LED) */
export function desenharLogoShopping(g: CanvasRenderingContext2D, cx: number, cy: number, h: number, cor = COR_SHOPPING.ameixa, destaque = COR_SHOPPING.dourado) {
  g.textBaseline = "middle";
  g.textAlign = "center";
  g.fillStyle = destaque;
  g.font = `500 ${h * 0.2}px ${FONTE}`;
  espacado(g, "SHOPPING DA", cx, cy - h * 0.36, h * 0.07, "center");
  g.fillStyle = cor;
  g.font = `italic 700 ${h * 0.62}px ${FONTE_TITULO}`;
  g.textAlign = "center";
  g.fillText("Beleza", cx, cy + h * 0.12);
  g.strokeStyle = destaque;
  g.lineWidth = Math.max(2, h * 0.02);
  const w = g.measureText("Beleza").width;
  g.beginPath();
  g.moveTo(cx - w * 0.42, cy + h * 0.5);
  g.lineTo(cx + w * 0.42, cy + h * 0.5);
  g.stroke();
}

export function letreiroEntrada(): HTMLCanvasElement {
  const { c, g } = novo(2048, 512);
  desenharLogoShopping(g, 1024, 236, 400, "#ffffff", COR_SHOPPING.rose);
  return c;
}

/** tela do totem: lojas abertas e as que estão para alugar */
export function telaTotem(ocupadas: { numero: string; nome: string; cor: string }[], vagas: string[]): HTMLCanvasElement {
  const { c, g } = novo(512, 1024);
  const grad = g.createLinearGradient(0, 0, 0, 1024);
  grad.addColorStop(0, "#2a1640");
  grad.addColorStop(1, "#4b2a63");
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 1024);
  g.fillStyle = "rgba(255,255,255,0.7)";
  g.textBaseline = "middle";
  g.textAlign = "center";
  g.font = `500 22px ${FONTE}`;
  g.fillText(textos.totem.bemVindo, 256, 70);
  desenharLogoShopping(g, 256, 160, 150, "#ffffff", COR_SHOPPING.rose);
  let y = 300;
  g.textAlign = "left";
  g.fillStyle = COR_SHOPPING.rose;
  g.font = `600 26px ${FONTE}`;
  g.fillText(textos.totem.lojas.toUpperCase(), 48, y);
  y += 56;
  for (const o of ocupadas) {
    g.fillStyle = o.cor;
    g.beginPath();
    g.roundRect(48, y - 22, 44, 44, 10);
    g.fill();
    g.fillStyle = "#ffffff";
    g.font = `600 30px ${FONTE}`;
    g.fillText(o.nome, 110, y);
    g.fillStyle = "rgba(255,255,255,0.6)";
    g.font = `500 22px ${FONTE}`;
    g.textAlign = "right";
    g.fillText(textos.aluguel.unidade(o.numero), 464, y);
    g.textAlign = "left";
    y += 72;
  }
  y += 30;
  g.fillStyle = COR_SHOPPING.rose;
  g.font = `600 26px ${FONTE}`;
  g.fillText(textos.totem.alugue.toUpperCase(), 48, y);
  y += 46;
  g.fillStyle = "rgba(255,255,255,0.75)";
  g.font = `500 22px ${FONTE}`;
  g.fillText(textos.totem.alugueTexto, 48, y);
  y += 50;
  g.font = `600 28px ${FONTE}`;
  g.fillStyle = "#ffffff";
  const linha = vagas.map((v) => v).join("  ·  ");
  g.fillText(linha, 48, y);
  return c;
}

/** tela de LED da praça (é redesenhada aos poucos) */
export function desenharLed(g: CanvasRenderingContext2D, l: number, a: number, t: number, lojas: { nome: string; cor: string; slogan: string }[]) {
  const fase = Math.floor(t / 7) % (lojas.length + 1);
  const k = (t % 7) / 7;
  const grad = g.createLinearGradient(0, 0, l, a);
  const base = fase === 0 ? COR_SHOPPING.ameixa : lojas[fase - 1].cor;
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
    desenharLogoShopping(g, l / 2, a * 0.42, a * 0.5, "#ffffff", COR_SHOPPING.rose);
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
