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
import { MatchClient, MatchResult } from './game/matchClient';
import { SKY_FOUNDRY } from './shared/maps/skyfoundry';
import { Wobbler } from './render/character';
import { CharacterBatch } from './render/characterBatch';
import { SKIN_COLORS } from './render/palette';
import { audio } from './audio/audio';
import { saveManager, xpForLevel } from './meta/save';
import { t, setLanguage, LangCode } from './ui/i18n';
import { fmtTime, ordinal } from './ui/hud';
import { MoveState } from './shared/types';
import { clamp } from './shared/math';
import { BotDifficulty } from './shared/bots';

type Screen = 'loading' | 'menu' | 'intro' | 'match' | 'results';

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
  private devEl: HTMLElement;
  private showDev = false;
  private menuTime = 0;
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

    this.screenEl = document.createElement('div');
    this.screenEl.className = 'screen';
    this.ui.appendChild(this.screenEl);

    this.devEl = document.createElement('div');
    this.devEl.className = 'devbar';
    this.devEl.style.display = 'none';
    this.ui.appendChild(this.devEl);

    this.buildTouchControls();

    audio.applySettings({ master: s.master, music: s.music, sfx: s.sfx });

    window.addEventListener('resize', () => this.rig.resize());
    window.addEventListener('keydown', (e) => this.onKey(e));
    // Any first gesture unlocks audio.
    const unlock = () => { audio.resume(); window.removeEventListener('pointerdown', unlock); };
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
      // A small stage so the menu character is not floating in a void.
      this.menuRoot.position.set(2.9, 0, 0);
      const disc = new THREE.Mesh(
        new THREE.CylinderGeometry(1.7, 1.9, 0.35, 32),
        new THREE.MeshStandardMaterial({ color: 0x1d2942, roughness: 0.7 }),
      );
      disc.position.y = -0.18;
      disc.receiveShadow = true;
      this.menuRoot.add(disc);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.75, 0.055, 8, 48),
        new THREE.MeshBasicMaterial({ color: 0x3ddad0 }),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.02;
      this.menuRoot.add(ring);
    }
    this.menuRoot.visible = true;
    this.menuBatch.root.visible = true;
    this.menuWobbler.setLook({ skin: d.look.skin, accent: d.look.accent });
    this.rig.applyAmbient(SKY_FOUNDRY.ambient);
    this.rig.setNight(0);
    this.camera.setOrbit(new THREE.Vector3(2.9, 0.95, 0), 4.4, 0.9);
    this.rig.followShadow(2.9, 0, 0);

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
            <span class="tag">${SKY_FOUNDRY.difficulty.toUpperCase()}</span>
            <div>
              <b>${t(SKY_FOUNDRY.nameKey)}</b>
              <small>${rec?.bestTime ? `Recorde ${fmtTime(rec.bestTime)}` : 'Sem recorde ainda'} · 32 jogadores · 4 layouts</small>
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

    this.screenEl.querySelector('#play')!.addEventListener('click', () => this.startMatch(false));
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
    panel.querySelector('#reset')!.addEventListener('click', () => {
      if (confirm('Zerar todo o progresso?')) { saveManager.reset(); panel.remove(); this.enterMenu(); }
    });
    panel.querySelector('#close')!.addEventListener('click', () => { panel.remove(); this.enterMenu(); });
  }

  // ── match flow ──────────────────────────────────────────────────────────
  private startMatch(practice: boolean): void {
    audio.resume();
    this.menuRoot.visible = false;
    this.menuBatch.root.visible = false;
    // Clear the menu before the HUD is mounted, or it sits on top of the match.
    this.setScreen('', 'match');
    const d = saveManager.data;
    const seed = (Math.random() * 0xffffffff) >>> 0;
    const rec = d.records[SKY_FOUNDRY.id];

    this.match = new MatchClient(this.rig, this.vfx, this.camera, this.input, this.screenEl, {
      map: SKY_FOUNDRY,
      seed,
      botCount: practice ? 0 : 31,
      botDifficulty: this.pickBotDifficulty(),
      practice,
      playerName: d.playerName || 'Runner',
      playerLook: d.look,
      showTimer: d.settings.showTimer || practice,
      personalBest: rec?.bestTime ?? 0,
    });
    this.match.onFinished = (r) => this.showResults(r);

    this.rig.setNight(0);
    this.showRoundIntro(practice);
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

  private showRoundIntro(practice: boolean): void {
    const info = this.match!.getVariantInfo();
    const el = document.createElement('div');
    el.className = 'round-intro';
    el.innerHTML = `
      <div class="name">${t(SKY_FOUNDRY.nameKey)}</div>
      <div class="variant">${info.name}</div>
      <div class="desc">${info.desc}</div>
      <div class="goal">${practice ? t('menu.practice') : t('hud.qualified', { n: 0, total: 16 })}</div>`;
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
      <div class="screen results">
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
      const practice = false;
      this.disposeMatch();
      this.startMatch(practice);
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

  // ── touch ───────────────────────────────────────────────────────────────
  private buildTouchControls(): void {
    this.touchEl = document.createElement('div');
    this.touchEl.className = 'touch-controls';
    this.touchEl.innerHTML = `
      <div class="touch-stick"><i></i></div>
      <button class="touch-btn jump">PULO</button>
      <button class="touch-btn dive">MERGULHO</button>`;
    this.ui.appendChild(this.touchEl);
    this.stickEl = this.touchEl.querySelector('.touch-stick') as HTMLElement;

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
    if (!stick) { this.stickEl.classList.remove('on'); return; }
    this.stickEl.classList.add('on');
    this.stickEl.style.left = `${stick.ox}px`;
    this.stickEl.style.top = `${stick.oy}px`;
    const knob = this.stickEl.firstElementChild as HTMLElement;
    const radius = Math.min(window.innerWidth, window.innerHeight) * 0.11;
    const dx = clamp(stick.x - stick.ox, -radius, radius);
    const dy = clamp(stick.y - stick.oy, -radius, radius);
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
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
(window as unknown as { __app: App }).__app = app;
