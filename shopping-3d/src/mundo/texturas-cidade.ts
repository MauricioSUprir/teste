/**
 * Texturas da cidade em volta da loja 3D (cidade.ts), desenhadas no navegador.
 * Cada uma vem em três camadas: cor, relevo (vira mapa de normais) e brilho
 * (rugosidade: vidro liso, reboco áspero). É o que deixa a janela funda, o
 * peitoril saltado e o vidro refletindo o céu quando o sol bate.
 *
 * Medidas em metros: a fachada cobre 24 m (4 vãos de 6 m) × 12 m (4 andares
 * de 3 m); o térreo, 48 × 4,5 m com oito lojinhas; a pele de vidro, 24 × 12 m.
 */
import * as THREE from "three";
import { normaisDe } from "./texturas";

export interface TexturaPbr {
  cor: THREE.CanvasTexture;
  normal: THREE.CanvasTexture;
  rugosidade: THREE.CanvasTexture;
}

function sorteio(semente: number) {
  let s = semente;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

type Cor = string | ((g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => CanvasGradient | string);

/** desenha nas três camadas ao mesmo tempo, em metros (y de baixo para cima, como na parede) */
class Pintor {
  readonly cor: CanvasRenderingContext2D;
  readonly alt: CanvasRenderingContext2D;
  readonly rug: CanvasRenderingContext2D;
  readonly mx: number;
  readonly my: number;
  constructor(
    readonly w: number,
    readonly h: number,
    metrosL: number,
    readonly metrosA: number,
    base: { cor: string; alt: number; rug: number }
  ) {
    const ctx = () => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const g = c.getContext("2d", { willReadFrequently: true });
      if (!g) throw new Error("canvas");
      return g;
    };
    this.cor = ctx();
    this.alt = ctx();
    this.rug = ctx();
    this.mx = w / metrosL;
    this.my = h / metrosA;
    this.ret(0, 0, metrosL, metrosA, base);
  }
  /** retângulo em metros; alt e rug de 0 a 1 */
  ret(x: number, y: number, l: number, a: number, o: { cor?: Cor; alt?: number; rug?: number }) {
    const X = x * this.mx;
    const Y = this.h - (y + a) * this.my;
    const W = l * this.mx;
    const H = a * this.my;
    if (o.cor !== undefined) {
      this.cor.fillStyle = typeof o.cor === "string" ? o.cor : o.cor(this.cor, X, Y, W, H);
      this.cor.fillRect(X, Y, W, H);
    }
    const cinza = (v: number) => {
      const n = Math.round(THREE.MathUtils.clamp(v, 0, 1) * 255);
      return `rgb(${n},${n},${n})`;
    };
    if (o.alt !== undefined) {
      this.alt.fillStyle = cinza(o.alt);
      this.alt.fillRect(X, Y, W, H);
    }
    if (o.rug !== undefined) {
      this.rug.fillStyle = cinza(o.rug);
      this.rug.fillRect(X, Y, W, H);
    }
  }
  /** degradê vertical (de cima para baixo) para usar como cor */
  static vertical(cima: string, baixo: string): Cor {
    return (g, _x, y, _w, h) => {
      const gr = g.createLinearGradient(0, y, 0, y + h);
      gr.addColorStop(0, cima);
      gr.addColorStop(1, baixo);
      return gr;
    };
  }
  /** grão na cor, relevo suavizado (borda vira chanfro, que pega luz) e as três texturas */
  fim(o: { relevo: number; grao: number; suaviza: number; anisotropia: number; semente: number }): TexturaPbr {
    const { w, h } = this;
    const acaso = sorteio(o.semente);
    const img = this.cor.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const k = 1 + (acaso() - 0.5) * o.grao;
      d[i] = Math.min(255, d[i] * k);
      d[i + 1] = Math.min(255, d[i + 1] * k);
      d[i + 2] = Math.min(255, d[i + 2] * k);
    }
    this.cor.putImageData(img, 0, 0);
    const a = this.alt.getImageData(0, 0, w, h).data;
    let altura: Float32Array = new Float32Array(w * h);
    for (let i = 0; i < altura.length; i++) altura[i] = a[i * 4] / 255 + (acaso() - 0.5) * 0.006;
    for (let p = 0; p < 2; p++) altura = borrar(altura, w, h, o.suaviza);
    const textura = (c: HTMLCanvasElement, srgb: boolean) => {
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = o.anisotropia;
      return t;
    };
    const normal = normaisDe(altura, w, h, o.relevo);
    normal.anisotropy = o.anisotropia;
    return { cor: textura(this.cor.canvas, true), normal, rugosidade: textura(this.rug.canvas, false) };
  }
}

/** média móvel em x e em y (com volta nas bordas: a textura se repete) */
function borrar(v: Float32Array, w: number, h: number, r: number): Float32Array {
  if (r < 1) return v;
  const tmp = new Float32Array(v.length);
  const out = new Float32Array(v.length);
  const n = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    let soma = 0;
    for (let k = -r; k <= r; k++) soma += v[y * w + ((k + w) % w)];
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = soma / n;
      soma += v[y * w + ((x + r + 1) % w)] - v[y * w + ((x - r + w) % w)];
    }
  }
  for (let x = 0; x < w; x++) {
    let soma = 0;
    for (let k = -r; k <= r; k++) soma += tmp[((k + h) % h) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = soma / n;
      soma += tmp[((y + r + 1) % h) * w + x] - tmp[((y - r + h) % h) * w + x];
    }
  }
  return out;
}

/** manchas de chuva escorrendo abaixo de `y` (em metros) */
function escorrido(p: Pintor, x: number, y: number, l: number, comp: number, forca: number) {
  p.ret(x, y - comp, l, comp, {
    cor: (g, _x, Y, _w, H) => {
      const gr = g.createLinearGradient(0, Y, 0, Y + H);
      gr.addColorStop(0, `rgba(70,62,52,${forca})`);
      gr.addColorStop(1, "rgba(70,62,52,0)");
      return gr;
    },
  });
}

/**
 * Fachada de prédio residencial do Rio: reboco claro (a cor do prédio vem do
 * vértice), janelas fundas com caixilho de alumínio, peitoril, varandas com
 * grade, ar-condicionado de janela, cortinas e persianas, laje marcada e o
 * escorrido da chuva embaixo dos peitoris.
 */
export function texturasFachada(lado: number, anisotropia: number): TexturaPbr {
  const acaso = sorteio(41);
  const p = new Pintor(lado, lado / 2, 24, 12, { cor: "#f2eee7", alt: 0.5, rug: 0.92 });
  // reboco: manchas grandes bem fracas
  for (let k = 0; k < 160; k++) {
    const x = acaso() * 24;
    const y = acaso() * 12;
    const r = 0.4 + acaso() * 1.6;
    const tom = acaso() < 0.5 ? "120,110,95" : "255,255,255";
    p.ret(x - r, y - r, r * 2, r * 2, {
      cor: (g, X, Y, W, H) => {
        const gr = g.createRadialGradient(X + W / 2, Y + H / 2, 0, X + W / 2, Y + H / 2, W / 2);
        gr.addColorStop(0, `rgba(${tom},0.05)`);
        gr.addColorStop(1, `rgba(${tom},0)`);
        return gr;
      },
    });
  }
  for (let andar = 0; andar < 4; andar++) {
    const y0 = andar * 3;
    // laje: faixa um pouco saltada e mais clara
    p.ret(0, y0, 24, 0.2, { cor: "#e7e2d9", alt: 0.62, rug: 0.85 });
    p.ret(0, y0 - 0.05, 24, 0.05, { cor: "rgba(60,55,48,0.12)" });
    for (let vao = 0; vao < 4; vao++) {
      const x0 = vao * 6;
      // cano de descida de água num canto, às vezes
      if (vao === 0 && andar === 0) for (let a2 = 0; a2 < 4; a2++) p.ret(0.12, a2 * 3, 0.1, 3, { cor: "#d3cec6", alt: 0.78, rug: 0.6 });
      for (const lado2 of [0, 1]) {
        const jx = x0 + 0.9 + lado2 * 2.7; // duas janelas por vão
        const jl = 1.5;
        const varanda = andar > 0 && acaso() < 0.35;
        const jy = y0 + (varanda ? 0.3 : 0.95);
        const ja = y0 + 2.45 - jy;
        // vão da janela (fundo, com sombra no alto e nos lados)
        p.ret(jx - 0.06, jy - 0.02, jl + 0.12, ja + 0.08, { cor: "#bdb6aa", alt: 0.26, rug: 0.8 });
        p.ret(jx - 0.06, jy + ja - 0.1, jl + 0.12, 0.16, { cor: Pintor.vertical("rgba(40,36,30,0.55)", "rgba(40,36,30,0)") });
        // caixilho
        const branco = acaso() < 0.7;
        const caixilho = branco ? "#ecebe6" : "#8d8f92";
        p.ret(jx, jy, jl, ja, { cor: caixilho, alt: 0.36, rug: 0.35 });
        // vidro (ou o que tem atrás dele)
        const tipo = acaso();
        const vx = jx + 0.06;
        const vy = jy + 0.06;
        const vl = jl - 0.12;
        const va = ja - 0.12;
        if (tipo < 0.12) {
          p.ret(vx, vy, vl, va, { cor: Pintor.vertical("#2a2e33", "#3d4348"), alt: 0.3, rug: 0.5 }); // aberta, escuro dentro
        } else {
          p.ret(vx, vy, vl, va, { cor: Pintor.vertical("#8fa9bd", "#d6e1e8"), alt: 0.32, rug: 0.06 });
          // reflexo diagonal
          p.ret(vx, vy, vl, va, {
            cor: (g, X, Y, W, H) => {
              const gr = g.createLinearGradient(X, Y, X + W, Y + H);
              gr.addColorStop(0, "rgba(255,255,255,0)");
              gr.addColorStop(0.45, "rgba(255,255,255,0.22)");
              gr.addColorStop(0.55, "rgba(255,255,255,0)");
              return gr;
            },
          });
          if (tipo < 0.32) {
            // persiana
            for (let l = vy; l < vy + va; l += 0.06) p.ret(vx, l, vl, 0.035, { cor: "rgba(232,226,212,0.92)", rug: 0.7 });
          } else if (tipo < 0.58) {
            // cortina de um lado
            const cl = vl * (0.35 + acaso() * 0.3);
            const cx = acaso() < 0.5 ? vx : vx + vl - cl;
            const tom = ["#efe6d2", "#e3d3bd", "#d9e1e6", "#e8d8d0"][Math.floor(acaso() * 4)];
            p.ret(cx, vy, cl, va, { cor: tom, rug: 0.85 });
            for (let f = cx; f < cx + cl; f += 0.12) p.ret(f, vy, 0.04, va, { cor: "rgba(120,100,80,0.12)" });
          }
        }
        // montante no meio (janela de correr)
        p.ret(jx + jl / 2 - 0.025, jy, 0.05, ja, { cor: caixilho, alt: 0.4, rug: 0.35 });
        if (varanda) {
          // laje da varanda e grade na frente da porta
          p.ret(jx - 0.35, y0 + 0.1, jl + 0.7, 0.14, { cor: "#f4f1eb", alt: 0.9, rug: 0.8 });
          p.ret(jx - 0.35, y0 + 0.04, jl + 0.7, 0.06, { cor: "rgba(50,45,40,0.35)" });
          p.ret(jx - 0.35, y0 + 1.12, jl + 0.7, 0.05, { cor: "#3b3e42", alt: 0.97, rug: 0.45 });
          for (let b = jx - 0.33; b < jx + jl + 0.35; b += 0.12) p.ret(b, y0 + 0.24, 0.025, 0.9, { cor: "#3b3e42", alt: 0.95, rug: 0.45 });
        } else {
          // peitoril saltado e o escorrido embaixo dele
          p.ret(jx - 0.12, jy - 0.1, jl + 0.24, 0.08, { cor: "#f6f4ef", alt: 0.78, rug: 0.7 });
          p.ret(jx - 0.12, jy - 0.16, jl + 0.24, 0.06, { cor: "rgba(50,45,40,0.22)" });
          escorrido(p, jx + 0.1 + acaso() * (jl - 0.4), jy - 0.16, 0.15 + acaso() * 0.2, 0.8 + acaso() * 1.2, 0.1);
          // ar-condicionado de janela
          if (acaso() < 0.3) {
            const ax = jx + jl / 2 - 0.32 + (acaso() - 0.5) * 0.4;
            p.ret(ax, jy - 0.62, 0.64, 0.42, { cor: "#d8d5ce", alt: 0.92, rug: 0.6 });
            for (let l = jy - 0.58; l < jy - 0.26; l += 0.05) p.ret(ax + 0.05, l, 0.54, 0.02, { cor: "rgba(80,80,80,0.35)" });
            p.ret(ax, jy - 0.7, 0.64, 0.08, { cor: "rgba(40,36,30,0.25)" });
            escorrido(p, ax + 0.25, jy - 0.7, 0.12, 1.4, 0.14);
          }
        }
      }
    }
  }
  return p.fim({ relevo: 9, grao: 0.07, suaviza: Math.max(1, Math.round(lado / 1024)), anisotropia, semente: 3 });
}

const LOJAS = ["PADARIA", "FARMÁCIA", "CAFÉ", "FLORICULTURA", "ÓTICA", "LANCHONETE", "PAPELARIA", "CHAVEIRO", "SORVETERIA", "LIVRARIA", "BANCA", "MERCADINHO"];
const CORES_LOJA = ["#a8322f", "#2f6b4f", "#2b4c86", "#c4862a", "#5a3e7a", "#262626", "#d0603a", "#2f7c8a"];

/** térreo com oito lojinhas diferentes: vitrine, porta, letreiro e, em algumas, a porta de aço baixada */
export function texturasTerreo(lado: number, anisotropia: number, fonte: string): TexturaPbr {
  const acaso = sorteio(57);
  const alto = Math.round((lado * 4.5) / 48);
  const p = new Pintor(lado, alto, 48, 4.5, { cor: "#e9e4dc", alt: 0.55, rug: 0.9 });
  // os nomes não se repetem dentro da mesma faixa
  const nomes = [...LOJAS].sort(() => acaso() - 0.5);
  for (let k = 0; k < 8; k++) {
    const x0 = k * 6;
    // pilar entre as lojas
    p.ret(x0, 0, 0.35, 4.5, { cor: "#ddd7cd", alt: 0.62, rug: 0.85 });
    // letreiro
    const cor = CORES_LOJA[Math.floor(acaso() * CORES_LOJA.length)];
    p.ret(x0 + 0.5, 3.45, 5.1, 0.75, { cor, alt: 0.72, rug: 0.5 });
    p.ret(x0 + 0.5, 3.4, 5.1, 0.05, { cor: "rgba(30,30,30,0.3)" });
    const nome = nomes[k % nomes.length];
    const g = p.cor;
    g.fillStyle = "#ffffff";
    g.textAlign = "center";
    g.textBaseline = "middle";
    const tam = 0.38 * p.my;
    g.font = `700 ${tam}px ${fonte}`;
    const larg = g.measureText(nome).width;
    const maxL = 4.6 * p.mx;
    if (larg > maxL) g.font = `700 ${(tam * maxL) / larg}px ${fonte}`;
    g.fillText(nome, (x0 + 3.05) * p.mx, p.h - 3.825 * p.my);
    if ((k === 2 || k === 6) && acaso() < 0.6) {
      // porta de aço de enrolar, baixada
      p.ret(x0 + 0.55, 0, 5.0, 3.3, { cor: "#9a9da1", alt: 0.45, rug: 0.55 });
      for (let y = 0.05; y < 3.3; y += 0.1) p.ret(x0 + 0.55, y, 5.0, 0.03, { cor: "rgba(40,40,40,0.35)", alt: 0.4 });
      continue;
    }
    // vitrine com o reflexo da rua e a loja lá dentro
    p.ret(x0 + 0.55, 0.15, 5.0, 3.15, { cor: "#3b3f44", alt: 0.48, rug: 0.4 });
    p.ret(x0 + 0.65, 0.4, 3.3, 2.8, { cor: Pintor.vertical("#6d7f8c", "#2c3136"), alt: 0.4, rug: 0.05 });
    // prateleiras e coisas lá dentro (bem apagadas pelo vidro)
    for (let s = 0; s < 3; s++) {
      p.ret(x0 + 0.75, 0.7 + s * 0.75, 3.1, 0.05, { cor: "rgba(220,200,170,0.25)" });
      for (let c = 0; c < 9; c++) {
        const tons = ["255,210,150", "200,220,255", "255,180,180", "210,255,210"];
        p.ret(x0 + 0.85 + c * 0.33, 0.76 + s * 0.75, 0.2, 0.25 + acaso() * 0.2, { cor: `rgba(${tons[Math.floor(acaso() * 4)]},0.22)` });
      }
    }
    p.ret(x0 + 0.65, 0.4, 3.3, 2.8, {
      cor: (gg, X, Y, W, H) => {
        const gr = gg.createLinearGradient(X, Y, X + W, Y + H);
        gr.addColorStop(0, "rgba(255,255,255,0.18)");
        gr.addColorStop(0.5, "rgba(255,255,255,0.02)");
        gr.addColorStop(0.6, "rgba(255,255,255,0.12)");
        gr.addColorStop(1, "rgba(255,255,255,0)");
        return gr;
      },
    });
    // porta de vidro com puxador
    p.ret(x0 + 4.1, 0.05, 1.35, 3.0, { cor: "#3b3f44", alt: 0.48, rug: 0.4 });
    p.ret(x0 + 4.18, 0.1, 1.19, 2.88, { cor: Pintor.vertical("#7c8e9a", "#353b41"), alt: 0.42, rug: 0.05 });
    p.ret(x0 + 4.25, 1.0, 0.04, 0.6, { cor: "#c9c9c9", alt: 0.6, rug: 0.2 });
    // soleira
    p.ret(x0 + 0.35, 0, 5.65, 0.1, { cor: "#bdb6aa", alt: 0.58, rug: 0.8 });
  }
  return p.fim({ relevo: 8, grao: 0.06, suaviza: Math.max(1, Math.round(lado / 1024)), anisotropia, semente: 5 });
}

/** pele de vidro das torres: painéis de 1,5 m, montantes, a faixa opaca da laje e um tom por painel */
export function texturasVidro(lado: number, anisotropia: number): TexturaPbr {
  const acaso = sorteio(23);
  const p = new Pintor(lado, lado / 2, 24, 12, { cor: "#2f3d4a", alt: 0.5, rug: 0.06 });
  for (let andar = 0; andar < 4; andar++) {
    const y0 = andar * 3;
    for (let k = 0; k < 16; k++) {
      const t = 0.85 + acaso() * 0.3;
      const c = (r: number, g: number, b: number) => `rgb(${Math.round(r * t)},${Math.round(g * t)},${Math.round(b * t)})`;
      p.ret(k * 1.5, y0 + 0.6, 1.5, 2.4, { cor: Pintor.vertical(c(78, 98, 118), c(42, 56, 70)), alt: 0.5, rug: 0.04 + acaso() * 0.05 });
      // uma ou outra persiana descida
      if (acaso() < 0.12) p.ret(k * 1.5, y0 + 1.6 + acaso() * 0.8, 1.5, 1.4, { cor: "rgba(200,200,195,0.35)", rug: 0.4 });
    }
    // faixa da laje (opaca)
    p.ret(0, y0, 24, 0.6, { cor: "#26313b", alt: 0.56, rug: 0.25 });
    p.ret(0, y0 + 0.58, 24, 0.04, { cor: "#1b2128", alt: 0.62, rug: 0.3 });
  }
  for (let k = 0; k <= 16; k++) p.ret(k * 1.5 - 0.035, 0, 0.07, 12, { cor: "#1d232a", alt: 0.66, rug: 0.3 });
  return p.fim({ relevo: 6, grao: 0.03, suaviza: Math.max(1, Math.round(lado / 1024)), anisotropia, semente: 7 });
}

/** asfalto: agregado miúdo, manchas, remendos, rachaduras e o trilho escuro dos pneus (8 × 8 m) */
export function texturasAsfalto(lado: number, anisotropia: number): TexturaPbr {
  const acaso = sorteio(61);
  const p = new Pintor(lado, lado, 8, 8, { cor: "#55575b", alt: 0.5, rug: 0.88 });
  for (let k = 0; k < 90; k++) {
    const x = acaso() * 8;
    const y = acaso() * 8;
    const r = 0.3 + acaso() * 1.4;
    const escuro = acaso() < 0.6;
    p.ret(x - r, y - r, r * 2, r * 2, {
      cor: (g, X, Y, W) => {
        const gr = g.createRadialGradient(X + W / 2, Y + W / 2, 0, X + W / 2, Y + W / 2, W / 2);
        gr.addColorStop(0, escuro ? "rgba(20,20,22,0.18)" : "rgba(200,200,200,0.08)");
        gr.addColorStop(1, "rgba(0,0,0,0)");
        return gr;
      },
    });
  }
  // remendos
  for (let k = 0; k < 3; k++) {
    const x = acaso() * 6;
    const y = acaso() * 6;
    p.ret(x, y, 0.8 + acaso() * 1.4, 0.6 + acaso(), { cor: "rgba(35,36,38,0.55)", alt: 0.54, rug: 0.8 });
  }
  // rachaduras
  const g = p.cor;
  const ga = p.alt;
  for (let k = 0; k < 6; k++) {
    let x = acaso() * p.w;
    let y = acaso() * p.h;
    let ang = acaso() * Math.PI * 2;
    g.strokeStyle = "rgba(15,15,16,0.6)";
    ga.strokeStyle = "rgb(70,70,70)";
    g.lineWidth = ga.lineWidth = Math.max(1, p.mx * 0.012);
    g.beginPath();
    ga.beginPath();
    g.moveTo(x, y);
    ga.moveTo(x, y);
    for (let s = 0; s < 40; s++) {
      ang += (acaso() - 0.5) * 0.9;
      x += Math.cos(ang) * p.mx * 0.05;
      y += Math.sin(ang) * p.mx * 0.05;
      g.lineTo(x, y);
      ga.lineTo(x, y);
    }
    g.stroke();
    ga.stroke();
  }
  // agregado: pedrinhas claras e escuras, cada uma um calombo
  const n = Math.round(p.w * p.h * 0.02);
  for (let k = 0; k < n; k++) {
    const x = acaso() * 8;
    const y = acaso() * 8;
    const r = 0.004 + acaso() * 0.01;
    const v = acaso();
    p.ret(x, y, r, r, { cor: v < 0.5 ? "rgba(140,140,140,0.5)" : "rgba(25,25,25,0.5)", alt: 0.56 + acaso() * 0.06 });
  }
  return p.fim({ relevo: 4, grao: 0.22, suaviza: 1, anisotropia, semente: 9 });
}

/** calçada de cimento em placas de 1 m com junta funda e desgaste (4 × 4 m) */
export function texturasCimento(lado: number, anisotropia: number): TexturaPbr {
  const acaso = sorteio(13);
  const p = new Pintor(lado, lado, 4, 4, { cor: "#cbc7bf", alt: 0.5, rug: 0.9 });
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const t = 0.93 + acaso() * 0.1;
      const c = Math.round(203 * t);
      p.ret(i + 0.012, j + 0.012, 0.976, 0.976, { cor: `rgb(${c},${Math.round(199 * t)},${Math.round(191 * t)})` });
      // mancha de uso
      if (acaso() < 0.4) {
        const r = 0.2 + acaso() * 0.3;
        p.ret(i + 0.5 - r, j + 0.5 - r, r * 2, r * 2, {
          cor: (g, X, Y, W) => {
            const gr = g.createRadialGradient(X + W / 2, Y + W / 2, 0, X + W / 2, Y + W / 2, W / 2);
            gr.addColorStop(0, "rgba(90,85,75,0.12)");
            gr.addColorStop(1, "rgba(90,85,75,0)");
            return gr;
          },
        });
      }
    }
  }
  for (let k = 0; k <= 4; k++) {
    p.ret(k - 0.012, 0, 0.024, 4, { cor: "#8f8b84", alt: 0.3, rug: 0.95 });
    p.ret(0, k - 0.012, 4, 0.024, { cor: "#8f8b84", alt: 0.3, rug: 0.95 });
  }
  return p.fim({ relevo: 5, grao: 0.12, suaviza: 1, anisotropia, semente: 11 });
}

/** laje de cobertura: concreto com manta, manchas e a junta das placas (10 × 10 m) */
export function texturasTelhado(lado: number, anisotropia: number): TexturaPbr {
  const acaso = sorteio(71);
  const p = new Pintor(lado, lado, 10, 10, { cor: "#a9a7a2", alt: 0.5, rug: 0.9 });
  for (let k = 0; k < 40; k++) {
    const x = acaso() * 10;
    const y = acaso() * 10;
    const r = 0.5 + acaso() * 2;
    p.ret(x - r, y - r, r * 2, r * 2, {
      cor: (g, X, Y, W) => {
        const gr = g.createRadialGradient(X + W / 2, Y + W / 2, 0, X + W / 2, Y + W / 2, W / 2);
        gr.addColorStop(0, "rgba(60,60,55,0.15)");
        gr.addColorStop(1, "rgba(60,60,55,0)");
        return gr;
      },
    });
  }
  for (let k = 0; k <= 5; k++) {
    p.ret(k * 2 - 0.02, 0, 0.04, 10, { cor: "rgba(70,70,65,0.4)", alt: 0.45 });
    p.ret(0, k * 2 - 0.02, 10, 0.04, { cor: "rgba(70,70,65,0.4)", alt: 0.45 });
  }
  return p.fim({ relevo: 3, grao: 0.12, suaviza: 1, anisotropia, semente: 13 });
}

/** tronco de coqueiro: anéis das folhas que caíram e a casca riscada (1 volta × 1 m) */
export function texturasTronco(anisotropia: number): TexturaPbr {
  const acaso = sorteio(83);
  const p = new Pintor(128, 256, 1, 1, { cor: "#8a7a64", alt: 0.5, rug: 0.95 });
  for (let k = 0; k < 6; k++) {
    const y = k / 6;
    p.ret(0, y, 1, 0.035, { cor: "#5e5141", alt: 0.3 });
    p.ret(0, y + 0.035, 1, 0.03, { cor: "#a39276", alt: 0.62 });
  }
  for (let k = 0; k < 120; k++) p.ret(acaso(), acaso(), 0.01, 0.04 + acaso() * 0.08, { cor: "rgba(60,50,40,0.35)", alt: 0.42 });
  return p.fim({ relevo: 4, grao: 0.15, suaviza: 1, anisotropia, semente: 17 });
}

/** folha de coqueiro (com transparência): talo e folíolos finos, mais claros e amarelados na ponta */
export function texturaFolha(anisotropia: number): THREE.CanvasTexture {
  const acaso = sorteio(91);
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const g = c.getContext("2d");
  if (g) {
    g.lineCap = "round";
    for (let x = 8; x < 500; x += 3.2) {
      const t = x / 512;
      const comp = 52 * Math.sin(t * Math.PI) * (0.85 + acaso() * 0.3) + 6;
      const verde = `rgb(${Math.round(70 + t * 60 + acaso() * 20)},${Math.round(110 + t * 30 + acaso() * 25)},${Math.round(40 + acaso() * 15)})`;
      g.strokeStyle = verde;
      g.lineWidth = 2.4 - t;
      for (const lado of [-1, 1]) {
        g.beginPath();
        g.moveTo(x, 64);
        g.quadraticCurveTo(x + 8, 64 + lado * comp * 0.5, x + 18 + acaso() * 6, 64 + lado * comp);
        g.stroke();
      }
    }
    g.strokeStyle = "#9a9358";
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(0, 64);
    g.lineTo(512, 64);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = anisotropia;
  return t;
}

/** toldo listrado (branco e cinza; a cor de cada toldo vem do vértice) */
export function texturaToldo(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 16;
  const g = c.getContext("2d");
  if (g) {
    for (let k = 0; k < 8; k++) {
      g.fillStyle = k % 2 ? "#ffffff" : "#9c9c9c";
      g.fillRect(k * 16, 0, 16, 16);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** mata atlântica dos morros: verde manchado de copas, com pedra aparecendo no alto */
export function texturaMorro(): THREE.CanvasTexture {
  const acaso = sorteio(29);
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 256;
  const g = c.getContext("2d");
  if (g) {
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, "#8d9488");
    gr.addColorStop(0.25, "#5f7a5c");
    gr.addColorStop(1, "#4d6a4c");
    g.fillStyle = gr;
    g.fillRect(0, 0, 1024, 256);
    for (let k = 0; k < 2600; k++) {
      const x = acaso() * 1024;
      const y = 40 + acaso() * 216;
      const r = 2 + acaso() * 6;
      const v = acaso();
      g.fillStyle = v < 0.5 ? "rgba(30,55,32,0.35)" : "rgba(130,160,110,0.3)";
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
    // pedra no alto dos picos
    for (let k = 0; k < 300; k++) {
      g.fillStyle = "rgba(150,150,145,0.35)";
      g.fillRect(acaso() * 1024, acaso() * 50, 3 + acaso() * 10, 2 + acaso() * 5);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

/**
 * Calçadão de Copacabana: ondas de pedra portuguesa preta e branca (4 × 4 m),
 * cada pedrinha com o rejunte fundo em volta — de perto, a luz pega nelas.
 */
export function texturasCalcadao(lado: number, anisotropia: number): TexturaPbr {
  const acaso = sorteio(31);
  const p = new Pintor(lado, lado, 4, 4, { cor: "#ece9e2", alt: 0.6, rug: 0.75 });
  const img = p.cor.getImageData(0, 0, lado, lado);
  const px = lado / 4;
  // a onda só depende de x: calcula uma vez por coluna
  const desvio = Float32Array.from({ length: lado }, (_, x) => 0.32 * Math.sin((x / px / 4) * Math.PI * 2));
  for (let y = 0; y < lado; y++) {
    for (let x = 0; x < lado; x++) {
      const onda = (y / px + desvio[x]) / (4 / 6);
      if (Math.floor(onda) % 2 !== 0) continue;
      const i = (y * lado + x) * 4;
      img.data[i] = 44;
      img.data[i + 1] = 44;
      img.data[i + 2] = 46;
    }
  }
  p.cor.putImageData(img, 0, 0);
  // pedrinhas de ~6 cm, um pouco tortas, com o rejunte mais escuro e mais fundo
  const pedra = 0.06;
  for (let y = 0; y < 4; y += pedra) {
    const linha = Math.round(y / pedra);
    for (let x = linha % 2 ? -pedra / 2 : 0; x < 4; x += pedra) {
      const dx = (acaso() - 0.5) * pedra * 0.25;
      const dy = (acaso() - 0.5) * pedra * 0.25;
      const l = pedra * (0.78 + acaso() * 0.12);
      const a = pedra * (0.78 + acaso() * 0.12);
      const claro = acaso() < 0.5;
      p.ret(x + dx, y + dy, l, a, { cor: claro ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)", alt: 0.62 + acaso() * 0.08, rug: 0.6 + acaso() * 0.2 });
    }
  }
  // o rejunte é o que sobrou da camada de altura base (0,6) entre as pedras: abaixa um pouco e escurece
  const alt = p.alt.getImageData(0, 0, lado, lado);
  const cor = p.cor.getImageData(0, 0, lado, lado);
  for (let i = 0; i < alt.data.length; i += 4) {
    if (alt.data[i] > 155) continue;
    alt.data[i] = alt.data[i + 1] = alt.data[i + 2] = 110;
    cor.data[i] *= 0.72;
    cor.data[i + 1] *= 0.72;
    cor.data[i + 2] *= 0.72;
  }
  p.alt.putImageData(alt, 0, 0);
  p.cor.putImageData(cor, 0, 0);
  return p.fim({ relevo: 5, grao: 0.1, suaviza: 1, anisotropia, semente: 19 });
}
