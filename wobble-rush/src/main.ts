/**
 * Application shell.
 *
 * Owns the screen flow (menu -> round intro -> match -> results) and the single
 * render loop. Deliberately thin: it wires systems together and never contains
 * gameplay logic, so the same shell will serve networked matches, practice and
 * the Adventure mode later.
 */
import './styles.css';
import * as THREE from 'three';
import { SceneRig, QualityLevel } from './render/scene';
import { VFX } from './render/vfx';
import { CameraController } from './game/camera';
import { InputManager } from './game/input';
import { MatchClient, MatchResult, RosterEntry } from './game/matchClient';
import { SKY_FOUNDRY } from './shared/maps/skyfoundry';
import { NEON_GARDEN } from './shared/maps/neongarden';
import { STORM_RING } from './shared/maps/stormring';
import { rollVariantFor } from './shared/world';
import { MapDef } from './shared/mapdef';
import { Wobbler } from './render/character';
import { CharacterBatch } from './render/characterBatch';
import { SKIN_COLORS } from './render/palette';
import { audio } from './audio/audio';
import { saveManager, xpForLevel } from './meta/save';
import { t, setLanguage, LangCode } from './ui/i18n';
import { fmtTime, ordinal } from './ui/hud';
import { MoveState } from './shared/types';
import { clamp } from './shared/math';
import { touchStickRadius } from './game/input';
import { BotDifficulty, makeBotRoster } from './shared/bots';

type Screen = 'loading' | 'menu' | 'draw' | 'intro' | 'match' | 'results';

/** How far the knob slides, as a fraction of the base radius. Keeps it inside the ring. */
const KNOB_TRAVEL = 0.54;

/** Menu backdrop - a plain, friendly blue. */
const MENU_BLUE = 0x2f6fd0;

/**
 * The rotation a PLAY press draws from. Adding a map to the game is adding it
 * to this list - everything downstream reads the MapDef.
 */
const PLAYLIST: MapDef[] = [SKY_FOUNDRY, NEON_GARDEN, STORM_RING];

const TIPS = [
  'Mergulhe para atravessar vãos maiores — mas você fica vulnerável ao cair.',
  'O mapa muda a cada partida: fique atento aos avisos no meio da corrida.',
  'Perto do eixo de um braço giratório o impacto é menor. Use isso.',
  'Cair custa tempo, não a rodada: procure o caminho de volta.',
  'Segure a direção no ar para ajustar o pouso.',
];

export class App {
  private canvas: HTMLCanvasElement;
  private ui: HTMLElement;
  private rig: SceneRig;
  private vfx: VFX;
  private camera: CameraController;
  private input: InputManager;
  match: MatchClient | null = null;
  private screen: Screen = 'loading';
  private menuWobbler: Wobbler | null = null;
  private menuRoot = new THREE.Group();
  private menuBatch = new CharacterBatch(2);
  private lastTime = performance.now();
  private screenEl: HTMLElement;
  private touchEl!: HTMLElement;
  private stickEl!: HTMLElement;
  private hintEl!: HTMLElement;
  private devEl: HTMLElement;
  private showDev = false;
  private menuTime = 0;
  private isMobile = false;
  private fullscreenTried = false;
  private drawTimer = 0;
  private lastMapId = '';
  private frameTimes: number[] = [];

  constructor() {
    this.canvas = document.getElementById('stage') as HTMLCanvasElement;
    this.ui = document.getElementById('ui') as HTMLElement;

    saveManager.load();
    const s = saveManager.data.settings;
    if (s.language) setLanguage(s.language as LangCode);
    document.documentElement.style.setProperty('--ui-scale', String(s.uiScale));

    const quality: QualityLevel = s.quality === 'auto' ? 'high' : s.quality;
    this.rig = new SceneRig(this.canvas, quality);
    this.rig.setAutoQuality(s.quality === 'auto');
    this.rig.shakeScale = s.shake;

    this.vfx = new VFX();
    this.rig.scene.add(this.vfx.root);

    this.camera = new CameraController(this.rig.camera);
    this.camera.settings.sensitivity = s.sensitivity;
    this.camera.settings.invertY = s.invertY;

    this.input = new InputManager(this.canvas);
    if (s.onScreenControls) this.input.setOnScreenControls(true);

    this.screenEl = document.createElement('div');
    this.screenEl.className = 'screen';
    this.ui.appendChild(this.screenEl);

    this.devEl = document.createElement('div');
    this.devEl.className = 'devbar';
    this.devEl.style.display = 'none';
    this.ui.appendChild(this.devEl);

    this.buildTouchControls();
    this.buildRotateHint();
    this.applyMobileDefaults();

    audio.applySettings({ master: s.master, music: s.music, sfx: s.sfx });

    window.addEventListener('resize', () => this.rig.resize());
    window.addEventListener('keydown', (e) => this.onKey(e));
    // Any first gesture unlocks audio.
    const unlock = () => {
      audio.resume();
      this.goFullscreen();
      window.removeEventListener('pointerdown', unlock);
    };
    window.addEventListener('pointerdown', unlock);

    this.rig.resize();
    this.showLoading();
    requestAnimationFrame(() => this.enterMenu());
    requestAnimationFrame((tNow) => this.frame(tNow));
  }

  // ── screens ─────────────────────────────────────────────────────────────
  private setScreen(html: string, screen: Screen): void {
    this.screen = screen;
    this.screenEl.innerHTML = html;
    this.screenEl.className = 'screen';
    // Every button gets audio feedback without each screen remembering to.
    for (const b of Array.from(this.screenEl.querySelectorAll('.btn'))) {
      b.addEventListener('mouseenter', () => audio.play('uiHover'));
      b.addEventListener('click', () => audio.play('uiClick'));
    }
  }

  private showLoading(): void {
    const tip = TIPS[Math.floor(Math.random() * TIPS.length)];
    this.setScreen(`
      <div class="loader">
        <h1>WOBBLE RUSH</h1>
        <div class="bar"><i></i></div>
        <p class="tip">${tip}</p>
      </div>`, 'loading');
  }

  private enterMenu(): void {
    this.disposeMatch();
    const d = saveManager.data;

    if (!this.menuWobbler) {
      this.menuWobbler = new Wobbler({ skin: d.look.skin, accent: d.look.accent });
      this.menuRoot.add(this.menuWobbler.root);
      this.menuBatch.add(this.menuWobbler);
      this.rig.scene.add(this.menuBatch.root);
      this.rig.scene.add(this.menuRoot);
      this.menuRoot.position.set(this.input.touchEnabled ? 3.4 : 2.9, 0, 0);
    }
    this.menuRoot.visible = true;
    this.menuBatch.root.visible = true;
    this.menuWobbler.setLook({ skin: d.look.skin, accent: d.look.accent });
    // Plain blue behind the character: no horizon, no clouds, no platform.
    this.rig.setFlatBackground(MENU_BLUE);
    this.rig.setNight(0);
    const menuX = this.input.touchEnabled ? 3.4 : 2.9;
    this.camera.setOrbit(new THREE.Vector3(menuX, 0.85, 0), this.input.touchEnabled ? 5 : 4.2, 0.75);
    this.rig.followShadow(menuX, 0, 0);

    const need = xpForLevel(d.level);
    const pct = clamp(d.xp / need, 0, 1) * 100;
    const rec = d.records[SKY_FOUNDRY.id];

    this.setScreen(`
      <div class="menu menu-split">
        <div class="menu-top">
          <div class="brand">WOBBLE<span>RUSH</span><small>PARTY PLATFORMER</small></div>
          <div class="profile-chip">
            <span class="lvl">${d.level}</span>
            <div>
              <div style="font-weight:700">${d.playerName || 'Runner'}</div>
              <div class="xpbar"><i style="width:${pct}%"></i></div>
            </div>
          </div>
        </div>
        <div class="menu-bottom">
          <div class="map-card">
            <span class="tag">${PLAYLIST.length} MAPAS</span>
            <div>
              <b>${PLAYLIST.map((m) => t(m.nameKey)).join(' · ')}</b>
              <small>${rec?.bestTime ? `Recorde em ${t(SKY_FOUNDRY.nameKey)}: ${fmtTime(rec.bestTime)}` : 'Sorteado a cada partida'} · 32 jogadores</small>
            </div>
          </div>
          <button class="btn big" id="play">${t('menu.play')}</button>
          <div class="menu-actions">
            <button class="btn secondary" id="practice">${t('menu.practice')}</button>
            <button class="btn secondary" id="customize">${t('menu.customize')}</button>
            <button class="btn secondary" id="settings">${t('menu.settings')}</button>
          </div>
        </div>
      </div>`, 'menu');

    this.screenEl.querySelector('#play')!.addEventListener('click', () => this.showMapDraw());
    this.screenEl.querySelector('#practice')!.addEventListener('click', () => this.startMatch(true));
    this.screenEl.querySelector('#customize')!.addEventListener('click', () => this.openCustomize());
    this.screenEl.querySelector('#settings')!.addEventListener('click', () => this.openSettings());
  }

  private openCustomize(): void {
    const d = saveManager.data;
    const swatches = SKIN_COLORS.map((c, i) =>
      `<button class="btn" data-skin="${c}" style="background:#${c.toString(16).padStart(6, '0')};min-width:46px;min-height:46px;padding:0;border-radius:14px" aria-label="cor ${i + 1}"></button>`).join('');
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = `
      <h2>${t('menu.customize')}</h2>
      <p class="sub">Escolha a cor do seu Wobbler. Mais peças chegam com a progressão.</p>
      <div class="row"><label>Nome<span class="hint">Aparece no lobby e nos resultados</span></label>
        <input type="text" id="pname" maxlength="14" value="${d.playerName}" placeholder="Runner" /></div>
      <div class="row" style="flex-wrap:wrap"><label>Corpo</label><div style="display:flex;gap:8px;flex-wrap:wrap">${swatches}</div></div>
      <div class="row" style="flex-wrap:wrap"><label>Detalhe</label><div style="display:flex;gap:8px;flex-wrap:wrap">${
        SKIN_COLORS.map((c) => `<button class="btn" data-accent="${c}" style="background:#${c.toString(16).padStart(6, '0')};min-width:38px;min-height:38px;padding:0;border-radius:12px"></button>`).join('')
      }</div></div>
      <div class="panel-actions"><button class="btn" id="close">${t('common.back')}</button></div>`;
    this.screenEl.appendChild(panel);

    panel.querySelectorAll('[data-skin]').forEach((el) => el.addEventListener('click', () => {
      d.look.skin = Number((el as HTMLElement).dataset.skin);
      this.menuWobbler?.setLook(d.look);
      saveManager.markDirty();
      audio.play('uiClick');
    }));
    panel.querySelectorAll('[data-accent]').forEach((el) => el.addEventListener('click', () => {
      d.look.accent = Number((el as HTMLElement).dataset.accent);
      this.menuWobbler?.setLook(d.look);
      saveManager.markDirty();
      audio.play('uiClick');
    }));
    const nameInput = panel.querySelector('#pname') as HTMLInputElement;
    nameInput.addEventListener('focus', () => { this.input.suspended = true; });
    nameInput.addEventListener('blur', () => { this.input.suspended = false; });
    nameInput.addEventListener('input', () => {
      d.playerName = nameInput.value.replace(/[^\w \-]/g, '').slice(0, 14);
      saveManager.markDirty();
    });
    panel.querySelector('#close')!.addEventListener('click', () => { panel.remove(); this.enterMenu(); });
  }

  private openSettings(): void {
    const s = saveManager.data.settings;
    const panel = document.createElement('div');
    panel.className = 'panel';
    const slider = (id: string, label: string, hint: string, val: number, min = 0, max = 1, step = 0.05) =>
      `<div class="row"><label>${label}<span class="hint">${hint}</span></label>
        <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}"></div>`;
    panel.innerHTML = `
      <h2>${t('menu.settings')}</h2>
      <p class="sub">${t('settings.graphics')} · ${t('settings.audio')} · ${t('settings.controls')}</p>
      <div class="row"><label>${t('settings.graphics')}<span class="hint">Auto ajusta sozinho conforme o FPS</span></label>
        <select id="quality">
          ${['auto', 'low', 'medium', 'high', 'ultra'].map((q) =>
            `<option value="${q}" ${s.quality === q ? 'selected' : ''}>${q.toUpperCase()}</option>`).join('')}
        </select></div>
      ${slider('master', 'Volume geral', '', s.master)}
      ${slider('music', 'Música', '', s.music)}
      ${slider('sfx', 'Efeitos', '', s.sfx)}
      ${slider('sens', 'Sensibilidade da câmera', '', s.sensitivity, 0.25, 2.5, 0.05)}
      ${slider('shake', 'Tremor de câmera', 'Reduza para menos enjoo', s.shake, 0, 1.5, 0.1)}
      ${slider('uiscale', 'Tamanho da interface', '', s.uiScale, 0.8, 1.4, 0.05)}
      <div class="row"><label>Inverter eixo Y</label>
        <button class="toggle ${s.invertY ? 'on' : ''}" id="invert"><i></i></button></div>
      <div class="row"><label>Mostrar cronômetro<span class="hint">Útil para speedrun</span></label>
        <button class="toggle ${s.showTimer ? 'on' : ''}" id="timer"><i></i></button></div>
      <div class="row"><label>Controles na tela<span class="hint">Joystick e botões, mesmo no computador</span></label>
        <button class="toggle ${s.onScreenControls ? 'on' : ''}" id="onscreen"><i></i></button></div>
      <div class="row"><label>Idioma</label>
        <select id="lang">
          <option value="pt-BR">Português</option><option value="en">English</option><option value="es">Español</option>
        </select></div>
      <div class="panel-actions">
        <button class="btn ghost" id="reset">Zerar progresso</button>
        <button class="btn" id="close">${t('common.back')}</button>
      </div>`;
    this.screenEl.appendChild(panel);

    const bind = (id: string, fn: (v: number) => void) => {
      const el = panel.querySelector(`#${id}`) as HTMLInputElement;
      el.addEventListener('input', () => { fn(Number(el.value)); saveManager.markDirty(); });
    };
    bind('master', (v) => { s.master = v; audio.applySettings({ master: v }); });
    bind('music', (v) => { s.music = v; audio.applySettings({ music: v }); });
    bind('sfx', (v) => { s.sfx = v; audio.applySettings({ sfx: v }); });
    bind('sens', (v) => { s.sensitivity = v; this.camera.settings.sensitivity = v; });
    bind('shake', (v) => { s.shake = v; this.rig.shakeScale = v; });
    bind('uiscale', (v) => { s.uiScale = v; document.documentElement.style.setProperty('--ui-scale', String(v)); });

    const qualitySel = panel.querySelector('#quality') as HTMLSelectElement;
    qualitySel.addEventListener('change', () => {
      s.quality = qualitySel.value as typeof s.quality;
      s.qualityTouched = true;
      this.rig.setAutoQuality(s.quality === 'auto');
      if (s.quality !== 'auto') this.rig.setQuality(s.quality);
      saveManager.markDirty();
    });
    const langSel = panel.querySelector('#lang') as HTMLSelectElement;
    langSel.value = s.language || 'pt-BR';
    langSel.addEventListener('change', () => {
      s.language = langSel.value;
      setLanguage(langSel.value as LangCode);
      saveManager.markDirty();
      panel.remove();
      // The touch layer is built once at boot and outlives every screen, so
      // rebuilding the menu alone would leave its labels in the old language.
      this.relabelTouchControls();
      this.enterMenu();
    });
    const invert = panel.querySelector('#invert') as HTMLElement;
    invert.addEventListener('click', () => {
      s.invertY = !s.invertY;
      this.camera.settings.invertY = s.invertY;
      invert.classList.toggle('on', s.invertY);
      saveManager.markDirty();
    });
    const timer = panel.querySelector('#timer') as HTMLElement;
    timer.addEventListener('click', () => {
      s.showTimer = !s.showTimer;
      timer.classList.toggle('on', s.showTimer);
      saveManager.markDirty();
    });
    const onscreen = panel.querySelector('#onscreen') as HTMLElement;
    onscreen.addEventListener('click', () => {
      s.onScreenControls = !s.onScreenControls;
      onscreen.classList.toggle('on', s.onScreenControls);
      this.input.setOnScreenControls(s.onScreenControls);
      this.touchEl.classList.toggle('active', this.input.touchEnabled && this.screen === 'match');
      saveManager.markDirty();
    });
    panel.querySelector('#reset')!.addEventListener('click', () => {
      if (confirm('Zerar todo o progresso?')) { saveManager.reset(); panel.remove(); this.enterMenu(); }
    });
    panel.querySelector('#close')!.addEventListener('click', () => { panel.remove(); this.enterMenu(); });
  }

  // ── match flow ──────────────────────────────────────────────────────────
  /**
   * Pre-match draw. The layout is rolled first and the card animation lands on
   * the real answer - the shuffle is presentation, the result is authoritative,
   * exactly the way a server-picked round has to work.
   */
  private showMapDraw(): void {
    audio.resume();
    // Hide the menu character: it shows through the draw overlay otherwise.
    this.menuRoot.visible = false;
    this.menuBatch.root.visible = false;

    const seed = (Math.random() * 0xffffffff) >>> 0;
    // Avoid drawing the same course twice in a row - variety beats pure chance.
    const pool = PLAYLIST.length > 1
      ? PLAYLIST.filter((m) => m.id !== this.lastMapId)
      : PLAYLIST;
    const map = pool[seed % pool.length];
    const chosen = rollVariantFor(map, seed);
    this.lastMapId = map.id;

    const modeKey = `mode.${map.modes[0]}`;
    const qualify = Math.max(1, Math.round(map.maxPlayers * map.qualifyRatio));
    const variant = map.variants.find((v) => v.id === chosen);

    this.setScreen(`
      <div class="draw">
        <div class="draw-head">
          <span class="draw-eyebrow">${t('draw.next')}</span>
          <h2 id="draw-name">${t(map.nameKey)}</h2>
          <p id="draw-meta">${t(modeKey)} · ${map.difficulty.toUpperCase()} · ${map.maxPlayers} · ${qualify}</p>
        </div>
        <div class="draw-cards">
          ${PLAYLIST.map((m) => `
            <div class="draw-card" data-id="${m.id}">
              <b>${t(m.nameKey)}</b>
              <span>${t(`mode.${m.modes[0]}`)} · ${m.difficulty.toUpperCase()}</span>
            </div>`).join('')}
        </div>
        <div class="draw-status">${t('draw.picking')}</div>
        <div class="draw-foot" id="draw-variant"></div>
      </div>`, 'draw');

    const cards = Array.from(this.screenEl.querySelectorAll('.draw-card')) as HTMLElement[];
    const status = this.screenEl.querySelector('.draw-status') as HTMLElement;
    const variantEl = this.screenEl.querySelector('#draw-variant') as HTMLElement;
    const targetIndex = Math.max(0, PLAYLIST.findIndex((m) => m.id === map.id));

    // Spin, decelerate, land. Under three seconds on purpose: the player came
    // here to run, not to watch a slot machine. The result was already drawn.
    let i = 0;
    let delay = 80;
    let elapsed = 0;
    const spin = () => {
      cards.forEach((c) => c.classList.remove('active'));
      cards[i % cards.length].classList.add('active');
      audio.play('uiHover');
      elapsed += delay;
      if (elapsed > 1300 && (i % cards.length) === targetIndex) {
        cards[targetIndex].classList.add('picked');
        status.textContent = t('draw.picked');
        variantEl.innerHTML = `<b>${variant ? t(variant.nameKey) : ''}</b> — ${variant?.descKey ? t(variant.descKey) : ''}`;
        audio.play('reward');
        this.drawTimer = window.setTimeout(() => this.startMatch(false, seed, chosen, map), 1000);
        return;
      }
      i++;
      if (elapsed > 900) delay = Math.min(300, delay * 1.24);
      this.drawTimer = window.setTimeout(spin, delay);
    };
    spin();
  }

  private startMatch(practice: boolean, presetSeed?: number, presetVariant?: string, presetMap?: MapDef): void {
    audio.resume();
    if (this.drawTimer) { clearTimeout(this.drawTimer); this.drawTimer = 0; }
    this.menuRoot.visible = false;
    this.menuBatch.root.visible = false;
    // Clear the menu before the HUD is mounted, or it sits on top of the match.
    this.setScreen('', 'match');
    const d = saveManager.data;
    const map = presetMap ?? SKY_FOUNDRY;
    const seed = presetSeed ?? ((Math.random() * 0xffffffff) >>> 0);
    const rec = d.records[map.id];
    const mode = map.modes[0] ?? 'race';
    const qualify = Math.max(1, Math.round(map.maxPlayers * map.qualifyRatio));

    // Build the field: the local player plus a varied bot roster.
    const roster: RosterEntry[] = [{
      id: 1, name: d.playerName || 'Runner', isBot: false,
      difficulty: 'normal', personality: 'speedrunner', look: { ...d.look },
    }];
    if (!practice) {
      makeBotRoster(map.maxPlayers - 1, seed, this.pickBotDifficulty()).forEach((r, i) => {
        roster.push({
          id: i + 2, name: r.name, isBot: true,
          difficulty: r.difficulty, personality: r.personality,
          look: {
            skin: SKIN_COLORS[(i + 3) % SKIN_COLORS.length],
            accent: SKIN_COLORS[(i + 7) % SKIN_COLORS.length],
          },
        });
      });
    }

    this.match = new MatchClient(this.rig, this.vfx, this.camera, this.input, this.screenEl, {
      map,
      mode,
      seed,
      roster,
      localId: 1,
      qualifyCount: practice ? 1 : qualify,
      variantId: presetVariant,
      practice,
      showTimer: d.settings.showTimer || practice,
      personalBest: rec?.bestTime ?? 0,
    });
    this.match.onFinished = (r) => this.showResults(r);

    this.rig.setNight(0);
    // Short flyover while the countdown runs: it sells the map and costs no
    // extra time, because the countdown had to happen anyway. Arenas orbit;
    // courses fly the route backwards from the finish to the grid.
    if (!practice) {
      const arena = mode === 'survival' || mode === 'arena';
      const len = map.courseLength;
      this.camera.startIntro(arena
        ? [[34, 20, 34], [0, 16, 44], [-34, 14, 20], [-14, 9, -14], [0, 6, -20]]
        : [[0, 26, len * 0.62], [0, 18, len * 0.45], [0, 12, len * 0.26],
           [0, 7, len * 0.09], [0, 4, -2]], 3.0);
    }
    this.showRoundIntro(practice, map);
    this.screen = 'match';
    this.touchEl.classList.toggle('active', this.input.touchEnabled);
  }

  /** Casual bots scale gently with the player's level - never to punish. */
  private pickBotDifficulty(): BotDifficulty {
    const lvl = saveManager.data.level;
    if (lvl < 3) return 'easy';
    if (lvl < 9) return 'normal';
    if (lvl < 20) return 'hard';
    return 'expert';
  }

  private showRoundIntro(practice: boolean, map: MapDef = SKY_FOUNDRY): void {
    const info = this.match!.getVariantInfo();
    const el = document.createElement('div');
    el.className = 'round-intro';
    el.innerHTML = `
      <div class="name">${t(map.nameKey)}</div>
      <div class="variant">${info.name}</div>
      <div class="desc">${info.desc}</div>
      <div class="goal">${practice ? t('menu.practice') : t(`mode.${map.modes[0]}`)}</div>`;
    this.screenEl.appendChild(el);
    setTimeout(() => { el.style.transition = 'opacity 500ms'; el.style.opacity = '0'; }, 2400);
    setTimeout(() => el.remove(), 3000);
  }

  private showResults(r: MatchResult): void {
    const d = saveManager.data;
    const record = saveManager.submitRun(r.mapId, r.time, r.qualified, r.falls);
    d.stats.matches++;
    d.stats.falls += r.falls;
    if (r.qualified) d.stats.qualifies++;
    if (r.position === 1) { d.stats.wins++; }
    if (d.stats.bestPosition === 0 || r.position < d.stats.bestPosition) d.stats.bestPosition = r.position;

    // Reward participation first, placement second: nobody should leave empty-handed.
    const xp = 40 + Math.max(0, r.total - r.position) * 6 + (r.qualified ? 80 : 0) + (r.position === 1 ? 140 : 0);
    const coins = 12 + (r.qualified ? 18 : 0) + (r.position === 1 ? 40 : 0);
    const levels = saveManager.addXp(xp);
    saveManager.addCoins(coins);
    saveManager.save();

    this.match?.setHudVisible(false);
    audio.setIntensity(0.2);
    if (r.position === 1) {
      this.vfx.emit('confetti', 0, 6, 0, 60, 0xffd166);
      audio.play('reward');
    }

    const rows: [string, string][] = [
      ['Posição', `${ordinal(r.position)} de ${r.total}`],
      ['Tempo', r.time > 0 ? fmtTime(r.time) : '—'],
      ['Quedas', String(r.falls)],
      ['Layout', t(`variant.${r.variantId}`)],
      ['XP', `+${xp}`],
      ['Moedas', `+${coins}`],
    ];
    if (record) rows.push([t('round.newRecord'), fmtTime(r.time)]);
    if (levels > 0) rows.push(['Nível', `${d.level} (+${levels})`]);

    this.setScreen(`
      <div class="results-wrap">
        <div class="results-card">
          <div class="results-place ${r.qualified ? '' : 'bad'}">${ordinal(r.position)}</div>
          <div class="results-sub">${r.qualified ? t('round.qualified') : t('round.eliminated')}</div>
          <div class="results-rows">
            ${rows.map(([k, v], i) =>
              `<div class="results-row reveal" style="animation-delay:${i * 70}ms"><span>${k}</span><b>${v}</b></div>`).join('')}
          </div>
          <div class="menu-actions">
            <button class="btn" id="again">${t('results.playAgain')}</button>
            <button class="btn secondary" id="menu">${t('results.menu')}</button>
          </div>
        </div>
      </div>`, 'results');

    this.screenEl.querySelector('#again')!.addEventListener('click', () => {
      this.disposeMatch();
      this.showMapDraw();
    });
    this.screenEl.querySelector('#menu')!.addEventListener('click', () => this.enterMenu());
  }

  private disposeMatch(): void {
    if (this.match) {
      this.match.dispose();
      this.match = null;
    }
    this.touchEl.classList.remove('active');
  }

  /**
   * Phone defaults. A mid-range handset cannot hold 60 fps at desktop settings,
   * and finding that out through a stuttery first match is a bad introduction -
   * so mobile starts conservative and the adaptive controller climbs from there
   * if the device turns out to have headroom.
   */
  private applyMobileDefaults(): void {
    if (!this.input.touchEnabled) return;
    this.isMobile = true;
    const s = saveManager.data.settings;
    if (!s.qualityTouched) {
      s.quality = 'auto';
      this.rig.setQuality('low');
      this.rig.setAutoQuality(true);
      saveManager.markDirty();
    }
    this.vfx.setBudget(0.6);
    // Touch look is a thumb on glass: it needs less gain than a mouse.
    this.camera.settings.sensitivity = s.sensitivity * 0.9;
    document.body.classList.add('is-touch');
  }

  private buildRotateHint(): void {
    const el = document.createElement('div');
    el.className = 'rotate-hint';
    el.innerHTML = `
      <div class="glyph"></div>
      <b>GIRE O APARELHO</b>
      <span>WOBBLE RUSH foi feito para ser jogado deitado, com os dois polegares.</span>`;
    this.ui.appendChild(el);
  }

  /** Fullscreen on the first tap: a phone browser's chrome eats the HUD. */
  private goFullscreen(): void {
    if (!this.isMobile || this.fullscreenTried) return;
    this.fullscreenTried = true;
    const el = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
    };
    const req = el.requestFullscreen?.bind(el) ?? el.webkitRequestFullscreen?.bind(el);
    void req?.().catch(() => { /* denied is fine - the game still plays */ });
    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (o: string) => Promise<void>;
    };
    void orientation?.lock?.('landscape').catch(() => { /* not supported everywhere */ });
  }

  // ── touch ───────────────────────────────────────────────────────────────
  /** Re-applies the localised labels without touching the bound listeners. */
  private relabelTouchControls(): void {
    const set = (sel: string, key: string) => {
      const el = this.touchEl.querySelector(sel) as HTMLElement | null;
      if (!el) return;
      el.textContent = t(key);
      el.setAttribute('aria-label', t(key));
    };
    set('.touch-btn.jump', 'touch.jump');
    set('.touch-btn.dive', 'touch.dive');
    if (this.hintEl) this.hintEl.textContent = t('touch.hint');
  }

  private buildTouchControls(): void {
    this.touchEl = document.createElement('div');
    this.touchEl.className = 'touch-controls';
    this.touchEl.innerHTML = `
      <div class="touch-stick"><i></i></div>
      <button class="touch-btn jump" aria-label="${t('touch.jump')}">${t('touch.jump')}</button>
      <button class="touch-btn dive" aria-label="${t('touch.dive')}">${t('touch.dive')}</button>
      <div class="touch-hint">${t('touch.hint')}</div>`;
    this.ui.appendChild(this.touchEl);
    this.stickEl = this.touchEl.querySelector('.touch-stick') as HTMLElement;
    this.hintEl = this.touchEl.querySelector('.touch-hint') as HTMLElement;

    const bind = (sel: string, action: string) => {
      const el = this.touchEl.querySelector(sel) as HTMLElement;
      const down = (e: Event) => { e.preventDefault(); this.input.setTouchButton(action, true); };
      const up = (e: Event) => { e.preventDefault(); this.input.setTouchButton(action, false); };
      el.addEventListener('touchstart', down, { passive: false });
      el.addEventListener('touchend', up, { passive: false });
      el.addEventListener('touchcancel', up, { passive: false });
      el.addEventListener('mousedown', down);
      window.addEventListener('mouseup', up);
    };
    bind('.jump', 'jump');
    bind('.dive', 'dive');
  }

  private updateTouchVisuals(): void {
    const stick = this.input.getStick();
    // Once they have used it, the hint is just clutter over the game.
    if (stick.active && this.hintEl && this.hintEl.style.opacity !== '0') {
      this.hintEl.style.opacity = '0';
    }
    this.stickEl.classList.toggle('on', stick.active);
    this.stickEl.style.left = `${stick.ox}px`;
    this.stickEl.style.top = `${stick.oy}px`;

    // Size the base from the same number the input normalises against, so the
    // ring and the thumb travel can never disagree.
    const radius = touchStickRadius();
    const size = radius * 2;
    if (this.stickEl.style.width !== `${size}px`) {
      this.stickEl.style.width = `${size}px`;
      this.stickEl.style.height = `${size}px`;
    }

    const knob = this.stickEl.firstElementChild as HTMLElement;
    // Clamp to a circle, not a square: a diagonal push must not reach further
    // than a straight one. The knob then travels over the part of the ring that
    // keeps it fully inside - visual travel is shorter than thumb travel on
    // purpose, so the control looks tidy while still feeling generous.
    let nx = (stick.x - stick.ox) / radius;
    let ny = (stick.y - stick.oy) / radius;
    const len = Math.hypot(nx, ny);
    if (len > 1) { nx /= len; ny /= len; }
    const travel = radius * KNOB_TRAVEL;
    knob.style.transform =
      `translate(calc(-50% + ${nx * travel}px), calc(-50% + ${ny * travel}px))`;
  }

  // ── input / debug ───────────────────────────────────────────────────────
  private onKey(e: KeyboardEvent): void {
    if (e.code === 'Escape' && this.screen === 'match') {
      this.disposeMatch();
      this.enterMenu();
    }
    if (e.code === 'F3' || (e.code === 'Backquote' && e.shiftKey)) {
      this.showDev = !this.showDev;
      this.devEl.style.display = this.showDev ? '' : 'none';
      e.preventDefault();
    }
    if (this.screen === 'match' && this.match) {
      if (e.code === 'BracketRight') this.match.cycleSpectate(1);
      if (e.code === 'BracketLeft') this.match.cycleSpectate(-1);
    }
  }

  // ── loop ────────────────────────────────────────────────────────────────
  private frame(now: number): void {
    requestAnimationFrame((n) => this.frame(n));
    const dt = Math.min((now - this.lastTime) / 1000, 0.25);
    this.lastTime = now;

    this.frameTimes.push(dt);
    if (this.frameTimes.length > 60) this.frameTimes.shift();

    if (this.match) {
      this.match.update(dt);
    } else {
      // Menu: idle character, gentle orbit.
      this.menuTime += dt;
      if (this.menuWobbler) {
        const state = Math.sin(this.menuTime * 0.35) > 0.86 ? MoveState.Emote : MoveState.Idle;
        if (state === MoveState.Emote && this.menuTime % 7 < dt * 2) {
          this.menuWobbler.playEmote(Math.floor(Math.random() * 3));
        }
        this.menuWobbler.update(dt, MoveState.Idle, 0, 0, true, Math.sin(this.menuTime * 0.25) * 0.5, 0);
        this.menuBatch.sync(this.rig.camera);
      }
      this.camera.update(dt, 0, 0, 0, 0, 0, null);
      this.vfx.update(dt, this.rig.camera);
    }

    if (this.input.touchEnabled) this.updateTouchVisuals();
    this.rig.tickQuality(dt);
    this.rig.render(dt);
    saveManager.tick(dt);

    if (this.showDev) this.updateDev(dt);
  }

  private updateDev(dt: number): void {
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / Math.max(1, this.frameTimes.length);
    const info = this.rig.renderer.info;
    const sim = this.match?.sim;
    this.devEl.textContent =
      `fps ${(1 / Math.max(avg, 1e-4)).toFixed(0)}  dt ${(dt * 1000).toFixed(1)}ms  q ${this.rig.getQuality().level}\n` +
      `draws ${info.render.calls}  tris ${(info.render.triangles / 1000).toFixed(1)}k\n` +
      (sim ? `tick ${sim.tick}  phase ${sim.phase}  players ${sim.players.length}  variant ${sim.director.variantId}\n` +
        `hazard x${sim.getHazardScale().toFixed(2)}  fired [${sim.director.fired.join(',')}]` : 'menu');
  }
}

const app = new App();
// Exposed for automated screenshots and the dev console. Harmless in release:
// it grants nothing the player could not already do by playing.
(window as unknown as { __app: App; __maps: MapDef[] }).__app = app;
(window as unknown as { __maps: MapDef[] }).__maps = PLAYLIST;
