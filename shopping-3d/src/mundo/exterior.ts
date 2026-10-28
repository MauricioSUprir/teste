/**
 * O lado de fora do Beauty Shopping, como a foto de referência no fim de
 * tarde: a fachada curva de vidro de três andares entre os pilares roxos, a
 * coroa branca com o logo grande aceso, as alas brancas com janelas acesas e
 * aletas roxas e lilás, a marquise roxa com LED, as portas automáticas, a
 * praça da frente com canteiros, coqueiros e postes acesos, o estacionamento
 * com carros (e alguns passando na rua) e a cidade em volta (cidade.ts) com
 * os morros no horizonte.
 *
 * Quem chega começa na praça da frente; o estacionamento e a cidade são
 * paisagem.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { PLANTA, zFachadaEm } from "../dados/lojas";
import type { Colisao } from "./colisao";
import { Lotes, planoChao } from "./construtor";
import { criarCidade, type Cidade } from "./cidade";
import { bandaFachada, canvasTextura, FONTE, janelasAcesas, desenharLogoShopping } from "./letreiros";
import type { Materiais } from "./materiais";
import type { LugarPlanta } from "./plantas";
import { VAZIO } from "./atrio";
import { esferaSoldada } from "./estrutura";
import { texturasPorcelanato } from "./texturas";
import { corParaTexturas } from "./texturas-shopping";
import { texturasAsfalto } from "./texturas-cidade";

const { meioSaguao: MS, zFachada: ZF, cobertura: COB, zCalcada: ZC, meiaCalcada: MCAL } = PLANTA;
/** o prédio por fora: |x| até 40, do fundo (z = −70) à fachada; cobertura em 17,4 m, platibanda até 18,2 */
const PREDIO = { meia: 40, fundo: -70, telhado: 17.4, platibanda: 18.2 };
/** coroa da fachada (faixa com o logo) e os pilares roxos que a emolduram */
const COROA = { y0: COB + 0.2, y1: 21.8, meia: 18.6 };
/** o quarteirão do shopping (a cidade começa do outro lado das ruas) */
const QUARTEIRAO = { x0: -72, x1: 72, z0: -92, z1: 114 };
const PORTA = { meia: 2.4, altura: 3.4 };

const v2 = (x: number, z: number) => new THREE.Vector2(x, z);

/** pontos da curva da fachada entre x0 e x1 (passo ~0,5 m), deslocados `d` m para fora */
function curva(x0: number, x1: number, d = 0) {
  const n = Math.max(2, Math.ceil(Math.abs(x1 - x0) / 0.5));
  return Array.from({ length: n + 1 }, (_, i) => {
    const x = x0 + ((x1 - x0) * i) / n;
    return v2(x, zFachadaEm(x) + d);
  });
}

/** fita vertical ao longo de pontos (x, z), de y0 a y1, com uv de 0 a 1 em u (ou em metros) */
function fita(pts: THREE.Vector2[], y0: number, y1: number, uv01 = false) {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  let s = 0;
  const comp = pts.reduce((t, p, i) => (i ? t + p.distanceTo(pts[i - 1]) : 0), 0);
  pts.forEach((p, i) => {
    if (i) s += p.distanceTo(pts[i - 1]);
    pos.push(p.x, y0, p.y, p.x, y1, p.y);
    const u = uv01 ? s / comp : s;
    uv.push(u, uv01 ? 0 : y0, u, uv01 ? 1 : y1);
  });
  for (let i = 0; i < pts.length - 1; i++) idx.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function sorteio(semente: number) {
  let s = semente;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

export interface Exterior {
  grupo: THREE.Group;
  cidade: Cidade;
  /** chão de fora (não entra no reflexo do piso de dentro) */
  foraDoReflexo: THREE.Object3D[];
  /** plantas dos canteiros (os modelos de verdade, instanciados junto com os de dentro) */
  plantas: LugarPlanta[];
  /** abre as portas automáticas: k de 0 (fechada) a 1 (aberta) */
  portas: (k: number) => void;
  atualizar: (t: number, dt: number) => void;
  descartar: () => void;
}

export function criarExterior(op: { mat: Materiais; colisao: Colisao; renderer: THREE.WebGLRenderer; celular: boolean }): Exterior {
  const { mat, colisao, celular } = op;
  const grupo = new THREE.Group();
  const lotes = new Lotes();
  const lixo: { dispose: () => void }[] = [];
  const animar: ((t: number, dt: number) => void)[] = [];
  const acaso = sorteio(4242);
  const aniso = Math.min(8, op.renderer.capabilities.getMaxAnisotropy());

  // ---- fachada de vidro (três andares) com caixilhos de aço e a abertura da porta
  const zPorta = zFachadaEm(0);
  for (const [a, b] of [
    [-MS, -PORTA.meia],
    [PORTA.meia, MS],
  ])
    lotes.adicionar(mat.vidro, fita(curva(a, b), 0, COB + 0.2));
  lotes.adicionar(mat.vidro, fita(curva(-PORTA.meia, PORTA.meia), PORTA.altura, COB + 0.2));
  // montantes a cada 1,8 m (na porta, só acima dela), girados com a curva
  for (let x = -MS; x <= MS + 0.01; x += 1.8) {
    const z = zFachadaEm(x);
    const ang = Math.atan2(PLANTA.curvaFachada * (Math.PI / (2 * MS)) * Math.sin((x / MS) * (Math.PI / 2)), 1);
    const y0 = Math.abs(x) < PORTA.meia + 0.05 ? PORTA.altura : 0;
    const g = new THREE.BoxGeometry(0.09, COB + 0.2 - y0, 0.2);
    g.rotateY(ang);
    g.translate(x, (COB + 0.2 + y0) / 2, z - 0.05);
    lotes.adicionar(mat.aco, g);
  }
  for (const y of [PLANTA.piso2 - 0.2, 8.25, PLANTA.piso3 - 0.2, 13.55, COB + 0.1]) lotes.adicionar(mat.aco, fita(curva(-MS, MS, -0.02), y - 0.05, y + 0.05));
  for (const [a, b] of [
    [-MS, -PORTA.meia],
    [PORTA.meia, MS],
  ])
    lotes.adicionar(mat.aco, fita(curva(a, b, -0.02), PORTA.altura - 0.05, PORTA.altura + 0.05));
  // colisão: o vidro todo, menos a porta
  for (const [a, b] of [
    [-MS, -PORTA.meia],
    [PORTA.meia, MS],
  ]) {
    const pts = curva(a, b);
    for (let i = 0; i + 1 < pts.length; i += 2) {
      const q = pts[Math.min(i + 2, pts.length - 1)];
      colisao.parede(pts[i].x, pts[i].y, q.x, q.y, COB);
    }
  }

  // ---- portas automáticas (duas folhas de cada lado, correm para os lados)
  const folhas: { malha: THREE.Group; x0: number; lado: number; corre: number }[] = [];
  for (const lado of [-1, 1]) {
    for (const k of [0, 1]) {
      const g = new THREE.Group();
      const vidro = new THREE.Mesh(new THREE.BoxGeometry(1.18, PORTA.altura - 0.12, 0.03), mat.vidro);
      vidro.position.y = (PORTA.altura - 0.12) / 2;
      const quadro = new THREE.Mesh(
        mergeGeometries([
          new THREE.BoxGeometry(1.2, 0.06, 0.06).translate(0, PORTA.altura - 0.12, 0),
          new THREE.BoxGeometry(1.2, 0.06, 0.06).translate(0, 0.03, 0),
          new THREE.BoxGeometry(0.06, PORTA.altura - 0.12, 0.06).translate(-0.57, (PORTA.altura - 0.12) / 2, 0),
          new THREE.BoxGeometry(0.06, PORTA.altura - 0.12, 0.06).translate(0.57, (PORTA.altura - 0.12) / 2, 0),
        ])!,
        mat.aco
      );
      g.add(vidro, quadro);
      lixo.push(vidro.geometry, quadro.geometry);
      const x0 = lado * (0.6 + k * 1.2);
      g.position.set(x0, 0, zPorta - 0.12 - k * 0.08);
      grupo.add(g);
      folhas.push({ malha: g, x0, lado, corre: 1.15 + k * 1.15 });
    }
  }
  lotes.bloco(mat.aco, -PORTA.meia - 0.05, PORTA.altura - 0.1, zPorta - 0.3, PORTA.meia + 0.05, PORTA.altura + 0.15, zPorta + 0.02);
  // tapete de entrada
  lotes.bloco(mat.pedraEscura, -2.6, 0, zPorta - 1.6, 2.6, 0.012, zPorta + 1.6);

  // ---- pilares roxos e a coroa com o logo
  for (const s of [-1, 1]) {
    const x0 = s * COROA.meia;
    const x1 = s * (COROA.meia + 1.5);
    lotes.bloco(mat.roxo, Math.min(x0, x1), 0, ZF - 0.8, Math.max(x0, x1), COROA.y1 + 0.5, ZF + 1.1, { sombra: true });
    colisao.caixa(Math.min(x0, x1), ZF - 0.8, Math.max(x0, x1), ZF + 1.1, COB);
    // fecha a fresta entre o fim do vidro e o pilar
    colisao.parede(s * MS, ZF, s * COROA.meia, ZF, COB);
    // ripas lilás na frente do pilar
    for (let k = 0; k < 5; k++) {
      const x = s * (COROA.meia + 0.2 + k * 0.28);
      lotes.bloco(k % 2 ? mat.lilas : mat.roxo, x - 0.06, 1.2, ZF + 1.1, x + 0.06, COROA.y1 + 0.2, ZF + 1.32);
    }
  }
  {
    const tex = canvasTextura(bandaFachada(), aniso);
    const m = new THREE.MeshStandardMaterial({ map: tex, emissive: "#ffffff", emissiveMap: tex, emissiveIntensity: 0.55, roughness: 0.45 });
    lixo.push(tex, m);
    const frente = curva(-COROA.meia, COROA.meia, 0.5);
    lotes.adicionar(m, fita(frente, COROA.y0, COROA.y1, true), { sombra: true });
    // tampa de cima e o fundo da coroa
    const atras = curva(-COROA.meia, COROA.meia, -2.4);
    const tampa = new THREE.Shape([...frente.map((p) => v2(p.x, -p.y)), ...atras.reverse().map((p) => v2(p.x, -p.y))]);
    const gt = new THREE.ShapeGeometry(tampa);
    gt.rotateX(-Math.PI / 2);
    gt.translate(0, COROA.y1, 0);
    lotes.adicionar(mat.fachadaBranca, gt);
    const gb = gt.clone();
    gb.translate(0, COROA.y0 - COROA.y1, 0);
    lotes.adicionar(mat.fachadaBranca, gb);
    lotes.adicionar(mat.fachadaBranca, fita(curva(-COROA.meia, COROA.meia, -2.4), COROA.y0, COROA.y1));
    // filete de luz lilás embaixo da coroa
    lotes.adicionar(mat.ledLilas, fita(curva(-COROA.meia, COROA.meia, 0.52), COROA.y0, COROA.y0 + 0.08));
  }

  // ---- marquise roxa sobre a porta, com LED lilás na borda e spots embaixo
  {
    const z0 = zPorta - 0.3;
    const z1 = zPorta + 4.2;
    const y = 4.6;
    lotes.bloco(mat.roxo, -7, y, z0, 7, y + 0.38, z1, { sombra: true });
    lotes.bloco(mat.fachadaBranca, -6.8, y - 0.01, z0 + 0.2, 6.8, y, z1 - 0.2);
    lotes.bloco(mat.ledLilas, -7.02, y + 0.02, z1, 7.02, y + 0.1, z1 + 0.02);
    for (const s of [-1, 1]) lotes.bloco(mat.ledLilas, s * 7, y + 0.02, z0, s * 7.02, y + 0.1, z1);
    for (let x = -5.5; x <= 5.51; x += 2.2) {
      const c = new THREE.CircleGeometry(0.11, 14);
      c.rotateX(Math.PI / 2);
      c.translate(x, y - 0.015, (z0 + z1) / 2);
      lotes.adicionar(mat.luz, c);
    }
    for (const s of [-1, 1]) {
      const col = new THREE.CylinderGeometry(0.13, 0.13, y, 20);
      col.translate(s * 6.5, y / 2, z1 - 0.4);
      lotes.adicionar(mat.roxo, col, { sombra: true });
      colisao.circulo(s * 6.5, z1 - 0.4, 0.2, y);
    }
  }

  // ---- alas brancas: janelas acesas nos três andares, aletas e o logo na ponta
  {
    const tj = canvasTextura(janelasAcesas(), aniso);
    tj.wrapS = THREE.RepeatWrapping;
    const mj = new THREE.MeshStandardMaterial({ map: tj, emissive: "#ffffff", emissiveMap: tj, emissiveIntensity: 0.75, roughness: 0.2, envMapIntensity: 0.8 });
    lixo.push(tj, mj);
    const janela = (x0: number, x1: number, y0: number, y1: number) => {
      const g = new THREE.PlaneGeometry(Math.abs(x1 - x0), y1 - y0);
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setX(i, (uv.getX(i) * Math.abs(x1 - x0)) / 12);
      g.translate((x0 + x1) / 2, (y0 + y1) / 2, ZF + 0.03);
      lotes.adicionar(mj, g);
    };
    const tl = document.createElement("canvas");
    tl.width = 1024;
    tl.height = 300;
    desenharLogoShopping(tl.getContext("2d")!, 512, 150, 250);
    const texLogo = canvasTextura(tl, aniso);
    const ml = new THREE.MeshStandardMaterial({ map: texLogo, transparent: true, emissive: "#ffffff", emissiveMap: texLogo, emissiveIntensity: 0.6, roughness: 0.5 });
    lixo.push(texLogo, ml);
    for (const s of [-1, 1]) {
      const xi = s * (COROA.meia + 1.5);
      const xe = s * PREDIO.meia;
      lotes.bloco(mat.fachadaBranca, Math.min(xi, xe), 0, ZF - 0.4, Math.max(xi, xe), PREDIO.platibanda, ZF, { sombra: true });
      colisao.parede(xi, ZF + 0.05, xe, ZF + 0.05, COB);
      // térreo: vitrines acesas; pisos 2 e 3: faixas de janela até a metade da ala
      const a = s * 21.2;
      janela(Math.min(a, s * 38.6), Math.max(a, s * 38.6), 0.3, 4.4);
      for (const [y0, y1] of [
        [6.3, 9.9],
        [11.6, 15.4],
      ])
        janela(Math.min(a, s * 30), Math.max(a, s * 30), y0, y1);
      // marquise fina e filete de luz sobre as vitrines do térreo
      lotes.bloco(mat.fachadaBranca, Math.min(a, s * 38.6), 4.5, ZF, Math.max(a, s * 38.6), 4.75, ZF + 1.2, { sombra: true });
      lotes.bloco(mat.led, Math.min(a, s * 38.6), 4.49, ZF + 1.1, Math.max(a, s * 38.6), 4.5, ZF + 1.18);
      // aletas verticais roxas e lilás entre a coroa e as janelas
      for (let k = 0; k < 7; k++) {
        const x = s * (COROA.meia + 1.75 + k * 0.22);
        lotes.bloco(k % 2 ? mat.lilas : mat.roxo, x - 0.06, 5.6, ZF, x + 0.06, PREDIO.platibanda - 0.4, ZF + 0.45);
      }
      // logo grande na ponta da ala
      const p = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 2.23), ml);
      p.position.set(s * 34.6, 12.6, ZF + 0.04);
      grupo.add(p);
      lixo.push(p.geometry);
      // laterais e fundo do prédio
      lotes.bloco(mat.fachadaBranca, s * PREDIO.meia - 0.2, 0, PREDIO.fundo, s * PREDIO.meia + 0.2, PREDIO.platibanda, ZF, { sombra: true });
    }
    lotes.bloco(mat.fachadaBranca, -PREDIO.meia, 0, PREDIO.fundo - 0.2, PREDIO.meia, PREDIO.platibanda, PREDIO.fundo + 0.2, { sombra: true });
  }

  // ---- cobertura do prédio por fora (com o furo da claraboia) e as casas de máquinas
  {
    const contorno = [v2(-PREDIO.meia, PREDIO.fundo), v2(PREDIO.meia, PREDIO.fundo), v2(PREDIO.meia, ZF), ...curva(COROA.meia, -COROA.meia, -2.4), v2(-PREDIO.meia, ZF)];
    const forma = new THREE.Shape(contorno.map((p) => v2(p.x, -p.y)));
    forma.holes.push(new THREE.Path(VAZIO.map((p) => v2(p.x, -p.y))));
    const g = new THREE.ShapeGeometry(forma);
    g.rotateX(-Math.PI / 2);
    g.translate(0, PREDIO.telhado, 0);
    lotes.adicionar(mat.concreto, g, { sombra: true });
    for (const [x, z, l, p, a] of [
      [-29, -18, 6, 4, 2.2],
      [28, -10, 5, 6, 1.8],
      [-27, 12, 4, 4, 2.6],
      [30, 16, 6, 3, 1.6],
      [-24, -58, 8, 5, 2.4],
      [24, -60, 6, 6, 2],
    ])
      lotes.caixa(mat.concreto, l, a, p, x, PREDIO.telhado + a / 2, z, { sombra: true });
  }

  // ---- chão de fora: asfalto do quarteirão, a praça da frente em porcelanato e a calçada da rua
  const foraDoReflexo: THREE.Object3D[] = [];
  const pavimento = texturasPorcelanato({ lado: celular ? 512 : 1024, base: corParaTexturas("#d3cac0"), veio: corParaTexturas("#b3a89c"), rejunte: corParaTexturas("#a2978b"), placa: 1.0, veios: 1, semente: 41 });
  for (const t of [pavimento.cor, pavimento.normal, pavimento.rugosidade]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1 / pavimento.metros, 1 / pavimento.metros);
    lixo.push(t);
  }
  const matPraca = new THREE.MeshStandardMaterial({ map: pavimento.cor, normalMap: pavimento.normal, roughnessMap: pavimento.rugosidade, roughness: 1, envMapIntensity: 0.7 });
  const asf = texturasAsfalto(celular ? 512 : 1024, aniso);
  for (const t of [asf.cor, asf.normal, asf.rugosidade]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1 / 5, 1 / 5);
    lixo.push(t);
  }
  const matAsfalto = new THREE.MeshStandardMaterial({ color: "#a9a9ad", map: asf.cor, normalMap: asf.normal, roughnessMap: asf.rugosidade, roughness: 1 });
  const matTinta = new THREE.MeshStandardMaterial({ color: "#eeeeea", roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  lixo.push(matPraca, matAsfalto, matTinta);
  const chao = (m: THREE.Material, x0: number, z0: number, x1: number, z1: number, y: number) => {
    const malha = new THREE.Mesh(planoChao(x0, z0, x1, z1, y), m);
    malha.receiveShadow = true;
    grupo.add(malha);
    lixo.push(malha.geometry);
    foraDoReflexo.push(malha);
  };
  const q = QUARTEIRAO;
  chao(matAsfalto, q.x0, ZF, q.x1, q.z1 - 2, -0.02);
  chao(matAsfalto, q.x0, q.z0, -PREDIO.meia, ZF, -0.02);
  chao(matAsfalto, PREDIO.meia, q.z0, q.x1, ZF, -0.02);
  chao(matAsfalto, -PREDIO.meia, q.z0, PREDIO.meia, PREDIO.fundo, -0.02);
  chao(matPraca, q.x0, q.z1 - 2, q.x1, q.z1, 0.01);
  {
    // praça: da fachada (curva no meio) até a calçada (z = 66)
    const contorno = [v2(-MCAL, ZF), ...curva(-MS, MS), v2(MCAL, ZF), v2(MCAL, ZC), v2(-MCAL, ZC)];
    const forma = new THREE.Shape(contorno.map((p) => v2(p.x, -p.y)));
    const g = new THREE.ShapeGeometry(forma);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0.01, 0);
    const m = new THREE.Mesh(g, matPraca);
    m.receiveShadow = true;
    grupo.add(m);
    lixo.push(g);
    foraDoReflexo.push(m);
    // caminho de pedestres até a faixa da rua
    chao(matPraca, -3.4, ZC, 3.4, q.z1 - 2, 0.012);
  }
  // meio-fio da praça, com balizadores acesos (e a colisão: daqui não se passa)
  lotes.bloco(mat.pedra, -MCAL, 0, ZC - 0.1, MCAL, 0.16, ZC + 0.2);
  colisao.parede(-MCAL, ZC - 0.4, MCAL, ZC - 0.4, 1.2);
  for (const s of [-1, 1]) colisao.parede(s * MCAL, ZF, s * MCAL, ZC - 0.4, 1.2);
  for (let x = -MCAL + 1; x <= MCAL - 0.9; x += 2) {
    if (Math.abs(x) < 3) continue;
    const g = new THREE.CylinderGeometry(0.09, 0.1, 0.9, 12);
    g.translate(x, 0.45, ZC - 0.5);
    lotes.adicionar(mat.metal, g);
    const l = new THREE.CylinderGeometry(0.091, 0.091, 0.06, 12);
    l.translate(x, 0.82, ZC - 0.5);
    lotes.adicionar(mat.luz, l);
  }

  // ---- canteiros da praça (arbustos, flores) e os coqueiros
  const arbustos: THREE.Matrix4[] = [];
  const coresArbusto: THREE.Color[] = [];
  const plantas: LugarPlanta[] = [];
  const VERDES = ["#4f7d3c", "#5d8c45", "#3f6b35", "#6b9a4f"].map((c) => new THREE.Color(c));
  const FLORES = ["#c2408f", "#e07ab8", "#9a5cc8", "#f0f0f0"].map((c) => new THREE.Color(c));
  const canteiro = (x0: number, z0: number, x1: number, z1: number) => {
    lotes.bloco(mat.pedra, x0, 0, z0, x1, 0.55, z1, { sombra: true });
    lotes.bloco(mat.terra, x0 + 0.15, 0.55, z0 + 0.15, x1 - 0.15, 0.56, z1 - 0.15);
    colisao.caixa(x0, z0, x1, z1, 0.8);
    // folhagem de verdade (o mesmo singônio de dentro, grande) e moitas floridas entre elas
    const n = Math.round(((x1 - x0) * (z1 - z0)) / 1.6);
    for (let i = 0; i < n; i++) {
      const x = x0 + 0.45 + acaso() * (x1 - x0 - 0.9);
      const z = z0 + 0.45 + acaso() * (z1 - z0 - 0.9);
      // a folhagem de verdade é pesada (5 mil triângulos): poucas, e moitas no resto
      if (acaso() < 0.12) {
        const e = 1.6 + acaso() * 0.8;
        plantas.push({ tipo: acaso() < 0.5 ? "grande" : "media", matriz: new THREE.Matrix4().compose(new THREE.Vector3(x, 0.5, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), acaso() * 6.3), new THREE.Vector3(e, e, e)) });
        continue;
      }
      const r = 0.28 + acaso() * 0.3;
      arbustos.push(new THREE.Matrix4().compose(new THREE.Vector3(x, 0.55 + r * 0.55, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), acaso() * 6.3), new THREE.Vector3(r, r * 0.8, r)));
      coresArbusto.push(acaso() < 0.55 ? FLORES[Math.floor(acaso() * FLORES.length)] : VERDES[Math.floor(acaso() * VERDES.length)]);
    }
  };
  const coqueiros: [number, number][] = [];
  for (const s of [-1, 1]) {
    canteiro(Math.min(s * 7, s * 20), 50, Math.max(s * 7, s * 20), 56);
    coqueiros.push([s * 10, 53], [s * 17, 53]);
    canteiro(Math.min(s * 22, s * 38.5), ZF + 1.4, Math.max(s * 22, s * 38.5), ZF + 3.2);
    canteiro(Math.min(s * 26, s * 38), 58, Math.max(s * 26, s * 38), 63);
    coqueiros.push([s * 29, 60.5], [s * 35, 60.5], [s * 27, ZF + 2.3], [s * 36, ZF + 2.3]);
  }

  // ---- postes da praça (acesos no fim de tarde)
  for (const [x, z] of [
    [-8, 60],
    [8, 60],
    [-22, 47],
    [22, 47],
    [-22, 60],
    [22, 60],
  ]) {
    const g = new THREE.CylinderGeometry(0.07, 0.09, 4.6, 12);
    g.translate(x, 2.3, z);
    lotes.adicionar(mat.metal, g, { sombra: true });
    const c = new THREE.CylinderGeometry(0.22, 0.22, 0.5, 16);
    c.translate(x, 4.75, z);
    lotes.adicionar(mat.luz, c);
    const t = new THREE.CylinderGeometry(0.3, 0.3, 0.06, 16);
    t.translate(x, 5.03, z);
    lotes.adicionar(mat.metal, t);
    colisao.circulo(x, z, 0.15, 4.6);
  }

  // ---- estacionamento: faixas, ilhas com árvores, postes e os carros
  const vagas: { x: number; z: number; r: number }[] = [];
  const arvores: THREE.Vector3[] = [];
  const LARG_VAGA = 2.6;
  // fileiras: [z da frente da vaga, sentido do carro]
  const fileiras: [number, number][] = [
    [74, 1],
    [84, -1],
    [90.5, 1],
    [100.5, -1],
    [107, 1],
  ];
  for (const [z0, sentido] of fileiras) {
    const zc = z0 + (sentido > 0 ? 2.5 : -2.5);
    for (const s of [-1, 1]) {
      for (let k = 0; k < 24; k++) {
        const x = s * (5.5 + (k + 0.5) * LARG_VAGA);
        if (Math.abs(x) > q.x1 - 3) break;
        if (k % 8 === 7) {
          // ilha com árvore
          arvores.push(new THREE.Vector3(x, 0, zc));
          lotes.bloco(mat.pedra, x - LARG_VAGA / 2 + 0.15, 0, zc - 2.3, x + LARG_VAGA / 2 - 0.15, 0.16, zc + 2.3);
          lotes.bloco(mat.terra, x - LARG_VAGA / 2 + 0.3, 0.16, zc - 2.15, x + LARG_VAGA / 2 - 0.3, 0.17, zc + 2.15);
          continue;
        }
        vagas.push({ x, z: zc, r: sentido > 0 ? Math.PI : 0 });
        // linha entre as vagas
        const xl = x + s * (LARG_VAGA / 2);
        lotes.bloco(matTinta, xl - 0.05, 0, zc - 2.4, xl + 0.05, 0.004, zc + 2.4);
      }
    }
  }
  // faixa de pedestres no caminho da rua até a praça
  for (let z = ZC + 1; z < q.z1 - 3; z += 1.1) lotes.bloco(matTinta, -2.6, 0, z, 2.6, 0.006, z + 0.55);
  // carros parados (uns 55% das vagas) e alguns passando na rua da frente
  const carro = geometriaCarro();
  lixo.push(carro.corpo, carro.vidros, carro.rodas);
  const CORES_CARRO = ["#f2f2f0", "#f2f2f0", "#c9ccd1", "#2b2d31", "#141518", "#7d8188", "#a3262a", "#2c4f8c", "#d9cdb8"].map((c) => new THREE.Color(c));
  const ocupadas = vagas.filter(() => acaso() < (celular ? 0.42 : 0.56));
  const PASSANDO = celular ? 3 : 6;
  const n = ocupadas.length + PASSANDO;
  const matCorpo = new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.55, envMapIntensity: 1.1 });
  const matVidroCarro = new THREE.MeshStandardMaterial({ color: "#1b222b", roughness: 0.08, metalness: 0.6, envMapIntensity: 1.4 });
  const matPneu = new THREE.MeshStandardMaterial({ color: "#151517", roughness: 0.85 });
  lixo.push(matCorpo, matVidroCarro, matPneu);
  const corpos = new THREE.InstancedMesh(carro.corpo, matCorpo, n);
  const vidros = new THREE.InstancedMesh(carro.vidros, matVidroCarro, n);
  const rodas = new THREE.InstancedMesh(carro.rodas, matPneu, n);
  const m4 = new THREE.Matrix4();
  const qy = new THREE.Quaternion();
  const eixoY = new THREE.Vector3(0, 1, 0);
  const um = new THREE.Vector3(1, 1, 1);
  const pos = new THREE.Vector3();
  const colocar = (i: number, x: number, z: number, r: number) => {
    m4.compose(pos.set(x, 0, z), qy.setFromAxisAngle(eixoY, r), um);
    corpos.setMatrixAt(i, m4);
    vidros.setMatrixAt(i, m4);
    rodas.setMatrixAt(i, m4);
  };
  ocupadas.forEach((v, i) => {
    colocar(i, v.x + (acaso() - 0.5) * 0.3, v.z + (acaso() - 0.5) * 0.4, v.r + (acaso() - 0.5) * 0.08);
    corpos.setColorAt(i, CORES_CARRO[Math.floor(acaso() * CORES_CARRO.length)]);
  });
  const naRua = Array.from({ length: PASSANDO }, (_, k) => ({
    x: -150 + acaso() * 300,
    faixa: k % 2,
    vel: 8 + acaso() * 5,
  }));
  naRua.forEach((_, k) => corpos.setColorAt(ocupadas.length + k, CORES_CARRO[Math.floor(acaso() * CORES_CARRO.length)]));
  for (const malha of [corpos, vidros, rodas]) {
    malha.castShadow = true;
    malha.receiveShadow = true;
    malha.frustumCulled = false;
    grupo.add(malha);
    foraDoReflexo.push(malha);
  }
  const zRua = q.z1 + 5;
  animar.push((_t, dt) => {
    naRua.forEach((c, k) => {
      c.x += (c.faixa ? -1 : 1) * c.vel * dt;
      if (c.x > 160) c.x = -160;
      if (c.x < -160) c.x = 160;
      colocar(ocupadas.length + k, c.x, zRua + (c.faixa ? -2.2 : 2.2), c.faixa ? Math.PI / 2 : -Math.PI / 2);
    });
    for (const malha of [corpos, vidros, rodas]) malha.instanceMatrix.needsUpdate = true;
  });
  // árvores das ilhas (copa redonda) e postes altos do estacionamento
  {
    const tronco = new THREE.CylinderGeometry(0.14, 0.2, 2.6, 8).translate(0, 1.3, 0);
    const copa = esferaSoldada(1.9, 2);
    {
      const pp = copa.attributes.position;
      for (let i = 0; i < pp.count; i++) {
        const v = new THREE.Vector3().fromBufferAttribute(pp, i);
        const k = 1 + 0.1 * Math.sin(v.x * 4.1 + v.y * 3.3) * Math.cos(v.z * 3.7 - v.y * 2.1);
        pp.setXYZ(i, v.x * k, v.y * k * 0.85, v.z * k);
      }
      copa.computeVertexNormals();
      copa.translate(0, 3.6, 0);
    }
    const matTronco = new THREE.MeshStandardMaterial({ color: "#6b5440", roughness: 0.9 });
    const matCopa = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.8 });
    lixo.push(tronco, copa, matTronco, matCopa);
    const it = new THREE.InstancedMesh(tronco, matTronco, arvores.length);
    const ic = new THREE.InstancedMesh(copa, matCopa, arvores.length);
    arvores.forEach((p, i) => {
      const e = 0.85 + acaso() * 0.35;
      m4.compose(p, qy.setFromAxisAngle(eixoY, acaso() * 6), new THREE.Vector3(e, e, e));
      it.setMatrixAt(i, m4);
      ic.setMatrixAt(i, m4);
      ic.setColorAt(i, VERDES[Math.floor(acaso() * VERDES.length)]);
    });
    for (const m of [it, ic]) {
      m.castShadow = true;
      m.receiveShadow = true;
      grupo.add(m);
      foraDoReflexo.push(m);
    }
    arvores.forEach((p, i) => {
      if (i % 3) return;
      const g = new THREE.CylinderGeometry(0.09, 0.12, 7.5, 10);
      g.translate(p.x, 3.75, p.z + 1.6);
      lotes.adicionar(mat.metal, g);
      lotes.bloco(mat.metal, p.x - 0.5, 7.4, p.z + 1.45, p.x + 0.5, 7.55, p.z + 1.75);
      lotes.bloco(mat.luz, p.x - 0.45, 7.39, p.z + 1.5, p.x + 0.45, 7.4, p.z + 1.7);
    });
  }
  // arbustos de todos os canteiros: uma malha instanciada só
  {
    const geo = esferaSoldada(1, 2);
    // relevo de folhinhas: amassa a esfera um pouco, ponto a ponto
    const pp = geo.attributes.position;
    for (let i = 0; i < pp.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(pp, i);
      const k = 1 + 0.1 * Math.sin(v.x * 9.1 + v.y * 7.3) * Math.cos(v.z * 8.7 - v.y * 5.1);
      pp.setXYZ(i, v.x * k, v.y * k, v.z * k);
    }
    geo.computeVertexNormals();
    const m = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.8 });
    lixo.push(geo, m);
    const im = new THREE.InstancedMesh(geo, m, arbustos.length);
    arbustos.forEach((a, i) => {
      im.setMatrixAt(i, a);
      im.setColorAt(i, coresArbusto[i]);
    });
    im.castShadow = true;
    im.receiveShadow = true;
    grupo.add(im);
    foraDoReflexo.push(im);
  }

  // ---- a cidade em volta (céu de fim de tarde, ruas, prédios, morros)
  const cidade = criarCidade({ renderer: op.renderer, quarteirao: q, leve: celular, fonte: FONTE, coqueiros });
  grupo.add(cidade.grupo);
  foraDoReflexo.push(cidade.grupo);

  grupo.add(lotes.fechar());
  return {
    grupo,
    cidade,
    foraDoReflexo,
    plantas,
    portas: (k) => {
      const e = THREE.MathUtils.smoothstep(k, 0, 1);
      for (const f of folhas) f.malha.position.x = f.x0 + f.lado * f.corre * e;
    },
    atualizar: (t, dt) => animar.forEach((f) => f(t, dt)),
    descartar: () => {
      cidade.descartar();
      lixo.forEach((x) => x.dispose());
      grupo.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    },
  };
}

/** carro genérico (4,4 × 1,8 m): lataria com cantos arredondados, vidros escuros e rodas; frente para +x */
function geometriaCarro() {
  const perfil = new THREE.Shape([v2(-2.2, 0.3), v2(2.2, 0.3), v2(2.24, 0.6), v2(2.02, 0.84), v2(0.9, 0.93), v2(-1.7, 0.96), v2(-2.18, 0.86)]);
  const lataria = new THREE.ExtrudeGeometry(perfil, { depth: 1.66, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.06, bevelSegments: 2, curveSegments: 4 });
  lataria.translate(0, 0, -0.83);
  const teto = new THREE.BoxGeometry(1.45, 0.06, 1.42).translate(-0.55, 1.46, 0);
  const cabine = new THREE.Shape([v2(0.86, 0.92), v2(-1.62, 0.96), v2(-1.28, 1.44), v2(0.18, 1.46)]);
  const vidros = new THREE.ExtrudeGeometry(cabine, { depth: 1.5, bevelEnabled: false });
  vidros.translate(0, 0, -0.75);
  const rodas = mergeGeometries(
    [-1.38, 1.38].flatMap((x) =>
      [-0.84, 0.84].map((z) =>
        new THREE.CylinderGeometry(0.33, 0.33, 0.24, 14)
          .rotateX(Math.PI / 2)
          .translate(x, 0.33, z)
          .toNonIndexed()
      )
    )
  )!;
  const corpo = mergeGeometries([lataria, teto.toNonIndexed()])!;
  // gira para o carro ficar ao longo de z (as vagas são em z); a frente aponta para +z
  for (const g of [corpo, vidros, rodas]) g.rotateY(-Math.PI / 2);
  return { corpo, vidros, rodas };
}
