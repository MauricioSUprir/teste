/**
 * Etiquetas de preço na borda das prateleiras, como numa loja de verdade:
 * "R$" pequeno, "59," grande e os centavos pequenos em cima; produto em promoção
 * ganha a etiqueta na cor da loja com o "-20%" na frente.
 *
 * Todas as etiquetas da loja são uma malha só: cada letra é um retângulo que
 * aponta para um atlas com os poucos caracteres de preço (0–9, R$, vírgula,
 * ponto, %, -), desenhado uma vez com a fonte do site. Preço chega em centavos
 * e só vira texto aqui, na ponta.
 *
 * As letras ficam a um milímetro do fundo e cortadas no tamanho da etiqueta
 * (sem camadas soltas). De cima a cena esconde as etiquetas.
 */
import * as THREE from "three";

export interface DadosEtiqueta {
  /** meio da borda de cima da etiqueta */
  pos: THREE.Vector3;
  /** para onde a etiqueta olha (o mesmo ângulo dos produtos) */
  ang: number;
  /** centavos */
  preco: number;
  /** % de desconto (null = sem promoção) */
  desconto: number | null;
}

const ALTURA = 0.042; // altura da etiqueta (m) — grande o bastante para ler o preço a 1,5 m
const MARGEM = 0.007;
const GRANDE = 0.028; // altura da letra grande
const PEQUENA = 0.0145;
const CARACTERES = "0123456789R$,.%-";
const CELULA_A = 128; // altura de cada célula do atlas (px)
const FONTE_PX = 104;
const LINHA_BASE = 100; // y da linha de base dentro da célula (px, de cima)
// na célula, o algarismo vai da linha de base até ~72% da fonte acima dela
const CELULA_POR_LETRA = CELULA_A / (FONTE_PX * 0.72);
const BASE_NA_CELULA = (CELULA_A - LINHA_BASE) / CELULA_A;

interface Glifo {
  u0: number;
  u1: number;
  v0: number;
  v1: number;
  /** largura / altura da célula */
  prop: number;
}

function montarAtlas(fonte: string) {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 256;
  const g = c.getContext("2d");
  if (!g) throw new Error("canvas");
  g.font = `700 ${FONTE_PX}px ${fonte}`;
  g.textBaseline = "alphabetic";
  g.fillStyle = "#ffffff";
  const glifos = new Map<string, Glifo>();
  let x = 4;
  for (const ch of CARACTERES) {
    const w = Math.ceil(g.measureText(ch).width) + 6;
    g.fillText(ch, x + 3, LINHA_BASE);
    glifos.set(ch, { u0: x / c.width, u1: (x + w) / c.width, v0: 1 - CELULA_A / c.height, v1: 1, prop: w / CELULA_A });
    x += w + 4;
  }
  // fundo da etiqueta: retângulo branco de cantos redondos na faixa de baixo
  g.beginPath();
  g.roundRect(8, 136, 240, 112, 18);
  g.fill();
  const fundo = { u0: 8 / c.width, u1: 248 / c.width, v0: 8 / c.height, v1: 120 / c.height };
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return { textura: t, glifos, fundo };
}

/** "R$", reais com a vírgula (ponto de milhar) e centavos, do jeito brasileiro */
function partes(centavos: number) {
  const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).formatToParts(centavos / 100);
  const moeda = fmt.find((p) => p.type === "currency")?.value ?? "R$";
  const reais = fmt
    .filter((p) => p.type === "integer" || p.type === "group")
    .map((p) => p.value)
    .join("");
  const virgula = fmt.find((p) => p.type === "decimal")?.value ?? ",";
  const cent = fmt.find((p) => p.type === "fraction")?.value ?? "00";
  return { moeda, reais: reais + virgula, centavos: cent };
}

export interface Etiquetas {
  malha: THREE.Mesh;
  /** refaz todas (preço mudou no painel) */
  refazer: (lista: DadosEtiqueta[]) => void;
  descartar: () => void;
}

export function criarEtiquetas(fonte: string, corPromo: THREE.Color): Etiquetas {
  const atlas = montarAtlas(fonte);
  const material = new THREE.MeshBasicMaterial({ map: atlas.textura, vertexColors: true, transparent: true, alphaTest: 0.05, color: new THREE.Color(0.92, 0.92, 0.92) });
  const malha = new THREE.Mesh(new THREE.BufferGeometry(), material);
  malha.renderOrder = 2;
  const corTexto = new THREE.Color("#26262c");
  const corFundo = new THREE.Color("#ffffff");
  const corBranca = new THREE.Color("#ffffff");

  function refazer(lista: DadosEtiqueta[]) {
    const pos: number[] = [];
    const uv: number[] = [];
    const cor: number[] = [];
    const idx: number[] = [];
    const quad = (
      e: DadosEtiqueta,
      x0: number,
      x1: number,
      y0: number,
      y1: number,
      frente: number,
      r: { u0: number; u1: number; v0: number; v1: number },
      c: THREE.Color
    ) => {
      // corta no retângulo da etiqueta (o resto da célula da letra é transparente)
      const ya = Math.max(y0, -ALTURA);
      const yb = Math.min(y1, 0);
      if (yb <= ya) return;
      const va = r.v0 + ((ya - y0) / (y1 - y0)) * (r.v1 - r.v0);
      const vb = r.v0 + ((yb - y0) / (y1 - y0)) * (r.v1 - r.v0);
      r = { ...r, v0: va, v1: vb };
      y0 = ya;
      y1 = yb;
      // x ao longo da borda (u da prateleira), y para cima, "frente" para fora
      const cs = Math.cos(e.ang);
      const sn = Math.sin(e.ang);
      const base = pos.length / 3;
      for (const [x, y, u, v] of [
        [x0, y0, r.u0, r.v0],
        [x1, y0, r.u1, r.v0],
        [x1, y1, r.u1, r.v1],
        [x0, y1, r.u0, r.v1],
      ]) {
        pos.push(e.pos.x + cs * x + sn * frente, e.pos.y + y, e.pos.z - sn * x + cs * frente);
        uv.push(u, v);
        cor.push(c.r, c.g, c.b);
      }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    };
    for (const e of lista) {
      const p = partes(e.preco);
      const promo = e.desconto !== null && e.desconto > 0;
      const textos: { s: string; a: number; topo: boolean }[] = [];
      if (promo) textos.push({ s: `-${e.desconto}%`, a: PEQUENA, topo: false });
      textos.push({ s: p.moeda, a: PEQUENA, topo: true }, { s: p.reais, a: GRANDE, topo: false }, { s: p.centavos, a: PEQUENA, topo: true });
      const larguraDe = (t: { s: string; a: number }) => [...t.s].reduce((w, ch) => w + (atlas.glifos.get(ch)?.prop ?? 0.5) * t.a * CELULA_POR_LETRA, 0);
      const espaco = 0.0025;
      const total = textos.reduce((w, t) => w + larguraDe(t), 0) + espaco * (textos.length - 1);
      const larg = Math.max(0.055, total + MARGEM * 2);
      quad(e, -larg / 2, larg / 2, -ALTURA, 0, 0, atlas.fundo, promo ? corPromo : corFundo);
      let x = -total / 2;
      const meio = -ALTURA / 2;
      for (const t of textos) {
        // a célula é mais alta que a letra; o pequeno de cima alinha pelo topo do grande
        const alturaCelula = t.a * CELULA_POR_LETRA;
        const linhaBase = t.topo ? meio + GRANDE / 2 - t.a : meio - t.a / 2;
        const y0 = linhaBase - alturaCelula * BASE_NA_CELULA;
        for (const ch of t.s) {
          const gl = atlas.glifos.get(ch);
          if (!gl) continue;
          const w = gl.prop * alturaCelula;
          quad(e, x, x + w, y0, y0 + alturaCelula, 0.001, gl, promo ? corBranca : corTexto);
          x += w;
        }
        x += espaco;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(cor, 3));
    geo.setIndex(idx);
    geo.computeBoundingSphere();
    malha.geometry.dispose();
    malha.geometry = geo;
  }

  return {
    malha,
    refazer,
    descartar: () => {
      malha.geometry.dispose();
      material.dispose();
      atlas.textura.dispose();
    },
  };
}
