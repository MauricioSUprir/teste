// HUD do visor + painéis (construção, habitat, mapa, morte/vitória). DOM puro, atualizado a ~10 Hz.
import { t, type Key } from '../core/i18n';
import { BAL, COSTS, type BuildId, type ItemId } from '../sim/balance';
import type { GameState } from '../sim/state';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = '') => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
};

export const BUILD_ORDER: BuildId[] = ['habitat', 'panel', 'battery', 'moxie', 'extractor', 'bioreactor'];
const ITEMS: ItemId[] = ['scrap', 'electronics', 'gypsum', 'culture', 'kit_habitat', 'kit_panel'];

export class Hud {
  root: HTMLElement;
  vitals = el('div', 'vitals');
  bars: Record<string, { fill: HTMLElement; val: HTMLElement; row: HTMLElement }> = {};
  objective = el('div', 'objective');
  prompt = el('div', 'prompt hidden');
  promptRing = el('div', 'ring');
  promptText = el('div', 'ptext');
  toasts = el('div', 'toasts');
  subtitle = el('div', 'subtitle hidden');
  waypoint = el('div', 'waypoint hidden');
  inv = el('div', 'inv');
  build = el('div', 'overlay build hidden');
  habPanel = el('div', 'overlay hab hidden');
  endScreen = el('div', 'overlay end hidden');
  mapPanel = el('div', 'overlay mapp hidden');
  mapCanvas = el('canvas', 'mapc');
  storm = el('div', 'stormtag hidden');
  onBuildPick?: (b: BuildId) => void;
  onSleep?: () => void;
  onExit?: () => void;
  onRespawn?: () => void;
  onMenu?: () => void;
  private subTimer = 0;

  constructor(parent: HTMLElement) {
    this.root = parent;
    for (const k of ['o2', 'batt', 'health', 'rad']) {
      const row = el('div', 'vrow');
      const lab = el('span', 'vlab');
      lab.dataset.k = k;
      const bar = el('div', 'vbar');
      const fill = el('div', 'vfill');
      bar.appendChild(fill);
      const val = el('span', 'vval');
      row.append(lab, bar, val);
      this.vitals.appendChild(row);
      this.bars[k] = { fill, val, row };
    }
    this.prompt.append(this.promptRing, this.promptText);
    this.waypoint.innerHTML = '<div class="wp-dot"></div><div class="wp-dist"></div>';
    this.mapPanel.appendChild(this.mapCanvas);
    parent.append(this.vitals, this.objective, this.prompt, this.toasts, this.subtitle, this.waypoint, this.inv, this.storm);
    document.body.append(this.build, this.habPanel, this.endScreen, this.mapPanel);
    this.relabel();
  }

  relabel() {
    const names: Record<string, Key> = { o2: 'hud_o2', batt: 'hud_power', health: 'hud_health', rad: 'hud_rad' };
    this.vitals.querySelectorAll<HTMLElement>('.vlab').forEach((l) => (l.textContent = t(names[l.dataset.k!])));
    this.storm.textContent = `⚠ ${t('storm')}`;
  }

  update(st: GameState, obj: Key | null, dt: number) {
    const set = (k: string, frac: number, text: string, warn = 0.3, crit = 0.15, invert = false) => {
      const b = this.bars[k];
      const f = Math.max(0, Math.min(1, frac));
      b.fill.style.width = `${f * 100}%`;
      b.val.textContent = text;
      const lvl = invert ? (f > 1 - crit ? 2 : f > 1 - warn ? 1 : 0) : (f < crit ? 2 : f < warn ? 1 : 0);
      b.row.dataset.lvl = String(lvl);
    };
    const o2 = st.suit.o2 / BAL.suitO2Cap;
    set('o2', o2, `${Math.round(o2 * 100)}%`);
    const bt = st.suit.batt / BAL.suitBattCap;
    set('batt', bt, `${Math.round(bt * 100)}%`, 0.2, 0.1);
    set('health', st.suit.health / 100, `${Math.round(st.suit.health)}`);
    set('rad', st.suit.rad / BAL.radLethal, `${st.suit.rad.toFixed(1)} mSv`, 0.5, 0.25, true);
    this.objective.innerHTML = obj ? `<span class="olab">▸</span> ${t(obj)}` : '';
    const parts = ITEMS.filter((i) => st.inv[i] > 0).map((i) => `<span class="it"><b>${i === 'gypsum' ? st.inv[i].toFixed(0) + ' kg' : st.inv[i]}</b> ${t(`it_${i}` as Key)}</span>`);
    this.inv.innerHTML = parts.join('');
    this.storm.classList.toggle('hidden', !st.storm);
    if (this.subTimer > 0) { this.subTimer -= dt; if (this.subTimer <= 0) this.subtitle.classList.add('hidden'); }
  }

  say(key: Key, seconds?: number) {
    const text = t(key);
    this.subtitle.innerHTML = `<b>ARES</b> ${text}`;
    this.subtitle.classList.remove('hidden');
    this.subTimer = seconds ?? Math.min(16, 3 + text.length / 16);
  }

  toast(text: string, kind: 'ok' | 'warn' | 'info' = 'info') {
    const d = el('div', `toast ${kind}`, text);
    this.toasts.appendChild(d);
    setTimeout(() => d.classList.add('out'), 2600);
    setTimeout(() => d.remove(), 3200);
    while (this.toasts.children.length > 4) this.toasts.firstChild?.remove();
  }

  showPrompt(text: string | null, progress = 0, hold = true) {
    if (!text) { this.prompt.classList.add('hidden'); return; }
    this.prompt.classList.remove('hidden');
    this.promptText.innerHTML = `<kbd>${hold ? t('ctl_hold_e') : 'E'}</kbd> ${text}`;
    this.promptRing.style.setProperty('--p', `${Math.round(progress * 100)}`);
  }

  setWaypoint(x: number | null, y = 0, dist = 0, label = '') {
    if (x === null) { this.waypoint.classList.add('hidden'); return; }
    this.waypoint.classList.remove('hidden');
    this.waypoint.style.transform = `translate(${x}px, ${y}px)`;
    (this.waypoint.querySelector('.wp-dist') as HTMLElement).textContent = `${label}${dist < 1000 ? Math.round(dist) + ' m' : (dist / 1000).toFixed(1) + ' km'}`;
  }

  // ---------- construção
  openBuild(st: GameState, canAfford: (b: BuildId) => boolean) {
    const hasHab = st.buildings.some((b) => b.type === 'habitat');
    this.build.innerHTML = `<div class="panel-inner wide"><h2>${t('build_menu')}</h2><div class="bgrid"></div><p class="bhint">${t('build_hint')}</p></div>`;
    const grid = this.build.querySelector('.bgrid')!;
    for (const b of BUILD_ORDER) {
      if (b === 'habitat' && hasHab) continue;
      if (b !== 'habitat' && !hasHab) continue;
      const cost = b === 'panel' && st.inv.kit_panel > 0 ? { kit_panel: 1 } : COSTS[b];
      const ok = canAfford(b);
      const costTxt = Object.entries(cost).map(([k, v]) => `<span class="${st.inv[k as ItemId] >= (v as number) ? 'have' : 'miss'}">${v}× ${t(`it_${k}` as Key)}</span>`).join(' ');
      const card = el('button', `bcard ${ok ? '' : 'dis'}`, `<div class="bname">${t(`b_${b}` as Key)}</div><div class="bdesc">${t(`bd_${b}` as Key)}</div><div class="bcost">${costTxt}</div>`);
      card.onclick = () => { if (ok) this.onBuildPick?.(b); };
      grid.appendChild(card);
    }
    if (!grid.children.length) grid.innerHTML = `<p>${t('not_enough')}</p>`;
    this.build.classList.remove('hidden');
  }
  closeBuild() { this.build.classList.add('hidden'); }
  get buildOpen() { return !this.build.classList.contains('hidden'); }

  // ---------- habitat
  openHab(st: GameState, gen: number, load: number) {
    const rows: [Key, string][] = [
      ['hab_o2', `${st.hab.o2.toFixed(2)} kg · ${(st.hab.o2 / BAL.habO2PerSol).toFixed(1)} ${t('sols_left')}`],
      ['hab_water', `${st.hab.water.toFixed(1)} kg · ${(st.hab.water / BAL.habWaterPerSol).toFixed(1)} ${t('sols_left')}`],
      ['hab_food', `${st.hab.food.toFixed(1)} · ${st.hab.food.toFixed(1)} ${t('sols_left')}`],
      ['hab_power', `${st.hab.batt.toFixed(1)} / ${st.hab.battCap.toFixed(0)} kWh`],
      ['hab_gen', `${Math.round(gen)} W`],
      ['hab_load', `${Math.round(load)} W`],
      ['hab_gypsum', `${st.hab.gypsum.toFixed(1)} kg`],
    ];
    this.habPanel.innerHTML = `<div class="panel-inner"><h2>${t('hab_title')} · ${t('sol')} ${Math.floor(st.sol)}</h2>
      <table class="habt">${rows.map(([k, v]) => `<tr><td>${t(k)}</td><td>${v}</td></tr>`).join('')}</table>
      <button class="primary" id="hab-sleep">${t('hab_sleep')}</button><button id="hab-exit">${t('hab_exit')}</button></div>`;
    (this.habPanel.querySelector('#hab-sleep') as HTMLElement).onclick = () => this.onSleep?.();
    (this.habPanel.querySelector('#hab-exit') as HTMLElement).onclick = () => this.onExit?.();
    this.habPanel.classList.remove('hidden');
  }
  closeHab() { this.habPanel.classList.add('hidden'); }
  get habOpen() { return !this.habPanel.classList.contains('hidden'); }

  // ---------- fim
  showEnd(win: boolean, sol: number) {
    this.endScreen.innerHTML = `<div class="panel-inner"><h2>${t(win ? 'win_title' : 'dead_title')}</h2><p>${t(win ? 'win_sub' : 'dead_sub', { sol })}</p>
      ${win ? '' : `<button class="primary" id="end-respawn">${t('respawn')}</button>`}<button id="end-menu">${t('quit_menu')}</button></div>`;
    this.endScreen.classList.toggle('win', win);
    const r = this.endScreen.querySelector('#end-respawn') as HTMLElement | null;
    if (r) r.onclick = () => this.onRespawn?.();
    (this.endScreen.querySelector('#end-menu') as HTMLElement).onclick = () => this.onMenu?.();
    this.endScreen.classList.remove('hidden');
  }
  hideEnd() { this.endScreen.classList.add('hidden'); }

  // ---------- mapa (imagem orbital sombreada + marcadores)
  private mapBase: ImageData | null = null;
  buildMap(heights: Float32Array, res: number) {
    const S = 512, step = (res - 1) / S;
    this.mapCanvas.width = this.mapCanvas.height = S;
    const g = this.mapCanvas.getContext('2d')!;
    const img = g.createImageData(S, S);
    const H = (i: number, j: number) => heights[Math.min(res - 1, Math.round(j * step)) * res + Math.min(res - 1, Math.round(i * step))];
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const h = H(i, j), hx = H(i + 1, j) - h, hz = H(i, j + 1) - h;
      const shade = Math.max(0, Math.min(1, 0.62 + (-hx * 0.55 - hz * 0.4) / step));
      const k = (j * S + i) * 4;
      img.data[k] = 190 * shade + 25; img.data[k + 1] = 128 * shade + 16; img.data[k + 2] = 92 * shade + 10; img.data[k + 3] = 255;
    }
    this.mapBase = img;
  }
  drawMap(markers: { x: number; z: number; color: string; label: string; big?: boolean }[], player: { x: number; z: number; yaw: number }, size: number) {
    const g = this.mapCanvas.getContext('2d')!;
    if (this.mapBase) g.putImageData(this.mapBase, 0, 0);
    const S = this.mapCanvas.width;
    const P = (x: number, z: number) => [((x + size / 2) / size) * S, ((z + size / 2) / size) * S];
    g.font = '600 12px Rajdhani, sans-serif';
    for (const m of markers) {
      const [x, y] = P(m.x, m.z);
      g.fillStyle = m.color; g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 2;
      g.beginPath(); g.arc(x, y, m.big ? 6 : 4, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = '#fff'; g.fillText(m.label, x + 8, y + 4);
    }
    const [px, py] = P(player.x, player.z);
    g.save(); g.translate(px, py); g.rotate(-player.yaw);
    g.fillStyle = '#ffb15a'; g.beginPath(); g.moveTo(0, -9); g.lineTo(6, 7); g.lineTo(0, 3); g.lineTo(-6, 7); g.closePath(); g.fill();
    g.restore();
    // escala
    g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(16, S - 22, (200 / size) * S, 3);
    g.fillText('200 m', 16, S - 28);
    g.fillText('N ↑', S - 34, 20);
  }
  toggleMap(on?: boolean) { this.mapPanel.classList.toggle('hidden', on === undefined ? undefined : !on); }
  get mapOpen() { return !this.mapPanel.classList.contains('hidden'); }
}
