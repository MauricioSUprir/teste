/**
 * Cesta de compras que a pessoa leva na mão, em primeira pessoa: fica presa à
 * câmera, embaixo e um pouco à frente, e balança de leve quando anda. O que
 * está na sacola do site aparece dentro dela; o produto que acabou de entrar
 * voa da prateleira até a cesta.
 *
 * Mora numa cena separada, desenhada por cima da loja: assim a cesta nunca
 * "entra" numa prateleira quando a pessoa chega perto.
 */
import * as THREE from "three";

export interface ItemCesta {
  geometria: THREE.BufferGeometry;
  material: THREE.Material | THREE.Material[];
  altura: number;
}

export interface Cesta {
  cena: THREE.Scene;
  /** troca todo o conteúdo, sem animação (sacola que já vinha cheia) */
  definir: (itens: ItemCesta[]) => void;
  /** um item novo, que sai de `origem` (no mundo) e cai na cesta */
  adicionar: (item: ItemCesta, origem: THREE.Vector3, escalaOrigem: number) => void;
  /** segue a câmera e balança no passo */
  atualizar: (dt: number, andando: boolean, camera: THREE.Camera) => void;
  /** formato da tela (largura / altura): em pé, a cesta fica menor e mais embaixo */
  enquadrar: (aspecto: number) => void;
  mostrar: (sim: boolean) => void;
  descartar: () => void;
}

const LARG_TOPO = 0.44;
const FUNDO_TOPO = 0.3;
const LARG_BASE = 0.36;
const FUNDO_BASE = 0.23;
const ALTURA = 0.2;
const ALTURA_ITEM = 0.12; // altura de cada produto dentro da cesta
const VOO = 0.75; // segundos da prateleira até a cesta
const VAGAS: [number, number][] = [
  [-0.12, -0.055],
  [0, -0.055],
  [0.12, -0.055],
  [-0.12, 0.055],
  [0, 0.055],
  [0.12, 0.055],
];

/** parede com furinhos (textura com transparência), como as cestas de plástico */
function texturaGrade() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 128;
  const g = c.getContext("2d");
  if (g) {
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, 256, 128);
    g.globalCompositeOperation = "destination-out";
    for (let y = 22; y < 112; y += 26) {
      for (let x = 12; x < 248; x += 22) {
        g.beginPath();
        g.roundRect(x, y, 14, 16, 4);
        g.fill();
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** contorno de retângulo de cantos redondos (mesmo número de pontos em qualquer tamanho) */
function contorno(larg: number, fundo: number, raio: number, porCanto = 6): [number, number][] {
  const pts: [number, number][] = [];
  const cx = larg / 2 - raio;
  const cz = fundo / 2 - raio;
  const centros: [number, number, number][] = [
    [cx, cz, 0],
    [-cx, cz, Math.PI / 2],
    [-cx, -cz, Math.PI],
    [cx, -cz, Math.PI * 1.5],
  ];
  for (const [x, z, a0] of centros) {
    for (let k = 0; k <= porCanto; k++) {
      const a = a0 + (k / porCanto) * (Math.PI / 2);
      pts.push([x + Math.cos(a) * raio, z + Math.sin(a) * raio]);
    }
  }
  return pts;
}

/** paredes inclinadas (mais largas em cima) de cantos redondos, abertas no topo; a grade se repete a cada 22 cm */
function geometriaParedes() {
  const base = contorno(LARG_BASE, FUNDO_BASE, 0.035);
  const topo = contorno(LARG_TOPO, FUNDO_TOPO, 0.05);
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  let s = 0;
  for (let k = 0; k <= base.length; k++) {
    const i = k % base.length;
    if (k > 0) {
      const j = (k - 1) % base.length;
      s += Math.hypot(topo[i][0] - topo[j][0], topo[i][1] - topo[j][1]);
    }
    pos.push(base[i][0], 0, base[i][1], topo[i][0], ALTURA, topo[i][1]);
    uv.push(s / 0.22, 0, s / 0.22, 1);
    if (k > 0) {
      const a = (k - 1) * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** tubo fechado seguindo o contorno de cima (a borda grossa da cesta) */
function geometriaBorda() {
  const pts = contorno(LARG_TOPO + 0.006, FUNDO_TOPO + 0.006, 0.052, 8).map(([x, z]) => new THREE.Vector3(x, ALTURA, z));
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 96, 0.011, 8, true);
}

export function criarCesta(cor: THREE.ColorRepresentation, aoCair?: () => void): Cesta {
  const cena = new THREE.Scene();
  cena.add(new THREE.HemisphereLight(0xffffff, 0xd9d2cb, 0.9));
  const luz = new THREE.DirectionalLight(0xffffff, 1.3);
  luz.position.set(0.4, 1, 0.6);
  cena.add(luz);

  const descartaveis: { dispose: () => void }[] = [];
  const guardar = <T extends { dispose: () => void }>(x: T) => (descartaveis.push(x), x);

  const grade = guardar(texturaGrade());
  grade.wrapS = THREE.RepeatWrapping;
  const plastico = guardar(new THREE.MeshPhysicalMaterial({ color: cor, roughness: 0.38, metalness: 0, map: grade, alphaTest: 0.5, side: THREE.DoubleSide, clearcoat: 0.4, clearcoatRoughness: 0.35 }));
  const liso = guardar(new THREE.MeshPhysicalMaterial({ color: cor, roughness: 0.32, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.3 }));
  const escuro = guardar(new THREE.MeshStandardMaterial({ color: new THREE.Color(cor).multiplyScalar(0.7), roughness: 0.35 }));

  // a cesta fica de frente para a câmera, embaixo, inclinada para mostrar o que tem dentro
  const cesta = new THREE.Group();
  cesta.add(new THREE.Mesh(guardar(geometriaParedes()), plastico));
  // fundo de cantos redondos com nervuras, e a borda grossa em cima
  const formaFundo = new THREE.Shape(contorno(LARG_BASE, FUNDO_BASE, 0.035).map(([x, z]) => new THREE.Vector2(x, z)));
  const fundo = new THREE.Mesh(guardar(new THREE.ExtrudeGeometry(formaFundo, { depth: 0.012, bevelEnabled: false }).rotateX(Math.PI / 2).translate(0, 0.012, 0)), liso);
  cesta.add(fundo);
  const geoNervura = guardar(new THREE.BoxGeometry(LARG_BASE - 0.06, 0.006, 0.008));
  for (const z of [-0.06, -0.02, 0.02, 0.06]) {
    const n = new THREE.Mesh(geoNervura, liso);
    n.position.set(0, 0.015, z);
    cesta.add(n);
  }
  cesta.add(new THREE.Mesh(guardar(geometriaBorda()), liso));
  // alças: dois arcos que sobem dos lados compridos e se encontram em cima, com a pega mais grossa
  const geoAlca = guardar(new THREE.TorusGeometry(FUNDO_TOPO / 2 - 0.02, 0.009, 10, 40, Math.PI));
  const geoPega = guardar(new THREE.CylinderGeometry(0.014, 0.014, 0.09, 16).rotateZ(Math.PI / 2));
  for (const x of [-0.11, 0.11]) {
    const alca = new THREE.Group();
    alca.add(new THREE.Mesh(geoAlca, escuro));
    const pega = new THREE.Mesh(geoPega, escuro);
    pega.position.y = FUNDO_TOPO / 2 - 0.02;
    alca.add(pega);
    alca.position.set(x, ALTURA, 0);
    alca.rotation.y = Math.PI / 2;
    // inclinada para trás (para o lado da pessoa), como quando se segura a cesta
    alca.rotateX(-1.05);
    cesta.add(alca);
  }

  // suporte = câmera; mão = onde a cesta fica na tela; cesta = balanço do passo
  const suporte = new THREE.Group();
  const mao = new THREE.Group();
  mao.position.set(0.05, -0.4, -0.8); // acima da barra de botões da tela
  mao.rotation.x = 0.72;
  mao.scale.setScalar(0.78);
  suporte.add(mao);
  mao.add(cesta);
  cena.add(suporte);

  const conteudo = new THREE.Group();
  cesta.add(conteudo);
  const itens: THREE.Mesh[] = [];
  const voando: { malha: THREE.Mesh; de: THREE.Vector3; escalaDe: number; t: number; vaga: number; escala: number }[] = [];

  function vagaLocal(i: number) {
    const [x, z] = VAGAS[i % VAGAS.length];
    const camada = Math.floor(i / VAGAS.length);
    return new THREE.Vector3(x + camada * 0.03, 0.012 + camada * 0.05, z);
  }
  function arrumar(malha: THREE.Mesh, i: number, altura: number) {
    const e = ALTURA_ITEM / Math.max(altura, 0.05);
    malha.position.copy(vagaLocal(i));
    malha.scale.setScalar(e);
    // cada um meio torto, como produto jogado na cesta
    malha.rotation.set(-0.35 + ((i * 37) % 7) * 0.04, ((i * 53) % 9) * 0.25 - 1, ((i * 29) % 5) * 0.06 - 0.12);
  }

  function definir(lista: ItemCesta[]) {
    for (const m of itens) conteudo.remove(m);
    itens.length = 0;
    lista.slice(0, VAGAS.length * 3).forEach((item, i) => {
      const m = new THREE.Mesh(item.geometria, item.material);
      arrumar(m, i, item.altura);
      conteudo.add(m);
      itens.push(m);
    });
  }

  const auxV = new THREE.Vector3();
  function adicionar(item: ItemCesta, origem: THREE.Vector3, escalaOrigem: number) {
    const malha = new THREE.Mesh(item.geometria, item.material);
    const vaga = itens.length + voando.length;
    // começa no mundo, na posição do produto na prateleira, e é levado até a vaga
    malha.position.copy(origem);
    malha.scale.setScalar(escalaOrigem);
    cena.add(malha);
    voando.push({ malha, de: origem.clone(), escalaDe: escalaOrigem, t: 0, vaga, escala: ALTURA_ITEM / Math.max(item.altura, 0.05) });
  }

  let fase = 0;
  let passo = 0;
  function atualizar(dt: number, andando: boolean, camera: THREE.Camera) {
    suporte.position.copy(camera.position);
    suporte.quaternion.copy(camera.quaternion);
    // balanço do passo
    fase += dt * (andando ? 9 : 0);
    passo += ((andando ? 1 : 0) - passo) * Math.min(1, dt * 6);
    cesta.position.set(Math.sin(fase * 0.5) * 0.008 * passo, Math.abs(Math.sin(fase)) * 0.012 * passo, 0);
    cesta.rotation.z = Math.sin(fase * 0.5) * 0.02 * passo;

    for (let k = voando.length - 1; k >= 0; k--) {
      const v = voando[k];
      v.t = Math.min(1, v.t + dt / VOO);
      const s = v.t * v.t * (3 - 2 * v.t);
      suporte.updateMatrixWorld(true);
      const fim = conteudo.localToWorld(auxV.copy(vagaLocal(v.vaga)));
      v.malha.position.lerpVectors(v.de, fim, s);
      v.malha.position.y += Math.sin(Math.PI * s) * 0.35; // sobe e cai na cesta
      v.malha.scale.setScalar(v.escalaDe + (v.escala - v.escalaDe) * s);
      v.malha.rotation.y += dt * 6 * (1 - s);
      if (v.t >= 1) {
        cena.remove(v.malha);
        arrumar(v.malha, v.vaga, ALTURA_ITEM / v.escala);
        conteudo.add(v.malha);
        itens.push(v.malha);
        voando.splice(k, 1);
        aoCair?.();
      }
    }
  }

  return {
    cena,
    definir,
    adicionar,
    atualizar,
    mostrar: (sim) => {
      cena.visible = sim;
    },
    enquadrar(aspecto) {
      // 0 com o celular em pé, 1 da tela de computador para cima
      const k = Math.min(1, Math.max(0, (aspecto - 0.5) / 0.9));
      mao.scale.setScalar(0.62 + 0.16 * k);
      mao.position.y = -0.46 + 0.06 * k;
    },
    descartar: () => descartaveis.forEach((d) => d.dispose()),
  };
}
