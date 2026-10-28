/**
 * Uma unidade do shopping: fachada (vitrine de vidro com porta aberta e o
 * letreiro na faixa) e o interior. Loja com inquilino ganha piso e paredes
 * nas cores da marca, 4 gôndolas no fundo (48 produtos com etiqueta de
 * preço), mesa de destaques, quadro da marca, bancada de espelhos e o caixa.
 * Loja vaga fica no cimento, com o adesivo "ALUGA-SE" e um totem de aluguel.
 *
 * Os produtos só são montados quando o visitante chega perto (montarProdutos).
 */
import * as THREE from "three";
import { PLANTA, type Inquilino, type Unidade } from "../dados/lojas";
import { descontoPct, fotoDe, nomeMarca, type Produto } from "../dados/catalogo";
import { textos } from "../copy/textos";
import type { Colisao } from "./colisao";
import { Lotes, planoChao, planoTeto, placa } from "./construtor";
import { adesivoAluguel, cabecalhoMarca, canvasTextura, COR_SHOPPING, FONTE, letreiroFachada, letreiroVago, quadroLoja, shade } from "./letreiros";
import type { Materiais } from "./materiais";
import type { PontoInteracao } from "./estrutura";
import { montarProduto3D } from "./produto3d";
import { criarEtiquetas, type DadosEtiqueta } from "./etiquetas";

const { meioCorredor: MC, fundoLoja: FL, tetoLoja: TL } = PLANTA;
const PORTA = 4;
const ALTURA_VIDRO = 3.9;
const PRATELEIRAS = [0.32, 0.78, 1.24, 1.7];
const BAIAS = 4;
const POR_PRATELEIRA = 3;
const LARGURA_BAIA = 2.4;

export interface SlotProduto {
  produto: Produto;
  pos: THREE.Vector3;
  rot: number;
  largura: number;
  altura: number;
}

export interface LojaMontada {
  unidade: Unidade;
  inquilino: Inquilino | undefined;
  grupo: THREE.Group;
  pisos: THREE.Mesh[];
  pontos: PontoInteracao[];
  /** onde fica a pessoa do caixa (e para onde olha) */
  atendente: { x: number; z: number; rumo: number } | null;
  /** produtos já montados, para o cursor achar */
  alvos: THREE.Mesh[];
  /** pontos para os visitantes passearem dentro da loja */
  passeio: [number, number][];
  montarProdutos: () => Promise<void>;
  produtosProntos: boolean;
  descartar: () => void;
}

/** embalagem genérica com a marca e o nome do produto (quando a foto não carrega) */
function caixaSemFoto(p: Produto, largura: number, altura: number) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 384;
  const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, 0, 384);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(1, "#ece6ef");
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 384);
  g.fillStyle = COR_SHOPPING.ameixa;
  g.fillRect(0, 0, 256, 70);
  g.fillStyle = "#ffffff";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = `700 30px ${FONTE}`;
  g.fillText(nomeMarca(p.marca).toUpperCase().slice(0, 14), 128, 37);
  g.fillStyle = "#2b2233";
  g.font = `500 24px ${FONTE}`;
  const palavras = p.titulo.split(/\s+/);
  let linha = "";
  let y = 120;
  for (const w of palavras) {
    const t = linha ? `${linha} ${w}` : w;
    if (g.measureText(t).width > 220 && linha) {
      g.fillText(linha, 128, y);
      y += 32;
      linha = w;
      if (y > 340) break;
    } else linha = t;
  }
  if (y <= 340) g.fillText(linha, 128, y);
  const tex = canvasTextura(c, 4);
  const l = Math.min(largura * 0.6, altura * 0.45);
  const geo = new THREE.BoxGeometry(l, l * 1.5, l * 0.4);
  geo.translate(0, (l * 1.5) / 2, 0);
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 }));
}

export function criarLoja(u: Unidade, q: Inquilino | undefined, mat: Materiais, colisao: Colisao, celular: boolean): LojaMontada {
  const s = u.lado;
  const grupo = new THREE.Group();
  const lotes = new Lotes();
  const lixo: { dispose: () => void }[] = [];
  const pontos: PontoInteracao[] = [];
  const alvos: THREE.Mesh[] = [];
  const xf = s * MC; // plano da vitrine
  const xFundo = s * FL;
  const X = (d: number) => s * (MC + d); // d = metros para dentro da loja, a partir da vitrine
  const { z0, z1, zc } = u;
  const est = q?.estilo;

  // ---- materiais da loja
  const matParede = new THREE.MeshStandardMaterial({ color: est?.parede ?? "#e9e5df", roughness: 0.9, normalMap: mat.gesso.normalMap, normalScale: new THREE.Vector2(0.5, 0.5) });
  const matMarca = new THREE.MeshStandardMaterial({ color: est?.primaria ?? "#8a8178", roughness: 0.45, metalness: 0.05 });
  const matSecundaria = new THREE.MeshStandardMaterial({ color: est ? (est.letreiro === "pulse" ? "#efe6da" : est.secundaria) : "#ddd6ce", roughness: 0.7 });
  const matPrateleira = new THREE.MeshStandardMaterial({ color: "#f3f1ee", roughness: 0.45, metalness: 0.05 });
  lixo.push(matParede, matMarca, matSecundaria, matPrateleira);

  // ---- piso e teto
  const piso = new THREE.Mesh(planoChao(Math.min(xf, xFundo), z0, Math.max(xf, xFundo), z1), q ? mat.pisos[q.estilo.piso] : mat.pisoObra);
  piso.receiveShadow = true;
  grupo.add(piso);
  lixo.push(piso.geometry);
  lotes.adicionar(mat.teto, planoTeto(Math.min(xf, xFundo), z0, Math.max(xf, xFundo), z1, TL));
  // painéis de luz no teto
  const linhas = q ? 3 : 1;
  for (let i = 0; i < linhas; i++)
    for (let k = 0; k < 3; k++) {
      const d = q ? 2.6 + i * 3.6 : 6;
      const z = zc + (k - 1) * 3.6;
      lotes.bloco(mat.luz, X(d) - 0.6, TL - 0.02, z - 0.6, X(d) + 0.6, TL - 0.005, z + 0.6);
    }

  // ---- paredes (laterais e fundo)
  lotes.bloco(matParede, xf, 0, z0, xFundo, TL, z0 + 0.12);
  lotes.bloco(matParede, xf, 0, z1 - 0.12, xFundo, TL, z1);
  lotes.bloco(matParede, xFundo - s * 0.12, 0, z0, xFundo, TL, z1);
  colisao.parede(xf, z0 + 0.12, xFundo, z0 + 0.12, TL);
  colisao.parede(xf, z1 - 0.12, xFundo, z1 - 0.12, TL);
  // rodapé
  for (const z of [z0 + 0.12, z1 - 0.13]) lotes.bloco(mat.metal, xf, 0, z, xFundo, 0.08, z + 0.01);

  // ---- fachada: pilares, vitrine com porta, faixa do letreiro
  for (const z of [z0, z1]) {
    lotes.bloco(mat.pedra, xf - s * 0.3, 0, z - 0.3, xf + s * 0.1, PLANTA.piso2, z + 0.3, { sombra: true });
    colisao.caixa(Math.min(xf - s * 0.3, xf + s * 0.1), z - 0.3, Math.max(xf - s * 0.3, xf + s * 0.1), z + 0.3, 6);
  }
  const zp0 = zc - PORTA / 2;
  const zp1 = zc + PORTA / 2;
  for (const [a, b] of [
    [z0 + 0.3, zp0],
    [zp1, z1 - 0.3],
  ]) {
    lotes.bloco(mat.vidro, xf - 0.01, 0.12, a, xf + 0.01, ALTURA_VIDRO, b);
    lotes.bloco(mat.metal, xf - 0.04, 0, a, xf + 0.04, 0.12, b);
    for (const z of [a, b]) lotes.bloco(mat.metal, xf - 0.04, 0, z - 0.03, xf + 0.04, ALTURA_VIDRO, z + 0.03);
    colisao.parede(xf, a, xf, b, ALTURA_VIDRO);
  }
  // portal da porta
  lotes.bloco(mat.metal, xf - 0.06, ALTURA_VIDRO - 0.1, zp0 - 0.06, xf + 0.06, ALTURA_VIDRO, zp1 + 0.06);
  // parede acima da vitrine e faixa do letreiro
  lotes.bloco(mat.gesso, xf, ALTURA_VIDRO, z0 + 0.3, xf + s * 0.2, PLANTA.piso2, z1 - 0.3);
  {
    const tex = canvasTextura(q ? letreiroFachada(q) : letreiroVago(u));
    const brilho = q ? 1.25 : 1;
    const m = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(brilho, brilho, brilho) });
    lixo.push(tex, m);
    const faixaMat = new THREE.MeshStandardMaterial({ color: q ? q.estilo.faixa : "#e6ddd4", roughness: 0.5 });
    lixo.push(faixaMat);
    lotes.bloco(faixaMat, xf - s * 0.32, ALTURA_VIDRO + 0.25, z0 + 0.4, xf, ALTURA_VIDRO + 1.35, z1 - 0.4);
    grupo.add(placa(m, PLANTA.frente - 0.8, 1.1, xf - s * 0.325, ALTURA_VIDRO + 0.8, zc, s > 0 ? -Math.PI / 2 : Math.PI / 2));
    // filete de luz embaixo da faixa
    lotes.bloco(mat.luz, xf - s * 0.3, ALTURA_VIDRO + 0.22, z0 + 0.5, xf - s * 0.26, ALTURA_VIDRO + 0.25, z1 - 0.5);
  }

  const passeio: [number, number][] = [];
  let atendente: LojaMontada["atendente"] = null;
  const slots: SlotProduto[] = [];
  const rotFrente = -s * (Math.PI / 2); // virado para o corredor

  if (q) {
    // ---- gôndolas no fundo: 4 baias × 4 prateleiras × 3 produtos
    const xPainel = xFundo - s * 0.14;
    const prof = 0.44;
    const zIni = zc - (BAIAS * LARGURA_BAIA) / 2;
    lotes.bloco(matSecundaria, xPainel, 0, zIni, xPainel - s * 0.04, 2.45, zIni + BAIAS * LARGURA_BAIA);
    lotes.bloco(matMarca, xPainel, 0, zIni - 0.04, xPainel - s * (prof + 0.04), 0.14, zIni + BAIAS * LARGURA_BAIA + 0.04);
    for (let b = 0; b <= BAIAS; b++) {
      const z = zIni + b * LARGURA_BAIA;
      lotes.bloco(matMarca, xPainel, 0, z - 0.03, xPainel - s * (prof + 0.02), 2.45, z + 0.03, { sombra: true });
    }
    for (const y of PRATELEIRAS) {
      lotes.bloco(matPrateleira, xPainel, y - 0.025, zIni, xPainel - s * prof, y, zIni + BAIAS * LARGURA_BAIA, { sombra: true });
      // fita de LED embaixo de cada prateleira (menos a de baixo)
      if (y > 0.4) lotes.bloco(mat.luz, xPainel - s * (prof - 0.04), y - 0.034, zIni + 0.05, xPainel - s * (prof - 0.06), y - 0.026, zIni + BAIAS * LARGURA_BAIA - 0.05);
    }
    colisao.parede(xPainel - s * (prof + 0.05), zIni - 0.05, xPainel - s * (prof + 0.05), zIni + BAIAS * LARGURA_BAIA + 0.05, 2.45);
    // produtos nas baias, na ordem da lista (as marcas já vêm agrupadas)
    const lista = q.produtos.slice(0, BAIAS * PRATELEIRAS.length * POR_PRATELEIRA);
    lista.forEach((p, i) => {
      const b = Math.floor(i / (PRATELEIRAS.length * POR_PRATELEIRA));
      const resto = i % (PRATELEIRAS.length * POR_PRATELEIRA);
      const prat = PRATELEIRAS.length - 1 - Math.floor(resto / POR_PRATELEIRA);
      const k = resto % POR_PRATELEIRA;
      const z = zIni + b * LARGURA_BAIA + (k + 0.5) * (LARGURA_BAIA / POR_PRATELEIRA);
      slots.push({ produto: p, pos: new THREE.Vector3(xPainel - s * (prof * 0.5), PRATELEIRAS[prat], z), rot: rotFrente, largura: 0.34, altura: 0.38 });
    });
    // cabeçalho de cada baia com a marca que mais aparece nela
    for (let b = 0; b < BAIAS; b++) {
      const daBaia = lista.slice(b * 12, b * 12 + 12);
      if (!daBaia.length) continue;
      const conta = new Map<string, number>();
      daBaia.forEach((p) => conta.set(p.marca, (conta.get(p.marca) ?? 0) + 1));
      const marca = [...conta.entries()].sort((a, c) => c[1] - a[1])[0][0];
      const tex = canvasTextura(cabecalhoMarca(nomeMarca(marca), q.estilo.letreiro === "pulse" ? "#1c1714" : q.estilo.primaria));
      const m = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.1, 1.1, 1.1) });
      lixo.push(tex, m);
      grupo.add(placa(m, LARGURA_BAIA - 0.3, 0.42, xPainel - s * 0.06, 2.12, zIni + (b + 0.5) * LARGURA_BAIA, rotFrente));
    }

    // ---- mesa de destaques no meio
    const mx = X(6.2);
    const mz = zc;
    const tampo = new THREE.CylinderGeometry(1.0, 1.0, 0.06, 48);
    tampo.translate(mx, 0.86, mz);
    lotes.adicionar(matPrateleira, tampo, { sombra: true });
    const pe = new THREE.CylinderGeometry(0.55, 0.7, 0.83, 40);
    pe.translate(mx, 0.415, mz);
    lotes.adicionar(matMarca, pe, { sombra: true });
    colisao.circulo(mx, mz, 1.05, 0.9);
    const destaques = q.produtos.filter((_, i) => i % 8 === 3).slice(0, 6);
    destaques.forEach((p, i) => {
      const a = (i / destaques.length) * Math.PI * 2;
      slots.push({ produto: p, pos: new THREE.Vector3(mx + Math.cos(a) * 0.62, 0.89, mz + Math.sin(a) * 0.62), rot: Math.atan2(Math.cos(a), Math.sin(a)), largura: 0.3, altura: 0.34 });
    });

    // ---- quadro da marca na parede do lado da porta-norte (z0) e bancada com espelhos na outra (z1)
    {
      const tex = canvasTextura(quadroLoja(q));
      const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45, emissive: "#ffffff", emissiveMap: tex, emissiveIntensity: 0.22 });
      lixo.push(tex, m);
      grupo.add(placa(m, 3, 3, X(7.4), 2.3, z0 + 0.13, 0));
      lotes.bloco(mat.dourado, X(5.85), 0.75, z0 + 0.12, X(8.95), 3.85, z0 + 0.125);
    }
    {
      // bancada de maquiagem com 3 espelhos redondos e banquetas
      const zb = z1 - 0.12;
      lotes.bloco(matPrateleira, X(6.2), 0.78, zb - 0.55, X(10.6), 0.84, zb);
      lotes.bloco(matMarca, X(6.25), 0, zb - 0.5, X(10.55), 0.78, zb - 0.02);
      for (let k = 0; k < 3; k++) {
        const x = X(6.95 + k * 1.45);
        const g = new THREE.CircleGeometry(0.42, 40);
        g.rotateY(Math.PI);
        g.translate(x, 1.62, zb - 0.015);
        lotes.adicionar(mat.espelho, g);
        const aro = new THREE.TorusGeometry(0.43, 0.025, 8, 48);
        aro.translate(x, 1.62, zb - 0.02);
        lotes.adicionar(mat.dourado, aro);
        const banq = new THREE.CylinderGeometry(0.22, 0.22, 0.08, 24);
        banq.translate(x, 0.62, zb - 0.95);
        lotes.adicionar(matMarca, banq, { sombra: true });
        const haste = new THREE.CylinderGeometry(0.03, 0.03, 0.58, 8);
        haste.translate(x, 0.29, zb - 0.95);
        lotes.adicionar(mat.aco, haste);
      }
      colisao.caixa(Math.min(X(6.2), X(10.6)), zb - 0.6, Math.max(X(6.2), X(10.6)), zb, 0.9);
    }

    // ---- caixa: balcão perto da vitrine, encostado na parede z1
    {
      const xa = X(1.4);
      const xb = X(4.2);
      const za = z1 - 2.5;
      const zb = z1 - 1.7;
      lotes.bloco(matMarca, xa, 0, za, xb, 1.02, zb, { sombra: true });
      lotes.bloco(matPrateleira, xa - s * 0.03, 1.02, za - 0.04, xb + s * 0.03, 1.07, zb + 0.04, { sombra: true });
      // maquininha e telinha
      lotes.caixa(mat.metal, 0.32, 0.22, 0.04, X(2.4), 1.2, zb - 0.1, {}, 0);
      lotes.caixa(mat.metal, 0.09, 0.03, 0.17, X(3.3), 1.09, za + 0.3, {}, 0);
      colisao.caixa(Math.min(xa, xb), za, Math.max(xa, xb), zb, 1.1);
      atendente = { x: X(2.8), z: z1 - 0.95, rumo: Math.PI };
      colisao.circulo(X(2.8), z1 - 0.95, 0.35, 1.8);
      pontos.push({ tipo: "caixa", x: X(2.8), z: za - 0.6, raio: 1.7, rotulo: textos.dicas.caixa, unidade: u.numero });
      // plaquinha "Caixa" pendurada
      const c = document.createElement("canvas");
      c.width = 256;
      c.height = 96;
      const g = c.getContext("2d")!;
      g.fillStyle = q.estilo.letreiro === "pulse" ? "#1c1714" : q.estilo.primaria;
      g.fillRect(0, 0, 256, 96);
      g.fillStyle = "#ffffff";
      g.font = `600 46px ${FONTE}`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(textos.mapa.caixa.toUpperCase(), 128, 50);
      const tex = canvasTextura(c);
      const m = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(1.2, 1.2, 1.2), side: THREE.DoubleSide });
      lixo.push(tex, m);
      // virada para quem chega ao balcão (vem do lado de z menor)
      grupo.add(placa(m, 0.9, 0.34, X(2.8), 2.7, za - 0.05, Math.PI));
      lotes.bloco(mat.aco, X(2.8) - 0.005, 2.87, za - 0.055, X(2.8) + 0.005, TL, za - 0.045);
    }
    passeio.push([X(4.5), zc - 3.2], [X(4.5), zc + 0.5], [X(9.4), zc - 3], [X(9.4), zc + 2.6], [X(8.5), z1 - 1.6]);
  } else {
    // ---- loja vaga: adesivo na vitrine e totem de aluguel
    const tex = canvasTextura(adesivoAluguel(u));
    const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide });
    lixo.push(tex, m);
    for (const z of [(z0 + 0.3 + zp0) / 2, (zp1 + z1 - 0.3) / 2]) grupo.add(placa(m, 3.1, 1.94, xf + s * 0.03, 1.9, z, s > 0 ? -Math.PI / 2 : Math.PI / 2));
    const tx = X(5.5);
    const corTotem = new THREE.MeshStandardMaterial({ color: COR_SHOPPING.ameixa, roughness: 0.35, metalness: 0.2 });
    lixo.push(corTotem);
    lotes.caixa(corTotem, 0.28, 2.2, 1.0, tx, 1.1, zc, { sombra: true });
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 900;
    const g = c.getContext("2d")!;
    const grad = g.createLinearGradient(0, 0, 0, 900);
    grad.addColorStop(0, "#2a1640");
    grad.addColorStop(1, "#5a3170");
    g.fillStyle = grad;
    g.fillRect(0, 0, 512, 900);
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = COR_SHOPPING.rose;
    g.font = `800 88px ${FONTE}`;
    g.fillText(textos.aluguel.aluga, 256, 200);
    g.fillStyle = "#ffffff";
    g.font = `600 52px ${FONTE}`;
    g.fillText(textos.aluguel.unidade(u.numero), 256, 330);
    g.font = `500 34px ${FONTE}`;
    g.globalAlpha = 0.85;
    g.fillText(textos.aluguel.area(u.area), 256, 410);
    g.fillText(textos.aluguel.frente(PLANTA.frente), 256, 460);
    g.globalAlpha = 1;
    g.fillStyle = COR_SHOPPING.rose;
    g.font = `italic 600 46px 'Playfair Display', Georgia, serif`;
    g.fillText(textos.aluguel.suaMarca, 256, 640);
    const tt = canvasTextura(c);
    const mt = new THREE.MeshBasicMaterial({ map: tt, color: new THREE.Color(1.2, 1.2, 1.2) });
    lixo.push(tt, mt);
    grupo.add(placa(mt, 0.86, 1.52, tx - s * 0.145, 1.3, zc, rotFrente));
    colisao.caixa(tx - 0.2, zc - 0.55, tx + 0.2, zc + 0.55, 2.2);
    pontos.push({ tipo: "aluguel", x: X(4.3), z: zc, raio: 2.2, rotulo: textos.dicas.totemAluguel, unidade: u.numero });
    passeio.push([X(3.5), zc - 2], [X(3.5), zc + 2]);
  }

  // a luz da loja: uma fonte forte e suave no meio (sem sombra), para as cores da marca aparecerem
  if (q) {
    const luz = new THREE.PointLight(est?.letreiro === "pulse" ? "#ffe8cc" : "#fff4e8", celular ? 20 : 26, 16, 1.6);
    // mais perto das gôndolas que da mesa (em cima da mesa clara ela "estourava")
    luz.position.set(X(8.8), TL - 0.5, zc);
    grupo.add(luz);
  }

  grupo.add(lotes.fechar());

  // ---- produtos (sob demanda)
  let prontos = false;
  let montando: Promise<void> | null = null;
  const etiquetas = q ? criarEtiquetas(FONTE, new THREE.Color(shade(q.estilo.letreiro === "pulse" ? "#c2410c" : q.estilo.primaria, 0))) : null;
  if (etiquetas) {
    grupo.add(etiquetas.malha);
    lixo.push({ dispose: etiquetas.descartar });
  }
  async function montarProdutos() {
    if (prontos || !q) return;
    if (montando) return montando;
    montando = (async () => {
      const tags: DadosEtiqueta[] = [];
      // poucos de cada vez: a foto chega, tira o fundo e já aparece
      const fila = [...slots];
      const trabalhar = async () => {
        while (fila.length) {
          const sl = fila.shift()!;
          try {
            // o servidor de fotos às vezes recusa quando chegam muitas juntas: tenta de novo uma vez
            const p3 = await montarProduto3D(fotoDe(sl.produto), sl.largura, sl.altura).catch(
              () => new Promise<Awaited<ReturnType<typeof montarProduto3D>>>((ok, falha) => setTimeout(() => montarProduto3D(fotoDe(sl.produto), sl.largura, sl.altura).then(ok, falha), 1500))
            );
            const m = new THREE.Mesh(p3.geometria, p3.material);
            m.position.copy(sl.pos);
            m.rotation.y = sl.rot;
            m.castShadow = !celular;
            m.userData = { produto: sl.produto, loja: q, nitida: p3.nitida, altura: p3.altura };
            grupo.add(m);
            alvos.push(m);
            lixo.push({ dispose: p3.descartar });
          } catch {
            // foto não chegou: entra uma caixinha com a marca e o nome, para a prateleira não ficar vazia
            const m = caixaSemFoto(sl.produto, sl.largura, sl.altura);
            m.position.copy(sl.pos);
            m.rotation.y = sl.rot;
            m.userData = { produto: sl.produto, loja: q, nitida: () => Promise.reject(new Error("sem foto")), altura: sl.altura };
            grupo.add(m);
            alvos.push(m);
            lixo.push(m.geometry, m.material as THREE.Material, (m.material as THREE.MeshStandardMaterial).map!);
          }
        }
      };
      await Promise.all([trabalhar(), trabalhar(), trabalhar()]);
      // etiquetas na borda das prateleiras do fundo (a mesa de destaques não tem)
      for (const sl of slots) {
        if (Math.abs(Math.abs(sl.pos.x) - Math.abs(xFundo)) > 1) continue;
        tags.push({ pos: new THREE.Vector3(sl.pos.x - s * 0.225, sl.pos.y - 0.028, sl.pos.z), ang: rotFrente, preco: sl.produto.preco, desconto: descontoPct(sl.produto) });
      }
      etiquetas?.refazer(tags);
      prontos = true;
      loja.produtosProntos = true;
    })();
    return montando;
  }

  const loja: LojaMontada = {
    unidade: u,
    inquilino: q,
    grupo,
    pisos: [piso],
    pontos,
    atendente,
    alvos,
    passeio,
    montarProdutos,
    produtosProntos: false,
    descartar: () => {
      lixo.forEach((x) => x.dispose());
      grupo.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
      grupo.removeFromParent();
    },
  };
  return loja;
}
