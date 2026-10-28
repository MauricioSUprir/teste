/**
 * O térreo do prédio (sem as lojas e sem o átrio de cima): o porcelanato do
 * saguão, da galeria e da Praça da Beleza; as paredes do saguão com o
 * provador e o quadro de boas-vindas; as vitrines "em breve" nas paredes da
 * praça; a faixa com os letreiros das lojas âncora; o lounge do meio da praça
 * (árvore, sofás lilás e o quiosque roxo do Beauty Shopping); bancos, vasos e
 * os totens com os pisos e o mapa.
 */
import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { PLANTA, zFachadaEm, type Inquilino } from "../dados/lojas";
import { textos } from "../copy/textos";
import type { Colisao } from "./colisao";
import { Lotes, planoChao, placa } from "./construtor";
import { canvasTextura, COR_SHOPPING, desenharImagemMarca, desenharLogoShopping, desenharMarca, FONTE, FONTE_TITULO, telaTotem } from "./letreiros";
import type { Materiais } from "./materiais";
import type { LugarPlanta } from "./plantas";
import { vitrineDecorativa } from "./atrio";

export interface PontoInteracao {
  tipo: "mapa" | "caixa" | "aluguel" | "provador";
  x: number;
  z: number;
  raio: number;
  rotulo: string;
  unidade?: string;
}

export interface OpcoesEstrutura {
  mat: Materiais;
  colisao: Colisao;
  ocupadas: { numero: string; nome: string; cor: string; slogan: string }[];
  vagas: string[];
  /** lojas âncora no fundo da praça: centro em x e largura total da fachada */
  ancoras: { cx: number; largura: number; altura: number; inquilino: Inquilino }[];
}

const { meioCorredor: MC, zLojasSul: ZS, zLojasNorte: ZN, zPraca: ZP, meiaPraca: MP, meioSaguao: MS, piso2: P2, espLaje: ESP } = PLANTA;
/** altura do teto do térreo debaixo das varandas */
const TETO_TERREO = P2 - ESP;
/** lounge do meio da praça e o quiosque */
export const LOUNGE = { x: 0, z: -30.5, raio: 3.05 };
export const QUIOSQUE = { x: 0, z: -36.4, raio: 1.7 };

export function criarEstrutura(op: OpcoesEstrutura) {
  const { mat, colisao } = op;
  const grupo = new THREE.Group();
  const lotes = new Lotes();
  const pontos: PontoInteracao[] = [];
  const plantas: LugarPlanta[] = [];
  const animar: ((t: number, dt: number) => void)[] = [];
  const lixo: { dispose: () => void }[] = [];

  // ---- pisos (o porcelanato com reflexo): galeria, praça e o saguão até a curva da fachada
  const pisos: THREE.Mesh[] = [];
  const saguao = new THREE.Shape([new THREE.Vector2(-MS, -ZS), new THREE.Vector2(MS, -ZS), ...Array.from({ length: 37 }, (_, i) => {
    const x = MS - (2 * MS * i) / 36;
    return new THREE.Vector2(x, -zFachadaEm(x));
  })]);
  const geoSaguao = new THREE.ShapeGeometry(saguao);
  geoSaguao.rotateX(-Math.PI / 2);
  for (const g of [planoChao(-MC, ZN, MC, ZS), planoChao(-MP, ZP, MP, ZN), geoSaguao]) {
    const p = new THREE.Mesh(g, mat.pisoGaleria);
    p.receiveShadow = true;
    grupo.add(p);
    pisos.push(p);
  }
  // desenho do piso: dois frisos lilás ao longo da galeria e um anel em volta do lounge
  const friso = new THREE.MeshStandardMaterial({ color: "#c9b6da", roughness: 0.3, envMapIntensity: 1 });
  lixo.push(friso);
  for (const x of [-2.6, 2.6]) lotes.bloco(friso, x - 0.05, 0, ZN, x + 0.05, 0.004, zFachadaEm(x) - 2);
  for (const r of [LOUNGE.raio + 1.2, LOUNGE.raio + 1.45]) {
    const g = new THREE.RingGeometry(r, r + 0.08, 96);
    g.rotateX(-Math.PI / 2);
    g.translate(LOUNGE.x, 0.004, LOUNGE.z);
    lotes.adicionar(friso, g);
  }

  // ---- saguão: paredes laterais (|x| = 18) e a do fundo (z = 24), brancas com aletas lilás
  for (const s of [-1, 1]) {
    const zf = zFachadaEm(s * MS);
    lotes.bloco(mat.fachadaBranca, s * MS, 0, ZS, s * (MS + 0.3), TETO_TERREO, zf);
    colisao.parede(s * MS, ZS, s * MS, zf, TETO_TERREO);
    lotes.bloco(mat.fachadaBranca, s * (MC + 0.1), 0, ZS, s * MS, TETO_TERREO, ZS + 0.2);
    colisao.parede(s * MC, ZS + 0.2, s * MS, ZS + 0.2, TETO_TERREO);
    for (const z of [26.2, 36.8])
      for (let k = 0; k < 5; k++) lotes.bloco(k % 2 ? mat.lilas : mat.roxo, s * (MS - 0.3), 0, z - 0.5 + k * 0.24, s * MS, TETO_TERREO, z - 0.38 + k * 0.24);
    // faixa de luz no alto das paredes
    lotes.bloco(mat.led, s * (MS - 0.02), TETO_TERREO - 0.25, ZS + 0.3, s * MS, TETO_TERREO - 0.2, zf - 0.3);
  }
  for (const s of [-1, 1]) for (let k = 0; k < 5; k++) lotes.bloco(k % 2 ? mat.lilas : mat.roxo, s * (12.6 + k * 0.24), 0, ZS + 0.2, s * (12.72 + k * 0.24), TETO_TERREO, ZS + 0.5);

  // ---- Praça da Beleza: paredes dos lados e da frente com vitrines "em breve"
  for (const s of [-1, 1]) {
    lotes.bloco(mat.fachadaBranca, s * MP, 0, ZP, s * (MP + 0.3), TETO_TERREO, ZN);
    colisao.parede(s * MP, ZP, s * MP, ZN, TETO_TERREO);
    // parede entre a praça e o fundo das lojas da galeria (de |x| = 8 a 32)
    lotes.bloco(mat.fachadaBranca, s * MC, 0, ZN - 0.3, s * MP, TETO_TERREO, ZN);
    colisao.parede(s * MC, ZN - 0.3, s * MP, ZN - 0.3, TETO_TERREO);
    const x = s * (MP - 0.02);
    // (a textura corre da esquerda para a direita de quem olha a parede)
    lixo.push({ dispose: vitrineDecorativa(lotes, x, s > 0 ? -33.6 : -25.4, x, s > 0 ? -25.4 : -33.6, 0, TETO_TERREO - 0.2, s > 0 ? 1 : 2) });
    lixo.push({ dispose: vitrineDecorativa(lotes, x, s > 0 ? -42.8 : -34.4, x, s > 0 ? -34.4 : -42.8, 0, TETO_TERREO - 0.2, s > 0 ? 6 : 0) });
    lixo.push({ dispose: vitrineDecorativa(lotes, s > 0 ? 31.2 : -20.8, ZN - 0.32, s > 0 ? 20.8 : -31.2, ZN - 0.32, 0, TETO_TERREO - 0.2, s > 0 ? 4 : 5) });
    // pilares brancos entre as vitrines, com aletas lilás
    for (const z of [-25, -34, -43.2]) lotes.bloco(mat.fachadaBranca, s * (MP - 0.45), 0, z - 0.35, s * MP, TETO_TERREO, z + 0.35, { sombra: true });
    for (let k = 0; k < 5; k++) lotes.bloco(k % 2 ? mat.lilas : mat.roxo, s * (20.1 + k * 0.1), 0, ZN - 0.62, s * (20.16 + k * 0.1), TETO_TERREO, ZN - 0.3);
  }
  // fundo da praça: as fachadas das âncoras até o teto delas; em cima, a faixa com os letreiros
  {
    const alt = Math.max(...op.ancoras.map((a) => a.altura));
    lotes.bloco(mat.fachadaBranca, -MP, alt, ZP - 0.15, MP, TETO_TERREO + 0.05, ZP + 0.05);
    lotes.bloco(mat.led, -MP, alt + 0.02, ZP + 0.05, MP, alt + 0.07, ZP + 0.07);
    const faixas = op.ancoras.map((a) => [a.cx - a.largura / 2, a.cx + a.largura / 2]).sort((a, b) => a[0] - b[0]);
    let x = -MP;
    for (const [a, b] of [...faixas, [MP, MP]]) {
      if (a - x > 0.01) {
        lotes.bloco(mat.fachadaBranca, x, 0, ZP - 0.3, a, alt, ZP + 0.05);
        colisao.parede(x, ZP + 0.05, a, ZP + 0.05, TETO_TERREO);
      }
      x = Math.max(x, b);
    }
    for (const a of op.ancoras) {
      const q = a.inquilino;
      const c = document.createElement("canvas");
      c.width = 2048;
      c.height = 146;
      const g = c.getContext("2d")!;
      g.fillStyle = q.estilo.faixa;
      g.fillRect(0, 0, 2048, 146);
      g.fillStyle = q.estilo.primaria;
      g.fillRect(0, 138, 2048, 8);
      desenharMarca(g, q, 1024, 72, 118);
      const tex = canvasTextura(c);
      const m = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.3, 1.3, 1.3) });
      lixo.push(tex, m);
      grupo.add(placa(m, 14, 1.0, a.cx, alt + (TETO_TERREO - alt) / 2, ZP + 0.08, 0));
    }
  }

  // ---- lounge no meio da praça: canteiro redondo com árvore, sofás lilás em arco
  {
    const { x, z } = LOUNGE;
    const borda = new THREE.LatheGeometry([new THREE.Vector2(1.75, 0), new THREE.Vector2(1.95, 0), new THREE.Vector2(1.95, 0.62), new THREE.Vector2(1.75, 0.62)], 64);
    borda.translate(x, 0, z);
    lotes.adicionar(mat.fachadaBranca, borda, { sombra: true });
    const terra = new THREE.CircleGeometry(1.76, 48);
    terra.rotateX(-Math.PI / 2);
    terra.translate(x, 0.56, z);
    lotes.adicionar(mat.terra, terra);
    arvore(lotes, x, z, 0.56);
    for (const a of [1.2, 4.4]) plantas.push({ tipo: "media", matriz: new THREE.Matrix4().compose(new THREE.Vector3(x + Math.sin(a) * 1.25, 0.56, z + Math.cos(a) * 1.25), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a), new THREE.Vector3(1.6, 1.6, 1.6)) });
    // dois sofás em arco virados para fora, com passagem na frente e atrás
    const perfil = [
      [2.05, 0],
      [2.95, 0],
      [2.95, 0.42],
      [2.4, 0.46],
      [2.36, 0.95],
      [2.05, 0.95],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    for (const ini of [0.42, Math.PI + 0.42]) {
      const comp = Math.PI - 0.84;
      const g = new THREE.LatheGeometry([...perfil, perfil[0]], 28, ini, comp);
      g.translate(x, 0, z);
      lotes.adicionar(mat.tecidoLilas, g, { sombra: true });
      for (const fi of [ini, ini + comp]) {
        const tampa = new THREE.ShapeGeometry(new THREE.Shape(perfil));
        tampa.rotateY(fi - Math.PI / 2);
        tampa.translate(x, 0, z);
        lotes.adicionar(mat.tecidoLilas, tampa);
      }
      // base de madeira escura
      const base = new THREE.LatheGeometry([new THREE.Vector2(2.08, 0), new THREE.Vector2(2.92, 0), new THREE.Vector2(2.92, 0.06), new THREE.Vector2(2.08, 0.06)], 28, ini, comp);
      base.translate(x, 0.0, z);
      lotes.adicionar(mat.metal, base);
    }
    colisao.circulo(x, z, LOUNGE.raio, 1);
  }
  // quiosque roxo com o logo (balcão em arco, tampo branco, LED lilás no pé)
  {
    const { x, z } = QUIOSQUE;
    // em volta, menos uma passagem de 70° atrás (no ângulo π, para o fundo da praça)
    const ini = -Math.PI + 0.62;
    const comp = Math.PI * 2 - 1.24;
    const balcao = new THREE.LatheGeometry([new THREE.Vector2(1.25, 0), new THREE.Vector2(1.55, 0), new THREE.Vector2(1.55, 1.02), new THREE.Vector2(1.25, 1.02), new THREE.Vector2(1.25, 0)], 40, ini, comp);
    balcao.translate(x, 0, z);
    lotes.adicionar(mat.roxo, balcao, { sombra: true });
    const tampo = new THREE.LatheGeometry([new THREE.Vector2(1.18, 1.02), new THREE.Vector2(1.66, 1.02), new THREE.Vector2(1.66, 1.08), new THREE.Vector2(1.18, 1.08), new THREE.Vector2(1.18, 1.02)], 40, ini, comp);
    tampo.translate(x, 0, z);
    lotes.adicionar(mat.fachadaBranca, tampo, { sombra: true });
    const led = new THREE.LatheGeometry([new THREE.Vector2(1.56, 0.04), new THREE.Vector2(1.56, 0.1)], 40, ini, comp);
    led.translate(x, 0, z);
    lotes.adicionar(mat.ledLilas, led);
    // faixa com o logo branco na frente do balcão (virada para a galeria)
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 256;
    const g = c.getContext("2d")!;
    g.fillStyle = COR_SHOPPING.roxo;
    g.fillRect(0, 0, 1024, 256);
    desenharLogoShopping(g, 512, 128, 150, true);
    const tex = canvasTextura(c);
    const m = new THREE.MeshStandardMaterial({ map: tex, emissive: "#ffffff", emissiveMap: tex, emissiveIntensity: 0.35, roughness: 0.35 });
    lixo.push(tex, m);
    const faixa = new THREE.CylinderGeometry(1.565, 1.565, 0.42, 40, 1, true, -0.62, 1.24);
    faixa.translate(x, 0.62, z);
    const malha = new THREE.Mesh(faixa, m);
    grupo.add(malha);
    lixo.push(faixa);
    // vitrine de produtos atrás do balcão
    lotes.caixa(mat.fachadaBranca, 1.2, 1.7, 0.4, x, 0.85, z - 0.75, { sombra: true });
    lotes.caixa(mat.lilas, 1.0, 0.04, 0.32, x, 1.0, z - 0.71);
    lotes.caixa(mat.lilas, 1.0, 0.04, 0.32, x, 1.4, z - 0.71);
    colisao.circulo(x, z, QUIOSQUE.raio, 1.1);
  }

  // ---- vasos grandes e as ilhas da galeria (vaso + dois bancos)
  const vasos: [number, number, number][] = [
    [-9, 37.4, 0.8],
    [9, 37.4, 0.8],
    [-15.4, 27, 0.8],
    [15.4, 27, 0.8],
    [-29.4, ZN - 2.2, 0.9],
    [29.4, ZN - 2.2, 0.9],
    [-21, ZN - 2.2, 0.9],
    [21, ZN - 2.2, 0.9],
  ];
  for (const [x, z, r] of vasos) vaso(lotes, mat, colisao, plantas, x, z, r);
  for (const z of [12, -12]) {
    vaso(lotes, mat, colisao, plantas, 0, z, 1.05);
    banco(lotes, mat, colisao, -2, z, Math.PI / 2);
    banco(lotes, mat, colisao, 2, z, -Math.PI / 2);
  }
  // bancos do saguão
  banco(lotes, mat, colisao, -12.5, 32, Math.PI / 2);
  banco(lotes, mat, colisao, 12.5, 32, -Math.PI / 2);

  // ---- totens com os pisos e o mapa
  const totens: [number, number, number][] = [
    [-6.5, 30.5, 0],
    [5, ZN - 1.6, 0],
  ];
  const tela = canvasTextura(telaTotem(op.ocupadas, op.vagas));
  const matTela = new THREE.MeshBasicMaterial({ map: tela, color: new THREE.Color(1.12, 1.12, 1.12) });
  lixo.push(tela, matTela);
  for (const [x, z, r] of totens) {
    lotes.caixa(mat.fachadaBranca, 1.0, 2.5, 0.3, x, 1.25, z, { sombra: true }, r);
    lotes.caixa(mat.roxo, 1.04, 0.1, 0.34, x, 2.55, z, {}, r);
    lotes.caixa(mat.roxo, 1.04, 0.08, 0.34, x, 0.04, z, {}, r);
    grupo.add(placa(matTela, 0.82, 1.64, x + Math.sin(r) * 0.155, 1.32, z + Math.cos(r) * 0.155, r));
    grupo.add(placa(matTela, 0.82, 1.64, x - Math.sin(r) * 0.155, 1.32, z - Math.cos(r) * 0.155, r + Math.PI));
    colisao.caixa(x - 0.55, z - 0.2, x + 0.55, z + 0.2, 2.6);
    pontos.push({ tipo: "mapa", x, z: z + 1, raio: 1.9, rotulo: textos.dicas.totemMapa });
  }

  // ---- provador (cabine na parede direita do saguão): troca de visual
  {
    const x = MS - 0.2;
    const z = 31.5;
    lotes.bloco(mat.dourado, x - 0.3, 0, z - 1.3, x, 3, z - 1.2);
    lotes.bloco(mat.dourado, x - 0.3, 0, z + 1.2, x, 3, z + 1.3);
    lotes.bloco(mat.dourado, x - 0.3, 2.9, z - 1.3, x, 3.05, z + 1.3);
    const cortina = new THREE.PlaneGeometry(2.4, 2.8, 48, 1);
    const p = cortina.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 9) * 0.05);
    cortina.computeVertexNormals();
    cortina.rotateY(-Math.PI / 2);
    cortina.translate(x - 0.15, 1.45, z);
    lotes.adicionar(mat.tecidoCortina, cortina);
    const { c, g } = canvasSimples(512, 128);
    g.fillStyle = COR_SHOPPING.roxo;
    g.fillRect(0, 0, 512, 128);
    g.fillStyle = "#ffffff";
    g.font = `italic 600 64px ${FONTE_TITULO}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(textos.provador.titulo, 256, 66);
    const tex = canvasTextura(c);
    const m = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.2, 1.2, 1.2) });
    lixo.push(tex, m);
    grupo.add(placa(m, 2, 0.5, x - 0.32, 3.4, z, -Math.PI / 2));
    pontos.push({ tipo: "provador", x: x - 1.4, z, raio: 1.8, rotulo: textos.hud.visual });
  }
  // quadro de boas-vindas na parede esquerda do saguão
  {
    const { c, g } = canvasSimples(1024, 640);
    const grad = g.createLinearGradient(0, 0, 1024, 640);
    grad.addColorStop(0, COR_SHOPPING.roxo);
    grad.addColorStop(1, COR_SHOPPING.ameixa);
    g.fillStyle = grad;
    g.fillRect(0, 0, 1024, 640);
    desenharImagemMarca(g, "folhas-branco", 512, 170, 170);
    desenharImagemMarca(g, "nome-branco", 512, 360, 150);
    g.fillStyle = "rgba(255,255,255,0.85)";
    g.font = `500 34px ${FONTE}`;
    g.textAlign = "center";
    g.fillText(textos.shopping.slogan, 512, 530);
    const tex = canvasTextura(c);
    const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, emissive: "#ffffff", emissiveMap: tex, emissiveIntensity: 0.25 });
    lixo.push(tex, m);
    lotes.bloco(mat.dourado, -MS + 0.0, 1.05, 28.9, -MS + 0.08, 4.05, 34.1);
    grupo.add(placa(m, 4.8, 3, -MS + 0.09, 2.55, 31.5, Math.PI / 2));
  }

  grupo.add(lotes.fechar());
  return {
    grupo,
    pisos,
    pontos,
    plantas,
    atualizar: (t: number, dt: number) => animar.forEach((f) => f(t, dt)),
    descartar: () => {
      lixo.forEach((x) => x.dispose());
      grupo.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    },
  };
}

function canvasSimples(l: number, a: number) {
  const c = document.createElement("canvas");
  c.width = l;
  c.height = a;
  return { c, g: c.getContext("2d")! };
}

/** árvore do lounge: tronco fino e copa em tufos (como um fícus podado) */
function arvore(lotes: Lotes, x: number, z: number, y: number) {
  const tronco = new THREE.CylinderGeometry(0.12, 0.2, 3.2, 10);
  tronco.translate(x, y + 1.6, z);
  lotes.adicionar(copaMats.tronco, tronco, { sombra: true });
  // galhos saindo do tronco para os tufos
  const tufos: [number, number, number, number][] = [
    [0, 4.1, 0, 1.25],
    [0.95, 3.7, 0.35, 0.9],
    [-0.85, 3.8, -0.25, 0.95],
    [0.25, 3.55, -0.95, 0.85],
    [-0.35, 4.75, 0.45, 0.8],
    [0.55, 4.6, -0.45, 0.75],
    [-0.7, 3.4, 0.75, 0.7],
  ];
  for (const [dx, dy, dz, r] of tufos) {
    const rumo = new THREE.Vector3(dx, dy - 2.9, dz);
    const galho = new THREE.CylinderGeometry(0.035, 0.065, rumo.length(), 6);
    galho.translate(0, rumo.length() / 2, 0);
    galho.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), rumo.clone().normalize()));
    galho.translate(x, y + 2.9, z);
    lotes.adicionar(copaMats.tronco, galho);
    // tufo: esfera amassada (relevo de folhinhas), com os vértices soldados para o sombreado sair liso
    const g = esferaSoldada(r, 3);
    const pp = g.attributes.position;
    for (let i = 0; i < pp.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(pp, i);
      const k = 1 + 0.12 * Math.sin(v.x * 11 + v.y * 7 + dx) * Math.cos(v.z * 9 - v.y * 6 + dz) + 0.05 * Math.sin(v.y * 23 + v.x * 17);
      pp.setXYZ(i, v.x * k, v.y * k * 0.85, v.z * k);
    }
    g.computeVertexNormals();
    g.translate(x + dx, y + dy, z + dz);
    lotes.adicionar(copaMats.copa, g, { sombra: true });
  }
}
const copaMats = {
  tronco: new THREE.MeshStandardMaterial({ color: "#6b5440", roughness: 0.9 }),
  copa: new THREE.MeshStandardMaterial({ color: "#5f8f47", roughness: 0.75 }),
};

/** esfera de vértices soldados (o icosaedro do three vem com cada face solta: sairia facetado) */
export function esferaSoldada(r: number, detalhe: number) {
  const g = new THREE.IcosahedronGeometry(r, detalhe);
  g.deleteAttribute("normal");
  g.deleteAttribute("uv");
  return mergeVertices(g);
}

/** banco de madeira com pés de aço; rot = para onde quem senta olha */
export function banco(lotes: Lotes, mat: Materiais, colisao: Colisao, x: number, z: number, rot: number) {
  const g = new THREE.BoxGeometry(2.2, 0.08, 0.55);
  g.translate(0, 0.46, 0);
  g.rotateY(rot);
  g.translate(x, 0, z);
  lotes.adicionar(mat.madeira, g, { sombra: true });
  for (const lx of [-0.9, 0.9]) {
    const p = new THREE.BoxGeometry(0.06, 0.42, 0.5);
    p.translate(lx, 0.21, 0);
    p.rotateY(rot);
    p.translate(x, 0, z);
    lotes.adicionar(mat.metal, p, { sombra: true });
  }
  const c = Math.abs(Math.cos(rot));
  const s = Math.abs(Math.sin(rot));
  const hx = 1.1 * c + 0.28 * s;
  const hz = 1.1 * s + 0.28 * c;
  colisao.caixa(x - hx, z - hz, x + hx, z + hz, 0.5);
}

/** vaso redondo branco com uma planta grande dentro */
export function vaso(lotes: Lotes, mat: Materiais, colisao: Colisao, plantas: LugarPlanta[], x: number, z: number, r: number) {
  const g = new THREE.CylinderGeometry(r, r * 0.86, 0.75, 40);
  g.translate(x, 0.375, z);
  lotes.adicionar(mat.fachadaBranca, g, { sombra: true });
  const t = new THREE.CircleGeometry(r * 0.92, 32);
  t.rotateX(-Math.PI / 2);
  t.translate(x, 0.7, z);
  lotes.adicionar(mat.terra, t);
  const esc = r * 2.4;
  plantas.push({ tipo: "grande", matriz: new THREE.Matrix4().compose(new THREE.Vector3(x, 0.62, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), x * 1.7 + z), new THREE.Vector3(esc, esc, esc)) });
  colisao.circulo(x, z, r + 0.05, 0.8);
}
