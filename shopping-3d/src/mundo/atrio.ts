/**
 * O átrio de três andares do Beauty Shopping: o vazio curvo que atravessa o
 * saguão, a galeria e a Praça da Beleza, com as varandas dos pisos 2 e 3 em
 * volta — laje de porcelanato, testeira branca com filete de LED quente,
 * guarda-corpo de vidro e corrimão de aço —, as vitrines acesas das lojas de
 * cima (em breve), a cobertura com a claraboia, as bandeiras com o logo, as
 * escadas rolantes cruzando o vazio e o elevador panorâmico de vidro.
 *
 * Os pisos de cima são para olhar (por enquanto não se sobe): quem passeia
 * lá são visitantes do próprio shopping (avatar/visitantes.ts).
 *
 * Tudo em (x, z) no chão: os contornos são curvas suaves (Catmull-Rom) e as
 * peças curvas são "fitas" ao longo delas, juntadas por material (Lotes).
 */
import * as THREE from "three";
import { PLANTA, zFachadaEm } from "../dados/lojas";
import type { Colisao } from "./colisao";
import { Lotes } from "./construtor";
import type { Materiais } from "./materiais";
import { atlasVitrines, bandeira, canvasTextura, CELULAS_ATLAS, desenharLed } from "./letreiros";
import type { LugarPlanta } from "./plantas";

const { piso2: P2, piso3: P3, cobertura: COB, espLaje: ESP } = PLANTA;
/** altura da testeira (a faixa branca na borda do vazio, abaixo do piso) */
const TESTEIRA = 0.95;
const VIDRO_GUARDA = 1.1;
/** claraboia: a "caixa de luz" sobe da cobertura até o vidro */
export const Y_CLARABOIA = 17.6;

/** vazio do átrio, metade direita, da frente (saguão) para o fundo (praça); a esquerda é o espelho */
const VAZIO_DIREITA: [number, number][] = [
  [0, 40.6],
  [7.5, 39.8],
  [11.6, 37],
  [12.6, 31.5],
  [10.4, 26.2],
  [6.6, 22.6],
  [5.4, 16],
  [6.3, 8],
  [5.4, 0],
  [6.3, -8],
  [5.4, -16],
  [6.8, -21.4],
  [12.5, -24.8],
  [19.5, -27.6],
  [22, -33],
  [20.2, -38.8],
  [12.5, -41.6],
  [4, -42.6],
  [0, -42.7],
];

/** linha das vitrines dos pisos de cima, metade direita, do saguão até o fundo */
const LOJAS_DIREITA: [number, number][] = [
  [17, 37.2],
  [17.2, 31],
  [16.4, 26.4],
  [13.4, 23.6],
  [11.2, 20],
  [11, 10],
  [11.2, 0],
  [11, -10],
  [11.2, -19.5],
  [13.6, -23.8],
  [20.5, -25.6],
  [27.4, -28.4],
  [29, -34],
  [27.6, -40.2],
  [21.5, -45.2],
  [11, -47],
  [0, -47.4],
];

const v2 = (x: number, z: number) => new THREE.Vector2(x, z);

function amostrar(pontos: [number, number][], fechada: boolean, passo: number): THREE.Vector2[] {
  const curva = new THREE.CatmullRomCurve3(
    pontos.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    fechada,
    "centripetal"
  );
  const n = Math.max(8, Math.round(curva.getLength() / passo));
  const pts = curva.getSpacedPoints(n).map((p) => v2(p.x, p.z));
  if (fechada) pts.pop();
  return pts;
}

/** contorno fechado do vazio (pontos a cada ~0,5 m) */
export const VAZIO: THREE.Vector2[] = amostrar(
  [...VAZIO_DIREITA, ...VAZIO_DIREITA.slice(1, -1).reverse().map(([x, z]) => [-x, z] as [number, number])],
  true,
  0.5
);

/** linha das vitrines de cima (aberta: do saguão esquerdo, pelo fundo, ao saguão direito) */
const LOJAS: THREE.Vector2[] = amostrar(
  [...LOJAS_DIREITA.slice(0, -1).map(([x, z]) => [-x, z] as [number, number]), LOJAS_DIREITA[LOJAS_DIREITA.length - 1], ...LOJAS_DIREITA.slice(0, -1).reverse()],
  false,
  0.35
);

/** contorno do prédio por dentro (onde as lajes encostam): saguão, galeria e praça, até o fundo das lojas de cima */
function pegada(): THREE.Vector2[] {
  const frente: THREE.Vector2[] = [];
  for (let i = 0; i <= 36; i++) {
    const x = PLANTA.meioSaguao - (2 * PLANTA.meioSaguao * i) / 36;
    frente.push(v2(x, zFachadaEm(x) - 0.3));
  }
  return [...frente, v2(-18, 24), v2(-20, 24), v2(-20, -24), v2(-32, -24), v2(-32, -48), v2(32, -48), v2(32, -24), v2(20, -24), v2(20, 24), v2(18, 24)];
}

function areaSinal(pts: THREE.Vector2[]) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

/** normal de cada ponto no chão; `fora` = para fora do vazio (contorno fechado) */
function normais(pts: THREE.Vector2[], fechada: boolean, sinal: number): THREE.Vector2[] {
  const n = pts.length;
  return pts.map((_, i) => {
    const a = pts[fechada ? (i - 1 + n) % n : Math.max(0, i - 1)];
    const b = pts[fechada ? (i + 1) % n : Math.min(n - 1, i + 1)];
    const t = v2(b.x - a.x, b.y - a.y).normalize();
    return v2(t.y * sinal, -t.x * sinal);
  });
}

// no plano (x, z) com z para "cima", o contorno anti-horário tem a normal de fora = (tz, −tx)
const SINAL_VAZIO = areaSinal(VAZIO) > 0 ? 1 : -1;
const NORMAIS_VAZIO = normais(VAZIO, true, SINAL_VAZIO);
// nas vitrines (aberta), a normal de `normais` com sinal −1 aponta para o vazio (o vazio fica à direita de quem anda nela)
const NORMAIS_LOJAS = normais(LOJAS, false, -1);

/** dentro do vazio do átrio? (o teto ali é a claraboia) */
export function noVazio(x: number, z: number) {
  let dentro = false;
  for (let i = 0, j = VAZIO.length - 1; i < VAZIO.length; j = i++) {
    const a = VAZIO[i];
    const b = VAZIO[j];
    if (a.y > z !== b.y > z && x < ((b.x - a.x) * (z - a.y)) / (b.y - a.y) + a.x) dentro = !dentro;
  }
  return dentro;
}

/** de onde sai o raio (x, z) na direção (dx, dz) até a borda do vazio: distância (Infinity se não bate) */
function ateBorda(x: number, z: number, dx: number, dz: number) {
  let melhor = Infinity;
  for (let i = 0; i < VAZIO.length; i++) {
    const a = VAZIO[i];
    const b = VAZIO[(i + 1) % VAZIO.length];
    const sx = b.x - a.x;
    const sz = b.y - a.y;
    const den = dx * sz - dz * sx;
    if (Math.abs(den) < 1e-9) continue;
    const qx = a.x - x;
    const qz = a.y - z;
    const t = (qx * sz - qz * sx) / den;
    const u = (qx * dz - qz * dx) / den;
    if (t > 0 && u >= 0 && u <= 1 && t < melhor) melhor = t;
  }
  return melhor;
}

/** caminho dos visitantes de uma varanda (laço fechado, ~1,9 m para dentro da laje) */
export function caminhoVaranda(): THREE.Vector2[] {
  return VAZIO.filter((_, i) => i % 2 === 0).map((p, i) => v2(p.x + NORMAIS_VAZIO[i * 2].x * 1.9, p.y + NORMAIS_VAZIO[i * 2].y * 1.9));
}

// ---- geometria: fitas ao longo dos contornos

/** fita vertical ao longo dos pontos, deslocada `d` m pela normal, de y0 a y1; u em metros */
function fitaVertical(pts: THREE.Vector2[], nor: THREE.Vector2[], d: number, y0: number, y1: number, fechada: boolean, uv?: { u0: number; u1: number; v0: number; v1: number }) {
  const n = pts.length;
  const m = fechada ? n + 1 : n;
  const pos: number[] = [];
  const uvs: number[] = [];
  const idx: number[] = [];
  const xs: number[] = [];
  const zs: number[] = [];
  for (let i = 0; i < m; i++) {
    const k = i % n;
    xs.push(pts[k].x + nor[k].x * d);
    zs.push(pts[k].y + nor[k].y * d);
  }
  let total = 0;
  const s = [0];
  for (let i = 1; i < m; i++) s.push((total += Math.hypot(xs[i] - xs[i - 1], zs[i] - zs[i - 1])));
  for (let i = 0; i < m; i++) {
    pos.push(xs[i], y0, zs[i], xs[i], y1, zs[i]);
    if (uv) {
      const u = uv.u0 + (uv.u1 - uv.u0) * (total ? s[i] / total : 0);
      uvs.push(u, uv.v0, u, uv.v1);
    } else uvs.push(s[i], y0, s[i], y1);
  }
  for (let i = 0; i < m - 1; i++) idx.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** fita deitada (filete de luz no teto, fundo da testeira) entre os deslocamentos d0 e d1, na altura y */
function fitaDeitada(pts: THREE.Vector2[], nor: THREE.Vector2[], d0: number, d1: number, y: number, fechada: boolean) {
  const n = pts.length;
  const m = fechada ? n + 1 : n;
  const pos: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i < m; i++) {
    const k = i % n;
    pos.push(pts[k].x + nor[k].x * d0, y, pts[k].y + nor[k].y * d0, pts[k].x + nor[k].x * d1, y, pts[k].y + nor[k].y * d1);
  }
  for (let i = 0; i < m - 1; i++) idx.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** laje plana com o vazio furado: piso (para cima) ou teto (para baixo) */
function lajeCom(furo: THREE.Vector2[], y: number, paraCima: boolean) {
  const sinal = paraCima ? -1 : 1;
  const forma = new THREE.Shape(pegada().map((p) => v2(p.x, p.y * sinal)));
  forma.holes.push(new THREE.Path(furo.map((p) => v2(p.x, p.y * sinal))));
  const g = new THREE.ShapeGeometry(forma);
  g.rotateX(paraCima ? -Math.PI / 2 : Math.PI / 2);
  g.translate(0, y, 0);
  return g;
}

/** pedaços seguidos do contorno que não caem nas aberturas (onde chegam pontes e escadas) */
function trechosLivres(pts: THREE.Vector2[], aberturas: { x: number; z: number; r: number }[]) {
  const livre = pts.map((p) => !aberturas.some((a) => Math.hypot(p.x - a.x, p.y - a.z) < a.r));
  if (livre.every(Boolean)) return [{ ini: 0, fim: pts.length, fechado: true }];
  // começa logo depois de uma abertura, para os trechos não quebrarem na emenda do laço
  const n = pts.length;
  const ini = livre.findIndex((l, i) => l && !livre[(i - 1 + n) % n]);
  const trechos: { ini: number; fim: number; fechado: boolean }[] = [];
  let atual: number | null = null;
  for (let k = 0; k <= n; k++) {
    const i = (ini + k) % n;
    if (k < n && livre[i]) {
      if (atual === null) atual = ini + k;
    } else if (atual !== null) {
      trechos.push({ ini: atual, fim: ini + k, fechado: false });
      atual = null;
    }
  }
  return trechos;
}

const pedaco = <T,>(lista: T[], ini: number, fim: number) => Array.from({ length: fim - ini }, (_, k) => lista[(ini + k) % lista.length]);

// atlas das vitrines acesas (um só para os pisos de cima e as vitrines de enfeite do térreo)
let vitrines: { tex: THREE.CanvasTexture; mat: THREE.MeshStandardMaterial; usos: number } | null = null;
function materialVitrines() {
  if (!vitrines) {
    const tex = canvasTextura(atlasVitrines());
    vitrines = { tex, mat: new THREE.MeshStandardMaterial({ map: tex, emissive: "#ffffff", emissiveMap: tex, emissiveIntensity: 0.62, roughness: 0.28, envMapIntensity: 0.7, side: THREE.DoubleSide }), usos: 0 };
  }
  vitrines.usos++;
  return vitrines.mat;
}
function soltarVitrines() {
  if (vitrines && --vitrines.usos <= 0) {
    vitrines.tex.dispose();
    vitrines.mat.dispose();
    vitrines = null;
  }
}

function uvCelula(k: number) {
  const { colunas, linhas, largura: CL, altura: CA } = CELULAS_ATLAS;
  const col = k % colunas;
  const lin = Math.floor(k / colunas);
  return { u0: (col * CL + 4) / (CL * colunas), u1: ((col + 1) * CL - 4) / (CL * colunas), v0: 1 - ((lin + 1) * CA - 3) / (CA * linhas), v1: 1 - (lin * CA + 3) / (CA * linhas) };
}

/** vitrine acesa de enfeite numa parede reta do térreo, de (x0, z0) a (x1, z1); devolve o "soltar" do material */
export function vitrineDecorativa(lotes: Lotes, x0: number, z0: number, x1: number, z1: number, y0: number, y1: number, celula: number) {
  const pts = [v2(x0, z0), v2(x1, z1)];
  const nor = [v2(0, 0), v2(0, 0)];
  lotes.adicionar(materialVitrines(), fitaVertical(pts, nor, 0, y0, y1, false, uvCelula(celula)));
  return soltarVitrines;
}

export interface Atrio {
  grupo: THREE.Group;
  plantas: LugarPlanta[];
  atualizar: (t: number, dt: number) => void;
  descartar: () => void;
}

export interface OpcoesAtrio {
  mat: Materiais;
  colisao: Colisao;
  celular: boolean;
  /** lojas abertas (para o telão de LED do piso 3) */
  ocupadas: { nome: string; cor: string; slogan: string }[];
}

interface Abertura {
  nivel: number;
  x: number;
  z: number;
  r: number;
}

export function criarAtrio(op: OpcoesAtrio): Atrio {
  const { mat, colisao } = op;
  const grupo = new THREE.Group();
  const lotes = new Lotes();
  const plantas: LugarPlanta[] = [];
  const animar: ((t: number, dt: number) => void)[] = [];
  const lixo: { dispose: () => void }[] = [];

  // ---- escadas rolantes e elevador primeiro: eles dizem onde o guarda-corpo abre
  const aberturas: Abertura[] = [];
  const degraus = texturaDegraus();
  const degrausDesce = degraus.clone();
  const matSobe = new THREE.MeshStandardMaterial({ map: degraus, roughness: 0.45, metalness: 0.6 });
  const matDesce = new THREE.MeshStandardMaterial({ map: degrausDesce, roughness: 0.45, metalness: 0.6 });
  lixo.push(degraus, degrausDesce, matSobe, matDesce);
  animar.push((t) => {
    // 0,5 m/s, um degrau a cada 0,4 m
    degraus.offset.y = -(t * 0.5) / 0.4;
    degrausDesce.offset.y = (t * 0.5) / 0.4;
  });
  const escadas = [
    // térreo → piso 2, do lado da Be2Beauty, subindo para o fundo
    { x: 15.5, z: -27, dz: -1, y0: 0, y1: P2 },
    // piso 2 → piso 3, do lado da BeautyNow (cruza com a de baixo, vista da galeria)
    { x: -15.5, z: -27, dz: -1, y0: P2, y1: P3 },
  ];
  for (const e of escadas) {
    const comp = escadaRolante(lotes, mat, matSobe, matDesce, e.x, e.z, e.dz, e.y0, e.y1);
    // ponte do fim de cima até a borda do vazio (e, se começa num piso de cima, do começo também)
    const pontas: { z: number; dz: number; y: number; nivel: number }[] = [{ z: e.z + e.dz * comp, dz: e.dz, y: e.y1, nivel: e.y1 === P2 ? 2 : 3 }];
    if (e.y0 > 0) pontas.push({ z: e.z, dz: -e.dz, y: e.y0, nivel: 2 });
    for (const p of pontas) {
      const ate = ateBorda(e.x, p.z, 0, p.dz);
      if (!Number.isFinite(ate)) continue;
      ponte(lotes, mat, e.x, p.z, p.dz, ate + 0.7, 1.5, p.y);
      aberturas.push({ nivel: p.nivel, x: e.x, z: p.z + p.dz * ate, r: 1.7 });
    }
    if (e.y0 === 0) {
      // a parte baixa da escada (até ~2,3 m de altura) é parede para quem anda no térreo
      const ate = 1.5 + 1.73 + 2.3 / Math.tan(Math.PI / 6);
      colisao.caixa(e.x - 1.5, Math.min(e.z, e.z + e.dz * ate), e.x + 1.5, Math.max(e.z, e.z + e.dz * ate), 3);
    }
  }
  // elevador panorâmico no fundo da praça, entre as duas âncoras
  const ELEV = { x: 0, z: -41.2, meio: 1.2 };
  for (const [y, nivel] of [
    [P2, 2],
    [P3, 3],
  ] as const) {
    const ate = ateBorda(ELEV.x, ELEV.z - ELEV.meio, 0, -1);
    ponte(lotes, mat, ELEV.x, ELEV.z - ELEV.meio, -1, (Number.isFinite(ate) ? ate : 0.3) + 0.7, 1.1, y);
    aberturas.push({ nivel, x: ELEV.x, z: ELEV.z - ELEV.meio - (Number.isFinite(ate) ? ate : 0.3), r: 1.3 });
  }
  elevador(grupo, lotes, mat, animar, lixo, ELEV.x, ELEV.z, ELEV.meio);
  colisao.caixa(ELEV.x - ELEV.meio - 0.15, ELEV.z - ELEV.meio - 0.15, ELEV.x + ELEV.meio + 0.15, ELEV.z + ELEV.meio + 0.15, COB);

  // ---- lajes dos pisos 2 e 3: piso, teto, testeira com LED, guarda-corpo
  for (const [y, nivel] of [
    [P2, 2],
    [P3, 3],
  ] as const) {
    lotes.adicionar(mat.pisoVaranda, lajeCom(VAZIO, y, true), { sombra: true });
    lotes.adicionar(mat.teto, lajeCom(VAZIO, y - ESP, false));
    // testeira: faixa branca na borda (face do vazio e a de trás), com o fundo fechado
    const baixo = y - TESTEIRA;
    lotes.adicionar(mat.fachadaBranca, fitaVertical(VAZIO, NORMAIS_VAZIO, 0, baixo, y + 0.04, true), { sombra: true });
    lotes.adicionar(mat.fachadaBranca, fitaVertical(VAZIO, NORMAIS_VAZIO, 0.28, baixo, y - ESP, true));
    lotes.adicionar(mat.fachadaBranca, fitaDeitada(VAZIO, NORMAIS_VAZIO, 0, 0.28, baixo, true));
    // filetes de LED quente: embaixo da testeira, no topo dela e um rasgo de luz no teto da varanda
    lotes.adicionar(mat.led, fitaVertical(VAZIO, NORMAIS_VAZIO, -0.012, baixo + 0.05, baixo + 0.1, true));
    lotes.adicionar(mat.led, fitaVertical(VAZIO, NORMAIS_VAZIO, -0.012, y - 0.13, y - 0.09, true));
    lotes.adicionar(mat.led, fitaDeitada(VAZIO, NORMAIS_VAZIO, 0.4, 0.52, y - ESP - 0.01, true));
    // spots no teto da varanda
    VAZIO.forEach((p, i) => {
      if (i % 6) return;
      const n = NORMAIS_VAZIO[i];
      const c = new THREE.CircleGeometry(0.09, 12);
      c.rotateX(Math.PI / 2);
      c.translate(p.x + n.x * 1.7, y - ESP - 0.006, p.y + n.y * 1.7);
      lotes.adicionar(mat.luz, c);
    });
    // guarda-corpo de vidro e corrimão (abre onde chegam escada, ponte e elevador)
    const daqui = aberturas.filter((a) => a.nivel === nivel);
    for (const tr of trechosLivres(VAZIO, daqui)) {
      const pts = pedaco(VAZIO, tr.ini, tr.fim);
      const nor = pedaco(NORMAIS_VAZIO, tr.ini, tr.fim);
      if (pts.length < 2) continue;
      lotes.adicionar(mat.vidro, fitaVertical(pts, nor, 0.1, y, y + VIDRO_GUARDA, tr.fechado));
      lotes.adicionar(mat.aco, fitaVertical(pts, nor, 0.1, y + 0.02, y + 0.08, tr.fechado));
      const caminho = new THREE.CatmullRomCurve3(
        pts.map((p, i) => new THREE.Vector3(p.x + nor[i].x * 0.1, y + VIDRO_GUARDA + 0.03, p.y + nor[i].y * 0.1)),
        tr.fechado
      );
      lotes.adicionar(mat.aco, new THREE.TubeGeometry(caminho, Math.max(4, pts.length), 0.032, 6, tr.fechado));
    }
    // vasos com planta na varanda, encostados no vidro (a planta é pesada: espaçados, e menos no celular)
    const cada = op.celular ? 110 : 64;
    VAZIO.forEach((p, i) => {
      if (i % cada !== Math.floor(cada / 2) + nivel * 9) return;
      const n = NORMAIS_VAZIO[i];
      const x = p.x + n.x * 0.75;
      const z = p.y + n.y * 0.75;
      if (daqui.some((a) => Math.hypot(a.x - x, a.z - z) < 3)) return;
      const vaso = new THREE.CylinderGeometry(0.42, 0.34, 0.7, 28);
      vaso.translate(x, y + 0.35, z);
      lotes.adicionar(mat.fachadaBranca, vaso, { sombra: true });
      plantas.push({ tipo: "grande", matriz: new THREE.Matrix4().compose(new THREE.Vector3(x, y + 0.58, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), i), new THREE.Vector3(1.05, 1.05, 1.05)) });
    });
    // borda das lajes atrás da fachada de vidro (vista de fora: as linhas dos andares)
    const frente = pegada().slice(0, 37);
    const nf = normais(frente, false, 1);
    lotes.adicionar(mat.fachadaBranca, fitaVertical(frente, nf, 0, y - ESP - 0.3, y + 0.02, false));
    lotes.adicionar(mat.led, fitaVertical(frente, nf, 0.012, y - ESP - 0.28, y - ESP - 0.23, false));
  }

  // ---- vitrines dos pisos 2 e 3 (atlas de fachadas acesas)
  const matVitrine = materialVitrines();
  lixo.push({ dispose: soltarVitrines });
  const comprimentos = [0];
  for (let i = 1; i < LOJAS.length; i++) comprimentos.push(comprimentos[i - 1] + LOJAS[i].distanceTo(LOJAS[i - 1]));
  const total = comprimentos[comprimentos.length - 1];
  const nLojas = Math.round(total / 10.5);
  const ponto = (s: number) => {
    let i = comprimentos.findIndex((c) => c >= s);
    if (i <= 0) i = 1;
    const k = (s - comprimentos[i - 1]) / (comprimentos[i] - comprimentos[i - 1] || 1);
    return { p: LOJAS[i - 1].clone().lerp(LOJAS[i], k), n: NORMAIS_LOJAS[i - 1].clone().lerp(NORMAIS_LOJAS[i], k).normalize(), t: v2(LOJAS[i].x - LOJAS[i - 1].x, LOJAS[i].y - LOJAS[i - 1].y).normalize() };
  };
  let telaLed: { tex: THREE.CanvasTexture; g: CanvasRenderingContext2D; l: number; a: number } | null = null;
  for (const [y0, y1, nivel] of [
    [P2, P3 - ESP, 2],
    [P3, COB, 3],
  ] as const) {
    // a loja do meio do fundo: parede do logo no piso 2, telão no piso 3
    let doFundo = 0;
    let melhor = Infinity;
    for (let i = 0; i < nLojas; i++) {
      const m = ponto(((i + 0.5) * total) / nLojas).p;
      const d = Math.hypot(m.x, m.y + 47.4);
      if (d < melhor) {
        melhor = d;
        doFundo = i;
      }
    }
    for (let i = 0; i < nLojas; i++) {
      const s0 = (i * total) / nLojas;
      const s1 = ((i + 1) * total) / nLojas;
      const pts: THREE.Vector2[] = [];
      const nor: THREE.Vector2[] = [];
      for (const s of [s0, ...comprimentos.filter((c) => c > s0 && c < s1), s1]) {
        const q = ponto(s);
        pts.push(q.p);
        nor.push(q.n);
      }
      const ehFundo = i === doFundo;
      if (ehFundo && nivel === 3) {
        const l = 1024;
        const a = 512;
        const c = document.createElement("canvas");
        c.width = l;
        c.height = a;
        const tex = canvasTextura(c);
        const m = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.35, 1.35, 1.35), side: THREE.DoubleSide });
        lixo.push(tex, m);
        telaLed = { tex, g: c.getContext("2d")!, l, a };
        const malha = new THREE.Mesh(fitaVertical(pts, nor, 0, y0 + 0.4, y1 - 0.5, false, { u0: 0, u1: 1, v0: 0, v1: 1 }), m);
        grupo.add(malha);
        lixo.push(malha.geometry);
        lotes.adicionar(mat.metal, fitaVertical(pts, nor, -0.02, y0, y0 + 0.4, false));
        lotes.adicionar(mat.metal, fitaVertical(pts, nor, -0.02, y1 - 0.5, y1, false));
        continue;
      }
      const celula = ehFundo ? 7 : [0, 1, 2, 6, 3, 4, 5, 6][(i * 5 + nivel * 3) % 8];
      lotes.adicionar(matVitrine, fitaVertical(pts, nor, 0, y0, y1, false, uvCelula(celula)));
    }
    // pilares brancos entre as lojas; de 3 em 3, aletas lilás (como na referência)
    for (let i = 0; i <= nLojas; i++) {
      const q = ponto(Math.min(total - 0.01, Math.max(0.01, (i * total) / nLojas)));
      const h = y1 - y0;
      const ang = Math.atan2(-q.t.y, q.t.x);
      const peca = (larg: number, prof: number, desl: number, ao: number, m: THREE.Material) => {
        const g = new THREE.BoxGeometry(larg, h, prof);
        g.translate(desl, 0, ao);
        g.rotateY(ang);
        g.translate(q.p.x + q.n.x * 0.02, y0 + h / 2, q.p.y + q.n.y * 0.02);
        lotes.adicionar(m, g, { sombra: true });
      };
      // o "para o vazio" no sistema da peça (z local) depende do lado: confere pela normal
      const lado = Math.sign(Math.sin(ang) * q.n.x + Math.cos(ang) * q.n.y) || 1;
      if (i % 3 === 1 && i > 0 && i < nLojas) {
        for (let k = -3; k <= 3; k++) peca(0.07, 0.34, k * 0.17, lado * 0.17, k % 2 ? mat.roxo : mat.lilas);
      } else peca(0.6, 0.42, 0, lado * 0.21, mat.fachadaBranca);
    }
    // filete de luz no alto das vitrines
    lotes.adicionar(mat.led, fitaDeitada(LOJAS, NORMAIS_LOJAS, 0.15, 0.27, y1 - 0.012, false));
  }
  if (telaLed) {
    const tl: { tex: THREE.CanvasTexture; g: CanvasRenderingContext2D; l: number; a: number } = telaLed;
    let ultimo = -1;
    animar.push((t) => {
      if (t - ultimo < 0.2) return;
      ultimo = t;
      desenharLed(tl.g, tl.l, tl.a, t, op.ocupadas);
      tl.tex.needsUpdate = true;
    });
  }

  // ---- cobertura: teto com o vazio, testeira com LED, caixa de luz e a claraboia com a grelha de aço
  lotes.adicionar(mat.teto, lajeCom(VAZIO, COB, false));
  lotes.adicionar(mat.fachadaBranca, fitaVertical(VAZIO, NORMAIS_VAZIO, 0, COB - 0.75, Y_CLARABOIA, true), { sombra: true });
  lotes.adicionar(mat.led, fitaVertical(VAZIO, NORMAIS_VAZIO, -0.012, COB - 0.7, COB - 0.65, true));
  lotes.adicionar(mat.led, fitaDeitada(VAZIO, NORMAIS_VAZIO, 0.4, 0.52, COB - 0.01, true));
  VAZIO.forEach((p, i) => {
    if (i % 6) return;
    const n = NORMAIS_VAZIO[i];
    const c = new THREE.CircleGeometry(0.09, 12);
    c.rotateX(Math.PI / 2);
    c.translate(p.x + n.x * 1.9, COB - 0.006, p.y + n.y * 1.9);
    lotes.adicionar(mat.luz, c);
  });
  {
    const forma = new THREE.Shape(VAZIO.map((p) => v2(p.x, p.y)));
    const g = new THREE.ShapeGeometry(forma);
    g.rotateX(Math.PI / 2);
    g.translate(0, Y_CLARABOIA, 0);
    lotes.adicionar(mat.vidroCeu, g);
    // grelha: vigas nos dois sentidos, cortadas no contorno do vazio
    const passo = 2.6;
    const yv = Y_CLARABOIA - 0.1;
    for (let z = -42; z <= 40.5; z += passo) {
      for (const [a, b] of cortes(z, false)) lotes.bloco(mat.aco, a, yv - 0.08, z - 0.05, b, yv + 0.08, z + 0.05, { sombra: true });
    }
    for (let x = -21.4; x <= 21.4; x += passo) {
      for (const [a, b] of cortes(x, true)) lotes.bloco(mat.aco, x - 0.05, yv - 0.08, a, x + 0.05, yv + 0.08, b, { sombra: true });
    }
  }

  // ---- bandeiras penduradas com o logo
  {
    const tex = canvasTextura(bandeira());
    const m = new THREE.MeshStandardMaterial({ map: tex, emissive: "#ffffff", emissiveMap: tex, emissiveIntensity: 0.35, roughness: 0.85 });
    lixo.push(tex, m);
    const L = 2.2;
    const A = 6.6;
    for (const [x, z] of [
      [0, 13],
      [0, -7],
      [-9, -33.5],
      [9, -33.5],
    ]) {
      const yc = COB - 0.9 - A / 2;
      for (const r of [0, Math.PI]) {
        const p = new THREE.Mesh(new THREE.PlaneGeometry(L, A), m);
        p.position.set(x, yc, z + (r ? -0.012 : 0.012));
        p.rotation.y = r;
        p.castShadow = true;
        grupo.add(p);
        lixo.push(p.geometry);
      }
      lotes.bloco(mat.aco, x - L / 2 - 0.05, yc + A / 2 - 0.03, z - 0.04, x + L / 2 + 0.05, yc + A / 2 + 0.05, z + 0.04);
      lotes.bloco(mat.aco, x - L / 2 - 0.05, yc - A / 2 - 0.05, z - 0.04, x + L / 2 + 0.05, yc - A / 2 + 0.03, z + 0.04);
      for (const s of [-1, 1]) lotes.bloco(mat.aco, x + (s * L) / 2 - 0.01, yc + A / 2, z - 0.01, x + (s * L) / 2 + 0.01, Y_CLARABOIA - 0.1, z + 0.01);
    }
  }

  grupo.add(lotes.fechar());
  return {
    grupo,
    plantas,
    atualizar: (t, dt) => animar.forEach((f) => f(t, dt)),
    descartar: () => {
      lixo.forEach((x) => x.dispose());
      grupo.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    },
  };
}

/** trechos de uma linha reta (z fixo, ou x fixo) que ficam dentro do vazio */
function cortes(c: number, emX: boolean): [number, number][] {
  const hits: number[] = [];
  for (let i = 0; i < VAZIO.length; i++) {
    const a = VAZIO[i];
    const b = VAZIO[(i + 1) % VAZIO.length];
    const [ac, bc, ao, bo] = emX ? [a.x, b.x, a.y, b.y] : [a.y, b.y, a.x, b.x];
    if (ac > c !== bc > c) hits.push(ao + ((c - ac) * (bo - ao)) / (bc - ac));
  }
  hits.sort((p, q) => p - q);
  const r: [number, number][] = [];
  for (let i = 0; i + 1 < hits.length; i += 2) if (hits[i + 1] - hits[i] > 0.3) r.push([hits[i] + 0.05, hits[i + 1] - 0.05]);
  return r;
}

/** degraus de alumínio com o friso amarelo (repete a cada 0,4 m; desliza com o tempo) */
function texturaDegraus() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = "#6d6c72";
  g.fillRect(0, 0, 128, 64);
  g.fillStyle = "#4a494f";
  for (let x = 0; x < 128; x += 6) g.fillRect(x, 0, 3, 64);
  g.fillStyle = "#d9b23a";
  g.fillRect(0, 0, 6, 64);
  g.fillRect(122, 0, 6, 64);
  g.fillStyle = "#2c2b30";
  g.fillRect(0, 58, 128, 6);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

/**
 * Um par de escadas rolantes (uma sobe, a outra desce) ao longo do eixo z,
 * a partir de (x, z) na altura y0 até y1, com patamares de 1,5 m, 30° de
 * inclinação, vidro dos lados, corrimão preto e LED embaixo do vidro.
 * Devolve o comprimento no chão (do começo ao fim do patamar de cima).
 */
function escadaRolante(lotes: Lotes, mat: Materiais, matSobe: THREE.Material, matDesce: THREE.Material, x: number, z: number, dz: number, y0: number, y1: number) {
  const PAT = 1.5;
  const H = (y1 - y0) / Math.tan(Math.PI / 6);
  const T = PAT * 2 + H;
  const W = 1.3;
  // perfil em (s, y): s ao longo da escada; y absoluto
  const topo = (s: number) => (s <= PAT ? y0 : s >= PAT + H ? y1 : y0 + ((s - PAT) / H) * (y1 - y0));
  // de (s, y, lateral) local para o mundo: s vai no sentido dz
  const mundo = (g: THREE.BufferGeometry) => {
    g.rotateY(dz < 0 ? Math.PI / 2 : -Math.PI / 2);
    g.translate(x, 0, z);
    return g;
  };
  for (const [lat, sobe] of [
    [-0.7, true],
    [0.7, false],
  ] as const) {
    // corpo (treliça revestida de branco)
    const forma = new THREE.Shape([v2(0, y0), v2(0, y0 + 0.02), v2(PAT, y0 + 0.02), v2(PAT + H, y1 + 0.02), v2(T, y1 + 0.02), v2(T, y1 - 0.45), v2(PAT + H, y1 - 1.0), v2(PAT + 1.73, y0)]);
    const corpo = new THREE.ExtrudeGeometry(forma, { depth: W, bevelEnabled: false });
    corpo.translate(0, 0, lat - W / 2);
    lotes.adicionar(mat.fachadaBranca, mundo(corpo), { sombra: true });
    // degraus: faixa ao longo do perfil, uv em degraus de 0,4 m
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    const ss = [0, PAT, PAT + H, T];
    ss.forEach((s, i) => {
      const y = topo(s) + 0.045;
      pos.push(s, y, lat - 0.5, s, y, lat + 0.5);
      // comprimento ao longo do perfil (na rampa, a hipotenusa)
      const ao = i === 0 ? 0 : i === 1 ? PAT : i === 2 ? PAT + H / Math.cos(Math.PI / 6) : PAT * 2 + H / Math.cos(Math.PI / 6);
      uv.push(0, ao / 0.4, 1, ao / 0.4);
    });
    for (let i = 0; i < 3; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    lotes.adicionar(sobe ? matSobe : matDesce, mundo(g));
    // vidro dos dois lados, corrimão e LED no rodapé do vidro
    for (const l of [lat - 0.56, lat + 0.56]) {
      const vp: number[] = [];
      const vi: number[] = [];
      ss.forEach((s) => vp.push(s, topo(s) + 0.12, l, s, topo(s) + 1.0, l));
      for (let i = 0; i < 3; i++) vi.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3);
      const gv = new THREE.BufferGeometry();
      gv.setAttribute("position", new THREE.Float32BufferAttribute(vp, 3));
      gv.setIndex(vi);
      gv.computeVertexNormals();
      lotes.adicionar(mat.vidro, mundo(gv));
      // fio de luz no rodapé do vidro: de 0,08 a 0,14 acima do degrau
      const led = gv.clone();
      const lp = led.attributes.position;
      for (let i = 0; i < lp.count; i++) {
        const s = lp.getX(i);
        lp.setY(i, topo(s) + (i % 2 ? 0.14 : 0.08));
      }
      led.computeVertexNormals();
      lotes.adicionar(mat.led, mundo(led));
      const caminho = new THREE.CurvePath<THREE.Vector3>();
      const pts = [new THREE.Vector3(-0.3, y0 + 0.92, l), ...ss.map((s) => new THREE.Vector3(s, topo(s) + 1.02, l)), new THREE.Vector3(T + 0.3, y1 + 0.92, l)];
      for (let i = 0; i + 1 < pts.length; i++) caminho.add(new THREE.LineCurve3(pts[i], pts[i + 1]));
      lotes.adicionar(mat.corrimao, mundo(new THREE.TubeGeometry(caminho, 40, 0.045, 6, false)));
    }
  }
  return T;
}

/** ponte (laje com guarda-corpo dos lados) da ponta de uma escada ou do elevador até a borda do vazio */
function ponte(lotes: Lotes, mat: Materiais, x: number, z: number, dz: number, comp: number, meia: number, y: number) {
  const z0 = Math.min(z, z + dz * comp);
  const z1 = Math.max(z, z + dz * comp);
  lotes.bloco(mat.pisoVaranda, x - meia, y - ESP, z0, x + meia, y, z1, { sombra: true });
  lotes.bloco(mat.fachadaBranca, x - meia - 0.02, y - TESTEIRA, z0, x + meia + 0.02, y - ESP, z1, { sombra: true });
  for (const s of [-1, 1]) {
    lotes.bloco(mat.vidro, x + s * (meia - 0.06), y, z0, x + s * (meia - 0.05), y + VIDRO_GUARDA, z1);
    lotes.bloco(mat.aco, x + s * (meia - 0.09), y + VIDRO_GUARDA, z0, x + s * (meia - 0.02), y + VIDRO_GUARDA + 0.06, z1);
    lotes.bloco(mat.led, x + s * (meia + 0.025), y - TESTEIRA + 0.05, z0, x + s * (meia + 0.03), y - TESTEIRA + 0.1, z1);
  }
}

/** elevador panorâmico: torre de vidro do térreo até a claraboia e a cabine que sobe e desce entre os pisos */
function elevador(grupo: THREE.Group, lotes: Lotes, mat: Materiais, animar: ((t: number, dt: number) => void)[], lixo: { dispose: () => void }[], x: number, z: number, meia: number) {
  const alto = Y_CLARABOIA - 0.15;
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) lotes.bloco(mat.aco, x + sx * meia - 0.07, 0, z + sz * meia - 0.07, x + sx * meia + 0.07, alto, z + sz * meia + 0.07, { sombra: true });
  for (let y = 0; y <= alto; y += 2.65) {
    lotes.bloco(mat.aco, x - meia, y, z - meia - 0.04, x + meia, y + 0.08, z - meia + 0.04);
    lotes.bloco(mat.aco, x - meia, y, z + meia - 0.04, x + meia, y + 0.08, z + meia + 0.04);
    lotes.bloco(mat.aco, x - meia - 0.04, y, z - meia, x - meia + 0.04, y + 0.08, z + meia);
    lotes.bloco(mat.aco, x + meia - 0.04, y, z - meia, x + meia + 0.04, y + 0.08, z + meia);
  }
  lotes.bloco(mat.vidro, x - meia, 0, z + meia - 0.01, x + meia, alto, z + meia + 0.01);
  lotes.bloco(mat.vidro, x - meia - 0.01, 0, z - meia, x - meia + 0.01, alto, z + meia);
  lotes.bloco(mat.vidro, x + meia - 0.01, 0, z - meia, x + meia + 0.01, alto, z + meia);
  lotes.bloco(mat.vidro, x - meia, 0, z - meia - 0.01, x + meia, alto, z - meia + 0.01);
  lotes.bloco(mat.fachadaBranca, x - meia - 0.2, 0, z - meia - 0.2, x + meia + 0.2, 0.12, z + meia + 0.2);
  // cabine
  const cabine = new THREE.Group();
  const c = meia - 0.18;
  const peca = (g: THREE.BufferGeometry, m: THREE.Material) => {
    const malha = new THREE.Mesh(g, m);
    cabine.add(malha);
    lixo.push(g);
    return malha;
  };
  peca(new THREE.BoxGeometry(c * 2, 0.14, c * 2).translate(0, 0.07, 0), mat.fachadaBranca);
  peca(new THREE.BoxGeometry(c * 2, 0.18, c * 2).translate(0, 2.5, 0), mat.fachadaBranca);
  peca(new THREE.PlaneGeometry(c * 1.6, c * 1.6).rotateX(Math.PI / 2).translate(0, 2.405, 0), mat.luz);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) peca(new THREE.BoxGeometry(0.06, 2.4, 0.06).translate(sx * c, 1.25, sz * c), mat.aco);
  for (const r of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const v = peca(new THREE.PlaneGeometry(c * 2, 2.3).translate(0, 1.29, c), mat.vidro);
    v.rotation.y = r;
  }
  peca(new THREE.BoxGeometry(c * 2, 0.05, 0.05).translate(0, 1.0, c - 0.06), mat.aco);
  cabine.position.set(x, 0, z);
  grupo.add(cabine);
  // térreo → 2 → 3 → 2 → térreo, parando 6 s em cada andar e levando ~4 s entre eles
  const paradas = [0, P2, P3, P2];
  const PARADO = 6;
  const VIAGEM = 4;
  animar.push((t) => {
    const ciclo = paradas.length * (PARADO + VIAGEM);
    const k = t % ciclo;
    const i = Math.floor(k / (PARADO + VIAGEM));
    const r = k - i * (PARADO + VIAGEM);
    const de = paradas[i];
    const para = paradas[(i + 1) % paradas.length];
    const f = r < PARADO ? 0 : THREE.MathUtils.smootherstep(r - PARADO, 0, VIAGEM);
    cabine.position.y = de + (para - de) * f + 0.12;
  });
}
