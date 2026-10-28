/**
 * Carrega os avatares (GLB com meshopt e texturas WebP), clona um para cada
 * pessoa na cena, liga as animações do gênero (andar, parado, parado2) e
 * pinta a roupa e o cabelo com as cores que o visitante escolheu.
 *
 * Pintura: a máscara de cada avatar diz onde é blusa (vermelho) e onde é
 * calça (verde). A cor nova mantém o claro-escuro da foto original (dobras,
 * costuras, estampas): cada texel vira cor escolhida × (brilho dele ÷ brilho
 * médio da peça).
 */
import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { clone as clonarEsqueleto } from "three/examples/jsm/utils/SkeletonUtils.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { infoAvatar, type InfoAvatar } from "../dados/avatares";

export interface Visual {
  avatar: string;
  cabelo: string | null;
  cima: string | null;
  baixo: string | null;
}

export interface Modelo {
  info: InfoAvatar;
  raiz: THREE.Group;
  clipes: Record<"andar" | "parado" | "parado2", THREE.AnimationClip> & { correr?: THREE.AnimationClip };
  descartar: () => void;
}

const BASE = "./avatares/";
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const gltfs = new Map<string, Promise<GLTF>>();
const animacoes = new Map<string, Promise<THREE.AnimationClip[]>>();
const mascaras = new Map<string, Promise<ImageData>>();

/**
 * O conversor exporta o corpo em vários pedaços (um por grupo do FBX); aqui os
 * pedaços do mesmo material viram uma malha só: 3 chamadas de desenho por
 * pessoa em vez de 14. Feito uma vez por avatar, antes de clonar.
 */
function juntarPedacos(raiz: THREE.Object3D) {
  const porPai = new Map<THREE.Object3D, THREE.SkinnedMesh[]>();
  raiz.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh && o.parent) {
      const l = porPai.get(o.parent) ?? [];
      l.push(o as THREE.SkinnedMesh);
      porPai.set(o.parent, l);
    }
  });
  for (const [pai, malhas] of porPai) {
    const porMaterial = new Map<THREE.Material, THREE.SkinnedMesh[]>();
    for (const m of malhas) {
      const mat = m.material as THREE.Material;
      porMaterial.set(mat, [...(porMaterial.get(mat) ?? []), m]);
    }
    for (const lista of porMaterial.values()) {
      if (lista.length < 2) continue;
      igualarTipos(lista.map((m) => m.geometry));
      const geo = mergeGeometries(
        lista.map((m) => m.geometry),
        false
      );
      if (!geo) continue;
      lista[0].geometry = geo;
      lista.slice(1).forEach((m) => pai.remove(m));
    }
  }
}

/** a compressão pode guardar o mesmo atributo em tipos diferentes por pedaço; para juntar, iguala */
function igualarTipos(geos: THREE.BufferGeometry[]) {
  for (const nome of Object.keys(geos[0].attributes)) {
    const attrs = geos.map((g) => g.getAttribute(nome) as THREE.BufferAttribute | undefined);
    if (attrs.some((a) => !a || (a as unknown as THREE.InterleavedBufferAttribute).isInterleavedBufferAttribute)) continue;
    const tipos = new Set(attrs.map((a) => a!.array.constructor));
    if (tipos.size < 2 && attrs.every((a) => a!.normalized === attrs[0]!.normalized)) continue;
    geos.forEach((g, k) => {
      const a = attrs[k]!;
      const n = a.count * a.itemSize;
      const novo = nome === "skinIndex" ? new Uint16Array(n) : new Float32Array(n);
      for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) novo[i * a.itemSize + c] = a.getComponent(i, c);
      g.setAttribute(nome, new THREE.BufferAttribute(novo, a.itemSize));
    });
  }
}

function carregarGltf(id: string) {
  let p = gltfs.get(id);
  if (!p) {
    p = loader.loadAsync(`${BASE}${id}.glb`).then((g) => {
      juntarPedacos(g.scene);
      return g;
    });
    gltfs.set(id, p);
  }
  return p;
}

function carregarAnimacoes(genero: "f" | "m") {
  let p = animacoes.get(genero);
  if (!p) {
    p = loader.loadAsync(`${BASE}animacoes-${genero}.glb`).then((g) => g.animations);
    animacoes.set(genero, p);
  }
  return p;
}

const gestos = new Map<string, Promise<Record<string, THREE.AnimationClip>>>();
/** acenar, aplaudir, dançar, rir, comemorar e falar (baixa só na primeira vez que alguém faz um gesto) */
export function carregarGestos(genero: "f" | "m") {
  let p = gestos.get(genero);
  if (!p) {
    p = loader.loadAsync(`${BASE}gestos-${genero}.glb`).then((g) => Object.fromEntries(g.animations.map((a) => [a.name, a])));
    gestos.set(genero, p);
  }
  return p;
}

/** já começa a baixar (o provador chama para os retratos que a pessoa vê primeiro) */
export function preCarregar(id: string) {
  void carregarGltf(id);
  void carregarAnimacoes(infoAvatar(id).genero);
}

function imagemParaDados(img: CanvasImageSource & { width: number; height: number }, lado: number) {
  const c = document.createElement("canvas");
  c.width = c.height = lado;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(img, 0, 0, lado, lado);
  return g.getImageData(0, 0, lado, lado);
}

function carregarMascara(id: string, lado: number) {
  const chave = `${id}:${lado}`;
  let p = mascaras.get(chave);
  if (!p) {
    p = new Promise<ImageData>((ok, falha) => {
      const img = new Image();
      img.onload = () => ok(imagemParaDados(img, lado));
      img.onerror = () => falha(new Error("mascara"));
      img.src = `${BASE}${id}-mascara.webp`;
    });
    mascaras.set(chave, p);
  }
  return p;
}

/** onde fica o cabelo na textura da cabeça (a maior parte do cabelo está pintada nela, não só nas mechas) */
const mascarasCabelo = new Map<string, Promise<ImageData | null>>();
function carregarMascaraCabelo(id: string, lado: number) {
  const chave = `${id}:${lado}`;
  let p = mascarasCabelo.get(chave);
  if (!p) {
    p = new Promise<ImageData | null>((ok) => {
      const img = new Image();
      img.onload = () => ok(imagemParaDados(img, lado));
      img.onerror = () => ok(null);
      img.src = `${BASE}${id}-cabelo.webp`;
    });
    mascarasCabelo.set(chave, p);
  }
  return p;
}

const lum = (d: Uint8ClampedArray, i: number) => (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;

/** claro-escuro das mechas originais: média e desvio do brilho onde há fio */
function brilhoDosFios(px: ImageData) {
  const d = px.data;
  let n = 0;
  let soma = 0;
  let soma2 = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 128) continue;
    const l = lum(d, i);
    soma += l;
    soma2 += l * l;
    n++;
  }
  const media = n ? soma / n : 0.3;
  // cabelo bem escuro tem desvio pequeno: sem piso, o reflexo dele viraria mancha branca no loiro
  return { media, desvio: Math.max(0.07, Math.sqrt(Math.max(0, soma2 / (n || 1) - media * media))) };
}

/**
 * Tinge o cabelo como uma tinta de verdade: a cor escolhida no lugar da
 * original, mas cada fio guarda o seu claro-escuro (mechas, sombra embaixo,
 * reflexo em cima). O contraste acompanha a cor — cabelo preto tem pouco
 * reflexo, loiro tem muito — e o reflexo puxa para menos saturado, como luz
 * batendo no fio. `peso(i)` diz quanto daquele pixel é cabelo (0 a 1).
 */
function tingirCabelo(px: ImageData, peso: (i: number) => number, cor: string, ref: { media: number; desvio: number }) {
  const d = px.data;
  const hsl = { h: 0, s: 0, l: 0 };
  new THREE.Color(cor).getHSL(hsl, THREE.SRGBColorSpace);
  const contraste = 0.05 + 0.15 * hsl.l;
  const tmp = new THREE.Color();
  const rgb = { r: 0, g: 0, b: 0 };
  for (let i = 0; i < d.length; i += 4) {
    const a = peso(i);
    if (a <= 0.01) continue;
    // claro-escuro com teto macio: o reflexo sobe menos que a sombra desce (não estoura em branco)
    let z = 1.5 * Math.tanh((lum(d, i) - ref.media) / ref.desvio / 1.5);
    if (z > 0) z *= 0.65;
    const l = Math.max(0.025, Math.min(0.9, hsl.l + z * contraste));
    // reflexo: menos saturado e um tiquinho mais quente; sombra: um pouco mais saturada
    const reflexo = Math.max(0, Math.min(1, (l - hsl.l) / 0.22));
    const s = Math.max(0, Math.min(1, hsl.s * (1 - 0.35 * reflexo) * (1 + 0.12 * Math.max(0, -z / 1.5))));
    // HSL e o canvas falam sRGB
    tmp.setHSL(hsl.h + 0.008 * z, s, l, THREE.SRGBColorSpace).getRGB(rgb, THREE.SRGBColorSpace);
    d[i] = d[i] * (1 - a) + rgb.r * 255 * a;
    d[i + 1] = d[i + 1] * (1 - a) + rgb.g * 255 * a;
    d[i + 2] = d[i + 2] * (1 - a) + rgb.b * 255 * a;
  }
}

/** pinta o canal `canal` da máscara (0 = cima, 1 = baixo; -1 = alfa do cabelo) com a cor */
function pintar(px: ImageData, mascara: ImageData | null, canal: number, cor: string) {
  const d = px.data;
  const m = mascara?.data;
  const peso = (i: number) => (canal < 0 ? (d[i + 3] > 40 ? 1 : 0) : m![i + canal] / 255);
  let soma = 0;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (peso(i) > 0.5) {
      soma += lum(d, i);
      n++;
    }
  }
  if (!n) return;
  const media = Math.max(0.05, soma / n);
  const alvo = new THREE.Color(cor);
  const t = [alvo.r * 255, alvo.g * 255, alvo.b * 255];
  // cor clara pintada em peça escura: realça o claro-escuro um pouco menos
  const exp = canal < 0 ? 0.9 : 0.8;
  for (let i = 0; i < d.length; i += 4) {
    const a = peso(i);
    if (!a) continue;
    const f = Math.min(2.4, Math.max(0.12, Math.pow(lum(d, i) / media, exp)));
    for (let k = 0; k < 3; k++) d[i + k] = d[i + k] * (1 - a) + Math.min(255, t[k] * f) * a;
  }
}

function texturaDe(px: ImageData, original: THREE.Texture) {
  const c = document.createElement("canvas");
  c.width = px.width;
  c.height = px.height;
  c.getContext("2d")!.putImageData(px, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.flipY = original.flipY;
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = original.wrapS;
  t.wrapT = original.wrapT;
  t.anisotropy = 4;
  return t;
}

export interface OpcoesModelo {
  /** lado das texturas pintadas (celular usa 512) */
  lado?: number;
  /** recebe sombra e projeta sombra */
  sombra?: boolean;
}

/** uma pessoa pronta para a cena, com as cores escolhidas */
export async function criarModelo(visual: Visual, op: OpcoesModelo = {}): Promise<Modelo> {
  const info = infoAvatar(visual.avatar);
  const [gltf, clipesBase] = await Promise.all([carregarGltf(info.id), carregarAnimacoes(info.genero)]);
  const raiz = clonarEsqueleto(gltf.scene) as THREE.Group;
  const malhas: THREE.Mesh[] = [];
  raiz.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      malhas.push(o as THREE.Mesh);
      o.castShadow = op.sombra ?? true;
      o.receiveShadow = op.sombra ?? true;
      // anda pelo shopping inteiro: o volume do esqueleto muda com a animação
      o.frustumCulled = false;
    }
  });
  if (!malhas.length) throw new Error("avatar sem malha");
  const lixo: { dispose: () => void }[] = [];
  // cada pessoa ganha a própria cópia dos materiais (a cor da roupa é só dela)
  const troca = new Map<THREE.Material, THREE.MeshStandardMaterial>();
  for (const m of malhas) {
    const orig = m.material as THREE.MeshStandardMaterial;
    if (!troca.has(orig)) troca.set(orig, orig.clone());
    m.material = troca.get(orig)!;
  }
  const mats = [...troca.values()];
  lixo.push(...mats);
  const lado = op.lado ?? 1024;
  const corpo = mats.find((x) => x.name === "corpo");
  const cabelo = mats.find((x) => x.name === "cabelo");
  for (const x of mats) {
    x.envMapIntensity = 0.9;
    if (x === cabelo) {
      // cabelo em mechas: corte por alfa com antisserrilhado (sem ordenar transparências)
      x.alphaToCoverage = true;
      x.alphaTest = 0.35;
    }
  }
  const querCima = visual.cima && info.corCima;
  const querBaixo = visual.baixo && info.corBaixo;
  if (corpo?.map && (querCima || querBaixo)) {
    const mascara = await carregarMascara(info.id, lado);
    const px = imagemParaDados(corpo.map.image as ImageBitmap, lado);
    if (querCima) pintar(px, mascara, 0, visual.cima!);
    if (querBaixo) pintar(px, mascara, 1, visual.baixo!);
    const t = texturaDe(px, corpo.map);
    corpo.map = t;
    lixo.push(t);
  }
  if (cabelo?.map && visual.cabelo && info.temCabelo) {
    // as mechas (cortadas por alfa) e o cabelo pintado na cabeça, com a mesma régua de claro-escuro
    const px = imagemParaDados(cabelo.map.image as ImageBitmap, lado);
    const ref = brilhoDosFios(px);
    tingirCabelo(px, (i) => Math.min(1, px.data[i + 3] / 160), visual.cabelo, ref);
    const t = texturaDe(px, cabelo.map);
    cabelo.map = t;
    lixo.push(t);
    const cabeca = mats.find((x) => x.name === "cabeca");
    const mascara = cabeca?.map ? await carregarMascaraCabelo(info.id, lado) : null;
    if (cabeca?.map && mascara) {
      const pc = imagemParaDados(cabeca.map.image as ImageBitmap, lado);
      tingirCabelo(pc, (i) => mascara.data[i] / 255, visual.cabelo, ref);
      const tc = texturaDe(pc, cabeca.map);
      cabeca.map = tc;
      lixo.push(tc);
    }
  }
  // textura menor (visitantes no celular): o resto das fotos do modelo também vai em `lado` px
  if (lado < 1024) {
    for (const x of mats) {
      for (const k of ["map", "normalMap", "roughnessMap", "metalnessMap", "emissiveMap", "aoMap", "alphaMap"] as const) {
        const t = x[k];
        if (t && !lixo.includes(t)) x[k] = reduzida(t, lado);
      }
    }
  }
  const clipes = Object.fromEntries(clipesBase.map((c) => [c.name, c])) as Modelo["clipes"];
  return { info, raiz, clipes, descartar: () => lixo.forEach((x) => x.dispose()) };
}

/** cópia menor de uma foto do modelo, uma só para todos que usam (fica guardada) */
const reduzidas = new Map<THREE.Texture, Map<number, THREE.Texture>>();
function reduzida(original: THREE.Texture, lado: number): THREE.Texture {
  const img = original.image as (CanvasImageSource & { width: number; height: number }) | undefined;
  if (!img || img.width <= lado) return original;
  let porLado = reduzidas.get(original);
  if (!porLado) reduzidas.set(original, (porLado = new Map()));
  const pronta = porLado.get(lado);
  if (pronta) return pronta;
  const c = document.createElement("canvas");
  c.width = c.height = lado;
  c.getContext("2d")!.drawImage(img, 0, 0, lado, lado);
  const t = new THREE.CanvasTexture(c);
  t.flipY = original.flipY;
  t.colorSpace = original.colorSpace;
  t.wrapS = original.wrapS;
  t.wrapT = original.wrapT;
  t.anisotropy = 4;
  porLado.set(lado, t);
  return t;
}

/** paletas do provador */
export const CORES_ROUPA: [string, string][] = [
  ["roxo", "#6b2bd9"],
  ["lilas", "#b493f0"],
  ["rosa", "#e86aa6"],
  ["vermelho", "#c8243b"],
  ["coral", "#f0785a"],
  ["amarelo", "#f2c230"],
  ["verde", "#2f9e6a"],
  ["azul", "#2f6fd6"],
  ["marinho", "#1d2f57"],
  ["bege", "#d8c2a0"],
  ["cinza", "#8b8f96"],
  ["branco", "#f2f2f2"],
  ["preto", "#1b1b1f"],
];
export const CORES_CALCA: [string, string][] = [
  ["jeans", "#3d5f8c"],
  ["preto", "#1b1b1f"],
  ["marinho", "#1d2f57"],
  ["bege", "#cdb48c"],
  ["branco", "#eeeeee"],
  ["cinza", "#6f737a"],
  ["roxo", "#5b2bb3"],
  ["rosa", "#d9709f"],
  ["verde", "#2e6b4e"],
  ["vermelho", "#9f2133"],
];
export const CORES_CABELO: [string, string][] = [
  ["preto", "#1a1512"],
  ["castanho", "#5a3a22"],
  ["loiro", "#d9b46a"],
  ["ruivo", "#a8442a"],
  ["grisalho", "#b9b6b2"],
  ["rosa", "#e27fb4"],
  ["roxo", "#7a4bd6"],
  ["azul", "#3d6fe0"],
];
