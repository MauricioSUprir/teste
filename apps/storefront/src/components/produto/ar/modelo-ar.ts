/**
 * Produto em 3D, em TAMANHO REAL, para o "Ver no seu espaço" (realidade
 * aumentada). Não existe modelo 3D dos produtos: ele é montado da foto do Hub,
 * com as mesmas etapas da loja 3D (lib em components/loja3d/produto3d.ts):
 * tira o fundo branco, acha o contorno e dá volume.
 *
 * Tamanho real, nesta ordem:
 * 1. conteúdo do nome ("500 ML", "1 L", "200 G"): ml (ou g, ~1 g/ml) viram cm³.
 *    O frasco tem o contorno da foto, com seção oval (profundidade = k × largura
 *    em cada altura), e por dentro cabe o conteúdo mais a folga da embalagem
 *    (parede, ar, ombro, tampa): volume = π/4 · k · Σ largura² · Δaltura.
 *    Isso dá a escala da foto em cm — e daí altura, largura e profundidade;
 * 2. sem conteúdo no nome: medidas do Hub (altura × largura × profundidade);
 * 3. sem nada: 15 cm, avisando que é aproximado.
 * k vem da proporção largura × profundidade do Hub (quase igual = frasco
 * redondo, k = 1; sem medida, 0,8). Como a altura sai da raiz cúbica do volume,
 * 25% de erro no volume mudam a altura em só ~8%. Conferido com medidas
 * publicadas: shampoo Widi Care 500 ml (22,5 cm na Magalu) → 22 cm; Batiste
 * 200 ml (lata de ~20 cm) → 20 cm.
 *
 * Tudo em metros, base no chão (y = 0), frente para +z. A foto é projetada de
 * frente; as laterais levam a cor da borda do produto (a mesma foto, desfocada).
 *
 * Verso: o Hub não tem foto do verso (as fotos extras são a frente de novo ou
 * propaganda — conferido em 70 produtos). Com a foto do verso cadastrada em
 * lib/catalogo/versos.ts, ela vai atrás, encaixada no contorno da frente. Sem
 * ela, o verso é liso nas cores do produto (o roxo do rótulo, o branco da
 * tampa), sem a arte da frente espelhada.
 */
import * as THREE from "three";
import { toCreasedNormals } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { LADO_BASE, acharFundo, baixarImagem, contornos, desenhar, recortar } from "@/components/loja3d/produto3d";

export interface MedidasAR {
  /** [altura, largura, profundidade] em cm, do Hub */
  medidasCm?: [number, number, number];
  /** ml ou g */
  conteudo?: number;
}

export type BaseMedida = "conteudo" | "medidas" | "aproximado";

export interface ModeloAR {
  /** de onde saiu o tamanho */
  base: BaseMedida;
  /** as duas contas, para conferir (cm de altura) */
  estimativas: { conteudo: number | null; medidas: number | null };
  /** "foto": verso de verdade (foto do Hub); "liso": nas cores do produto, sem foto */
  verso: "foto" | "liso";
  objeto: THREE.Mesh<THREE.BufferGeometry, THREE.Material[]>;
  alturaCm: number;
  larguraCm: number;
  profundidadeCm: number;
  /** sem medida nem conteúdo: tamanho de referência */
  aproximado: boolean;
  descartar: () => void;
}

/** resolução da foto no modelo (o celular chega bem perto) */
const LADO_FOTO = 1024;
/** a embalagem ocupa mais que o conteúdo (parede, ar no topo, ombro, tampa ou válvula) */
const FOLGA_EMBALAGEM = 1.2;
/** seção do frasco sem medida do Hub: entre o redondo (1) e o achatado (~0,55) */
const K_PADRAO = 0.8;
const ALTURA_PADRAO_CM = 15;

const limitar = THREE.MathUtils.clamp;

/** espalha a cor da borda do produto pelo fundo transparente (as laterais e o verso usam essa cor) */
function sangrar(px: Uint8ClampedArray, lado: number) {
  const opaco = new Uint8Array(lado * lado);
  for (let i = 0; i < lado * lado; i++) opaco[i] = px[i * 4 + 3] > 0 ? 1 : 0;
  for (let passo = 0; passo < 48; passo++) {
    const novos: number[] = [];
    for (let y = 0; y < lado; y++) {
      for (let x = 0; x < lado; x++) {
        const i = y * lado + x;
        if (opaco[i]) continue;
        let r = 0;
        let g = 0;
        let b = 0;
        let n = 0;
        for (const j of [x > 0 ? i - 1 : -1, x < lado - 1 ? i + 1 : -1, y > 0 ? i - lado : -1, y < lado - 1 ? i + lado : -1]) {
          if (j < 0 || !opaco[j]) continue;
          r += px[j * 4];
          g += px[j * 4 + 1];
          b += px[j * 4 + 2];
          n++;
        }
        if (!n) continue;
        px[i * 4] = r / n;
        px[i * 4 + 1] = g / n;
        px[i * 4 + 2] = b / n;
        px[i * 4 + 3] = 255;
        novos.push(i);
      }
    }
    if (!novos.length) break;
    for (const i of novos) opaco[i] = 1;
  }
  for (let i = 0; i < lado * lado; i++) px[i * 4 + 3] = 255;
}

type Caixa = { x0: number; y0: number; x1: number; y1: number };

/** máscara do produto (alfa > 0) e o retângulo que ele ocupa, numa foto já recortada */
function caixaDoRecorte(px: Uint8ClampedArray, lado: number): Caixa | null {
  let x0 = lado;
  let y0 = lado;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < lado; y++) {
    for (let x = 0; x < lado; x++) {
      if (!px[(y * lado + x) * 4 + 3]) continue;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

function comTempo<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p, new Promise<null>((ok) => setTimeout(() => ok(null), ms))]);
}

/**
 * Verso liso, em faixas: as cores da frente são agrupadas em poucas (k-médias)
 * e, em cada altura, vale a cor que aparece nas BORDAS do frasco (o fundo do
 * rótulo; letras e logos ficam no meio). Faixas curtas demais se juntam à
 * vizinha. Resultado: o roxo do rótulo, o branco da tampa e da base, sem arte.
 */
function versoLiso(px: Uint8ClampedArray, lado: number, c: Caixa) {
  // pontos do produto (amostra) para as cores
  const amostra: number[][] = [];
  for (let y = c.y0; y <= c.y1; y += 2) {
    for (let x = c.x0; x <= c.x1; x += 2) {
      const i = (y * lado + x) * 4;
      if (px[i + 3]) amostra.push([px[i], px[i + 1], px[i + 2]]);
    }
  }
  const K = Math.min(4, amostra.length);
  const dist = (a: number[], b: number[]) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  // começo: o ponto mais distante dos já escolhidos (cores bem diferentes entre si)
  const centros: number[][] = [amostra[0] ?? [235, 233, 240]];
  while (centros.length < K) {
    let melhor = amostra[0];
    let dMax = -1;
    for (const p of amostra) {
      const d = Math.min(...centros.map((cc) => dist(p, cc)));
      if (d > dMax) {
        dMax = d;
        melhor = p;
      }
    }
    centros.push([...melhor]);
  }
  const grupoDe = (p: number[]) => {
    let g = 0;
    let dm = Infinity;
    centros.forEach((cc, k) => {
      const d = dist(p, cc);
      if (d < dm) {
        dm = d;
        g = k;
      }
    });
    return g;
  };
  for (let it = 0; it < 8; it++) {
    const soma = centros.map(() => [0, 0, 0, 0]);
    for (const p of amostra) {
      const g = grupoDe(p);
      soma[g][0] += p[0];
      soma[g][1] += p[1];
      soma[g][2] += p[2];
      soma[g][3]++;
    }
    soma.forEach((sm, k) => {
      if (sm[3]) centros[k] = [sm[0] / sm[3], sm[1] / sm[3], sm[2] / sm[3]];
    });
  }

  // em cada altura: o grupo que mais aparece nas bordas (15% de cada lado, fora o contorno)
  const h = c.y1 - c.y0 + 1;
  const janela = Math.max(2, Math.round(h * 0.02));
  const porLinha: number[] = [];
  const linhaBorda = (y: number) => {
    let ini = -1;
    let fim = -1;
    for (let x = c.x0; x <= c.x1; x++) {
      if (!px[(y * lado + x) * 4 + 3]) continue;
      if (ini < 0) ini = x;
      fim = x;
    }
    return { ini, fim };
  };
  for (let y = c.y0; y <= c.y1; y++) {
    const votos = new Array(centros.length).fill(0);
    for (let yy = Math.max(c.y0, y - janela); yy <= Math.min(c.y1, y + janela); yy++) {
      const { ini, fim } = linhaBorda(yy);
      if (ini < 0) continue;
      const w = fim - ini + 1;
      const margem = Math.max(1, Math.round(w * 0.04));
      const faixa = Math.max(1, Math.round(w * 0.15));
      for (const [xa, xb] of [
        [ini + margem, ini + margem + faixa],
        [fim - margem - faixa, fim - margem],
      ]) {
        for (let x = Math.max(ini, xa); x <= Math.min(fim, xb); x++) {
          const i = (yy * lado + x) * 4;
          if (px[i + 3]) votos[grupoDe([px[i], px[i + 1], px[i + 2]])]++;
        }
      }
    }
    porLinha.push(votos.indexOf(Math.max(...votos)));
  }
  // faixas curtas (< 5% da altura) se juntam à vizinha mais parecida
  type Faixa = { g: number; ini: number; n: number };
  let faixas: Faixa[] = [];
  porLinha.forEach((g, y) => {
    const ult = faixas[faixas.length - 1];
    if (ult && ult.g === g) ult.n++;
    else faixas.push({ g, ini: y, n: 1 });
  });
  // tons parecidos (a sombra da própria foto) ficam numa faixa só
  const parecido = 55 * 55;
  faixas = faixas.reduce<Faixa[]>((acc, x) => {
    const u = acc[acc.length - 1];
    if (u && dist(centros[u.g], centros[x.g]) < parecido) {
      if (x.n > u.n) u.g = x.g;
      u.n += x.n;
    } else acc.push({ ...x });
    return acc;
  }, []);
  const minimo = Math.max(2, Math.round(h * 0.05));
  for (let volta = 0; volta < 20 && faixas.some((f) => f.n < minimo) && faixas.length > 1; volta++) {
    const k = faixas.reduce((m, f, i) => (f.n < faixas[m].n ? i : m), 0);
    const f = faixas[k];
    const viz = [faixas[k - 1], faixas[k + 1]].filter(Boolean) as Faixa[];
    const alvo = viz.sort((a, b) => dist(centros[a.g], centros[f.g]) - dist(centros[b.g], centros[f.g]))[0];
    alvo.n += f.n;
    if (alvo === faixas[k - 1]) faixas.splice(k, 1);
    else {
      alvo.ini = f.ini;
      faixas.splice(k, 1);
    }
    // vizinhas com o mesmo grupo viram uma só
    faixas = faixas.reduce<Faixa[]>((acc, x) => {
      const u = acc[acc.length - 1];
      if (u && u.g === x.g) u.n += x.n;
      else acc.push({ ...x });
      return acc;
    }, []);
  }

  const c2 = document.createElement("canvas");
  c2.width = c2.height = lado;
  const g = c2.getContext("2d");
  if (!g) throw new Error("canvas");
  const pintar = (g0: number, y: number, n: number) => {
    const [r, gg, b] = centros[g0];
    g.fillStyle = `rgb(${Math.round(r)},${Math.round(gg)},${Math.round(b)})`;
    g.fillRect(0, y, lado, n);
  };
  // acima e abaixo do produto: a cor da ponta (cobre o chanfro e a margem)
  pintar(faixas[0].g, 0, c.y0 + faixas[0].n);
  for (const f of faixas.slice(1)) pintar(f.g, c.y0 + f.ini, f.n);
  const ultima = faixas[faixas.length - 1];
  pintar(ultima.g, c.y0 + ultima.ini, lado - (c.y0 + ultima.ini));
  // emenda suave entre as faixas (como a curva de um rótulo de verdade)
  const suave = document.createElement("canvas");
  suave.width = suave.height = lado;
  const gs = suave.getContext("2d");
  if (!gs) throw new Error("canvas");
  gs.filter = "blur(1.5px)";
  gs.drawImage(c2, 0, 0);
  return suave;
}

/** foto do verso cadastrada: recortada no fundo branco */
async function prepararVerso(url: string) {
  try {
    const img = await comTempo(baixarImagem(url), 8000);
    if (!img) return null;
    const b = desenhar(img, LADO_BASE);
    const d = b.g.getImageData(0, 0, LADO_BASE, LADO_BASE);
    const f = acharFundo(d.data, b.ret);
    if (!f) return null;
    recortar(d.data, f, LADO_BASE);
    const caixa = caixaDoRecorte(d.data, LADO_BASE);
    return caixa ? { img, caixa } : null;
  } catch {
    return null;
  }
}

/** separa os triângulos em frente (+z), verso (-z) e laterais: um material para cada */
function separarFaces(geo: THREE.BufferGeometry) {
  const plano = geo.index ? geo.toNonIndexed() : geo;
  const pos = plano.attributes.position;
  const uvs = plano.attributes.uv;
  const tri = pos.count / 3;
  const classe = new Uint8Array(tri);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let t = 0; t < tri; t++) {
    a.fromBufferAttribute(pos, t * 3);
    b.fromBufferAttribute(pos, t * 3 + 1);
    c.fromBufferAttribute(pos, t * 3 + 2);
    const n = b.sub(a).cross(c.sub(a)).normalize();
    classe[t] = n.z > 0.9 ? 0 : n.z < -0.9 ? 1 : 2;
  }
  const novaPos = new Float32Array(pos.count * 3);
  const novaUv = new Float32Array(pos.count * 2);
  const nova = new THREE.BufferGeometry();
  let k = 0;
  for (let grupo = 0; grupo < 3; grupo++) {
    const inicio = k;
    for (let t = 0; t < tri; t++) {
      if (classe[t] !== grupo) continue;
      for (let v = 0; v < 3; v++) {
        const i = t * 3 + v;
        novaPos.set([pos.getX(i), pos.getY(i), pos.getZ(i)], k * 3);
        novaUv.set([uvs.getX(i), uvs.getY(i)], k * 2);
        k++;
      }
    }
    if (k > inicio) nova.addGroup(inicio, k - inicio, grupo);
  }
  nova.setAttribute("position", new THREE.BufferAttribute(novaPos, 3));
  nova.setAttribute("uv", new THREE.BufferAttribute(novaUv, 2));
  if (plano !== geo) plano.dispose();
  return nova;
}

/** altura em cm, a partir das medidas do Hub e do conteúdo */
function alturaReal(m: MedidasAR, proporcao: number, somaLarguras2: number | null, k: number) {
  // pelo conteúdo: volume = π/4 · k · Σ(largura²)·dy · H³ (seção elíptica, foto com altura 1)
  const pelaConta =
    m.conteudo && somaLarguras2 ? Math.cbrt((m.conteudo * FOLGA_EMBALAGEM) / ((Math.PI / 4) * k * somaLarguras2)) : null;
  let peloHub: number | null = null;
  if (m.medidasCm) {
    const [a, l] = m.medidasCm;
    const maior = Math.max(a, l);
    // a foto mostra a frente: o lado maior dela é o lado maior do produto
    peloHub = proporcao <= 1 ? maior : maior / proporcao;
  }
  const estimativas = { conteudo: pelaConta, medidas: peloHub };
  if (pelaConta) return { altura: pelaConta, base: "conteudo" as BaseMedida, estimativas };
  if (peloHub) return { altura: peloHub, base: "medidas" as BaseMedida, estimativas };
  return { altura: ALTURA_PADRAO_CM, base: "aproximado" as BaseMedida, estimativas };
}

/** área de um contorno (unidades de textura²) */
function area(p: [number, number][]) {
  let a = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j][0] + p[i][0]) * (p[j][1] - p[i][1]);
  return Math.abs(a / 2);
}

/** a foto vira recorte: fundo liso, contorno não complicado demais */
function prepararFoto(img: HTMLImageElement) {
  const base = desenhar(img, LADO_BASE);
  const dados = base.g.getImageData(0, 0, LADO_BASE, LADO_BASE);
  const fundo = acharFundo(dados.data, base.ret);
  const pedacos = fundo ? contornos(fundo) : [];
  const recorte = Boolean(fundo && pedacos.length && pedacos.reduce((n, p) => n + p.length, 0) <= 1500);
  // um produto só: o maior pedaço tem quase toda a área (foto de propaganda com texto solto não serve)
  const areas = pedacos.map(area);
  const total = areas.reduce((a, b) => a + b, 0);
  const umProduto = recorte && total > 0 && Math.max(...areas) / total >= 0.85;
  return { img, base, dados, fundo, pedacos, recorte, umProduto };
}

export async function montarModeloAR(fotos: string[], medidas: MedidasAR, fotoVerso?: string): Promise<ModeloAR> {
  const lixo: { dispose: () => void }[] = [];
  const guardar = <T extends { dispose: () => void }>(x: T) => (lixo.push(x), x);

  // 1. a frente: a 1ª foto, ou a primeira das seguintes com fundo branco (algumas
  //    abrem com foto de estúdio, de fundo cinza ou com cenário); contorno em 256 px
  let escolha = prepararFoto(await baixarImagem(fotos[0]));
  if (!escolha.recorte) {
    for (let i = 1; i < Math.min(fotos.length, 4); i++) {
      const im = await comTempo(baixarImagem(fotos[i]).catch(() => null), 7000);
      if (!im) continue;
      const outra = prepararFoto(im);
      if (outra.umProduto) {
        escolha = outra;
        break;
      }
    }
  }
  const { img, base, dados, fundo, pedacos, recorte } = escolha;
  const px = dados.data;

  let uMin = base.ret.x0 / LADO_BASE;
  let uMax = base.ret.x1 / LADO_BASE;
  let vMin = 1 - base.ret.y1 / LADO_BASE;
  let vMax = 1 - base.ret.y0 / LADO_BASE;
  let somaLarguras2: number | null = null;
  let caixaFrente: Caixa | null = null;
  if (recorte && fundo) {
    recortar(px, fundo, LADO_BASE);
    // o tamanho sai do contorno que vira o modelo (sujeira e pedaço pequeno
    // descartados no contorno não podem esticar a medida)
    const molde = document.createElement("canvas");
    molde.width = molde.height = LADO_BASE;
    const gm = molde.getContext("2d", { willReadFrequently: true });
    if (!gm) throw new Error("canvas");
    gm.fillStyle = "#000";
    gm.beginPath();
    for (const p of pedacos) {
      p.forEach(([u, v], i) => (i ? gm.lineTo(u * LADO_BASE, (1 - v) * LADO_BASE) : gm.moveTo(u * LADO_BASE, (1 - v) * LADO_BASE)));
      gm.closePath();
    }
    gm.fill();
    const mascara = gm.getImageData(0, 0, LADO_BASE, LADO_BASE).data;
    let y0 = LADO_BASE;
    let y1 = -1;
    let x0 = LADO_BASE;
    let x1 = -1;
    const larguras: number[] = [];
    for (let y = 0; y < LADO_BASE; y++) {
      let n = 0;
      for (let x = 0; x < LADO_BASE; x++) {
        if (!mascara[(y * LADO_BASE + x) * 4 + 3]) continue;
        n++;
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
      }
      larguras.push(n);
      if (n) {
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
    }
    const hPx = y1 - y0 + 1;
    somaLarguras2 = larguras.slice(y0, y1 + 1).reduce((s, w) => s + (w / hPx) ** 2 / hPx, 0);
    caixaFrente = { x0, y0, x1, y1 };
    uMin = x0 / LADO_BASE;
    uMax = (x1 + 1) / LADO_BASE;
    vMin = 1 - (y1 + 1) / LADO_BASE;
    vMax = 1 - y0 / LADO_BASE;
  }
  const wTex = Math.max(uMax - uMin, 0.01);
  const hTex = Math.max(vMax - vMin, 0.01);
  const proporcao = wTex / hTex;

  // 2. tamanho real
  const [, largHub, profHub] = medidas.medidasCm ?? [0, 0, 0];
  const razaoHub = largHub && profHub ? profHub / largHub : null;
  const k = razaoHub === null ? K_PADRAO : razaoHub >= 0.85 ? 1 : limitar(razaoHub, 0.3, 1);
  const { altura, base: baseMedida, estimativas } = alturaReal(medidas, proporcao, somaLarguras2, k);
  const aproximado = baseMedida === "aproximado";
  const alturaCm = limitar(altura, 2, 60);
  const larguraCm = alturaCm * proporcao;
  const profundidadeCm = recorte ? Math.max(larguraCm * k, 0.6) : Math.min(Math.max(larguraCm * k, 0.6), 4);
  const cmPorTex = alturaCm / hTex;

  // 3. verso: foto do verso, se houver; senão, liso nas cores do produto
  let canvasVerso: HTMLCanvasElement | null = null;
  let verso: ModeloAR["verso"] = "liso";
  if (recorte && caixaFrente) {
    const achado = fotoVerso ? await prepararVerso(fotoVerso) : null;
    if (achado) {
      // o verso visto de trás: a foto vai virada, com o contorno dela em cima do contorno da frente
      const e = LADO_FOTO / LADO_BASE;
      const cf = caixaFrente;
      const cv = achado.caixa;
      canvasVerso = document.createElement("canvas");
      canvasVerso.width = canvasVerso.height = LADO_FOTO;
      const gv = canvasVerso.getContext("2d");
      if (!gv) throw new Error("canvas");
      const pequena = desenhar(achado.img, LADO_BASE);
      const dp = pequena.g.getImageData(0, 0, LADO_BASE, LADO_BASE);
      const fp = acharFundo(dp.data, pequena.ret);
      if (fp) recortar(dp.data, fp, LADO_BASE);
      sangrar(dp.data, LADO_BASE);
      pequena.g.putImageData(dp, 0, 0);
      const grandeVerso = desenhar(achado.img, LADO_FOTO);
      const dg = grandeVerso.g.getImageData(0, 0, LADO_FOTO, LADO_FOTO);
      const fg = acharFundo(dg.data, grandeVerso.ret, LADO_FOTO);
      if (fg) recortar(dg.data, fg, LADO_FOTO);
      grandeVerso.g.putImageData(dg, 0, 0);
      // ponto (x, y) do verso (em px de 256) → (x1 da frente − (x − x0 do verso)·rx, y0 da frente + (y − y0)·ry), em 1024
      const rx = (cf.x1 - cf.x0 + 1) / (cv.x1 - cv.x0 + 1);
      const ry = (cf.y1 - cf.y0 + 1) / (cv.y1 - cv.y0 + 1);
      // fundo: a cor espalhada do próprio verso, cobrindo a tela toda
      gv.drawImage(pequena.c, 0, 0, LADO_FOTO, LADO_FOTO);
      gv.save();
      gv.translate((cf.x1 + 1) * e, cf.y0 * e);
      gv.scale(-rx * e, ry * e);
      gv.translate(-cv.x0, -cv.y0);
      gv.imageSmoothingQuality = "high";
      gv.drawImage(pequena.c, 0, 0);
      gv.scale(1 / e, 1 / e);
      gv.drawImage(grandeVerso.c, 0, 0);
      gv.restore();
      verso = "foto";
    } else {
      canvasVerso = versoLiso(px, LADO_BASE, caixaFrente);
    }
  }

  // 4. textura: foto grande recortada por cima da cor da borda espalhada
  sangrar(px, LADO_BASE);
  base.g.putImageData(dados, 0, 0);
  const grande = desenhar(img, LADO_FOTO);
  if (recorte) {
    const dd = grande.g.getImageData(0, 0, LADO_FOTO, LADO_FOTO);
    const f = acharFundo(dd.data, grande.ret, LADO_FOTO);
    if (f) recortar(dd.data, f, LADO_FOTO);
    grande.g.putImageData(dd, 0, 0);
  }
  const final = document.createElement("canvas");
  final.width = final.height = LADO_FOTO;
  const gf = final.getContext("2d");
  if (!gf) throw new Error("canvas");
  if (recorte) {
    gf.imageSmoothingQuality = "high";
    gf.drawImage(base.c, 0, 0, LADO_FOTO, LADO_FOTO);
  } else {
    gf.fillStyle = "#ffffff";
    gf.fillRect(0, 0, LADO_FOTO, LADO_FOTO);
  }
  gf.drawImage(grande.c, 0, 0);
  const tex = guardar(new THREE.CanvasTexture(final));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  // no arquivo 3D vai em JPEG (bem menor que PNG; a foto é opaca)
  tex.userData.mimeType = "image/jpeg";
  // laterais: a mesma foto bem desfocada, pequena — a cor da borda corre pela
  // lateral sem os riscos de esticar um pixel só
  const desfocada = document.createElement("canvas");
  desfocada.width = desfocada.height = 128;
  const gd = desfocada.getContext("2d");
  if (!gd) throw new Error("canvas");
  gd.filter = "blur(3px)";
  gd.drawImage(final, -8, -8, 144, 144);
  gd.filter = "none";
  gd.drawImage(desfocada, 0, 0);
  const texLado = guardar(new THREE.CanvasTexture(desfocada));
  texLado.colorSpace = THREE.SRGBColorSpace;
  texLado.userData.mimeType = "image/jpeg";

  // 5. geometria (em unidades da foto; depois vai para metros)
  const profTex = profundidadeCm / cmPorTex;
  let geoBase: THREE.BufferGeometry;
  if (recorte) {
    const chanfro = Math.min(0.4, profundidadeCm * 0.25, larguraCm * 0.05) / cmPorTex;
    const formas = pedacos.map((p) => new THREE.Shape(p.map(([u, v]) => new THREE.Vector2(u, v))));
    geoBase = new THREE.ExtrudeGeometry(formas, {
      depth: Math.max(profTex - 2 * chanfro, profTex * 0.2),
      steps: 1,
      curveSegments: 1,
      bevelEnabled: true,
      bevelThickness: chanfro,
      bevelSize: chanfro,
      bevelOffset: -chanfro,
      bevelSegments: 3,
    });
    geoBase.translate(0, 0, -chanfro);
  } else {
    // foto com cenário: placa com a foto inteira (como um display de balcão)
    geoBase = new THREE.BoxGeometry(wTex, hTex, profTex);
    geoBase.translate((uMin + uMax) / 2, (vMin + vMax) / 2, profTex / 2);
  }
  // foto projetada de frente em tudo: uv = posição na foto
  const pos = geoBase.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = limitar(pos.getX(i), 0, 1);
    uv[i * 2 + 1] = limitar(pos.getY(i), 0, 1);
  }
  geoBase.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  // grupos: 0 = frente (foto), 1 = verso, 2 = laterais e chanfro (foto desfocada)
  const separada = separarFaces(geoBase);
  geoBase.dispose();
  geoBase = separada;
  geoBase.computeBoundingBox();
  const caixa = geoBase.boundingBox!;
  geoBase.translate(-(uMin + uMax) / 2, -vMin, -(caixa.min.z + caixa.max.z) / 2);
  geoBase.scale(cmPorTex / 100, cmPorTex / 100, cmPorTex / 100);
  // sombreado suave nas curvas do chanfro, quina viva entre frente e lateral reta
  // (a extrusão já vem sem índice e volta a mesma geometria; a caixa volta uma nova)
  const geo = guardar(toCreasedNormals(geoBase, THREE.MathUtils.degToRad(50)));
  if (geo !== geoBase) geoBase.dispose();

  let texVerso = texLado;
  if (canvasVerso) {
    texVerso = guardar(new THREE.CanvasTexture(canvasVerso));
    texVerso.colorSpace = THREE.SRGBColorSpace;
    texVerso.anisotropy = 8;
    texVerso.userData.mimeType = "image/jpeg";
  }
  const materiais = [
    guardar(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.38, metalness: 0 })),
    guardar(new THREE.MeshStandardMaterial({ map: texVerso, roughness: 0.38, metalness: 0 })),
    guardar(new THREE.MeshStandardMaterial({ map: texLado, roughness: 0.38, metalness: 0 })),
  ];
  const objeto = new THREE.Mesh(geo, materiais);
  objeto.name = "produto";
  return {
    objeto,
    base: baseMedida,
    estimativas,
    verso,
    alturaCm,
    larguraCm,
    profundidadeCm,
    aproximado,
    descartar: () => lixo.forEach((x) => x.dispose()),
  };
}
