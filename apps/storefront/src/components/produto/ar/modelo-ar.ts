/**
 * Produto em 3D, em TAMANHO REAL, para o "Ver no seu espaço" (realidade
 * aumentada). Não existe modelo 3D dos produtos: ele é montado da foto do Hub,
 * com as mesmas etapas da loja 3D (lib em components/loja3d/produto3d.ts):
 * tira o fundo branco, acha o contorno e dá volume.
 *
 * Tamanho real, nesta ordem:
 * 1. conteúdo do nome ("500 ML"): o volume do frasco desenhado pela foto tem
 *    que caber o conteúdo (com folga de embalagem) → dá a altura;
 * 2. medidas do Hub (altura × largura × profundidade): valem quando batem com
 *    a conta do conteúdo (as do Hub às vezes são da caixa de envio);
 * 3. sem nada: 15 cm, avisando que é aproximado.
 * A profundidade segue a proporção largura × profundidade do Hub (ou 0,7).
 *
 * Tudo em metros, base no chão (y = 0), frente para +z. A foto é projetada de
 * frente: a frente é a foto recortada e o verso, a foto espelhada; as laterais
 * levam a cor da borda do produto (a mesma foto, desfocada).
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

export interface ModeloAR {
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
/** a embalagem ocupa mais que o conteúdo (parede, tampa, ar) */
const FOLGA_EMBALAGEM = 1.3;
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
  if (pelaConta && peloHub) {
    const r = peloHub / pelaConta;
    return { altura: r >= 0.7 && r <= 1.45 ? peloHub : pelaConta, aproximado: false };
  }
  if (peloHub) return { altura: peloHub, aproximado: false };
  if (pelaConta) return { altura: pelaConta, aproximado: false };
  return { altura: ALTURA_PADRAO_CM, aproximado: true };
}

export async function montarModeloAR(url: string, medidas: MedidasAR): Promise<ModeloAR> {
  const img = await baixarImagem(url);
  const lixo: { dispose: () => void }[] = [];
  const guardar = <T extends { dispose: () => void }>(x: T) => (lixo.push(x), x);

  // 1. contorno na resolução da loja 3D (256)
  const base = desenhar(img, LADO_BASE);
  const dados = base.g.getImageData(0, 0, LADO_BASE, LADO_BASE);
  const px = dados.data;
  const fundo = acharFundo(px, base.ret);
  const pedacos = fundo ? contornos(fundo) : [];
  const recorte = Boolean(fundo && pedacos.length && pedacos.reduce((n, p) => n + p.length, 0) <= 1500);

  let uMin = base.ret.x0 / LADO_BASE;
  let uMax = base.ret.x1 / LADO_BASE;
  let vMin = 1 - base.ret.y1 / LADO_BASE;
  let vMax = 1 - base.ret.y0 / LADO_BASE;
  let somaLarguras2: number | null = null;
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
  const k = largHub && profHub ? limitar(profHub / largHub, 0.3, 1) : 0.7;
  const { altura, aproximado } = alturaReal(medidas, proporcao, somaLarguras2, k);
  const alturaCm = limitar(altura, 2, 60);
  const larguraCm = alturaCm * proporcao;
  const profundidadeCm = recorte ? Math.max(larguraCm * k, 0.6) : Math.min(Math.max(larguraCm * k, 0.6), 4);
  const cmPorTex = alturaCm / hTex;

  // 3. textura: foto grande recortada por cima da cor da borda espalhada
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

  // 4. geometria (em unidades da foto; depois vai para metros)
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
  // grupos: 0 = frente e verso (foto nítida), 1 = laterais e chanfro (foto desfocada)
  if (!recorte) {
    // caixa: 4 vértices por face (+x, -x, +y, -y, +z, -z); frente e verso = 4 últimas
    geoBase.clearGroups();
    const idx = geoBase.index!.count / 6;
    geoBase.addGroup(0, idx * 4, 1);
    geoBase.addGroup(idx * 4, idx * 2, 0);
  }
  geoBase.computeBoundingBox();
  const caixa = geoBase.boundingBox!;
  geoBase.translate(-(uMin + uMax) / 2, -vMin, -(caixa.min.z + caixa.max.z) / 2);
  geoBase.scale(cmPorTex / 100, cmPorTex / 100, cmPorTex / 100);
  // sombreado suave nas curvas do chanfro, quina viva entre frente e lateral reta
  // (a extrusão já vem sem índice e volta a mesma geometria; a caixa volta uma nova)
  const geo = guardar(toCreasedNormals(geoBase, THREE.MathUtils.degToRad(50)));
  if (geo !== geoBase) geoBase.dispose();

  const materiais = [
    guardar(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.38, metalness: 0 })),
    guardar(new THREE.MeshStandardMaterial({ map: texLado, roughness: 0.38, metalness: 0 })),
  ];
  const objeto = new THREE.Mesh(geo, materiais);
  objeto.name = "produto";
  return {
    objeto,
    alturaCm,
    larguraCm,
    profundidadeCm,
    aproximado,
    descartar: () => lixo.forEach((x) => x.dispose()),
  };
}
