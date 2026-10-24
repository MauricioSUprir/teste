/**
 * Loja 3D — a cena em three.js (sem React), no estilo de uma loja-conceito de
 * beleza: salão de piso claro, estantes iluminadas nas paredes (uma por
 * categoria, com o nome em cima), ilhas e mesa redonda no meio, caixa com o
 * logo na parede do fundo, cantinho com sofá e vitrine de vidro na entrada.
 *
 * Abre na vista do alto — a loja inteira, como uma maquete. Clicar numa
 * estante, num produto ou no chão leva a câmera até lá, na altura dos olhos.
 * De perto, a pessoa olha em volta arrastando e anda clicando no chão; o
 * caminho desvia dos móveis (busca A* numa grade do piso). O card do produto é
 * React, fora daqui.
 *
 * Desempenho: o cenário fixo vira uma malha por material (poucas chamadas de
 * desenho), cada produto é uma malha instanciada (as frentes repetidas são a
 * mesma malha) e as fotos baixam aos poucos, das mais perto para as mais longe.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { montarProduto3D } from "./produto3d";

export interface ProdutoCena {
  slug: string;
  foto: string;
}

/** um setor da loja = uma categoria */
export interface CorredorCena {
  numero: string;
  nome: string;
  produtos: ProdutoCena[];
}

export interface LinhaLogo {
  texto: string;
  destaque: boolean;
}

export type ModoCena = "alto" | "perto";

export interface PosicaoCena {
  modo: ModoCena;
  x: number;
  z: number;
  yaw: number;
  pitch: number;
}

export interface OpcoesCena {
  corredores: CorredorCena[];
  /** linhas do logo na parede do fundo e na vitrine */
  logo: LinhaLogo[];
  /** frase do painel da vitrine (null = repete o logo) */
  fraseVitrine: string | null;
  /** título das estantes que sobram quando há poucas categorias */
  tituloDestaques: string;
  corPrimaria: string;
  fonte: string;
  aoSelecionarProduto: (slug: string) => void;
  aoMudarCorredor: (indice: number | null) => void;
  aoMudarModo: (modo: ModoCena) => void;
  aoChegarPrateleira: () => void;
  /** onde a pessoa estava antes de abrir um produto (volta para o mesmo lugar) */
  inicio?: PosicaoCena;
}

export interface Cena {
  irParaCorredor: (indice: number) => void;
  irParaVisaoGeral: () => void;
  posicao: () => PosicaoCena;
  destruir: () => void;
}

const OLHO = 1.6; // altura dos olhos
const LARGURA = 18; // salão (x)
const FUNDO = 12.5; // salão (z); a entrada fica em +z
const X0 = -LARGURA / 2;
const X1 = LARGURA / 2;
const Z0 = -FUNDO / 2;
const Z1 = FUNDO / 2;
const ALTURA = 3.4; // pé-direito
const PAREDE = 0.35;
const PROF_ESTANTE = 0.45;
const PROD_L = 0.2; // o produto cabe nessa largura...
const PROD_A = 0.3; // ...e nessa altura (estantes de 40 cm)
const FRENTES = 2; // quantas frentes seguidas de cada produto
const CELULA = 0.2; // grade do piso para achar caminho
const RAIO = 0.35; // folga da pessoa para os móveis
const EL_ALTO = 0.86; // inclinação da vista do alto
const DIST_ALTO = 21;
const ALVO_ALTO = new THREE.Vector3(0, 0, 0.4);
const FOV_PERTO = 62;

const limitar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
/** diferença entre ângulos pelo caminho mais curto */
const difAngulo = (alvo: number, atual: number) => Math.atan2(Math.sin(alvo - atual), Math.cos(alvo - atual));
const suave = (t: number) => t * t * (3 - 2 * t);
const eixoY = new THREE.Vector3(0, 1, 0);

function textura(largura: number, altura: number, desenhar: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas");
  c.width = largura;
  c.height = altura;
  const g = c.getContext("2d");
  if (g) desenhar(g);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** texto centrado com espaço entre as letras (o canvas não tem isso em todo navegador) */
function escreverEspacado(g: CanvasRenderingContext2D, texto: string, x: number, y: number, espaco: number) {
  const letras = [...texto];
  const larguras = letras.map((l) => g.measureText(l).width);
  const total = larguras.reduce((a, b) => a + b, 0) + espaco * (letras.length - 1);
  let cx = x - total / 2;
  g.textAlign = "left";
  letras.forEach((l, i) => {
    g.fillText(l, cx, y);
    cx += larguras[i] + espaco;
  });
}

/** retângulo de cantos redondos; com o raio padrão vira "pílula" */
function formaPilula(comp: number, larg: number, raio = larg / 2) {
  const r = Math.min(raio, larg / 2, comp / 2);
  const s = new THREE.Shape();
  const x = comp / 2 - r;
  const y = larg / 2 - r;
  s.moveTo(-x, -larg / 2);
  s.lineTo(x, -larg / 2);
  s.absarc(x, -y, r, -Math.PI / 2, 0, false);
  s.lineTo(comp / 2, y);
  s.absarc(x, y, r, 0, Math.PI / 2, false);
  s.lineTo(-x, larg / 2);
  s.absarc(-x, y, r, Math.PI / 2, Math.PI, false);
  s.lineTo(-comp / 2, -y);
  s.absarc(-x, -y, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

/** forma 2D extrudada para cima: o (x, y) da forma vira o (x, -z) do chão */
function extrudarDeitado(forma: THREE.Shape, altura: number, chanfro = 0) {
  const geo = new THREE.ExtrudeGeometry(forma, {
    depth: altura - chanfro * 2,
    bevelEnabled: chanfro > 0,
    bevelThickness: chanfro,
    bevelSize: chanfro,
    bevelOffset: -chanfro,
    bevelSegments: 2,
    curveSegments: 10,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, chanfro, 0);
  return geo;
}

/** referencial de um móvel: u ao longo da frente, v para fora (para onde a frente olha) */
class Moldura {
  constructor(
    readonly cx: number,
    readonly cz: number,
    readonly ang: number
  ) {}
  ponto(u: number, v: number): [number, number] {
    const c = Math.cos(this.ang);
    const s = Math.sin(this.ang);
    return [this.cx + c * u + s * v, this.cz - s * u + c * v];
  }
  local(x: number, z: number): [number, number] {
    const dx = x - this.cx;
    const dz = z - this.cz;
    const c = Math.cos(this.ang);
    const s = Math.sin(this.ang);
    return [c * dx - s * dz, s * dx + c * dz];
  }
}

interface Vista {
  x: number;
  z: number;
  yaw: number;
  pitch: number;
  setor: number | null;
}

interface Vaga {
  pos: THREE.Vector3; // base do produto
  ang: number; // para onde a frente do produto olha
  escala: number;
  vista: Vista;
}

interface ProdutoMalha {
  slug: string;
  malha: THREE.InstancedMesh;
  vagas: Vaga[];
  altura: number;
  estado: "nada" | "baixando" | "pronto";
}

interface Pose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
}

export function criarCena(container: HTMLElement, op: OpcoesCena): Cena {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const canvas = renderer.domElement;
  Object.assign(canvas.style, { display: "block", width: "100%", height: "100%", touchAction: "none", cursor: "grab" });
  container.appendChild(canvas);

  const cena = new THREE.Scene();
  cena.background = new THREE.Color("#e9e9ed");
  const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 140);
  camera.rotation.order = "YXZ";

  const descartar: { dispose: () => void }[] = [];
  function guardar<T extends { dispose: () => void }>(x: T): T {
    descartar.push(x);
    return x;
  }

  // ---- cores e materiais
  const branco = new THREE.Color("#ffffff");
  const primaria = new THREE.Color(op.corPrimaria);
  const lilas = primaria.clone().lerp(branco, 0.5);
  const lilasClaro = primaria.clone().lerp(branco, 0.74);
  const hex = (c: THREE.Color) => `#${c.getHexString()}`;
  const lambert = (cor: THREE.ColorRepresentation, extra: THREE.MeshLambertMaterialParameters = {}) =>
    guardar(new THREE.MeshLambertMaterial({ color: cor, ...extra }));
  const basico = (cor: THREE.ColorRepresentation, extra: THREE.MeshBasicMaterialParameters = {}) =>
    guardar(new THREE.MeshBasicMaterial({ color: cor, ...extra }));
  const mat = {
    parede: lambert("#f5f0e9"),
    casca: lambert("#2d2d34"),
    movel: lambert("#fbf9f6"),
    tampo: lambert("#ffffff"),
    marca: lambert("#f7f4ef"),
    led: basico("#ffeccb"),
    metal: lambert("#3a3a41"),
    vaso: lambert("#f3efe9"),
    tronco: lambert("#7b5b3f"),
    folha: [
      lambert("#5c8b49", { flatShading: true }),
      lambert("#497a3a", { flatShading: true }),
      lambert("#74a35d", { flatShading: true }),
    ],
    sofa: lambert("#eee6dd"),
    tapete: lambert(lilasClaro),
    pe: lambert(primaria.clone().lerp(new THREE.Color("#1d1530"), 0.45)),
    monitor: lambert("#1e1e23"),
    rua: lambert("#e4e4e8"),
    capacho: lambert("#45454c"),
  };

  // ---- cenário fixo: tudo é juntado numa malha por material no fim
  const lotes = new Map<THREE.Material, THREE.BufferGeometry[]>();
  function juntar(m: THREE.Material, geo: THREE.BufferGeometry, matriz?: THREE.Matrix4) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (matriz) g.applyMatrix4(matriz);
    for (const nome of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(nome)) g.deleteAttribute(nome);
    g.clearGroups();
    const lista = lotes.get(m) ?? [];
    lista.push(g);
    lotes.set(m, lista);
  }
  const auxQ = new THREE.Quaternion();
  const matriz = (x: number, y: number, z: number, ang = 0, sx = 1, sy = 1, sz = 1) =>
    new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), auxQ.setFromAxisAngle(eixoY, ang), new THREE.Vector3(sx, sy, sz));
  const geoCaixa = guardar(new THREE.BoxGeometry(1, 1, 1));
  const geoPlano = guardar(new THREE.PlaneGeometry(1, 1));
  const geoCilindro = guardar(new THREE.CylinderGeometry(1, 1, 1, 32));
  const geoBola = guardar(new THREE.IcosahedronGeometry(1, 0));
  const geoChao = guardar(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2));

  /** caixa no referencial do móvel: centro em (u, y, v), tamanho ao longo de u, y e v */
  function caixa(m: THREE.Material, f: Moldura, u: number, y: number, v: number, su: number, sy: number, sv: number) {
    const [x, z] = f.ponto(u, v);
    juntar(m, geoCaixa, matriz(x, y, z, f.ang, su, sy, sv));
  }
  /** plano de frente para v, com textura própria (malha separada) */
  function placa(tex: THREE.Texture, f: Moldura, u: number, y: number, v: number, su: number, sy: number) {
    const malha = new THREE.Mesh(geoPlano, basico("#ffffff", { map: tex }));
    const [x, z] = f.ponto(u, v);
    malha.position.set(x, y, z);
    malha.rotation.y = f.ang;
    malha.scale.set(su, sy, 1);
    cena.add(malha);
    return malha;
  }

  // decalques no chão: luz quente na frente das estantes, sombra embaixo dos móveis
  const texMancha = guardar(
    textura(64, 64, (g) => {
      const gr = g.createRadialGradient(32, 32, 1, 32, 32, 31);
      gr.addColorStop(0, "rgba(255,255,255,1)");
      gr.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gr;
      g.fillRect(0, 0, 64, 64);
    })
  );
  const decalque = (cor: THREE.ColorRepresentation, opacidade: number) =>
    basico(cor, { map: texMancha, transparent: true, opacity: opacidade, depthWrite: false });
  const matSombra = decalque("#3b2d24", 0.2);
  const matLuzChao = decalque("#ffdca3", 0.55);
  const matLuzRoxa = decalque(lilas, 0.4);
  function mancha(m: THREE.Material, x: number, z: number, sx: number, sz: number, ang = 0) {
    juntar(m, geoChao, matriz(x, 0.004, z, ang, sx, 1, sz));
  }

  // ---- grade do piso (onde dá para pisar)
  const GX = Math.round(LARGURA / CELULA);
  const GZ = Math.round(FUNDO / CELULA);
  const livre = new Uint8Array(GX * GZ).fill(1);
  const celX = (i: number) => X0 + (i + 0.5) * CELULA;
  const celZ = (j: number) => Z0 + (j + 0.5) * CELULA;
  for (let j = 0; j < GZ; j++) {
    for (let i = 0; i < GX; i++) {
      const x = celX(i);
      const z = celZ(j);
      if (x < X0 + RAIO || x > X1 - RAIO || z < Z0 + RAIO || z > Z1 - RAIO) livre[j * GX + i] = 0;
    }
  }
  function bloquearRet(f: Moldura, u0: number, u1: number, v0: number, v1: number) {
    for (let j = 0; j < GZ; j++) {
      for (let i = 0; i < GX; i++) {
        const [u, v] = f.local(celX(i), celZ(j));
        if (u > u0 - RAIO && u < u1 + RAIO && v > v0 - RAIO && v < v1 + RAIO) livre[j * GX + i] = 0;
      }
    }
  }
  function bloquearCirculo(x: number, z: number, r: number) {
    for (let j = 0; j < GZ; j++) {
      for (let i = 0; i < GX; i++) if (Math.hypot(celX(i) - x, celZ(j) - z) < r + RAIO) livre[j * GX + i] = 0;
    }
  }

  // ---- alvos de clique dos móveis (caixas invisíveis) e vagas dos produtos
  const volumes: THREE.Mesh[] = [];
  const matInvisivel = basico("#000000");
  type QualVista = ((p: THREE.Vector3) => Vista) | null;
  function volume(geo: THREE.BufferGeometry, x: number, y: number, z: number, ang: number, sx: number, sy: number, sz: number, vista: QualVista) {
    const m = new THREE.Mesh(geo, matInvisivel);
    m.position.set(x, y, z);
    m.rotation.y = ang;
    m.scale.set(sx, sy, sz);
    m.visible = false;
    m.userData = { vista };
    m.updateMatrixWorld();
    cena.add(m);
    volumes.push(m);
  }
  function volumeCaixa(f: Moldura, u: number, y: number, v: number, su: number, sy: number, sv: number, vista: QualVista) {
    const [x, z] = f.ponto(u, v);
    volume(geoCaixa, x, y, z, f.ang, su, sy, sv, vista);
  }
  /** de pé a `dist` metros da frente do móvel, olhando para o ponto (u, alturaAlvo) */
  function vistaDe(f: Moldura, u: number, vFrente: number, dist: number, alturaAlvo: number, setor: number | null): Vista {
    const [x, z] = f.ponto(u, vFrente + dist);
    return { x, z, yaw: f.ang, pitch: Math.atan2(alturaAlvo - OLHO, dist), setor };
  }

  const vagasPorProduto = new Map<string, Vaga[]>();
  const fotoDe = new Map<string, string>();
  function vaga(p: ProdutoCena, x: number, y: number, z: number, ang: number, escala: number, vista: Vista) {
    fotoDe.set(p.slug, p.foto);
    const lista = vagasPorProduto.get(p.slug) ?? [];
    lista.push({ pos: new THREE.Vector3(x, y, z), ang, escala, vista });
    vagasPorProduto.set(p.slug, lista);
  }

  // quem enche cada móvel: uma categoria, ou uma mistura de todas (ilhas e mesas)
  const N = op.corredores.length;
  const usados = new Array<number>(N).fill(0);
  let vez = 0;
  function proximoMisto(): ProdutoCena | null {
    for (let t = 0; t < N; t++) {
      const s = vez++ % N;
      const lista = op.corredores[s].produtos;
      if (usados[s] < lista.length) return lista[usados[s]++];
    }
    // tudo já apareceu: repete, alternando as categorias
    for (let t = 0; t < N; t++) {
      const s = vez++ % N;
      const lista = op.corredores[s].produtos;
      if (lista.length) return lista[(vez * 7) % lista.length];
    }
    return null;
  }
  /** devolve o produto de cada vaga, repetindo cada um em FRENTES vagas seguidas */
  function fornecedor(setor: number | null) {
    let k = 0;
    let atual: ProdutoCena | null = null;
    return () => {
      if (k++ % FRENTES === 0) {
        if (setor === null) atual = proximoMisto();
        else {
          const lista = op.corredores[setor].produtos;
          atual = lista.length ? lista[usados[setor]++ % lista.length] : null;
        }
      }
      return atual;
    };
  }

  // ---- textos e painéis
  function texTitulo(texto: string) {
    return guardar(
      textura(1024, 128, (g) => {
        g.fillStyle = "#fbf9f6";
        g.fillRect(0, 0, 1024, 128);
        g.fillStyle = "#2a2a31";
        let tam = 64;
        g.font = `600 ${tam}px ${op.fonte}`;
        while (tam > 28 && g.measureText(texto).width + texto.length * tam * 0.16 > 960) {
          tam -= 4;
          g.font = `600 ${tam}px ${op.fonte}`;
        }
        g.textBaseline = "middle";
        escreverEspacado(g, texto, 512, 68, tam * 0.16);
      })
    );
  }
  /** logo em linhas: a fina (espaçada) e a forte, como no topo do site */
  function desenharLogo(g: CanvasRenderingContext2D, cx: number, cy: number, base: number, corFina: string, corForte: string) {
    const linhas = op.logo.map((l) => ({ ...l, tam: l.destaque ? base : base * 0.34 }));
    const alturaDe = (l: { destaque: boolean; tam: number }) => l.tam * (l.destaque ? 0.95 : 1.25);
    let y = cy - linhas.reduce((a, l) => a + alturaDe(l), 0) / 2;
    g.textBaseline = "middle";
    for (const l of linhas) {
      const h = alturaDe(l);
      g.fillStyle = l.destaque ? corForte : corFina;
      g.font = `${l.destaque ? 900 : 400} ${l.tam}px ${op.fonte}`;
      escreverEspacado(g, l.texto, cx, y + h / 2, l.destaque ? l.tam * 0.02 : l.tam * 0.42);
      y += h;
    }
  }
  /** painel roxo iluminado com ondas suaves (os da vitrine e das paredes) */
  function texPainelRoxo(largura: number, altura: number, conteudo?: (g: CanvasRenderingContext2D) => void) {
    return guardar(
      textura(largura, altura, (g) => {
        const fundo = g.createLinearGradient(0, 0, largura, altura);
        fundo.addColorStop(0, hex(lilasClaro));
        fundo.addColorStop(1, hex(lilas));
        g.fillStyle = fundo;
        g.fillRect(0, 0, largura, altura);
        for (let k = 0; k < 5; k++) {
          const cx = largura * (0.2 + 0.18 * k);
          const cy = altura * (0.85 - 0.16 * k);
          const r = Math.max(largura, altura) * (0.35 - 0.04 * k);
          const gr = g.createRadialGradient(cx, cy, r * 0.55, cx, cy, r);
          gr.addColorStop(0, "rgba(255,255,255,0)");
          gr.addColorStop(0.85, "rgba(255,255,255,0.28)");
          gr.addColorStop(1, "rgba(255,255,255,0)");
          g.fillStyle = gr;
          g.fillRect(0, 0, largura, altura);
        }
        conteudo?.(g);
      })
    );
  }
  const matFundoEstante = basico("#ffffff", {
    map: guardar(
      textura(256, 256, (g) => {
        const gr = g.createRadialGradient(128, 120, 10, 128, 128, 190);
        gr.addColorStop(0, "#fff6e6");
        gr.addColorStop(1, "#ead8bf");
        g.fillStyle = gr;
        g.fillRect(0, 0, 256, 256);
      })
    ),
  });

  // ---- piso, rua, paredes e teto
  const texPiso = guardar(
    textura(256, 256, (g) => {
      g.fillStyle = "#f2ece5";
      g.fillRect(0, 0, 256, 256);
      g.strokeStyle = "#e3dad0";
      g.lineWidth = 3;
      g.strokeRect(1.5, 1.5, 253, 253);
    })
  );
  texPiso.wrapS = texPiso.wrapT = THREE.RepeatWrapping;
  texPiso.repeat.set(LARGURA / 1.2, FUNDO / 1.2);
  const piso = new THREE.Mesh(guardar(new THREE.PlaneGeometry(LARGURA, FUNDO)), lambert("#ffffff", { map: texPiso }));
  piso.rotation.x = -Math.PI / 2;
  cena.add(piso);
  juntar(mat.rua, geoChao, matriz(0, -0.01, 0, 0, 90, 1, 90));
  juntar(mat.capacho, geoCaixa, matriz(0, 0.006, Z1 + PAREDE + 0.55, 0, 1.9, 0.012, 0.8));

  const paredeFundo = new Moldura(0, Z0, 0);
  caixa(mat.casca, paredeFundo, 0, ALTURA / 2, -PAREDE / 2, LARGURA + PAREDE * 2, ALTURA, PAREDE);
  caixa(mat.parede, paredeFundo, 0, ALTURA / 2, 0.01, LARGURA, ALTURA, 0.02);
  volumeCaixa(paredeFundo, 0, ALTURA / 2, -0.05, LARGURA, ALTURA, 0.1, null);
  for (const lado of [-1, 1]) {
    caixa(mat.casca, new Moldura(lado * (X1 + PAREDE / 2), 0, Math.PI / 2), 0, ALTURA / 2, 0, FUNDO, ALTURA, PAREDE);
    caixa(mat.parede, new Moldura(lado * (X1 - 0.01), 0, Math.PI / 2), 0, ALTURA / 2, 0, FUNDO, ALTURA, 0.02);
    volumeCaixa(new Moldura(lado * (X1 + 0.05), 0, Math.PI / 2), 0, ALTURA / 2, 0, FUNDO, ALTURA, 0.1, null);
  }

  // frente: pilares escuros, vidro e porta dupla no meio
  const fachada = new Moldura(0, Z1 + PAREDE / 2, 0);
  const VAO = 1.25; // meia porta
  for (const x of [-(X1 + PAREDE / 2 - 0.25), -(VAO + 0.25), VAO + 0.25, X1 + PAREDE / 2 - 0.25]) {
    caixa(mat.casca, fachada, x, ALTURA / 2, 0, 0.5 + (Math.abs(x) > 5 ? PAREDE : 0), ALTURA, PAREDE + 0.1);
  }
  caixa(mat.casca, fachada, 0, ALTURA - 0.25, 0, LARGURA + PAREDE * 2, 0.5, PAREDE);
  const matVidro = basico("#d9e6ee", { transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
  const altVidro = ALTURA - 0.5;
  for (const lado of [-1, 1]) {
    const comp = X1 - 0.5 - (VAO + 0.5);
    const meio = lado * (VAO + 0.5 + comp / 2);
    juntar(matVidro, geoPlano, matriz(meio, altVidro / 2, Z1 + 0.02, 0, comp, altVidro, 1));
    for (const k of [-1, 0, 1]) caixa(mat.metal, fachada, meio + k * (comp / 2), altVidro / 2, -0.1, 0.05, altVidro, 0.06);
    juntar(matVidro, geoPlano, matriz((lado * VAO) / 2, 1.35, Z1 + 0.04, 0, VAO - 0.06, 2.7, 1));
    caixa(mat.metal, fachada, lado * (VAO - 0.03), 1.35, -0.12, 0.05, 2.7, 0.05);
    caixa(mat.metal, fachada, lado * 0.03, 1.35, -0.12, 0.05, 2.7, 0.05);
    caixa(mat.metal, fachada, lado * 0.22, 1.1, -0.06, 0.03, 0.9, 0.03); // puxador
  }
  juntar(matVidro, geoPlano, matriz(0, 2.8, Z1 + 0.04, 0, VAO * 2, 0.2, 1));
  caixa(mat.metal, fachada, 0, 2.7, -0.12, VAO * 2, 0.05, 0.05);
  volumeCaixa(new Moldura(0, Z1 + 0.05, 0), 0, ALTURA / 2, 0, LARGURA, ALTURA, 0.1, null);

  // teto (só de perto; de cima a loja fica aberta, como maquete)
  const teto = new THREE.Group();
  // sem luz: o forro de verdade é claro, e a luz do chão o deixaria cinza
  const forro = new THREE.Mesh(guardar(new THREE.PlaneGeometry(LARGURA, FUNDO)), basico("#f4f0ea"));
  forro.rotation.x = Math.PI / 2;
  forro.position.y = ALTURA;
  teto.add(forro);
  const spots = new THREE.InstancedMesh(guardar(new THREE.CircleGeometry(0.09, 16).rotateX(Math.PI / 2)), basico("#fff6e4"), 200);
  let nSpot = 0;
  for (let x = X0 + 1; x < X1; x += 2) for (let z = Z0 + 1; z < Z1; z += 2) spots.setMatrixAt(nSpot++, matriz(x, ALTURA - 0.005, z));
  spots.count = nSpot;
  teto.add(spots);
  cena.add(teto);

  // ---- luz
  cena.add(new THREE.HemisphereLight(0xfffaf2, 0xe6ddd3, 2.5));
  const sol = new THREE.DirectionalLight(0xffffff, 1.0);
  sol.position.set(-4, 10, 7);
  cena.add(sol);

  // ---- móveis
  function planta(x: number, z: number, e = 1, y = 0) {
    juntar(mat.vaso, geoCilindro, matriz(x, y + 0.22 * e, z, 0, 0.2 * e, 0.44 * e, 0.2 * e));
    juntar(mat.tronco, geoCilindro, matriz(x, y + 0.6 * e, z, 0, 0.025 * e, 0.5 * e, 0.025 * e));
    const folhas: [number, number, number, number][] = [
      [0, 1.05, 0, 0.3],
      [0.16, 0.9, 0.05, 0.22],
      [-0.15, 0.95, -0.06, 0.24],
      [0.04, 1.25, -0.1, 0.22],
      [-0.06, 0.82, 0.14, 0.2],
      [0.12, 1.15, 0.12, 0.2],
    ];
    folhas.forEach(([fx, fy, fz, r], k) =>
      juntar(mat.folha[k % 3], geoBola, matriz(x + fx * e, y + fy * e, z + fz * e, k * 1.3, r * e, r * e * 0.9, r * e))
    );
    if (y === 0) {
      bloquearCirculo(x, z, 0.22 * e);
      mancha(matSombra, x, z, 0.7 * e, 0.7 * e);
    }
  }

  /** estante de parede: armário embaixo, 3 tábuas iluminadas e o nome em cima */
  const vistasSetor: (Vista | null)[] = new Array<Vista | null>(N).fill(null);
  function estante(cx: number, cz: number, ang: number, larg: number, setor: number | null, titulo: string) {
    const f = new Moldura(cx, cz, ang);
    const P = PROF_ESTANTE;
    const [fx, fz] = f.ponto(0, 0.02);
    juntar(matFundoEstante, geoPlano, matriz(fx, 1.36, fz, ang, larg - 0.1, 1.72, 1));
    for (const lado of [-1, 1]) caixa(mat.movel, f, lado * (larg / 2 - 0.03), 1.25, P / 2, 0.06, 2.5, P);
    caixa(mat.movel, f, 0, 0.25, P / 2, larg, 0.5, P);
    caixa(mat.movel, f, 0, 2.36, P / 2, larg, 0.28, P);
    caixa(mat.led, f, 0, 0.505, P - 0.02, larg - 0.1, 0.01, 0.02);
    const tabuas = [0.92, 1.32, 1.72];
    for (const h of tabuas) {
      caixa(mat.movel, f, 0, h - 0.0125, P / 2 + 0.02, larg - 0.1, 0.025, P - 0.04);
      caixa(mat.led, f, 0, h - 0.032, P - 0.04, larg - 0.12, 0.01, 0.015);
    }
    placa(texTitulo(titulo), f, 0, 2.36, P + 0.002, larg - 0.24, 0.2);
    const [lx, lz] = f.ponto(0, P + 0.7);
    mancha(matLuzChao, lx, lz, larg * 0.9, 1.6, ang);
    bloquearRet(f, -larg / 2, larg / 2, 0, P);
    const alvo = (u: number) => vistaDe(f, limitar(u, -larg / 2 + 0.7, larg / 2 - 0.7), P, 1.75, 1.25, setor);
    volumeCaixa(f, 0, 1.25, P * 0.3, larg, 2.5, P * 0.6, (p) => alvo(f.local(p.x, p.z)[0]));
    if (setor !== null) vistasSetor[setor] = alvo(0);

    const proximo = fornecedor(setor);
    const n = Math.floor((larg - 0.2) / 0.25);
    const passo = (larg - 0.2) / n;
    for (const base of [0.505, ...tabuas]) {
      for (let k = 0; k < n; k++) {
        const p = proximo();
        if (!p) continue;
        const u = -(larg - 0.2) / 2 + passo * (k + 0.5);
        const [x, z] = f.ponto(u, P - 0.17);
        vaga(p, x, base, z, ang, 1, vistaDe(f, limitar(u, -larg / 2 + 0.5, larg / 2 - 0.5), P, 1.6, base + 0.15, setor));
      }
    }
  }

  /** ilha em pílula (com degrau no meio, se for alta); produtos dos dois lados compridos */
  function ilha(cx: number, cz: number, ang: number, comp: number, larg: number, setor: number | null, alta = true, logo = false) {
    const f = new Moldura(cx, cz, ang);
    const H = alta ? 0.78 : 0.7;
    juntar(mat.movel, guardar(extrudarDeitado(formaPilula(comp, larg), H, 0.02)), matriz(cx, 0, cz, ang));
    juntar(mat.led, guardar(extrudarDeitado(formaPilula(comp + 0.05, larg + 0.05), 0.035)), matriz(cx, 0.02, cz, ang));
    juntar(mat.tampo, guardar(extrudarDeitado(formaPilula(comp + 0.03, larg + 0.03), 0.03)), matriz(cx, H, cz, ang));
    const reto = Math.max(comp - larg, comp * 0.45);
    if (alta) caixa(mat.tampo, f, 0, H + 0.19, 0, reto, 0.32, 0.3);
    if (logo) {
      const tex = texPainelRoxo(512, 360, (g) => desenharLogo(g, 256, 180, 120, "#ffffff", "#ffffff"));
      const [x, z] = f.ponto(-(comp / 2 - 0.25), 0);
      const card = new THREE.Mesh(geoPlano, basico("#ffffff", { map: tex }));
      card.position.set(x, H + 0.3, z);
      card.rotation.y = ang - Math.PI / 2;
      card.scale.set(Math.min(0.7, larg * 0.8), 0.5, 1);
      cena.add(card);
    }
    mancha(matSombra, cx, cz, comp + 0.6, larg + 0.6, ang);
    bloquearRet(f, -comp / 2, comp / 2, -larg / 2, larg / 2);

    const proximo = fornecedor(setor);
    for (const lado of [1, -1]) {
      const fl = new Moldura(cx, cz, ang + (lado > 0 ? 0 : Math.PI));
      const alvo = (u: number) => vistaDe(fl, limitar(u, -reto / 2, reto / 2), larg / 2, 1.5, H + 0.2, setor);
      // só o corpo da ilha, embaixo dos produtos: o clique no produto acerta o produto
      volumeCaixa(fl, 0, H / 2, larg / 4, comp, H, larg / 2, (p) => alvo(fl.local(p.x, p.z)[0]));
      if (setor !== null && lado > 0) vistasSetor[setor] = alvo(0);
      const fileiras: [number, number, number][] = alta
        ? [
            [H + 0.03, larg / 2 - 0.16, 0.85],
            [H + 0.35, 0.07, 0.85],
          ]
        : [[H + 0.03, larg / 2 - 0.15, 0.8]];
      for (const [y, v, escala] of fileiras) {
        const util = (v > 0.1 ? comp - larg * 0.55 : reto) - 0.15;
        const n = Math.max(1, Math.floor(util / 0.22));
        const passo = util / n;
        for (let k = 0; k < n; k++) {
          const p = proximo();
          if (!p) continue;
          const u = -util / 2 + passo * (k + 0.5);
          const [x, z] = fl.ponto(u, v);
          vaga(p, x, y, z, fl.ang, escala, vistaDe(fl, limitar(u, -reto / 2, reto / 2), larg / 2, 1.4, y + 0.12, setor));
        }
      }
    }
  }

  /** mesa redonda de pé canelado, planta no meio e produtos em roda */
  function mesaRedonda(cx: number, cz: number, r: number) {
    const texCanelado = guardar(
      textura(256, 16, (g) => {
        for (let k = 0; k < 32; k++) {
          g.fillStyle = k % 2 ? "#f4f1ec" : "#e7e2db";
          g.fillRect(k * 8, 0, 8, 16);
        }
      })
    );
    texCanelado.wrapS = THREE.RepeatWrapping;
    texCanelado.repeat.set(3, 1);
    juntar(lambert("#ffffff", { map: texCanelado }), geoCilindro, matriz(cx, 0.37, cz, 0, r * 0.68, 0.74, r * 0.68));
    juntar(mat.tampo, geoCilindro, matriz(cx, 0.765, cz, 0, r, 0.05, r));
    planta(cx, cz, 0.55, 0.79);
    mancha(matSombra, cx, cz, r * 2.6, r * 2.6);
    bloquearCirculo(cx, cz, r);
    const vistaAng = (a: number): Vista => ({
      x: cx + Math.sin(a) * (r + 1.25),
      z: cz + Math.cos(a) * (r + 1.25),
      yaw: a,
      pitch: Math.atan2(0.95 - OLHO, 1.25),
      setor: null,
    });
    volume(geoCilindro, cx, 0.395, cz, 0, r, 0.79, r, (p) => vistaAng(Math.atan2(p.x - cx, p.z - cz)));
    const n = 12;
    for (let k = 0; k < n; k++) {
      const p = proximoMisto();
      if (!p) continue;
      const a = (k / n) * Math.PI * 2;
      vaga(p, cx + Math.sin(a) * (r - 0.13), 0.79, cz + Math.cos(a) * (r - 0.13), a, 0.75, vistaAng(a));
    }
  }

  /** painel roxo iluminado na parede, com moldura branca */
  function painel(f: Moldura, u: number, larg: number, alt: number, tex: THREE.Texture) {
    caixa(mat.movel, f, u, 0.1 + alt / 2, 0.04, larg + 0.1, alt + 0.1, 0.08);
    placa(tex, f, u, 0.1 + alt / 2, 0.082, larg, alt);
    const [x, z] = f.ponto(u, 0.8);
    mancha(matLuzRoxa, x, z, larg * 2.2, 1.6, f.ang);
    bloquearRet(f, u - larg / 2, u + larg / 2, 0, 0.1);
  }

  // estantes de parede, na ordem em que as categorias ocupam: [x, z, ângulo, largura]
  const lugares: [number, number, number, number][] = [
    [-5.55, Z0, 0, 3.0],
    [4.6, Z0, 0, 2.6],
    [7.75, Z0, 0, 2.3],
    [X1, -2.1, -Math.PI / 2, 2.4],
    [X0, -3.6, Math.PI / 2, 2.6],
    [X1, 1.0, -Math.PI / 2, 2.4],
    [X0, -0.6, Math.PI / 2, 2.6],
  ];
  lugares.forEach(([x, z, ang, larg], k) => {
    const setor = k < N ? k : null;
    estante(x, z, ang, larg, setor, (setor !== null ? op.corredores[setor].nome : op.tituloDestaques).toUpperCase());
  });

  // fundo: painel roxo e a parede do logo entre dois pilares escuros, com o caixa na frente
  painel(paredeFundo, -3.6, 0.72, 2.6, texPainelRoxo(256, 900));
  for (const lado of [-1, 1]) caixa(mat.casca, paredeFundo, lado * 2.85, ALTURA / 2, 0.3, 0.5, ALTURA, 0.6);
  caixa(mat.marca, paredeFundo, 0, ALTURA / 2, 0.14, 5.2, ALTURA, 0.26);
  placa(
    guardar(
      textura(1024, 420, (g) => {
        g.fillStyle = "#f7f4ef";
        g.fillRect(0, 0, 1024, 420);
        desenharLogo(g, 512, 210, 230, hex(primaria.clone().lerp(branco, 0.25)), hex(primaria));
      })
    ),
    paredeFundo,
    0,
    2.35,
    0.272,
    3.6,
    1.48
  );
  bloquearRet(paredeFundo, -3.1, 3.1, 0, 0.6);
  {
    const cz = Z0 + 1.95;
    const f = new Moldura(0, cz, 0);
    juntar(mat.movel, guardar(extrudarDeitado(formaPilula(4.4, 0.85), 1.0, 0.02)), matriz(0, 0, cz));
    juntar(mat.tampo, guardar(extrudarDeitado(formaPilula(4.55, 0.98), 0.04)), matriz(0, 1.0, cz));
    juntar(mat.led, guardar(extrudarDeitado(formaPilula(4.46, 0.9), 0.03)), matriz(0, 0.02, cz));
    for (const x of [-1.05, 1.05]) {
      caixa(mat.monitor, f, x, 1.32, -0.12, 0.56, 0.36, 0.03);
      caixa(mat.monitor, f, x, 1.1, -0.16, 0.05, 0.14, 0.05);
      caixa(mat.monitor, f, x, 1.045, -0.16, 0.22, 0.01, 0.14);
    }
    planta(-1.85, cz, 0.45, 1.04);
    juntar(mat.tampo, geoCilindro, matriz(1.9, 1.16, cz, 0, 0.05, 0.24, 0.05));
    mancha(matSombra, 0, cz, 5.2, 1.6);
    bloquearRet(f, -2.2, 2.2, -0.45, 0.45);
    const vistaCaixa: Vista = { x: 0, z: cz + 1.9, yaw: 0, pitch: Math.atan2(1.6 - OLHO, 3), setor: null };
    volumeCaixa(f, 0, 0.6, 0, 4.4, 1.2, 0.85, () => vistaCaixa);
  }
  {
    // prateleirinha de plantas entre as estantes da direita
    const f = new Moldura(6.27, Z0, 0);
    caixa(mat.movel, f, 0, 1.25, 0.15, 0.5, 2.5, 0.3);
    planta(6.27, Z0 + 0.16, 0.38, 1.1);
    planta(6.27, Z0 + 0.16, 0.32, 0.5);
    bloquearRet(f, -0.25, 0.25, 0, 0.3);
  }

  // parede esquerda: pôster iluminado; direita: espelho em arco e painel com a marca na vertical
  const paredeEsq = new Moldura(X0, 0, Math.PI / 2);
  painel(paredeEsq, -2.4, 1.5, 2.3, texPainelRoxo(512, 780));
  const paredeDir = new Moldura(X1, 0, -Math.PI / 2);
  const marcaForte = op.logo.find((l) => l.destaque)?.texto ?? "";
  painel(
    paredeDir,
    3.4,
    0.8,
    2.6,
    texPainelRoxo(300, 980, (g) => {
      g.save();
      g.translate(150, 490);
      g.rotate(-Math.PI / 2);
      g.fillStyle = "#ffffff";
      g.font = `900 ${Math.min(210, 1500 / Math.max(3, marcaForte.length))}px ${op.fonte}`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(marcaForte, 0, 0);
      g.restore();
    })
  );
  {
    const u = -4.6;
    const arco = new THREE.Shape();
    arco.moveTo(-0.42, 0);
    arco.lineTo(0.42, 0);
    arco.lineTo(0.42, 1.7);
    arco.absarc(0, 1.7, 0.42, 0, Math.PI, false);
    arco.lineTo(-0.42, 0);
    const texEspelho = guardar(
      textura(64, 256, (g) => {
        const gr = g.createLinearGradient(0, 0, 64, 256);
        gr.addColorStop(0, "#f4f5f8");
        gr.addColorStop(0.5, "#d9dde5");
        gr.addColorStop(1, "#eceef2");
        g.fillStyle = gr;
        g.fillRect(0, 0, 64, 256);
      })
    );
    caixa(mat.movel, paredeDir, u, 1.3, 0.03, 1.05, 2.6, 0.06);
    const [x, z] = paredeDir.ponto(u, 0.065);
    const espelho = new THREE.Mesh(guardar(new THREE.ShapeGeometry(arco, 16)), basico("#ffffff", { map: texEspelho }));
    espelho.position.set(x, 0.25, z);
    espelho.rotation.y = paredeDir.ang;
    cena.add(espelho);
    bloquearRet(paredeDir, u - 0.5, u + 0.5, 0, 0.1);
  }

  // cantinho com sofá curvo, tapete lilás e mesinha
  {
    const [cx, cz] = [-4.6, -1.9];
    juntar(mat.tapete, guardar(new THREE.CircleGeometry(1.4, 48).rotateX(-Math.PI / 2)), matriz(cx, 0.006, cz));
    const abertura = Math.PI / 6; // o sofá abre para a frente e para a direita
    const pedacoDeAnel = (r0: number, r1: number) => {
      const a0 = -(abertura + Math.PI * 1.65);
      const a1 = -(abertura + Math.PI * 0.35);
      const s = new THREE.Shape();
      s.moveTo(Math.cos(a0) * r1, Math.sin(a0) * r1);
      s.absarc(0, 0, r1, a0, a1, false);
      s.lineTo(Math.cos(a1) * r0, Math.sin(a1) * r0);
      s.absarc(0, 0, r0, a1, a0, true);
      return s;
    };
    juntar(mat.sofa, guardar(extrudarDeitado(pedacoDeAnel(0.55, 1.08), 0.42, 0.05)), matriz(cx, 0, cz));
    juntar(mat.sofa, guardar(extrudarDeitado(pedacoDeAnel(0.88, 1.08), 0.82, 0.05)), matriz(cx, 0, cz));
    juntar(mat.pe, geoCilindro, matriz(cx + 0.2, 0.22, cz + 0.1, 0, 0.17, 0.44, 0.17));
    juntar(mat.tampo, geoCilindro, matriz(cx + 0.2, 0.46, cz + 0.1, 0, 0.3, 0.04, 0.3));
    planta(cx + 0.2, cz + 0.1, 0.34, 0.48);
    mancha(matSombra, cx, cz, 2.6, 2.6);
    bloquearCirculo(cx, cz, 1.1);
  }

  // ilhas, mesa redonda e expositores — a 8ª categoria (se houver) fica na ilha grande da esquerda
  ilha(-1.9, 0.5, Math.PI / 2, 3.4, 1.1, N > lugares.length ? lugares.length : null);
  ilha(2.2, 0.2, Math.PI / 2, 3.4, 1.1, null, true, true);
  ilha(5.3, 0.1, Math.PI / 2, 2.4, 0.75, null);
  mesaRedonda(0.15, -1.2, 0.8);
  ilha(-5.0, 2.6, 0, 1.7, 0.85, null, false);
  ilha(-2.2, 3.9, 0, 1.1, 0.8, null, false);
  ilha(0.2, 3.1, 0, 1.2, 0.85, null, false);
  ilha(2.6, 3.9, 0, 1.1, 0.8, null, false);
  ilha(5.6, 3.2, Math.PI / 2, 2.0, 0.8, null, false);

  // vitrine: painéis iluminados nas pontas (virados para a rua) e mesinhas com produtos
  {
    const dentro = new Moldura(0, Z1, Math.PI); // v cresce para dentro da loja
    const texLogoVitrine = texPainelRoxo(512, 740, (g) => desenharLogo(g, 256, 370, 150, hex(primaria), hex(primaria)));
    const texFrase = op.fraseVitrine
      ? texPainelRoxo(512, 740, (g) => {
          g.fillStyle = hex(primaria.clone().lerp(new THREE.Color("#000000"), 0.35));
          g.font = `500 64px ${op.fonte}`;
          g.textBaseline = "top";
          g.textAlign = "left";
          let linha = "";
          let y = 230;
          for (const palavra of (op.fraseVitrine ?? "").split(" ")) {
            const teste = linha ? `${linha} ${palavra}` : palavra;
            if (g.measureText(teste).width > 360 && linha) {
              g.fillText(linha, 70, y);
              y += 76;
              linha = palavra;
            } else linha = teste;
          }
          g.font = `800 64px ${op.fonte}`;
          g.fillText(linha, 70, y);
        })
      : texLogoVitrine;
    for (const [x, tex] of [
      [-7.7, texLogoVitrine],
      [7.7, texFrase],
    ] as const) {
      const [u] = dentro.local(x, Z1);
      caixa(mat.movel, dentro, u, 1.35, 0.25, 1.85, 2.6, 0.12);
      const painelRua = new THREE.Mesh(geoPlano, basico("#ffffff", { map: tex }));
      painelRua.position.set(x, 1.35, Z1 - 0.185);
      painelRua.scale.set(1.75, 2.5, 1);
      cena.add(painelRua);
      mancha(matLuzRoxa, x, Z1 - 0.9, 2.4, 1.2);
      bloquearRet(dentro, u - 0.95, u + 0.95, 0.18, 0.32);
    }
    for (const x of [-5.1, -3.1, 3.1, 5.1]) {
      const fm = new Moldura(x, Z1 - 0.85, 0);
      caixa(mat.movel, fm, 0, 0.3, 0, 1.3, 0.6, 0.55);
      caixa(mat.led, fm, 0, 0.02, 0, 1.34, 0.02, 0.59);
      mancha(matSombra, x, Z1 - 0.85, 1.9, 1.1);
      bloquearRet(fm, -0.65, 0.65, -0.28, 0.28);
      const vistaVitrine: Vista = { x, z: Z1 - 2.6, yaw: Math.PI, pitch: Math.atan2(0.7 - OLHO, 1.75), setor: null };
      volumeCaixa(fm, 0, 0.3, 0, 1.3, 0.6, 0.55, () => vistaVitrine);
      for (let k = 0; k < 4; k++) {
        const p = proximoMisto();
        if (p) vaga(p, x - 0.45 + k * 0.3, 0.6, Z1 - 0.85, 0, 0.8, vistaVitrine);
      }
    }
    planta(-2.0, Z1 + PAREDE + 0.75, 1.15);
    planta(2.0, Z1 + PAREDE + 0.75, 1.15);
  }
  planta(X0 + 0.55, Z0 + 0.6, 1.3);
  planta(X0 + 0.5, 1.4, 1.0);
  planta(X0 + 0.5, 4.6, 1.0);
  planta(X1 - 0.5, 4.7, 1.0);

  // junta o cenário: uma malha por material
  for (const [m, lista] of lotes) {
    const geo = mergeGeometries(lista, false);
    lista.forEach((g) => g.dispose());
    if (!geo) continue;
    guardar(geo);
    const malha = new THREE.Mesh(geo, m);
    if (m.transparent) malha.renderOrder = 1;
    cena.add(malha);
  }
  lotes.clear();

  // ---- produtos: uma malha instanciada por produto (caixinha cinza até a foto chegar)
  const geoReserva = guardar(new THREE.BoxGeometry(0.14, 0.2, 0.04));
  geoReserva.translate(0, 0.1, 0);
  const matReserva = lambert("#e4e1e8");
  const auxMatriz = new THREE.Matrix4();
  const auxEscala = new THREE.Vector3();
  const matrizDa = (v: Vaga, destaque = 1) =>
    auxMatriz.compose(v.pos, auxQ.setFromAxisAngle(eixoY, v.ang), auxEscala.setScalar(v.escala * destaque));
  const malhas: ProdutoMalha[] = [];
  for (const [slug, vagas] of vagasPorProduto) {
    const malha = new THREE.InstancedMesh(geoReserva, matReserva, vagas.length);
    vagas.forEach((v, k) => malha.setMatrixAt(k, matrizDa(v)));
    malha.userData = { slug };
    cena.add(malha);
    malhas.push({ slug, malha, vagas, altura: 0.2, estado: "nada" });
  }

  // ---- câmera: vista do alto (gira em volta da loja) ou de perto (na altura dos olhos)
  let modo: ModoCena = "alto";
  let azimute = 0;
  let distAlto = DIST_ALTO;
  let elevacao = EL_ALTO;
  const posicao = new THREE.Vector3();
  let yaw = 0;
  let pitch = 0;
  let alvoYaw = 0;
  let alvoPitch = 0;
  type Ponto = { x: number; z: number; yaw?: number; pitch?: number };
  let rota: Ponto[] = [];
  let aoChegar: (() => void) | null = null;
  let setorAtual: number | null = null;
  let voo: { de: Pose; para: Pose; t: number; dur: number; descendo: boolean; fim: () => void } | null = null;

  function poseAlto(): Pose {
    const h = Math.cos(elevacao) * distAlto;
    return {
      x: ALVO_ALTO.x + Math.sin(azimute) * h,
      y: Math.sin(elevacao) * distAlto,
      z: ALVO_ALTO.z + Math.cos(azimute) * h,
      yaw: azimute,
      pitch: -elevacao,
    };
  }
  const poseAtual = (): Pose => ({ x: posicao.x, y: posicao.y, z: posicao.z, yaw, pitch });
  function aplicar(p: Pose) {
    posicao.set(p.x, p.y, p.z);
    yaw = alvoYaw = p.yaw;
    pitch = alvoPitch = p.pitch;
  }
  function mudarModo(novo: ModoCena) {
    if (modo === novo) return;
    modo = novo;
    op.aoMudarModo(novo);
  }
  function mudarSetor(s: number | null) {
    if (s === setorAtual) return;
    setorAtual = s;
    op.aoMudarCorredor(s);
  }

  if (op.inicio?.modo === "perto") {
    modo = "perto";
    aplicar({ x: op.inicio.x, y: OLHO, z: op.inicio.z, yaw: op.inicio.yaw, pitch: op.inicio.pitch });
  } else {
    if (op.inicio) azimute = op.inicio.yaw;
    aplicar(poseAlto());
  }
  op.aoMudarModo(modo);

  // ---- caminhos no piso: A* na grade, depois corta caminho onde a vista é livre
  const celula = (x: number, z: number): [number, number] => [
    limitar(Math.floor((x - X0) / CELULA), 0, GX - 1),
    limitar(Math.floor((z - Z0) / CELULA), 0, GZ - 1),
  ];
  const pisavel = (x: number, z: number) => {
    const [i, j] = celula(x, z);
    return x > X0 && x < X1 && z > Z0 && z < Z1 && livre[j * GX + i] === 1;
  };
  function livreMaisPerto(i0: number, j0: number): number | null {
    const inicio = j0 * GX + i0;
    if (livre[inicio]) return inicio;
    const visto = new Uint8Array(GX * GZ);
    const fila = [inicio];
    visto[inicio] = 1;
    for (let k = 0; k < fila.length; k++) {
      const c = fila[k];
      if (livre[c]) return c;
      const i = c % GX;
      const j = (c - i) / GX;
      for (const [di, dj] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const ni = i + di;
        const nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= GX || nj >= GZ || visto[nj * GX + ni]) continue;
        visto[nj * GX + ni] = 1;
        fila.push(nj * GX + ni);
      }
    }
    return null;
  }
  function vistaLivre(ax: number, az: number, bx: number, bz: number) {
    const passos = Math.ceil(Math.hypot(bx - ax, bz - az) / (CELULA / 2));
    for (let k = 1; k < passos; k++) if (!pisavel(ax + ((bx - ax) * k) / passos, az + ((bz - az) * k) / passos)) return false;
    return true;
  }
  function acharCaminho(dx: number, dz: number): Ponto[] {
    const origem = livreMaisPerto(...celula(posicao.x, posicao.z));
    const alvo = livreMaisPerto(...celula(dx, dz));
    if (origem === null || alvo === null) return [{ x: dx, z: dz }];
    const total = GX * GZ;
    const g = new Float32Array(total).fill(Infinity);
    const veio = new Int32Array(total).fill(-1);
    const fechado = new Uint8Array(total);
    const ai = alvo % GX;
    const aj = (alvo - ai) / GX;
    const h = (c: number) => {
      const di = Math.abs((c % GX) - ai);
      const dj = Math.abs(Math.floor(c / GX) - aj);
      return Math.max(di, dj) + 0.414 * Math.min(di, dj);
    };
    // fila de prioridade (heap binário)
    const heap: [number, number][] = [];
    const empurrar = (f: number, c: number) => {
      heap.push([f, c]);
      for (let k = heap.length - 1; k > 0; ) {
        const p = (k - 1) >> 1;
        if (heap[p][0] <= heap[k][0]) break;
        [heap[p], heap[k]] = [heap[k], heap[p]];
        k = p;
      }
    };
    const tirar = () => {
      const topo = heap[0];
      const ultimo = heap.pop();
      if (heap.length && ultimo) {
        heap[0] = ultimo;
        for (let k = 0; ; ) {
          const a = k * 2 + 1;
          const b = a + 1;
          let m = k;
          if (a < heap.length && heap[a][0] < heap[m][0]) m = a;
          if (b < heap.length && heap[b][0] < heap[m][0]) m = b;
          if (m === k) break;
          [heap[m], heap[k]] = [heap[k], heap[m]];
          k = m;
        }
      }
      return topo;
    };
    g[origem] = 0;
    empurrar(h(origem), origem);
    while (heap.length) {
      const [, c] = tirar();
      if (fechado[c]) continue;
      fechado[c] = 1;
      if (c === alvo) break;
      const i = c % GX;
      const j = (c - i) / GX;
      for (let di = -1; di <= 1; di++) {
        for (let dj = -1; dj <= 1; dj++) {
          if (!di && !dj) continue;
          const ni = i + di;
          const nj = j + dj;
          if (ni < 0 || nj < 0 || ni >= GX || nj >= GZ) continue;
          const n = nj * GX + ni;
          if (!livre[n] || fechado[n]) continue;
          if (di && dj && (!livre[j * GX + ni] || !livre[nj * GX + i])) continue; // não corta quina
          const custo = g[c] + (di && dj ? 1.414 : 1);
          if (custo < g[n]) {
            g[n] = custo;
            veio[n] = c;
            empurrar(custo + h(n), n);
          }
        }
      }
    }
    if (veio[alvo] === -1 && alvo !== origem) return [{ x: dx, z: dz }];
    const celulas: [number, number][] = [];
    for (let c = alvo; c !== -1; c = veio[c]) celulas.unshift([celX(c % GX), celZ(Math.floor(c / GX))]);
    if (pisavel(dx, dz)) celulas[celulas.length - 1] = [dx, dz]; // termina no ponto pedido, não no meio da célula
    const pontos: Ponto[] = [];
    let de: [number, number] = [posicao.x, posicao.z];
    for (let k = 0; k < celulas.length - 1; ) {
      let longe = k + 1;
      for (let m = celulas.length - 1; m > k + 1; m--) {
        if (vistaLivre(de[0], de[1], celulas[m][0], celulas[m][1])) {
          longe = m;
          break;
        }
      }
      pontos.push({ x: celulas[longe][0], z: celulas[longe][1] });
      de = celulas[longe];
      k = longe;
    }
    if (!pontos.length) pontos.push({ x: celulas[celulas.length - 1][0], z: celulas[celulas.length - 1][1] });
    return pontos;
  }

  /** leva a câmera até uma vista: voando (de cima) ou andando (de perto) */
  function irParaVista(v: Vista, avisar = false) {
    mudarSetor(null);
    const chegar = () => {
      if (avisar) op.aoChegarPrateleira();
      mudarSetor(v.setor);
    };
    if (modo === "alto" || voo) {
      rota = [];
      aoChegar = null;
      voo = { de: poseAtual(), para: { x: v.x, y: OLHO, z: v.z, yaw: v.yaw, pitch: v.pitch }, t: 0, dur: 1.9, descendo: true, fim: chegar };
      return;
    }
    const caminho = acharCaminho(v.x, v.z);
    caminho[caminho.length - 1] = { ...caminho[caminho.length - 1], yaw: v.yaw, pitch: v.pitch };
    rota = caminho;
    aoChegar = chegar;
  }
  function irParaVisaoGeral() {
    rota = [];
    aoChegar = null;
    mudarSetor(null);
    if (modo === "alto" && !voo) return;
    voo = { de: poseAtual(), para: poseAlto(), t: 0, dur: 1.7, descendo: false, fim: () => mudarModo("alto") };
  }
  function irParaCorredor(i: number) {
    const v = vistasSetor[i];
    if (v) irParaVista(v);
  }

  // ---- interação
  const raycaster = new THREE.Raycaster();
  const ponteiro = new THREE.Vector2();
  let arrastando = false;
  let moveu = false;
  let inicioX = 0;
  let inicioY = 0;
  let ultimoX = 0;
  let ultimoY = 0;
  let destaque: { m: ProdutoMalha; k: number } | null = null;

  function alvoNoPonteiro(ev: PointerEvent) {
    const r = canvas.getBoundingClientRect();
    ponteiro.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ponteiro, camera);
    const hits = raycaster.intersectObjects([...malhas.map((m) => m.malha), ...volumes, piso], false);
    return hits[0] ?? null;
  }
  function produtoDoAcerto(hit: THREE.Intersection | null) {
    if (!(hit?.object instanceof THREE.InstancedMesh) || hit.instanceId === undefined) return null;
    const m = malhas.find((x) => x.malha === hit.object);
    return m ? { m, k: hit.instanceId } : null;
  }
  // de perto, o clique que cai do lado de um produto (na tábua, entre dois) escolhe
  // o mais próximo na tela, até `raio` pixels da borda da foto
  const auxTela = new THREE.Vector3();
  const auxTopo = new THREE.Vector3();
  function produtoPerto(ev: PointerEvent, raio: number) {
    if (modo !== "perto") return null;
    const r = canvas.getBoundingClientRect();
    let melhor: { m: ProdutoMalha; k: number } | null = null;
    let menor = raio;
    for (const m of malhas) {
      for (let k = 0; k < m.vagas.length; k++) {
        const v = m.vagas[k];
        const dx = posicao.x - v.pos.x;
        const dz = posicao.z - v.pos.z;
        if (dx * dx + dz * dz > 25 || dx * Math.sin(v.ang) + dz * Math.cos(v.ang) <= 0) continue; // longe ou de costas
        const alt = m.altura * v.escala;
        auxTela.set(v.pos.x, v.pos.y + alt / 2, v.pos.z).project(camera);
        if (auxTela.z > 1) continue;
        auxTopo.set(v.pos.x, v.pos.y + alt, v.pos.z).project(camera);
        const meiaFoto = ((auxTopo.y - auxTela.y) / 2) * r.height;
        const centro = Math.hypot(r.left + ((auxTela.x + 1) / 2) * r.width - ev.clientX, r.top + ((1 - auxTela.y) / 2) * r.height - ev.clientY);
        const d = Math.max(0, centro - meiaFoto);
        if (d < menor) {
          menor = d;
          melhor = { m, k };
        }
      }
    }
    return melhor;
  }
  function destacar(novo: { m: ProdutoMalha; k: number } | null) {
    if (destaque && (!novo || destaque.m !== novo.m || destaque.k !== novo.k)) {
      destaque.m.malha.setMatrixAt(destaque.k, matrizDa(destaque.m.vagas[destaque.k]));
      destaque.m.malha.instanceMatrix.needsUpdate = true;
    }
    if (novo) {
      novo.m.malha.setMatrixAt(novo.k, matrizDa(novo.m.vagas[novo.k], 1.12));
      novo.m.malha.instanceMatrix.needsUpdate = true;
    }
    destaque = novo;
  }
  const vistaDoVolume = (hit: THREE.Intersection | null) =>
    hit && volumes.includes(hit.object as THREE.Mesh) ? (hit.object.userData.vista as QualVista) : null;

  function aoApertar(ev: PointerEvent) {
    arrastando = true;
    moveu = false;
    inicioX = ultimoX = ev.clientX;
    inicioY = ultimoY = ev.clientY;
    canvas.setPointerCapture(ev.pointerId);
  }
  function aoMover(ev: PointerEvent) {
    if (arrastando) {
      if (Math.hypot(ev.clientX - inicioX, ev.clientY - inicioY) > 5) moveu = true;
      if (moveu && !voo) {
        canvas.style.cursor = "grabbing";
        const dx = ev.clientX - ultimoX;
        const dy = ev.clientY - ultimoY;
        if (modo === "alto") {
          azimute -= dx * 0.005;
          elevacao = limitar(elevacao + dy * 0.003, 0.5, 1.3);
          aplicar(poseAlto());
        } else {
          yaw = alvoYaw = alvoYaw + dx * 0.0045;
          pitch = alvoPitch = limitar(alvoPitch + dy * 0.0035, -0.75, 0.45);
          rota = rota.map((p) => ({ ...p, yaw: undefined, pitch: undefined })); // olhar manda mais que o fim da rota
        }
      }
      ultimoX = ev.clientX;
      ultimoY = ev.clientY;
      return;
    }
    if (ev.pointerType !== "mouse") return;
    const hit = alvoNoPonteiro(ev);
    const alvo = produtoDoAcerto(hit);
    destacar(alvo);
    canvas.style.cursor = alvo || vistaDoVolume(hit) || (hit?.object === piso && modo === "alto") ? "pointer" : "grab";
  }
  function aoSoltar(ev: PointerEvent) {
    if (!arrastando) return;
    arrastando = false;
    canvas.style.cursor = "grab";
    if (moveu) return;
    const hit = alvoNoPonteiro(ev);
    const alvo = produtoDoAcerto(hit) ?? produtoPerto(ev, 12);
    if (alvo) {
      irParaVista(alvo.m.vagas[alvo.k].vista, true);
      op.aoSelecionarProduto(alvo.m.slug);
      return;
    }
    if (!hit) return;
    const vista = vistaDoVolume(hit);
    if (vista) return irParaVista(vista(hit.point));
    if (hit.object === piso && pisavel(hit.point.x, hit.point.z)) {
      if (modo === "alto") {
        irParaVista({ x: hit.point.x, z: hit.point.z, yaw: azimute, pitch: -0.08, setor: null });
        return;
      }
      const dx = hit.point.x - posicao.x;
      const dz = hit.point.z - posicao.z;
      irParaVista({ x: hit.point.x, z: hit.point.z, yaw: Math.hypot(dx, dz) > 1.5 ? Math.atan2(-dx, -dz) : yaw, pitch: alvoPitch, setor: null });
    }
  }
  function aoRolar(ev: WheelEvent) {
    ev.preventDefault();
    if (voo) return;
    if (modo === "alto") {
      distAlto = limitar(distAlto * Math.exp(ev.deltaY * 0.0012), 9, 30);
      aplicar(poseAlto());
      return;
    }
    andar(ev.deltaY < 0 ? 0.6 : -0.6);
  }
  /** anda para a frente (ou para trás) sem atravessar os móveis: escorrega na quina */
  function andar(metros: number) {
    rota = [];
    aoChegar = null;
    mudarSetor(null);
    const nx = posicao.x - Math.sin(yaw) * metros;
    const nz = posicao.z - Math.cos(yaw) * metros;
    if (pisavel(nx, nz)) [posicao.x, posicao.z] = [nx, nz];
    else if (pisavel(nx, posicao.z)) posicao.x = nx;
    else if (pisavel(posicao.x, nz)) posicao.z = nz;
  }

  const teclas = new Set<string>();
  function aoTeclar(ev: KeyboardEvent) {
    const k = ev.key.toLowerCase();
    if (["w", "s", "a", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) {
      ev.preventDefault();
      teclas.add(k);
    }
  }
  function aoSoltarTecla(ev: KeyboardEvent) {
    teclas.delete(ev.key.toLowerCase());
  }

  canvas.addEventListener("pointerdown", aoApertar);
  canvas.addEventListener("pointermove", aoMover);
  canvas.addEventListener("pointerup", aoSoltar);
  canvas.addEventListener("pointercancel", () => (arrastando = false));
  canvas.addEventListener("wheel", aoRolar, { passive: false });
  container.addEventListener("keydown", aoTeclar);
  container.addEventListener("keyup", aoSoltarTecla);

  // ---- tamanho
  let fovAlto = 40;
  function ajustar() {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    fovAlto = camera.aspect < 1.55 ? 46 : 40;
    camera.updateProjectionMatrix();
  }
  const observador = new ResizeObserver(ajustar);
  observador.observe(container);
  ajustar();

  // ---- fotos sob demanda, das mais perto para as mais longe
  let baixando = 0;
  let destruida = false;
  function baixarFotos() {
    const pendentes = malhas
      .filter((m) => m.estado === "nada")
      .map((m) => ({ m, d: Math.min(...m.vagas.map((v) => v.pos.distanceTo(posicao))) }))
      .sort((a, b) => a.d - b.d);
    for (const { m } of pendentes) {
      if (baixando >= 8) break;
      const url = fotoDe.get(m.slug);
      if (!url) continue;
      m.estado = "baixando";
      baixando++;
      montarProduto3D(url, PROD_L, PROD_A)
        .then((p) => {
          if (destruida) return p.descartar();
          descartar.push({ dispose: p.descartar });
          m.malha.geometry = p.geometria;
          m.malha.material = p.material;
          m.malha.boundingSphere = null; // a caixinha era menor que o produto
          m.malha.boundingBox = null;
          m.altura = p.altura;
          m.estado = "pronto";
        })
        .catch(() => {
          m.estado = "pronto"; // sem foto: fica a caixinha cinza
        })
        .finally(() => {
          baixando--;
        });
    }
  }

  // ---- laço
  let ultimo = performance.now();
  let proximaFoto = 0;
  let quadro = 0;
  function definirFov(fov: number) {
    if (Math.abs(camera.fov - fov) < 0.01) return;
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
  function passo(agora: number) {
    quadro = requestAnimationFrame(passo);
    const dt = Math.min(0.05, (agora - ultimo) / 1000);
    ultimo = agora;

    if (voo) {
      voo.t += dt;
      const k = suave(Math.min(1, voo.t / voo.dur));
      // descendo, fica alto mais tempo (passa por cima da fachada); subindo, sobe logo
      const ky = voo.descendo ? k * k : 1 - (1 - k) * (1 - k);
      posicao.set(
        voo.de.x + (voo.para.x - voo.de.x) * k,
        voo.de.y + (voo.para.y - voo.de.y) * ky,
        voo.de.z + (voo.para.z - voo.de.z) * k
      );
      yaw = alvoYaw = voo.de.yaw + difAngulo(voo.para.yaw, voo.de.yaw) * k;
      pitch = alvoPitch = voo.de.pitch + (voo.para.pitch - voo.de.pitch) * k;
      definirFov(voo.descendo ? fovAlto + (FOV_PERTO - fovAlto) * k : FOV_PERTO + (fovAlto - FOV_PERTO) * k);
      if (voo.t >= voo.dur) {
        const { fim, descendo } = voo;
        voo = null;
        if (descendo) mudarModo("perto");
        fim();
      }
    } else if (modo === "perto") {
      definirFov(FOV_PERTO);
      if (teclas.size) {
        const frente = (teclas.has("w") || teclas.has("arrowup") ? 1 : 0) - (teclas.has("s") || teclas.has("arrowdown") ? 1 : 0);
        const vira = (teclas.has("a") || teclas.has("arrowleft") ? 1 : 0) - (teclas.has("d") || teclas.has("arrowright") ? 1 : 0);
        if (vira) yaw = alvoYaw = alvoYaw + vira * dt * 1.6;
        if (frente) andar(frente * dt * 3);
      }
      const alvo = rota[0];
      if (alvo) {
        const dx = alvo.x - posicao.x;
        const dz = alvo.z - posicao.z;
        const dist = Math.hypot(dx, dz);
        const ultimoPonto = rota.length === 1;
        if (!ultimoPonto && dist > 0.3) alvoYaw = Math.atan2(-dx, -dz);
        if (ultimoPonto && alvo.yaw !== undefined) alvoYaw = alvo.yaw;
        if (ultimoPonto && alvo.pitch !== undefined) alvoPitch = alvo.pitch;
        const vel = limitar(dist * 2.6, 0.6, 4.2);
        const anda = Math.min(dist, vel * dt);
        if (dist > 0.0001) {
          posicao.x += (dx / dist) * anda;
          posicao.z += (dz / dist) * anda;
        }
        if (dist < (ultimoPonto ? 0.02 : 0.25)) {
          rota.shift();
          if (!rota.length && aoChegar) {
            const f = aoChegar;
            aoChegar = null;
            f();
          }
        }
      }
      const k = 1 - Math.exp(-dt * 6);
      yaw += difAngulo(alvoYaw, yaw) * k;
      pitch += (alvoPitch - pitch) * k;
    } else {
      definirFov(fovAlto);
      const vira = (teclas.has("a") || teclas.has("arrowleft") ? 1 : 0) - (teclas.has("d") || teclas.has("arrowright") ? 1 : 0);
      if (vira) {
        azimute += vira * dt * 0.9;
        aplicar(poseAlto());
      }
    }
    camera.position.copy(posicao);
    camera.rotation.set(pitch, yaw, 0);
    teto.visible = posicao.y < ALTURA - 0.15;

    if (agora > proximaFoto) {
      proximaFoto = agora + 300;
      baixarFotos();
    }
    renderer.render(cena, camera);
  }
  quadro = requestAnimationFrame(passo);

  return {
    irParaCorredor,
    irParaVisaoGeral,
    posicao: () =>
      modo === "perto" && !voo ? { modo, x: posicao.x, z: posicao.z, yaw, pitch } : { modo: "alto", x: 0, z: 0, yaw: azimute, pitch: 0 },
    destruir() {
      destruida = true;
      cancelAnimationFrame(quadro);
      observador.disconnect();
      container.removeEventListener("keydown", aoTeclar);
      container.removeEventListener("keyup", aoSoltarTecla);
      for (const m of malhas) m.malha.dispose();
      spots.dispose();
      for (const d of descartar) d.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
