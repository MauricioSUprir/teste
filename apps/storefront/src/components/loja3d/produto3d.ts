/**
 * Produto em 3D a partir da foto do Hub (não existe modelo 3D dos produtos):
 *
 * 1. tira o fundo branco — inundação a partir das bordas, como a varinha mágica;
 * 2. acha o contorno do produto e o extruda com a borda arredondada: de frente é
 *    a própria foto recortada, de lado tem volume com a cor do produto;
 * 3. foto que não tem fundo branco (com modelo, cenário) vira um cartaz com
 *    espessura, em vez de um recorte malfeito.
 *
 * Roda no navegador, num canvas de 256 px: poucos milissegundos por produto.
 * Origem da geometria: no meio da base do produto (fica em pé na prateleira),
 * com a frente virada para +z.
 */
import * as THREE from "three";

const LADO = 256; // resolução da foto tratada
const GRADE = 128; // resolução do contorno (2×2 px por célula)

export interface Produto3D {
  geometria: THREE.BufferGeometry;
  material: THREE.Material;
  /** altura final em metros (para mirar a câmera e o toque) */
  altura: number;
  descartar: () => void;
}

type Ponto = [number, number];

function baixarImagem(url: string): Promise<HTMLImageElement> {
  return new Promise((ok, falha) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => ok(img);
    img.onerror = () => falha(new Error("foto"));
    img.src = url;
  });
}

/** Marca o fundo (1) por inundação a partir das bordas; null = a foto não tem fundo liso. */
function acharFundo(px: Uint8ClampedArray, ret: { x0: number; y0: number; x1: number; y1: number }) {
  const n = LADO * LADO;
  const pareceFundo = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const r = px[i * 4];
    const g = px[i * 4 + 1];
    const b = px[i * 4 + 2];
    const a = px[i * 4 + 3];
    const min = Math.min(r, g, b);
    const max = Math.max(r, g, b);
    pareceFundo[i] = a < 24 || (min > 228 && max - min < 22) ? 1 : 0;
  }

  // na borda da própria foto quase tudo tem que ser fundo; se não for, é foto com cenário
  let naBorda = 0;
  let total = 0;
  for (let x = ret.x0; x < ret.x1; x++) {
    for (const y of [ret.y0, ret.y1 - 1]) {
      total++;
      naBorda += pareceFundo[y * LADO + x];
    }
  }
  for (let y = ret.y0; y < ret.y1; y++) {
    for (const x of [ret.x0, ret.x1 - 1]) {
      total++;
      naBorda += pareceFundo[y * LADO + x];
    }
  }
  if (!total || naBorda / total < 0.85) return null;

  const fundo = new Uint8Array(n);
  const fila = new Int32Array(n);
  let ini = 0;
  let fim = 0;
  const entrar = (i: number) => {
    if (pareceFundo[i] && !fundo[i]) {
      fundo[i] = 1;
      fila[fim++] = i;
    }
  };
  for (let k = 0; k < LADO; k++) {
    entrar(k);
    entrar((LADO - 1) * LADO + k);
    entrar(k * LADO);
    entrar(k * LADO + LADO - 1);
  }
  while (ini < fim) {
    const i = fila[ini++];
    const x = i % LADO;
    if (x > 0) entrar(i - 1);
    if (x < LADO - 1) entrar(i + 1);
    if (i >= LADO) entrar(i - LADO);
    if (i < n - LADO) entrar(i + LADO);
  }
  return fundo;
}

// vizinhança de Moore em sentido horário, começando pelo oeste (y para baixo)
const DX = [-1, -1, 0, 1, 1, 1, 0, -1];
const DY = [0, -1, -1, -1, 0, 1, 1, 1];
const direcao = (dx: number, dy: number) => {
  for (let d = 0; d < 8; d++) if (DX[d] === dx && DY[d] === dy) return d;
  return 0;
};

/**
 * Contorno externo de um pedaço (rastreamento de Moore). Para quando volta ao
 * primeiro pixel indo para o segundo de novo — o critério "voltou ao início"
 * sozinho dá várias voltas em formas com gargalo de um pixel.
 */
function tracar(rotulos: Int32Array, L: number, id: number, sx: number, sy: number): Ponto[] {
  const pts: Ponto[] = [];
  let x = sx;
  let y = sy;
  let volta = 0; // vizinho por onde se chegou (o oeste do primeiro pixel é fora)
  let segundo: Ponto | null = null;
  for (let passo = 0; passo < L * L; passo++) {
    let achou = false;
    for (let k = 1; k <= 8; k++) {
      const d = (volta + k) % 8;
      const nx = x + DX[d];
      const ny = y + DY[d];
      if (rotulos[ny * L + nx] !== id) continue;
      if (segundo && x === sx && y === sy && nx === segundo[0] && ny === segundo[1]) return pts;
      pts.push([x, y]);
      if (!segundo) segundo = [nx, ny];
      const anterior = (d + 7) % 8;
      const bx = x + DX[anterior];
      const by = y + DY[anterior];
      x = nx;
      y = ny;
      volta = direcao(bx - x, by - y);
      achou = true;
      break;
    }
    if (!achou) return pts.length ? pts : [[x, y]]; // pixel solto
  }
  return pts;
}

function distSegmento(p: Ponto, a: Ponto, b: Ponto) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

/** Ramer–Douglas–Peucker numa linha aberta. */
function simplificar(p: Ponto[], eps: number): Ponto[] {
  if (p.length < 3) return p;
  let idx = -1;
  let max = 0;
  for (let i = 1; i < p.length - 1; i++) {
    const d = distSegmento(p[i], p[0], p[p.length - 1]);
    if (d > max) {
      max = d;
      idx = i;
    }
  }
  if (max <= eps) return [p[0], p[p.length - 1]];
  const a = simplificar(p.slice(0, idx + 1), eps);
  const b = simplificar(p.slice(idx), eps);
  return [...a.slice(0, -1), ...b];
}

function simplificarFechado(p: Ponto[], eps: number): Ponto[] {
  let longe = 0;
  let max = 0;
  for (let i = 1; i < p.length; i++) {
    const d = Math.hypot(p[i][0] - p[0][0], p[i][1] - p[0][1]);
    if (d > max) {
      max = d;
      longe = i;
    }
  }
  if (!longe) return p;
  const a = simplificar(p.slice(0, longe + 1), eps);
  const b = simplificar([...p.slice(longe), p[0]], eps);
  return [...a.slice(0, -1), ...b.slice(0, -1)];
}

/** Contornos dos pedaços do produto (em coordenadas de textura, v para cima). */
function contornos(fundo: Uint8Array): Ponto[][] {
  const L = GRADE + 2; // borda de 1 célula vazia: o rastreamento nunca sai da grade
  const cel = LADO / GRADE;
  const cheio = new Uint8Array(L * L);
  for (let gy = 0; gy < GRADE; gy++) {
    for (let gx = 0; gx < GRADE; gx++) {
      let produto = 0;
      for (let yy = 0; yy < cel; yy++) {
        for (let xx = 0; xx < cel; xx++) produto += fundo[(gy * cel + yy) * LADO + gx * cel + xx] ? 0 : 1;
      }
      cheio[(gy + 1) * L + gx + 1] = produto * 2 >= cel * cel ? 1 : 0;
    }
  }

  // pedaços (8-vizinhos); os muito pequenos são sujeira da foto
  const rotulos = new Int32Array(L * L);
  const pedacos: { id: number; area: number; sx: number; sy: number }[] = [];
  const fila = new Int32Array(L * L);
  for (let i = 0; i < L * L; i++) {
    if (!cheio[i] || rotulos[i]) continue;
    const id = pedacos.length + 1;
    let ini = 0;
    let fim = 0;
    rotulos[i] = id;
    fila[fim++] = i;
    while (ini < fim) {
      const j = fila[ini++];
      const x = j % L;
      const y = (j - x) / L;
      for (let d = 0; d < 8; d++) {
        const k = (y + DY[d]) * L + x + DX[d];
        if (cheio[k] && !rotulos[k]) {
          rotulos[k] = id;
          fila[fim++] = k;
        }
      }
    }
    pedacos.push({ id, area: fim, sx: i % L, sy: Math.floor(i / L) });
  }
  const maior = Math.max(0, ...pedacos.map((p) => p.area));
  return pedacos
    .filter((p) => p.area >= Math.max(10, maior * 0.03))
    .map((p) => simplificarFechado(tracar(rotulos, L, p.id, p.sx, p.sy), 1.1))
    .filter((c) => c.length >= 3)
    .map((c) => c.map(([x, y]): Ponto => [(x - 0.5) / GRADE, 1 - (y - 0.5) / GRADE]));
}

/**
 * Uma chamada de desenho por produto: frente e laterais no mesmo material. As
 * laterais apontam (uv) para um pedaço branco e opaco da textura e levam a cor
 * e o sombreado no vértice; a frente fica sem luz, com a cor fiel da foto.
 */
function umMaterialSo(
  geo: THREE.BufferGeometry,
  ehFrente: (vertice: number) => boolean,
  uvBranco: [number, number],
  corLado: THREE.Color
) {
  const n = geo.attributes.position.count;
  const uv = geo.attributes.uv;
  const normal = geo.attributes.normal;
  const cores = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    if (ehFrente(i)) {
      cores.set([1, 1, 1], i * 3);
      continue;
    }
    uv.setXY(i, uvBranco[0], uvBranco[1]);
    // luz que vem de cima e da frente, igual para os dois lados do corredor
    const luz = THREE.MathUtils.clamp(0.72 + 0.28 * normal.getY(i) + 0.1 * normal.getZ(i), 0.45, 1);
    cores.set([corLado.r * luz, corLado.g * luz, corLado.b * luz], i * 3);
  }
  uv.needsUpdate = true;
  geo.setAttribute("color", new THREE.BufferAttribute(cores, 3));
  geo.clearGroups();
}

export async function montarProduto3D(url: string, larguraMax: number, alturaMax: number): Promise<Produto3D> {
  const img = await baixarImagem(url);
  const c = document.createElement("canvas");
  c.width = c.height = LADO;
  const g = c.getContext("2d", { willReadFrequently: true });
  if (!g) throw new Error("canvas");
  const r = Math.min((LADO - 8) / img.width, (LADO - 8) / img.height);
  const w = Math.round(img.width * r);
  const h = Math.round(img.height * r);
  const x0 = Math.round((LADO - w) / 2);
  const y0 = Math.round((LADO - h) / 2);
  g.drawImage(img, x0, y0, w, h);
  const dados = g.getImageData(0, 0, LADO, LADO);
  const px = dados.data;

  const lixo: { dispose: () => void }[] = [];
  const guardar = <T extends { dispose: () => void }>(x: T) => (lixo.push(x), x);
  const descartar = () => lixo.forEach((x) => x.dispose());

  const fundo = acharFundo(px, { x0, y0, x1: x0 + w, y1: y0 + h });
  const pedacos = fundo ? contornos(fundo) : [];

  // contorno complicado demais (foto com muita coisa) pesaria a loja inteira: vira cartaz
  const pontosContorno = pedacos.reduce((n, p) => n + p.length, 0);
  if (!fundo || !pedacos.length || pontosContorno > 700) {
    // cartaz: a foto inteira numa placa fina, em pé na prateleira
    g.globalCompositeOperation = "destination-over";
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, LADO, LADO);
    const tex = guardar(new THREE.CanvasTexture(c));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const lado = Math.min(larguraMax, alturaMax) * 0.95;
    const geo = guardar(new THREE.BoxGeometry(lado, lado, 0.014));
    geo.translate(0, lado / 2, 0);
    // vértices da caixa, 4 por face: +x, -x, +y, -y, +z (frente, 16 a 19), -z;
    // a borda usa a margem branca de 4 px em volta da foto
    umMaterialSo(geo, (i) => i >= 16 && i < 20, [2 / LADO, 0.5], new THREE.Color("#e4e4ea"));
    const material = guardar(new THREE.MeshBasicMaterial({ map: tex, vertexColors: true }));
    return { geometria: geo, material, altura: lado, descartar };
  }

  // recorte: fundo transparente; o pixel claro colado no fundo também sai (sem halo branco)
  let somaR = 0;
  let somaG = 0;
  let somaB = 0;
  let somaN = 0;
  let uMin = 1;
  let uMax = 0;
  let vMin = 1;
  let vMax = 0;
  for (let y = 0; y < LADO; y++) {
    for (let x = 0; x < LADO; x++) {
      const i = y * LADO + x;
      if (fundo[i]) {
        px[i * 4 + 3] = 0;
        continue;
      }
      const vizinhoFundo =
        (x > 0 && fundo[i - 1]) || (x < LADO - 1 && fundo[i + 1]) || (y > 0 && fundo[i - LADO]) || (y < LADO - 1 && fundo[i + LADO]);
      const claro = Math.min(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]) > 205;
      if (vizinhoFundo && claro) {
        px[i * 4 + 3] = 0;
        continue;
      }
      somaR += px[i * 4];
      somaG += px[i * 4 + 1];
      somaB += px[i * 4 + 2];
      somaN++;
      uMin = Math.min(uMin, x / LADO);
      uMax = Math.max(uMax, (x + 1) / LADO);
      vMin = Math.min(vMin, 1 - (y + 1) / LADO);
      vMax = Math.max(vMax, 1 - y / LADO);
    }
  }
  // pedaço branco e opaco num canto vazio, para as laterais (16 px: continua opaco nos mipmaps)
  const cantos: [number, number][] = [[0, 0], [LADO - 16, 0], [0, LADO - 16], [LADO - 16, LADO - 16]];
  const vazio = ([cx, cy]: [number, number]) => {
    for (let y = cy; y < cy + 16; y++) for (let x = cx; x < cx + 16; x++) if (px[(y * LADO + x) * 4 + 3]) return false;
    return true;
  };
  const [bx, by] = cantos.find(vazio) ?? cantos[0];
  for (let y = by; y < by + 16; y++) px.fill(255, (y * LADO + bx) * 4, (y * LADO + bx + 16) * 4);
  g.putImageData(dados, 0, 0);
  const tex = guardar(new THREE.CanvasTexture(c));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;

  const escala = Math.min(larguraMax / Math.max(uMax - uMin, 0.01), alturaMax / Math.max(vMax - vMin, 0.01));
  const largura = (uMax - uMin) * escala;
  const altura = (vMax - vMin) * escala;
  const espessura = THREE.MathUtils.clamp(Math.min(largura, altura) * 0.32, 0.025, 0.08);
  const chanfro = 0.004;
  const formas = pedacos.map((p) => new THREE.Shape(p.map(([u, v]) => new THREE.Vector2(u, v))));
  // em unidades de textura: as faces da frente e do verso ganham uv = (x, y) da forma,
  // então a foto cai exatamente no contorno; depois a geometria vai para metros
  const geo = guardar(
    new THREE.ExtrudeGeometry(formas, {
      depth: espessura / escala,
      steps: 1,
      curveSegments: 1,
      bevelEnabled: true,
      bevelThickness: chanfro / escala,
      bevelSize: chanfro / escala,
      bevelOffset: -chanfro / escala,
      bevelSegments: 1,
    })
  );
  geo.translate(-(uMin + uMax) / 2, -vMin, -espessura / escala / 2);
  geo.scale(escala, escala, escala);

  const cor = new THREE.Color(somaR / somaN / 255, somaG / somaN / 255, somaB / somaN / 255).convertSRGBToLinear();
  cor.multiplyScalar(0.85);
  // a extrusão marca, para cada pedaço, frente e verso com o material 0 e as laterais com o 1
  const tampas = geo.groups.filter((gr) => gr.materialIndex === 0);
  const ehTampa = (i: number) => tampas.some((t) => i >= t.start && i < t.start + t.count);
  umMaterialSo(geo, ehTampa, [(bx + 8) / LADO, 1 - (by + 8) / LADO], cor);
  const material = guardar(new THREE.MeshBasicMaterial({ map: tex, vertexColors: true, alphaTest: 0.5 }));
  return { geometria: geo, material, altura, descartar };
}
