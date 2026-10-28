/**
 * A loja 3D dos sites (BeautyNow e Be2Beauty) dentro do shopping: a mesma
 * loja-conceito de 30 × 20 m de apps/storefront/src/components/loja3d/cena.ts
 * — uma seção por marca com a logo em cima de cada estante e nas pontas das
 * ilhas, parede do logo com o caixa e o painel de LED, cantinho com sofá,
 * vitrine de vidro na entrada e as etiquetas de preço. Dois arranjos:
 * "conceito" (BeautyNow) e "profissional" (Be2Beauty).
 *
 * Aqui ela é só o prédio e os produtos (o shopping cuida de luz, câmera,
 * avatar, cliques e sacola): monta tudo num grupo com a entrada virada para
 * +z, exporta a grade do piso (onde dá para pisar) e baixa as fotos dos
 * produtos de perto para longe quando o visitante chega.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { montarProduto3D } from "./produto3d";
import { texturasMadeira, texturasPorcelanato, texturasTecido, texturaTerra } from "./texturas";
import { prepararSuperficie, type Reflexo } from "./superficie";
import { carregarPlantas, TERRA_DO_MODELO, type LugarPlanta, type Plantas, type TipoPlanta } from "./plantas";
import { criarEtiquetas, type DadosEtiqueta } from "./etiquetas";
import { criarPainelLed } from "./painel-led";

export interface ProdutoCena {
  slug: string;
  foto: string;
  titulo: string;
  /** centavos */
  preco: number;
  /** % de desconto (null = sem promoção) */
  desconto: number | null;
}

export interface PrecoCena {
  preco: number;
  desconto: number | null;
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


export interface OpcoesLojaSite {
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
  fonte: string;
  celular: boolean;
  /** pasta dos modelos 3D (plantas), com a barra no fim */
  urlModelos: string;
  /** reflexo do piso do shopping (o mesmo plano y = 0) */
  reflexo?: Reflexo;
}

export interface LojaSite {
  grupo: THREE.Group;
  /** uma malha instanciada por produto (userData.slug) */
  malhas: THREE.InstancedMesh[];
  /** posição local (x, z): dentro da loja e da fachada, true = móvel ou parede */
  bloqueado: (x: number, z: number) => boolean;
  /** caminho no piso (A* na grade), em coordenadas locais; vazio = sem caminho */
  caminho: (ax: number, az: number, bx: number, bz: number) => [number, number][];
  /** onde o cliente para no caixa e onde fica a atendente */
  caixa: { x: number; z: number };
  atendente: { x: number; z: number; rumo: number };
  /** meio da porta: um passo fora e um passo dentro */
  porta: { x: number; zFora: number; zDentro: number };
  /** pontos livres para os visitantes passearem (ligados à porta de dentro) */
  passeio: [number, number][];
  /** o próprio piso e os decalques colados nele (não entram no reflexo) */
  foraDoReflexo: THREE.Object3D[];
  /** pos = visitante em coordenadas locais; ativa = perto o bastante para mostrar os produtos */
  atualizar: (dt: number, pos: THREE.Vector3, ativa: boolean) => void;
  definirBanners: (urls: string[]) => void;
  descartar: () => void;
}

const OLHO = 1.6; // altura dos olhos
export const LARGURA = 30; // salão (x)
export const FUNDO = 20; // salão (z); a entrada fica em +z
const X0 = -LARGURA / 2;
const X1 = LARGURA / 2;
const Z0 = -FUNDO / 2;
const Z1 = FUNDO / 2;
export const ALTURA = 4.0; // pé-direito
export const PAREDE = 0.4;
const VAO = 1.5; // meia porta
const PROF_ESTANTE = 0.45;
const PROD_L = 0.2; // o produto cabe nessa largura...
const PROD_A = 0.3; // ...e nessa altura (estantes de 40 cm)
const FRENTES = 2; // quantas frentes seguidas de cada produto
const CELULA = 0.2; // grade do piso para achar caminho
const RAIO = 0.35; // folga da pessoa para os móveis
const FORA = 8; // calçada na frente da loja, onde a pessoa começa
const MAX_NITIDAS = 36; // fotos em alta resolução ao mesmo tempo (memória da placa de vídeo)
const MAX_NITIDAS_CELULAR = 16;
const limitar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
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
  /** a foto em resolução maior (só de quem está perto) */
  nitida?: (lado: number) => Promise<THREE.Texture>;
  texNitida?: THREE.Texture;
  texBase?: THREE.Texture;
  pedindoNitida?: boolean;
}

export function montarLojaDoSite(op: OpcoesLojaSite): LojaSite {
  const profissional = op.estilo === "profissional";
  const grupo = new THREE.Group();
  grupo.name = `loja-site-${op.estilo}`;
  const descartar: { dispose: () => void }[] = [];
  function guardar<T extends { dispose: () => void }>(x: T): T {
    descartar.push(x);
    return x;
  }
  let destruida = false;

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
  /** textura em metros: repete a cada `metros` (as malhas desses materiais ganham uv no mundo) */
  const porMetro = <T extends THREE.Texture>(t: T, metros: number) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1 / metros, 1 / metros);
    return guardar(t);
  };
  const tecidoSofa = texturasTecido({ base: profissional ? "#e6e3df" : "#efe6dc", fio: 8, semente: 3 });
  const tecidoTapete = texturasTecido({ base: profissional ? "#d3d2d8" : hex(lilasClaro), fio: 4, semente: 9, pelo: 0.7 });
  const madeira = texturasMadeira({ clara: "#d2b18c", escura: "#b48a62", semente: 5 });
  const mat = {
    parede: fisico(profissional ? "#ebe8e4" : "#ece4da", { roughness: 0.92 }),
    casca: fisico(profissional ? escura : "#2b2b31", { roughness: 0.5 }),
    movel: fisico("#fbfaf7", { roughness: 0.36 }),
    tampo: fisico("#ffffff", { roughness: 0.22 }),
    marca: fisico("#f8f6f2", { roughness: 0.8 }),
    led: basico(acesa("#ffe6bd", 3.2)),
    metal: fisico("#3a3a41", { roughness: 0.32, metalness: 0.7 }),
    cromado: fisico("#d9d9de", { roughness: 0.22, metalness: 0.85 }),
    vaso: fisico("#f4f1ec", { roughness: 0.32 }),
    terra: fisico("#ffffff", { roughness: 1, map: guardar(texturaTerra(4)) }),
    // tecido: brilho aveludado de lado (sheen) e a trama no relevo
    sofa: guardar(
      new THREE.MeshPhysicalMaterial({
        color: "#ffffff",
        map: porMetro(tecidoSofa.cor, tecidoSofa.metros),
        normalMap: porMetro(tecidoSofa.normal, tecidoSofa.metros),
        normalScale: new THREE.Vector2(0.6, 0.6),
        roughness: 0.95,
        sheen: 0.8,
        sheenRoughness: 0.45,
        sheenColor: new THREE.Color("#fff6ec"),
      })
    ),
    almofada: guardar(
      new THREE.MeshPhysicalMaterial({
        color: profissional ? escura.clone().lerp(branco, 0.25) : lilas,
        normalMap: tecidoSofa.normal,
        normalScale: new THREE.Vector2(0.5, 0.5),
        roughness: 0.9,
        sheen: 1,
        sheenRoughness: 0.4,
        sheenColor: branco,
      })
    ),
    tapete: fisico("#ffffff", {
      roughness: 1,
      map: porMetro(tecidoTapete.cor, 0.12),
      normalMap: porMetro(tecidoTapete.normal, 0.12),
      normalScale: new THREE.Vector2(0.8, 0.8),
    }),
    madeira: fisico("#ffffff", {
      roughness: 0.45,
      map: porMetro(madeira.cor, madeira.metros),
      normalMap: porMetro(madeira.normal, madeira.metros),
      normalScale: new THREE.Vector2(0.35, 0.35),
    }),
    pe: profissional ? fisico("#ffffff", { roughness: 0.3 }) : fisico(primaria.clone().lerp(new THREE.Color("#1d1530"), 0.45), { roughness: 0.4 }),
    monitor: fisico("#1c1c21", { roughness: 0.25, metalness: 0.2 }),
    rua: fisico("#dedee3", { roughness: 0.85 }),
    capacho: fisico("#45454c", { roughness: 1 }),
  };

  // ---- cenário fixo: tudo é juntado numa malha por material no fim
  const lotes = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const semSombra = new Set<THREE.Material>(); // paredes e casca: não escurecem o salão
  // madeira e tecidos: o uv vira metros no mundo (projeção pela face), então a
  // trama e o veio têm o mesmo tamanho em qualquer móvel
  const uvNoMundo = new Set<THREE.Material>([mat.madeira, mat.sofa, mat.almofada, mat.tapete]);
  function juntar(m: THREE.Material, geo: THREE.BufferGeometry, matriz?: THREE.Matrix4) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (matriz) g.applyMatrix4(matriz);
    for (const nome of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(nome)) g.deleteAttribute(nome);
    g.clearGroups();
    if (uvNoMundo.has(m) && g.attributes.normal && g.attributes.uv) {
      const p = g.attributes.position;
      const n = g.attributes.normal;
      const uv = g.attributes.uv;
      for (let i = 0; i < p.count; i++) {
        const ax = Math.abs(n.getX(i));
        const ay = Math.abs(n.getY(i));
        const az = Math.abs(n.getZ(i));
        if (ay >= ax && ay >= az) uv.setXY(i, p.getX(i), p.getZ(i));
        else if (ax >= az) uv.setXY(i, p.getZ(i), p.getY(i));
        else uv.setXY(i, p.getX(i), p.getY(i));
      }
    }
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
    grupo.add(malha);
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
    grupo.add(m);
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
  const matFundoEstante = basico(acesa("#ffffff", 1.08), {
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


  // ---- piso (porcelanato claro e polido, com o reflexo do shopping), paredes e teto
  const celular = op.celular;

  const texPiso = texturasPorcelanato({
    lado: celular ? 512 : 1024,
    base: profissional ? "#e8e6e2" : "#ece4da",
    veio: profissional ? "#c9c7c4" : "#cdbfb0",
    rejunte: profissional ? "#d6d3ce" : "#d9cdc0",
    placa: 1.2,
    veios: 1.6,
    semente: 2,
  });
  descartar.push({ dispose: texPiso.descartar });
  for (const t of [texPiso.cor, texPiso.normal, texPiso.rugosidade]) t.repeat.set(LARGURA / texPiso.metros, FUNDO / texPiso.metros);
  const matPiso = fisico("#ffffff", {
    map: texPiso.cor,
    normalMap: texPiso.normal,
    normalScale: new THREE.Vector2(0.35, 0.35),
    roughnessMap: texPiso.rugosidade,
    roughness: 1,
    envMapIntensity: 0.3,
  });
  if (op.reflexo) prepararSuperficie(matPiso, { reflexo: op.reflexo });
  const piso = new THREE.Mesh(guardar(new THREE.PlaneGeometry(LARGURA, FUNDO)), matPiso);
  piso.rotation.x = -Math.PI / 2;
  piso.receiveShadow = true;
  grupo.add(piso);
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
    grupo.add(folha);
    folhas.push(folha);
  }
  // letreiro iluminado em cima da porta, do lado de fora (na BeautyNow, o logo roxo aceso)
  placa(
    guardar(
      textura(1024, 160, (g) => {
        g.fillStyle = hex(profissional ? escura : new THREE.Color("#17141c"));
        g.fillRect(0, 0, 1024, 160);
        if (!profissional) {
          g.shadowColor = hex(primaria);
          g.shadowBlur = 22;
        }
        desenharLogo(g, 512, 80, 96, profissional ? "#ffffff" : hex(lilas), profissional ? "#ffffff" : hex(primaria.clone().lerp(branco, 0.12)), 700);
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

  // teto com spots (só de perto; de cima a loja fica aberta, como maquete)
  const teto = new THREE.Group();
  const forro = new THREE.Mesh(guardar(new THREE.PlaneGeometry(LARGURA, FUNDO)), basico("#f2eee8"));
  forro.rotation.x = Math.PI / 2;
  forro.position.y = ALTURA;
  teto.add(forro);
  const spots = new THREE.InstancedMesh(guardar(new THREE.CircleGeometry(0.11, 20).rotateX(Math.PI / 2)), basico(acesa("#fff3dc", 4.5)), 300);
  let nSpot = 0;
  for (let x = X0 + 1.5; x < X1; x += 2.5) for (let z = Z0 + 1.5; z < Z1; z += 2.5) spots.setMatrixAt(nSpot++, matriz(x, ALTURA - 0.005, z));
  spots.count = nSpot;
  teto.add(spots);
  grupo.add(teto);
  // ---- móveis
  // vasos da loja (cerâmica lisa) com terra; a folhagem é o modelo escaneado (plantas.ts)
  const lugaresPlanta: LugarPlanta[] = [];
  const geoVasoAlto = guardar(
    new THREE.LatheGeometry(
      [
        [0, 0],
        [0.17, 0],
        [0.176, 0.012],
        [0.212, 0.47],
        [0.226, 0.488],
        [0.224, 0.5],
        [0.204, 0.5],
        [0.2, 0.47],
      ].map(([r, y]) => new THREE.Vector2(r, y)),
      48
    )
  );
  const geoVasoBaixo = guardar(
    new THREE.LatheGeometry(
      [
        [0, 0],
        [0.13, 0],
        [0.17, 0.05],
        [0.19, 0.2],
        [0.2, 0.235],
        [0.198, 0.25],
        [0.18, 0.25],
        [0.176, 0.22],
      ].map(([r, y]) => new THREE.Vector2(r, y)),
      40
    )
  );
  const geoTerra = guardar(new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2));
  /** planta no chão (vaso alto), em cima de um móvel (vaso baixo) ou a pequenininha nas mesinhas */
  function planta(x: number, z: number, e = 1, y = 0, vasoQuadrado = false) {
    const tipo: TipoPlanta = y === 0 ? "grande" : e <= 0.4 ? "pequena" : "media";
    // a folhagem do singônio pende para um lado: vira para o meio da loja
    const ang = Math.atan2(-x, -z) + Math.PI * 0.75 + ((x * 7 + z * 13) % 1) * 0.4;
    if (tipo === "grande") {
      if (vasoQuadrado) juntar(mat.vaso, geoCaixa, matriz(x, y + 0.25 * e, z, 0, 0.5 * e, 0.5 * e, 0.5 * e));
      else juntar(mat.vaso, geoVasoAlto, matriz(x, y, z, 0, e, e, e));
      const boca = vasoQuadrado ? 0.5 * e : 0.47 * e;
      juntar(mat.terra, geoTerra, matriz(x, y + boca, z, 0, (vasoQuadrado ? 0.23 : 0.2) * e, 1, (vasoQuadrado ? 0.23 : 0.2) * e));
      const s = 1.5 * e;
      lugaresPlanta.push({ tipo, matriz: matriz(x, y + boca - TERRA_DO_MODELO.grande * s, z, ang, s, s, s) });
    } else if (tipo === "media") {
      juntar(mat.vaso, geoVasoBaixo, matriz(x, y, z, 0, e, e, e));
      juntar(mat.terra, geoTerra, matriz(x, y + 0.22 * e, z, 0, 0.18 * e, 1, 0.18 * e));
      const s = 1.25 * e;
      lugaresPlanta.push({ tipo, matriz: matriz(x, y + 0.215 * e, z, ang, s, s, s) });
    } else {
      const s = 2.7 * e;
      lugaresPlanta.push({ tipo, matriz: matriz(x, y, z, ang, s, s, s) });
    }
    if (y === 0) {
      bloquearCirculo(x, z, (vasoQuadrado ? 0.3 : 0.22) * e);
      mancha(matSombra, x, z, 0.8 * e, 0.8 * e);
    }
  }

  // etiquetas: uma por produto em cada fileira (as frentes repetidas dividem a mesma)
  const etiquetas: (DadosEtiqueta & { slug: string })[] = [];
  function fileira(f: Moldura, v: number, y: number) {
    let atual: { p: ProdutoCena; us: number[] } | null = null;
    const fechar = () => {
      if (!atual) return;
      const u = atual.us.reduce((a, b) => a + b, 0) / atual.us.length;
      const [x, z] = f.ponto(u, v);
      etiquetas.push({ slug: atual.p.slug, pos: new THREE.Vector3(x, y, z), ang: f.ang, preco: atual.p.preco, desconto: atual.p.desconto });
      atual = null;
    };
    return {
      por(p: ProdutoCena, u: number) {
        if (atual && atual.p !== p) fechar();
        if (!atual) atual = { p, us: [] };
        atual.us.push(u);
      },
      fechar,
    };
  }

  /** estante de parede: armário embaixo, 3 tábuas iluminadas e a logo da marca em cima */
  const vistaDoSetor = new Map<number, Vista>();
  function estante(cx: number, cz: number, ang: number, larg: number, setor: number | null) {
    const f = new Moldura(cx, cz, ang);
    const P = PROF_ESTANTE;
    // o painel fica 1,5 cm na frente do reboco da parede (que está a 2 cm do pé da estante):
    // no mesmo plano, parede e painel brigavam e a luz do fundo piscava ao andar
    const [fx, fz] = f.ponto(0, 0.035);
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
      // na de baixo a etiqueta fica no armário, embaixo da fita de LED (em cima, o brilho a apagava)
      const tags = fileira(f, P + 0.003, base < 0.6 ? base - 0.012 : base + 0.002);
      for (let k = 0; k < n; k++) {
        const p = proximo();
        if (!p) continue;
        const u = -(larg - 0.2) / 2 + passo * (k + 0.5);
        const [x, z] = f.ponto(u, P - 0.17);
        vaga(p, x, base, z, ang, 1, vistaDe(f, limitar(u, -larg / 2 + 0.5, larg / 2 - 0.5), P, 1.6, base + 0.15, setor));
        tags.por(p, u);
      }
      tags.fechar();
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
        grupo.add(card);
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
        // etiqueta na borda do tampo (fileira de baixo) ou na frente do degrau (de cima)
        const tags = v > 0.1 ? fileira(fl, larg / 2 + 0.018, H + 0.032) : fileira(fl, 0.152, H + 0.352);
        for (let k = 0; k < n; k++) {
          const p = proximo();
          if (!p) continue;
          const u = -util / 2 + passo * (k + 0.5);
          const [x, z] = fl.ponto(u, v);
          vaga(p, x, y, z, fl.ang, escala, vistaDe(fl, limitar(u, -reto / 2, reto / 2), larg / 2, distVista - 0.1, y + 0.12, setor));
          tags.por(p, u);
        }
        tags.fechar();
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
      const tags = fileira(new Moldura(cx, cz, a), r + 0.003, 0.792);
      tags.por(p, 0);
      tags.fechar();
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
    const ini = abertura + Math.PI * 0.35;
    const fim = abertura + Math.PI * 1.65;
    const pedacoDeAnel = (r0: number, r1: number, de = ini, ate = fim) => {
      const a0 = -ate;
      const a1 = -de;
      const s = new THREE.Shape();
      s.moveTo(Math.cos(a0) * r1, Math.sin(a0) * r1);
      s.absarc(0, 0, r1, a0, a1, false);
      s.lineTo(Math.cos(a1) * r0, Math.sin(a1) * r0);
      s.absarc(0, 0, r0, a1, a0, true);
      return s;
    };
    // base inteira e, em cima, três almofadas de assento e três de encosto com vão entre elas
    juntar(mat.sofa, guardar(extrudarDeitado(pedacoDeAnel(0.6, 1.15), 0.24, 0.03)), matriz(cx, 0.02, cz));
    juntar(mat.madeira, guardar(extrudarDeitado(pedacoDeAnel(0.64, 1.1), 0.03)), matriz(cx, 0, cz));
    const vao = 0.025;
    for (let k = 0; k < 3; k++) {
      const de = ini + ((fim - ini) * k) / 3 + vao;
      const ate = ini + ((fim - ini) * (k + 1)) / 3 - vao;
      juntar(mat.sofa, guardar(extrudarDeitado(pedacoDeAnel(0.6, 0.97, de, ate), 0.2, 0.06)), matriz(cx, 0.255, cz));
      juntar(mat.sofa, guardar(extrudarDeitado(pedacoDeAnel(0.95, 1.15, de, ate), 0.6, 0.07)), matriz(cx, 0.255, cz));
    }
    // duas almofadas soltas na cor da loja, encostadas
    for (const t of [0.22, 0.78]) {
      const a = ini + (fim - ini) * t;
      const ax = cx + Math.cos(a) * 0.86;
      const az = cz + Math.sin(a) * 0.86;
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(ax, 0.62, az),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0.35, -a + Math.PI / 2, 0, "YXZ")),
        new THREE.Vector3(1, 1, 1)
      );
      juntar(mat.almofada, guardar(new RoundedBoxGeometry(0.42, 0.4, 0.13, 4, 0.06)), m);
    }
    const [mx, mz] = [cx + Math.cos(abertura) * 0.25, cz + Math.sin(abertura) * 0.25];
    juntar(mat.pe, geoCilindro, matriz(mx, 0.22, mz, 0, 0.17, 0.44, 0.17));
    juntar(mat.madeira, geoCilindro, matriz(mx, 0.46, mz, 0, 0.32, 0.04, 0.32));
    planta(mx - 0.06, mz - 0.04, 0.36, 0.48);
    if (comLivro) juntar(mat.monitor, geoCaixa, matriz(mx + 0.14, 0.49, mz + 0.07, 0.4, 0.17, 0.025, 0.23));
    mancha(matSombra, cx, cz, 2.8, 2.8);
    bloquearCirculo(cx, cz, 1.18);
  }

  // a atendente do caixa fica atrás do balcão do fundo (o shopping põe a pessoa ali)
  let atendente = { x: 0, z: 0, rumo: 0 };
  let pontoCaixa = { x: 0, z: 0 };

  // ---- seções por marca: as maiores marcas ganham lugar; as da mesma categoria ficam lado a lado
  // a ordem dos lugares é um passeio pela loja: fundo à esquerda, parede esquerda, ilhas,
  // parede direita e fundo à direita (no profissional, sem a 3ª estante do fundo à
  // direita: ali fica a porta da área interna)
  type Lugar = (setor: number | null) => void;
  const est = (x: number, z: number, ang: number): Lugar => (setor) => estante(x, z, ang, 3.0, setor);
  const ilh = (x: number, z: number): Lugar => (setor) =>
    ilha(x, z, Math.PI / 2, 3.2, 1.2, { setor, raio: profissional ? 0.12 : undefined, distVista: 1.45 });
  const lugares: Lugar[] = [
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
    const escolhidos = S.map((_, i) => i).slice(0, lugares.length);
    escolhidos.sort((a, b) => posCat(S[a].categoria) - posCat(S[b].categoria) || a - b);
    colocados.push(...escolhidos);
    // marcas que não couberam vão para as mesas e vitrines, misturadas
    const resto = S.map((_, i) => i).slice(lugares.length);
    for (let k = 0; resto.some((s) => k < S[s].produtos.length); k++) {
      for (const s of resto) if (S[s].produtos[k]) filaMista.push(S[s].produtos[k]);
    }
    lugares.forEach((montar, k) => montar(k < colocados.length ? colocados[k] : null));
  }

  // ---- fundo: parede do logo entre pilares, com o caixa na frente
  const largMarca = 8.4;
  for (const lado of [-1, 1]) caixa(mat.casca, paredeFundo, lado * (largMarca / 2 + 0.3), ALTURA / 2, 0.35, 0.6, ALTURA, 0.7);
  caixa(mat.marca, paredeFundo, 0, ALTURA / 2, 0.13, largMarca, ALTURA, 0.24);
  caixa(mat.led, paredeFundo, 0, 0.03, 0.255, largMarca, 0.02, 0.02);
  const corLogo = profissional ? hex(escura) : hex(primaria);
  // logo pequeno em cima e, embaixo dele, o painel de LED com os banners do site (atrás da atendente)
  placa(
    guardar(
      textura(1024, 236, (g) => {
        g.fillStyle = "#f8f6f2";
        g.fillRect(0, 0, 1024, 236);
        desenharLogo(g, 512, 118, 150, profissional ? corLogo : hex(primaria.clone().lerp(branco, 0.25)), corLogo, 1000);
      })
    ),
    paredeFundo,
    0,
    3.7,
    0.252,
    1.9,
    0.44
  );
  const LARG_LED = 5.2;
  const ALT_LED = (LARG_LED * 3) / 8; // banners do site são 8:3
  const slideLogo = guardar(
    textura(1024, 384, (g) => {
      const fundo = g.createLinearGradient(0, 0, 1024, 384);
      fundo.addColorStop(0, hex(profissional ? escura : primaria));
      fundo.addColorStop(1, hex((profissional ? escura : primaria).clone().lerp(new THREE.Color("#000000"), 0.45)));
      g.fillStyle = fundo;
      g.fillRect(0, 0, 1024, 384);
      desenharLogo(g, 512, 180, 150, hex(lilasClaro), "#ffffff", 900);
      g.fillStyle = "rgba(255,255,255,0.85)";
      g.font = `500 30px ${op.fonte}`;
      g.textAlign = "center";
      if (op.fraseVitrine) g.fillText(op.fraseVitrine, 512, 330);
    })
  );
  const painelLed = criarPainelLed({ largura: LARG_LED, altura: ALT_LED, primeiro: slideLogo, aspPrimeiro: 1024 / 384, moldura: mat.monitor });
  descartar.push({ dispose: painelLed.descartar });
  {
    const [x, z] = paredeFundo.ponto(0, 0.25 + 0.03);
    painelLed.grupo.position.set(x, 2.38, z);
    grupo.add(painelLed.grupo);
  }
  if (!profissional) {
    for (const lado of [-1, 1]) painel(new Moldura(0, Z0 + 0.25, 0), lado * 3.35, 0.85, 3.2, texPainelRoxo(256, 960));
  }
  bloquearRet(paredeFundo, -largMarca / 2 - 0.6, largMarca / 2 + 0.6, 0, 0.7);
  {
    const cz = Z0 + 2.6;
    const f = new Moldura(0, cz, 0);
    const [cc, lc, rc] = profissional ? [4.6, 0.95, 0.06] : [5.2, 1.0, undefined];
    juntar(mat.movel, guardar(extrudarDeitado(formaPilula(cc, lc, rc), 1.05, 0.02)), matriz(0, 0, cz));
    juntar(mat.madeira, guardar(extrudarDeitado(formaPilula(cc + 0.14, lc + 0.12, rc), 0.045, 0.008)), matriz(0, 1.05, cz));
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
    // um passo atrás do balcão: ao gesticular, as mãos não entram no tampo
    atendente = { x: 0, z: cz - lc / 2 - 0.42, rumo: 0 };
    bloquearCirculo(0, cz - lc / 2 - 0.42, 0.25);
    pontoCaixa = { x: 0, z: cz + lc / 2 + 0.75 };
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
        0.032, // na frente do reboco (a 2 cm da parede): atrás dele a placa sumia
        3.2,
        0.8
      );
    }
    {
      // balcão de atendimento com três banquetas, de frente para o meio da loja
      const f = new Moldura(12.7, 6.2, -Math.PI / 2); // u = z; v aponta para o meio (-x)
      const comp = 3.6;
      caixa(mat.movel, f, 0, 0.525, 0, comp, 1.05, 0.6);
      caixa(mat.madeira, f, 0, 1.07, 0, comp + 0.06, 0.04, 0.66);
      caixa(mat.led, f, 0, 0.02, 0, comp + 0.04, 0.03, 0.64);
      bloquearRet(f, -comp / 2, comp / 2, -0.3, 0.3);
      const vistaBalcao = (u: number): Vista => vistaDe(f, limitar(u, -1.3, 1.3), 0.3, 1.7, 1.25, null);
      volumeCaixa(f, 0, 0.525, 0, comp, 1.05, 0.6, (p) => vistaBalcao(f.local(p.x, p.z)[0]));
      for (const u of [-1.1, 0, 1.1]) {
        const [x, z] = f.ponto(u, 0.66);
        juntar(mat.madeira, geoCilindro, matriz(x, 0.76, z, 0, 0.2, 0.07, 0.2));
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
      grupo.add(painelRua);
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
  // junta o cenário: uma malha por material; o que é sólido faz sombra na luz assada
  const malhaDoMaterial = new Map<THREE.Material, THREE.Mesh>();
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
    grupo.add(malha);
    malhaDoMaterial.set(m, malha);
  }
  lotes.clear();
  // no reflexo não entram o próprio chão nem as manchas coladas nele
  const foraDoReflexo: THREE.Object3D[] = [piso, ...[matSombra, matLuzChao, matLuzRoxa].flatMap((m) => malhaDoMaterial.get(m) ?? [])];

  // ---- etiquetas de preço (uma malha para a loja toda)
  const etiquetasMalha = criarEtiquetas(op.fonte, profissional ? escura.clone() : primaria.clone());
  descartar.push({ dispose: etiquetasMalha.descartar });
  etiquetasMalha.refazer(etiquetas);
  grupo.add(etiquetasMalha.malha);

  // ---- plantas (modelos escaneados)
  let plantas: Plantas | null = null;
  carregarPlantas(op.urlModelos, lugaresPlanta, [])
    .then((p) => {
      if (destruida) return p.descartar();
      plantas = p;
      grupo.add(p.grupo);
    })
    .catch(() => {
      // sem plantas: a loja continua
    });

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
    grupo.add(malha);
    const pm: ProdutoMalha = { slug, malha, vagas, altura: 0.2, estado: "nada" };
    malhas.push(pm);
    malhaDe.set(slug, pm);
  }
  // as fotos não fazem sombra no shopping (a sombra do sol é refeita a cada quadro: seriam centenas de malhas a mais)
  for (const m of malhas) m.malha.castShadow = false;
  // de longe, uma malha só com as caixinhas de todos os produtos (uma chamada de desenho em vez de centenas)
  const todasVagas = malhas.flatMap((m) => m.vagas);
  const reserva = new THREE.InstancedMesh(geoReserva, matReserva, Math.max(1, todasVagas.length));
  todasVagas.forEach((v, k) => reserva.setMatrixAt(k, matrizDa(v)));
  reserva.count = todasVagas.length;
  grupo.add(reserva);
  for (const m of malhas) m.malha.visible = false;
  let ativaAntes = false;

  // ---- grade do piso: o que é móvel ou parede, caminho (A*) e pontos para passear
  const celula = (x: number, z: number): [number, number] => [limitar(Math.floor((x - X0) / CELULA), 0, GX - 1), limitar(Math.floor((z - Z0) / CELULA), 0, GZ - 1)];
  const dentroDaGrade = (x: number, z: number) => x > X0 && x < X1 && z > Z0 && z < Z1 + PAREDE + RAIO;
  const livreEm = (x: number, z: number) => {
    const [i, j] = celula(x, z);
    return livre[j * GX + i] === 1;
  };
  function bloqueado(x: number, z: number) {
    if (!dentroDaGrade(x, z)) {
      // fora da loja: só as paredes de fora contam (a praça é do shopping)
      return z < Z1 + PAREDE + RAIO && z > Z0 - PAREDE && Math.abs(x) < X1 + PAREDE + RAIO && Math.abs(x) > X1 - RAIO;
    }
    return !livreEm(x, z);
  }
  function vistaLivre(ax: number, az: number, bx: number, bz: number) {
    const passos = Math.ceil(Math.hypot(bx - ax, bz - az) / (CELULA / 2));
    for (let k = 1; k < passos; k++) {
      const x = ax + ((bx - ax) * k) / passos;
      const z = az + ((bz - az) * k) / passos;
      if (dentroDaGrade(x, z) && !livreEm(x, z)) return false;
    }
    return true;
  }
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
  function caminho(ax: number, az: number, bx: number, bz: number): [number, number][] {
    const origem = livreMaisPerto(...celula(ax, az));
    const alvo = livreMaisPerto(...celula(bx, bz));
    if (origem === null || alvo === null) return [];
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
    if (veio[alvo] === -1 && alvo !== origem) return [];
    const celulas: [number, number][] = [];
    for (let c = alvo; c !== -1; c = veio[c]) celulas.unshift([celX(c % GX), celZ(Math.floor(c / GX))]);
    if (dentroDaGrade(bx, bz) && livreEm(bx, bz)) celulas[celulas.length - 1] = [bx, bz];
    // corta caminho onde a vista é livre
    const pontos: [number, number][] = [];
    let de: [number, number] = [ax, az];
    for (let k = 0; k < celulas.length - 1; ) {
      let longe = k + 1;
      for (let m = celulas.length - 1; m > k + 1; m--) {
        if (vistaLivre(de[0], de[1], celulas[m][0], celulas[m][1])) {
          longe = m;
          break;
        }
      }
      pontos.push(celulas[longe]);
      de = celulas[longe];
      k = longe;
    }
    if (!pontos.length) pontos.push(celulas[celulas.length - 1]);
    return pontos;
  }
  // pontos de passeio: na frente das estantes e ilhas, onde a vista da porta (ou de um vizinho) é livre
  const passeio: [number, number][] = [];
  for (const v of [...vistaDoSetor.values()]) if (livreEm(v.x, v.z)) passeio.push([v.x, v.z]);

  // ---- fotos sob demanda, das mais perto para as mais longe
  let baixando = 0;
  const posicao = new THREE.Vector3();
  function baixarFotos() {
    const pendentes = malhas
      .filter((m) => m.estado === "nada")
      .map((m) => ({ m, d: Math.min(...m.vagas.map((v) => v.pos.distanceTo(posicao))) }))
      .sort((a, b) => a.d - b.d);
    for (const { m } of pendentes) {
      if (baixando >= (celular ? 5 : 8)) break;
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
          m.nitida = p.nitida;
          m.texBase = (p.material as THREE.MeshStandardMaterial).map ?? undefined;
        })
        .catch(() => {
          m.estado = "pronto"; // sem foto: fica a caixinha cinza
        })
        .finally(() => {
          baixando--;
        });
    }
  }

  // ---- de perto, a foto em resolução maior (as que ficam longe voltam para a pequena)
  let pedindoNitidas = 0;
  function trocarFoto(m: ProdutoMalha, tex: THREE.Texture | undefined) {
    const material = m.malha.material as THREE.MeshStandardMaterial;
    if (!tex) return;
    material.map = tex;
    material.emissiveMap = tex;
  }
  function cuidarNitidas() {
    const lado = 512;
    const lista = malhas
      .filter((m) => m.estado === "pronto" && m.nitida)
      .map((m) => ({ m, d: Math.min(...m.vagas.map((v) => Math.hypot(v.pos.x - posicao.x, v.pos.z - posicao.z))) }))
      .sort((a, b) => a.d - b.d);
    const querem = new Set(lista.filter((x) => x.d < 3.6).slice(0, celular ? MAX_NITIDAS_CELULAR : MAX_NITIDAS).map((x) => x.m));
    for (const { m, d } of lista) {
      if (m.texNitida && !querem.has(m) && d > 4.5) {
        trocarFoto(m, m.texBase);
        m.texNitida.dispose();
        m.texNitida = undefined;
      }
    }
    for (const m of querem) {
      if (m.texNitida || m.pedindoNitida || pedindoNitidas >= 2 || !m.nitida) continue;
      m.pedindoNitida = true;
      pedindoNitidas++;
      m.nitida(lado)
        .then((tex) => {
          if (destruida) return tex.dispose();
          m.texNitida = tex;
          trocarFoto(m, tex);
        })
        .catch(() => {
          m.nitida = undefined; // não deu: fica a pequena
        })
        .finally(() => {
          m.pedindoNitida = false;
          pedindoNitidas--;
        });
    }
  }

  // ---- porta automática e painel de LED
  let porta = 0;
  let relogioFotos = 0;
  function atualizar(dt: number, pos: THREE.Vector3, ativa: boolean) {
    posicao.copy(pos);
    const pertoDaPorta = Math.abs(pos.x) < VAO + 2.5 && Math.abs(pos.z - Z1) < 3.5;
    const antes = porta;
    porta = limitar(porta + (pertoDaPorta ? 1 : -1) * dt * 1.6, 0, 1);
    if (porta !== antes) {
      const k = suave(porta);
      for (const folha of folhas) folha.position.x = ((folha.userData.lado as number) * VAO) / 2 + (folha.userData.lado as number) * k * (VAO - 0.08);
    }
    painelLed.atualizar(dt);
    if (ativa !== ativaAntes) {
      ativaAntes = ativa;
      for (const m of malhas) m.malha.visible = ativa;
      reserva.visible = !ativa;
    }
    if (!ativa) return;
    relogioFotos += dt;
    if (relogioFotos > 0.25) {
      relogioFotos = 0;
      baixarFotos();
      cuidarNitidas();
    }
  }

  return {
    grupo,
    malhas: malhas.map((m) => m.malha),
    bloqueado,
    caminho,
    caixa: pontoCaixa,
    atendente,
    porta: { x: 0, zFora: Z1 + PAREDE + 1.2, zDentro: Z1 - 1.8 },
    passeio,
    foraDoReflexo,
    atualizar,
    definirBanners: (urls) => painelLed.definirBanners(urls),
    descartar: () => {
      destruida = true;
      plantas?.descartar();
      descartar.forEach((x) => x.dispose());
      grupo.removeFromParent();
    },
  };
}
