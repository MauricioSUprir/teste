import { Game, type GameOptions } from './game';
import { t, translateDom, setLang, getLang, LANGS, onLang, type Key, type Lang } from './core/i18n';
import { autoQuality, isMobile, type QualityId } from './core/quality';
import { applyViewport, toView } from './core/viewport';
import * as THREE from 'three';
import { Play } from './play';
import { marsTemp } from './sim/survival';
import { sfx } from './audio/sfx';
import { hasSave, clearSave, load as loadSave } from './sim/state';
import * as __mat from './render/materials';
(window as any).__mat = __mat;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

// ---------------------------------------------------------------- preferências
interface Prefs { quality: QualityId | 'auto'; fov: number; sens: number; invY: boolean; vol: number; res: 'dynamic' | '0.5' | '0.75' | '1' }
const DEFAULT_PREFS: Prefs = { quality: 'auto', fov: 70, sens: 1, invY: false, vol: 0.8, res: 'dynamic' };
function loadPrefs(): Prefs {
  try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem('ares.prefs') || '{}') }; } catch { return { ...DEFAULT_PREFS }; }
}
function savePrefs(p: Prefs) { try { localStorage.setItem('ares.prefs', JSON.stringify(p)); } catch { /* ignore */ } }
const prefs = loadPrefs();
const params = new URLSearchParams(location.search);

function resolveQuality(): QualityId {
  const qp = params.get('quality') as QualityId | null;
  if (qp) return qp;
  if (prefs.quality !== 'auto') return prefs.quality;
  const c = document.createElement('canvas');
  return autoQuality(c.getContext('webgl2'));
}

// ---------------------------------------------------------------- boot
const canvas = $<HTMLCanvasElement>('c');
document.documentElement.lang = getLang();
translateDom();

if (!canvas.getContext('webgl2')) {
  $('load-msg').textContent = t('err_webgl');
  throw new Error('no webgl2');
}

const opts: GameOptions = {
  quality: resolveQuality(),
  fov: prefs.fov,
  sensitivity: prefs.sens,
  invertY: prefs.invY,
  resScale: prefs.res === 'dynamic' ? 'dynamic' : parseFloat(prefs.res),
};
const game = new Game(canvas, opts);
game.input.sensitivity = prefs.sens;
game.input.invertY = prefs.invY;
game.input.joyEl = $('joy');
game.input.joyKnob = $('joy-knob');
(window as unknown as { __game: Game }).__game = game;

let loadKey: Key = 'loading';
game.load((key, frac) => {
  loadKey = key as Key;
  $('load-fill').style.width = `${Math.round(frac * 100)}%`;
  $('load-msg').textContent = t(loadKey);
}).then(() => {
  play_ = new Play(game);
  play_.onQuitToMenu = () => toMenu();
  $('loading').classList.add('hidden');
  showMenu();
  game.start();
  game.paused = true;
  game.menuMode = true;
  (window as unknown as { __ready: boolean }).__ready = true;
}).catch((e) => {
  console.error(e);
  $('load-msg').textContent = `${t('err_load')}: ${e?.message ?? e}`;
});

// ---------------------------------------------------------------- menus
let inGame = false;
let play_: Play | null = null;
let difficulty: 'easy' | 'normal' | 'hard' = 'normal';
let confirmNew = false;
let returnTo: 'menu' | 'pause' = 'menu';

function showMenu() {
  $('menu').classList.remove('hidden');
  $('btn-continue').classList.toggle('hidden', !hasSave() || !!loadSave()?.flags.won);
  $('diff').classList.add('hidden');
  confirmNew = false;
  $('hud').classList.add('hidden');
  buildLangs();
  // cena de fundo do menu: câmera em 3ª pessoa, relógio andando
}

function buildLangs() {
  const box = $('langs');
  box.innerHTML = '';
  for (const l of LANGS) {
    const b = document.createElement('button');
    b.textContent = l.name;
    b.className = l.id === getLang() ? 'on' : '';
    b.onclick = () => setLang(l.id);
    box.appendChild(b);
  }
}

function play() {
  if (play_ && !play_.active) play_.continueGame();
  sfx.unlock();
  sfx.suspend(false);
  sfx.setVolume(prefs.vol);
  if (play_) play_.voice.volume = prefs.vol;
  $('menu').classList.add('hidden');
  $('pause').classList.add('hidden');
  $('hud').classList.remove('hidden');
  inGame = true;
  game.menuMode = false;
  game.paused = false;
  game.input.clearPressed();
  const overlay = !!(play_ && (play_.hud.habOpen || play_.hud.armoryOpen || play_.dead || play_.won));
  game.input.enabled = !overlay;
  const touch = isMobile || game.input.touchMode;
  $('touch').classList.toggle('hidden', !touch);
  document.body.classList.toggle('touch', touch);
  if (!touch && !overlay) game.input.requestLock();
  checkOrientation();
}

function pause() {
  if (!inGame) return;
  sfx.suspend(true);
  play_?.voice.stop();
  game.paused = true;
  game.input.enabled = false;
  $('pause').classList.remove('hidden');
  if (document.pointerLockElement) document.exitPointerLock();
}

$('btn-continue').onclick = () => { play_?.continueGame(); play(); };
$('btn-play').onclick = () => {
  const d = $('diff');
  if (d.classList.contains('hidden')) { d.classList.remove('hidden'); return; }
  if (hasSave() && !confirmNew) { confirmNew = true; $('load-msg').textContent = ''; toastMenu(t('confirm_new')); return; }
  clearSave();
  play_?.newGame(difficulty);
  play();
};
document.querySelectorAll<HTMLElement>('#diff button').forEach((b) => (b.onclick = () => {
  difficulty = b.dataset.d as typeof difficulty;
  document.querySelectorAll('#diff button').forEach((x) => x.classList.toggle('on', x === b));
}));
function toastMenu(s: string) {
  let el = document.getElementById('menu-note');
  if (!el) { el = document.createElement('div'); el.id = 'menu-note'; el.className = 'menu-note'; $('diff').after(el); }
  el.textContent = s;
}
function toMenu() {
  if (play_) {
    play_.persist(false); play_.active = false;
    play_.hud.closeHab(); play_.exitBuild(); play_.hud.toggleMap(false); play_.hud.hideEnd();
    play_.inHab = false; game.setInterior(false); game.forceExitVehicle(); play_.voice.stop();
  }
  inGame = false;
  game.paused = true;
  game.menuMode = true;
  game.input.enabled = false;
  if (document.pointerLockElement) document.exitPointerLock();
  $('pause').classList.add('hidden');
  $('touch').classList.add('hidden');
  showMenu();
}
$('btn-pmenu').onclick = toMenu;
$('btn-resume').onclick = play;
$('btn-settings').onclick = () => { returnTo = 'menu'; openPanel('settings'); };
$('btn-controls').onclick = () => { returnTo = 'menu'; openPanel('controls'); };
$('btn-psettings').onclick = () => { returnTo = 'pause'; openPanel('settings'); };
$('btn-pcontrols').onclick = () => { returnTo = 'pause'; openPanel('controls'); };
document.querySelectorAll<HTMLElement>('[data-back]').forEach((b) => (b.onclick = () => {
  $('settings').classList.add('hidden');
  $('controls').classList.add('hidden');
  if (returnTo === 'pause') $('pause').classList.remove('hidden'); else $('menu').classList.remove('hidden');
}));

function openPanel(id: 'settings' | 'controls') {
  $('menu').classList.add('hidden');
  $('pause').classList.add('hidden');
  $(id).classList.remove('hidden');
  if (id === 'settings') fillSettings();
  if (id === 'controls') fillControls();
}

function fillSettings() {
  const sl = $<HTMLSelectElement>('set-lang');
  sl.innerHTML = LANGS.map((l) => `<option value="${l.id}" ${l.id === getLang() ? 'selected' : ''}>${l.name}</option>`).join('');
  sl.onchange = () => setLang(sl.value as Lang);
  const sq = $<HTMLSelectElement>('set-quality');
  const qs: (QualityId | 'auto')[] = ['auto', 'low', 'mobile', 'medium', 'high', 'ultra', 'max'];
  sq.innerHTML = qs.map((q) => `<option value="${q}" ${q === prefs.quality ? 'selected' : ''}>${t(`q_${q}` as Key)}${q === 'auto' ? ` (${t(`q_${game.q.id}` as Key)})` : ''}</option>`).join('');
  sq.onchange = () => {
    prefs.quality = sq.value as QualityId | 'auto';
    savePrefs(prefs);
    game.setQuality(prefs.quality === 'auto' ? autoQuality(document.createElement('canvas').getContext('webgl2')) : prefs.quality);
  };
  const sr = $<HTMLSelectElement>('set-res');
  const rs: Prefs['res'][] = ['dynamic', '1', '0.75', '0.5'];
  sr.innerHTML = rs.map((r) => `<option value="${r}" ${r === prefs.res ? 'selected' : ''}>${r === 'dynamic' ? t('res_dynamic') : `${Math.round(parseFloat(r) * 100)}%`}</option>`).join('');
  sr.onchange = () => {
    prefs.res = sr.value as Prefs['res'];
    savePrefs(prefs);
    game.opts.resScale = prefs.res === 'dynamic' ? 'dynamic' : parseFloat(prefs.res);
    game.dyn.scale = 1;
    game.resize();
  };
  bindRange('set-fov', 'out-fov', prefs.fov, (v) => `${v}°`, (v) => { prefs.fov = v; game.opts.fov = v; game.resize(); });
  bindRange('set-sens', 'out-sens', prefs.sens, (v) => v.toFixed(2), (v) => { prefs.sens = v; game.input.sensitivity = v; });
  bindRange('set-vol', 'out-vol', prefs.vol, (v) => `${Math.round(v * 100)}%`, (v) => { prefs.vol = v; sfx.setVolume(v); if (play_) play_.voice.volume = v; });
  const iy = $<HTMLInputElement>('set-invy');
  iy.checked = prefs.invY;
  iy.onchange = () => { prefs.invY = iy.checked; game.input.invertY = iy.checked; savePrefs(prefs); };
}

function bindRange(id: string, out: string, val: number, fmt: (v: number) => string, set: (v: number) => void) {
  const el = $<HTMLInputElement>(id), o = $(out);
  el.value = String(val);
  o.textContent = fmt(val);
  el.oninput = () => { const v = parseFloat(el.value); o.textContent = fmt(v); set(v); savePrefs(prefs); };
}

function fillControls() {
  const rows: [string, Key][] = isMobile
    ? [[t('t_left'), 'ctl_move'], [t('t_right'), 'ctl_look'], [t('t_max'), 'ctl_run'], ['⤒', 'ctl_jump'], ['✋', 'ctl_interact'], ['👁', 'ctl_camera'], ['💡', 'ctl_light'], ['🔧', 'ctl_build'], ['🗺', 'ctl_map'], ['🚙', 'ctl_vehicle'], ['⤒ (🚙)', 'ctl_brake']]
    : [['W A S D', 'ctl_move'], [t('k_mouse'), 'ctl_look'], ['Shift', 'ctl_run'], [t('k_space'), 'ctl_jump'], [t('k_click'), 'ctl_interact'], ['V', 'ctl_camera'], ['L', 'ctl_light'], ['B', 'ctl_build'], ['M', 'ctl_map'], ['F', 'ctl_vehicle'], [`${t('k_space')} (🚙)`, 'ctl_brake'], ['Esc', 'ctl_pause']];
  $('keys').innerHTML = rows.map(([k, a]) => `<tr><td>${k}</td><td>${t(a)}</td></tr>`).join('');
}

onLang(() => {
  translateDom();
  play_?.hud.relabel();
  buildLangs();
  if (!$('settings').classList.contains('hidden')) fillSettings();
  if (!$('controls').classList.contains('hidden')) fillControls();
  $('load-msg').textContent = t(loadKey);
});

// pointer lock / pausa
document.addEventListener('pointerlockchange', () => {
  const locked = !!document.pointerLockElement;
  $('clicktoplay').classList.toggle('hidden', locked || !inGame || game.input.touchMode || game.paused || !!play_?.hud.habOpen || !!play_?.hud.armoryOpen || !!play_?.dead || !!play_?.won);
  if (!locked && inGame && !game.paused && !game.input.touchMode && !play_?.hud.habOpen && !play_?.hud.armoryOpen && !play_?.dead && !play_?.won) pause();
});
canvas.addEventListener('click', () => { if (inGame && !game.paused && !document.pointerLockElement && !play_?.hud.habOpen && !play_?.hud.armoryOpen) game.input.requestLock(); });
addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && inGame && game.paused && !$('pause').classList.contains('hidden')) { e.preventDefault(); setTimeout(() => { game.input.clearPressed(); play(); }, 0); }
});
setInterval(() => {
  if (!game.input.consume('pause')) return;
  if (play_?.hud.buildOpen) { play_.exitBuild(); return; }
  if (play_?.hud.mapOpen) { play_.hud.toggleMap(false); return; }
  if (play_?.world.ghost) { play_.world.cancelGhost(); return; }
  if (!game.paused && !play_?.hud.habOpen && !play_?.hud.armoryOpen) pause();
}, 50);
document.addEventListener('visibilitychange', () => { if (document.hidden) { pause(); if (play_?.active) play_.persist(false); } });
// iOS pode descartar o contexto WebGL em segundo plano: pausa, salva e recarrega quando ele voltar
game.renderer.domElement.addEventListener('webglcontextlost', () => { pause(); if (play_?.active) play_.persist(false); });
game.renderer.domElement.addEventListener('webglcontextrestored', () => location.reload());

// botões de toque
function bindTouchBtn(id: string, action: Parameters<typeof game.input.fire>[0]) {
  const b = $(id);
  b.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); b.classList.add('down'); game.input.fire(action); game.input.setHeld(action, true); });
  const up = () => { b.classList.remove('down'); game.input.setHeld(action, false); };
  b.addEventListener('pointerup', up);
  b.addEventListener('pointercancel', up);
  b.addEventListener('pointerleave', up);
}
bindTouchBtn('tb-jump', 'jump');
bindTouchBtn('tb-use', 'interact');
bindTouchBtn('tb-cam', 'camera');
bindTouchBtn('tb-light', 'light');
bindTouchBtn('tb-build', 'build');
bindTouchBtn('tb-map', 'map');
bindTouchBtn('tb-car', 'vehicle');
bindTouchBtn('tb-wpn', 'weapon');
// botão de tiro: segurar = atirar; arrastar o mesmo dedo = mirar (0,8× a sensibilidade do olhar)
{
  const b = $('tb-fire');
  let id = -1, lx = 0, ly = 0;
  b.addEventListener('pointerdown', (e) => {
    e.stopPropagation(); e.preventDefault();
    id = e.pointerId; lx = e.clientX; ly = e.clientY;
    b.classList.add('down');
    game.input.fire('fire'); game.input.setHeld('fire', true);
    try { b.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  });
  b.addEventListener('pointermove', (e) => {
    if (e.pointerId !== id) return;
    const p = toView(e.clientX, e.clientY), q = toView(lx, ly);
    lx = e.clientX; ly = e.clientY;
    game.input.look.x += (p.x - q.x) * 1.9 * game.input.sensitivity;
    game.input.look.y += (p.y - q.y) * 1.5 * game.input.sensitivity * (game.input.invertY ? -1 : 1);
  });
  const up = (e: PointerEvent) => { if (e.pointerId !== id) return; id = -1; b.classList.remove('down'); game.input.setHeld('fire', false); };
  b.addEventListener('pointerup', up);
  b.addEventListener('pointercancel', up);
}
$('tb-pause').addEventListener('pointerdown', (e) => { e.stopPropagation(); pause(); });
document.addEventListener('gesturestart', (e) => e.preventDefault());

// na vertical o jogo funciona normalmente; se a rotação do iPhone estiver travada, o jogo gira sozinho
// pelo sensor de movimento (abaixo) ou pelo botão ⟳ (0 → 90° horário → 90° anti-horário → normal)
let rotateHintShown = false;
let rotPref: 0 | 1 | -1 = 0;
try { const v = Number(localStorage.getItem('ares.rot')); if (v === 1 || v === -1) rotPref = v; } catch { /* ignore */ }
function checkOrientation() {
  const realPortrait = matchMedia('(orientation: portrait)').matches;
  const rot = realPortrait && isMobile ? rotPref : 0;
  applyViewport(rot);
  const portrait = realPortrait && !rot;
  document.body.classList.toggle('portrait', portrait);
  $('btn-rot').classList.toggle('hidden', !(realPortrait && isMobile));
  if (portrait && inGame && isMobile && !rotateHintShown) {
    rotateHintShown = true;
    const el = $('rotate');
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 6000);
  }
  if (!portrait) $('rotate').classList.add('hidden');
}
$('btn-rot').addEventListener('pointerdown', (e) => {
  e.stopPropagation(); e.preventDefault();
  setRot(rotPref === 0 ? 1 : rotPref === 1 ? -1 : 0);
});
// ---- automático: o sensor de gravidade diz como o aparelho está sendo segurado, mesmo com a rotação travada.
// Só age quando o sistema NÃO girou a tela (se a trava estiver desligada, o próprio iOS/Android gira).
// Convenção de sinal difere entre iOS e Android → calibramos com o aparelho em pé (a posição mais comum).
let gSign = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent) ? -1 : 1;
let calibT = 0, calibrated = false;
let candidate: 0 | 1 | -1 | null = null, candidateSince = 0;
function setRot(r: 0 | 1 | -1) {
  if (r === rotPref) return;
  rotPref = r;
  try { localStorage.setItem('ares.rot', String(r)); } catch { /* ignore */ }
  onViewportChange();
}
function onMotion(e: DeviceMotionEvent) {
  const a = e.accelerationIncludingGravity;
  if (!a || a.x == null || a.y == null) return;
  const x = a.x, y = a.y, z = a.z ?? 0, now = performance.now();
  // calibração: em pé na vertical, |y| domina; o sinal visto define a convenção deste aparelho
  if (!calibrated && Math.abs(y) > 8 && Math.abs(x) < 2.5) {
    if (!calibT) calibT = now;
    else if (now - calibT > 500) { gSign = Math.sign(y) || gSign; calibrated = true; }
  } else if (!calibrated) calibT = 0;
  if (Math.abs(z) > 8.5) { candidate = null; return; } // deitado na mesa: mantém como está
  let want: 0 | 1 | -1 | null = null;
  if (Math.abs(x) > 6 && Math.abs(x) > Math.abs(y) * 1.6) want = x * gSign > 0 ? 1 : -1; // topo à esquerda → gira 90° horário
  else if (y * gSign > 6 && Math.abs(y) > Math.abs(x) * 1.6) want = 0;
  if (want === null) { candidate = null; return; }
  if (!matchMedia('(orientation: portrait)').matches) { candidate = null; return; } // o sistema já girou
  if (want !== candidate) { candidate = want; candidateSince = now; return; }
  // espera um pouco: dá tempo do sistema girar sozinho (trava desligada) e evita girar em movimentos rápidos
  if (now - candidateSince > 700) setRot(want);
}
let motionAsked = false;
function enableMotion() {
  if (motionAsked || !isMobile) return;
  motionAsked = true;
  const DM = window.DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> } | undefined;
  if (!DM) return;
  const start = () => addEventListener('devicemotion', onMotion);
  if (typeof DM.requestPermission === 'function') DM.requestPermission().then((r) => { if (r === 'granted') start(); }).catch(() => { motionAsked = false; });
  else start();
}
// iOS exige um toque do usuário para liberar o sensor
addEventListener('pointerdown', enableMotion, { capture: true });
addEventListener('touchend', enableMotion, { capture: true });
addEventListener('click', enableMotion, { capture: true });
checkOrientation();
// iOS (principalmente como app web) às vezes não dispara/atrasa o resize ao girar: verificamos por vários caminhos
let lastW = innerWidth, lastH = innerHeight;
function onViewportChange() {
  checkOrientation();
  game.resize();
  // o iOS atualiza as dimensões com atraso após girar
  setTimeout(() => { checkOrientation(); game.resize(); }, 250);
  setTimeout(() => { checkOrientation(); game.resize(); }, 700);
}
addEventListener('resize', onViewportChange);
addEventListener('orientationchange', onViewportChange);
window.visualViewport?.addEventListener('resize', onViewportChange);
screen.orientation?.addEventListener?.('change', onViewportChange);
matchMedia('(orientation: portrait)').addEventListener?.('change', onViewportChange);
setInterval(() => {
  const w = document.documentElement.clientWidth || innerWidth, h = document.documentElement.clientHeight || innerHeight;
  if (w !== lastW || h !== lastH) { lastW = w; lastH = h; onViewportChange(); }
}, 400);

// ---------------------------------------------------------------- HUD
const DIRS: Record<number, string> = { 0: 'N', 45: 'NE', 90: 'L', 135: 'SE', 180: 'S', 225: 'SO', 270: 'O', 315: 'NO' };
const strip = $('compass-strip');
function buildCompass() {
  const L = getLang();
  const names: Record<string, Record<string, string>> = {
    en: { L: 'E', O: 'W', SO: 'SW', NO: 'NW' }, es: { L: 'E', SO: 'SO', NO: 'NO' }, fr: { L: 'E', SO: 'SO', NO: 'NO' },
  };
  let html = '';
  for (let a = -360; a <= 720; a += 15) {
    const n = ((a % 360) + 360) % 360;
    const lbl = DIRS[n];
    const txt = lbl ? (names[L]?.[lbl] ?? lbl) : n % 45 === 0 ? String(n) : '|';
    html += `<span class="${lbl ? 'card' : 'tick'}" style="left:${(a + 360) * 4}px">${txt}</span>`;
  }
  strip.innerHTML = html;
}
buildCompass();
onLang(buildCompass);

let hudT = 0;
game.onFrame = (dt) => {
  play_?.update(dt);
  hudT += dt;
  // bússola (yaw 0 = olhando para -Z = norte)
  const heading = ((-game.player.yaw * 180) / Math.PI % 360 + 360) % 360;
  const w = $('compass').clientWidth;
  strip.style.transform = `translateX(${w / 2 - (heading + 360) * 4}px)`;
  if (hudT < 0.1) return;
  hudT = 0;
  const s = game.sky0;
  const solN = Math.floor(game.sol);
  const hh = Math.floor(s.ltstHours), mm = Math.floor((s.ltstHours - hh) * 60);
  $('hud-time').textContent = `${t('sol')} ${solN} · ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  const temp = marsTemp(s.ltstHours, game.tau);
  $('hud-env').innerHTML = `${t('hud_temp')} ${temp.toFixed(0)} °C · ${t('hud_pressure')} 7,2 hPa<br>${t('hud_tau')} ${game.tau.toFixed(2)} · Ls ${s.ls.toFixed(1)}°`;
  if (params.has('debug') || params.has('fps')) {
    const d = game.debugState();
    $('hud-fps').textContent = `${d.fps} fps · ${d.quality} · ${d.tex}\n${d.calls} calls · ${(d.tris / 1e6).toFixed(2)}M tris`;
  } else $('hud-fps').textContent = `${Math.round(game.fps)} ${t('fps')}`;
};

// ---------------------------------------------------------------- API de teste (?debug)
Object.assign(window, {
  __debug: {
    setTime: (hours: number) => { game.sol = Math.floor(game.sol) + hours / 24; game.updateSky(0); game.updateEnv(true); game.measureSky(); game.updateSky(0); },
    setTau: (tau: number) => { game.tau = tau; if (play_) play_.st.tau = tau; game.updateSky(0); game.updateEnv(true); game.measureSky(); game.updateSky(0); },
    teleport: (x: number, z: number) => game.player.teleport(x, z),
    look: (yawDeg: number, pitchDeg: number) => { game.player.yaw = THREE.MathUtils.degToRad(yawDeg); game.player.pitch = THREE.MathUtils.degToRad(pitchDeg); },
    play,
    pause,
    state: () => game.debugState(),
    camera: (fp: boolean) => { if (game.player.firstPerson !== fp) game.toggleCamera(); },
    lamp: (on: boolean) => game.setLamp(on),
    quality: (q: QualityId) => game.setQuality(q),
    play_: () => play_,
    give: (k: string, n: number) => { (play_!.st.inv as Record<string, number>)[k] += n; },
    newGame: (d: 'easy' | 'normal' | 'hard' = 'normal') => { clearSave(); play_!.newGame(d); play(); },
    camDist: (d: number) => { game.player.camDist = d; },
    freeze: (on: boolean) => game.freeze(on),
    spheres: () => {
      const g = game; const cam = g.camera; const dir = new THREE.Vector3(); cam.getWorldDirection(dir);
      const mk = (m: THREE.Material, dx: number) => { const s = new THREE.Mesh(new THREE.SphereGeometry(0.5, 48, 32), m); s.position.copy(cam.position).addScaledVector(dir, 3).add(new THREE.Vector3(dx, 0, 0).applyQuaternion(cam.quaternion)); g.scene.add(s); return s; };
      mk(new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.2 }), -1.2);
      const { enhance } = (window as any).__mat; mk(enhance(new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.2 })), 0);
      mk(new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0, roughness: 0.9 }), 1.2);
    },
    envShow: () => { game.scene.background = game.envRT!.texture; game.sky.mesh.visible = false; },
    envProbe: () => {
      const rt = new THREE.WebGLCubeRenderTarget(16, { type: THREE.HalfFloatType });
      const cc = new THREE.CubeCamera(1, 20000, rt); game.envScene.add(cc); cc.update(game.renderer, game.envScene);
      const buf = new Uint16Array(16 * 16 * 4); const out: number[][] = [];
      for (let f = 0; f < 6; f++) { game.renderer.readRenderTargetPixels(rt as unknown as THREE.WebGLRenderTarget, 8, 8, 1, 1, buf, f); out.push(Array.from(buf.slice(0, 3)).map((h) => +THREE.DataUtils.fromHalfFloat(h).toFixed(3))); }
      return out;
    },
    renderOnce: (sim = 0) => game.renderOnce(sim),
  },
});

// som de clique na interface
document.addEventListener('click', (e) => { if ((e.target as HTMLElement)?.closest?.('button')) { sfx.unlock(); sfx.click(); } }, true);
