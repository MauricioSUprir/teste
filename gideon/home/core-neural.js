// GIDEON Core — Neural Visualizer (módulo 86, parte 1; decisão 027).
// Uma rede neural DE VERDADE, pequena, aprendendo ao vivo no aparelho do dono (nada vai para servidor).
// Mostra por dentro: camadas, neurônios acendendo com a ativação, pesos (cor = sinal, brilho = força), a fronteira de decisão
// se formando e a curva do erro. É a mesma ideia de modelos grandes como a GIDEON, em miniatura (eles têm bilhões de pesos).
import * as THREE from "./vendor/three-core.js";

const COR_A = "#ffcf6e", COR_B = "#2fc6ff"; // classe 0 (âmbar) e classe 1 (ciano) — sem roxo (tema 1.1)
const el = (tag, props = {}, filhos = []) => { const e = Object.assign(document.createElement(tag), props); e.append(...filhos.filter((f) => f != null)); return e; };

// ---------- dados de brinquedo (pontos no quadrado de -1 a 1, duas classes) ----------
const DADOS = {
  circulo: { nome: "Círculo", gerar: () => { const p = []; for (let i = 0; i < 240; i++) { const dentro = i % 2 === 0, r = dentro ? Math.random() * 0.45 : 0.62 + Math.random() * 0.33, a = Math.random() * Math.PI * 2; p.push([r * Math.cos(a), r * Math.sin(a), dentro ? 0 : 1]); } return p; } },
  xor: { nome: "Xadrez (XOR)", gerar: () => { const p = []; for (let i = 0; i < 240; i++) { let x = Math.random() * 2 - 1, y = Math.random() * 2 - 1; if (Math.abs(x) < 0.08) x += 0.16 * Math.sign(x || 1); if (Math.abs(y) < 0.08) y += 0.16 * Math.sign(y || 1); p.push([x, y, x * y > 0 ? 1 : 0]); } return p; } },
  espiral: { nome: "Espiral", gerar: () => { const p = []; for (let i = 0; i < 240; i++) { const c = i % 2, t = (Math.floor(i / 2) / 120) * 3.2 + 0.2, a = t * 1.75 + c * Math.PI; const r = t / 3.6; p.push([r * Math.cos(a) + (Math.random() - 0.5) * 0.06, r * Math.sin(a) + (Math.random() - 0.5) * 0.06, c]); } return p; } },
  grupos: { nome: "Dois grupos", gerar: () => { const p = []; const g = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }; for (let i = 0; i < 240; i++) { const c = i % 2; p.push([(c ? 0.45 : -0.45) + g() * 0.22, (c ? 0.35 : -0.35) + g() * 0.22, c]); } return p; } },
};

// ---------- a rede (perceptron de várias camadas, Adam, entropia cruzada) ----------
class Rede {
  constructor(tamanhos, ativacao) {
    this.t = tamanhos; this.act = ativacao; this.passo = 0;
    this.W = []; this.b = []; this.mW = []; this.vW = []; this.mb = []; this.vb = [];
    for (let l = 1; l < tamanhos.length; l++) {
      const ent = tamanhos[l - 1], sai = tamanhos[l], esc = Math.sqrt(2 / (ent + sai));
      this.W.push(Array.from({ length: sai }, () => Array.from({ length: ent }, () => (Math.random() * 2 - 1) * esc * 1.7)));
      this.b.push(new Array(sai).fill(0));
      this.mW.push(Array.from({ length: sai }, () => new Array(ent).fill(0))); this.vW.push(Array.from({ length: sai }, () => new Array(ent).fill(0)));
      this.mb.push(new Array(sai).fill(0)); this.vb.push(new Array(sai).fill(0));
    }
  }
  f(z) { return this.act === "relu" ? Math.max(0, z) : Math.tanh(z); }
  df(z, a) { return this.act === "relu" ? (z > 0 ? 1 : 0) : 1 - a * a; }
  frente(x) { // devolve as ativações de todas as camadas (a última é a probabilidade de cada classe)
    const as = [x], zs = [];
    let a = x;
    for (let l = 0; l < this.W.length; l++) {
      const z = this.W[l].map((linha, j) => linha.reduce((s, w, i) => s + w * a[i], this.b[l][j]));
      zs.push(z);
      if (l === this.W.length - 1) { const m = Math.max(...z), e = z.map((v) => Math.exp(v - m)), s = e.reduce((p, q) => p + q, 0); a = e.map((v) => v / s); }
      else a = z.map((v) => this.f(v));
      as.push(a);
    }
    return { as, zs };
  }
  treinar(lote, taxa) { // um passo de Adam num lote; devolve o erro médio
    const gW = this.W.map((M) => M.map((r) => new Array(r.length).fill(0))), gb = this.b.map((v) => new Array(v.length).fill(0));
    let erro = 0;
    for (const [x, y, c] of lote) {
      const { as, zs } = this.frente([x, y]);
      const saida = as[as.length - 1];
      erro += -Math.log(Math.max(saida[c], 1e-9));
      let delta = saida.map((p, k) => p - (k === c ? 1 : 0));
      for (let l = this.W.length - 1; l >= 0; l--) {
        const aAnt = as[l];
        for (let j = 0; j < delta.length; j++) { gb[l][j] += delta[j]; for (let i = 0; i < aAnt.length; i++) gW[l][j][i] += delta[j] * aAnt[i]; }
        if (l > 0) delta = aAnt.map((a, i) => this.W[l].reduce((s, linha, j) => s + linha[i] * delta[j], 0) * this.df(zs[l - 1][i], a));
      }
    }
    const n = lote.length, b1 = 0.9, b2 = 0.999, eps = 1e-8; this.passo++;
    const c1 = 1 - Math.pow(b1, this.passo), c2 = 1 - Math.pow(b2, this.passo);
    for (let l = 0; l < this.W.length; l++) {
      for (let j = 0; j < this.W[l].length; j++) {
        for (let i = 0; i < this.W[l][j].length; i++) {
          const g = gW[l][j][i] / n + 1e-4 * this.W[l][j][i];
          this.mW[l][j][i] = b1 * this.mW[l][j][i] + (1 - b1) * g; this.vW[l][j][i] = b2 * this.vW[l][j][i] + (1 - b2) * g * g;
          this.W[l][j][i] -= taxa * (this.mW[l][j][i] / c1) / (Math.sqrt(this.vW[l][j][i] / c2) + eps);
        }
        const g = gb[l][j] / n;
        this.mb[l][j] = b1 * this.mb[l][j] + (1 - b1) * g; this.vb[l][j] = b2 * this.vb[l][j] + (1 - b2) * g * g;
        this.b[l][j] -= taxa * (this.mb[l][j] / c1) / (Math.sqrt(this.vb[l][j] / c2) + eps);
      }
    }
    return erro / n;
  }
}

// ---------- estado e tela ----------
let ui = null, deps = null, aberto = false, rede = null, dados = [], amostra = null, rodando = true, erros = [], ultimoMapa = 0;
const conf = { dados: "espiral", camadas: 2, neuronios: 8, taxa: 0.03, ativacao: "tanh" };
let r3 = null; // a cena 3D da rede

function criarUI() {
  const css = el("style", { textContent: `
  #neural { position:fixed; inset:0; z-index:4; display:flex; flex-direction:column; background:radial-gradient(ellipse at 40% 40%, rgba(8,20,48,.9), rgba(2,4,9,.97)); color:var(--g-texto); font:14px/1.45 var(--g-fonte); }
  #neural[hidden] { display:none; }
  #neural .nv-topo { position:static; pointer-events:auto; display:flex; align-items:flex-end; justify-content:space-between; gap:10px; flex-wrap:wrap; padding:max(14px, env(safe-area-inset-top)) 16px 8px; }
  #neural .nv-topo h2 { margin:8px 0 0; }
  .nv-corpo { flex:1; display:flex; min-height:0; }
  .nv-palco { position:relative; flex:1; min-width:0; }
  .nv-palco canvas { position:absolute; inset:0; width:100%; height:100%; display:block; }
  .nv-rot { position:absolute; left:0; top:0; transform:translate(-50%, 0); font:700 9.5px var(--g-fonte-titulo); letter-spacing:.12em; text-transform:uppercase; color:var(--g-texto-3); pointer-events:none; white-space:nowrap; }
  .nv-lado { width:360px; overflow-y:auto; padding:0 16px 24px; }
  .nv-lado .g-cartao { padding:12px 14px; margin-bottom:12px; }
  .nv-lado h3 { margin:0 0 8px; font:700 11px var(--g-fonte-titulo); letter-spacing:.16em; text-transform:uppercase; }
  #nv-mapa { width:100%; aspect-ratio:1; border-radius:10px; display:block; cursor:crosshair; background:#050a16; }
  #nv-erro { width:100%; height:70px; display:block; }
  .nv-num { display:flex; gap:10px; } .nv-num div { flex:1; } .nv-num b { display:block; font:800 24px var(--g-fonte-titulo); }
  .nv-campos { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
  .nv-campos label { font-size:12px; color:var(--g-texto-2); display:flex; flex-direction:column; gap:3px; }
  .nv-campos select { background:rgba(6,10,24,.85); color:var(--g-texto); border:1px solid var(--g-borda-forte); border-radius:8px; padding:6px; font:inherit; }
  .nv-legenda { display:flex; gap:10px; flex-wrap:wrap; font-size:12px; color:var(--g-texto-2); margin-top:6px; }
  .nv-legenda i { display:inline-block; width:10px; height:10px; border-radius:50%; margin-right:4px; vertical-align:-1px; }
  @media (max-width: 760px) { .nv-corpo { flex-direction:column; overflow-y:auto; } .nv-palco { flex:0 0 46vh; } .nv-lado { width:auto; overflow:visible; } }` });
  const fechar = el("button", { textContent: "✕", ariaLabel: "Fechar o Neural Visualizer", onclick: () => fecharNeural() });
  fechar.style.cssText = "background:rgba(10,12,30,.8); border:1px solid var(--g-borda-forte); border-radius:50%; width:36px; height:36px; color:var(--g-texto); cursor:pointer";
  const btnRodar = el("button", { className: "btn", textContent: "⏸ Pausar", onclick: () => { rodando = !rodando; btnRodar.textContent = rodando ? "⏸ Pausar" : "▶ Treinar"; } });
  const palco = el("div", { className: "nv-palco" }, [el("canvas", { id: "nv-3d" }), el("div", { id: "nv-rotulos" })]);
  const sel = (rotulo, chave, opcoes) => {
    const s = el("select", {}, opcoes.map(([v, t]) => el("option", { value: String(v), textContent: t, selected: String(conf[chave]) === String(v) })));
    s.addEventListener("change", () => { conf[chave] = typeof conf[chave] === "number" ? Number(s.value) : s.value; reiniciar(chave === "dados"); });
    return el("label", {}, [rotulo, s]);
  };
  const lado = el("div", { className: "nv-lado" }, [
    el("section", { className: "g-cartao" }, [el("h3", { textContent: "O que a rede vê" }),
      el("canvas", { id: "nv-mapa", width: 240, height: 240, title: "Toque num ponto para ver como a rede pensa sobre ele" }),
      el("div", { className: "nv-legenda" }, [el("span", {}, [el("i", { style: `background:${COR_A}` }), "classe laranja"]), el("span", {}, [el("i", { style: `background:${COR_B}` }), "classe azul"]),
        el("span", { textContent: "· fundo = o que a rede acha de cada lugar" })])]),
    el("section", { className: "g-cartao" }, [el("h3", { textContent: "Aprendizado" }),
      el("div", { className: "nv-num" }, [el("div", {}, [el("span", { className: "g-apoio", textContent: "acerto" }), el("b", { id: "nv-acerto", textContent: "—" })]),
        el("div", {}, [el("span", { className: "g-apoio", textContent: "erro" }), el("b", { id: "nv-perda", textContent: "—" })]),
        el("div", {}, [el("span", { className: "g-apoio", textContent: "passos" }), el("b", { id: "nv-passos", textContent: "0" })])]),
      el("canvas", { id: "nv-erro", width: 320, height: 70 })]),
    el("section", { className: "g-cartao" }, [el("h3", { textContent: "Montar a rede" }),
      el("div", { className: "nv-campos" }, [
        sel("Dados", "dados", Object.entries(DADOS).map(([k, d]) => [k, d.nome])),
        sel("Camadas escondidas", "camadas", [[1, "1"], [2, "2"], [3, "3"]]),
        sel("Neurônios por camada", "neuronios", [[4, "4"], [6, "6"], [8, "8"], [12, "12"]]),
        sel("Velocidade de aprender", "taxa", [[0.01, "devagar"], [0.03, "normal"], [0.08, "rápida"], [0.2, "muito rápida"]]),
        sel("Ativação", "ativacao", [["tanh", "tanh (suave)"], ["relu", "ReLU (em degrau)"]]),
      ]),
      el("div", { className: "acoes" }, [btnRodar, el("button", { className: "btn", textContent: "↺ Recomeçar", onclick: () => reiniciar(false) })])]),
    el("section", { className: "g-cartao" }, [el("h3", { textContent: "Como ler" }),
      el("p", { className: "g-apoio", textContent: "Cada bolinha é um neurônio; cada linha, um peso. Linha azul = peso positivo, laranja = negativo; quanto mais forte, mais brilha. Os neurônios acendem com o ponto escolhido no quadro (toque nele para trocar). É uma rede pequena de verdade, aprendendo agora no seu aparelho — a GIDEON usa a mesma ideia com bilhões de pesos." })]),
  ]);
  const raiz = el("section", { id: "neural", hidden: true }, [
    el("header", { className: "nv-topo" }, [el("div", {}, [el("span", { className: "g-barra" }), el("h2", { className: "g-titulo" }, ["Neural ", el("em", { textContent: "Visualizer" })])]),
      el("div", { className: "acoes" }, [fechar])]),
    el("div", { className: "nv-corpo" }, [palco, lado]),
  ]);
  document.head.append(css); document.body.append(raiz);
  const mapa = raiz.querySelector("#nv-mapa");
  mapa.addEventListener("click", (e) => { // escolher o ponto que a rede vai "pensar" em 3D
    const r = mapa.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * 2 - 1, y = -(((e.clientY - r.top) / r.height) * 2 - 1);
    let melhor = null, dm = 1e9; for (const p of dados) { const d = (p[0] - x) ** 2 + (p[1] - y) ** 2; if (d < dm) { dm = d; melhor = p; } }
    amostra = dm < 0.02 && melhor ? melhor : [x, y, null];
  });
  return { raiz, palco, mapa, erro: raiz.querySelector("#nv-erro"), canvas3d: raiz.querySelector("#nv-3d"), rotulos: raiz.querySelector("#nv-rotulos") };
}

function reiniciar(novosDados) {
  if (novosDados || !dados.length) dados = DADOS[conf.dados].gerar();
  rede = new Rede([2, ...new Array(conf.camadas).fill(conf.neuronios), 2], conf.ativacao);
  erros = []; amostra = dados[Math.floor(Math.random() * dados.length)];
  montar3D();
}

// ---------- 3D: camadas lado a lado, neurônios e pesos ----------
function montar3D() {
  if (!ui) return;
  if (!r3) {
    let renderer = null;
    try { renderer = new THREE.WebGLRenderer({ canvas: ui.canvas3d, antialias: true, alpha: true }); } catch (e) { console.warn("neural 3D:", e); }
    r3 = { renderer, cena: new THREE.Scene(), camera: new THREE.PerspectiveCamera(45, 1, 0.1, 100), grupo: null, yaw: 0.35, alvoYaw: 0.35 };
    if (renderer) renderer.setClearColor(0x000000, 0);
    // girar arrastando
    let x0 = null;
    ui.canvas3d.addEventListener("pointerdown", (e) => { x0 = e.clientX; ui.canvas3d.setPointerCapture(e.pointerId); });
    ui.canvas3d.addEventListener("pointermove", (e) => { if (x0 !== null) { r3.alvoYaw += (e.clientX - x0) * 0.008; x0 = e.clientX; } });
    ui.canvas3d.addEventListener("pointerup", () => { x0 = null; });
  }
  if (r3.grupo) r3.cena.remove(r3.grupo);
  const g = new THREE.Group(); r3.grupo = g; r3.cena.add(g);
  const t = rede.t, DX = 2.1, DY = 0.62;
  r3.pos = t.map((n, l) => Array.from({ length: n }, (_, i) => new THREE.Vector3((l - (t.length - 1) / 2) * DX, ((n - 1) / 2 - i) * DY, 0)));
  r3.neur = r3.pos.map((camada) => camada.map((p) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 14), new THREE.MeshBasicMaterial({ color: 0x1a3a6a, transparent: true }));
    m.position.copy(p); g.add(m);
    const anel = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.012, 6, 32), new THREE.MeshBasicMaterial({ color: 0x4fa3ff, transparent: true, opacity: 0.5 }));
    anel.position.copy(p); g.add(anel); return m;
  }));
  let n = 0; for (let l = 1; l < t.length; l++) n += t[l] * t[l - 1];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 6), 3));
  geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 6), 3));
  let k = 0; const ps = geo.attributes.position;
  for (let l = 1; l < t.length; l++) for (let j = 0; j < t[l]; j++) for (let i = 0; i < t[l - 1]; i++) { const a = r3.pos[l - 1][i], b = r3.pos[l][j]; ps.setXYZ(k++, a.x, a.y, a.z); ps.setXYZ(k++, b.x, b.y, b.z); }
  r3.linhas = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  g.add(r3.linhas);
  // nomes das camadas
  ui.rotulos.replaceChildren(...t.map((nn, l) => el("div", { className: "nv-rot", textContent: l === 0 ? "entrada (x, y)" : l === t.length - 1 ? "saída" : `camada ${l} · ${nn}` })));
  ajustar3D();
}
function ajustar3D() {
  if (!r3?.renderer || !ui) return;
  const w = ui.palco.clientWidth, h = ui.palco.clientHeight; if (!w || !h) return;
  r3.renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); r3.renderer.setSize(w, h, false);
  r3.camera.aspect = w / h; r3.camera.updateProjectionMatrix();
  const largura = (rede.t.length - 1) * 2.1 + 1.6;
  r3.dist = Math.max(6, (largura / 2) / Math.tan(THREE.MathUtils.degToRad(22.5)) / Math.min(r3.camera.aspect, 1.4) * 1.05);
}
const corC = new THREE.Color(0x2fc6ff), corA = new THREE.Color(0xffcf6e), base = new THREE.Color(0x1a3a6a), tmp = new THREE.Color();
function desenhar3D(dt) {
  if (!r3?.renderer) return;
  // pesos: cor pelo sinal, brilho pela força
  const cs = r3.linhas.geometry.attributes.color; let k = 0;
  for (let l = 0; l < rede.W.length; l++) for (let j = 0; j < rede.W[l].length; j++) for (let i = 0; i < rede.W[l][j].length; i++) {
    const w = rede.W[l][j][i], f = Math.min(1, Math.abs(w) / 2.2) * 0.95 + 0.05; tmp.copy(w >= 0 ? corC : corA).multiplyScalar(f);
    cs.setXYZ(k++, tmp.r, tmp.g, tmp.b); cs.setXYZ(k++, tmp.r, tmp.g, tmp.b);
  }
  cs.needsUpdate = true;
  // neurônios: acendem com a ativação do ponto escolhido
  if (amostra) {
    const { as } = rede.frente([amostra[0], amostra[1]]);
    as.forEach((camada, l) => camada.forEach((a, i) => {
      const m = r3.neur[l]?.[i]; if (!m) return;
      const v = l === as.length - 1 ? a : rede.act === "relu" && l > 0 ? Math.min(1, a / 2) : Math.abs(a);
      const cor = l === as.length - 1 ? (i === 1 ? corC : corA) : (a >= 0 ? corC : corA);
      m.material.color.copy(base).lerp(cor, Math.min(1, v)); m.scale.setScalar(0.8 + Math.min(1, v) * 0.6);
    }));
  }
  r3.yaw += (r3.alvoYaw - r3.yaw) * Math.min(1, dt * 5); r3.alvoYaw += dt * 0.05;
  const d = r3.dist || 9; r3.camera.position.set(Math.sin(r3.yaw) * d, 1.2, Math.cos(r3.yaw) * d); r3.camera.lookAt(0, 0, 0);
  r3.renderer.render(r3.cena, r3.camera);
  // nomes embaixo de cada camada
  const v = new THREE.Vector3(), w = ui.palco.clientWidth, h = ui.palco.clientHeight;
  [...ui.rotulos.children].forEach((r, l) => { const ult = r3.pos[l][r3.pos[l].length - 1]; v.set(ult.x, ult.y - 0.5, 0).project(r3.camera); r.style.transform = `translate(${(v.x * 0.5 + 0.5) * w}px, ${(-v.y * 0.5 + 0.5) * h}px) translate(-50%, 0)`; });
}

// ---------- quadro 2D: fronteira de decisão, pontos e curva do erro ----------
function desenharMapa() {
  const c = ui.mapa, g = c.getContext("2d"), N = 48, cel = c.width / N;
  for (let yi = 0; yi < N; yi++) for (let xi = 0; xi < N; xi++) {
    const x = (xi + 0.5) / N * 2 - 1, y = -((yi + 0.5) / N * 2 - 1), p = rede.frente([x, y]).as.at(-1)[1];
    const conf_ = Math.abs(p - 0.5) * 2, cor = p > 0.5 ? [47, 198, 255] : [255, 207, 110];
    g.fillStyle = `rgba(${cor[0]},${cor[1]},${cor[2]},${0.08 + conf_ * 0.32})`; g.clearRect(xi * cel, yi * cel, cel + 1, cel + 1); g.fillRect(xi * cel, yi * cel, cel + 1, cel + 1);
  }
  let certos = 0;
  for (const [x, y, cl] of dados) {
    const p = rede.frente([x, y]).as.at(-1)[1]; if ((p > 0.5 ? 1 : 0) === cl) certos++;
    g.beginPath(); g.arc((x + 1) / 2 * c.width, (1 - (y + 1) / 2) * c.height, 3, 0, Math.PI * 2);
    g.fillStyle = cl ? COR_B : COR_A; g.fill(); g.strokeStyle = "rgba(2,4,9,.8)"; g.lineWidth = 1; g.stroke();
  }
  if (amostra) { g.beginPath(); g.arc((amostra[0] + 1) / 2 * c.width, (1 - (amostra[1] + 1) / 2) * c.height, 7, 0, Math.PI * 2); g.strokeStyle = "#f2f7ff"; g.lineWidth = 2; g.stroke(); }
  document.getElementById("nv-acerto").textContent = `${Math.round((certos / dados.length) * 100)}%`;
}
function desenharErro() {
  const c = ui.erro, g = c.getContext("2d"); g.clearRect(0, 0, c.width, c.height);
  if (erros.length < 2) return;
  const max = Math.max(...erros, 0.01);
  g.beginPath(); erros.forEach((e, i) => { const x = (i / (erros.length - 1)) * c.width, y = c.height - 4 - (e / max) * (c.height - 8); i ? g.lineTo(x, y) : g.moveTo(x, y); });
  const grad = g.createLinearGradient(0, 0, c.width, 0); grad.addColorStop(0, "#2fc6ff"); grad.addColorStop(1, "#1f5bff");
  g.strokeStyle = grad; g.lineWidth = 2; g.stroke();
  document.getElementById("nv-perda").textContent = erros.at(-1).toFixed(3);
  document.getElementById("nv-passos").textContent = String(rede.passo);
}

// ---------- laço ----------
let antes = 0;
function laco(agora) {
  if (!aberto) return;
  const dt = Math.min((agora - antes) / 1000, 0.05); antes = agora;
  if (rodando) {
    for (let s = 0; s < 4; s++) { const lote = []; for (let i = 0; i < 24; i++) lote.push(dados[Math.floor(Math.random() * dados.length)]); const e = rede.treinar(lote, conf.taxa); if (s === 3) { erros.push(e); if (erros.length > 300) erros.shift(); } }
  }
  if (agora - ultimoMapa > 180) { ultimoMapa = agora; desenharMapa(); desenharErro(); }
  desenhar3D(dt);
  requestAnimationFrame(laco);
}

// ---------- abrir e fechar ----------
export function abrirNeural(d) {
  deps = d; ui ??= criarUI();
  ui.raiz.hidden = false; aberto = true; deps?.pausar?.(true);
  if (!rede) reiniciar(true); else { montar3D(); }
  requestAnimationFrame(() => { ajustar3D(); antes = performance.now(); requestAnimationFrame(laco); });
}
export function fecharNeural() { if (!ui) return; ui.raiz.hidden = true; aberto = false; deps?.pausar?.(false); }
export const neuralAberto = () => aberto;
addEventListener("resize", () => { if (aberto) ajustar3D(); });
