// GIDEON Core — gestos pela câmera (módulo 61, parte 2; decisão 024).
// A câmera só liga quando o dono aperta "✋ Gestos". A imagem é analisada no próprio aparelho (MediaPipe, no navegador):
// nada da câmera é enviado para servidor nenhum. Gestos:
//   ☝️ apontar o indicador  → cursor de luz na tela
//   🤏 pinça rápida          → clicar no que está embaixo do cursor
//   🤏 segurar a pinça e mexer → girar o núcleo; aproximar/afastar a mão (com a pinça) → zoom
//   🖐️ mão aberta parada      → menu circular (aponte e faça a pinça para escolher)
//   ✊ punho                  → fechar o menu ou o painel aberto
// MediaPipe tasks-vision 1.2.0 e o modelo de mãos ficam no próprio site (vendor/mediapipe/, ver vendor/LEIA.md)
const MP = new URL("./vendor/mediapipe", import.meta.url).href;
const MODELO = new URL("./vendor/mediapipe/hand_landmarker.task", import.meta.url).href;
const LIGACOES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [0, 17], [17, 18], [18, 19], [19, 20]];
const MENU = [
  { id: "comando", nome: "Comando", icone: "🎛️" }, { id: "gideon", nome: "GIDEON Lab", icone: "🧪" }, { id: "neural", nome: "Neural Lab", icone: "🧠" },
  { id: "world", nome: "World Lab", icone: "🌎" }, { id: "link:./", nome: "Voz", icone: "🎙️" }, { id: "link:nexus.html", nome: "Nexus", icone: "🖥️" },
  { id: "link:equipe.html", nome: "Equipe", icone: "👥" },
];

// ---------- leitura da mão (função pura: dá para testar sem câmera) ----------
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export function interpretar(lm) {
  const tam = dist(lm[0], lm[9]) || 1e-6; // tamanho da mão (pulso até a base do dedo médio)
  const estendido = (ponta, junta) => dist(lm[0], lm[ponta]) > dist(lm[0], lm[junta]) * 1.15;
  const ind = estendido(8, 6), med = estendido(12, 10), anel = estendido(16, 14), mini = estendido(20, 18);
  const polegar = dist(lm[4], lm[17]) > dist(lm[3], lm[17]) * 1.05;
  const pincaD = dist(lm[4], lm[8]) / tam;
  const indLonge = dist(lm[0], lm[8]) > tam * 1.05; // na pinça o indicador fica longe do pulso; no punho, enrolado perto
  const n = [ind, med, anel, mini].filter(Boolean).length;
  let forma = "outra";
  if (n === 4 && polegar && pincaD > 0.45) forma = "aberta";
  else if (n === 0 && !indLonge) forma = "punho";
  else if (ind && !med && !anel && !mini) forma = "aponta";
  return { forma, pincaD, indLonge, tam, cursor: { x: 1 - lm[8].x, y: lm[8].y }, palma: { x: 1 - lm[9].x, y: lm[9].y } };
}

// ---------- estado ----------
let controle = null, landmarker = null, video = null, fluxo = null, ativo = false, ultimoTempoVideo = -1;
let ui = null;
const est = { cursor: null, pinca: false, pincaIni: null, girando: false, formaDesde: { forma: "", t: 0 }, menu: null, menuDesde: 0, espera: 0, semMao: 0, distIni: 0 };

function criarUI() {
  const css = document.createElement("style");
  css.textContent = `
  #gx-caixa { position:fixed; left:16px; bottom:76px; z-index:3; width:176px; pointer-events:none; font:12px/1.4 var(--g-fonte, system-ui); color:var(--g-texto-2, #b4c6e0); }
  #gx-video-wrap { position:relative; width:176px; height:132px; border-radius:14px; overflow:hidden; border:1px solid var(--g-borda-forte, #2a4a7a); background:#000; box-shadow:0 8px 24px rgba(0,0,0,.5); }
  #gx-video, #gx-tela { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; transform:scaleX(-1); }
  #gx-estado { margin-top:6px; font:700 10.5px var(--g-fonte-titulo, system-ui); letter-spacing:.12em; text-transform:uppercase; color:var(--g-acento, #4fa3ff); }
  #gx-legenda { margin-top:4px; background:rgba(10,16,34,.7); border:1px solid var(--g-borda, #1d3557); border-radius:10px; padding:6px 8px; font-size:11.5px; }
  #gx-cursor { position:fixed; left:0; top:0; z-index:6; width:26px; height:26px; margin:-13px 0 0 -13px; border-radius:50%; pointer-events:none; display:none;
    border:2px solid #7fc6ff; box-shadow:0 0 14px #2f8bff, inset 0 0 8px #2f8bff; transition:background .12s, transform .12s; }
  #gx-cursor.pinca { background:rgba(79,163,255,.55); transform:scale(.75); }
  #gx-menu { position:fixed; z-index:5; left:50%; top:50%; width:0; height:0; pointer-events:none; }
  #gx-menu .item { position:absolute; width:96px; height:96px; margin:-48px 0 0 -48px; border-radius:50%; display:grid; place-items:center; text-align:center;
    background:rgba(8,14,30,.82); border:1px solid var(--g-borda-forte, #2a4a7a); color:var(--g-texto, #f2f7ff); font:700 10px var(--g-fonte-titulo, system-ui);
    letter-spacing:.1em; text-transform:uppercase; box-shadow:0 0 18px rgba(31,91,255,.25); transition:transform .15s, background .15s, border-color .15s; }
  #gx-menu .item span { display:block; font-size:22px; margin-bottom:2px; }
  #gx-menu .item.foco { transform:scale(1.14); background:rgba(31,91,255,.45); border-color:#7fc6ff; }
  #gx-menu .centro { position:absolute; width:120px; margin-left:-60px; top:-10px; text-align:center; font:700 10px var(--g-fonte-titulo, system-ui); letter-spacing:.16em; color:var(--g-texto-3, #7489a8); }
  @media (max-width: 640px) { #gx-caixa { left:auto; right:12px; top:64px; bottom:auto; width:112px; } #gx-video-wrap { width:112px; height:84px; } #gx-legenda { display:none; }
    #gx-menu .item { width:76px; height:76px; margin:-38px 0 0 -38px; font-size:9px; } }`;
  document.head.append(css);
  const caixa = Object.assign(document.createElement("div"), { id: "gx-caixa" });
  caixa.innerHTML = `<div id="gx-video-wrap"><video id="gx-video" playsinline muted></video><canvas id="gx-tela" width="320" height="240"></canvas></div>
    <div id="gx-estado">ligando a câmera…</div>
    <div id="gx-legenda">☝️ apontar = cursor<br>🤏 pinça rápida = clicar<br>🤏 segurar e mexer = girar<br>🖐️ mão aberta parada = menu<br>✊ punho = fechar</div>`;
  const cursor = Object.assign(document.createElement("div"), { id: "gx-cursor" });
  const menu = Object.assign(document.createElement("div"), { id: "gx-menu", hidden: true });
  document.body.append(caixa, cursor, menu);
  return { css, caixa, cursor, menu, estado: caixa.querySelector("#gx-estado"), tela: caixa.querySelector("#gx-tela") };
}
const avisar = (t) => { if (ui) ui.estado.textContent = t; };

// ---------- ligar e desligar ----------
export async function ligar(ctl) {
  if (ativo) return;
  controle = ctl; ativo = true;
  ui = criarUI();
  video = ui.caixa.querySelector("#gx-video");
  try {
    fluxo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
  } catch (e) {
    avisar("sem câmera: " + (e.name === "NotAllowedError" ? "permissão negada" : e.message));
    setTimeout(desligar, 4000); throw e;
  }
  if (!ativo) { fluxo.getTracks().forEach((t) => t.stop()); return; }
  video.srcObject = fluxo; await video.play().catch(() => {});
  avisar("carregando o leitor de mãos…");
  if (!landmarker) {
    const { FilesetResolver, HandLandmarker } = await import(`${MP}/vision_bundle.mjs`);
    const arquivos = await FilesetResolver.forVisionTasks(`${MP}/wasm`);
    const opcoes = (delegate) => ({ baseOptions: { modelAssetPath: MODELO, delegate }, runningMode: "VIDEO", numHands: 1,
      minHandDetectionConfidence: 0.6, minHandPresenceConfidence: 0.6, minTrackingConfidence: 0.5 });
    landmarker = await HandLandmarker.createFromOptions(arquivos, opcoes("GPU")).catch(() => HandLandmarker.createFromOptions(arquivos, opcoes("CPU")))
      .catch((e) => { avisar("este navegador não conseguiu ler as mãos"); throw e; });
  }
  if (!ativo) return;
  avisar("mostre a mão para a câmera");
  requestAnimationFrame(laco);
}
export function desligar() {
  ativo = false;
  fluxo?.getTracks().forEach((t) => t.stop()); fluxo = null;
  fecharMenu();
  if (ui) { ui.caixa.remove(); ui.cursor.remove(); ui.menu.remove(); ui.css.remove(); ui = null; }
  controle?.apontar(null); controle = null;
}
export const ligado = () => ativo;
export function testar(ctl) { controle = ctl; ui ??= criarUI(); } // só para testes automáticos: a lógica dos gestos, sem câmera

// ---------- laço: lê a mão a cada quadro novo da câmera ----------
function laco() {
  if (!ativo) return;
  if (video.readyState >= 2 && video.currentTime !== ultimoTempoVideo && !document.hidden) {
    ultimoTempoVideo = video.currentTime;
    const r = landmarker.detectForVideo(video, performance.now());
    const lm = r.landmarks?.[0] ?? null;
    desenhar(lm);
    processar(lm, performance.now());
  }
  requestAnimationFrame(laco);
}
function desenhar(lm) {
  const c = ui.tela, g = c.getContext("2d");
  g.clearRect(0, 0, c.width, c.height);
  if (!lm) return;
  g.strokeStyle = "rgba(127,198,255,.9)"; g.lineWidth = 2; g.fillStyle = "#2f8bff";
  for (const [a, b] of LIGACOES) { g.beginPath(); g.moveTo(lm[a].x * c.width, lm[a].y * c.height); g.lineTo(lm[b].x * c.width, lm[b].y * c.height); g.stroke(); }
  for (const p of lm) { g.beginPath(); g.arc(p.x * c.width, p.y * c.height, 3, 0, Math.PI * 2); g.fill(); }
}

// posição na tela (a mão não alcança as bordas da câmera: usa o miolo da imagem)
const naTela = (p) => {
  const ajusta = (v) => Math.min(1, Math.max(0, (v - 0.12) / 0.76));
  return { x: ajusta(p.x) * innerWidth, y: ajusta(p.y) * innerHeight };
};

// ---------- gestos → ações ----------
export function processar(lm, agora) {
  if (!controle) return;
  if (!lm) {
    if (!est.semMao) est.semMao = agora;
    if (agora - est.semMao > 1200) { if (ui) ui.cursor.style.display = "none"; est.cursor = null; controle.apontar(null); }
    if (est.pinca) soltarPinca(agora, true);
    avisar("mostre a mão para a câmera");
    return;
  }
  est.semMao = 0;
  const m = interpretar(lm);
  // cursor suave
  const alvo = naTela(m.cursor);
  est.cursor = est.cursor ? { x: est.cursor.x + (alvo.x - est.cursor.x) * 0.38, y: est.cursor.y + (alvo.y - est.cursor.y) * 0.38 } : alvo;
  if (ui) { ui.cursor.style.display = "block"; ui.cursor.style.transform = `translate(${est.cursor.x}px, ${est.cursor.y}px)`; }
  if (est.menu) focarMenu(est.cursor); else controle.apontar(est.cursor);

  // pinça (com folga para não piscar)
  const pincando = est.pinca ? m.pincaD < 0.5 : m.pincaD < 0.33 && m.indLonge;
  if (pincando && !est.pinca) {
    est.pinca = true; est.pincaIni = { t: agora, palma: m.palma, ultima: m.palma, tam: m.tam, cursor: { ...est.cursor } }; est.girando = false;
    est.distIni = controle.distancia();
    ui?.cursor.classList.add("pinca");
  } else if (!pincando && est.pinca) soltarPinca(agora, false);
  if (est.pinca && !est.menu) {
    const ini = est.pincaIni, moveu = Math.hypot(m.palma.x - ini.palma.x, m.palma.y - ini.palma.y);
    if (!est.girando && (moveu > 0.035 || agora - ini.t > 450)) est.girando = true;
    if (est.girando) {
      controle.girar((m.palma.x - ini.ultima.x) * 4.2, (m.palma.y - ini.ultima.y) * 2.6);
      ini.ultima = m.palma;
      const razao = m.tam / ini.tam; // mão mais perto da câmera = maior = aproxima
      if (Math.abs(razao - 1) > 0.12) controle.definirDistancia(est.distIni / Math.pow(razao, 1.4));
      avisar("girando");
    }
  }

  // formas seguradas: mão aberta (menu) e punho (fechar)
  if (m.forma !== est.formaDesde.forma) est.formaDesde = { forma: m.forma, t: agora };
  const segurou = agora - est.formaDesde.t;
  if (agora > est.espera && !est.pinca) {
    if (m.forma === "aberta" && segurou > 650 && !est.menu) { abrirMenu(agora); est.espera = agora + 700; }
    else if (m.forma === "punho" && segurou > 420) {
      if (est.menu) fecharMenu(); else controle.fechar();
      est.espera = agora + 900; avisar("fechado");
    }
  }
  if (est.menu && agora - est.menuDesde > 9000) fecharMenu();
  if (!est.pinca) avisar(est.menu ? "aponte e faça a pinça para escolher" : m.forma === "aberta" ? "segure a mão aberta: menu" : m.forma === "punho" ? "punho: fechar" : "pronto");
}
function soltarPinca(agora, perdeu) {
  const ini = est.pincaIni;
  est.pinca = false; ui?.cursor.classList.remove("pinca");
  if (perdeu || !ini) return;
  if (!est.girando && agora - ini.t < 650) { // pinça rápida = clique
    if (est.menu) escolherMenu();
    else controle.clicar(est.cursor.x, est.cursor.y);
    est.espera = agora + 500; avisar("clique");
  }
  est.girando = false;
}

// ---------- menu circular ----------
function abrirMenu(agora) {
  if (!ui) return;
  est.menu = { foco: null }; est.menuDesde = agora;
  const raio = Math.min(innerWidth, innerHeight) * (innerWidth < 640 ? 0.32 : 0.26);
  ui.menu.replaceChildren(Object.assign(document.createElement("div"), { className: "centro", textContent: "MENU" }), ...MENU.map((it, i) => {
    const a = -Math.PI / 2 + (i / MENU.length) * Math.PI * 2;
    const d = Object.assign(document.createElement("div"), { className: "item" });
    d.dataset.id = it.id; d.style.left = `${Math.cos(a) * raio}px`; d.style.top = `${Math.sin(a) * raio}px`;
    d.append(Object.assign(document.createElement("span"), { textContent: it.icone }), it.nome);
    return d;
  }));
  ui.menu.hidden = false;
}
function focarMenu(c) {
  const cx = innerWidth / 2, cy = innerHeight / 2, dx = c.x - cx, dy = c.y - cy;
  let foco = null;
  if (Math.hypot(dx, dy) > 50) {
    const a = (Math.atan2(dy, dx) + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);
    foco = MENU[Math.round(a / ((Math.PI * 2) / MENU.length)) % MENU.length].id;
  }
  est.menu.foco = foco;
  ui?.menu.querySelectorAll(".item").forEach((d) => d.classList.toggle("foco", d.dataset.id === foco));
}
function escolherMenu() {
  const id = est.menu?.foco;
  fecharMenu();
  if (!id) return;
  if (id.startsWith("link:")) location.href = id.slice(5); else controle.abrir(id);
}
function fecharMenu() { est.menu = null; if (ui) { ui.menu.hidden = true; ui.menu.replaceChildren(); } }
