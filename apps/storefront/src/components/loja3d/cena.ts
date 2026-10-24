/**
 * Loja 3D — a cena em three.js (sem React). Um corredor por categoria, lado a
 * lado, cada um com placa numerada na entrada ("01 CABELOS") e prateleiras dos
 * dois lados com as fotos reais dos produtos, em várias frentes como numa loja
 * física. A pessoa anda em primeira pessoa: arrasta para olhar, clica numa
 * placa ou no chão para ir até lá, e clica num produto para a câmera chegar
 * perto da prateleira e o card do produto abrir (o card é React, fora daqui).
 *
 * Desempenho: uma malha instanciada por produto (as frentes repetidas são a
 * mesma malha), e as fotos só baixam quando a câmera chega a ~15 m delas,
 * reduzidas para 256 px num canvas — o 3D não pesa como 300 fotos de uma vez.
 */
import * as THREE from "three";

export interface ProdutoCena {
  slug: string;
  foto: string;
}

export interface CorredorCena {
  numero: string;
  nome: string;
  produtos: ProdutoCena[];
}

export interface OpcoesCena {
  corredores: CorredorCena[];
  nomeLoja: string;
  corPrimaria: string;
  corEscura: string;
  fonte: string;
  aoSelecionarProduto: (slug: string) => void;
  aoMudarCorredor: (indice: number | null) => void;
  aoChegarPrateleira: () => void;
  /** onde a pessoa estava antes de abrir um produto (volta para o mesmo lugar) */
  inicio?: PosicaoCena;
}

export interface PosicaoCena {
  x: number;
  z: number;
  yaw: number;
  pitch: number;
}

export interface Cena {
  irParaCorredor: (indice: number) => void;
  irParaEntrada: () => void;
  posicao: () => PosicaoCena;
  destruir: () => void;
}

const OLHO = 1.6; // altura dos olhos
const LARG = 3.0; // corredor livre para andar
const PROF = 0.7; // gôndola de duas faces
const PASSO = LARG + PROF; // de um corredor ao outro
const COMPR = 11; // comprimento dos corredores
const NIVEIS = [0.32, 0.8, 1.28, 1.76]; // altura de cada tábua
const TAM = 0.34; // lado da foto na prateleira
const COL = 0.4; // largura de cada frente
const FRENTES = 3; // quantas frentes seguidas de cada produto
const ENTRADA_Z = 7; // onde a pessoa começa
const TETO = 4.4; // alto o bastante para o nome da loja aparecer por cima das gôndolas
const BOCA_Z = 0.4; // linha das entradas dos corredores
const DIST_FOTO = 17; // a foto baixa quando a câmera chega a essa distância

const limitar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
/** diferença entre ângulos pelo caminho mais curto */
const difAngulo = (alvo: number, atual: number) => Math.atan2(Math.sin(alvo - atual), Math.cos(alvo - atual));

function carregarFoto(url: string): Promise<THREE.Texture> {
  return new Promise((ok, falha) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = c.height = 256;
      const g = c.getContext("2d");
      if (!g) return falha(new Error("canvas"));
      g.fillStyle = "#ffffff";
      g.fillRect(0, 0, 256, 256);
      const r = Math.min(240 / img.width, 240 / img.height);
      const w = img.width * r;
      const h = img.height * r;
      g.drawImage(img, (256 - w) / 2, (256 - h) / 2, w, h);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      ok(t);
    };
    img.onerror = () => falha(new Error("foto"));
    img.src = url;
  });
}

function textura(largura: number, altura: number, desenhar: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas");
  c.width = largura;
  c.height = altura;
  const g = c.getContext("2d");
  if (g) desenhar(g);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function criarCena(container: HTMLElement, op: OpcoesCena): Cena {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  const celular = window.matchMedia("(pointer: coarse)").matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, celular ? 1.5 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const canvas = renderer.domElement;
  Object.assign(canvas.style, { display: "block", width: "100%", height: "100%", touchAction: "none", cursor: "grab" });
  container.appendChild(canvas);

  const cena = new THREE.Scene();
  const fundo = new THREE.Color("#f3f3f6");
  cena.background = fundo;
  cena.fog = new THREE.Fog(fundo, 16, 40);
  const camera = new THREE.PerspectiveCamera(62, 1, 0.05, 80);
  camera.rotation.order = "YXZ";

  const descartar: { dispose: () => void }[] = [];
  function guardar<T extends { dispose: () => void }>(x: T): T {
    descartar.push(x);
    return x;
  }

  const N = op.corredores.length;
  const xCorredor = (i: number) => (i - (N - 1) / 2) * PASSO;
  const xMin = xCorredor(0) - PASSO / 2;
  const xMax = xCorredor(N - 1) + PASSO / 2;
  const corredorEm = (x: number) => limitar(Math.round(x / PASSO + (N - 1) / 2), 0, N - 1);
  const zFrente = ENTRADA_Z + 3;
  const zFundo = -COMPR - 2.6;

  const corPrimaria = new THREE.Color(op.corPrimaria);
  const matPrimaria = guardar(new THREE.MeshLambertMaterial({ color: corPrimaria }));
  const matBranco = guardar(new THREE.MeshLambertMaterial({ color: "#ffffff" }));
  const matFundoGondola = guardar(new THREE.MeshLambertMaterial({ color: "#e6e6ec" }));
  const caixa = guardar(new THREE.BoxGeometry(1, 1, 1));
  function bloco(mat: THREE.Material, sx: number, sy: number, sz: number, x: number, y: number, z: number) {
    const m = new THREE.Mesh(caixa, mat);
    m.scale.set(sx, sy, sz);
    m.position.set(x, y, z);
    cena.add(m);
    return m;
  }

  // ---- luz
  // intensidades no padrão físico do three (sem o fator π antigo): branco fica branco
  cena.add(new THREE.HemisphereLight(0xffffff, 0xe2e2e8, 2.6));
  const sol = new THREE.DirectionalLight(0xffffff, 1.3);
  sol.position.set(5, 10, 8);
  cena.add(sol);

  // ---- piso de ladrilhos, teto e paredes
  const larguraLoja = xMax - xMin + 6;
  const profLoja = zFrente - zFundo;
  const texPiso = guardar(
    textura(128, 128, (g) => {
      g.fillStyle = "#f2f2f5";
      g.fillRect(0, 0, 128, 128);
      g.strokeStyle = "#dedee5";
      g.lineWidth = 3;
      g.strokeRect(1, 1, 126, 126);
    })
  );
  texPiso.wrapS = texPiso.wrapT = THREE.RepeatWrapping;
  texPiso.repeat.set(larguraLoja / 1.2, profLoja / 1.2);
  const piso = new THREE.Mesh(
    guardar(new THREE.PlaneGeometry(larguraLoja, profLoja)),
    guardar(new THREE.MeshLambertMaterial({ map: texPiso }))
  );
  piso.rotation.x = -Math.PI / 2;
  piso.position.set((xMin + xMax) / 2, 0, (zFrente + zFundo) / 2);
  cena.add(piso);

  const teto = new THREE.Mesh(
    guardar(new THREE.PlaneGeometry(larguraLoja, profLoja)),
    guardar(new THREE.MeshBasicMaterial({ color: "#fafafc" }))
  );
  teto.rotation.x = Math.PI / 2;
  teto.position.set((xMin + xMax) / 2, TETO, (zFrente + zFundo) / 2);
  cena.add(teto);

  const matLuz = guardar(new THREE.MeshBasicMaterial({ color: "#ffffff" }));
  for (let i = 0; i < N; i++) {
    for (let z = -1; z > -COMPR; z -= 3) bloco(matLuz, 0.5, 0.04, 2.2, xCorredor(i), TETO - 0.04, z);
  }
  const matParede = guardar(new THREE.MeshLambertMaterial({ color: "#f7f7f9" }));
  bloco(matParede, larguraLoja, TETO, 0.2, (xMin + xMax) / 2, TETO / 2, zFundo);
  bloco(matParede, 0.2, TETO, profLoja, xMin - 3, TETO / 2, (zFrente + zFundo) / 2);
  bloco(matParede, 0.2, TETO, profLoja, xMax + 3, TETO / 2, (zFrente + zFundo) / 2);
  bloco(matParede, larguraLoja, TETO, 0.2, (xMin + xMax) / 2, TETO / 2, zFrente);
  bloco(matPrimaria, larguraLoja, 0.12, 0.22, (xMin + xMax) / 2, TETO - 0.08, zFundo + 0.02);

  // nome da loja na parede do fundo
  const texNome = guardar(
    textura(2048, 300, (g) => {
      g.fillStyle = "#f7f7f9";
      g.fillRect(0, 0, 2048, 300);
      g.fillStyle = op.corPrimaria;
      g.font = `800 190px ${op.fonte}`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(op.nomeLoja.toUpperCase(), 1024, 160);
    })
  );
  const placaNome = new THREE.Mesh(guardar(new THREE.PlaneGeometry(6.4, 0.94)), guardar(new THREE.MeshBasicMaterial({ map: texNome })));
  placaNome.position.set((xMin + xMax) / 2, 3.88, zFundo + 0.12);
  cena.add(placaNome);

  // ---- gôndolas (uma entre cada par de corredores, mais as das pontas)
  // guardadas à parte: o toque que bate na gôndola não atravessa para o chão do outro lado
  const gondolas: THREE.Mesh[] = [];
  const peca = (...a: Parameters<typeof bloco>) => gondolas.push(bloco(...a));
  for (let j = 0; j <= N; j++) {
    const gx = xMin + j * PASSO;
    const zc = -COMPR / 2;
    peca(matPrimaria, PROF, 0.12, COMPR, gx, 0.06, zc); // rodapé
    peca(matFundoGondola, 0.05, 2.12, COMPR, gx, 1.12, zc); // painel do meio
    for (const nivel of NIVEIS) {
      for (const lado of [-1, 1]) {
        peca(matBranco, PROF / 2 - 0.03, 0.035, COMPR, gx + lado * (PROF / 4), nivel - 0.018, zc);
        peca(matPrimaria, 0.012, 0.045, COMPR, gx + lado * (PROF / 2 - 0.006), nivel - 0.02, zc); // etiqueta
      }
    }
    for (let z = 0; z >= -COMPR; z -= COMPR / 4) peca(matPrimaria, PROF, 2.2, 0.05, gx, 1.1, z); // colunas
    peca(matPrimaria, PROF + 0.04, 0.07, COMPR, gx, 2.2, zc); // topo
  }

  // ---- placas numeradas na entrada de cada corredor (clicáveis)
  const placas: THREE.Mesh[] = [];
  op.corredores.forEach((c, i) => {
    const tex = guardar(
      textura(1024, 200, (g) => {
        g.fillStyle = op.corPrimaria;
        g.fillRect(0, 0, 1024, 200);
        g.fillStyle = "#ffffff";
        g.textBaseline = "middle";
        g.font = `700 96px ${op.fonte}`;
        g.fillText(c.numero, 48, 104);
        g.font = `600 84px ${op.fonte}`;
        g.fillText(c.nome.toUpperCase(), 210, 104, 780);
      })
    );
    const placa = new THREE.Mesh(guardar(new THREE.PlaneGeometry(LARG + 0.3, 0.6)), guardar(new THREE.MeshBasicMaterial({ map: tex })));
    placa.position.set(xCorredor(i), 2.75, BOCA_Z);
    placa.userData = { corredor: i };
    cena.add(placa);
    placas.push(placa);
    for (const lado of [-1, 1]) bloco(matPrimaria, 0.03, 0.9, 0.03, xCorredor(i) + lado * (LARG / 2), 3.25, BOCA_Z);
  });

  // ---- produtos nas prateleiras: uma malha instanciada por produto
  const geoFoto = guardar(new THREE.PlaneGeometry(TAM, TAM));
  const colunas = Math.floor((COMPR - 0.6) / COL);
  interface Vaga {
    pos: THREE.Vector3;
    face: number; // +1 = foto olhando para +x (lado esquerdo do corredor)
    corredor: number;
  }
  const vagasPorProduto = new Map<string, Vaga[]>();
  const fotoDe = new Map<string, string>();
  op.corredores.forEach((c, i) => {
    if (!c.produtos.length) return;
    const lados = [
      { face: 1, x: xCorredor(i) - PASSO / 2 + PROF / 2 - 0.07, lista: c.produtos.filter((_, k) => k % 2 === 0) },
      { face: -1, x: xCorredor(i) + PASSO / 2 - PROF / 2 + 0.07, lista: c.produtos.filter((_, k) => k % 2 === 1) },
    ];
    for (const lado of lados) {
      const lista = lado.lista.length ? lado.lista : c.produtos;
      NIVEIS.forEach((nivel, n) => {
        for (let col = 0; col < colunas; col++) {
          const p = lista[Math.floor((n * colunas + col) / FRENTES) % lista.length];
          fotoDe.set(p.slug, p.foto);
          const vagas = vagasPorProduto.get(p.slug) ?? [];
          vagas.push({
            pos: new THREE.Vector3(lado.x, nivel + TAM / 2 + 0.02, -0.4 - col * COL - COL / 2),
            face: lado.face,
            corredor: i,
          });
          vagasPorProduto.set(p.slug, vagas);
        }
      });
    }
  });

  interface ProdutoMalha {
    slug: string;
    malha: THREE.InstancedMesh;
    material: THREE.MeshBasicMaterial;
    vagas: Vaga[];
    estado: "nada" | "baixando" | "pronto";
  }
  const malhas: ProdutoMalha[] = [];
  const auxMatriz = new THREE.Matrix4();
  const auxQuat = new THREE.Quaternion();
  const eixoY = new THREE.Vector3(0, 1, 0);
  const matrizDa = (v: Vaga, escala = 1) =>
    auxMatriz.compose(v.pos, auxQuat.setFromAxisAngle(eixoY, (v.face * Math.PI) / 2), new THREE.Vector3(escala, escala, escala));
  for (const [slug, vagas] of vagasPorProduto) {
    const material = guardar(new THREE.MeshBasicMaterial({ color: "#f5f5f8" }));
    const malha = new THREE.InstancedMesh(geoFoto, material, vagas.length);
    vagas.forEach((v, k) => malha.setMatrixAt(k, matrizDa(v)));
    malha.userData = { slug };
    cena.add(malha);
    malhas.push({ slug, malha, material, vagas, estado: "nada" });
  }

  // fotos sob demanda, das mais perto para as mais longe
  let baixando = 0;
  let destruida = false;
  function baixarFotosPerto() {
    const perto = malhas
      .filter((m) => m.estado === "nada")
      .map((m) => ({ m, d: Math.min(...m.vagas.map((v) => v.pos.distanceTo(posicao))) }))
      .filter((x) => x.d < DIST_FOTO)
      .sort((a, b) => a.d - b.d);
    for (const { m } of perto) {
      if (baixando >= 8) break;
      const url = fotoDe.get(m.slug);
      if (!url) continue;
      m.estado = "baixando";
      baixando++;
      carregarFoto(url)
        .then((t) => {
          if (destruida) return t.dispose();
          guardar(t);
          m.material.map = t;
          m.material.color.set("#ffffff");
          m.material.needsUpdate = true;
          m.estado = "pronto";
        })
        .catch(() => {
          m.estado = "pronto"; // sem foto: fica o quadro cinza
        })
        .finally(() => {
          baixando--;
        });
    }
  }

  // ---- câmera em primeira pessoa
  const posicao = new THREE.Vector3(op.inicio?.x ?? 0, OLHO, op.inicio?.z ?? ENTRADA_Z);
  let yaw = op.inicio?.yaw ?? 0;
  let pitch = op.inicio?.pitch ?? -0.04;
  let alvoYaw = yaw;
  let alvoPitch = pitch;
  type Ponto = { x: number; z: number; yaw?: number; pitch?: number };
  let rota: Ponto[] = [];
  let avisarPrateleira = false;
  let corredorAtual: number | null = null;

  const corredorDaPosicao = (x: number, z: number) => (z < BOCA_Z ? corredorEm(x) : null);

  /** mantém dentro da loja e, dentro de um corredor, entre as gôndolas */
  function dentro(x: number, z: number, corredor: number | null): [number, number] {
    z = limitar(z, -COMPR + 0.6, zFrente - 1);
    x = limitar(x, xMin - 2.2, xMax + 2.2);
    if (z < BOCA_Z) {
      const i = corredor ?? corredorEm(x);
      x = limitar(x, xCorredor(i) - LARG / 2 + 0.45, xCorredor(i) + LARG / 2 - 0.45);
    }
    return [x, z];
  }

  /** caminho que não atravessa prateleira: sai do corredor, anda pela frente e entra no outro */
  function irPara(destX: number, destZ: number, fimYaw?: number, fimPitch?: number) {
    const de = corredorDaPosicao(posicao.x, posicao.z);
    const ate = corredorDaPosicao(destX, destZ);
    const [x, z] = dentro(destX, destZ, ate);
    const pontos: Ponto[] = [];
    if (de !== null && de !== ate) pontos.push({ x: posicao.x, z: BOCA_Z + 1.2 });
    if (ate !== null && de !== ate) pontos.push({ x: xCorredor(ate), z: BOCA_Z + 1.2 });
    pontos.push({ x, z, yaw: fimYaw, pitch: fimPitch });
    rota = pontos;
  }

  function irParaCorredor(i: number) {
    avisarPrateleira = false;
    irPara(xCorredor(i), -0.9, 0, -0.05);
  }
  function irParaEntrada() {
    avisarPrateleira = false;
    irPara(0, ENTRADA_Z, 0, -0.04);
  }

  function andarFrente(metros: number) {
    const dx = -Math.sin(yaw) * metros;
    const dz = -Math.cos(yaw) * metros;
    const atual = corredorDaPosicao(posicao.x, posicao.z);
    const [x, z] = dentro(posicao.x + dx, posicao.z + dz, atual);
    rota = [{ x, z }];
    avisarPrateleira = false;
  }

  // ---- interação
  const raycaster = new THREE.Raycaster();
  const ponteiro = new THREE.Vector2();
  let arrastando = false;
  let moveu = false;
  let inicioX = 0;
  let inicioY = 0;
  let ultimoX = 0;
  let ultimoY = 0;
  let destaque: { m: ProdutoMalha; k: number } | null = null;

  function alvoNoPonteiro(ev: PointerEvent) {
    const r = canvas.getBoundingClientRect();
    ponteiro.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ponteiro, camera);
    const hits = raycaster.intersectObjects([...malhas.map((m) => m.malha), ...placas, ...gondolas, piso], false);
    return hits[0] ?? null;
  }

  function produtoDoAcerto(hit: THREE.Intersection | null) {
    if (!(hit?.object instanceof THREE.InstancedMesh) || hit.instanceId === undefined) return null;
    const m = malhas.find((x) => x.malha === hit.object);
    return m ? { m, k: hit.instanceId } : null;
  }

  // Dentro do corredor, as fotos ficam de lado e finas no celular: o toque que cai
  // entre duas delas (ou na coluna da gôndola) escolhe a mais próxima na tela,
  // até `raio` pixels da borda da foto.
  const auxTela = new THREE.Vector3();
  const auxTopo = new THREE.Vector3();
  function produtoPerto(ev: PointerEvent, raio: number) {
    const atual = corredorDaPosicao(posicao.x, posicao.z);
    if (atual === null) return null;
    const r = canvas.getBoundingClientRect();
    let melhor: { m: ProdutoMalha; k: number } | null = null;
    let menor = raio;
    for (const m of malhas) {
      for (let k = 0; k < m.vagas.length; k++) {
        const v = m.vagas[k];
        if (v.corredor !== atual || (posicao.x - v.pos.x) * v.face <= 0) continue; // de costas para a pessoa
        auxTela.copy(v.pos).project(camera);
        if (auxTela.z > 1) continue;
        auxTopo.set(v.pos.x, v.pos.y + TAM / 2, v.pos.z).project(camera);
        const meiaFoto = ((auxTopo.y - auxTela.y) / 2) * r.height;
        const centro = Math.hypot(r.left + ((auxTela.x + 1) / 2) * r.width - ev.clientX, r.top + ((1 - auxTela.y) / 2) * r.height - ev.clientY);
        const d = Math.max(0, centro - meiaFoto);
        if (d < menor) {
          menor = d;
          melhor = { m, k };
        }
      }
    }
    return melhor;
  }

  function destacar(novo: { m: ProdutoMalha; k: number } | null) {
    if (destaque && (!novo || destaque.m !== novo.m || destaque.k !== novo.k)) {
      destaque.m.malha.setMatrixAt(destaque.k, matrizDa(destaque.m.vagas[destaque.k]));
      destaque.m.malha.instanceMatrix.needsUpdate = true;
    }
    if (novo) {
      novo.m.malha.setMatrixAt(novo.k, matrizDa(novo.m.vagas[novo.k], 1.12));
      novo.m.malha.instanceMatrix.needsUpdate = true;
    }
    destaque = novo;
  }

  function aoApertar(ev: PointerEvent) {
    arrastando = true;
    moveu = false;
    inicioX = ultimoX = ev.clientX;
    inicioY = ultimoY = ev.clientY;
    canvas.setPointerCapture(ev.pointerId);
  }

  function aoMover(ev: PointerEvent) {
    if (arrastando) {
      if (Math.hypot(ev.clientX - inicioX, ev.clientY - inicioY) > 5) moveu = true;
      if (moveu) {
        canvas.style.cursor = "grabbing";
        yaw = alvoYaw = alvoYaw + (ev.clientX - ultimoX) * 0.0045;
        pitch = alvoPitch = limitar(alvoPitch + (ev.clientY - ultimoY) * 0.0035, -0.55, 0.45);
        rota = rota.map((p) => ({ ...p, yaw: undefined, pitch: undefined })); // olhar manda mais que o fim da rota
      }
      ultimoX = ev.clientX;
      ultimoY = ev.clientY;
      return;
    }
    if (ev.pointerType !== "mouse") return;
    const hit = alvoNoPonteiro(ev);
    const alvo = produtoDoAcerto(hit);
    destacar(alvo);
    canvas.style.cursor = alvo || (hit && placas.includes(hit.object as THREE.Mesh)) ? "pointer" : "grab";
  }

  function aoSoltar(ev: PointerEvent) {
    if (!arrastando) return;
    arrastando = false;
    canvas.style.cursor = "grab";
    if (moveu) return;
    const hit = alvoNoPonteiro(ev);
    const placa = placas.find((p) => p === hit?.object);
    const alvo = produtoDoAcerto(hit) ?? (placa ? null : produtoPerto(ev, ev.pointerType === "mouse" ? 12 : 24));
    if (alvo) {
      const { m } = alvo;
      const vaga = m.vagas[alvo.k];
      // fica no meio do corredor, de frente para a prateleira
      const dist = Math.abs(vaga.pos.x - xCorredor(vaga.corredor));
      irPara(xCorredor(vaga.corredor), vaga.pos.z, vaga.face > 0 ? Math.PI / 2 : -Math.PI / 2, Math.atan2(vaga.pos.y - OLHO, dist));
      avisarPrateleira = true;
      op.aoSelecionarProduto(m.slug);
      return;
    }
    if (placa) return irParaCorredor(placa.userData.corredor as number);
    if (hit?.object === piso) {
      const dx = hit.point.x - posicao.x;
      const dz = hit.point.z - posicao.z;
      const viraPara = Math.hypot(dx, dz) > 1.5 ? Math.atan2(-dx, -dz) : undefined;
      avisarPrateleira = false;
      irPara(hit.point.x, hit.point.z, viraPara);
    }
  }

  function aoRolar(ev: WheelEvent) {
    ev.preventDefault();
    andarFrente(ev.deltaY < 0 ? 1.3 : -1.3);
  }

  const teclas = new Set<string>();
  function aoTeclar(ev: KeyboardEvent) {
    const k = ev.key.toLowerCase();
    if (["w", "s", "a", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) {
      ev.preventDefault();
      teclas.add(k);
    }
  }
  function aoSoltarTecla(ev: KeyboardEvent) {
    teclas.delete(ev.key.toLowerCase());
  }

  canvas.addEventListener("pointerdown", aoApertar);
  canvas.addEventListener("pointermove", aoMover);
  canvas.addEventListener("pointerup", aoSoltar);
  canvas.addEventListener("pointercancel", () => (arrastando = false));
  canvas.addEventListener("wheel", aoRolar, { passive: false });
  // sem isso, o toque que abre o card também "clica" no card que surge embaixo do dedo
  canvas.addEventListener("touchend", (ev) => ev.preventDefault(), { passive: false });
  container.addEventListener("keydown", aoTeclar);
  container.addEventListener("keyup", aoSoltarTecla);

  // ---- tamanho
  function ajustar() {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = camera.aspect < 0.8 ? 80 : 62;
    camera.updateProjectionMatrix();
  }
  const observador = new ResizeObserver(ajustar);
  observador.observe(container);
  ajustar();

  // ---- laço
  let ultimo = performance.now();
  let proximaFoto = 0;
  let quadro = 0;
  function passo(agora: number) {
    quadro = requestAnimationFrame(passo);
    const dt = Math.min(0.05, (agora - ultimo) / 1000);
    ultimo = agora;

    // teclado: anda e vira
    if (teclas.size) {
      const frente = (teclas.has("w") || teclas.has("arrowup") ? 1 : 0) - (teclas.has("s") || teclas.has("arrowdown") ? 1 : 0);
      const vira = (teclas.has("a") || teclas.has("arrowleft") ? 1 : 0) - (teclas.has("d") || teclas.has("arrowright") ? 1 : 0);
      if (vira) yaw = alvoYaw = alvoYaw + vira * dt * 1.6;
      if (frente) {
        rota = [];
        avisarPrateleira = false;
        const atual = corredorDaPosicao(posicao.x, posicao.z);
        const [x, z] = dentro(posicao.x - Math.sin(yaw) * frente * dt * 3, posicao.z - Math.cos(yaw) * frente * dt * 3, atual);
        posicao.x = x;
        posicao.z = z;
      }
    }

    // segue a rota com velocidade que desacelera na chegada
    const alvo = rota[0];
    if (alvo) {
      const dx = alvo.x - posicao.x;
      const dz = alvo.z - posicao.z;
      const dist = Math.hypot(dx, dz);
      const ultimoPonto = rota.length === 1;
      if (!ultimoPonto && dist > 0.3) alvoYaw = Math.atan2(-dx, -dz);
      if (ultimoPonto && alvo.yaw !== undefined) alvoYaw = alvo.yaw;
      if (ultimoPonto && alvo.pitch !== undefined) alvoPitch = alvo.pitch;
      const vel = limitar(dist * 2.6, 0.6, 4.2);
      const anda = Math.min(dist, vel * dt);
      if (dist > 0.0001) {
        posicao.x += (dx / dist) * anda;
        posicao.z += (dz / dist) * anda;
      }
      if (dist < (ultimoPonto ? 0.02 : 0.25)) {
        rota.shift();
        if (!rota.length && avisarPrateleira) {
          avisarPrateleira = false;
          op.aoChegarPrateleira();
        }
      }
    }
    const k = 1 - Math.exp(-dt * 6);
    yaw += difAngulo(alvoYaw, yaw) * k;
    pitch += (alvoPitch - pitch) * k;
    camera.position.copy(posicao);
    camera.rotation.set(pitch, yaw, 0);

    const corredor = corredorDaPosicao(posicao.x, posicao.z);
    if (corredor !== corredorAtual) {
      corredorAtual = corredor;
      op.aoMudarCorredor(corredor);
    }
    if (agora > proximaFoto) {
      proximaFoto = agora + 350;
      baixarFotosPerto();
    }
    renderer.render(cena, camera);
  }
  quadro = requestAnimationFrame(passo);

  return {
    irParaCorredor,
    irParaEntrada,
    posicao: () => ({ x: posicao.x, z: posicao.z, yaw, pitch }),
    destruir() {
      destruida = true;
      cancelAnimationFrame(quadro);
      observador.disconnect();
      container.removeEventListener("keydown", aoTeclar);
      container.removeEventListener("keyup", aoSoltarTecla);
      for (const m of malhas) m.malha.dispose();
      for (const d of descartar) d.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
