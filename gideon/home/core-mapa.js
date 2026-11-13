// GIDEON Core — Thought Map (módulo 72, decisão 026): um problema vira um mapa de partes, hipóteses, alternativas, riscos e dependências.
// A IA monta o mapa (rota nexus/mapa-criar); cada item pode ser expandido pela IA, renomeado, apagado ou virar tarefa de verdade.
// Os mapas ficam guardados (tabela gideon_mapas). Arrastar move, rolar/pinça aproxima, tocar num item abre as ações.
const TIPOS = {
  raiz: { nome: "objetivo", cor: "#f2f7ff" }, parte: { nome: "parte", cor: "#2fc6ff" }, hipotese: { nome: "hipótese", cor: "#4fa3ff" },
  alternativa: { nome: "alternativa", cor: "#2fe0b0" }, risco: { nome: "risco", cor: "#ffcf6e" }, dependencia: { nome: "dependência", cor: "#8aa4c8" },
};
let d = null, ui = null, mapa = null, sel = null, vista = { x: 0, y: 0, s: 1 }, aberto = false, ocupado = false;
const el = (tag, props = {}, filhos = []) => { const e = Object.assign(document.createElement(tag), props); e.append(...filhos.filter((f) => f != null)); return e; };

function criarUI() {
  const css = el("style", { textContent: `
  #mapa { position:fixed; inset:0; z-index:4; background:radial-gradient(ellipse at 50% 40%, rgba(8,20,48,.72), rgba(2,4,9,.94)); backdrop-filter:blur(3px);
    display:flex; flex-direction:column; font:14px/1.45 var(--g-fonte); color:var(--g-texto); }
  #mapa[hidden] { display:none; }
  #mapa .mp-topo { position:static; pointer-events:auto; display:flex; align-items:flex-end; justify-content:space-between; gap:10px; padding:max(14px, env(safe-area-inset-top)) 16px 8px; flex-wrap:wrap; }
  .mp-topo h2 { margin:8px 0 0; }
  .mp-botoes { display:flex; gap:8px; align-items:center; }
  .mp-novo { display:flex; gap:8px; padding:0 16px 10px; }
  .mp-novo input { flex:1; min-width:0; background:rgba(6,10,24,.85); color:var(--g-texto); border:1px solid var(--g-borda-forte); border-radius:12px; padding:10px 12px; font:inherit; }
  #mp-palco { position:relative; flex:1; overflow:hidden; touch-action:none; cursor:grab; }
  #mp-palco.arrastando { cursor:grabbing; }
  #mp-mundo { position:absolute; left:0; top:0; transform-origin:0 0; }
  #mp-linhas { position:absolute; left:0; top:0; overflow:visible; width:1px; height:1px; pointer-events:none; }
  .mp-no { position:absolute; transform:translate(-50%, -50%); width:150px; padding:8px 10px 9px; border-radius:12px; cursor:pointer; text-align:center;
    background:linear-gradient(180deg, rgba(16,28,56,.9), rgba(8,14,30,.92)); border:1px solid var(--cor); box-shadow:0 0 14px color-mix(in srgb, var(--cor) 30%, transparent);
    transition:box-shadow .15s, transform .15s; user-select:none; }
  .mp-no:hover, .mp-no.sel { box-shadow:0 0 22px var(--cor); transform:translate(-50%, -50%) scale(1.05); }
  .mp-no .tp { display:block; font:700 9px/1.2 var(--g-fonte-titulo); letter-spacing:.14em; text-transform:uppercase; color:var(--cor); margin-bottom:3px; }
  .mp-no .tt { font:600 13px/1.25 var(--g-fonte); color:var(--g-texto); }
  .mp-no.raiz { width:190px; padding:12px; background:linear-gradient(135deg, var(--g-azul), #2fa8ff); border:0; }
  .mp-no.raiz .tp { color:rgba(255,255,255,.75); } .mp-no.raiz .tt { font:800 15px/1.2 var(--g-fonte-titulo); text-transform:uppercase; color:#fff; }
  .mp-no .ok { position:absolute; top:-8px; right:-8px; width:20px; height:20px; border-radius:50%; background:var(--g-ok); color:#02120a; font:700 12px/20px sans-serif; }
  .mp-no.ocupado { animation:mp-pisca 1s ease-in-out infinite; } @keyframes mp-pisca { 50% { opacity:.45; } }
  #mp-acoes { position:absolute; right:16px; bottom:16px; width:min(340px, calc(100vw - 32px)); padding:14px; z-index:2; }
  #mp-acoes[hidden] { display:none; }
  #mp-acoes input { width:100%; background:rgba(6,10,24,.85); color:var(--g-texto); border:1px solid var(--g-borda-forte); border-radius:10px; padding:8px 10px; font:600 14px var(--g-fonte); margin:6px 0; }
  #mp-acoes .nota { color:var(--g-texto-2); font-size:13px; margin:2px 0 8px; }
  #mp-acoes .linha-b { display:flex; flex-wrap:wrap; gap:6px; }
  #mp-acoes .linha-b button { flex:1 1 45%; font-size:13px; padding:9px 8px; }
  .mp-lista { position:absolute; left:16px; top:8px; z-index:2; width:min(320px, calc(100vw - 32px)); max-height:60%; overflow:auto; padding:10px; }
  .mp-lista[hidden] { display:none; }
  .mp-lista button { display:block; width:100%; text-align:left; margin:4px 0; }
  .mp-rodape { display:flex; flex-wrap:wrap; gap:6px; align-items:center; padding:8px 16px max(10px, env(safe-area-inset-bottom)); }
  .mp-tipo { font:700 9.5px var(--g-fonte-titulo); letter-spacing:.12em; text-transform:uppercase; padding:3px 8px; border-radius:6px; border:1px solid var(--cor); color:var(--cor); }
  #mp-aviso { position:absolute; left:50%; top:12px; transform:translateX(-50%); z-index:3; padding:8px 14px; border-radius:999px; background:rgba(8,14,30,.92);
    border:1px solid var(--g-borda-forte); font-size:13px; white-space:nowrap; max-width:calc(100vw - 32px); overflow:hidden; text-overflow:ellipsis; }
  #mp-aviso[hidden] { display:none; }
  .mp-vazio[hidden] { display:none; }
  .mp-vazio { position:absolute; inset:0; display:grid; place-items:center; text-align:center; color:var(--g-texto-2); padding:24px; pointer-events:none; }
  @media (max-width: 640px) { .mp-no { width:124px; padding:7px 8px; } .mp-no .tt { font-size:12px; } .mp-no.raiz { width:150px; }
    #mp-acoes { left:12px; right:12px; bottom:12px; width:auto; } }` });
  const campo = el("input", { type: "text", placeholder: "Qual problema ou objetivo? Ex.: criar um computador com IA", maxLength: 600 });
  const criar = el("button", { className: "btn grande", textContent: "Montar o mapa" }); criar.style.cssText = "width:auto; padding:10px 16px; margin:0";
  const lista = el("div", { className: "g-cartao mp-lista", hidden: true });
  const acoes = el("div", { className: "g-cartao", id: "mp-acoes", hidden: true });
  const aviso = el("div", { id: "mp-aviso", hidden: true });
  const linhas = document.createElementNS("http://www.w3.org/2000/svg", "svg"); linhas.id = "mp-linhas";
  const nos = el("div", { id: "mp-nos" });
  const mundo = el("div", { id: "mp-mundo" }, [linhas, nos]);
  const vazio = el("div", { className: "mp-vazio", textContent: "Escreva um problema ou objetivo em cima e toque em Montar o mapa. A IA divide em partes, hipóteses, alternativas, riscos e dependências." });
  const palco = el("div", { id: "mp-palco" }, [mundo, vazio, lista, acoes, aviso]);
  const raiz = el("section", { id: "mapa", hidden: true }, [
    el("header", { className: "mp-topo" }, [
      el("div", {}, [el("span", { className: "g-barra" }), el("h2", { className: "g-titulo" }, ["Thought ", el("em", { textContent: "Map" })])]),
      el("div", { className: "mp-botoes" }, [el("button", { className: "btn", textContent: "📂 Meus mapas", onclick: () => alternarLista() }),
        el("button", { className: "btn", textContent: "⤢ Centralizar", onclick: () => enquadrar() }),
        el("button", { id: "mp-fechar", textContent: "✕", ariaLabel: "Fechar o mapa", onclick: () => fecharMapa() })]),
    ]),
    el("div", { className: "mp-novo" }, [campo, criar]),
    palco,
    el("footer", { className: "mp-rodape" }, [...Object.entries(TIPOS).map(([, t]) => { const x = el("span", { className: "mp-tipo", textContent: t.nome }); x.style.setProperty("--cor", t.cor); return x; }),
      el("span", { className: "g-rodape", textContent: " · arraste para mover · role ou pinça para aproximar · toque num item" })]),
  ]);
  raiz.querySelector("#mp-fechar").style.cssText = "background:rgba(10,12,30,.8); border:1px solid var(--g-borda-forte); border-radius:50%; width:36px; height:36px; color:var(--g-texto); cursor:pointer";
  document.head.append(css); document.body.append(raiz);
  criar.addEventListener("click", () => novoMapa(campo.value));
  campo.addEventListener("keydown", (e) => { if (e.key === "Enter") novoMapa(campo.value); });
  ligarArrasto(palco);
  return { raiz, palco, mundo, linhas, nos, vazio, lista, acoes, aviso, campo, criar };
}

// ---------- abrir e fechar ----------
export function abrirMapa(deps, opcoes = {}) {
  d = deps; ui ??= criarUI();
  ui.raiz.hidden = false; aberto = true;
  if (opcoes.id) abrirPorId(Number(opcoes.id));
  else if (opcoes.assunto) { ui.campo.value = opcoes.assunto; novoMapa(opcoes.assunto); }
  else if (!mapa) carregarLista(true); else desenhar();
  setTimeout(() => (mapa ? ui.palco : ui.campo).focus?.({ preventScroll: true }), 50);
}
export function fecharMapa() { if (!ui) return; ui.raiz.hidden = true; aberto = false; ui.acoes.hidden = true; ui.lista.hidden = true; }
export const mapaAberto = () => aberto;

function avisar(t, ms = 3500) {
  ui.aviso.textContent = t; ui.aviso.hidden = false;
  clearTimeout(avisar.t); if (ms) avisar.t = setTimeout(() => { ui.aviso.hidden = true; }, ms);
}

// ---------- dados ----------
async function carregarLista(abrirUltimo = false) {
  try {
    const r = await d.nexus("mapas");
    ui.lista.replaceChildren(el("div", { className: "g-rotulo", textContent: "Meus mapas" }),
      ...(r.mapas?.length ? r.mapas.map((m) => el("button", { className: "btn", textContent: m.titulo, title: m.objetivo, onclick: () => abrirPorId(m.id) }))
        : [el("p", { className: "suave", textContent: "Nenhum mapa ainda." })]));
    if (abrirUltimo && r.mapas?.length) await abrirPorId(r.mapas[0].id);
  } catch (e) { avisar("Não consegui carregar os mapas: " + e.message); }
}
function alternarLista() { if (ui.lista.hidden) { carregarLista(); ui.lista.hidden = false; } else ui.lista.hidden = true; }
async function abrirPorId(id) {
  ui.lista.hidden = true;
  try { mapa = await d.nexus("mapa", { id }); sel = null; ui.acoes.hidden = true; desenhar(); enquadrar(); }
  catch (e) { avisar("Não consegui abrir: " + e.message); }
}
async function novoMapa(texto) {
  const objetivo = String(texto ?? "").trim();
  if (!objetivo) { ui.campo.focus(); return; }
  if (ocupado) return; ocupado = true; ui.criar.disabled = true;
  avisar("A IA está montando o mapa (uns 15 s)…", 0);
  try { mapa = await d.nexus("mapa-criar", { objetivo }); sel = null; ui.acoes.hidden = true; ui.campo.value = ""; desenhar(); enquadrar(); avisar(`Mapa pronto: ${mapa.nos.length} itens. Toque num item para expandir ou virar tarefa.`); }
  catch (e) { avisar("Não consegui montar: " + e.message, 6000); }
  ocupado = false; ui.criar.disabled = false;
}
async function salvar(titulo) {
  try { mapa = await d.nexus("mapa-salvar", { id: mapa.id, nos: mapa.nos, ...(titulo ? { titulo } : {}) }); desenhar(); }
  catch (e) { avisar("Não consegui salvar: " + e.message); }
}

// ---------- desenho: árvore em círculos (o objetivo no centro) ----------
function posicoes(nos) {
  const filhos = new Map(); nos.forEach((n) => { if (n.pai) (filhos.get(n.pai) ?? filhos.set(n.pai, []).get(n.pai)).push(n); });
  const raiz = nos.find((n) => !n.pai);
  const folhas = new Map(); const contar = (n) => { const f = filhos.get(n.id) ?? []; const v = f.length ? f.reduce((s, x) => s + contar(x), 0) : 1; folhas.set(n.id, v); return v; };
  if (!raiz) return new Map();
  contar(raiz);
  const estreito = innerWidth < 640, R1 = estreito ? 190 : 250, R2 = estreito ? 165 : 210;
  const pos = new Map([[raiz.id, { x: 0, y: 0, prof: 0 }]]);
  const colocar = (n, ini, fim, prof) => {
    const f = filhos.get(n.id) ?? []; const total = f.reduce((s, x) => s + folhas.get(x.id), 0); let a = ini;
    for (const x of f) {
      const span = ((fim - ini) * folhas.get(x.id)) / total, meio = a + span / 2, r = R1 + (prof) * R2;
      pos.set(x.id, { x: Math.cos(meio) * r, y: Math.sin(meio) * r, prof: prof + 1 });
      colocar(x, a, a + span, prof + 1); a += span;
    }
  };
  colocar(raiz, -Math.PI / 2, Math.PI * 1.5, 0);
  return pos;
}
function desenhar() {
  if (!ui || !mapa) return;
  ui.vazio.hidden = true;
  const pos = posicoes(mapa.nos);
  ui.linhas.replaceChildren(...mapa.nos.filter((n) => n.pai && pos.has(n.id) && pos.has(n.pai)).map((n) => {
    const a = pos.get(n.pai), b = pos.get(n.id), cor = (TIPOS[n.tipo] ?? TIPOS.parte).cor;
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const mx = (a.x + b.x) / 2 * 0.9, my = (a.y + b.y) / 2 * 0.9;
    p.setAttribute("d", `M${a.x},${a.y} Q${mx},${my} ${b.x},${b.y}`);
    p.setAttribute("stroke", cor); p.setAttribute("stroke-opacity", ".45"); p.setAttribute("stroke-width", "1.6"); p.setAttribute("fill", "none");
    return p;
  }));
  ui.nos.replaceChildren(...mapa.nos.filter((n) => pos.has(n.id)).map((n) => {
    const t = TIPOS[n.tipo] ?? TIPOS.parte, p = pos.get(n.id);
    const c = el("div", { className: `mp-no ${n.tipo === "raiz" ? "raiz" : ""}${sel === n.id ? " sel" : ""}`, title: n.nota || n.titulo, role: "button", tabIndex: 0 },
      [el("span", { className: "tp", textContent: t.nome }), el("div", { className: "tt", textContent: n.titulo }), n.tarefa_id ? el("span", { className: "ok", textContent: "✓", title: "virou tarefa" }) : null]);
    c.style.setProperty("--cor", t.cor); c.style.left = `${p.x}px`; c.style.top = `${p.y}px`; c.dataset.id = n.id;
    c.addEventListener("click", (e) => { e.stopPropagation(); selecionar(n.id); });
    c.addEventListener("keydown", (e) => { if (e.key === "Enter") selecionar(n.id); });
    return c;
  }));
  aplicarVista();
}
function enquadrar() {
  if (!mapa) return;
  const pos = [...posicoes(mapa.nos).values()];
  const xs = pos.map((p) => p.x), ys = pos.map((p) => p.y);
  const w = Math.max(...xs) - Math.min(...xs) + 220, h = Math.max(...ys) - Math.min(...ys) + 120;
  const W = ui.palco.clientWidth, H = ui.palco.clientHeight;
  vista.s = Math.min(1.1, Math.max(0.25, Math.min(W / w, H / h)));
  vista.x = W / 2 - ((Math.max(...xs) + Math.min(...xs)) / 2) * vista.s; vista.y = H / 2 - ((Math.max(...ys) + Math.min(...ys)) / 2) * vista.s;
  aplicarVista();
}
const aplicarVista = () => { ui.mundo.style.transform = `translate(${vista.x}px, ${vista.y}px) scale(${vista.s})`; };

// ---------- ações num item ----------
function selecionar(id) {
  sel = id; const n = mapa.nos.find((x) => x.id === id); if (!n) return;
  ui.nos.querySelectorAll(".mp-no").forEach((c) => c.classList.toggle("sel", c.dataset.id === id));
  const t = TIPOS[n.tipo] ?? TIPOS.parte;
  const nome = el("input", { type: "text", value: n.titulo, maxLength: 60, ariaLabel: "Nome do item" });
  const filhos = mapa.nos.filter((x) => x.pai === id).length;
  const b = (txt, fn, extra = "") => { const x = el("button", { className: "btn " + extra, textContent: txt }); x.addEventListener("click", fn); return x; };
  ui.acoes.replaceChildren(
    el("span", { className: "g-rotulo", textContent: t.nome }), nome,
    n.nota ? el("p", { className: "nota", textContent: n.nota }) : null,
    el("div", { className: "linha-b" }, [
      b("✨ Expandir com IA", () => expandir(n)),
      n.tarefa_id ? b("✓ Já é tarefa", () => avisar("Esse item já virou a tarefa #" + n.tarefa_id + ".")) : b("✅ Virar tarefa", () => virarTarefa(n)),
      b("💾 Salvar nome", () => { const v = nome.value.trim(); if (!v || v === n.titulo) return; n.titulo = v; salvar(n.pai ? undefined : v); avisar("Nome salvo."); }),
      n.pai ? b(filhos ? `🗑️ Apagar (+${filhos})` : "🗑️ Apagar", () => apagar(n), "perigo") : null,
      b("Fechar", () => { ui.acoes.hidden = true; sel = null; desenhar(); }),
    ]));
  ui.acoes.hidden = false;
  nome.addEventListener("keydown", (e) => { if (e.key === "Enter") { const v = nome.value.trim(); if (v && v !== n.titulo) { n.titulo = v; salvar(n.pai ? undefined : v); avisar("Nome salvo."); } } });
}
async function expandir(n) {
  if (ocupado) return; ocupado = true;
  ui.nos.querySelector(`[data-id="${CSS.escape(n.id)}"]`)?.classList.add("ocupado");
  avisar(`A IA está abrindo "${n.titulo}"…`, 0);
  try { const antes = mapa.nos.length; mapa = await d.nexus("mapa-expandir", { id: mapa.id, no: n.id }); desenhar(); enquadrar(); avisar(`${mapa.nos.length - antes} itens novos em "${n.titulo}".`); selecionar(n.id); }
  catch (e) { avisar("Não consegui expandir: " + e.message, 6000); desenhar(); }
  ocupado = false;
}
async function virarTarefa(n) {
  try { const r = await d.nexus("mapa-tarefa", { id: mapa.id, no: n.id }); mapa = r.mapa; desenhar(); selecionar(n.id); avisar(`Tarefa criada (#${r.tarefa_id}): aparece nas suas tarefas, no Telegram e no Nexus.`, 5000); }
  catch (e) { avisar("Não consegui criar a tarefa: " + e.message); }
}
function apagar(n) {
  const fora = new Set([n.id]); let mudou = true;
  while (mudou) { mudou = false; for (const x of mapa.nos) if (x.pai && fora.has(x.pai) && !fora.has(x.id)) { fora.add(x.id); mudou = true; } }
  if (fora.size > 1 && !confirm(`Apagar "${n.titulo}" e mais ${fora.size - 1} item(ns) abaixo dele?`)) return;
  mapa.nos = mapa.nos.filter((x) => !fora.has(x.id)); sel = null; ui.acoes.hidden = true; salvar(); avisar("Apagado.");
}

// ---------- mover e aproximar (mouse, toque e pinça) ----------
function ligarArrasto(palco) {
  const ponteiros = new Map(); let ultimo = null, pinca = null;
  palco.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".mp-no, #mp-acoes, .mp-lista, button, input")) return;
    palco.setPointerCapture(e.pointerId); ponteiros.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ponteiros.size === 1) ultimo = { x: e.clientX, y: e.clientY };
    if (ponteiros.size === 2) { const [a, b] = [...ponteiros.values()]; pinca = { d: Math.hypot(a.x - b.x, a.y - b.y), s: vista.s }; }
    palco.classList.add("arrastando");
  });
  palco.addEventListener("pointermove", (e) => {
    if (!ponteiros.has(e.pointerId)) return;
    ponteiros.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinca && ponteiros.size === 2) {
      const [a, b] = [...ponteiros.values()], r = palco.getBoundingClientRect();
      zoomEm((a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top, (pinca.s * Math.hypot(a.x - b.x, a.y - b.y)) / pinca.d / vista.s); return;
    }
    if (!ultimo) return;
    vista.x += e.clientX - ultimo.x; vista.y += e.clientY - ultimo.y; ultimo = { x: e.clientX, y: e.clientY }; aplicarVista();
  });
  const soltar = (e) => { ponteiros.delete(e.pointerId); if (ponteiros.size < 2) pinca = null; if (!ponteiros.size) { ultimo = null; palco.classList.remove("arrastando"); } };
  palco.addEventListener("pointerup", soltar); palco.addEventListener("pointercancel", soltar);
  palco.addEventListener("wheel", (e) => { e.preventDefault(); const r = palco.getBoundingClientRect(); zoomEm(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.12 : 1 / 1.12); }, { passive: false });
  palco.addEventListener("click", (e) => { if (!e.target.closest(".mp-no, #mp-acoes, .mp-lista, button, input")) { ui.acoes.hidden = true; ui.lista.hidden = true; if (sel) { sel = null; desenhar(); } } });
}
function zoomEm(px, py, fator) {
  const s = Math.min(2.5, Math.max(0.2, vista.s * fator)), f = s / vista.s;
  vista.x = px - (px - vista.x) * f; vista.y = py - (py - vista.y) * f; vista.s = s; aplicarVista();
}
