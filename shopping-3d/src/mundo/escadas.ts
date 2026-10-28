/**
 * Escadas rolantes e elevador panorâmico do átrio, com acabamento de verdade.
 *
 * Escada rolante: degraus de alumínio (pisada com frisos e a faixa amarela,
 * espelho frisado) que sobem ou descem de fato — cada degrau anda pelo
 * perfil, deitado nos patamares e em escada na rampa, e some no pente das
 * pontas —, saia e deck de inox escovado dos dois lados dos degraus, vidro,
 * corrimão de borracha que faz a curva nas pontas, LED quente iluminando os
 * degraus, chapa xadrez no piso das pontas e a treliça branca por baixo.
 *
 * Elevador: torre de vidro com montantes de inox, base de granito, portas de
 * vidro com moldura de inox em cada andar e o mostrador do andar; a cabine
 * tem piso de granito, corrimão, painel de botões, teto com luz, cabos e o
 * contrapeso que desce quando ela sobe.
 *
 * Os degraus de todas as escadas são duas malhas instanciadas (pisada e
 * espelho): uma chamada de desenho cada, atualizadas a cada quadro.
 */
import * as THREE from "three";
import { Lotes, uvEmMetros } from "./construtor";
import type { Materiais } from "./materiais";
import { canvasTextura } from "./letreiros";
import { texturaEspelhoDegrau, texturaGranito, texturasChapa, texturasDegrau, texturasEscovado } from "./texturas-shopping";

/** patamar (degraus deitados) em cada ponta, inclinação e largura útil */
const PAT = 1.5;
const INCLINACAO = Math.PI / 6;
const W = 1.3;
const DEGRAU = 1.0;
const PASSO = 0.4;
const VELOCIDADE = 0.5;
/** onde a rampa vira patamar, a linha dos bicos dos degraus faz a curva neste trecho */
const CURVA = 0.4;
/** o bico do degrau fica acima do perfil na rampa: meia pisada × tan 30° */
const BICO = ((PASSO - 0.015) / 2) * Math.tan(INCLINACAO);

/** altura do perfil (centro das pisadas) em s: patamar, rampa de 30°, patamar */
function perfil(y0: number, y1: number, H: number) {
  return (s: number) => (s <= PAT ? y0 : s >= PAT + H ? y1 : y0 + ((s - PAT) / H) * (y1 - y0));
}

/** linha dos bicos (a borda da frente das pisadas), que é por onde correm saia, vidro e corrimão */
function bico(topo: (s: number) => number, s: number, H: number) {
  const k = THREE.MathUtils.clamp((s - PAT) / CURVA, 0, 1) * THREE.MathUtils.clamp((PAT + H - s) / CURVA, 0, 1);
  return topo(s) + 0.045 + BICO * k;
}

function geometria(pos: number[], uv: number[], idx: number[]) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function uvMetros(g: THREE.BufferGeometry) {
  uvEmMetros(g);
  return g;
}

interface Unidade {
  /** do sistema da escada (s ao longo, y para cima, lateral) para o mundo */
  mundo: THREE.Matrix4;
  lat: number;
  T: number;
  y0: number;
  y1: number;
  H: number;
  sobe: boolean;
  n: number;
}

export class Movimento {
  private unidades: Unidade[] = [];
  private animar: ((t: number, dt: number) => void)[] = [];
  readonly inox: THREE.MeshStandardMaterial;
  private granito: THREE.MeshStandardMaterial;
  private chapa: THREE.MeshStandardMaterial;
  private pente: THREE.MeshStandardMaterial;

  constructor(
    private lotes: Lotes,
    private mat: Materiais,
    private grupo: THREE.Group,
    private lixo: { dispose: () => void }[]
  ) {
    const esc = texturasEscovado(31);
    for (const t of [esc.rugosidade, esc.normal]) t.repeat.set(1, 1);
    this.inox = new THREE.MeshStandardMaterial({
      color: "#cfd3d8",
      metalness: 1,
      roughness: 1,
      roughnessMap: esc.rugosidade,
      normalMap: esc.normal,
      normalScale: new THREE.Vector2(0.12, 0.12),
      envMapIntensity: 1.25,
      side: THREE.DoubleSide,
    });
    const gr = texturaGranito(9);
    this.granito = new THREE.MeshStandardMaterial({ map: gr, roughness: 0.18, metalness: 0, envMapIntensity: 1.1 });
    const ch = texturasChapa();
    for (const t of [ch.cor, ch.normal]) t.repeat.set(1 / 0.4, 1 / 0.4);
    this.chapa = new THREE.MeshStandardMaterial({ map: ch.cor, normalMap: ch.normal, metalness: 0.85, roughness: 0.42, envMapIntensity: 1.1 });
    this.pente = new THREE.MeshStandardMaterial({ color: "#e2b43c", metalness: 0.4, roughness: 0.45 });
    lixo.push(esc.rugosidade, esc.normal, this.inox, gr, this.granito, ch.cor, ch.normal, this.chapa, this.pente);
  }

  /**
   * Um par de escadas rolantes (uma sobe, a outra desce) ao longo do eixo z,
   * de (x, z) na altura y0 até y1. Devolve o comprimento no chão (do começo
   * ao fim do patamar de cima).
   */
  escada(x: number, z: number, dz: number, y0: number, y1: number) {
    const H = (y1 - y0) / Math.tan(INCLINACAO);
    const T = PAT * 2 + H;
    const topo = perfil(y0, y1, H);
    const nariz = (s: number) => bico(topo, s, H);
    const rot = dz < 0 ? Math.PI / 2 : -Math.PI / 2;
    const base = new THREE.Matrix4().makeRotationY(rot).setPosition(x, 0, z);
    const mundo = (g: THREE.BufferGeometry) => g.applyMatrix4(base);
    const { lotes, mat } = this;
    // a balaustrada passa do pente e chega ao piso das pontas
    const S0 = -0.6;
    const S1 = T + 0.6;
    const quebras = [PAT, PAT + CURVA, PAT + H - CURVA, PAT + H];
    const pontos = (s0: number, s1: number) => [s0, ...quebras.filter((s) => s > s0 && s < s1), s1];
    /** fita vertical na lateral `l`, de nariz+a até nariz+b; uv em metros */
    const fitaPerfil = (l: number, a: number, b: number, s0 = S0, s1 = S1) => {
      const pts = pontos(s0, s1);
      const pos: number[] = [];
      const uv: number[] = [];
      const idx: number[] = [];
      pts.forEach((s) => {
        pos.push(s, nariz(s) + a, l, s, nariz(s) + b, l);
        uv.push(s, nariz(s) + a, s, nariz(s) + b);
      });
      for (let i = 0; i + 1 < pts.length; i++) idx.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3);
      return mundo(geometria(pos, uv, idx));
    };
    /** fita deitada de lateral l0 a l1, na altura nariz+a */
    const deckPerfil = (l0: number, l1: number, a: number) => {
      const pts = pontos(S0, S1);
      const pos: number[] = [];
      const uv: number[] = [];
      const idx: number[] = [];
      pts.forEach((s) => {
        pos.push(s, nariz(s) + a, l0, s, nariz(s) + a, l1);
        uv.push(s, l0, s, l1);
      });
      for (let i = 0; i + 1 < pts.length; i++) idx.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3);
      return mundo(geometria(pos, uv, idx));
    };
    // entre as duas escadas: o deck do meio
    lotes.adicionar(this.inox, deckPerfil(-0.06, 0.06, 0.1), { sombra: true });
    for (const [lat, sobe] of [
      [-0.7, true],
      [0.7, false],
    ] as const) {
      // treliça branca por baixo (o alto fica 0,3 m abaixo do bico dos degraus)
      const alto = pontos(0, T).map((s) => new THREE.Vector2(s, nariz(s) - 0.3));
      const forma = new THREE.Shape([...alto, new THREE.Vector2(T, y1 - 0.6), new THREE.Vector2(PAT + H, y1 - 1.15), new THREE.Vector2(PAT + 1.73, y0 - 0.3), new THREE.Vector2(0, y0 - 0.3)]);
      const corpo = new THREE.ExtrudeGeometry(forma, { depth: W, bevelEnabled: false });
      corpo.translate(0, 0, lat - W / 2);
      lotes.adicionar(mat.fachadaBranca, mundo(corpo), { sombra: true });
      // inox escovado por fora (a faixa do alto da treliça) e o deck até o vidro
      for (const l of [lat - W / 2 - 0.004, lat + W / 2 + 0.004]) lotes.adicionar(this.inox, fitaPerfil(l, -0.45, 0.1));
      lotes.adicionar(this.inox, deckPerfil(lat - W / 2 - 0.004, lat - 0.56, 0.1));
      lotes.adicionar(this.inox, deckPerfil(lat + 0.56, lat + W / 2 + 0.004, 0.1));
      for (const sinal of [-1, 1]) {
        // saia de inox colada aos degraus e o deck por dentro até o vidro
        lotes.adicionar(this.inox, fitaPerfil(lat + sinal * 0.505, -0.3, 0.1));
        lotes.adicionar(this.inox, deckPerfil(lat + sinal * 0.505, lat + sinal * 0.56, 0.1));
        // LED quente no alto da saia, iluminando os degraus
        lotes.adicionar(mat.led, fitaPerfil(lat + sinal * 0.502, 0.065, 0.085, 0, T));
        // vidro do guarda-corpo, com o LED embaixo dele
        lotes.adicionar(mat.vidro, fitaPerfil(lat + sinal * 0.56, 0.1, 0.92, -0.35, T + 0.35));
        lotes.adicionar(mat.led, fitaPerfil(lat + sinal * 0.585, 0.102, 0.12));
        // corrimão de borracha preta: corre por cima do vidro, faz a volta nas pontas e entra na boca
        const l = lat + sinal * 0.56;
        const pts: THREE.Vector3[] = [];
        const R = 0.24;
        const volta = (cx: number, cy: number, de: number, ate: number) => {
          for (let k = 0; k <= 10; k++) {
            const a = de + ((ate - de) * k) / 10;
            pts.push(new THREE.Vector3(cx + Math.cos(a) * R, cy + Math.sin(a) * R, l));
          }
        };
        const yc = 0.95;
        pts.push(new THREE.Vector3(0.05, y0 + 0.045 + yc - 2 * R - 0.12, l));
        volta(-0.35, nariz(-0.35) + yc - R, -Math.PI / 2, -Math.PI * 1.5);
        for (const s of pontos(-0.35, T + 0.35).slice(1, -1)) pts.push(new THREE.Vector3(s, nariz(s) + yc, l));
        volta(T + 0.35, nariz(T + 0.35) + yc - R, Math.PI / 2, -Math.PI / 2);
        pts.push(new THREE.Vector3(T - 0.05, y1 + 0.045 + yc - 2 * R - 0.12, l));
        const caminho = new THREE.CurvePath<THREE.Vector3>();
        for (let i = 0; i + 1 < pts.length; i++) if (pts[i].distanceTo(pts[i + 1]) > 1e-4) caminho.add(new THREE.LineCurve3(pts[i], pts[i + 1]));
        lotes.adicionar(mat.corrimao, mundo(new THREE.TubeGeometry(caminho, 120, 0.04, 8, false)));
        // a boca onde o corrimão entra, nas duas pontas
        for (const [s, y] of [
          [0.05, y0],
          [T - 0.05, y1],
        ]) {
          const g = new THREE.BoxGeometry(0.16, 0.14, 0.12);
          g.translate(s, y + 0.045 + yc - 2 * R - 0.12, l);
          lotes.adicionar(mat.corrimao, mundo(g));
        }
      }
      // pente (onde os degraus entram) e chapa xadrez do piso nas duas pontas
      for (const [s0, s1, y] of [
        [-1.35, 0.08, y0],
        [T - 0.08, T + 1.35, y1],
      ]) {
        const g = new THREE.BoxGeometry(s1 - s0, 0.03, DEGRAU);
        g.translate((s0 + s1) / 2, y + 0.015, lat);
        uvEmMetros(g);
        lotes.adicionar(this.chapa, mundo(g));
        const pente = new THREE.BoxGeometry(0.05, 0.034, DEGRAU);
        pente.translate(s0 < 0 ? s1 - 0.025 : s0 + 0.025, y + 0.017, lat);
        lotes.adicionar(this.pente, mundo(pente));
      }
      const n = Math.round(T / PASSO);
      this.unidades.push({ mundo: base, lat, T, y0, y1, H, sobe, n });
    }
    return T;
  }

  /**
   * Elevador panorâmico em (x, z), meia largura `meia`, da base até `alto`,
   * parando nos andares `paradas` (porta do térreo para +z; dos andares de
   * cima para −z, onde chegam as pontes).
   */
  elevador(x: number, z: number, meia: number, alto: number, paradas: number[]) {
    const { lotes, mat, grupo, lixo } = this;
    const BASE = 0.16;
    // a cabine para no alto da base de granito no térreo
    const pisos = paradas.map((y, i) => (i === 0 ? y + BASE : y));
    // torre: montantes de inox, cintas em cada andar, vidro e a base de granito
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) lotes.bloco(this.inox, x + sx * meia - 0.08, 0, z + sz * meia - 0.08, x + sx * meia + 0.08, alto, z + sz * meia + 0.08, { sombra: true });
    const cintas = [BASE + 0.05, ...pisos.slice(1).map((y) => y - 0.1), alto - 0.3];
    for (const y of cintas) {
      lotes.bloco(this.inox, x - meia, y - 0.07, z - meia - 0.05, x + meia, y + 0.07, z - meia + 0.05);
      lotes.bloco(this.inox, x - meia, y - 0.07, z + meia - 0.05, x + meia, y + 0.07, z + meia + 0.05);
      lotes.bloco(this.inox, x - meia - 0.05, y - 0.07, z - meia, x - meia + 0.05, y + 0.07, z + meia);
      lotes.bloco(this.inox, x + meia - 0.05, y - 0.07, z - meia, x + meia + 0.05, y + 0.07, z + meia);
    }
    // travessas finas entre as cintas (os caixilhos do vidro)
    for (let i = 0; i + 1 < cintas.length; i++) {
      const y = (cintas[i] + cintas[i + 1]) / 2;
      for (const sz of [-1, 1]) lotes.bloco(mat.aco, x - meia, y - 0.02, z + sz * meia - 0.025, x + meia, y + 0.02, z + sz * meia + 0.025);
      for (const sx of [-1, 1]) lotes.bloco(mat.aco, x + sx * meia - 0.025, y - 0.02, z - meia, x + sx * meia + 0.025, y + 0.02, z + meia);
    }
    lotes.bloco(mat.vidro, x - meia, 0, z + meia - 0.01, x + meia, alto, z + meia + 0.01);
    lotes.bloco(mat.vidro, x - meia - 0.01, 0, z - meia, x - meia + 0.01, alto, z + meia);
    lotes.bloco(mat.vidro, x + meia - 0.01, 0, z - meia, x + meia + 0.01, alto, z + meia);
    lotes.bloco(mat.vidro, x - meia, 0, z - meia - 0.01, x + meia, alto, z - meia + 0.01);
    lotes.bloco(this.granito, x - meia - 0.25, 0, z - meia - 0.25, x + meia + 0.25, BASE - 0.02, z + meia + 0.25, { sombra: true });
    lotes.bloco(this.inox, x - meia - 0.27, BASE - 0.03, z - meia - 0.27, x + meia + 0.27, BASE, z + meia + 0.27);
    // casa de máquinas em cima
    lotes.bloco(this.inox, x - meia - 0.1, alto, z - meia - 0.1, x + meia + 0.1, alto + 0.45, z + meia + 0.1, { sombra: true });
    // trilhos do contrapeso, por dentro do vidro do lado +x
    for (const dz of [-0.35, 0.35]) lotes.bloco(mat.metal, x + meia - 0.14, BASE, z + dz - 0.03, x + meia - 0.08, alto, z + dz + 0.03);
    // portas de cada andar: moldura de inox, duas folhas de vidro e a botoeira
    const mostradores: { g: CanvasRenderingContext2D; tex: THREE.CanvasTexture }[] = [];
    const geoPlaca = new THREE.PlaneGeometry(0.36, 0.18);
    lixo.push(geoPlaca);
    pisos.forEach((y, i) => {
      const lado = i === 0 ? 1 : -1;
      const zf = z + lado * (meia + 0.06);
      const p = 0.75;
      lotes.bloco(this.inox, x - p - 0.12, y, zf - 0.04, x - p, y + 2.4, zf + 0.04);
      lotes.bloco(this.inox, x + p, y, zf - 0.04, x + p + 0.12, y + 2.4, zf + 0.04);
      lotes.bloco(this.inox, x - p - 0.12, y + 2.4, zf - 0.04, x + p + 0.12, y + 2.64, zf + 0.04);
      lotes.bloco(this.inox, x - p, y, zf - 0.03, x + p, y + 0.03, zf + 0.03);
      for (const s of [-1, 1]) {
        lotes.bloco(mat.vidro, x + (s < 0 ? -p : 0.012), y + 0.05, zf - 0.008, x + (s < 0 ? -0.012 : p), y + 2.36, zf + 0.008);
        // perfil de inox em volta de cada folha
        const x0 = s < 0 ? x - p : x + 0.012;
        const x1 = s < 0 ? x - 0.012 : x + p;
        lotes.bloco(this.inox, x0, y + 2.33, zf - 0.015, x1, y + 2.4, zf + 0.015);
        lotes.bloco(this.inox, x0, y + 0.03, zf - 0.015, x1, y + 0.1, zf + 0.015);
        lotes.bloco(this.inox, s < 0 ? x1 - 0.03 : x0, y + 0.03, zf - 0.015, s < 0 ? x1 : x0 + 0.03, y + 2.4, zf + 0.015);
      }
      lotes.bloco(this.inox, x + p + 0.15, y + 1.0, zf - 0.02, x + p + 0.27, y + 1.32, zf + 0.02);
      lotes.bloco(mat.luz, x + p + 0.19, y + 1.12, zf + lado * 0.021 - 0.002, x + p + 0.23, y + 1.17, zf + lado * 0.021 + 0.002);
      // mostrador do andar em cima da porta (redesenhado quando muda)
      const c = document.createElement("canvas");
      c.width = 128;
      c.height = 64;
      const tex = canvasTextura(c, 4, true);
      const m = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.6, 1.6, 1.6) });
      lixo.push(tex, m);
      const placa = new THREE.Mesh(geoPlaca, m);
      placa.position.set(x, y + 2.52, zf + lado * 0.045);
      placa.rotation.y = lado > 0 ? 0 : Math.PI;
      grupo.add(placa);
      mostradores.push({ g: c.getContext("2d")!, tex });
    });

    // cabine (origem no piso dela): poucas malhas, juntadas por material
    const cx = meia - 0.4;
    const cz = meia - 0.18;
    const pecas = new Lotes();
    const peca = (m: THREE.Material, g: THREE.BufferGeometry, sombra = false) => pecas.adicionar(m, g, { sombra });
    peca(this.granito, uvMetros(new THREE.BoxGeometry(cx * 2, 0.12, cz * 2).translate(0, -0.06, 0)), true);
    peca(this.inox, uvMetros(new THREE.BoxGeometry(cx * 2 + 0.04, 0.05, cz * 2 + 0.04).translate(0, -0.1, 0)), true);
    // chassi escuro embaixo, o teto branco com a luz e o arco de suspensão em cima
    peca(mat.metal, new THREE.BoxGeometry(cx * 2 - 0.2, 0.3, cz * 2 - 0.2).translate(0, -0.27, 0), true);
    peca(mat.fachadaBranca, new THREE.BoxGeometry(cx * 2, 0.16, cz * 2).translate(0, 2.44, 0), true);
    peca(this.inox, uvMetros(new THREE.BoxGeometry(cx * 2 + 0.03, 0.05, cz * 2 + 0.03).translate(0, 2.37, 0)));
    peca(mat.luz, new THREE.PlaneGeometry(cx * 1.4, cz * 1.4).rotateX(Math.PI / 2).translate(0, 2.355, 0));
    peca(mat.metal, new THREE.BoxGeometry(0.14, 0.35, cz * 2).translate(0, 2.7, 0), true);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) peca(this.inox, uvMetros(new THREE.BoxGeometry(0.07, 2.36, 0.07).translate(sx * cx, 1.18, sz * cz)), true);
    // vidro dos lados e as portas de vidro (com moldura) nas duas frentes
    for (const sx of [-1, 1]) peca(mat.vidro, new THREE.PlaneGeometry(cz * 2, 2.32).rotateY(Math.PI / 2).translate(sx * cx, 1.18, 0));
    for (const sz of [-1, 1]) {
      peca(mat.vidro, new THREE.PlaneGeometry(cx * 2, 2.32).translate(0, 1.18, sz * cz));
      peca(this.inox, uvMetros(new THREE.BoxGeometry(0.03, 2.32, 0.04).translate(0, 1.18, sz * cz)));
      peca(this.inox, uvMetros(new THREE.BoxGeometry(cx * 2, 0.07, 0.05).translate(0, 0.035, sz * cz)));
    }
    // corrimão nos lados de vidro e o painel de botões
    for (const sx of [-1, 1]) {
      peca(this.inox, new THREE.CylinderGeometry(0.022, 0.022, cz * 2 - 0.2, 10).rotateX(Math.PI / 2).translate(sx * (cx - 0.08), 0.92, 0));
      for (const sz of [-1, 1]) peca(this.inox, new THREE.CylinderGeometry(0.015, 0.015, 0.08, 8).rotateZ(Math.PI / 2).translate(sx * (cx - 0.04), 0.92, sz * (cz - 0.2)));
    }
    peca(this.inox, uvMetros(new THREE.BoxGeometry(0.03, 0.5, 0.18).translate(cx - 0.03, 1.2, cz - 0.3)));
    peca(mat.luz, new THREE.BoxGeometry(0.012, 0.32, 0.07).translate(cx - 0.05, 1.2, cz - 0.3));
    const cabine = pecas.fechar();
    cabine.position.set(x, pisos[0], z);
    grupo.add(cabine);
    // cabos (do arco da cabine até a casa de máquinas) e o contrapeso
    const matCabo = new THREE.MeshStandardMaterial({ color: "#2a2b2e", metalness: 0.8, roughness: 0.4 });
    const geoCabo = new THREE.CylinderGeometry(0.012, 0.012, 1, 6).translate(0, 0.5, 0);
    lixo.push(matCabo, geoCabo);
    const cabos = [-0.05, 0.05].flatMap((dx) =>
      [-0.18, 0.18].map((dz2) => {
        const m = new THREE.Mesh(geoCabo, matCabo);
        m.position.set(x + dx, 0, z + dz2);
        grupo.add(m);
        return m;
      })
    );
    const contrapeso = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.4, 0.58), mat.metal);
    contrapeso.position.set(x + meia - 0.23, 0, z);
    contrapeso.castShadow = true;
    grupo.add(contrapeso);
    lixo.push(contrapeso.geometry);
    // térreo → 2 → 3 → 2 → térreo, parando 6 s em cada andar e levando ~4 s entre eles
    const roteiro = [...pisos, ...pisos.slice(1, -1).reverse()];
    const PARADO = 6;
    const VIAGEM = 4;
    let ultimo = "";
    this.animar.push((t) => {
      const ciclo = roteiro.length * (PARADO + VIAGEM);
      const k = t % ciclo;
      const i = Math.floor(k / (PARADO + VIAGEM));
      const r = k - i * (PARADO + VIAGEM);
      const de = roteiro[i];
      const para = roteiro[(i + 1) % roteiro.length];
      const f = r < PARADO ? 0 : THREE.MathUtils.smootherstep(r - PARADO, 0, VIAGEM);
      const y = de + (para - de) * f;
      cabine.position.y = y;
      for (const cabo of cabos) {
        cabo.position.y = y + 2.87;
        cabo.scale.y = Math.max(0.01, alto - y - 2.87);
      }
      contrapeso.position.y = Math.max(0.9, alto - 1.2 - (y - pisos[0]));
      // mostrador: o andar mais perto da cabine e a seta enquanto ela anda
      let andar = 0;
      pisos.forEach((p, j) => Math.abs(p - y) < Math.abs(pisos[andar] - y) && (andar = j));
      const seta = f > 0 && f < 1 ? (para > de ? "▲" : "▼") : "";
      const texto = `${andar + 1}${seta}`;
      if (texto === ultimo) return;
      ultimo = texto;
      for (const m of mostradores) {
        m.g.fillStyle = "#0c0b10";
        m.g.fillRect(0, 0, 128, 64);
        m.g.fillStyle = "#ffb347";
        m.g.textAlign = "center";
        m.g.textBaseline = "middle";
        m.g.font = "700 44px Poppins, system-ui, sans-serif";
        m.g.fillText(String(andar + 1), seta ? 46 : 64, 35);
        if (seta) {
          m.g.font = "700 30px system-ui, sans-serif";
          m.g.fillText(seta, 88, 34);
        }
        m.tex.needsUpdate = true;
      }
    });
  }

  /** cria os degraus (todas as escadas juntas) e devolve o que roda a cada quadro */
  fechar() {
    const total = this.unidades.reduce((a, u) => a + u.n, 0);
    const dg = texturasDegrau();
    const matPisada = new THREE.MeshStandardMaterial({ map: dg.cor, normalMap: dg.normal, metalness: 0.75, roughness: 0.42, envMapIntensity: 1.1 });
    const tEsp = texturaEspelhoDegrau();
    const matEspelho = new THREE.MeshStandardMaterial({ map: tEsp, metalness: 0.7, roughness: 0.5 });
    // pisada: 0,385 × 0,035 × 1 m, com o alto em y = 0 (uv da face de cima: u na profundidade, v na largura)
    const geoPisada = new THREE.BoxGeometry(PASSO - 0.015, 0.035, DEGRAU).translate(0, -0.0175, 0);
    // espelho: plano vertical de 1 × 1 virado para quem está embaixo (−s), com o pé em y = 0
    const geoEspelho = new THREE.PlaneGeometry(DEGRAU, 1).translate(0, 0.5, 0).rotateY(-Math.PI / 2);
    const pisadas = new THREE.InstancedMesh(geoPisada, matPisada, total);
    const espelhos = new THREE.InstancedMesh(geoEspelho, matEspelho, total);
    for (const m of [pisadas, espelhos]) {
      m.receiveShadow = true;
      m.frustumCulled = false;
      this.grupo.add(m);
    }
    this.lixo.push(dg.cor, dg.normal, matPisada, tEsp, matEspelho, geoPisada, geoEspelho, pisadas, espelhos);
    const local = new THREE.Matrix4();
    const mundo = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const escala = new THREE.Vector3();
    const sem = new THREE.Quaternion();
    const animar = this.animar;
    return (t: number, dt: number) => {
      let k = 0;
      for (const u of this.unidades) {
        const passo = u.T / u.n;
        const topo = perfil(u.y0, u.y1, u.H);
        // alto da pisada; nas pontas ela afunda e passa por baixo do pente
        const altura = (s: number) => {
          const borda = Math.min(s, u.T - s);
          return topo(s) + 0.045 - (borda < 0.32 ? 0.075 * (1 - borda / 0.32) : 0);
        };
        const anda = (u.sobe ? 1 : -1) * VELOCIDADE * t;
        for (let i = 0; i < u.n; i++, k++) {
          const s = (((i * passo + anda) % u.T) + u.T) % u.T;
          const y = altura(s);
          local.compose(pos.set(s, y, u.lat), sem, escala.set(1, 1, 1));
          pisadas.setMatrixAt(k, mundo.multiplyMatrices(u.mundo, local));
          // espelho: da pisada deste degrau até a do próximo (no patamar, some)
          const alto = altura(Math.min(u.T, s + passo)) - y;
          local.compose(pos.set(s + passo / 2 - 0.01, y - 0.035, u.lat), sem, escala.set(1, Math.max(0.001, alto), 1));
          espelhos.setMatrixAt(k, mundo.multiplyMatrices(u.mundo, local));
        }
      }
      pisadas.instanceMatrix.needsUpdate = true;
      espelhos.instanceMatrix.needsUpdate = true;
      for (const f of animar) f(t, dt);
    };
  }
}
