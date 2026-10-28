/**
 * O prédio do shopping (sem as lojas): galeria com claraboia em abóbada,
 * varanda do 2º piso com guarda-corpo de vidro, entrada de vidro, a Praça da
 * Beleza com fonte e telão de LED, bancos, vasos, totens e o provador.
 */
import * as THREE from "three";
import { PLANTA, type Inquilino } from "../dados/lojas";
import { textos } from "../copy/textos";
import type { Colisao } from "./colisao";
import { Lotes, planoChao, planoTeto, placa } from "./construtor";
import { canvasTextura, COR_SHOPPING, desenharLed, desenharLogoShopping, desenharMarca, FONTE, letreiroEntrada, telaTotem } from "./letreiros";
import type { Materiais } from "./materiais";
import { texturaCeu, texturaNuvens } from "./texturas-shopping";
import type { LugarPlanta } from "./plantas";

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

const { meioCorredor: MC, zEntrada: ZE, zLojasNorte: ZN, zPraca: ZP, meiaPraca: MP, tetoGaleria: TG, piso2: P2, varanda: VA } = PLANTA;
const ESP_LAJE = 0.35;
/** abóbada da claraboia: de x = −5 a 5, sobe 2 m acima do teto */
const ABOBADA = { meia: 5, flecha: 2 };

export function criarEstrutura(op: OpcoesEstrutura) {
  const { mat, colisao } = op;
  const grupo = new THREE.Group();
  const lotes = new Lotes();
  const pontos: PontoInteracao[] = [];
  const plantas: LugarPlanta[] = [];
  const animar: ((t: number, dt: number) => void)[] = [];
  const lixo: { dispose: () => void }[] = [];

  // ---- pisos
  const pisos: THREE.Mesh[] = [];
  const pisoGaleria = new THREE.Mesh(planoChao(-MC, ZN, MC, ZE), mat.pisoGaleria);
  const pisoPraca = new THREE.Mesh(planoChao(-MP, ZP, MP, ZN), mat.pisoGaleria);
  for (const p of [pisoGaleria, pisoPraca]) {
    p.receiveShadow = true;
    grupo.add(p);
    pisos.push(p);
  }
  // faixa de pedra escura no meio do corredor (desenho do piso)
  for (const x of [-2.6, 2.6]) lotes.bloco(mat.pedraEscura, x - 0.06, 0, ZN, x + 0.06, 0.004, ZE - 1);

  // ---- paredes da entrada (|x| = 8, de z = 24 a 36) e fachada de vidro (z = 36)
  for (const s of [-1, 1]) {
    lotes.bloco(mat.gesso, s * MC, 0, PLANTA.zLojasSul, s * (MC + 0.3), P2, ZE);
    colisao.parede(s * MC, PLANTA.zLojasSul, s * MC, ZE, TG);
    // painel ripado de madeira
    for (let z = PLANTA.zLojasSul + 0.8; z < ZE - 0.6; z += 0.24) lotes.bloco(mat.madeira, s * (MC - 0.06), 0.3, z, s * MC, 4.6, z + 0.12);
  }
  // fachada de vidro jateado com portas no meio
  lotes.bloco(mat.vidroFosco, -MC, 3.4, ZE, MC, TG, ZE + 0.05);
  lotes.bloco(mat.vidroFosco, -MC, 0, ZE, -2.2, 3.4, ZE + 0.05);
  lotes.bloco(mat.vidroFosco, 2.2, 0, ZE, MC, 3.4, ZE + 0.05);
  for (let x = -MC; x <= MC + 0.01; x += 2) lotes.bloco(mat.metal, x - 0.05, 0, ZE - 0.08, x + 0.05, TG, ZE);
  for (const y of [3.4, 6.9]) lotes.bloco(mat.metal, -MC, y - 0.06, ZE - 0.08, MC, y + 0.06, ZE);
  // portas de correr (fechadas: o passeio é dentro)
  lotes.bloco(mat.vidro, -2.2, 0, ZE - 0.12, 0, 3.4, ZE - 0.1);
  lotes.bloco(mat.vidro, 0, 0, ZE - 0.16, 2.2, 3.4, ZE - 0.14);
  lotes.bloco(mat.metal, -0.04, 0, ZE - 0.2, 0.04, 3.4, ZE - 0.08);
  lotes.bloco(mat.luz, -2.2, 3.4, ZE - 0.2, 2.2, 3.5, ZE - 0.08);
  colisao.parede(-MC, ZE - 0.3, MC, ZE - 0.3, TG);
  // letreiro do shopping por dentro, acima das portas
  {
    const tex = canvasTextura(letreiroEntrada());
    lixo.push(tex);
    const fundo = new THREE.MeshStandardMaterial({ color: COR_SHOPPING.ameixa, roughness: 0.5 });
    lixo.push(fundo);
    lotes.bloco(fundo, -4.4, 4.1, ZE - 0.3, 4.4, 6.3, ZE - 0.1);
    const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, color: new THREE.Color(1.5, 1.5, 1.5) });
    lixo.push(m);
    grupo.add(placa(m, 8.4, 2.1, 0, 5.2, ZE - 0.32, Math.PI));
  }

  // ---- varanda do 2º piso (laje, luzes embaixo, guarda-corpo de vidro) e fachadas de cima
  for (const s of [-1, 1]) {
    lotes.bloco(mat.pedra, s * VA, P2, ZN, s * MC, P2 + ESP_LAJE, ZE - 0.3, { sombra: true });
    // filete de luz na borda da laje
    lotes.bloco(mat.luzQuente, s * (VA - 0.01), P2 + 0.05, ZN, s * (VA + 0.01), P2 + 0.09, ZE - 0.3);
    for (let z = ZN + 1.5; z < ZE - 0.5; z += 3) {
      const g = new THREE.CircleGeometry(0.09, 16);
      g.rotateX(Math.PI / 2);
      g.translate(s * 6.8, P2 - 0.005, z);
      lotes.adicionar(mat.luz, g);
    }
    lotes.bloco(mat.vidro, s * VA, P2 + ESP_LAJE, ZN, s * (VA + 0.02), P2 + 1.4, ZE - 0.3);
    lotes.bloco(mat.aco, s * (VA - 0.03), P2 + 1.4, ZN, s * (VA + 0.05), P2 + 1.46, ZE - 0.3);
    for (let z = ZN; z < ZE; z += 1.5) lotes.bloco(mat.aco, s * (VA - 0.015), P2 + ESP_LAJE, z - 0.02, s * (VA + 0.035), P2 + 1.4, z + 0.02);
    // parede de cima com vitrines acesas do 2º piso
    lotes.bloco(mat.gesso, s * MC, P2 + ESP_LAJE, ZN, s * (MC + 0.3), TG, ZE - 0.3);
    for (let z1 = PLANTA.zLojasSul + 12; z1 > ZN; z1 -= PLANTA.frente) {
      const z0 = z1 - PLANTA.frente;
      lotes.bloco(mat.vidroFosco, s * (MC - 0.02), P2 + 0.75, z0 + 1.2, s * (MC - 0.01), TG - 1.2, z1 - 1.2);
      lotes.bloco(mat.metal, s * (MC - 0.06), P2 + 0.7, z0 + 1.15, s * MC, P2 + 0.75, z1 - 1.15);
      lotes.bloco(mat.metal, s * (MC - 0.06), TG - 1.2, z0 + 1.15, s * MC, TG - 1.15, z1 - 1.15);
    }
  }
  // placa "2º piso em breve" na varanda
  {
    const { c, g } = canvasSimples(1024, 128);
    g.fillStyle = COR_SHOPPING.ameixa;
    g.fillRect(0, 0, 1024, 128);
    g.fillStyle = "#ffffff";
    g.font = `600 56px ${FONTE}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("2º PISO · NOVAS LOJAS EM BREVE", 512, 66);
    const tex = canvasTextura(c);
    const m = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.3, 1.3, 1.3) });
    lixo.push(tex, m);
    for (const s of [-1, 1]) grupo.add(placa(m, 5, 0.62, s * (VA - 0.05), P2 + 0.85, 6, s > 0 ? -Math.PI / 2 : Math.PI / 2));
  }

  // ---- teto e claraboia da galeria
  for (const s of [-1, 1]) lotes.adicionar(mat.teto, planoTeto(s > 0 ? ABOBADA.meia : -MC, ZN, s > 0 ? MC : -ABOBADA.meia, ZE, TG));
  {
    const R = (ABOBADA.meia ** 2 + ABOBADA.flecha ** 2) / (2 * ABOBADA.flecha);
    const yc = TG + ABOBADA.flecha - R;
    const ang = Math.asin(ABOBADA.meia / R);
    const N = 14;
    const pontoArco = (k: number) => {
      const a = -ang + (2 * ang * k) / N;
      return [R * Math.sin(a), yc + R * Math.cos(a)] as const;
    };
    // vidro: uma faixa curva de ponta a ponta
    const pos: number[] = [];
    const idx: number[] = [];
    for (let k = 0; k <= N; k++) {
      const [x, y] = pontoArco(k);
      pos.push(x, y, ZN, x, y, ZE - 0.3);
    }
    for (let k = 0; k < N; k++) idx.push(k * 2, k * 2 + 1, k * 2 + 2, k * 2 + 1, k * 2 + 3, k * 2 + 2);
    const gv = new THREE.BufferGeometry();
    gv.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    gv.setIndex(idx);
    gv.computeVertexNormals();
    lotes.adicionar(mat.vidroCeu, gv);
    // arcos de aço a cada 3 m e travessas ao longo
    for (let z = ZN; z <= ZE - 0.2; z += 3) {
      for (let k = 0; k < N; k++) {
        const [x0, y0] = pontoArco(k);
        const [x1, y1] = pontoArco(k + 1);
        const l = Math.hypot(x1 - x0, y1 - y0);
        const g = new THREE.BoxGeometry(l + 0.02, 0.12, 0.1);
        g.rotateZ(Math.atan2(y1 - y0, x1 - x0));
        g.translate((x0 + x1) / 2, (y0 + y1) / 2 - 0.05, z);
        lotes.adicionar(mat.aco, g, { sombra: true });
      }
    }
    for (let k = 0; k <= N; k += 2) {
      const [x, y] = pontoArco(k);
      const g = new THREE.BoxGeometry(0.06, 0.06, ZE - 0.3 - ZN);
      g.translate(x, y - 0.04, (ZN + ZE - 0.3) / 2);
      lotes.adicionar(mat.aco, g, { sombra: true });
    }
    // vigas de borda da abóbada
    for (const s of [-1, 1]) lotes.bloco(mat.pedra, s * (ABOBADA.meia - 0.2), TG - 0.4, ZN, s * (ABOBADA.meia + 0.2), TG + 0.05, ZE - 0.3, { sombra: true });
    // empenas de vidro nas pontas da abóbada
    for (const z of [ZN, ZE - 0.3]) {
      const forma = new THREE.Shape();
      forma.moveTo(-ABOBADA.meia, TG);
      for (let k = 0; k <= N; k++) {
        const [x, y] = pontoArco(k);
        forma.lineTo(x, y);
      }
      const g = new THREE.ShapeGeometry(forma);
      g.translate(0, 0, z);
      lotes.adicionar(mat.vidroCeu, g);
    }
  }

  // ---- Praça da Beleza (norte): paredes, teto com claraboia, telão, fonte
  for (const s of [-1, 1]) {
    lotes.bloco(mat.gesso, s * MP, 0, ZP, s * (MP + 0.3), TG, ZN);
    colisao.parede(s * MP, ZP, s * MP, ZN, TG);
    // parede entre a praça e as lojas do fundo (de |x| = 8 a 16)
    lotes.bloco(mat.gesso, s * MC, 0, ZN - 0.3, s * MP, TG, ZN);
    colisao.parede(s * MC, ZN - 0.3, s * MP, ZN - 0.3, TG);
    // ripado de madeira nas laterais da praça
    for (let z = ZP + 1; z < ZN - 1; z += 0.24) lotes.bloco(mat.madeira, s * (MP - 0.06), 0.3, z, s * MP, 4.4, z + 0.12);
  }
  // fundo da praça: as fachadas das âncoras até o teto delas; daí para cima, parede com os letreiros e o telão
  {
    const alt = Math.max(...op.ancoras.map((a) => a.altura));
    lotes.bloco(mat.gesso, -MP, alt, ZP - 0.3, MP, TG, ZP);
    // vãos entre as âncoras e nas pontas, do chão até a altura delas
    const faixas = op.ancoras.map((a) => [a.cx - a.largura / 2, a.cx + a.largura / 2]).sort((a, b) => a[0] - b[0]);
    let x = -MP;
    for (const [a, b] of [...faixas, [MP, MP]]) {
      if (a - x > 0.01) {
        lotes.bloco(mat.pedra, x, 0, ZP - 0.3, a, alt, ZP + 0.05);
        colisao.parede(x, ZP + 0.05, a, ZP + 0.05, TG);
      }
      x = Math.max(x, b);
    }
    // letreiro grande de cada âncora, aceso, na parede acima da fachada
    for (const a of op.ancoras) {
      const q = a.inquilino;
      const c = document.createElement("canvas");
      c.width = 2048;
      c.height = 200;
      const g = c.getContext("2d")!;
      g.fillStyle = q.estilo.faixa;
      g.fillRect(0, 0, 2048, 200);
      g.fillStyle = q.estilo.primaria;
      g.fillRect(0, 190, 2048, 10);
      desenharMarca(g, q, 1024, 98, 160);
      const tex = canvasTextura(c);
      const m = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.3, 1.3, 1.3) });
      lixo.push(tex, m);
      lotes.bloco(mat.metal, a.cx - 7.15, alt + 0.3, ZP + 0.0, a.cx + 7.15, alt + 1.85, ZP + 0.12);
      grupo.add(placa(m, 14, 1.37, a.cx, alt + 1.075, ZP + 0.125, 0));
    }
  }
  {
    // teto com abertura de 20 × 10 m e grelha de vigas
    const ax = 14;
    const az0 = ZP + 4;
    const az1 = ZN - 4;
    lotes.adicionar(mat.teto, planoTeto(-MP, ZP, MP, az0, TG));
    lotes.adicionar(mat.teto, planoTeto(-MP, az1, MP, ZN, TG));
    lotes.adicionar(mat.teto, planoTeto(-MP, az0, -ax, az1, TG));
    lotes.adicionar(mat.teto, planoTeto(ax, az0, MP, az1, TG));
    lotes.bloco(mat.vidroCeu, -ax, TG + 0.6, az0, ax, TG + 0.62, az1);
    for (let x = -ax; x <= ax + 0.01; x += 2) lotes.bloco(mat.aco, x - 0.05, TG, az0, x + 0.05, TG + 0.6, az1, { sombra: true });
    for (let z = az0; z <= az1 + 0.01; z += 2) lotes.bloco(mat.aco, -ax, TG, z - 0.05, ax, TG + 0.6, z + 0.05, { sombra: true });
  }
  // telão de LED na parede do fundo
  {
    const L = 1024;
    const A = 330;
    const { c, g } = canvasSimples(L, A);
    const tex = canvasTextura(c);
    const m = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.35, 1.35, 1.35), toneMapped: true });
    lixo.push(tex, m);
    // em cima, entre os letreiros das âncoras
    lotes.bloco(mat.metal, -6.6, 6.55, ZP + 0.0, 6.6, 10.2, ZP + 0.25);
    grupo.add(placa(m, 13, 13 * (A / L), 0, 8.375, ZP + 0.27, 0));
    let ultimo = -1;
    animar.push((t) => {
      if (t - ultimo < 0.2) return;
      ultimo = t;
      desenharLed(g, L, A, t, op.ocupadas);
      tex.needsUpdate = true;
    });
  }
  // fonte com escultura de anéis dourados
  {
    const fx = 0;
    const fz = (ZP + ZN) / 2 + 1;
    const borda = new THREE.LatheGeometry(
      [new THREE.Vector2(3.1, 0.12), new THREE.Vector2(3.1, 0.55), new THREE.Vector2(3.2, 0.6), new THREE.Vector2(3.5, 0.6), new THREE.Vector2(3.55, 0.55), new THREE.Vector2(3.55, 0)],
      64
    );
    borda.translate(fx, 0, fz);
    lotes.adicionar(mat.pedra, borda, { sombra: true });
    const fundo = new THREE.CircleGeometry(3.1, 48);
    fundo.rotateX(-Math.PI / 2);
    fundo.translate(fx, 0.1, fz);
    lotes.adicionar(mat.pedraEscura, fundo);
    const agua = new THREE.Mesh(new THREE.CircleGeometry(3.1, 48).rotateX(-Math.PI / 2).translate(fx, 0.44, fz), mat.agua);
    agua.receiveShadow = true;
    grupo.add(agua);
    lixo.push(agua.geometry);
    const ped = new THREE.CylinderGeometry(0.45, 0.6, 1.2, 32);
    ped.translate(fx, 0.6, fz);
    lotes.adicionar(mat.pedra, ped, { sombra: true });
    const aneis = new THREE.Group();
    aneis.position.set(fx, 2.5, fz);
    [0, 1, 2].forEach((i) => {
      const t = new THREE.Mesh(new THREE.TorusGeometry(1 - i * 0.18, 0.055, 16, 96), mat.dourado);
      t.rotation.set(Math.PI / 2 + i * 0.7, i * 1.1, 0);
      t.castShadow = true;
      lixo.push(t.geometry);
      aneis.add(t);
    });
    grupo.add(aneis);
    // jatos em arco da borda para o meio
    const jatos: THREE.Mesh[] = [];
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const p0 = new THREE.Vector3(fx + Math.cos(a) * 2.9, 0.55, fz + Math.sin(a) * 2.9);
      const p2 = new THREE.Vector3(fx + Math.cos(a) * 0.7, 0.45, fz + Math.sin(a) * 0.7);
      const p1 = p0.clone().lerp(p2, 0.5).setY(1.9);
      const curva = new THREE.QuadraticBezierCurve3(p0, p1, p2);
      const m = new THREE.Mesh(new THREE.TubeGeometry(curva, 24, 0.035, 6, false), mat.jato);
      lixo.push(m.geometry);
      jatos.push(m);
      grupo.add(m);
    }
    const normal = mat.agua.normalMap!;
    animar.push((t) => {
      aneis.rotation.y = t * 0.15;
      normal.offset.set(t * 0.02, t * 0.013);
      jatos.forEach((j, i) => (j.scale.y = 1 + Math.sin(t * 3 + i) * 0.015));
    });
    colisao.circulo(fx, fz, 3.6, 0.6);
    // bancos em volta
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + (k * Math.PI) / 2;
      banco(lotes, mat, colisao, fx + Math.cos(a) * 6.2, fz + Math.sin(a) * 6.2, -a + Math.PI / 2);
    }
  }
  // vasos grandes
  const vasos: [number, number, number][] = [
    [-6.4, 33.2, 0.8],
    [6.4, 33.2, 0.8],
    [-29.4, ZN - 2.2, 0.9],
    [29.4, ZN - 2.2, 0.9],
    [-20.5, ZN - 2.2, 0.9],
    [20.5, ZN - 2.2, 0.9],
  ];
  for (const [x, z, r] of vasos) vaso(lotes, mat, colisao, plantas, x, z, r);
  // ilhas no meio do corredor: vaso + dois bancos
  for (const z of [12, -12]) {
    vaso(lotes, mat, colisao, plantas, 0, z, 1.05);
    banco(lotes, mat, colisao, -2, z, Math.PI / 2);
    banco(lotes, mat, colisao, 2, z, -Math.PI / 2);
  }

  // ---- totens com o mapa
  const totens: [number, number, number][] = [
    [-4.4, 28.4, 0],
    [5, ZN - 1.6, 0],
  ];
  const tela = canvasTextura(telaTotem(op.ocupadas, op.vagas));
  const matTela = new THREE.MeshBasicMaterial({ map: tela, color: new THREE.Color(1.25, 1.25, 1.25) });
  const corTotem = new THREE.MeshStandardMaterial({ color: COR_SHOPPING.ameixa, roughness: 0.35, metalness: 0.2 });
  lixo.push(tela, matTela, corTotem);
  for (const [x, z, r] of totens) {
    lotes.caixa(corTotem, 0.9, 2.3, 0.28, x, 1.15, z, { sombra: true }, r);
    lotes.caixa(mat.dourado, 0.92, 0.04, 0.3, x, 2.3, z, {}, r);
    const t = placa(matTela, 0.76, 1.52, x + Math.sin(r) * 0.145, 1.3, z + Math.cos(r) * 0.145, r);
    grupo.add(t);
    const t2 = placa(matTela, 0.76, 1.52, x - Math.sin(r) * 0.145, 1.3, z - Math.cos(r) * 0.145, r + Math.PI);
    grupo.add(t2);
    colisao.caixa(x - 0.5, z - 0.2, x + 0.5, z + 0.2, 2.3);
    pontos.push({ tipo: "mapa", x, z: z + 1, raio: 1.9, rotulo: textos.dicas.totemMapa });
  }

  // ---- provador (cabine na parede direita da entrada): troca de visual
  {
    const x = MC - 0.2;
    const z = 30;
    lotes.bloco(mat.dourado, x - 0.3, 0, z - 1.3, x, 3, z - 1.2);
    lotes.bloco(mat.dourado, x - 0.3, 0, z + 1.2, x, 3, z + 1.3);
    lotes.bloco(mat.dourado, x - 0.3, 2.9, z - 1.3, x, 3.05, z + 1.3);
    // cortina com dobras
    const cortina = new THREE.PlaneGeometry(2.4, 2.8, 48, 1);
    const p = cortina.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 9) * 0.05);
    cortina.computeVertexNormals();
    cortina.rotateY(-Math.PI / 2);
    cortina.translate(x - 0.15, 1.45, z);
    lotes.adicionar(mat.tecidoCortina, cortina);
    const { c, g } = canvasSimples(512, 128);
    g.fillStyle = COR_SHOPPING.ameixa;
    g.fillRect(0, 0, 512, 128);
    g.fillStyle = "#ffffff";
    g.font = `italic 600 64px 'Playfair Display', Georgia, serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(textos.provador.titulo, 256, 66);
    const tex = canvasTextura(c);
    const m = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.2, 1.2, 1.2) });
    lixo.push(tex, m);
    grupo.add(placa(m, 2, 0.5, x - 0.32, 3.4, z, -Math.PI / 2));
    pontos.push({ tipo: "provador", x: x - 1.4, z, raio: 1.8, rotulo: textos.hud.visual });
  }
  // quadro de boas-vindas na parede esquerda da entrada
  {
    const { c, g } = canvasSimples(1024, 640);
    const grad = g.createLinearGradient(0, 0, 1024, 640);
    grad.addColorStop(0, COR_SHOPPING.ameixa);
    grad.addColorStop(1, "#6b3a7d");
    g.fillStyle = grad;
    g.fillRect(0, 0, 1024, 640);
    desenharLogoShopping(g, 512, 270, 300, "#ffffff", COR_SHOPPING.rose);
    g.fillStyle = "rgba(255,255,255,0.85)";
    g.font = `500 34px ${FONTE}`;
    g.textAlign = "center";
    g.fillText(textos.shopping.slogan, 512, 520);
    const tex = canvasTextura(c);
    const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, emissive: "#ffffff", emissiveMap: tex, emissiveIntensity: 0.25 });
    lixo.push(tex, m);
    lotes.bloco(mat.dourado, -MC + 0.0, 1.05, 27.4, -MC + 0.08, 4.05, 32.6);
    grupo.add(placa(m, 4.8, 3, -MC + 0.09, 2.55, 30, Math.PI / 2));
  }

  // ---- céu (visto pela claraboia e pela porta)
  const ceuTex = texturaCeu();
  const ceu = new THREE.Mesh(new THREE.SphereGeometry(420, 32, 16), new THREE.MeshBasicMaterial({ map: ceuTex, side: THREE.BackSide, depthWrite: false, fog: false }));
  const nuvensTex = texturaNuvens(7);
  nuvensTex.repeat.set(3, 1);
  const nuvens = new THREE.Mesh(
    new THREE.SphereGeometry(400, 32, 12, 0, Math.PI * 2, 0, Math.PI * 0.47),
    new THREE.MeshBasicMaterial({ map: nuvensTex, transparent: true, side: THREE.BackSide, depthWrite: false, fog: false, opacity: 0.9 })
  );
  ceu.renderOrder = -2;
  nuvens.renderOrder = -1;
  grupo.add(ceu, nuvens);
  lixo.push(ceuTex, nuvensTex, ceu.geometry, nuvens.geometry, ceu.material as THREE.Material, nuvens.material as THREE.Material);
  animar.push((t) => (nuvensTex.offset.x = t * 0.0015));

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

/** vaso redondo de concreto com uma planta grande dentro */
export function vaso(lotes: Lotes, mat: Materiais, colisao: Colisao, plantas: LugarPlanta[], x: number, z: number, r: number) {
  const g = new THREE.CylinderGeometry(r, r * 0.86, 0.75, 40);
  g.translate(x, 0.375, z);
  lotes.adicionar(mat.concreto, g, { sombra: true });
  const t = new THREE.CircleGeometry(r * 0.92, 32);
  t.rotateX(-Math.PI / 2);
  t.translate(x, 0.7, z);
  lotes.adicionar(mat.terra, t);
  const esc = r * 2.4;
  plantas.push({ tipo: "grande", matriz: new THREE.Matrix4().compose(new THREE.Vector3(x, 0.62, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), x * 1.7 + z), new THREE.Vector3(esc, esc, esc)) });
  colisao.circulo(x, z, r + 0.05, 0.8);
}
