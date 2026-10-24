/**
 * Loja 3D — a cena em three.js (sem React): uma loja-conceito de beleza de
 * 30 × 20 m, com uma seção por marca (a logo da marca em cima de cada estante e
 * nas pontas das ilhas), parede do logo com o caixa, cantinho com sofá e
 * vitrine de vidro na entrada. Dois arranjos: "conceito" (BeautyNow e Pulse:
 * mesa redonda, painéis lilases) e "profissional" (Be2Beauty: moldura
 * azul-marinho, balcão de atendimento com banquetas, painéis de água).
 *
 * A pessoa começa do lado de fora, no corredor do shopping, em primeira pessoa e
 * com uma cesta na mão (cesta.ts). Andando para a frente, a porta de vidro abre
 * sozinha (e fecha quando ela se afasta); lá dentro anda livre com W/A/S/D ou as
 * setas, arrasta para olhar e clica no chão para ir até lá — o caminho desvia
 * dos móveis e passa pela porta (A* numa grade do piso). Clicar num produto
 * leva até a prateleira e abre o card (React, fora daqui). "Visão geral" sobe
 * para ver a loja inteira de cima, como uma maquete.
 *
 * Imagem: materiais físicos com reflexo do ambiente, sombras suaves (o mapa de
 * sombra só é refeito quando algo muda), oclusão de ambiente nos cantos e brilho
 * nas fitas de LED. Se o computador não aguentar, a qualidade desce sozinha.
 *
 * Desempenho: o cenário fixo vira uma malha por material, cada produto é uma
 * malha instanciada e as fotos baixam aos poucos, das mais perto para as mais longe.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { montarProduto3D } from "./produto3d";
import { criarCesta, type ItemCesta } from "./cesta";

export interface ProdutoCena {
  slug: string;
  foto: string;
}

/** uma seção da loja = uma marca */
export interface SetorCena {
  slug: string;
  nome: string;
  /** endereço da logo oficial (sem logo, a seção mostra o nome) */
  logo?: string;
  categoria: string;
  produtos: ProdutoCena[];
}

export interface LinhaLogo {
  texto: string;
  destaque: boolean;
  /** continuação na mesma linha, em peso normal (o "BEAUTY" de BE2BEAUTY) */
  sufixo?: string;
}

export type ModoCena = "alto" | "perto";
export type Qualidade = "alta" | "media" | "baixa";

export interface PosicaoCena {
  modo: ModoCena;
  x: number;
  z: number;
  yaw: number;
  pitch: number;
}

export interface OpcoesCena {
  /** marcas, da maior para a menor */
  setores: SetorCena[];
  /** categorias na ordem de tamanho (as marcas da mesma categoria ficam juntas) */
  categorias: string[];
  estilo: "conceito" | "profissional";
  logo: LinhaLogo[];
  /** frase do painel da vitrine (null = repete o logo) */
  fraseVitrine: string | null;
  /** título dos móveis com produtos de várias marcas */
  tituloDestaques: string;
  corPrimaria: string;
  corEscura: string;
  corCesta: string;
  fonte: string;
  /** fixa a qualidade (sem isso, começa na alta e desce se ficar lento) */
  qualidade?: Qualidade;
  aoSelecionarProduto: (slug: string) => void;
  /** índice da marca da seção onde a pessoa parou (null = em nenhuma) */
  aoMudarSetor: (indice: number | null) => void;
  aoMudarModo: (modo: ModoCena) => void;
  aoChegarPrateleira: () => void;
  /** onde a pessoa estava antes de abrir um produto (volta para o mesmo lugar) */
  inicio?: PosicaoCena;
}

export interface Cena {
  irParaCategoria: (slug: string) => void;
  irParaVisaoGeral: () => void;
  /** conteúdo da sacola do site, sem animação */
  definirCesta: (slugs: string[]) => void;
  /** produto que acabou de entrar na sacola: voa da prateleira para a cesta */
  colocarNaCesta: (slug: string) => void;
  posicao: () => PosicaoCena;
  destruir: () => void;
}

const OLHO = 1.6; // altura dos olhos
const LARGURA = 30; // salão (x)
const FUNDO = 20; // salão (z); a entrada fica em +z
const X0 = -LARGURA / 2;
const X1 = LARGURA / 2;
const Z0 = -FUNDO / 2;
const Z1 = FUNDO / 2;
const ALTURA = 4.0; // pé-direito
const PAREDE = 0.4;
const VAO = 1.5; // meia porta
const PROF_ESTANTE = 0.45;
const PROD_L = 0.2; // o produto cabe nessa largura...
const PROD_A = 0.3; // ...e nessa altura (estantes de 40 cm)
const FRENTES = 2; // quantas frentes seguidas de cada produto
const CELULA = 0.2; // grade do piso para achar caminho
const RAIO = 0.35; // folga da pessoa para os móveis
const EL_ALTO = 0.86; // inclinação da vista do alto
const DIST_ALTO = 35;
const ALVO_ALTO = new THREE.Vector3(0, 0, 0.8);
const FOV_PERTO = 62;
const FORA = 8; // corredor do shopping na frente da loja, onde a pessoa começa
const ENTRADA: PosicaoCena = { modo: "perto", x: 0, z: Z1 + 5.2, yaw: 0, pitch: -0.03 };

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
  t.anisotropy = 8;
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

/** logo da marca: SVG sem largura/altura ganha as do viewBox (senão o canvas a desenha torta) */
async function carregarLogo(url: string): Promise<HTMLImageElement> {
  let src = url;
  if (/\.svg(\?|$)/i.test(url)) {
    const texto = await (await fetch(url)).text();
    const svg = texto.replace(/<svg\b([^>]*)>/i, (tag, attrs: string) => {
      if (/\swidth=/.test(attrs) && /\sheight=/.test(attrs)) return tag;
      const vb = /viewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(attrs);
      return `<svg${attrs} width="${vb ? vb[1] : 600}" height="${vb ? vb[2] : 200}">`;
    });
    src = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  }
  return new Promise((ok, falha) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => falha(new Error("logo"));
    img.src = src;
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
  const profissional = op.estilo === "profissional";

  // ---- renderizador, câmera e o caminho da imagem (cena → oclusão → brilho → cesta → tela)
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.8;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false; // a loja é parada: só refaz quando algo muda
  const canvas = renderer.domElement;
  Object.assign(canvas.style, { display: "block", width: "100%", height: "100%", touchAction: "none", cursor: "grab" });
  container.appendChild(canvas);

  const cena = new THREE.Scene();
  cena.background = new THREE.Color("#e7e6ea");
  const camera = new THREE.PerspectiveCamera(FOV_PERTO, 1, 0.05, 200);
  camera.rotation.order = "YXZ";

  const descartar: { dispose: () => void }[] = [];
  function guardar<T extends { dispose: () => void }>(x: T): T {
    descartar.push(x);
    return x;
  }

  // reflexo suave de uma sala clara em tudo (é o que tira o ar de "jogo antigo")
  const pmrem = new THREE.PMREMGenerator(renderer);
  const ambiente = guardar(pmrem.fromScene(new RoomEnvironment(), 0.04).texture);
  pmrem.dispose();
  cena.environment = ambiente;
  cena.environmentIntensity = 0.24;

  const cesta = criarCesta(op.corCesta);
  cesta.cena.environment = ambiente;
  cesta.cena.environmentIntensity = 0.5;

  const alvoComMsaa = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, alvoComMsaa);
  composer.addPass(new RenderPass(cena, camera));
  const oclusao = new GTAOPass(cena, camera, 1, 1);
  oclusao.blendIntensity = 1.0;
  oclusao.updateGtaoMaterial({ radius: 0.5, distanceExponent: 1.4, thickness: 1.0, scale: 1.0, samples: 12 });
  composer.addPass(oclusao);
  // só o que passa de 1,2 brilha (LED, spots, fundo das estantes); o resto fica nítido
  const brilho = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.58, 0.6, 1.2);
  composer.addPass(brilho);
  // a cesta por cima de tudo e fora do brilho (senão ela "acende")
  const passoCesta = new RenderPass(cesta.cena, camera);
  passoCesta.clear = false;
  passoCesta.clearDepth = true;
  composer.addPass(passoCesta);
  composer.addPass(new OutputPass());

  // ---- cores e materiais
  const branco = new THREE.Color("#ffffff");
  const primaria = new THREE.Color(op.corPrimaria);
  const escura = new THREE.Color(op.corEscura);
  const lilas = primaria.clone().lerp(branco, 0.5);
  const lilasClaro = primaria.clone().lerp(branco, 0.74);
  const hex = (c: THREE.Color) => `#${c.getHexString()}`;
  const fisico = (cor: THREE.ColorRepresentation, extra: THREE.MeshStandardMaterialParameters = {}) =>
    guardar(new THREE.MeshStandardMaterial({ color: cor, roughness: 0.6, metalness: 0, ...extra }));
  const basico = (cor: THREE.ColorRepresentation, extra: THREE.MeshBasicMaterialParameters = {}) =>
    guardar(new THREE.MeshBasicMaterial({ color: cor, ...extra }));
  /** cor acima de 1: é o que acende no brilho (fita de LED, spot, painel) */
  const acesa = (cor: THREE.ColorRepresentation, forca: number) => new THREE.Color(cor).multiplyScalar(forca);
  const mat = {
    parede: fisico(profissional ? "#ebe8e4" : "#ece4da", { roughness: 0.92 }),
    casca: fisico(profissional ? escura : "#2b2b31", { roughness: 0.5 }),
    movel: fisico("#fbfaf7", { roughness: 0.36 }),
    tampo: fisico("#ffffff", { roughness: 0.22 }),
    marca: fisico("#f8f6f2", { roughness: 0.8 }),
    led: basico(acesa("#ffe6bd", 4.5)),
    metal: fisico("#3a3a41", { roughness: 0.32, metalness: 0.7 }),
    cromado: fisico("#d9d9de", { roughness: 0.22, metalness: 0.85 }),
    vaso: fisico("#f4f1ec", { roughness: 0.45 }),
    tronco: fisico("#7b5b3f", { roughness: 0.9 }),
    folha: [
      fisico("#58884a", { flatShading: true, roughness: 0.75 }),
      fisico("#477a3a", { flatShading: true, roughness: 0.75 }),
      fisico("#74a35d", { flatShading: true, roughness: 0.75 }),
    ],
    sofa: fisico("#efe8e0", { roughness: 0.95 }),
    tapete: fisico(profissional ? "#d7d6db" : lilasClaro, { roughness: 1 }),
    pe: profissional ? fisico("#ffffff", { roughness: 0.3 }) : fisico(primaria.clone().lerp(new THREE.Color("#1d1530"), 0.45), { roughness: 0.4 }),
    monitor: fisico("#1c1c21", { roughness: 0.25, metalness: 0.2 }),
    rua: fisico("#dedee3", { roughness: 0.85 }),
    capacho: fisico("#45454c", { roughness: 1 }),
  };

  // ---- cenário fixo: tudo é juntado numa malha por material no fim
  const lotes = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const semSombra = new Set<THREE.Material>(); // paredes e casca: não escurecem o salão
  function juntar(m: THREE.Material, geo: THREE.BufferGeometry, matriz?: THREE.Matrix4) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (matriz) g.applyMatrix4(matriz);
    for (const nome of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(nome)) g.deleteAttribute(nome);
    g.clearGroups();
    const lista = lotes.get(m) ?? [];
    lista.push(g);
    lotes.set(m, lista);
  }
  semSombra.add(mat.parede).add(mat.casca);
  const auxQ = new THREE.Quaternion();
  const matriz = (x: number, y: number, z: number, ang = 0, sx = 1, sy = 1, sz = 1) =>
    new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), auxQ.setFromAxisAngle(eixoY, ang), new THREE.Vector3(sx, sy, sz));
  const geoCaixa = guardar(new THREE.BoxGeometry(1, 1, 1));
  const geoPlano = guardar(new THREE.PlaneGeometry(1, 1));
  const geoCilindro = guardar(new THREE.CylinderGeometry(1, 1, 1, 32));
  const geoBola = guardar(new THREE.IcosahedronGeometry(1, 1));
  const geoChao = guardar(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2));

  /** caixa no referencial do móvel: centro em (u, y, v), tamanho ao longo de u, y e v */
  function caixa(m: THREE.Material, f: Moldura, u: number, y: number, v: number, su: number, sy: number, sv: number) {
    const [x, z] = f.ponto(u, v);
    juntar(m, geoCaixa, matriz(x, y, z, f.ang, su, sy, sv));
  }
  /** plano de frente para v, com textura própria (malha separada); `luz` > 1 faz brilhar */
  function placa(tex: THREE.Texture, f: Moldura, u: number, y: number, v: number, su: number, sy: number, luz = 1) {
    const malha = new THREE.Mesh(geoPlano, basico(acesa("#ffffff", luz), { map: tex }));
    const [x, z] = f.ponto(u, v);
    malha.position.set(x, y, z);
    malha.rotation.y = f.ang;
    malha.scale.set(su, sy, 1);
    cena.add(malha);
    return malha;
  }

  // decalques no chão: poças de luz quente na frente das estantes e sombra de contato embaixo dos móveis
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
  const matSombra = decalque("#3b2d24", 0.16);
  const matLuzChao = decalque(acesa("#ffd393", 1.2), 0.34);
  const matLuzRoxa = decalque(acesa(lilas, 1.1), 0.36);
  function mancha(m: THREE.Material, x: number, z: number, sx: number, sz: number, ang = 0) {
    juntar(m, geoChao, matriz(x, 0.004, z, ang, sx, 1, sz));
  }

  // ---- grade do piso (onde dá para pisar)
  // vai do fundo da loja até o fim do corredor de fora; a fachada só deixa passar pelo vão da porta
  const GX = Math.round(LARGURA / CELULA);
  const GZ = Math.round((FUNDO + FORA) / CELULA);
  const livre = new Uint8Array(GX * GZ).fill(1);
  const celX = (i: number) => X0 + (i + 0.5) * CELULA;
  const celZ = (j: number) => Z0 + (j + 0.5) * CELULA;
  const naFachada = (z: number) => z > Z1 - RAIO && z < Z1 + PAREDE + RAIO;
  for (let j = 0; j < GZ; j++) {
    for (let i = 0; i < GX; i++) {
      const x = celX(i);
      const z = celZ(j);
      const foraDosLimites = x < X0 + RAIO || x > X1 - RAIO || z < Z0 + RAIO || z > Z1 + FORA - RAIO;
      if (foraDosLimites || (naFachada(z) && Math.abs(x) > VAO - RAIO)) livre[j * GX + i] = 0;
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

  // ---- quem enche cada móvel: uma marca, ou uma mistura (as marcas pequenas primeiro)
  const S = op.setores;
  const usados = new Array<number>(S.length).fill(0);
  const colocados: number[] = [];
  const filaMista: ProdutoCena[] = [];
  let vez = 0;
  function proximoMisto(): ProdutoCena | null {
    const p = filaMista.shift();
    if (p) return p;
    for (let t = 0; t < colocados.length; t++) {
      const s = colocados[vez++ % colocados.length];
      if (usados[s] < S[s].produtos.length) return S[s].produtos[usados[s]++];
    }
    for (let t = 0; t < S.length; t++) {
      const lista = S[vez++ % S.length].produtos;
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
          const lista = S[setor].produtos;
          atual = lista.length ? lista[usados[setor]++ % lista.length] : null;
        }
      }
      return atual;
    };
  }

  // ---- textos, logos e painéis
  function texTitulo(texto: string) {
    return guardar(
      textura(1024, 256, (g) => {
        g.fillStyle = "#fbfaf7";
        g.fillRect(0, 0, 1024, 256);
        g.fillStyle = "#2a2a31";
        let tam = 104;
        g.font = `600 ${tam}px ${op.fonte}`;
        while (tam > 40 && g.measureText(texto).width + texto.length * tam * 0.16 > 940) {
          tam -= 4;
          g.font = `600 ${tam}px ${op.fonte}`;
        }
        g.textBaseline = "middle";
        escreverEspacado(g, texto, 512, 136, tam * 0.16);
      })
    );
  }
  /** logo da marca num fundo branco (1024 × 256): começa com o nome e troca pela logo quando ela chega */
  const texDaMarca = new Map<number, THREE.CanvasTexture>();
  function texMarca(setor: number) {
    const pronta = texDaMarca.get(setor);
    if (pronta) return pronta;
    const s = S[setor];
    const tex = texTitulo(s.nome.toUpperCase());
    texDaMarca.set(setor, tex);
    if (s.logo) {
      carregarLogo(s.logo)
        .then((img) => {
          const c = tex.image as HTMLCanvasElement;
          const g = c.getContext("2d");
          if (!g || destruida) return;
          g.fillStyle = "#fbfaf7";
          g.fillRect(0, 0, c.width, c.height);
          const e = Math.min(860 / img.width, 196 / img.height);
          g.drawImage(img, (c.width - img.width * e) / 2, (c.height - img.height * e) / 2, img.width * e, img.height * e);
          tex.needsUpdate = true;
        })
        .catch(() => {
          // sem logo: fica o nome
        });
    }
    return tex;
  }
  /** logo da loja em linhas: a fina (espaçada) e a forte, como no topo do site; encolhe para caber */
  function desenharLogo(g: CanvasRenderingContext2D, cx: number, cy: number, base: number, corFina: string, corForte: string, largura = Infinity) {
    const larguraForte = (l: LinhaLogo, tam: number) => {
      g.font = `900 ${tam}px ${op.fonte}`;
      const a = g.measureText(l.texto).width;
      g.font = `400 ${tam}px ${op.fonte}`;
      return a + (l.sufixo ? g.measureText(l.sufixo).width : 0);
    };
    const maior = Math.max(...op.logo.filter((l) => l.destaque).map((l) => larguraForte(l, base)), 1);
    if (maior > largura * 0.92) base *= (largura * 0.92) / maior;
    const linhas = op.logo.map((l) => ({ ...l, tam: l.destaque ? base : base * 0.34 }));
    const alturaDe = (l: { destaque: boolean; tam: number }) => l.tam * (l.destaque ? 0.95 : 1.25);
    let y = cy - linhas.reduce((a, l) => a + alturaDe(l), 0) / 2;
    g.textBaseline = "middle";
    for (const l of linhas) {
      const h = alturaDe(l);
      g.fillStyle = l.destaque ? corForte : corFina;
      if (l.destaque && l.sufixo) {
        const total = larguraForte(l, l.tam);
        g.font = `900 ${l.tam}px ${op.fonte}`;
        const a = g.measureText(l.texto).width;
        g.textAlign = "left";
        g.fillText(l.texto, cx - total / 2, y + h / 2);
        g.font = `400 ${l.tam}px ${op.fonte}`;
        g.fillText(l.sufixo, cx - total / 2 + a, y + h / 2);
      } else {
        g.font = `${l.destaque ? 900 : 400} ${l.tam}px ${op.fonte}`;
        escreverEspacado(g, l.texto, cx, y + h / 2, l.destaque ? l.tam * 0.02 : l.tam * 0.42);
      }
      y += h;
    }
  }
  /** painel lilás iluminado com ondas suaves */
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
          gr.addColorStop(0.85, "rgba(255,255,255,0.3)");
          gr.addColorStop(1, "rgba(255,255,255,0)");
          g.fillStyle = gr;
          g.fillRect(0, 0, largura, altura);
        }
        conteudo?.(g);
      })
    );
  }
  /** painel azul com uma gota d'água em luz suave (arranjo profissional) */
  function texPainelAgua(largura: number, altura: number, variante: number) {
    return guardar(
      textura(largura, altura, (g) => {
        const fundo = g.createLinearGradient(0, 0, largura * 0.5, altura);
        fundo.addColorStop(0, hex(escura));
        fundo.addColorStop(0.6, hex(primaria));
        fundo.addColorStop(1, hex(primaria.clone().lerp(branco, 0.55)));
        g.fillStyle = fundo;
        g.fillRect(0, 0, largura, altura);
        const gx = largura * (variante ? 0.4 : 0.58);
        const gy = altura * (variante ? 0.58 : 0.42);
        for (let k = 1; k <= 3; k++) {
          g.strokeStyle = `rgba(255,255,255,${0.22 - k * 0.05})`;
          g.lineWidth = 3;
          g.beginPath();
          g.ellipse(gx, gy + largura * 0.22, largura * 0.12 * k, largura * 0.03 * k, 0, 0, Math.PI * 2);
          g.stroke();
        }
        const r = largura * 0.2;
        const gota = g.createRadialGradient(gx - r * 0.3, gy - r * 0.35, r * 0.05, gx, gy, r);
        gota.addColorStop(0, "rgba(255,255,255,0.85)");
        gota.addColorStop(0.35, "rgba(255,255,255,0.25)");
        gota.addColorStop(0.9, "rgba(255,255,255,0.12)");
        gota.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = gota;
        g.beginPath();
        g.arc(gx, gy, r, 0, Math.PI * 2);
        g.fill();
      })
    );
  }
  // fundo das estantes: luz quente que sai de trás dos produtos
  const matFundoEstante = basico(acesa("#ffffff", 1.55), {
    map: guardar(
      textura(256, 256, (g) => {
        const gr = g.createRadialGradient(128, 110, 8, 128, 128, 200);
        gr.addColorStop(0, "#fff8ea");
        gr.addColorStop(1, "#e9d6ba");
        g.fillStyle = gr;
        g.fillRect(0, 0, 256, 256);
      })
    ),
  });

  // ---- piso (porcelanato claro e brilhante), rua, paredes e teto
  const texPiso = guardar(
    textura(512, 512, (g) => {
      g.fillStyle = profissional ? "#e9e6e1" : "#ebe2d7";
      g.fillRect(0, 0, 512, 512);
      // veios bem leves, para não parecer tinta lisa
      for (let k = 0; k < 900; k++) {
        g.fillStyle = `rgba(${150 + (k % 40)},${140 + (k % 30)},${130 + (k % 20)},0.025)`;
        g.beginPath();
        g.ellipse((k * 97) % 512, (k * 61) % 512, 6 + (k % 23), 1.5 + (k % 4), (k % 17) * 0.2, 0, Math.PI * 2);
        g.fill();
      }
      g.strokeStyle = profissional ? "#e2ded8" : "#e2d8cd";
      g.lineWidth = 3;
      g.strokeRect(1.5, 1.5, 509, 509);
    })
  );
  texPiso.wrapS = texPiso.wrapT = THREE.RepeatWrapping;
  texPiso.repeat.set(LARGURA / 1.2, FUNDO / 1.2);
  const piso = new THREE.Mesh(guardar(new THREE.PlaneGeometry(LARGURA, FUNDO)), fisico("#ffffff", { map: texPiso, roughness: 0.16 }));
  piso.rotation.x = -Math.PI / 2;
  piso.receiveShadow = true;
  cena.add(piso);
  juntar(mat.rua, geoChao, matriz(0, -0.01, 0, 0, 140, 1, 140));
  juntar(mat.capacho, geoCaixa, matriz(0, 0.006, Z1 + PAREDE + 0.6, 0, 2.2, 0.012, 0.9));

  const paredeFundo = new Moldura(0, Z0, 0);
  const paredeEsq = new Moldura(X0, 0, Math.PI / 2); // u = -z
  const paredeDir = new Moldura(X1, 0, -Math.PI / 2); // u = z
  caixa(mat.casca, paredeFundo, 0, ALTURA / 2, -PAREDE / 2, LARGURA + PAREDE * 2, ALTURA, PAREDE);
  caixa(mat.parede, paredeFundo, 0, ALTURA / 2, 0.01, LARGURA, ALTURA, 0.02);
  volumeCaixa(paredeFundo, 0, ALTURA / 2, -0.05, LARGURA, ALTURA, 0.1, null);
  for (const lado of [-1, 1]) {
    caixa(mat.casca, new Moldura(lado * (X1 + PAREDE / 2), 0, Math.PI / 2), 0, ALTURA / 2, 0, FUNDO, ALTURA, PAREDE);
    caixa(mat.parede, new Moldura(lado * (X1 - 0.01), 0, Math.PI / 2), 0, ALTURA / 2, 0, FUNDO, ALTURA, 0.02);
    volumeCaixa(new Moldura(lado * (X1 + 0.05), 0, Math.PI / 2), 0, ALTURA / 2, 0, FUNDO, ALTURA, 0.1, null);
  }

  // frente: pilares, vidro e porta dupla no meio
  const fachada = new Moldura(0, Z1 + PAREDE / 2, 0);
  for (const x of [-(X1 + PAREDE / 2 - 0.3), -(VAO + 0.3), VAO + 0.3, X1 + PAREDE / 2 - 0.3]) {
    caixa(mat.casca, fachada, x, ALTURA / 2, 0, 0.6 + (Math.abs(x) > 5 ? PAREDE : 0), ALTURA, PAREDE + 0.12);
  }
  caixa(mat.casca, fachada, 0, ALTURA - 0.3, 0, LARGURA + PAREDE * 2, 0.6, PAREDE);
  const matVidro = fisico("#dfe9ef", { transparent: true, opacity: 0.16, roughness: 0.04, depthWrite: false, side: THREE.DoubleSide });
  semSombra.add(matVidro);
  const altVidro = ALTURA - 0.6;
  for (const lado of [-1, 1]) {
    const comp = X1 - 0.6 - (VAO + 0.6);
    const meio = lado * (VAO + 0.6 + comp / 2);
    juntar(matVidro, geoPlano, matriz(meio, altVidro / 2, Z1 + 0.02, 0, comp, altVidro, 1));
    for (let k = 0; k <= 4; k++) caixa(mat.metal, fachada, lado * (VAO + 0.6) + lado * k * (comp / 4), altVidro / 2, -0.12, 0.05, altVidro, 0.06);
  }
  juntar(matVidro, geoPlano, matriz(0, 3.15, Z1 + 0.04, 0, VAO * 2, 0.5, 1));
  caixa(mat.metal, fachada, 0, 2.9, -0.14, VAO * 2, 0.05, 0.05);
  // porta automática: duas folhas de vidro que correm para os lados (por fora do vidro fixo)
  const folhas: THREE.Group[] = [];
  for (const lado of [-1, 1]) {
    const folha = new THREE.Group();
    const vidro = new THREE.Mesh(geoPlano, matVidro);
    vidro.scale.set(VAO - 0.06, 2.9, 1);
    vidro.position.y = 1.45;
    vidro.renderOrder = 1;
    folha.add(vidro);
    for (const borda of [-1, 1]) {
      const perfil = new THREE.Mesh(geoCaixa, mat.metal);
      perfil.scale.set(0.05, 2.9, 0.05);
      perfil.position.set((borda * (VAO - 0.06)) / 2, 1.45, 0);
      folha.add(perfil);
    }
    const puxador = new THREE.Mesh(geoCaixa, mat.cromado);
    puxador.scale.set(0.03, 1.0, 0.03);
    puxador.position.set(-lado * (VAO / 2 - 0.22), 1.15, 0.05);
    folha.add(puxador);
    folha.position.set((lado * VAO) / 2, 0, Z1 + 0.1);
    folha.userData = { lado };
    cena.add(folha);
    folhas.push(folha);
  }
  // letreiro iluminado em cima da porta, do lado de fora
  placa(
    guardar(
      textura(1024, 160, (g) => {
        g.fillStyle = hex(profissional ? escura : new THREE.Color("#2b2b31"));
        g.fillRect(0, 0, 1024, 160);
        desenharLogo(g, 512, 80, 96, profissional ? "#ffffff" : hex(lilasClaro), "#ffffff", 700);
      })
    ),
    new Moldura(0, Z1 + PAREDE + 0.004, 0),
    0,
    ALTURA - 0.3,
    0,
    3.6,
    0.56,
    1.4
  );
  // corredor do shopping: piso claro em placas grandes, onde a pessoa começa
  const texCorredor = guardar(
    textura(256, 256, (g) => {
      g.fillStyle = "#e9e8ec";
      g.fillRect(0, 0, 256, 256);
      g.strokeStyle = "#dcdbe0";
      g.lineWidth = 2;
      g.strokeRect(1, 1, 254, 254);
    })
  );
  texCorredor.wrapS = texCorredor.wrapT = THREE.RepeatWrapping;
  texCorredor.repeat.set((LARGURA + 20) / 1.6, (FORA + 4) / 1.6);
  const pisoFora = new THREE.Mesh(guardar(new THREE.PlaneGeometry(LARGURA + 20, FORA + 4)), fisico("#ffffff", { map: texCorredor, roughness: 0.2 }));
  pisoFora.rotation.x = -Math.PI / 2;
  pisoFora.position.set(0, -0.002, Z1 + PAREDE + (FORA + 4) / 2);
  pisoFora.receiveShadow = true;
  cena.add(pisoFora);

  // teto com spots (só de perto; de cima a loja fica aberta, como maquete)
  const teto = new THREE.Group();
  const forro = new THREE.Mesh(guardar(new THREE.PlaneGeometry(LARGURA, FUNDO)), basico("#f2eee8"));
  forro.rotation.x = Math.PI / 2;
  forro.position.y = ALTURA;
  teto.add(forro);
  const spots = new THREE.InstancedMesh(guardar(new THREE.CircleGeometry(0.11, 20).rotateX(Math.PI / 2)), basico(acesa("#fff3dc", 6)), 300);
  let nSpot = 0;
  for (let x = X0 + 1.5; x < X1; x += 2.5) for (let z = Z0 + 1.5; z < Z1; z += 2.5) spots.setMatrixAt(nSpot++, matriz(x, ALTURA - 0.005, z));
  spots.count = nSpot;
  teto.add(spots);
  cena.add(teto);

  // ---- luz: céu claro + uma luz alta que faz as sombras dos móveis + o reflexo do ambiente
  // a luz vem da frente e da esquerda, alta: as sombras caem para o fundo e para a direita
  cena.add(new THREE.HemisphereLight(0xfff8ef, 0xe6ddd2, 0.2));
  const sol = new THREE.DirectionalLight(0xfff1df, 3.0);
  sol.position.set(-15, 16, 14);
  sol.target.position.set(0, 0, 0);
  sol.castShadow = true;
  sol.shadow.camera.left = -21;
  sol.shadow.camera.right = 21;
  sol.shadow.camera.top = 17;
  sol.shadow.camera.bottom = -17;
  sol.shadow.camera.near = 1;
  sol.shadow.camera.far = 60;
  sol.shadow.bias = -0.0004;
  sol.shadow.normalBias = 0.025;
  sol.shadow.radius = 3;
  sol.shadow.mapSize.set(4096, 4096);
  cena.add(sol, sol.target);

  // ---- móveis
  function planta(x: number, z: number, e = 1, y = 0, vasoQuadrado = false) {
    if (vasoQuadrado) juntar(mat.vaso, geoCaixa, matriz(x, y + 0.25 * e, z, 0, 0.5 * e, 0.5 * e, 0.5 * e));
    else juntar(mat.vaso, geoCilindro, matriz(x, y + 0.22 * e, z, 0, 0.2 * e, 0.44 * e, 0.2 * e));
    juntar(mat.tronco, geoCilindro, matriz(x, y + 0.6 * e, z, 0, 0.025 * e, 0.5 * e, 0.025 * e));
    const folhas: [number, number, number, number][] = [
      [0, 1.05, 0, 0.3],
      [0.16, 0.9, 0.05, 0.22],
      [-0.15, 0.95, -0.06, 0.24],
      [0.04, 1.25, -0.1, 0.22],
      [-0.06, 0.82, 0.14, 0.2],
      [0.12, 1.15, 0.12, 0.2],
      [-0.12, 1.18, 0.08, 0.18],
    ];
    folhas.forEach(([fx, fy, fz, r], k) =>
      juntar(mat.folha[k % 3], geoBola, matriz(x + fx * e, y + fy * e, z + fz * e, k * 1.3, r * e, r * e * 0.9, r * e))
    );
    if (y === 0) {
      bloquearCirculo(x, z, (vasoQuadrado ? 0.3 : 0.22) * e);
      mancha(matSombra, x, z, 0.8 * e, 0.8 * e);
    }
  }

  /** estante de parede: armário embaixo, 3 tábuas iluminadas e a logo da marca em cima */
  const vistaDoSetor = new Map<number, Vista>();
  function estante(cx: number, cz: number, ang: number, larg: number, setor: number | null) {
    const f = new Moldura(cx, cz, ang);
    const P = PROF_ESTANTE;
    const [fx, fz] = f.ponto(0, 0.02);
    juntar(matFundoEstante, geoPlano, matriz(fx, 1.36, fz, ang, larg - 0.1, 1.72, 1));
    for (const lado of [-1, 1]) caixa(mat.movel, f, lado * (larg / 2 - 0.03), 1.3, P / 2, 0.06, 2.6, P);
    caixa(mat.movel, f, 0, 0.25, P / 2, larg, 0.5, P);
    caixa(mat.movel, f, 0, 2.43, P / 2, larg, 0.4, P);
    caixa(mat.led, f, 0, 0.505, P - 0.02, larg - 0.1, 0.01, 0.02);
    caixa(mat.led, f, 0, 2.22, P - 0.03, larg - 0.12, 0.012, 0.02); // fita embaixo da logo
    const tabuas = [0.92, 1.32, 1.72];
    for (const h of tabuas) {
      caixa(mat.movel, f, 0, h - 0.0125, P / 2 + 0.02, larg - 0.1, 0.025, P - 0.04);
      caixa(mat.led, f, 0, h - 0.032, P - 0.04, larg - 0.12, 0.01, 0.015);
    }
    placa(setor !== null ? texMarca(setor) : texTitulo(op.tituloDestaques.toUpperCase()), f, 0, 2.43, P + 0.002, larg - 0.3, (larg - 0.3) / 4);
    const [lx, lz] = f.ponto(0, P + 0.8);
    mancha(matLuzChao, lx, lz, larg * 1.05, 1.9, ang);
    bloquearRet(f, -larg / 2, larg / 2, 0, P);
    const alvo = (u: number) => vistaDe(f, limitar(u, -larg / 2 + 0.7, larg / 2 - 0.7), P, 1.75, 1.25, setor);
    volumeCaixa(f, 0, 1.3, P * 0.3, larg, 2.6, P * 0.6, (p) => alvo(f.local(p.x, p.z)[0]));
    if (setor !== null) vistaDoSetor.set(setor, alvo(0));

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

  interface OpcoesIlha {
    setor: number | null;
    alta?: boolean; // com degrau no meio
    titulo?: string; // ilha de várias marcas: o nome nas pontas (sem marca e sem título = sem placa)
    raio?: number; // canto (o padrão é ponta redonda)
    plantaNoTopo?: boolean;
    distVista?: number;
  }
  /** ilha em pílula ou retângulo de cantos redondos; produtos dos dois lados compridos e a logo nas pontas */
  function ilha(cx: number, cz: number, ang: number, comp: number, larg: number, o: OpcoesIlha) {
    const { setor, alta = true, titulo, raio, plantaNoTopo = false, distVista = 1.5 } = o;
    const f = new Moldura(cx, cz, ang);
    const H = alta ? 0.78 : 0.7;
    const r = raio ?? larg / 2;
    juntar(mat.movel, guardar(extrudarDeitado(formaPilula(comp, larg, r), H, 0.02)), matriz(cx, 0, cz, ang));
    juntar(mat.led, guardar(extrudarDeitado(formaPilula(comp + 0.05, larg + 0.05, r), 0.035)), matriz(cx, 0.02, cz, ang));
    juntar(mat.tampo, guardar(extrudarDeitado(formaPilula(comp + 0.03, larg + 0.03, r), 0.03)), matriz(cx, H, cz, ang));
    const reto = Math.max(comp - larg, comp * 0.45);
    if (alta) caixa(mat.tampo, f, 0, H + 0.19, 0, reto, 0.32, 0.3);
    const tex = setor !== null ? texMarca(setor) : titulo ? texTitulo(titulo) : null;
    if (tex) {
      // placa com a logo de pé em cima de cada ponta, virada para fora
      for (const ponta of [-1, 1]) {
        const [x, z] = f.ponto(ponta * (comp / 2 - 0.2), 0);
        const largPlaca = Math.min(0.86, larg * 0.78);
        caixa(mat.movel, new Moldura(x, z, ang + Math.PI / 2), 0, H + 0.03 + 0.15, 0, largPlaca + 0.04, 0.26, 0.03);
        const card = new THREE.Mesh(geoPlano, basico("#ffffff", { map: tex }));
        card.position.set(x, H + 0.03 + 0.15, z);
        card.rotation.y = ang + (ponta < 0 ? -Math.PI / 2 : Math.PI / 2);
        card.translateZ(0.017);
        card.scale.set(largPlaca, largPlaca / 4, 1);
        cena.add(card);
      }
    }
    if (plantaNoTopo) {
      const [x, z] = f.ponto(0, 0);
      planta(x, z, 0.5, H + 0.35);
    }
    mancha(matSombra, cx, cz, comp + 0.6, larg + 0.6, ang);
    bloquearRet(f, -comp / 2, comp / 2, -larg / 2, larg / 2);
    if (setor !== null) vistaDoSetor.set(setor, vistaDe(f, 0, larg / 2, distVista + 0.4, H + 0.2, setor));

    const proximo = fornecedor(setor);
    for (const lado of [1, -1]) {
      const fl = new Moldura(cx, cz, ang + (lado > 0 ? 0 : Math.PI));
      const alvo = (u: number) => vistaDe(fl, limitar(u, -reto / 2, reto / 2), larg / 2, distVista, H + 0.2, setor);
      // só o corpo da ilha e o degrau: o clique no produto acerta o produto
      volumeCaixa(fl, 0, H / 2, larg / 4, comp, H, larg / 2, (p) => alvo(fl.local(p.x, p.z)[0]));
      if (alta) volumeCaixa(fl, 0, H + 0.19, 0.075, reto, 0.32, 0.15, (p) => alvo(fl.local(p.x, p.z)[0]));
      const fileiras: [number, number, number][] = alta
        ? [
            [H + 0.03, larg / 2 - 0.16, 0.85],
            [H + 0.35, 0.07, 0.85],
          ]
        : [[H + 0.03, larg / 2 - 0.15, 0.8]];
      for (const [y, v, escala] of fileiras) {
        if (plantaNoTopo && v < 0.1) continue; // o meio é da planta
        const util = (v > 0.1 ? comp - larg * 0.55 : reto) - 0.15 - (tex ? 0.5 : 0);
        const n = Math.max(1, Math.floor(util / 0.22));
        const passo = util / n;
        for (let k = 0; k < n; k++) {
          const p = proximo();
          if (!p) continue;
          const u = -util / 2 + passo * (k + 0.5);
          const [x, z] = fl.ponto(u, v);
          vaga(p, x, y, z, fl.ang, escala, vistaDe(fl, limitar(u, -reto / 2, reto / 2), larg / 2, distVista - 0.1, y + 0.12, setor));
        }
      }
    }
  }

  /** mesa redonda de pé canelado, planta no meio e produtos em roda */
  function mesaRedonda(cx: number, cz: number, r: number) {
    const texCanelado = guardar(
      textura(256, 16, (g) => {
        for (let k = 0; k < 32; k++) {
          g.fillStyle = k % 2 ? "#f4f1ec" : "#e5e0d9";
          g.fillRect(k * 8, 0, 8, 16);
        }
      })
    );
    texCanelado.wrapS = THREE.RepeatWrapping;
    texCanelado.repeat.set(4, 1);
    juntar(fisico("#ffffff", { map: texCanelado, roughness: 0.4 }), geoCilindro, matriz(cx, 0.37, cz, 0, r * 0.68, 0.74, r * 0.68));
    juntar(mat.tampo, geoCilindro, matriz(cx, 0.765, cz, 0, r, 0.05, r));
    juntar(mat.led, geoCilindro, matriz(cx, 0.015, cz, 0, r * 0.7, 0.02, r * 0.7));
    planta(cx, cz, 0.62, 0.79);
    mancha(matSombra, cx, cz, r * 2.6, r * 2.6);
    bloquearCirculo(cx, cz, r);
    const vistaAng = (a: number): Vista => ({
      x: cx + Math.sin(a) * (r + 1.3),
      z: cz + Math.cos(a) * (r + 1.3),
      yaw: a,
      pitch: Math.atan2(0.95 - OLHO, 1.3),
      setor: null,
    });
    volume(geoCilindro, cx, 0.395, cz, 0, r, 0.79, r, (p) => vistaAng(Math.atan2(p.x - cx, p.z - cz)));
    const n = 16;
    for (let k = 0; k < n; k++) {
      const p = proximoMisto();
      if (!p) continue;
      const a = (k / n) * Math.PI * 2;
      vaga(p, cx + Math.sin(a) * (r - 0.14), 0.79, cz + Math.cos(a) * (r - 0.14), a, 0.75, vistaAng(a));
    }
  }

  /** painel iluminado na parede, com moldura branca */
  function painel(f: Moldura, u: number, larg: number, alt: number, tex: THREE.Texture) {
    caixa(mat.movel, f, u, 0.1 + alt / 2, 0.04, larg + 0.1, alt + 0.1, 0.08);
    placa(tex, f, u, 0.1 + alt / 2, 0.082, larg, alt, 1.35);
    const [x, z] = f.ponto(u, 0.9);
    mancha(matLuzRoxa, x, z, larg * 2.4, 1.8, f.ang);
    bloquearRet(f, u - larg / 2, u + larg / 2, 0, 0.1);
  }

  /** sofá curvo em volta de uma mesinha, num tapete redondo; `abertura` = para onde o sofá abre */
  function cantinho(cx: number, cz: number, abertura: number, comLivro: boolean) {
    juntar(mat.tapete, guardar(new THREE.CircleGeometry(1.5, 56).rotateX(-Math.PI / 2)), matriz(cx, 0.006, cz));
    // na forma o ângulo é o do chão com o sinal trocado (o y da forma vira -z)
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
    juntar(mat.sofa, guardar(extrudarDeitado(pedacoDeAnel(0.58, 1.15), 0.43, 0.06)), matriz(cx, 0, cz));
    juntar(mat.sofa, guardar(extrudarDeitado(pedacoDeAnel(0.93, 1.15), 0.84, 0.06)), matriz(cx, 0, cz));
    const [mx, mz] = [cx + Math.cos(abertura) * 0.25, cz + Math.sin(abertura) * 0.25];
    juntar(mat.pe, geoCilindro, matriz(mx, 0.22, mz, 0, 0.17, 0.44, 0.17));
    juntar(mat.tampo, geoCilindro, matriz(mx, 0.46, mz, 0, 0.32, 0.04, 0.32));
    planta(mx - 0.06, mz - 0.04, 0.36, 0.48);
    if (comLivro) juntar(mat.monitor, geoCaixa, matriz(mx + 0.14, 0.49, mz + 0.07, 0.4, 0.17, 0.025, 0.23));
    mancha(matSombra, cx, cz, 2.8, 2.8);
    bloquearCirculo(cx, cz, 1.18);
  }

  // ---- seções por marca: as maiores marcas ganham lugar; as da mesma categoria ficam lado a lado
  // a ordem dos lugares é um passeio pela loja: fundo à esquerda, parede esquerda, ilhas,
  // parede direita e fundo à direita (no profissional, sem a 3ª estante do fundo à
  // direita: ali fica a porta da área interna)
  type Lugar = (setor: number | null) => void;
  const est = (x: number, z: number, ang: number): Lugar => (setor) => estante(x, z, ang, 3.0, setor);
  const ilh = (x: number, z: number): Lugar => (setor) =>
    ilha(x, z, Math.PI / 2, 3.2, 1.2, { setor, raio: profissional ? 0.12 : undefined, distVista: 1.45 });
  const caminho: Lugar[] = [
    est(-6.45, Z0, 0),
    est(-9.65, Z0, 0),
    est(-12.85, Z0, 0),
    est(X0, -7.6, Math.PI / 2),
    est(X0, -4.4, Math.PI / 2),
    est(X0, -1.2, Math.PI / 2),
    est(X0, 2.0, Math.PI / 2),
    ilh(-9.8, -2.4),
    ilh(-9.8, 3.0),
    ilh(-5.0, -2.4),
    ilh(-5.0, 3.0),
    ilh(5.0, -2.4),
    ilh(5.0, 3.0),
    ilh(9.8, -2.4),
    ilh(9.8, 3.0),
    est(X1, 2.0, -Math.PI / 2),
    est(X1, -1.2, -Math.PI / 2),
    est(X1, -4.4, -Math.PI / 2),
    est(X1, -7.6, -Math.PI / 2),
    ...(profissional ? [] : [est(12.85, Z0, 0)]),
    est(9.65, Z0, 0),
    est(6.45, Z0, 0),
  ];
  {
    const posCat = (c: string) => {
      const i = op.categorias.indexOf(c);
      return i < 0 ? 99 : i;
    };
    const escolhidos = S.map((_, i) => i).slice(0, caminho.length);
    escolhidos.sort((a, b) => posCat(S[a].categoria) - posCat(S[b].categoria) || a - b);
    colocados.push(...escolhidos);
    // marcas que não couberam vão para as mesas e vitrines, misturadas
    const resto = S.map((_, i) => i).slice(caminho.length);
    for (let k = 0; resto.some((s) => k < S[s].produtos.length); k++) {
      for (const s of resto) if (S[s].produtos[k]) filaMista.push(S[s].produtos[k]);
    }
    caminho.forEach((montar, k) => montar(k < colocados.length ? colocados[k] : null));
  }

  // ---- fundo: parede do logo entre pilares, com o caixa na frente
  const largMarca = 8.4;
  for (const lado of [-1, 1]) caixa(mat.casca, paredeFundo, lado * (largMarca / 2 + 0.3), ALTURA / 2, 0.35, 0.6, ALTURA, 0.7);
  caixa(mat.marca, paredeFundo, 0, ALTURA / 2, 0.13, largMarca, ALTURA, 0.24);
  caixa(mat.led, paredeFundo, 0, 0.03, 0.255, largMarca, 0.02, 0.02);
  const corLogo = profissional ? hex(escura) : hex(primaria);
  placa(
    guardar(
      textura(2048, 820, (g) => {
        g.fillStyle = "#f8f6f2";
        g.fillRect(0, 0, 2048, 820);
        desenharLogo(g, 1024, 410, 460, profissional ? corLogo : hex(primaria.clone().lerp(branco, 0.25)), corLogo, 2048);
      })
    ),
    paredeFundo,
    0,
    2.65,
    0.252,
    5.2,
    2.08
  );
  if (!profissional) {
    for (const lado of [-1, 1]) painel(new Moldura(0, Z0 + 0.25, 0), lado * 3.35, 0.85, 3.2, texPainelRoxo(256, 960));
  }
  bloquearRet(paredeFundo, -largMarca / 2 - 0.6, largMarca / 2 + 0.6, 0, 0.7);
  {
    const cz = Z0 + 2.6;
    const f = new Moldura(0, cz, 0);
    const [cc, lc, rc] = profissional ? [4.6, 0.95, 0.06] : [5.2, 1.0, undefined];
    juntar(mat.movel, guardar(extrudarDeitado(formaPilula(cc, lc, rc), 1.05, 0.02)), matriz(0, 0, cz));
    juntar(mat.tampo, guardar(extrudarDeitado(formaPilula(cc + 0.14, lc + 0.12, rc), 0.045)), matriz(0, 1.05, cz));
    juntar(mat.led, guardar(extrudarDeitado(formaPilula(cc + 0.06, lc + 0.06, rc), 0.03)), matriz(0, 0.02, cz));
    for (const x of [-1.15, 1.15]) {
      caixa(mat.monitor, f, x, 1.4, -0.14, 0.6, 0.38, 0.03);
      caixa(mat.monitor, f, x, 1.17, -0.18, 0.05, 0.16, 0.05);
      caixa(mat.monitor, f, x, 1.105, -0.18, 0.24, 0.01, 0.15);
    }
    planta(-cc / 2 + 0.45, cz, 0.5, 1.095);
    caixa(mat.tampo, f, cc / 2 - 0.45, 1.2, 0, 0.14, 0.22, 0.12);
    mancha(matSombra, 0, cz, cc + 0.8, 1.8);
    bloquearRet(f, -cc / 2, cc / 2, -lc / 2, lc / 2);
    const vistaCaixa: Vista = { x: 0, z: cz + 2.3, yaw: 0, pitch: Math.atan2(1.7 - OLHO, 3.2), setor: null };
    volumeCaixa(f, 0, 0.6, 0, cc, 1.2, lc, () => vistaCaixa);
  }

  if (!profissional) {
    // ===== conceito: mesa redonda no meio, cantinho lilás, painel com a marca na vertical
    mesaRedonda(0, -1.9, 1.05);
    for (const [x, comp] of [
      [-6.6, 1.9],
      [-2.7, 1.3],
      [2.7, 1.3],
      [6.6, 1.9],
    ] as const) {
      ilha(x, 6.6, 0, comp, 0.85, { setor: null, alta: false });
    }
    cantinho(-11.2, 6.6, Math.PI / 6, false);
    painel(paredeEsq, -5.7, 1.8, 2.7, texPainelRoxo(512, 780));
    const marcaForte = op.logo.find((l) => l.destaque)?.texto ?? "";
    painel(
      paredeDir,
      5.4,
      0.95,
      3.1,
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
    planta(X0 + 0.55, 4.3, 1.1);
    planta(X0 + 0.55, 8.4, 1.1);
    planta(X1 - 0.55, 3.9, 1.1);
    planta(X1 - 0.55, 7.0, 1.2);
  } else {
    // ===== profissional: ilha Destaques no meio, balcão com banquetas, marca na parede direita
    ilha(0, 0.3, Math.PI / 2, 3.2, 1.1, { setor: null, titulo: op.tituloDestaques.toUpperCase(), plantaNoTopo: true, distVista: 1.45 });
    for (const x of [-5.0, 5.0]) ilha(x, 7.0, 0, 1.7, 0.85, { setor: null, alta: false, raio: 0.1 });
    {
      // porta da área interna, no canto do fundo à direita
      const x = 13.2;
      caixa(mat.movel, paredeFundo, x, 1.3, 0.03, 1.6, 2.6, 0.06);
      const matPorta = fisico("#e7e5e1", { roughness: 0.5 });
      for (const lado of [-1, 1]) {
        caixa(matPorta, paredeFundo, x + lado * 0.375, 1.25, 0.07, 0.71, 2.4, 0.02);
        caixa(mat.cromado, paredeFundo, x + lado * 0.09, 1.15, 0.09, 0.025, 0.55, 0.025);
      }
      bloquearRet(paredeFundo, x - 0.85, x + 0.85, 0, 0.1);
      planta(X1 - 0.6, Z0 + 0.6, 1.2);
    }
    painel(paredeEsq, -5.7, 1.8, 2.7, texPainelAgua(512, 780, 0));
    {
      const f = new Moldura(X1, 6.2, -Math.PI / 2);
      placa(
        guardar(
          textura(1024, 256, (g) => {
            g.fillStyle = "#f3f1ee";
            g.fillRect(0, 0, 1024, 256);
            desenharLogo(g, 512, 128, 150, hex(escura), hex(escura), 1024);
          })
        ),
        f,
        0,
        2.9,
        0.012,
        3.2,
        0.8
      );
    }
    {
      // balcão de atendimento com três banquetas, de frente para o meio da loja
      const f = new Moldura(12.7, 6.2, -Math.PI / 2); // u = z; v aponta para o meio (-x)
      const comp = 3.6;
      caixa(mat.movel, f, 0, 0.525, 0, comp, 1.05, 0.6);
      caixa(mat.tampo, f, 0, 1.07, 0, comp + 0.06, 0.04, 0.66);
      caixa(mat.led, f, 0, 0.02, 0, comp + 0.04, 0.03, 0.64);
      bloquearRet(f, -comp / 2, comp / 2, -0.3, 0.3);
      const vistaBalcao = (u: number): Vista => vistaDe(f, limitar(u, -1.3, 1.3), 0.3, 1.7, 1.25, null);
      volumeCaixa(f, 0, 0.525, 0, comp, 1.05, 0.6, (p) => vistaBalcao(f.local(p.x, p.z)[0]));
      for (const u of [-1.1, 0, 1.1]) {
        const [x, z] = f.ponto(u, 0.66);
        juntar(mat.tampo, geoCilindro, matriz(x, 0.76, z, 0, 0.2, 0.07, 0.2));
        caixa(mat.tampo, f, u, 0.97, 0.84, 0.36, 0.3, 0.04); // encosto
        juntar(mat.cromado, geoCilindro, matriz(x, 0.38, z, 0, 0.025, 0.72, 0.025));
        juntar(mat.cromado, geoCilindro, matriz(x, 0.012, z, 0, 0.21, 0.024, 0.21));
        bloquearCirculo(x, z, 0.21);
      }
      const proximo = fornecedor(null);
      for (let k = 0; k < 8; k++) {
        const p = proximo();
        if (!p) continue;
        const u = -1.45 + k * 0.4;
        const [x, z] = f.ponto(u, 0.05);
        vaga(p, x, 1.09, z, f.ang, 0.8, vistaBalcao(u));
      }
      const [px, pz] = f.ponto(comp / 2 - 0.2, -0.1);
      planta(px, pz, 0.45, 1.09);
    }
    cantinho(-11.2, 6.6, 0, true);
    planta(X0 + 0.6, 4.2, 1.2);
    planta(X0 + 0.6, 8.6, 1.2);
    planta(X1 - 0.6, 3.9, 1.2);
    planta(X1 - 0.6, 8.6, 1.3);
  }

  // ---- vitrine: painéis iluminados nas pontas (virados para a rua) e mesinhas com produtos
  {
    const dentro = new Moldura(0, Z1, Math.PI); // v cresce para dentro da loja
    /** conceito: logo de um lado e a frase do outro, em painel lilás */
    function vitrinesConceito(): [number, THREE.Texture][] {
      const logo = texPainelRoxo(512, 740, (g) => desenharLogo(g, 256, 370, 150, hex(primaria), hex(primaria), 512));
      const frase = op.fraseVitrine
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
        : logo;
      return [
        [-13.4, logo],
        [13.4, frase],
      ];
    }
    const vitrines: [number, THREE.Texture][] = profissional
      ? [
          [-13.4, texPainelAgua(512, 740, 0)],
          [13.4, texPainelAgua(512, 740, 1)],
        ]
      : vitrinesConceito();
    for (const [x, tex] of vitrines) {
      const [u] = dentro.local(x, Z1);
      caixa(mat.movel, dentro, u, 1.55, 0.26, 2.45, 3.0, 0.12);
      const painelRua = new THREE.Mesh(geoPlano, basico(acesa("#ffffff", 1.3), { map: tex }));
      painelRua.position.set(x, 1.55, Z1 - 0.195);
      painelRua.scale.set(2.3, 2.9, 1);
      cena.add(painelRua);
      mancha(matLuzRoxa, x, Z1 - 1.0, 3.0, 1.4);
      bloquearRet(dentro, u - 1.25, u + 1.25, 0.18, 0.34);
    }
    for (const x of [-10.6, -7.4, -4.2, 4.2, 7.4, 10.6]) {
      const fm = new Moldura(x, Z1 - 0.9, 0);
      caixa(mat.movel, fm, 0, 0.3, 0, 1.5, 0.6, 0.6);
      caixa(mat.led, fm, 0, 0.02, 0, 1.54, 0.02, 0.64);
      mancha(matSombra, x, Z1 - 0.9, 2.1, 1.2);
      bloquearRet(fm, -0.75, 0.75, -0.3, 0.3);
      const vistaVitrine: Vista = { x, z: Z1 - 2.7, yaw: Math.PI, pitch: Math.atan2(0.7 - OLHO, 1.8), setor: null };
      volumeCaixa(fm, 0, 0.3, 0, 1.5, 0.6, 0.6, () => vistaVitrine);
      for (let k = 0; k < 5; k++) {
        const p = proximoMisto();
        if (p) vaga(p, x - 0.56 + k * 0.28, 0.6, Z1 - 0.9, 0, 0.8, vistaVitrine);
      }
    }
    planta(-2.4, Z1 + PAREDE + 0.85, 1.25, 0, profissional);
    planta(2.4, Z1 + PAREDE + 0.85, 1.25, 0, profissional);
  }

  // junta o cenário: uma malha por material
  for (const [m, lista] of lotes) {
    const geo = mergeGeometries(lista, false);
    lista.forEach((g) => g.dispose());
    if (!geo) continue;
    guardar(geo);
    const malha = new THREE.Mesh(geo, m);
    if (m.transparent) malha.renderOrder = 1;
    else if (!(m instanceof THREE.MeshBasicMaterial)) {
      malha.receiveShadow = true;
      malha.castShadow = !semSombra.has(m);
    }
    cena.add(malha);
  }
  lotes.clear();

  // ---- produtos: uma malha instanciada por produto (caixinha cinza até a foto chegar)
  const geoReserva = guardar(new THREE.BoxGeometry(0.14, 0.2, 0.04));
  geoReserva.translate(0, 0.1, 0);
  const matReserva = fisico("#e4e1e8", { roughness: 0.5 });
  const auxMatriz = new THREE.Matrix4();
  const auxEscala = new THREE.Vector3();
  const matrizDa = (v: Vaga, destaque = 1) =>
    auxMatriz.compose(v.pos, auxQ.setFromAxisAngle(eixoY, v.ang), auxEscala.setScalar(v.escala * destaque));
  const malhas: ProdutoMalha[] = [];
  const malhaDe = new Map<string, ProdutoMalha>();
  for (const [slug, vagas] of vagasPorProduto) {
    const malha = new THREE.InstancedMesh(geoReserva, matReserva, vagas.length);
    vagas.forEach((v, k) => malha.setMatrixAt(k, matrizDa(v)));
    malha.userData = { slug };
    malha.castShadow = true;
    malha.receiveShadow = true;
    cena.add(malha);
    const pm: ProdutoMalha = { slug, malha, vagas, altura: 0.2, estado: "nada" };
    malhas.push(pm);
    malhaDe.set(slug, pm);
  }

  // ---- câmera: de perto (na altura dos olhos, com a cesta) ou do alto (gira em volta da loja)
  let modo: ModoCena = "perto";
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
  let andando = false;

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
    op.aoMudarSetor(s);
  }

  {
    const inicio = op.inicio ?? ENTRADA;
    if (inicio.modo === "perto") {
      aplicar({ x: inicio.x, y: OLHO, z: inicio.z, yaw: inicio.yaw, pitch: inicio.pitch });
    } else {
      modo = "alto";
      azimute = inicio.yaw;
      aplicar(poseAlto());
    }
  }
  op.aoMudarModo(modo);

  // ---- caminhos no piso: A* na grade, depois corta caminho onde a vista é livre
  const celula = (x: number, z: number): [number, number] => [
    limitar(Math.floor((x - X0) / CELULA), 0, GX - 1),
    limitar(Math.floor((z - Z0) / CELULA), 0, GZ - 1),
  ];
  let porta = 0; // 0 = fechada, 1 = aberta
  /** no vão da porta só se passa com ela aberta */
  const barradoPelaPorta = (x: number, z: number) => naFachada(z) && Math.abs(x) < VAO && porta < 0.85;
  const pisavel = (x: number, z: number) => {
    const [i, j] = celula(x, z);
    return x > X0 && x < X1 && z > Z0 && z < Z1 + FORA && livre[j * GX + i] === 1 && !barradoPelaPorta(x, z);
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
  /** como pisavel, mas sem a porta: o caminho é planejado com ela aberta (ela abre quando a pessoa chega) */
  const livreNaGrade = (x: number, z: number) => {
    const [i, j] = celula(x, z);
    return x > X0 && x < X1 && z > Z0 && z < Z1 + FORA && livre[j * GX + i] === 1;
  };
  function vistaLivre(ax: number, az: number, bx: number, bz: number) {
    const passos = Math.ceil(Math.hypot(bx - ax, bz - az) / (CELULA / 2));
    for (let k = 1; k < passos; k++) if (!livreNaGrade(ax + ((bx - ax) * k) / passos, az + ((bz - az) * k) / passos)) return false;
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
    if (livreNaGrade(dx, dz)) celulas[celulas.length - 1] = [dx, dz]; // termina no ponto pedido, não no meio da célula
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
      voo = { de: poseAtual(), para: { x: v.x, y: OLHO, z: v.z, yaw: v.yaw, pitch: v.pitch }, t: 0, dur: 2.2, descendo: true, fim: chegar };
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
    voo = { de: poseAtual(), para: poseAlto(), t: 0, dur: 1.9, descendo: false, fim: () => mudarModo("alto") };
  }
  function irParaCategoria(slug: string) {
    const primeiro = colocados.find((s) => S[s].categoria === slug && vistaDoSetor.has(s));
    const v = primeiro !== undefined ? vistaDoSetor.get(primeiro) : undefined;
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
  let ultimaEscolha: { m: ProdutoMalha; k: number } | null = null;

  function alvoNoPonteiro(ev: PointerEvent) {
    const r = canvas.getBoundingClientRect();
    ponteiro.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ponteiro, camera);
    const hits = raycaster.intersectObjects([...malhas.map((m) => m.malha), ...volumes, piso, pisoFora], false);
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
    canvas.style.cursor = alvo || vistaDoVolume(hit) || hit?.object === piso || hit?.object === pisoFora ? "pointer" : "grab";
  }
  function aoSoltar(ev: PointerEvent) {
    if (!arrastando) return;
    arrastando = false;
    canvas.style.cursor = "grab";
    if (moveu) return;
    const hit = alvoNoPonteiro(ev);
    const alvo = produtoDoAcerto(hit) ?? produtoPerto(ev, 12);
    if (alvo) {
      ultimaEscolha = alvo;
      irParaVista(alvo.m.vagas[alvo.k].vista, true);
      op.aoSelecionarProduto(alvo.m.slug);
      return;
    }
    if (!hit) return;
    const vista = vistaDoVolume(hit);
    if (vista) return irParaVista(vista(hit.point));
    if ((hit.object === piso || hit.object === pisoFora) && livreNaGrade(hit.point.x, hit.point.z)) {
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
      distAlto = limitar(distAlto * Math.exp(ev.deltaY * 0.0012), 14, 48);
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

  // ---- qualidade: começa na alta; se o computador não der conta, desce um degrau
  const niveis: Qualidade[] = ["alta", "media", "baixa"];
  let nivel = niveis.indexOf(op.qualidade ?? "alta");
  let fovAlto = 40;
  function aplicarQualidade() {
    const q = niveis[nivel];
    const pr = Math.min(window.devicePixelRatio, q === "alta" ? 1.5 : q === "media" ? 1.25 : 1);
    renderer.setPixelRatio(pr);
    composer.setPixelRatio(pr);
    oclusao.enabled = q === "alta";
    brilho.enabled = q !== "baixa";
    const lado = q === "baixa" ? 2048 : 4096;
    if (sol.shadow.mapSize.x !== lado) {
      sol.shadow.mapSize.set(lado, lado);
      sol.shadow.map?.dispose();
      sol.shadow.map = null;
    }
    renderer.shadowMap.needsUpdate = true;
    ajustar();
  }
  function ajustar() {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h;
    fovAlto = camera.aspect < 1.55 ? 46 : 40;
    camera.updateProjectionMatrix();
  }
  const observador = new ResizeObserver(ajustar);
  observador.observe(container);
  aplicarQualidade();
  let quadrosNaJanela = 0;
  let inicioJanela = performance.now() + 4000; // espera a loja assentar antes de medir
  function medirDesempenho(agora: number) {
    if (op.qualidade || agora < inicioJanela) return;
    quadrosNaJanela++;
    const passou = agora - inicioJanela;
    if (passou < 2500) return;
    const qps = (quadrosNaJanela * 1000) / passou;
    quadrosNaJanela = 0;
    inicioJanela = agora;
    if (qps < 28 && nivel < niveis.length - 1) {
      nivel++;
      aplicarQualidade();
      inicioJanela = agora + 1500;
    }
  }

  // ---- fotos sob demanda, das mais perto para as mais longe; a sombra é refeita quando chegam
  let baixando = 0;
  let destruida = false;
  let sombraPendente = false;
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
          sombraPendente = true;
        })
        .catch(() => {
          m.estado = "pronto"; // sem foto: fica a caixinha cinza
        })
        .finally(() => {
          baixando--;
        });
    }
  }

  // ---- cesta
  const itemDe = (slug: string): ItemCesta => {
    const m = malhaDe.get(slug);
    if (m && m.estado === "pronto") return { geometria: m.malha.geometry, material: m.malha.material, altura: m.altura };
    return { geometria: geoReserva, material: fisico(lilas, { roughness: 0.5 }), altura: 0.2 };
  };
  const auxOrigem = new THREE.Vector3();
  function colocarNaCesta(slug: string) {
    // sai da prateleira onde a pessoa escolheu (ou da vaga mais perto)
    const m = malhaDe.get(slug);
    let origem: THREE.Vector3;
    let escala = 1;
    if (ultimaEscolha && ultimaEscolha.m.slug === slug) {
      const v = ultimaEscolha.m.vagas[ultimaEscolha.k];
      origem = auxOrigem.copy(v.pos);
      escala = v.escala;
    } else if (m) {
      const v = m.vagas.reduce((a, b) => (a.pos.distanceTo(posicao) < b.pos.distanceTo(posicao) ? a : b));
      origem = auxOrigem.copy(v.pos);
      escala = v.escala;
    } else {
      origem = auxOrigem.set(posicao.x - Math.sin(yaw) * 1.2, 1.2, posicao.z - Math.cos(yaw) * 1.2);
    }
    cesta.adicionar(itemDe(slug), origem.clone(), escala);
  }
  function definirCesta(slugs: string[]) {
    cesta.definir(slugs.map(itemDe));
  }

  // ---- laço
  let ultimo = performance.now();
  let proximaFoto = 0;
  let proximaSombra = 0;
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
    const antes = posicao.clone();

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
        if (frente) andar(frente * dt * 3.2);
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
        const nx = posicao.x + (dx / Math.max(dist, 0.0001)) * anda;
        const nz = posicao.z + (dz / Math.max(dist, 0.0001)) * anda;
        // na porta, espera ela abrir (ela já está abrindo: a pessoa está perto)
        if (dist > 0.0001 && !barradoPelaPorta(nx, nz)) {
          posicao.x = nx;
          posicao.z = nz;
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
    // a porta abre com alguém a menos de 3,5 m dela, na altura do chão
    const pertoDaPorta = posicao.y < 3 && Math.abs(posicao.x) < VAO + 2.5 && Math.abs(posicao.z - Z1) < 3.5;
    const antesPorta = porta;
    porta = limitar(porta + (pertoDaPorta ? 1 : -1) * dt * 1.6, 0, 1);
    if (porta !== antesPorta) {
      const k = suave(porta);
      for (const folha of folhas) folha.position.x = ((folha.userData.lado as number) * VAO) / 2 + (folha.userData.lado as number) * k * (VAO - 0.08);
    }
    camera.position.copy(posicao);
    camera.rotation.set(pitch, yaw, 0);
    camera.updateMatrixWorld();
    teto.visible = posicao.y < ALTURA - 0.15;
    andando = !voo && modo === "perto" && antes.distanceTo(posicao) > 0.002;
    cesta.mostrar(posicao.y < 2.4);
    cesta.atualizar(dt, andando, camera);

    if (agora > proximaFoto) {
      proximaFoto = agora + 300;
      baixarFotos();
    }
    if (sombraPendente && agora > proximaSombra) {
      sombraPendente = false;
      proximaSombra = agora + 900;
      renderer.shadowMap.needsUpdate = true;
    }
    medirDesempenho(agora);
    composer.render(dt);
  }
  quadro = requestAnimationFrame(passo);

  return {
    irParaCategoria,
    irParaVisaoGeral,
    definirCesta,
    colocarNaCesta,
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
      cesta.descartar();
      oclusao.dispose();
      brilho.dispose();
      composer.dispose();
      alvoComMsaa.dispose();
      sol.shadow.map?.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
