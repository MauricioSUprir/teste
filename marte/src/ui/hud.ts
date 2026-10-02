// HUD do visor + painéis (construção, habitat, mapa, morte/vitória). DOM puro, atualizado a ~10 Hz.
import { t, type Key } from '../core/i18n';
import { BAL, COSTS, type BuildId, type ItemId } from '../sim/balance';
import type { GameState } from '../sim/state';
import { WEAPONS, WEAPON_ORDER, UPG_MAX, upgradeCost, weaponStats, type WeaponId, type UpgradeId } from '../combat/defs';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = '') => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
};

export const WICON: Record<WeaponId, string> = { cutter: '⟋', pistol: '⌐', arc: 'ϟ' };
export const BUILD_ORDER: BuildId[] = ['habitat', 'panel', 'battery', 'moxie', 'extractor', 'bioreactor', 'residence', 'turret'];
const ITEMS: ItemId[] = ['scrap', 'electronics', 'chitin', 'core', 'gypsum', 'culture', 'kit_habitat', 'kit_panel'];

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
  build = el('div', 'buildui hidden');
  habPanel = el('div', 'overlay hab hidden');
  endScreen = el('div', 'overlay end hidden');
  mapPanel = el('div', 'overlay mapp hidden');
  mapCanvas = el('canvas', 'mapc');
  storm = el('div', 'stormtag hidden');
  roverHud = el('div', 'roverhud hidden');
  // ---- combate
  xhair = el('div', 'xhair');
  hitmark = el('div', 'hitmark');
  dmg = el('div', 'dmgfx');
  threatBox = el('div', 'threats');
  tbar = el('div', 'tbar hidden', '<i></i>');
  wpn = el('div', 'wpnpill');
  armory = el('div', 'overlay armory hidden');
  pc = el('div', 'overlay pcpanel hidden');
  onPcAction?: (a: string) => void;
  onArmoryClose?: () => void;
  onCraft?: (w: WeaponId) => void;
  onUpgrade?: (w: WeaponId, u: UpgradeId) => void;
  onEquip?: (w: WeaponId) => void;
  onBuildPick?: (b: BuildId) => void;
  onBuildClose?: () => void;
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
    this.mapPanel.addEventListener('pointerdown', () => this.toggleMap(false));
    parent.append(this.vitals, this.objective, this.prompt, this.toasts, this.subtitle, this.waypoint, this.inv, this.storm, this.roverHud, this.xhair, this.hitmark, this.threatBox, this.tbar, this.wpn);
    document.body.append(this.dmg, this.build, this.habPanel, this.endScreen, this.mapPanel, this.armory, this.pc);
    this.relabel();
  }

  relabel() {
    const names: Record<string, Key> = { o2: 'hud_o2', batt: 'hud_power', health: 'hud_health', rad: 'hud_rad' };
    this.vitals.querySelectorAll<HTMLElement>('.vlab').forEach((l) => (l.textContent = t(names[l.dataset.k!])));
    this.storm.textContent = `⚠ ${t('storm')}`;
  }

  update(st: GameState, obj: Key | null, dt: number, suffix = '') {
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
    this.objective.innerHTML = obj ? `<span class="olab">▸</span> ${t(obj)}${suffix ? `<span class="opop">${suffix}</span>` : ''}` : '';
    const parts = ITEMS.filter((i) => st.inv[i] > 0).map((i) => `<span class="it"><b>${i === 'gypsum' ? st.inv[i].toFixed(0) + ' kg' : st.inv[i]}</b> ${t(`it_${i}` as Key)}</span>`);
    this.inv.innerHTML = parts.join('');
    this.storm.classList.toggle('hidden', !st.storm);
    if (this.subTimer > 0) { this.subTimer -= dt; if (this.subTimer <= 0) this.subtitle.classList.add('hidden'); }
  }

  // ---------- combate
  private dmgT = 0;
  hurtFlash(amount: number) {
    this.dmg.style.transition = 'none';
    this.dmg.style.opacity = String(Math.min(0.85, 0.25 + amount / 20));
    void this.dmg.offsetWidth;
    this.dmg.style.transition = 'opacity .7s ease-out';
    this.dmg.style.opacity = '0';
    this.dmgT = 0.7;
  }
  hitMarker(kill: boolean) {
    this.hitmark.classList.remove('on', 'kill');
    void this.hitmark.offsetWidth;
    this.hitmark.classList.add('on');
    if (kill) this.hitmark.classList.add('kill');
  }
  setThreats(list: { x: number; y: number; ang: number; behind: boolean; near: number }[]) {
    while (this.threatBox.children.length < list.length) this.threatBox.appendChild(el('div', 'threat'));
    [...this.threatBox.children].forEach((c, i) => {
      const e = c as HTMLElement, th = list[i];
      if (!th) { e.style.display = 'none'; return; }
      e.style.display = 'block';
      // posição na borda de uma elipse ao redor do centro
      const rx = 44, ry = 38;
      e.style.left = `${50 + Math.cos(th.ang) * rx}%`;
      e.style.top = `${50 - Math.sin(th.ang) * ry}%`;
      e.style.transform = `translate(-50%,-50%) rotate(${-th.ang}rad)`;
      e.style.opacity = String(0.45 + th.near * 0.55);
    });
  }
  setTargetBar(p: { x: number; y: number } | null, frac: number, W: number, H: number) {
    this.tbar.classList.toggle('hidden', !p);
    if (!p) return;
    this.tbar.style.left = `${(p.x * 0.5 + 0.5) * W}px`;
    this.tbar.style.top = `${(-p.y * 0.5 + 0.5) * H}px`;
    (this.tbar.firstChild as HTMLElement).style.width = `${Math.max(0, frac) * 100}%`;
  }
  setWeapon(st: GameState, show: boolean) {
    this.wpn.classList.toggle('hidden', !show);
    this.xhair.classList.toggle('hidden', !show);
    if (!show) return;
    const w = st.weapons.eq, s = weaponStats(w, st.weapons);
    const key = `${w}|${s.wh.toFixed(1)}|${st.weapons.owned.length}`;
    if (this.wpn.dataset.k === key) return;
    this.wpn.dataset.k = key;
    this.wpn.innerHTML = `<span class="wi">${WICON[w]}</span><span class="wn">${t(`w_${w}` as Key)}</span>${s.wh > 0 ? `<span class="we">⚡${s.wh.toFixed(1)} Wh</span>` : ''}${st.weapons.owned.length > 1 ? '<span class="ws">⇄</span>' : ''}`;
    this.xhair.dataset.w = w;
  }

  /** bancada de armas (dentro do habitat): fabricar, equipar e melhorar */
  openArmory(st: GameState) {
    const inv = st.inv as Record<string, number>;
    const chip = (cost: Partial<Record<ItemId, number>>) => Object.entries(cost).map(([k, v]) => `<span class="chip ${inv[k] >= (v as number) ? 'have' : 'miss'}">${v}× ${t(`it_${k}` as Key)}</span>`).join('');
    const cards = WEAPON_ORDER.map((id) => {
      const d = WEAPONS[id], owned = st.weapons.owned.includes(id), s = weaponStats(id, st.weapons), lv = st.weapons.lvl[id];
      const stats = `<div class="wstats"><span>${t('ws_dmg')} <b>${Math.round(s.dmg)}</b></span><span>${t('ws_rate')} <b>${(1 / s.cooldown).toFixed(1)}/s</b></span><span>${t('ws_range')} <b>${d.range} m</b></span><span>⚡ <b>${s.wh.toFixed(1)} Wh</b></span></div>`;
      let body = '';
      if (!owned) {
        const ok = Object.entries(d.craft ?? {}).every(([k, v]) => inv[k] >= (v as number));
        body = `<div class="wcost">${chip(d.craft ?? {})}</div><button class="hbtn ${ok ? 'go' : 'dis'}" data-craft="${id}">${t('craft')}</button>`;
      } else {
        const ups = (['dmg', 'rate', 'eff'] as UpgradeId[]).map((u) => {
          const l = lv[u], max = l >= UPG_MAX, cost = upgradeCost(l);
          const ok = !max && Object.entries(cost).every(([k, v]) => inv[k] >= (v as number));
          const pips = Array.from({ length: UPG_MAX }, (_, i) => `<i class="${i < l ? 'on' : ''}"></i>`).join('');
          return `<div class="uprow"><span class="un">${t(`up_${u}` as Key)}</span><span class="pips">${pips}</span>${max ? `<span class="chip have">MAX</span>` : `<span class="ucost">${chip(cost)}</span><button class="hbtn small ${ok ? 'go' : 'dis'}" data-up="${id}:${u}">+</button>`}</div>`;
        }).join('');
        body = `${ups}${st.weapons.eq === id ? `<div class="eqd">✓ ${t('equipped')}</div>` : `<button class="hbtn" data-eq="${id}">${t('equip')}</button>`}`;
      }
      return `<div class="wcard ${owned ? 'own' : ''} ${st.weapons.eq === id ? 'eq' : ''}"><div class="wh"><span class="wi">${WICON[id]}</span><div><div class="wn">${t(`w_${id}` as Key)}</div><div class="wd">${t(`wd_${id}` as Key)}</div></div></div>${stats}${body}</div>`;
    }).join('');
    this.armory.innerHTML = `<div class="holo"><div class="holo-h"><span>${t('armory')}</span><span class="holo-inv">${chip({ chitin: inv.chitin, electronics: inv.electronics, scrap: inv.scrap } as Partial<Record<ItemId, number>>).replace(/miss|have/g, 'inv')}</span></div><div class="wgrid">${cards}</div><button class="hbtn close" id="arm-close">${t('close')}</button></div>`;
    this.armory.querySelector('#arm-close')!.addEventListener('click', () => this.onArmoryClose?.());
    this.armory.querySelectorAll<HTMLElement>('[data-craft]').forEach((b) => b.addEventListener('click', () => this.onCraft?.(b.dataset.craft as WeaponId)));
    this.armory.querySelectorAll<HTMLElement>('[data-up]').forEach((b) => b.addEventListener('click', () => { const [w, u] = b.dataset.up!.split(':'); this.onUpgrade?.(w as WeaponId, u as UpgradeId); }));
    this.armory.querySelectorAll<HTMLElement>('[data-eq]').forEach((b) => b.addEventListener('click', () => this.onEquip?.(b.dataset.eq as WeaponId)));
    this.armory.classList.remove('hidden');
  }
  /** computador de pulso: tudo o que não é essencial fica aqui (construir, mapa, lanterna, câmera, inventário, pausa) */
  openPC(st: GameState, o: { colony: { pop: number; lvl: string; target: number; next: number; eta: number; landing: boolean; reqs: { key: string; have: number; need: number; ok: boolean }[] } | null; built: boolean; canBuild: boolean; lamp: boolean; fp: boolean; nearRover: boolean; cost: number }) {
    const inv = st.inv as Record<string, number>;
    const items = ITEMS.filter((i) => inv[i] > 0).map((i) => `<span class="chip pcchip">${i === 'gypsum' ? inv[i].toFixed(0) + ' kg' : inv[i]} ${t(`it_${i}` as Key)}</span>`).join('') || `<span class="pc-empty">${t('pc_inv_empty')}</span>`;
    const tile = (a: string, icon: string, label: string, lock = false, on = false) => `<button class="pctile ${lock ? 'lock' : ''} ${on ? 'on' : ''}" data-a="${lock ? '' : a}"><span class="pi">${icon}</span><span class="pl">${label}</span>${lock ? '<span class="pk">🔒</span>' : ''}</button>`;
    const rad = st.suit.rad;
    const status = `<div class="pc-stat"><span>☢ ${rad.toFixed(1)} mSv</span><span>🌡 ${t('pc_suit')} ${Math.round(st.suit.batt / BAL.suitBattCap * 100)}%</span><span>⚔ ${st.stats2?.kills ?? 0}</span></div>`;
    const banner = o.built ? '' : `<div class="pc-banner"><div>${t('pc_broken', { n: o.cost })}</div><button class="hbtn ${o.canBuild ? 'go' : 'dis'}" data-a="${o.canBuild ? 'assemble' : ''}">${t('pc_assemble')} · ${o.cost} ${t('it_scrap')}</button></div>`;
    this.pc.innerHTML = `<div class="holo pc"><div class="holo-h"><span>${t('pc_title')}</span><button class="hbtn small" data-a="close">✖</button></div>${banner}
      <div class="pcgrid">${tile('build', '🔧', t('pc_build'), !o.built)}${tile('map', '🗺', t('pc_map'), !o.built)}${tile('light', '💡', t('pc_light'), false, o.lamp)}${tile('camera', '👁', o.fp ? t('pc_cam3') : t('pc_cam1'))}${o.nearRover ? tile('vehicle', '🚙', t('pc_rover')) : ''}${tile('pause', '⚙', t('pc_pause'))}</div>
      ${this.colonyHtml(o.colony)}
      <div class="pc-sec">${t('pc_inv')}</div><div class="pc-inv">${items}</div>${status}</div>`;
    this.pc.querySelectorAll<HTMLElement>('[data-a]').forEach((b) => b.addEventListener('pointerdown', (ev) => { ev.stopPropagation(); ev.preventDefault(); const a = b.dataset.a; if (a) this.onPcAction?.(a); }));
    this.pc.classList.remove('hidden');
    document.body.classList.add('hud-pc');
  }
  private colonyHtml(c: Parameters<Hud['openPC']>[1]['colony']) {
    if (!c) return '';
    const reqs = c.reqs.map((q) => `<span class="chip ${q.ok ? 'have' : 'miss'}">${q.ok ? '✓' : '✗'} ${t(q.key as Key)} ${q.have}/${q.need}</span>`).join('');
    const ship = c.next === 0 ? t('col_done') : c.landing ? t('col_landing') : c.eta > 0.5 ? t('col_eta', { n: c.next, m: Math.ceil(c.eta) }) : c.reqs.every((q) => q.ok) ? t('col_ready', { n: c.next }) : t('col_orbit', { n: c.next });
    return `<div class="pc-sec">${t('col_title')}</div>
      <div class="pc-col"><div class="pc-colh"><b>${t(c.lvl as Key)}</b><span>👥 ${c.pop} / ${c.target}</span></div>
      <div class="pc-ship">🚀 ${ship}</div>${c.next ? `<div class="pc-inv">${reqs}</div>` : ''}</div>`;
  }
  closePC() { this.pc.classList.add('hidden'); document.body.classList.remove('hud-pc'); }
  get pcOpen() { return !this.pc.classList.contains('hidden'); }

  closeArmory() { this.armory.classList.add('hidden'); }
  get armoryOpen() { return !this.armory.classList.contains('hidden'); }

  setRover(on: boolean, speed = 0, batt = 0, cap = 1) {
    this.roverHud.classList.toggle('hidden', !on);
    if (on) this.roverHud.innerHTML = `<div class="rs"><b>${Math.abs(speed * 3.6).toFixed(0)}</b> km/h</div><div class="rb">${t('rover')} ⚡ ${(batt).toFixed(1)} / ${cap} kWh</div>`;
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
    const touch = matchMedia('(pointer: coarse)').matches;
    this.promptText.innerHTML = `<kbd>${hold ? (touch ? t('tap_hold') : t('ctl_hold_e')) : touch ? '✋' : 'E'}</kbd> ${text}`;
    this.promptRing.style.setProperty('--p', `${Math.round(progress * 100)}`);
  }

  setWaypoint(x: number | null, y = 0, dist = 0, label = '') {
    if (x === null) { this.waypoint.classList.add('hidden'); return; }
    this.waypoint.classList.remove('hidden');
    this.waypoint.style.transform = `translate(${x}px, ${y}px)`;
    (this.waypoint.querySelector('.wp-dist') as HTMLElement).textContent = `${label}${dist < 1000 ? Math.round(dist) + ' m' : (dist / 1000).toFixed(1) + ' km'}`;
  }

  // ---------- construção
  /** modo construção: faixa holográfica vertical à direita (o mundo continua visível e jogável) */
  onBuildRotate?: () => void;
  onBuildPlace?: () => void;
  openBuild(st: GameState, canAfford: (b: BuildId) => boolean, thumbs: Record<string, string>, sel: BuildId | null, touch: boolean) {
    const hasHab = st.buildings.some((b) => b.type === 'habitat');
    const tiles = BUILD_ORDER.filter((b) => (b === 'habitat') !== hasHab).map((b) => {
      const cost = b === 'panel' && st.inv.kit_panel > 0 ? { kit_panel: 1 } : COSTS[b];
      const ok = canAfford(b);
      const chips = Object.entries(cost).map(([k, v]) => `<span class="chip ${st.inv[k as ItemId] >= (v as number) ? 'have' : 'miss'}">${v} ${t(`it_${k}` as Key)}</span>`).join('');
      return `<button class="btile ${ok ? '' : 'dis'} ${sel === b ? 'sel' : ''}" data-b="${b}"><img src="${thumbs[b] ?? ''}" alt=""><span class="bt-n">${t(`b_${b}` as Key)}</span><span class="bt-c">${chips}</span><span class="bt-d">${t(`bd_${b}` as Key)}</span></button>`;
    }).join('');
    this.build.innerHTML = `<div class="bstrip"><div class="bs-h">${t('build_menu')}</div><div class="bs-list">${tiles || `<p>${t('not_enough')}</p>`}</div>${touch ? '' : `<div class="bs-keys">${t('build_keys')}</div>`}</div>
      <div class="bacts">${touch ? `<button class="hbtn bact" id="b-rot">⟳</button><button class="hbtn go bact big" id="b-place">✔</button>` : ''}<button class="hbtn bact" id="b-exit">✖</button></div>`;
    this.build.querySelectorAll<HTMLElement>('.btile').forEach((e) => e.addEventListener('pointerdown', (ev) => { ev.stopPropagation(); ev.preventDefault(); this.onBuildPick?.(e.dataset.b as BuildId); }));
    const bind = (id: string, f?: () => void) => this.build.querySelector(id)?.addEventListener('pointerdown', (ev) => { ev.stopPropagation(); ev.preventDefault(); f?.(); });
    bind('#b-rot', this.onBuildRotate); bind('#b-place', this.onBuildPlace); bind('#b-exit', this.onBuildClose);
    this.build.classList.remove('hidden');
    document.body.classList.add('building');
    const selEl = this.build.querySelector('.btile.sel') as HTMLElement | null;
    selEl?.scrollIntoView({ block: 'nearest' });
  }
  closeBuild() { this.build.classList.add('hidden'); document.body.classList.remove('building'); }
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
      <div class="pactions"><button class="primary" id="hab-sleep">${t('hab_sleep')}</button><button id="hab-exit">${t('hab_close')}</button></div></div>`;
    (this.habPanel.querySelector('#hab-sleep') as HTMLElement).onclick = () => this.onSleep?.();
    (this.habPanel.querySelector('#hab-exit') as HTMLElement).onclick = () => this.onExit?.();
    this.habPanel.classList.remove('hidden');
  }
  closeHab() { this.habPanel.classList.add('hidden'); }
  get habOpen() { return !this.habPanel.classList.contains('hidden'); }

  // ---------- fim
  onFreeplay?: () => void;
  showEnd(win: boolean, sol: number, stats?: { distance: number; built: number; deaths: number }) {
    const statLine = win && stats ? `<p class="endstats">${t('end_stats', { km: (stats.distance / 1000).toFixed(1), built: stats.built, deaths: stats.deaths })}</p>` : '';
    this.endScreen.innerHTML = `<div class="panel-inner"><h2>${t(win ? 'win_title' : 'dead_title')}</h2><p>${t(win ? 'win_sub' : 'dead_sub', { sol })}</p>${statLine}
      <div class="pactions">${win ? `<button class="primary" id="end-free">${t('keep_exploring')}</button>` : `<button class="primary" id="end-respawn">${t('respawn')}</button>`}<button id="end-menu">${t('quit_menu')}</button></div></div>`;
    const f = this.endScreen.querySelector('#end-free') as HTMLElement | null;
    if (f) f.onclick = () => this.onFreeplay?.();
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
