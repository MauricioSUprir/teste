import { Game, type GameOptions } from './game';
import { t, translateDom, setLang, getLang, LANGS, onLang, type Key, type Lang } from './core/i18n';
import { autoQuality, isMobile, type QualityId } from './core/quality';
import * as THREE from 'three';
import { Play } from './play';
import { marsTemp } from './sim/survival';
import { hasSave, clearSave } from './sim/state';
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
  $('load-msg').textContent = 'WebGL 2 não disponível neste navegador.';
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
  $('load-msg').textContent = `Erro: ${e?.message ?? e}`;
});

// ---------------------------------------------------------------- menus
let inGame = false;
let play_: Play | null = null;
let difficulty: 'easy' | 'normal' | 'hard' = 'normal';
let confirmNew = false;
let returnTo: 'menu' | 'pause' = 'menu';

function showMenu() {
  $('menu').classList.remove('hidden');
  $('btn-continue').classList.toggle('hidden', !hasSave());
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
  $('menu').classList.add('hidden');
  $('pause').classList.add('hidden');
  $('hud').classList.remove('hidden');
  inGame = true;
  game.menuMode = false;
  game.paused = false;
  game.input.enabled = true;
  const touch = isMobile || game.input.touchMode;
  $('touch').classList.toggle('hidden', !touch);
  if (!touch) game.input.requestLock();
  checkOrientation();
}

function pause() {
  if (!inGame) return;
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
  if (play_) { play_.persist(false); play_.active = false; }
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
  const qs: (QualityId | 'auto')[] = ['auto', 'low', 'medium', 'high', 'ultra', 'max'];
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
  bindRange('set-fov', 'out-fov', prefs.fov, (v) => `${v}°`, (v) => { prefs.fov = v; game.camera.fov = v; game.camera.updateProjectionMatrix(); });
  bindRange('set-sens', 'out-sens', prefs.sens, (v) => v.toFixed(2), (v) => { prefs.sens = v; game.input.sensitivity = v; });
  bindRange('set-vol', 'out-vol', prefs.vol, (v) => `${Math.round(v * 100)}%`, (v) => { prefs.vol = v; });
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
    ? [['🕹 esq.', 'ctl_move'], ['☝ dir.', 'ctl_look'], ['🕹 máx.', 'ctl_run'], ['⤒', 'ctl_jump'], ['✋', 'ctl_interact'], ['👁', 'ctl_camera'], ['💡', 'ctl_light']]
    : [['W A S D', 'ctl_move'], ['Mouse', 'ctl_look'], ['Shift', 'ctl_run'], ['Espaço', 'ctl_jump'], ['E / clique', 'ctl_interact'], ['V', 'ctl_camera'], ['L', 'ctl_light'], ['B', 'ctl_build'], ['M', 'ctl_map'], ['Tab / I', 'ctl_inventory'], ['F', 'ctl_vehicle'], ['Esc', 'ctl_pause']];
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
  $('clicktoplay').classList.toggle('hidden', locked || !inGame || game.input.touchMode || game.paused || !!play_?.inHab || !!play_?.hud.buildOpen || !!play_?.dead);
  if (!locked && inGame && !game.paused && !game.input.touchMode && !play_?.hud.buildOpen && !play_?.inHab && !play_?.dead && !play_?.won) pause();
});
canvas.addEventListener('click', () => { if (inGame && !game.paused && !document.pointerLockElement && !play_?.hud.buildOpen && !play_?.inHab) game.input.requestLock(); });
addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && inGame && game.paused && !$('pause').classList.contains('hidden')) play();
});
setInterval(() => {
  if (!game.input.consume('pause')) return;
  if (play_?.hud.buildOpen) { play_.closeBuildMenu(); return; }
  if (play_?.hud.mapOpen) { play_.hud.toggleMap(false); return; }
  if (play_?.world.ghost) { play_.world.cancelGhost(); return; }
  if (!game.paused && !play_?.inHab) pause();
}, 50);
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

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
$('tb-pause').addEventListener('pointerdown', (e) => { e.stopPropagation(); pause(); });
document.addEventListener('gesturestart', (e) => e.preventDefault());

function checkOrientation() {
  const portrait = isMobile && innerHeight > innerWidth;
  $('rotate').classList.toggle('hidden', !portrait || !inGame);
}
addEventListener('resize', checkOrientation);

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
    setTime: (hours: number) => { game.sol = Math.floor(game.sol) + hours / 24; game.updateEnv(true); game.measureSky(); game.updateSky(0); },
    setTau: (tau: number) => { game.tau = tau; game.updateSky(0); game.updateEnv(true); game.measureSky(); game.updateSky(0); },
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
