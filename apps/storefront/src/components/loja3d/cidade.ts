/**
 * A cidade em volta da loja 3D, para o fundo não ficar branco: céu com nuvens,
 * morros no horizonte (com cara de Rio), a rua da frente com faixa de
 * pedestres, coqueiros e postes na calçada, e quarteirões de prédios com
 * janelas — de alvenaria clara em tons pastel e torres de vidro.
 *
 * Tudo é desenhado na hora (nada para baixar) e sai barato até no celular:
 * cada tipo de coisa é uma malha só, com material sem cálculo de luz — o sol
 * de cada face, a sombra no pé do prédio e a névoa da distância (mais longe,
 * mais claro e azulado) já vêm pintados na cor dos vértices.
 *
 * Perto da loja os prédios são baixos e vão subindo com a distância: da vista
 * de cima (de 14 a 70 m da loja, inclinada pelo menos 28°) nenhum prédio fica
 * na frente da loja nem engole a câmera.
 */
import * as THREE from "three";

export interface Cidade {
  grupo: THREE.Group;
  /** céu (fundo da cena) */
  ceu: THREE.Texture;
  descartar: () => void;
}

/** quarteirão da loja (a loja e a calçada dela ficam dentro) e onde começa a rua da frente */
export interface OpcoesCidade {
  quarteirao: { x0: number; x1: number; z0: number; z1: number };
  /** celular: texturas menores */
  leve: boolean;
}

const RUA = 10; // largura das ruas
const MEIO_FIO = 0.15; // a calçada é mais alta que a rua
const QUADRA = 42; // lado dos quarteirões da cidade
const ALCANCE = 240; // até onde vão os prédios
const ANDAR = 3; // altura de um andar
const NEVOA = new THREE.Color("#dfe6ec"); // cor do horizonte (a névoa puxa para ela)

function textura(largura: number, altura: number, desenhar: (g: CanvasRenderingContext2D) => void, repetir = true) {
  const c = document.createElement("canvas");
  c.width = largura;
  c.height = altura;
  const g = c.getContext("2d");
  if (g) desenhar(g);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repetir) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function sorteio(semente: number) {
  let s = semente;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

/** chuvisco de tons para tirar a cara de cor chapada */
function granulado(g: CanvasRenderingContext2D, w: number, h: number, n: number, forca: number, acaso: () => number) {
  for (let i = 0; i < n; i++) {
    const v = acaso() < 0.5 ? 0 : 255;
    g.fillStyle = `rgba(${v},${v},${v},${acaso() * forca})`;
    g.fillRect(acaso() * w, acaso() * h, 1 + acaso() * 2, 1 + acaso() * 2);
  }
}

/**
 * Calçadão de Copacabana: ondas de pedra portuguesa preta e branca, 4 × 4 m
 * por repetição (as ondas correm ao longo da rua, em x).
 */
export function texturaCalcadao(lado: number): THREE.CanvasTexture {
  const acaso = sorteio(31);
  return textura(lado, lado, (g) => {
    const px = lado / 4; // pixels por metro
    const img = g.createImageData(lado, lado);
    for (let y = 0; y < lado; y++) {
      for (let x = 0; x < lado; x++) {
        const onda = (y / px + 0.32 * Math.sin((x / px / 4) * Math.PI * 2)) / (4 / 6);
        const preta = Math.floor(onda) % 2 === 0;
        const base = preta ? 46 : 236;
        const i = (y * lado + x) * 4;
        img.data[i] = base + (preta ? 0 : -4);
        img.data[i + 1] = base + (preta ? 0 : -6);
        img.data[i + 2] = base + (preta ? 2 : -10);
        img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    // as pedrinhas: rejunte escuro em volta de pedras irregulares de ~6 cm
    const pedra = Math.max(3, px * 0.06);
    g.strokeStyle = "rgba(0,0,0,0.22)";
    g.lineWidth = Math.max(1, pedra * 0.18);
    for (let y = 0; y < lado; y += pedra) {
      for (let x = (y / pedra) % 2 ? pedra / 2 : 0; x < lado; x += pedra) {
        g.strokeRect(x + (acaso() - 0.5) * pedra * 0.3, y + (acaso() - 0.5) * pedra * 0.3, pedra * (0.8 + acaso() * 0.3), pedra * (0.8 + acaso() * 0.3));
      }
    }
    granulado(g, lado, lado, lado * 6, 0.12, acaso);
  });
}

/** céu: azul em cima, claro no horizonte, nuvens soltas e o sol à esquerda (de onde vêm as sombras da loja) */
function texturaCeu(w: number): THREE.CanvasTexture {
  const h = w / 2;
  const acaso = sorteio(7);
  const t = textura(
    w,
    h,
    (g) => {
      // no mapa do céu, y = 0 é o alto e y = h/2 é o horizonte
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, "#4f8fd0");
      gr.addColorStop(0.32, "#86b6e2");
      gr.addColorStop(0.47, "#cfe0ee");
      gr.addColorStop(0.5, "#e6ecf0");
      gr.addColorStop(1, "#d9dcd9");
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
      // brilho do sol: na mesma direção da luz da loja (frente-esquerda, alto)
      const sx = w * 0.88;
      const sy = h * 0.29;
      const sol = g.createRadialGradient(sx, sy, 0, sx, sy, h * 0.28);
      sol.addColorStop(0, "rgba(255,250,235,0.85)");
      sol.addColorStop(0.15, "rgba(255,246,225,0.35)");
      sol.addColorStop(1, "rgba(255,246,225,0)");
      g.fillStyle = sol;
      g.fillRect(0, 0, w, h);
      // nuvens: bolos de círculos macios, mais achatadas perto do horizonte
      for (let n = 0; n < 34; n++) {
        const cy = h * (0.12 + acaso() * 0.32);
        const cx = acaso() * w;
        const achata = 0.35 + ((cy / h - 0.12) / 0.32) * -0.15 + 0.15;
        const tam = h * (0.03 + acaso() * 0.05);
        for (let k = 0; k < 9; k++) {
          const x = cx + (acaso() - 0.5) * tam * 4;
          const y = cy + (acaso() - 0.5) * tam * 0.8 * achata;
          const r = tam * (0.6 + acaso() * 0.8);
          for (const desloc of [0, -w, w]) {
            const bola = g.createRadialGradient(x + desloc, y, 0, x + desloc, y, r);
            bola.addColorStop(0, "rgba(255,255,255,0.55)");
            bola.addColorStop(0.6, "rgba(255,255,255,0.25)");
            bola.addColorStop(1, "rgba(255,255,255,0)");
            g.fillStyle = bola;
            g.save();
            g.translate(x + desloc, y);
            g.scale(1, achata);
            g.translate(-(x + desloc), -y);
            g.beginPath();
            g.arc(x + desloc, y, r, 0, Math.PI * 2);
            g.fill();
            g.restore();
          }
        }
      }
    },
    false
  );
  t.mapping = THREE.EquirectangularReflectionMapping;
  return t;
}

/** fachada de alvenaria: 4 módulos de 6 m × 4 andares; a cor do prédio vem do vértice (o fundo é branco) */
function texturaAlvenaria(lado: number): THREE.CanvasTexture {
  const acaso = sorteio(11);
  return textura(lado, lado / 2, (g) => {
    const W = lado;
    const H = lado / 2;
    const mx = W / 24; // pixels por metro
    const my = H / 12;
    g.fillStyle = "#f6f3ee";
    g.fillRect(0, 0, W, H);
    granulado(g, W, H, W * 3, 0.05, acaso);
    for (let andar = 0; andar < 4; andar++) {
      const topo = H - (andar + 1) * 3 * my;
      // laje
      g.fillStyle = "rgba(0,0,0,0.07)";
      g.fillRect(0, topo + 3 * my - 0.18 * my, W, 0.18 * my);
      for (let jan = 0; jan < 8; jan++) {
        const x = (jan * 3 + 0.7) * mx;
        const y = topo + 0.75 * my;
        const jw = 1.6 * mx;
        const jh = 1.55 * my;
        // vidro com o céu refletido
        const vidro = g.createLinearGradient(0, y, 0, y + jh);
        const escuro = acaso() < 0.3;
        vidro.addColorStop(0, escuro ? "#4b5a66" : "#7f97a8");
        vidro.addColorStop(1, escuro ? "#2f3a43" : "#c3d1da");
        g.fillStyle = "#d9d4cb";
        g.fillRect(x - 0.08 * mx, y - 0.08 * my, jw + 0.16 * mx, jh + 0.16 * my);
        g.fillStyle = vidro;
        g.fillRect(x, y, jw, jh);
        // cortina em parte das janelas
        if (acaso() < 0.35) {
          g.fillStyle = acaso() < 0.5 ? "rgba(240,232,214,0.85)" : "rgba(214,200,180,0.85)";
          g.fillRect(x, y, jw * (0.3 + acaso() * 0.4), jh);
        }
        g.fillStyle = "rgba(60,60,60,0.5)";
        g.fillRect(x + jw / 2 - 0.02 * mx, y, 0.04 * mx, jh);
        // varanda com grade em parte delas
        if (acaso() < 0.4) {
          g.fillStyle = "rgba(255,255,255,0.9)";
          g.fillRect(x - 0.3 * mx, y + jh + 0.05 * my, jw + 0.6 * mx, 0.12 * my);
          g.fillStyle = "rgba(40,40,40,0.55)";
          g.fillRect(x - 0.3 * mx, y + jh - 0.45 * my, jw + 0.6 * mx, 0.05 * my);
          for (let b = 0; b <= 10; b++) g.fillRect(x - 0.3 * mx + (b * (jw + 0.6 * mx)) / 10, y + jh - 0.45 * my, 0.03 * mx, 0.5 * my);
        }
      }
    }
  });
}

/** pele de vidro das torres: painéis de 1,5 m, montantes escuros e a faixa opaca de cada laje */
function texturaVidro(lado: number): THREE.CanvasTexture {
  const acaso = sorteio(23);
  return textura(lado, lado / 2, (g) => {
    const W = lado;
    const H = lado / 2;
    const mx = W / 24;
    const my = H / 12;
    for (let andar = 0; andar < 4; andar++) {
      const topo = H - (andar + 1) * 3 * my;
      for (let p = 0; p < 16; p++) {
        const x = p * 1.5 * mx;
        const vidro = g.createLinearGradient(0, topo, 0, topo + 3 * my);
        const tom = 0.85 + acaso() * 0.3;
        vidro.addColorStop(0, `rgb(${Math.round(150 * tom)},${Math.round(178 * tom)},${Math.round(198 * tom)})`);
        vidro.addColorStop(1, `rgb(${Math.round(92 * tom)},${Math.round(116 * tom)},${Math.round(136 * tom)})`);
        g.fillStyle = vidro;
        g.fillRect(x, topo, 1.5 * mx, 3 * my);
      }
      g.fillStyle = "rgba(40,48,56,0.85)";
      g.fillRect(0, topo + 2.45 * my, W, 0.55 * my);
    }
    g.fillStyle = "rgba(30,36,42,0.9)";
    for (let p = 0; p <= 16; p++) g.fillRect(p * 1.5 * mx - 0.04 * mx, 0, 0.08 * mx, H);
  });
}

function texturaConcreto(lado: number, base: string, semente: number, juntas: number): THREE.CanvasTexture {
  const acaso = sorteio(semente);
  return textura(lado, lado, (g) => {
    g.fillStyle = base;
    g.fillRect(0, 0, lado, lado);
    granulado(g, lado, lado, lado * 10, 0.1, acaso);
    if (juntas) {
      g.fillStyle = "rgba(0,0,0,0.12)";
      for (let k = 0; k < juntas; k++) {
        g.fillRect((k * lado) / juntas, 0, 2, lado);
        g.fillRect(0, (k * lado) / juntas, lado, 2);
      }
    }
  });
}

/** calçada de cimento em placas de 1 m (4 × 4 m por repetição) */
export function texturaCimento(): THREE.CanvasTexture {
  return texturaConcreto(256, "#c9c6bf", 13, 4);
}

function texturaFolha(): THREE.CanvasTexture {
  return textura(
    256,
    64,
    (g) => {
      // folha de coqueiro: talo no meio e folíolos inclinados para os dois lados
      g.strokeStyle = "#6f8a3c";
      g.lineCap = "round";
      for (let x = 6; x < 250; x += 5) {
        const comp = 26 * Math.sin((x / 256) * Math.PI) + 4;
        g.lineWidth = 3;
        g.strokeStyle = x % 10 ? "#5f7f34" : "#79984a";
        g.beginPath();
        g.moveTo(x, 32);
        g.lineTo(x + 10, 32 - comp);
        g.moveTo(x, 32);
        g.lineTo(x + 10, 32 + comp);
        g.stroke();
      }
      g.strokeStyle = "#8a8a52";
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(0, 32);
      g.lineTo(256, 32);
      g.stroke();
    },
    false
  );
}

/** junta quadriláteros com uv e cor por vértice numa malha só */
class Lote {
  pos: number[] = [];
  uv: number[] = [];
  cor: number[] = [];
  idx: number[] = [];
  /** a, b, c, d em volta (anti-horário visto de fora); uv e cor na mesma ordem */
  quad(p: number[][], uv: number[][], cor: THREE.Color[]) {
    const base = this.pos.length / 3;
    for (let k = 0; k < 4; k++) {
      this.pos.push(...p[k]);
      this.uv.push(...uv[k]);
      this.cor.push(cor[k].r, cor[k].g, cor[k].b);
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  malha(m: THREE.Material): THREE.Mesh {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(this.cor, 3));
    geo.setIndex(this.idx);
    geo.computeBoundingSphere();
    const malha = new THREE.Mesh(geo, m);
    malha.matrixAutoUpdate = false;
    return malha;
  }
}

export function criarCidade(o: OpcoesCidade): Cidade {
  const grupo = new THREE.Group();
  grupo.name = "cidade";
  const descartaveis: { dispose: () => void }[] = [];
  const guardar = <T extends { dispose: () => void }>(x: T) => (descartaveis.push(x), x);
  const acaso = sorteio(97);
  const q = o.quarteirao;
  const lado = o.leve ? 512 : 1024;
  const centro = new THREE.Vector2((q.x0 + q.x1) / 2, (q.z0 + q.z1) / 2);

  const ceu = guardar(texturaCeu(o.leve ? 1024 : 2048));
  const sem = (extra: THREE.MeshBasicMaterialParameters) => guardar(new THREE.MeshBasicMaterial({ vertexColors: true, ...extra }));
  const texAlvenaria = guardar(texturaAlvenaria(lado));
  const texVidro = guardar(texturaVidro(lado));
  const texTelhado = guardar(texturaConcreto(256, "#a7a6a2", 5, 0));
  const texAsfalto = guardar(texturaConcreto(256, "#5d5e62", 9, 0));
  const texCalcada = guardar(texturaCimento());
  const matAlvenaria = sem({ map: texAlvenaria });
  const matVidro = sem({ map: texVidro });
  const matTelhado = sem({ map: texTelhado });
  const matAsfalto = sem({ map: texAsfalto });
  const matCalcada = sem({ map: texCalcada });
  const matPintura = sem({ side: THREE.DoubleSide });
  // tinta no asfalto: 2 cm acima e puxada para a frente na profundidade (de longe não briga com o asfalto)
  const matSinalizacao = sem({ polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const matMorro = sem({ side: THREE.DoubleSide });
  const matFolha = sem({ map: guardar(texturaFolha()), alphaTest: 0.35, side: THREE.DoubleSide });

  // a luz de cada face (o sol vem da frente e da esquerda, como na loja) e a névoa da distância
  const SOL: Record<string, number> = { frente: 1.0, esquerda: 0.93, direita: 0.8, fundo: 0.7, topo: 1.04 };
  const aux = new THREE.Color();
  function tom(base: THREE.Color, luz: number, x: number, z: number, pe = false) {
    const d = Math.hypot(x - centro.x, z - centro.y);
    const nevoa = THREE.MathUtils.clamp((d - 50) / 300, 0, 0.62);
    return aux
      .copy(base)
      .multiplyScalar(luz * (pe ? 0.78 : 1))
      .lerp(NEVOA, nevoa)
      .clone();
  }

  // ---- chão: asfalto em tudo; os quarteirões são calçadas 15 cm mais altas
  const asfalto = new Lote();
  const cinza = new THREE.Color("#ffffff");
  {
    const R = ALCANCE + 160;
    const c = [tom(cinza, 1, -R, -R), tom(cinza, 1, R, -R), tom(cinza, 1, R, R), tom(cinza, 1, -R, R)];
    const y = -MEIO_FIO;
    asfalto.quad(
      [
        [-R, y, R],
        [R, y, R],
        [R, y, -R],
        [-R, y, -R],
      ],
      [
        [-R / 6, R / 6],
        [R / 6, R / 6],
        [R / 6, -R / 6],
        [-R / 6, -R / 6],
      ],
      [c[3], c[2], c[1], c[0]]
    );
  }
  const calcada = new Lote();
  const alvenaria = new Lote();
  const vidro = new Lote();
  const telhado = new Lote();
  const pintura = new Lote();

  /** caixa sem fundo: 4 paredes e o topo (sem topo: `topo` null); uv em metros / `tile` */
  function caixa(x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, paredes: Lote, cor: THREE.Color, tile: number, desloc: number, topo: Lote | null, tileTopo: number) {
    const lados: [number[], number[], string, number][] = [
      [[x0, z1], [x1, z1], "frente", x1 - x0],
      [[x1, z1], [x1, z0], "direita", z1 - z0],
      [[x1, z0], [x0, z0], "fundo", x1 - x0],
      [[x0, z0], [x0, z1], "esquerda", z1 - z0],
    ];
    for (const [a, b, face, comp] of lados) {
      const u0 = desloc;
      const u1 = desloc + comp / tile;
      const v0 = y0 / (tile / 2);
      const v1 = y1 / (tile / 2);
      paredes.quad(
        [
          [a[0], y0, a[1]],
          [b[0], y0, b[1]],
          [b[0], y1, b[1]],
          [a[0], y1, a[1]],
        ],
        [
          [u0, v0],
          [u1, v0],
          [u1, v1],
          [u0, v1],
        ],
        [tom(cor, SOL[face], a[0], a[1], true), tom(cor, SOL[face], b[0], b[1], true), tom(cor, SOL[face], b[0], b[1]), tom(cor, SOL[face], a[0], a[1])]
      );
    }
    if (!topo) return;
    const ct = tom(cor.clone().lerp(cinza, 0.5), SOL.topo, (x0 + x1) / 2, (z0 + z1) / 2);
    topo.quad(
      [
        [x0, y1, z1],
        [x1, y1, z1],
        [x1, y1, z0],
        [x0, y1, z0],
      ],
      [
        [x0 / tileTopo, z1 / tileTopo],
        [x1 / tileTopo, z1 / tileTopo],
        [x1 / tileTopo, z0 / tileTopo],
        [x0 / tileTopo, z0 / tileTopo],
      ],
      [ct, ct, ct, ct]
    );
  }

  // cores das fachadas (Rio: muito branco e bege, alguns tons pastel) e dos vidros
  const CORES_ALVENARIA = ["#ffffff", "#f3ead9", "#efe3cf", "#f2d9cf", "#f4e7b8", "#d9e8dc", "#e6e1da", "#e9d2c0", "#dfe5ea"].map((c) => new THREE.Color(c));
  const CORES_VIDRO = ["#ffffff", "#dfeaf2", "#d6e6df", "#efe4d6"].map((c) => new THREE.Color(c));
  const BRANCO_GELO = new THREE.Color("#f2f2ef");

  // ---- quarteirões: a grade das ruas parte do quarteirão da loja
  const xs: [number, number][] = [[q.x0, q.x1]];
  const zs: [number, number][] = [[q.z0, q.z1]];
  for (let x = q.x1 + RUA; x < ALCANCE; x += QUADRA + RUA) xs.push([x, x + QUADRA]);
  for (let x = q.x0 - RUA; x > -ALCANCE; x -= QUADRA + RUA) xs.unshift([x - QUADRA, x]);
  for (let z = q.z1 + RUA; z < ALCANCE; z += QUADRA + RUA) zs.push([z, z + QUADRA]);
  for (let z = q.z0 - RUA; z > -ALCANCE; z -= QUADRA + RUA) zs.unshift([z - QUADRA, z]);

  /** altura máxima para não tampar a loja vista de cima: sobe meio metro a cada metro de distância */
  const alturaMax = (d: number) => THREE.MathUtils.clamp(0.5 * (d - 8), 6, 130);
  const distRet = (x0: number, x1: number, z0: number, z1: number) =>
    Math.hypot(Math.max(x0 - centro.x, 0, centro.x - x1), Math.max(z0 - centro.y, 0, centro.y - z1));

  for (const [x0, x1] of xs) {
    for (const [z0, z1] of zs) {
      if (x0 === q.x0 && z0 === q.z0) continue; // o quarteirão da loja é da cena
      // calçada do quarteirão (só a borda: o miolo fica coberto pelos lotes)
      const cc = tom(cinza, 1, (x0 + x1) / 2, (z0 + z1) / 2);
      calcada.quad(
        [
          [x0, 0, z1],
          [x1, 0, z1],
          [x1, 0, z0],
          [x0, 0, z0],
        ],
        [
          [x0 / 4, z1 / 4],
          [x1 / 4, z1 / 4],
          [x1 / 4, z0 / 4],
          [x0 / 4, z0 / 4],
        ],
        [cc, cc, cc, cc]
      );
      // meio-fio (só as beiradas: em cima já é a calçada)
      caixa(x0, x1, z0, z1, -MEIO_FIO, 0, pintura, new THREE.Color("#b9b7b1"), 4, 0, null, 4);
      // lotes: 2 a 3 em cada direção, com recuo de 3 m da calçada
      const nx = 2 + Math.floor(acaso() * 2);
      const nz = 2 + Math.floor(acaso() * 2);
      const lx = (x1 - x0 - 6) / nx;
      const lz = (z1 - z0 - 6) / nz;
      for (let i = 0; i < nx; i++) {
        for (let k = 0; k < nz; k++) {
          // miolo do quarteirão às vezes vazio (pátio)
          if (nx === 3 && nz === 3 && i === 1 && k === 1) continue;
          const bx0 = x0 + 3 + i * lx + 0.6;
          const bx1 = bx0 + lx - 1.2 - acaso() * 2;
          const bz0 = z0 + 3 + k * lz + 0.6;
          const bz1 = bz0 + lz - 1.2 - acaso() * 2;
          const d = distRet(bx0, bx1, bz0, bz1);
          const max = alturaMax(d);
          const torre = max > 34 && acaso() < 0.45;
          const andares = Math.max(2, Math.round(((torre ? 0.6 : 0.35) + acaso() * 0.4) * Math.min(max, torre ? 130 : 42) / ANDAR));
          const h = andares * ANDAR;
          if (torre) {
            const cor = CORES_VIDRO[Math.floor(acaso() * CORES_VIDRO.length)];
            caixa(bx0, bx1, bz0, bz1, 0, h, vidro, cor, 24, Math.floor(acaso() * 4) / 4, telhado, 10);
            // coroamento opaco no alto da torre
            caixa(bx0 + 1, bx1 - 1, bz0 + 1, bz1 - 1, h, h + 2.4, pintura, BRANCO_GELO, 4, 0, telhado, 10);
          } else {
            const cor = CORES_ALVENARIA[Math.floor(acaso() * CORES_ALVENARIA.length)];
            caixa(bx0, bx1, bz0, bz1, 0, h, alvenaria, cor, 24, Math.floor(acaso() * 4) / 4, telhado, 10);
            // caixa d'água / casa de máquinas em cima
            if (andares > 3) {
              const cx = bx0 + (bx1 - bx0) * (0.3 + acaso() * 0.4);
              const cz = bz0 + (bz1 - bz0) * (0.3 + acaso() * 0.4);
              caixa(cx - 2, cx + 2, cz - 1.5, cz + 1.5, h, h + 2.6, pintura, cor, 4, 0, telhado, 10);
            }
          }
        }
      }
    }
  }

  // meio-fio do quarteirão da loja (o chão dele é da cena)
  caixa(q.x0, q.x1, q.z0, q.z1, -MEIO_FIO, -0.01, pintura, new THREE.Color("#b9b7b1"), 4, 0, null, 4);

  // ---- rua da frente: faixa amarela no meio e faixa de pedestres na porta da loja
  const sinalizacao = new Lote();
  const amarelo = new THREE.Color("#f2c230");
  const branca = new THREE.Color("#f4f4f0");
  const faixa = (x0: number, x1: number, z0: number, z1: number, cor: THREE.Color) => {
    const c = tom(cor, 1, (x0 + x1) / 2, (z0 + z1) / 2);
    const y = -MEIO_FIO + 0.02;
    sinalizacao.quad(
      [
        [x0, y, z1],
        [x1, y, z1],
        [x1, y, z0],
        [x0, y, z0],
      ],
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
      [c, c, c, c]
    );
  };
  const meioRua = q.z1 + RUA / 2;
  for (let x = -150; x < 150; x += 6) if (Math.abs(x) > 4) faixa(x, x + 3, meioRua - 0.06, meioRua + 0.06, amarelo);
  for (let k = 0; k < 9; k++) {
    const z = q.z1 + 0.6 + k * ((RUA - 1.2) / 8.5);
    faixa(-2.2, 2.2, z, z + 0.5, branca);
  }

  // ---- morros no horizonte: um anel com picos arredondados, azulados pela distância
  const morros = new Lote();
  {
    const N = 160;
    const picos = Array.from({ length: 9 }, () => ({ a: acaso() * Math.PI * 2, h: 70 + acaso() * 120, larg: 0.12 + acaso() * 0.22 }));
    // um "pão de açúcar": cúpula alta e estreita, de frente para a loja, à direita
    picos.push({ a: Math.PI * 0.42, h: 175, larg: 0.07 });
    const altura = (a: number) => {
      let h = 18 + 10 * Math.sin(a * 5) + 6 * Math.sin(a * 13);
      for (const p of picos) {
        let d = Math.abs(a - p.a);
        d = Math.min(d, Math.PI * 2 - d);
        h = Math.max(h, p.h * Math.exp(-(d * d) / (2 * p.larg * p.larg)));
      }
      return h;
    };
    const topoCor = new THREE.Color("#6f8f7f").lerp(NEVOA, 0.45);
    const peCor = new THREE.Color("#9fb3ad").lerp(NEVOA, 0.55);
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * Math.PI * 2;
      const a1 = ((i + 1) / N) * Math.PI * 2;
      const r0 = 470 + 25 * Math.sin(a0 * 3);
      const r1 = 470 + 25 * Math.sin(a1 * 3);
      const p = (a: number, r: number, y: number) => [centro.x + Math.sin(a) * r, y, centro.y - Math.cos(a) * r];
      morros.quad(
        [p(a0, r0, -5), p(a1, r1, -5), p(a1, r1, altura(a1)), p(a0, r0, altura(a0))],
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
        ],
        [peCor, peCor, topoCor, topoCor]
      );
    }
  }

  // ---- calçada da loja: coqueiros e postes na beira da rua (nunca na frente da porta)
  const troncos = new Lote();
  const folhas = new Lote();
  const marrom = new THREE.Color("#8c7a62");
  const verde = new THREE.Color("#ffffff");
  const beira = q.z1 - 0.9;
  for (let x = q.x0 + 3; x <= q.x1 - 3; x += 7) {
    if (Math.abs(x) < 5) continue;
    const ehPoste = Math.round((x - q.x0) / 7) % 2 === 1;
    if (ehPoste) {
      // poste: haste fina, braço e luminária
      caixa(x - 0.07, x + 0.07, beira - 0.07, beira + 0.07, 0, 6.2, pintura, new THREE.Color("#4a4d52"), 4, 0, pintura, 4);
      caixa(x - 0.05, x + 0.05, beira, beira + 1.3, 6.0, 6.1, pintura, new THREE.Color("#4a4d52"), 4, 0, pintura, 4);
      caixa(x - 0.22, x + 0.22, beira + 1.0, beira + 1.6, 5.85, 6.05, pintura, new THREE.Color("#3a3c40"), 4, 0, pintura, 4);
      continue;
    }
    // coqueiro: tronco fino que inclina um pouco e uma coroa de folhas arqueadas
    const alt = 7 + acaso() * 2.5;
    const incl = (acaso() - 0.5) * 0.6;
    const seg = 6;
    for (let s = 0; s < seg; s++) {
      const y0 = (s / seg) * alt;
      const y1 = ((s + 1) / seg) * alt;
      const dx0 = incl * Math.pow(s / seg, 2);
      const dx1 = incl * Math.pow((s + 1) / seg, 2);
      const r0 = 0.2 - 0.06 * (s / seg);
      const r1 = 0.2 - 0.06 * ((s + 1) / seg);
      for (let k = 0; k < 6; k++) {
        const a0 = (k / 6) * Math.PI * 2;
        const a1 = ((k + 1) / 6) * Math.PI * 2;
        const luz = 0.75 + 0.25 * Math.cos(a0 - 2.4);
        const c = tom(marrom, luz, x, beira);
        troncos.quad(
          [
            [x + dx0 + Math.cos(a0) * r0, y0, beira + Math.sin(a0) * r0],
            [x + dx0 + Math.cos(a1) * r0, y0, beira + Math.sin(a1) * r0],
            [x + dx1 + Math.cos(a1) * r1, y1, beira + Math.sin(a1) * r1],
            [x + dx1 + Math.cos(a0) * r1, y1, beira + Math.sin(a0) * r1],
          ],
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
          ],
          [c, c, c, c]
        );
      }
    }
    const tx = x + incl;
    for (let f = 0; f < 10; f++) {
      const ang = (f / 10) * Math.PI * 2 + acaso() * 0.3;
      const comp = 2.6 + acaso() * 0.8;
      const sobe = 0.5 + acaso() * 0.4;
      const passos = 5;
      for (let s = 0; s < passos; s++) {
        const t0 = s / passos;
        const t1 = (s + 1) / passos;
        // arco: sobe um pouco e cai na ponta
        const ponto = (t: number) => [tx + Math.cos(ang) * comp * t, alt + sobe * t - 2.2 * t * t, beira + Math.sin(ang) * comp * t];
        const p0 = ponto(t0);
        const p1 = ponto(t1);
        const lx = -Math.sin(ang) * 0.42;
        const lz = Math.cos(ang) * 0.42;
        const luz = 0.8 + 0.25 * Math.cos(ang - 2.4);
        const c = tom(verde, luz, x, beira);
        folhas.quad(
          [
            [p0[0] - lx, p0[1], p0[2] - lz],
            [p1[0] - lx, p1[1], p1[2] - lz],
            [p1[0] + lx, p1[1], p1[2] + lz],
            [p0[0] + lx, p0[1], p0[2] + lz],
          ],
          [
            [t0, 0],
            [t1, 0],
            [t1, 1],
            [t0, 1],
          ],
          [c, c, c, c]
        );
      }
    }
  }

  const malhas: [Lote, THREE.Material][] = [
    [asfalto, matAsfalto],
    [calcada, matCalcada],
    [alvenaria, matAlvenaria],
    [vidro, matVidro],
    [telhado, matTelhado],
    [pintura, matPintura],
    [sinalizacao, matSinalizacao],
    [morros, matMorro],
    [troncos, matPintura],
    [folhas, matFolha],
  ];
  for (const [lote, m] of malhas) {
    if (!lote.idx.length) continue;
    const malha = lote.malha(m);
    guardar(malha.geometry);
    grupo.add(malha);
  }

  return {
    grupo,
    ceu,
    descartar: () => descartaveis.forEach((d) => d.dispose()),
  };
}
