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

/** quatro paredes inclinadas (mais largas em cima), abertas no topo */
function geometriaParedes() {
  const b = [LARG_BASE / 2, FUNDO_BASE / 2];
  const t = [LARG_TOPO / 2, FUNDO_TOPO / 2];
  const cantosBase: [number, number][] = [
    [-b[0], -b[1]],
    [b[0], -b[1]],
    [b[0], b[1]],
    [-b[0], b[1]],
  ];
  const cantosTopo: [number, number][] = [
    [-t[0], -t[1]],
    [t[0], -t[1]],
    [t[0], t[1]],
    [-t[0], t[1]],
  ];
  const pos: number[] = [];
  const uv: number[] = [];
  for (let k = 0; k < 4; k++) {
    const a = cantosBase[k];
    const bb = cantosBase[(k + 1) % 4];
    const c = cantosTopo[(k + 1) % 4];
    const d = cantosTopo[k];
    const largura = k % 2 ? 0.5 : 1; // lado curto usa metade da grade
    pos.push(a[0], 0, a[1], bb[0], 0, bb[1], c[0], ALTURA, c[1], a[0], 0, a[1], c[0], ALTURA, c[1], d[0], ALTURA, d[1]);
    uv.push(0, 0, largura, 0, largura, 1, 0, 0, largura, 1, 0, 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  return geo;
}

export function criarCesta(cor: THREE.ColorRepresentation): Cesta {
  const cena = new THREE.Scene();
  cena.add(new THREE.HemisphereLight(0xffffff, 0xd9d2cb, 0.9));
  const luz = new THREE.DirectionalLight(0xffffff, 1.3);
  luz.position.set(0.4, 1, 0.6);
  cena.add(luz);

  const descartaveis: { dispose: () => void }[] = [];
  const guardar = <T extends { dispose: () => void }>(x: T) => (descartaveis.push(x), x);

  const grade = guardar(texturaGrade());
  const plastico = guardar(new THREE.MeshStandardMaterial({ color: cor, roughness: 0.5, metalness: 0, map: grade, alphaTest: 0.5, side: THREE.DoubleSide }));
  const liso = guardar(new THREE.MeshStandardMaterial({ color: cor, roughness: 0.45, metalness: 0 }));
  const escuro = guardar(new THREE.MeshStandardMaterial({ color: new THREE.Color(cor).multiplyScalar(0.7), roughness: 0.35 }));

  // a cesta fica de frente para a câmera, embaixo, inclinada para mostrar o que tem dentro
  const cesta = new THREE.Group();
  cesta.add(new THREE.Mesh(guardar(geometriaParedes()), plastico));
  const fundo = new THREE.Mesh(guardar(new THREE.BoxGeometry(LARG_BASE, 0.012, FUNDO_BASE)), liso);
  fundo.position.y = 0.006;
  cesta.add(fundo);
  // borda grossa em cima e reforços nos cantos
  const geoBorda = guardar(new THREE.BoxGeometry(1, 1, 1));
  const borda = (x: number, z: number, sx: number, sz: number) => {
    const m = new THREE.Mesh(geoBorda, liso);
    m.position.set(x, ALTURA, z);
    m.scale.set(sx, 0.022, sz);
    cesta.add(m);
  };
  borda(0, -FUNDO_TOPO / 2, LARG_TOPO + 0.02, 0.022);
  borda(0, FUNDO_TOPO / 2, LARG_TOPO + 0.02, 0.022);
  borda(-LARG_TOPO / 2, 0, 0.022, FUNDO_TOPO + 0.02);
  borda(LARG_TOPO / 2, 0, 0.022, FUNDO_TOPO + 0.02);
  // alças: dois arcos que sobem dos lados compridos e se encontram em cima
  const geoAlca = guardar(new THREE.TorusGeometry(FUNDO_TOPO / 2 - 0.02, 0.008, 8, 32, Math.PI));
  for (const x of [-0.11, 0.11]) {
    const alca = new THREE.Mesh(geoAlca, escuro);
    alca.position.set(x, ALTURA, 0);
    alca.rotation.y = Math.PI / 2;
    alca.rotation.z = 0;
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
    descartar: () => descartaveis.forEach((d) => d.dispose()),
  };
}
