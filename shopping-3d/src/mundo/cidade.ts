/**
 * A cidade em volta do shopping (a mesma da loja 3D dos sites, aqui no fim
 * de tarde): céu lilás e pêssego com nuvens, morros de mata atlântica no
 * horizonte (com um "Pão de Açúcar"), a rua da frente com faixa de pedestres,
 * coqueiros e postes na calçada, e quarteirões de prédios — residenciais em
 * tons claros e pastel, com lojinhas e toldos no térreo, e torres de vidro mais
 * longe. É só paisagem: o passeio é no shopping e na praça da frente.
 *
 * Qualidade: as fachadas, o asfalto e as calçadas têm cor, relevo e brilho
 * (texturas-cidade.ts) e são iluminados pelo mesmo sol da loja, com o céu
 * refletido nos vidros. A névoa da distância (mais longe, mais claro e
 * azulado) é feita no próprio material, ponto a ponto. Cada tipo de coisa é
 * uma malha só, e no celular as texturas são menores.
 *
 * Perto da loja os prédios são baixos e vão subindo com a distância: da vista
 * de cima (de 14 a 70 m da loja, inclinada pelo menos 28°) nenhum prédio fica
 * na frente da loja nem engole a câmera.
 */
import * as THREE from "three";
import {
  texturaFolha,
  texturaMorro,
  texturaToldo,
  texturasAsfalto,
  texturasCimento,
  texturasFachada,
  texturasTelhado,
  texturasTerreo,
  texturasTronco,
  texturasVidro,
  type TexturaPbr,
} from "./texturas-cidade";

export interface Cidade {
  grupo: THREE.Group;
  /** céu (fundo da cena) */
  ceu: THREE.Texture;
  /** desenha as texturas de alta qualidade aos poucos (uma por quadro), depois que a loja já abriu */
  detalhar: () => Promise<void>;
  descartar: () => void;
}

export interface OpcoesCidade {
  renderer: THREE.WebGLRenderer;
  /** quarteirão da loja (a loja, a calçada e o pátio dela são da cena) */
  quarteirao: { x0: number; x1: number; z0: number; z1: number };
  /** celular: texturas menores */
  leve: boolean;
  fonte: string;
  /** coqueiros a mais, dentro do quarteirão (praça da frente, estacionamento) */
  coqueiros?: [number, number][];
}

const RUA = 10; // largura das ruas
const MEIO_FIO = 0.15; // a calçada é mais alta que a rua
const QUADRA = 42; // lado dos quarteirões da cidade
const ALCANCE = 240; // até onde vão os prédios
const ANDAR = 3; // altura de um andar
const TERREO = 4.5; // pé-direito das lojinhas do térreo
const NEVOA = new THREE.Color("#eadbd6"); // cor do horizonte no fim de tarde (a névoa puxa para ela)

function sorteio(semente: number) {
  let s = semente;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

/** céu de fim de tarde: azul em cima, lilás e pêssego no horizonte, cúmulos rosados e o brilho do sol na direção da luz do shopping */
function texturaCeu(w: number): THREE.CanvasTexture {
  const h = w / 2;
  const acaso = sorteio(7);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  if (g) {
    // no mapa do céu, y = 0 é o alto e y = h/2 é o horizonte
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, "#4d6cb6");
    gr.addColorStop(0.24, "#7f8fcd");
    gr.addColorStop(0.38, "#b9a6d8");
    gr.addColorStop(0.45, "#e9bdb6");
    gr.addColorStop(0.49, "#f7d4b6");
    gr.addColorStop(0.5, "#f3dccb");
    gr.addColorStop(1, "#d8cdc8");
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    // o sol: baixo, na frente da fachada (atrás de quem olha o shopping), como a luz que faz as sombras;
    // em volta dele o horizonte esquenta
    const sx = w * 0.85;
    const sy = h * 0.34;
    for (const desloc of [0, -w, w]) {
      const halo = g.createRadialGradient(sx + desloc, h * 0.47, 0, sx + desloc, h * 0.47, h * 0.55);
      halo.addColorStop(0, "rgba(255,196,140,0.55)");
      halo.addColorStop(0.4, "rgba(255,186,150,0.22)");
      halo.addColorStop(1, "rgba(255,180,160,0)");
      g.fillStyle = halo;
      g.fillRect(0, 0, w, h);
    }
    const sol = g.createRadialGradient(sx, sy, 0, sx, sy, h * 0.3);
    sol.addColorStop(0, "rgba(255,246,226,0.95)");
    sol.addColorStop(0.07, "rgba(255,226,190,0.5)");
    sol.addColorStop(1, "rgba(255,214,180,0)");
    g.fillStyle = sol;
    g.fillRect(0, 0, w, h);
    // cúmulos: grupos de bolas macias, brancas em cima e cinza-azuladas embaixo
    const bola = (x: number, y: number, r: number, cor: string, alfa: number, achata: number) => {
      for (const desloc of [0, -w, w]) {
        g.save();
        g.translate(x + desloc, y);
        g.scale(1, achata);
        const b = g.createRadialGradient(0, 0, 0, 0, 0, r);
        b.addColorStop(0, `rgba(${cor},${alfa})`);
        b.addColorStop(0.55, `rgba(${cor},${alfa * 0.6})`);
        b.addColorStop(1, `rgba(${cor},0)`);
        g.fillStyle = b;
        g.beginPath();
        g.arc(0, 0, r, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
    };
    for (let n = 0; n < 46; n++) {
      const cy = h * (0.14 + acaso() * 0.3);
      const cx = acaso() * w;
      const perto = (cy / h - 0.14) / 0.3; // 1 = perto do horizonte (menor e mais achatada)
      const achata = 0.6 - perto * 0.25;
      const tam = h * (0.05 - perto * 0.025) * (0.6 + acaso() * 0.8);
      const pedacos = 6 + Math.floor(acaso() * 8);
      for (let k = 0; k < pedacos; k++) {
        const x = cx + (acaso() - 0.5) * tam * 4.5;
        const y = cy + (acaso() - 0.6) * tam * 1.1 * achata;
        const r = tam * (0.55 + acaso() * 0.7);
        bola(x, y + r * 0.35 * achata, r * 1.05, "190,160,196", 0.32, achata); // base na sombra, lilás
        bola(x, y, r, "255,236,226", 0.6, achata); // topo pegando o sol da tarde
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.mapping = THREE.EquirectangularReflectionMapping;
  return t;
}

/** junta quadriláteros com uv e cor por vértice numa malha só */
class Lote {
  pos: number[] = [];
  uv: number[] = [];
  cor: number[] = [];
  idx: number[] = [];
  /** a, b, c, d em volta (anti-horário visto de fora); uv e cor na mesma ordem */
  quad(p: number[][], uv: number[][], cor: THREE.Color[]) {
    const base = this.pos.length / 3;
    for (let k = 0; k < 4; k++) {
      this.pos.push(p[k][0], p[k][1], p[k][2]);
      this.uv.push(uv[k][0], uv[k][1]);
      this.cor.push(cor[k].r, cor[k].g, cor[k].b);
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  malha(m: THREE.Material): THREE.Mesh {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(this.cor, 3));
    geo.setIndex(this.idx);
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    const malha = new THREE.Mesh(geo, m);
    malha.matrixAutoUpdate = false;
    return malha;
  }
}

/**
 * A névoa da distância no próprio material: a cor final puxa para a do
 * horizonte conforme a distância até a loja (nada até 50 m, o máximo a 350 m).
 * É calculada ponto a ponto — no chão, que é um quadrado só, por vértice não daria.
 */
function comNevoa<T extends THREE.Material>(m: T, centro: THREE.Vector2, maximo = 0.62): T {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uNevoa = { value: NEVOA };
    sh.uniforms.uCentro = { value: centro };
    sh.uniforms.uNevoaMax = { value: maximo };
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vChao;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvChao = (modelMatrix * vec4(transformed, 1.0)).xz;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 uNevoa;\nuniform vec2 uCentro;\nuniform float uNevoaMax;\nvarying vec2 vChao;")
      .replace(
        "#include <fog_fragment>",
        "#include <fog_fragment>\ngl_FragColor.rgb = mix(gl_FragColor.rgb, uNevoa, clamp((length(vChao - uCentro) - 50.0) / 300.0, 0.0, uNevoaMax));"
      );
  };
  return m;
}

export function criarCidade(o: OpcoesCidade): Cidade {
  const grupo = new THREE.Group();
  grupo.name = "cidade";
  const descartaveis: { dispose: () => void }[] = [];
  const guardar = <T extends { dispose: () => void }>(x: T) => (descartaveis.push(x), x);
  const acaso = sorteio(97);
  const q = o.quarteirao;
  const centro = new THREE.Vector2((q.x0 + q.x1) / 2, (q.z0 + q.z1) / 2);
  const aniso = Math.min(o.leve ? 4 : 16, o.renderer.capabilities.getMaxAnisotropy());
  // no celular, metade: a cidade é paisagem lá longe (e cada textura é memória de vídeo)
  const lado = o.leve ? 512 : 2048;

  // ---- céu (fundo) e o reflexo dele nos vidros e nas fachadas
  const ceu = guardar(texturaCeu(o.leve ? 1024 : 2048));
  const pmrem = new THREE.PMREMGenerator(o.renderer);
  const reflexoCeu = guardar(pmrem.fromEquirectangular(ceu).texture);
  pmrem.dispose();

  // as texturas boas levam alguns segundos para desenhar: o material nasce com a cor média
  // (a cidade já aparece) e a textura entra depois, em detalhar()
  const tarefas: (() => void)[] = [];
  const pbr = (gerar: () => TexturaPbr, corMedia: string, extra: THREE.MeshStandardMaterialParameters = {}) => {
    const m = comNevoa(
      guardar(
        new THREE.MeshStandardMaterial({
          color: corMedia,
          roughness: 0.85,
          metalness: 0,
          envMap: reflexoCeu,
          envMapIntensity: 0.75,
          vertexColors: true,
          ...extra,
        })
      ),
      centro
    );
    tarefas.push(() => {
      const t = gerar();
      Object.assign(m, { map: guardar(t.cor), normalMap: guardar(t.normal), roughnessMap: guardar(t.rugosidade), roughness: 1 });
      m.color.set("#ffffff");
      m.needsUpdate = true;
    });
    return m;
  };
  const liso = (extra: THREE.MeshStandardMaterialParameters = {}) =>
    comNevoa(guardar(new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0, envMap: reflexoCeu, envMapIntensity: 0.6, vertexColors: true, ...extra })), centro);

  // a ordem é a do que aparece primeiro na tela: a rua e os prédios da frente
  const matAsfalto = pbr(() => texturasAsfalto(o.leve ? 512 : 1024, aniso), "#505256");
  const matTerreo = pbr(() => texturasTerreo(lado * 2, aniso, o.fonte), "#b9b4ab");
  const matFachada = pbr(() => texturasFachada(lado, aniso), "#e3ded6");
  const matCalcada = pbr(() => texturasCimento(o.leve ? 512 : 1024, aniso), "#c4c0b8");
  const matTronco = pbr(() => texturasTronco(aniso), "#7d6e5a");
  const matVidro = pbr(() => texturasVidro(lado, aniso), "#3c4b59", { metalness: 0.25, roughness: 0.1, envMapIntensity: 1.15 });
  const matTelhado = pbr(() => texturasTelhado(o.leve ? 256 : 512, aniso), "#a5a39e");
  const matPintura = liso({ side: THREE.DoubleSide });
  const matMetal = liso({ roughness: 0.45, metalness: 0.6 });
  // tinta no asfalto: 2 cm acima e puxada para a frente na profundidade (de longe não briga com o asfalto)
  const matSinalizacao = liso({ roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const matToldo = liso({ map: guardar(texturaToldo()), side: THREE.DoubleSide, roughness: 0.85 });
  const matFolha = liso({ map: guardar(texturaFolha(aniso)), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.7 });
  // os morros, bem longe, com menos névoa que o máximo (senão somem no horizonte)
  const matMorro = comNevoa(guardar(new THREE.MeshBasicMaterial({ map: guardar(texturaMorro()), vertexColors: true, side: THREE.DoubleSide })), centro, 0.42);

  const novo = () => new Lote();
  const asfalto = novo();
  const calcada = novo();
  const fachada = novo();
  const terreo = novo();
  const vidro = novo();
  const telhado = novo();
  const pintura = novo();
  const metal = novo();
  const sinalizacao = novo();
  const toldos = novo();
  const troncos = novo();
  const folhas = novo();
  const morros = novo();

  const branco = new THREE.Color("#ffffff");
  /** chão ou tampa virada para cima, uv em metros / `tile` */
  const plano = (l: Lote, x0: number, x1: number, z0: number, z1: number, y: number, tile: number, cor = branco) =>
    l.quad(
      [
        [x0, y, z1],
        [x1, y, z1],
        [x1, y, z0],
        [x0, y, z0],
      ],
      [
        [x0 / tile, -z1 / tile],
        [x1 / tile, -z1 / tile],
        [x1 / tile, -z0 / tile],
        [x0 / tile, -z0 / tile],
      ],
      [cor, cor, cor, cor]
    );

  type Face = { a: [number, number]; b: [number, number]; comp: number; fora: [number, number] };
  const faces = (x0: number, x1: number, z0: number, z1: number): Face[] => [
    { a: [x0, z1], b: [x1, z1], comp: x1 - x0, fora: [0, 1] },
    { a: [x1, z1], b: [x1, z0], comp: z1 - z0, fora: [1, 0] },
    { a: [x1, z0], b: [x0, z0], comp: x1 - x0, fora: [0, -1] },
    { a: [x0, z0], b: [x0, z1], comp: z1 - z0, fora: [-1, 0] },
  ];
  /** faixa de parede em volta do retângulo, de y0 a y1; u em metros / tileU (a partir de u0), v de v0 a v1 */
  function faixa(l: Lote, x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, tileU: number, u0: number, v0: number, v1: number, cor: THREE.Color, sombraNoPe = 1) {
    const pe = cor.clone().multiplyScalar(sombraNoPe);
    for (const f of faces(x0, x1, z0, z1)) {
      const u1 = u0 + f.comp / tileU;
      l.quad(
        [
          [f.a[0], y0, f.a[1]],
          [f.b[0], y0, f.b[1]],
          [f.b[0], y1, f.b[1]],
          [f.a[0], y1, f.a[1]],
        ],
        [
          [u0, v0],
          [u1, v0],
          [u1, v1],
          [u0, v1],
        ],
        [pe, pe, cor, cor]
      );
    }
  }
  /** caixinha simples (poste, caixa d'água, meio-fio): paredes e tampa, uv em metros */
  function caixa(l: Lote, x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, cor: THREE.Color, tampa = true) {
    faixa(l, x0, x1, z0, z1, y0, y1, 4, 0, y0 / 4, y1 / 4, cor);
    if (tampa) plano(l, x0, x1, z0, z1, y1, 4, cor);
  }

  // ---- chão: asfalto em tudo; os quarteirões são calçadas 15 cm mais altas
  const R = ALCANCE + 160;
  plano(asfalto, -R, R, -R, R, -MEIO_FIO, 8);
  const meioFio = new THREE.Color("#c9c6bf");
  caixa(pintura, q.x0, q.x1, q.z0, q.z1, -MEIO_FIO, -0.01, meioFio, false);

  // cores das fachadas (Rio: muito branco e bege, alguns tons pastel), dos vidros e dos toldos
  const CORES_FACHADA = ["#ffffff", "#f6eedd", "#f1e5d1", "#f5ddd2", "#f6eabf", "#dcebdf", "#ebe6df", "#eed7c5", "#e1e8ee", "#f2d7d9"].map((c) => new THREE.Color(c));
  const CORES_VIDRO = ["#ffffff", "#dfeaf2", "#d6e8df", "#f0e6d8"].map((c) => new THREE.Color(c));
  const CORES_TOLDO = ["#b8322e", "#2d6a4a", "#2c4f8c", "#d39a2a", "#c95a2c", "#3d3d3d"].map((c) => new THREE.Color(c));
  const GELO = new THREE.Color("#f3f2ee");

  /** um prédio: térreo com lojinhas (e toldos, se está perto), andares, marquise, cornija e cobertura */
  function predio(x0: number, x1: number, z0: number, z1: number, andares: number, torre: boolean, perto: boolean) {
    const h = TERREO + andares * ANDAR;
    // começa numa loja inteira do térreo (8 de 6 m) e num vão inteiro da fachada (4 de 6 m)
    faixa(terreo, x0, x1, z0, z1, 0, TERREO, 48, Math.floor(acaso() * 8) / 8, 0, 1, branco, 0.8);
    const u0 = Math.floor(acaso() * 4) / 4;
    const v0 = Math.floor(acaso() * 4) / 4;
    if (torre) {
      const cor = CORES_VIDRO[Math.floor(acaso() * CORES_VIDRO.length)];
      faixa(vidro, x0, x1, z0, z1, TERREO, h, 24, u0, v0, v0 + (h - TERREO) / 12, cor);
      // coroamento opaco e casa de máquinas
      faixa(pintura, x0, x1, z0, z1, h, h + 1.2, 4, 0, 0, 0.3, GELO);
      plano(telhado, x0, x1, z0, z1, h + 1.2, 10, GELO);
      caixa(pintura, x0 + (x1 - x0) * 0.3, x0 + (x1 - x0) * 0.7, z0 + (z1 - z0) * 0.3, z0 + (z1 - z0) * 0.7, h + 1.2, h + 4, GELO);
      return;
    }
    const cor = CORES_FACHADA[Math.floor(acaso() * CORES_FACHADA.length)];
    faixa(fachada, x0, x1, z0, z1, TERREO, h, 24, u0, v0, v0 + (h - TERREO) / 12, cor);
    // marquise do térreo e cornija no alto (saltadas da parede)
    caixa(pintura, x0 - 0.25, x1 + 0.25, z0 - 0.25, z1 + 0.25, TERREO - 0.05, TERREO + 0.2, cor);
    caixa(pintura, x0 - 0.18, x1 + 0.18, z0 - 0.18, z1 + 0.18, h - 0.1, h + 0.45, cor, false);
    plano(telhado, x0, x1, z0, z1, h + 0.05, 10, branco);
    if (andares > 2) {
      const cx = x0 + (x1 - x0) * (0.3 + acaso() * 0.4);
      const cz = z0 + (z1 - z0) * (0.3 + acaso() * 0.4);
      caixa(pintura, cx - 2, cx + 2, cz - 1.5, cz + 1.5, h + 0.05, h + 2.6, cor);
    }
    if (!perto) return;
    // toldos listrados em cima das vitrines: a textura do térreo tem uma loja a cada 6 m
    // e cada face começa no começo de uma loja
    for (const f of faces(x0, x1, z0, z1)) {
      const dir = [(f.b[0] - f.a[0]) / f.comp, (f.b[1] - f.a[1]) / f.comp];
      for (let s = 0; s + 6 <= f.comp; s += 6) {
        if (acaso() < 0.35) continue;
        const cor2 = CORES_TOLDO[Math.floor(acaso() * CORES_TOLDO.length)];
        const pA = [f.a[0] + dir[0] * (s + 0.6), f.a[1] + dir[1] * (s + 0.6)];
        const pB = [f.a[0] + dir[0] * (s + 5.5), f.a[1] + dir[1] * (s + 5.5)];
        const [fx, fz] = [f.fora[0] * 1.15, f.fora[1] * 1.15];
        const yAlto = 3.4;
        const yBaixo = 2.85;
        const listras = 4.9 / 2.4;
        toldos.quad(
          [
            [pA[0] + fx, yBaixo, pA[1] + fz],
            [pB[0] + fx, yBaixo, pB[1] + fz],
            [pB[0], yAlto, pB[1]],
            [pA[0], yAlto, pA[1]],
          ],
          [
            [0, 0],
            [listras, 0],
            [listras, 1],
            [0, 1],
          ],
          [cor2, cor2, cor2, cor2]
        );
        // a barra da frente do toldo
        toldos.quad(
          [
            [pA[0] + fx, yBaixo - 0.25, pA[1] + fz],
            [pB[0] + fx, yBaixo - 0.25, pB[1] + fz],
            [pB[0] + fx, yBaixo, pB[1] + fz],
            [pA[0] + fx, yBaixo, pA[1] + fz],
          ],
          [
            [0, 0],
            [listras, 0],
            [listras, 0.2],
            [0, 0.2],
          ],
          [cor2, cor2, cor2, cor2]
        );
      }
    }
  }

  // ---- quarteirões: a grade das ruas parte do quarteirão da loja
  const xs: [number, number][] = [[q.x0, q.x1]];
  const zs: [number, number][] = [[q.z0, q.z1]];
  for (let x = q.x1 + RUA; x < ALCANCE; x += QUADRA + RUA) xs.push([x, x + QUADRA]);
  for (let x = q.x0 - RUA; x > -ALCANCE; x -= QUADRA + RUA) xs.unshift([x - QUADRA, x]);
  for (let z = q.z1 + RUA; z < ALCANCE; z += QUADRA + RUA) zs.push([z, z + QUADRA]);
  for (let z = q.z0 - RUA; z > -ALCANCE; z -= QUADRA + RUA) zs.unshift([z - QUADRA, z]);

  /** altura máxima para não tampar a loja vista de cima: sobe meio metro a cada metro de distância */
  // em volta do shopping a cidade é mais baixa: os prédios sobem devagar com a distância
  const alturaMax = (d: number) => THREE.MathUtils.clamp(0.3 * (d - 8), 7.5, 80);
  const distRet = (x0: number, x1: number, z0: number, z1: number) =>
    Math.hypot(Math.max(x0 - centro.x, 0, centro.x - x1), Math.max(z0 - centro.y, 0, centro.y - z1));

  for (const [x0, x1] of xs) {
    for (const [z0, z1] of zs) {
      if (x0 === q.x0 && z0 === q.z0) continue; // o quarteirão da loja é da cena
      plano(calcada, x0, x1, z0, z1, 0, 4);
      caixa(pintura, x0, x1, z0, z1, -MEIO_FIO, 0, meioFio, false);
      // lotes: 2 a 3 em cada direção, com recuo de 3 m da calçada
      const nx = 2 + Math.floor(acaso() * 2);
      const nz = 2 + Math.floor(acaso() * 2);
      const lx = (x1 - x0 - 6) / nx;
      const lz = (z1 - z0 - 6) / nz;
      for (let i = 0; i < nx; i++) {
        for (let k = 0; k < nz; k++) {
          if (nx === 3 && nz === 3 && i === 1 && k === 1) continue; // pátio no miolo
          const bx0 = x0 + 3 + i * lx + 0.6;
          const bx1 = bx0 + lx - 1.2 - acaso() * 2;
          const bz0 = z0 + 3 + k * lz + 0.6;
          const bz1 = bz0 + lz - 1.2 - acaso() * 2;
          const d = distRet(bx0, bx1, bz0, bz1);
          const max = alturaMax(d);
          const torre = max > 38 && acaso() < 0.4;
          const teto = torre ? max : Math.min(max, 42);
          const andares = Math.max(1, Math.floor(((torre ? 0.6 : 0.4) + acaso() * 0.4) * ((teto - TERREO) / ANDAR)));
          predio(bx0, bx1, bz0, bz1, andares, torre, d < 95);
        }
      }
    }
  }

  // ---- rua da frente: faixa amarela no meio e faixa de pedestres na porta da loja
  const amarelo = new THREE.Color("#e8b62a");
  const branca = new THREE.Color("#eeeeea");
  const meioRua = q.z1 + RUA / 2;
  const yTinta = -MEIO_FIO + 0.02;
  for (let x = -150; x < 150; x += 6) if (Math.abs(x) > 4) plano(sinalizacao, x, x + 3, meioRua - 0.06, meioRua + 0.06, yTinta, 1, amarelo);
  for (let k = 0; k < 9; k++) {
    const z = q.z1 + 0.6 + k * ((RUA - 1.2) / 8.5);
    plano(sinalizacao, -2.2, 2.2, z, z + 0.5, yTinta, 1, branca);
  }

  // ---- morros no horizonte: um anel com picos arredondados, azulados pela distância
  {
    const N = 200;
    const picos = Array.from({ length: 9 }, () => ({ a: acaso() * Math.PI * 2, h: 70 + acaso() * 120, larg: 0.12 + acaso() * 0.22 }));
    picos.push({ a: Math.PI * 0.42, h: 175, larg: 0.07 }); // o "pão de açúcar"
    const altura = (a: number) => {
      let h = 18 + 10 * Math.sin(a * 5) + 6 * Math.sin(a * 13);
      for (const p of picos) {
        let d = Math.abs(a - p.a);
        d = Math.min(d, Math.PI * 2 - d);
        h = Math.max(h, p.h * Math.exp(-(d * d) / (2 * p.larg * p.larg)));
      }
      return h;
    };
    const pe = new THREE.Color("#c7d1cc");
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * Math.PI * 2;
      const a1 = ((i + 1) / N) * Math.PI * 2;
      const r0 = 470 + 25 * Math.sin(a0 * 3);
      const r1 = 470 + 25 * Math.sin(a1 * 3);
      const p = (a: number, r: number, y: number) => [centro.x + Math.sin(a) * r, y, centro.y - Math.cos(a) * r];
      const h0 = altura(a0);
      const h1 = altura(a1);
      // v = 1 no topo (pedra) e 0 no pé; u dá 24 voltas da textura no anel
      morros.quad(
        [p(a0, r0, -5), p(a1, r1, -5), p(a1, r1, h1), p(a0, r0, h0)],
        [
          [(i / N) * 24, 0],
          [((i + 1) / N) * 24, 0],
          [((i + 1) / N) * 24, Math.min(1, h1 / 180)],
          [(i / N) * 24, Math.min(1, h0 / 180)],
        ],
        [pe, pe, branco, branco]
      );
    }
  }

  // ---- coqueiro: tronco com anéis que inclina um pouco e uma coroa de folhas arqueadas
  function coqueiro(x: number, beira: number) {
    const alt = 7 + acaso() * 2.5;
    const incl = (acaso() - 0.5) * 0.6;
    const seg = 8;
    for (let s = 0; s < seg; s++) {
      const y0 = (s / seg) * alt;
      const y1 = ((s + 1) / seg) * alt;
      const dx0 = incl * Math.pow(s / seg, 2);
      const dx1 = incl * Math.pow((s + 1) / seg, 2);
      const r0 = 0.21 - 0.07 * (s / seg);
      const r1 = 0.21 - 0.07 * ((s + 1) / seg);
      for (let k = 0; k < 8; k++) {
        const a0 = (k / 8) * Math.PI * 2;
        const a1 = ((k + 1) / 8) * Math.PI * 2;
        troncos.quad(
          [
            [x + dx0 + Math.cos(a0) * r0, y0, beira + Math.sin(a0) * r0],
            [x + dx0 + Math.cos(a1) * r0, y0, beira + Math.sin(a1) * r0],
            [x + dx1 + Math.cos(a1) * r1, y1, beira + Math.sin(a1) * r1],
            [x + dx1 + Math.cos(a0) * r1, y1, beira + Math.sin(a0) * r1],
          ],
          [
            [k / 8, y0],
            [(k + 1) / 8, y0],
            [(k + 1) / 8, y1],
            [k / 8, y1],
          ],
          [branco, branco, branco, branco]
        );
      }
    }
    const tx = x + incl;
    const nFolhas = 12;
    for (let f = 0; f < nFolhas; f++) {
      const ang = (f / nFolhas) * Math.PI * 2 + acaso() * 0.3;
      const comp = 2.8 + acaso() * 0.9;
      const sobe = 0.4 + acaso() * 0.5;
      const cai = 1.8 + acaso() * 0.9;
      const passos = 7;
      const tom = new THREE.Color().setHSL(0.24 + acaso() * 0.04, 0.35, 0.82 + acaso() * 0.18);
      for (let s = 0; s < passos; s++) {
        const t0 = s / passos;
        const t1 = (s + 1) / passos;
        // arco: sobe um pouco e cai na ponta; as duas metades da folha descem em V a partir do talo
        const ponto = (t: number) => [tx + Math.cos(ang) * comp * t, alt + sobe * t - cai * t * t, beira + Math.sin(ang) * comp * t];
        const p0 = ponto(t0);
        const p1 = ponto(t1);
        const lx = -Math.sin(ang) * 0.5;
        const lz = Math.cos(ang) * 0.5;
        const v0 = 0.12 * Math.sin(t0 * Math.PI);
        const v1 = 0.12 * Math.sin(t1 * Math.PI);
        for (const lado2 of [-1, 1]) {
          folhas.quad(
            [
              [p0[0], p0[1], p0[2]],
              [p1[0], p1[1], p1[2]],
              [p1[0] + lado2 * lx, p1[1] - v1, p1[2] + lado2 * lz],
              [p0[0] + lado2 * lx, p0[1] - v0, p0[2] + lado2 * lz],
            ],
            [
              [t0, 0.5],
              [t1, 0.5],
              [t1, lado2 > 0 ? 1 : 0],
              [t0, lado2 > 0 ? 1 : 0],
            ],
            [tom, tom, tom, tom]
          );
        }
      }
    }
  }

  // ---- calçada do shopping: coqueiros e postes na beira da rua (nunca na frente da faixa de pedestres)
  const beira = q.z1 - 0.9;
  const cinzaPoste = new THREE.Color("#55585d");
  for (let x = q.x0 + 3; x <= q.x1 - 3; x += 7) {
    if (Math.abs(x) < 5) continue;
    if (Math.round((x - q.x0) / 7) % 2 === 1) {
      // poste: haste, braço sobre a rua e luminária
      caixa(metal, x - 0.07, x + 0.07, beira - 0.07, beira + 0.07, 0, 6.2, cinzaPoste);
      caixa(metal, x - 0.05, x + 0.05, beira, beira + 1.3, 6.0, 6.1, cinzaPoste);
      caixa(metal, x - 0.22, x + 0.22, beira + 1.0, beira + 1.6, 5.85, 6.05, new THREE.Color("#404247"));
      continue;
    }
    coqueiro(x, beira);
  }
  for (const [x, z] of o.coqueiros ?? []) coqueiro(x, z);

  const malhas: [Lote, THREE.Material][] = [
    [asfalto, matAsfalto],
    [calcada, matCalcada],
    [fachada, matFachada],
    [terreo, matTerreo],
    [vidro, matVidro],
    [telhado, matTelhado],
    [pintura, matPintura],
    [metal, matMetal],
    [sinalizacao, matSinalizacao],
    [toldos, matToldo],
    [troncos, matTronco],
    [folhas, matFolha],
    [morros, matMorro],
  ];
  for (const [lote, m] of malhas) {
    if (!lote.idx.length) continue;
    const malha = lote.malha(m);
    guardar(malha.geometry);
    grupo.add(malha);
  }

  let descartada = false;
  return {
    grupo,
    ceu,
    async detalhar() {
      for (const tarefa of tarefas) {
        // um quadro entre uma textura e outra: a loja continua andando enquanto a cidade ganha detalhe
        await new Promise((ok) => setTimeout(ok, 30));
        if (descartada) return;
        tarefa();
      }
    },
    descartar: () => {
      descartada = true;
      descartaveis.forEach((d) => d.dispose());
    },
  };
}
