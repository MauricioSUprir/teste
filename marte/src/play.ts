// Controlador de jogo: liga simulação de sobrevivência, interação, construção, objetivos e HUD ao motor.
import * as THREE from 'three';
import type { Game } from './game';
import { Hud, WICON, BUILD_ORDER } from './ui/hud';
import { makeThumbs } from './ui/thumbs';
import { BUILDERS } from './world/structures';
import { WorldSim, type LootPoint } from './sim/world';
import { newState, save, load, type GameState } from './sim/state';
import { simulate, type SimOut } from './sim/survival';
import { BAL, ANTENNA_COST, ANTENNA_KWH, type BuildId, type ItemId } from './sim/balance';
import { OBJECTIVES, type ObjWorld } from './sim/objectives';
import { t, type Key } from './core/i18n';
import { WORLD } from './world/config';
import { Voice } from './audio/voice';
import { sfx } from './audio/sfx';
import { viewSize } from './core/viewport';
import { Combat } from './combat/combat';
import { WEAPONS, UPG_MAX, upgradeCost, type WeaponId, type UpgradeId } from './combat/defs';

const HOLD: Record<string, number> = { crate: 1.2, wreck: 2.0, gypsum: 2.6, antenna: 4.0, door: 0, panel_clean: 2.0 };

export class Play {
  st: GameState = newState();
  world: WorldSim;
  hud: Hud;
  voice = new Voice();
  inHab = false;
  combat!: Combat;
  private coldWarnSol = -1;
  dead = false;
  won = false;
  private holdT = 0;
  private holdId = '';
  private lastOut: SimOut | null = null;
  private hudT = 0;
  private autoSaveT = 0;
  private lastPos = new THREE.Vector3();
  private objAnnounced = -1;
  active = false;
  onQuitToMenu?: () => void;

  constructor(public game: Game) {
    this.world = new WorldSim(game.crash.mats, game.terrain, game.physics, game.crash.crates, game.crash.landerPos, game.nasa);
    this.combat = new Combat(game, () => this.st, {
      toast: (k, kind = 'info', vars) => this.hud.toast(t(k as Key, vars), kind),
      say: (k) => this.speak(k as Key),
      hurt: (dmg) => this.playerHurt(dmg),
      hitMarker: (kill) => this.hud.hitMarker(kill),
      threats: (l) => this.hud.setThreats(l),
      targetBar: (p, f) => { const { w, h } = viewSize(); this.hud.setTargetBar(p, f, w, h); },
    });
    // pedrinhas nunca escondem itens coletáveis
    game.pebbleBlock = (x, z) => this.world.loot.some((l) => Math.abs(l.pos.x - x) < 1.6 && Math.abs(l.pos.z - z) < 1.6);
    game.pebbles.update(game.camera.position, true);
    game.scene.add(this.world.group);
    this.hud = new Hud(document.getElementById('hud')!);
    this.hud.buildMap(game.terrain.heights, WORLD.res);
    this.hud.onBuildPick = (b) => this.pickBuild(b);
    this.hud.onBuildClose = () => this.exitBuild();
    this.hud.onBuildRotate = () => this.rotateGhost();
    this.hud.onBuildPlace = () => { if (this.world.ghost) { this.world.updateGhost(this.st, this.game.player.pos, this.game.player.yaw); this.placeBuild(); } };
    this.hud.onSleep = () => { this.closeConsole(); this.sleep(); };
    this.hud.onExit = () => this.closeConsole();
    this.hud.onRespawn = () => this.respawn();
    this.hud.onMenu = () => { this.hud.hideEnd(); this.onQuitToMenu?.(); };
    this.hud.onArmoryClose = () => { this.hud.closeArmory(); this.game.input.enabled = true; this.game.input.clearPressed(); this.game.input.requestLock(); };
    this.hud.onCraft = (w) => this.craftWeapon(w);
    this.hud.onUpgrade = (w, u) => this.upgradeWeapon(w, u);
    this.hud.onEquip = (w) => { this.st.weapons.eq = w; sfx.click(); this.hud.openArmory(this.st); };
    // depois do resgate confirmado: continuar explorando Marte livremente
    this.hud.onFreeplay = () => {
      this.st.flags.freeplay = true;
      this.won = false;
      this.hud.hideEnd();
      this.game.input.enabled = true;
      this.game.input.clearPressed();
      this.persist(false);
      this.game.input.requestLock();
    };
  }

  // ------------------------------------------------ ciclo de vida
  begin(st: GameState) {
    this.st = st;
    this.combat?.reset();
    this.dead = false;
    this.won = !!st.flags.won && !st.flags.freeplay;
    this.inHab = false;
    this.game.setInterior(false);
    this.hud.closeHab(); this.exitBuild(); this.hud.hideEnd(); this.hud.toggleMap(false);
    this.world.sync(st);
    const g = this.game;
    g.sol = st.sol;
    g.tau = st.tau;
    g.forceExitVehicle();
    g.player.teleport(st.player.x, st.player.z, 0.3);
    g.player.yaw = st.player.yaw;
    g.input.clearPressed();
    g.input.enabled = !this.won;
    g.player.frozen = false;
    g.astro.root.visible = true;
    g.rover.reset(st.rover.x, st.rover.z, st.rover.yaw);
    g.rover.battery = st.rover.batt;
    this.lastPos.copy(g.player.pos);
    this.objAnnounced = -1;
    this.active = true;
    if (st.suit.health <= 0) { this.dead = false; this.respawnFrom(st); return; }
    if (this.won) this.hud.showEnd(true, Math.floor(st.sol), st.stats);
    g.updateEnv(true);
    g.measureSky();
    g.updateSky(0);
    if (!st.flags.started) { st.flags.started = true; this.persist(false); }
  }

  newGame(difficulty: GameState['difficulty']) {
    const st = newState(difficulty);
    st.player.yaw = this.game.player.yaw;
    this.begin(st);
  }
  continueGame() {
    const st = load();
    if (st) this.begin(st); else this.newGame('normal');
  }

  persist(showToast = true) {
    const g = this.game;
    if (this.dead) return;
    const pp = g.driving ? g.rover.driverDoor() : this.inHab ? (this.world.doorPos(this.st) ?? g.player.pos) : g.player.pos;
    this.st.player = { x: pp.x, y: pp.y, z: pp.z, yaw: g.player.yaw };
    this.st.sol = g.sol;
    this.st.rover = { x: g.rover.pos.x, z: g.rover.pos.z, yaw: g.rover.yaw(), batt: g.rover.battery };
    if (save(this.st) && showToast) this.hud.toast(t('saved'), 'ok');
  }

  // ------------------------------------------------ passo por quadro
  update(dt: number) {
    if (!this.active) return;
    const g = this.game, st = this.st, input = g.input;
    // tempo
    st.sol = g.sol;
    const dtH = (dt / (BAL.realMinPerSol * 60)) * 24.66;
    const pos = g.player.pos;
    const moving = g.player.horizontalSpeed() > 0.3;
    st.stats.distance += Math.min(5, pos.distanceTo(this.lastPos));
    this.lastPos.copy(pos);

    if (!this.dead && !this.won) {
      const out = simulate(st, dtH, { inHabitat: this.inHab, working: moving || this.holdT > 0, lampOn: g.lampOn, ltst: g.sky0.ltstHours, sunSinAlt: Math.sin(g.sky0.sunAlt), solarConst: g.sky0.solarConst });
      this.lastOut = out;
      g.tau = st.tau;
      // queda
      if (g.player.lastImpact > 0) {
        const v = g.player.lastImpact;
        g.player.lastImpact = 0;
        if (v > 1.2) sfx.land(v);
        if (v > BAL.fallSafe) { st.suit.health = Math.max(0, st.suit.health - (v - BAL.fallSafe) * BAL.fallDamagePerMs); this.hud.toast(`−${Math.round((v - BAL.fallSafe) * BAL.fallDamagePerMs)} ${t('hud_health')}`, 'warn'); if (st.suit.health <= 0) out.events.push('dead'); }
      }
      for (const e of out.events) this.onEvent(e);
    }

    if (this.inHab && !this.dead && !this.won) this.handleInterior(dt);
    if (!this.inHab && !this.dead && !this.won) {
      this.handleVehicle(dt);
      if (!g.driving) { this.handleInteraction(dt); this.handleBuild(); }
    }
    {
      const hab = this.world.habitat(st);
      this.combat.aimAssist = g.input.touchMode;
      this.combat.update(dt, { active: !this.dead && !this.won && !g.paused, inside: this.inHab, driving: g.driving, habitat: hab ? new THREE.Vector3(hab.x, 0, hab.z) : null, storm: !!st.storm });
      const armed = !this.inHab && !g.driving && !this.dead && !this.world.ghost && !this.hud.buildOpen;
      this.hud.setWeapon(st, armed);
      const tf = document.getElementById('tb-fire'), tw = document.getElementById('tb-wpn');
      tf?.classList.toggle('gone', !armed);
      if (tw) { tw.classList.toggle('gone', !armed); const ic = WICON[st.weapons.eq]; if (tw.textContent !== ic) tw.textContent = ic; }
    }
    this.world.update(dt);
    if (input.consume('map')) this.hud.toggleMap();
    if (this.hud.mapOpen) this.drawMap();

    // objetivos
    // objetivos nunca regridem: avança a partir do atual
    let oi = st.objective;
    while (oi < OBJECTIVES.length - 1 && OBJECTIVES[oi].done(st)) oi++;
    if (oi !== st.objective) {
      if (oi > st.objective) {
        this.hud.toast(`✓ ${t('obj_done')}: ${t(OBJECTIVES[st.objective].key)}`, 'ok');
        sfx.objective();
        if (OBJECTIVES[oi].key === 'obj_explore' && !g.driving) setTimeout(() => this.hud.toast(t('hint_rover'), 'info'), 6000);
      }
      st.objective = oi;
    }
    if (this.objAnnounced !== oi) { this.objAnnounced = oi; this.speak(OBJECTIVES[oi].voice); }
    this.updateWaypoint(oi);

    // autossalvamento (só em estado estável)
    this.autoSaveT += dt;
    if (this.autoSaveT > 90 && g.player.grounded && !g.driving && !this.dead && !this.won) { this.autoSaveT = 0; this.persist(false); }

    // frio da noite: geada no visor, zumbido do aquecedor e aviso uma vez por noite
    const T = this.lastOut?.outsideT ?? -40;
    const cold = THREE.MathUtils.smoothstep(-T, 55, 78);
    g.visorFrost = THREE.MathUtils.damp(g.visorFrost, this.inHab || g.driving ? 0 : cold, 0.25, dt);
    if (T < -68 && !this.inHab && !g.driving && this.coldWarnSol !== Math.floor(st.sol + 0.3)) { this.coldWarnSol = Math.floor(st.sol + 0.3); this.hud.toast(t('ev_cold', { t: Math.round(T) }), 'warn'); }
    sfx.update(dt, { tau: st.tau, exertion: Math.min(1, g.player.horizontalSpeed() / 3.4 + (this.holdT > 0 ? 0.3 : 0)), o2Frac: st.suit.o2 / BAL.suitO2Cap, inHelmet: !this.inHab && !g.driving, roverSpeed: g.rover.speed, driving: g.driving, paused: g.paused, night: g.night, cold: this.inHab ? 0 : cold, inside: this.inHab });
    this.hudT += dt;
    if (this.hudT > 0.1) {
      // botões de toque contextuais: 🚙 só perto do rover, 🔧 some ao dirigir
      const nearRover = g.driving || g.player.pos.distanceTo(g.rover.pos) < 14;
      document.getElementById('tb-car')?.classList.toggle('gone', !nearRover);
      document.getElementById('tb-build')?.classList.toggle('gone', g.driving); this.hud.update(st, OBJECTIVES[oi].key, this.hudT); this.hud.setRover(g.driving, g.rover.speed, g.rover.battery, g.rover.batteryCap); this.hudT = 0; }
  }

  speak(key: Key) {
    sfx.radio();
    this.hud.say(key);
    this.voice.play(key);
  }

  private onEvent(e: string) {
    switch (e) {
      case 'o2_low': sfx.alarm(1); this.speak('vo_o2_low'); break;
      case 'o2_crit': sfx.alarm(2); this.speak('vo_o2_crit'); break;
      case 'batt_low': sfx.alarm(1); this.speak('vo_batt_low'); break;
      case 'o2_empty': sfx.alarm(2); this.hud.toast(t('ev_o2_empty'), 'warn'); break;
      case 'batt_empty': sfx.alarm(2); this.hud.toast(t('ev_batt_empty'), 'warn'); break;
      case 'health_low': sfx.alarm(2); this.hud.say('ev_health_low', 6); break;
      case 'hab_o2_low': case 'hab_water_low': case 'hab_food_low': case 'hab_power_low':
        sfx.alarm(1); sfx.radio(); this.hud.say(`ev_${e}` as Key, 7); break;
      case 'storm_start': this.speak('vo_storm'); break;
      case 'storm_end': this.speak('vo_storm_end'); break;
      case 'dead': this.die(); break;
      case 'win': this.win(); break;
    }
  }

  // ------------------------------------------------ rover
  private flipT = 0;
  private handleVehicle(dt: number) {
    const g = this.game, input = g.input, st = this.st, r = g.rover;
    // recarga perto do habitat (cabo umbilical automático)
    const hab = this.world.habitat(st);
    if (hab && Math.hypot(r.pos.x - hab.x, r.pos.z - hab.z) < 16 && r.battery < r.batteryCap && st.hab.batt > 4) {
      const kwh = Math.min(r.batteryCap - r.battery, (2 * dt) / 3600 * 60, st.hab.batt - 4);
      r.battery += kwh; st.hab.batt -= kwh;
    }
    if (input.consume('vehicle')) {
      const res = g.toggleVehicle();
      if (res === 'far') this.hud.toast(t('rover_far'), 'info');
      if (res === 'blocked') this.hud.toast(t('rover_fast'), 'warn');
      if (res === 'enter' && r.battery <= 0.01) this.hud.toast(t('rover_empty'), 'warn');
    }
    if (g.driving) {
      if (r.isFlipped() && Math.abs(r.speed) < 0.5) {
        this.flipT += dt;
        this.hud.showPrompt(t('rover_flip'), Math.min(1, this.flipT / 2), true);
        if (this.flipT > 2 && input.isHeld('interact')) { r.reset(r.pos.x, r.pos.z, r.yaw()); this.flipT = 0; }
      } else { this.flipT = 0; this.hud.showPrompt(null); }
      input.consume('interact');
    } else if (g.player.pos.distanceTo(r.pos) < 5.4) {
      this.hud.showPrompt(`${t('act_rover')}${g.input.touchMode ? ' 🚙' : ' (F)'}`, 0, false);
      this.roverPromptShown = true;
    } else if (this.roverPromptShown) { this.roverPromptShown = false; this.hud.showPrompt(null); }
  }
  private roverPromptShown = false;

  // ------------------------------------------------ interação (segurar E)
  private handleInteraction(dt: number) {
    const g = this.game, st = this.st, input = g.input;
    if (this.world.ghost) { this.hud.showPrompt(null); return; }
    const fwd = new THREE.Vector3(-Math.sin(g.player.yaw), 0, -Math.cos(g.player.yaw));
    const target = this.world.nearest(st, g.player.pos, fwd);
    if (!target) { if (!this.roverPromptShown) this.hud.showPrompt(null); this.holdT = 0; input.consume('interact'); return; }
    const need = HOLD[target.kind] ?? 1;
    let label = t(target.label as Key);
    if (target.kind === 'antenna') label += ` — ${t('need')}: ${ANTENNA_COST.scrap}× ${t('it_scrap')}, ${ANTENNA_COST.electronics}× ${t('it_electronics')}, ${ANTENNA_KWH} kWh`;
    const holding = input.isHeld('interact');
    const pressed = input.consume('interact');
    if (need === 0) {
      this.hud.showPrompt(label, 0, false);
      if (pressed) this.activate(target);
      return;
    }
    if (holding) {
      if (this.holdId !== target.id) { this.holdId = target.id; this.holdT = 0; }
      this.holdT += dt;
      if (this.holdT >= need) { this.holdT = 0; this.activate(target); input.setHeld('interact', false); }
    } else this.holdT = 0;
    this.hud.showPrompt(label, this.holdT / need, true);
  }

  private give(items: Partial<Record<ItemId, number>>) {
    const got: string[] = [];
    for (const [k, v] of Object.entries(items)) {
      this.st.inv[k as ItemId] += v as number;
      got.push(`+${v}${k === 'gypsum' ? ' kg' : ''} ${t(`it_${k}` as Key)}`);
    }
    if (got.length) { this.hud.toast(got.join(' · '), 'ok'); sfx.pickup(); }
  }

  private activate(l: LootPoint) {
    const st = this.st;
    switch (l.kind) {
      case 'crate':
      case 'wreck':
      case 'gypsum':
        this.give(l.give);
        this.world.markUsed(st, l);
        break;
      case 'door':
        this.enterHab();
        break;
      case 'panel_clean': {
        const id = Number(l.id.replace('clean', ''));
        const b = st.buildings.find((x) => x.id === id);
        if (b) b.dust = 0;
        this.hud.toast('✓', 'ok');
        break;
      }
      case 'antenna': {
        if (st.objective < OBJECTIVES.findIndex((o) => o.key === 'obj_antenna')) { this.hud.toast(t('antenna_locked'), 'warn'); break; }
        const ok = Object.entries(ANTENNA_COST).every(([k, v]) => st.inv[k as ItemId] >= (v as number));
        if (!ok) { this.hud.toast(t('not_enough'), 'warn'); break; }
        if (st.hab.batt < ANTENNA_KWH) { this.hud.toast(t('no_power'), 'warn'); break; }
        for (const [k, v] of Object.entries(ANTENNA_COST)) st.inv[k as ItemId] -= v as number;
        st.hab.batt -= ANTENNA_KWH;
        st.antennaFixedSol = st.sol;
        this.speak('vo_rescue');
        this.persist();
        break;
      }
    }
  }

  // ------------------------------------------------ construção
  private handleBuild() {
    const g = this.game, input = g.input, st = this.st;
    if (input.consume('build')) { if (this.buildMode) this.exitBuild(); else this.enterBuild(); return; }
    if (!this.buildMode) return;
    if (input.consume('weapon')) this.cycleBuild(1);
    if (input.consume('rotate')) this.rotateGhost();
    if (!this.world.ghost) { this.hud.showPrompt(t('build_pick'), 0, false); input.consume('interact'); input.consume('fire'); return; }
    this.world.updateGhost(st, g.player.pos, g.player.yaw);
    this.hud.showPrompt(this.world.ghostValid ? t(g.input.touchMode ? 'build_hint_touch' : 'build_hint') : t((this.world.ghostReason || 'build_invalid') as Key), 0, false);
    if (input.consume('interact') || input.consume('fire')) this.placeBuild();
  }
  private buildMode = false;
  private buildSel: BuildId | null = null;
  private thumbs: Record<string, string> | null = null;
  private availableBuilds() {
    const hasHab = !!this.world.habitat(this.st);
    return BUILD_ORDER.filter((b) => (b === 'habitat') !== hasHab);
  }
  private enterBuild() {
    const g = this.game;
    if (!this.thumbs) this.thumbs = makeThumbs(g.renderer, Object.fromEntries(BUILD_ORDER.map((b) => [b, () => BUILDERS[b](this.world.mats)])));
    this.buildMode = true;
    const av = this.availableBuilds();
    if (!this.buildSel || !av.includes(this.buildSel)) this.buildSel = av.find((b) => this.world.canAfford(this.st, b)) ?? av[0] ?? null;
    this.world.ghostRot = 0;
    if (this.buildSel) this.world.startGhost(this.buildSel);
    this.refreshBuildUi();
    sfx.click();
  }
  private refreshBuildUi() {
    this.hud.openBuild(this.st, (b) => this.world.canAfford(this.st, b), this.thumbs ?? {}, this.buildSel, this.game.input.touchMode);
  }
  exitBuild() {
    this.buildMode = false;
    this.world.cancelGhost();
    this.hud.closeBuild();
    this.hud.showPrompt(null);
  }
  private pickBuild(b: BuildId) {
    if (!this.buildMode) { this.buildSel = b; this.enterBuild(); return; }
    this.buildSel = b;
    this.world.startGhost(b);
    sfx.click();
    this.refreshBuildUi();
  }
  private cycleBuild(dir: number) {
    const av = this.availableBuilds();
    if (!av.length) return;
    const i = this.buildSel ? av.indexOf(this.buildSel) : -1;
    this.pickBuild(av[(i + dir + av.length) % av.length]);
  }
  private rotateGhost() { this.world.ghostRot += Math.PI / 4; sfx.click(); }
  private placeBuild() {
    const g = this.game, st = this.st;
    const pos = this.world.ghost?.position.clone();
    const b = this.world.placeGhost(st);
    if (b) {
      this.hud.toast(`✓ ${t(`b_${b.type}` as Key)}`, 'ok');
      sfx.build();
      if (pos) this.combat.vfx.burst(pos.setY(pos.y + 0.2), 30, 'dust');
      // continua construindo: mantém o tipo se ainda der para pagar
      const av = this.availableBuilds();
      // nada mais pagável: sai do modo construção sozinho (evita ficar "preso" sem perceber)
      if (!av.some((x) => this.world.canAfford(st, x))) { this.exitBuild(); return; }
      if (!av.includes(b.type) || !this.world.canAfford(st, b.type)) this.buildSel = av.find((x) => this.world.canAfford(st, x)) ?? av[0] ?? null;
      if (this.buildSel) this.world.startGhost(this.buildSel);
      this.refreshBuildUi();
    } else { this.hud.toast(t((this.world.ghostReason || 'build_invalid') as Key), 'warn'); sfx.alarm(1); }
    void g;
  }
  closeBuildMenu() { this.exitBuild(); }

  // ------------------------------------------------ habitat
  private enterHab() {
    const g = this.game;
    this.inHab = true;
    sfx.door();
    this.st.flags.enteredHab = true;
    this.hud.showPrompt(null);
    // entra andando no interior do habitat
    g.setInterior(true);
    const I = g.interior;
    g.player.teleport(I.spawn.x, I.spawn.z, 0, I.spawn.y);
    g.player.yaw = I.spawnYaw;
    g.player.pitch = -0.05;
    g.player.camDist = Math.min(g.player.camDist, 2.4);
    g.input.clearPressed();
    if (this.st.inv.gypsum > 0) { this.st.hab.gypsum += this.st.inv.gypsum; this.st.inv.gypsum = 0; this.hud.toast(t('hab_deposit'), 'info'); }
    this.persist(true);
    this.hud.toast(t('int_welcome'), 'info');
  }
  refreshHab() { this.hud.openHab(this.st, this.lastOut?.habGenW ?? 0, this.lastOut?.habLoadW ?? 0); }
  /** painel de status do console (dentro do habitat) */
  private openConsole() {
    const g = this.game;
    g.input.enabled = false;
    if (document.pointerLockElement) document.exitPointerLock();
    this.refreshHab();
  }
  private closeConsole() {
    this.hud.closeHab();
    this.game.input.enabled = true;
    this.game.input.clearPressed();
    this.game.input.requestLock();
  }
  private exitHab() {
    const g = this.game;
    this.hud.closeHab();
    this.inHab = false;
    sfx.door();
    g.setInterior(false);
    g.player.frozen = false;
    g.astro.root.visible = true;
    const door = this.world.doorPos(this.st);
    if (door) { g.player.teleport(door.x, door.z, 0.3); const h = this.world.habitat(this.st)!; g.player.yaw = h.rot + Math.PI; }
    g.input.enabled = true;
    g.input.clearPressed();
    g.input.requestLock();
  }
  /** interações dentro do habitat */
  private handleInterior(dt: number) {
    const g = this.game, st = this.st, input = g.input;
    const I = g.interior;
    const out = this.lastOut;
    I.update(dt, { o2: st.hab.o2, o2Sols: st.hab.o2 / BAL.habO2PerSol, water: st.hab.water, food: st.hab.food, batt: st.hab.batt, battCap: st.hab.battCap, gen: out?.habGenW ?? 0, load: out?.habLoadW ?? 0, sol: st.sol, ltst: g.sky0.ltstHours, outT: out?.outsideT ?? -60 });
    if (input.consume('build')) this.hud.toast(t('int_nobuild'), 'info');
    input.consume('vehicle');
    if (!input.enabled) return;
    const fwd = new THREE.Vector3(-Math.sin(g.player.yaw), 0, -Math.cos(g.player.yaw));
    const spot = I.nearest(g.player.pos, fwd);
    if (!spot) { this.hud.showPrompt(null); input.consume('interact'); return; }
    this.hud.showPrompt(t(spot.label as Key), 0, false);
    if (!input.consume('interact')) return;
    switch (spot.action) {
      case 'exit': this.exitHab(); break;
      case 'console': this.openConsole(); break;
      case 'sleep': this.hud.showPrompt(null); this.sleep(); break;
      case 'food':
        if (st.hab.food >= 0.25 && st.suit.health < 100) { st.hab.food -= 0.25; st.suit.health = Math.min(100, st.suit.health + 15); this.hud.toast(t('int_ate'), 'ok'); sfx.pickup(); }
        else this.hud.toast(t('int_food_info', { n: st.hab.food.toFixed(1) }), 'info');
        break;
      case 'plants': this.hud.toast(t(st.buildings.some((b) => b.type === 'bioreactor') ? 'int_plants_ok' : 'int_plants_wait'), 'info'); break;
      case 'bench': g.input.enabled = false; if (document.pointerLockElement) document.exitPointerLock(); this.hud.showPrompt(null); this.hud.openArmory(st); break;
    }
  }
  // ------------------------------------------------ combate
  private playerHurt(dmg: number) {
    const st = this.st;
    if (this.dead || this.inHab) return;
    st.suit.health = Math.max(0, st.suit.health - dmg);
    this.hud.hurtFlash(dmg);
    sfx.hurt();
    this.game.shake = Math.min(0.15, this.game.shake + 0.1);
    if (st.suit.health <= 0) this.die();
  }
  private pay(cost: Partial<Record<ItemId, number>>) {
    const inv = this.st.inv as Record<string, number>;
    if (!Object.entries(cost).every(([k, v]) => inv[k] >= (v as number))) { sfx.click(); return false; }
    for (const [k, v] of Object.entries(cost)) inv[k] -= v as number;
    return true;
  }
  private craftWeapon(w: WeaponId) {
    const W = this.st.weapons;
    if (W.owned.includes(w) || !this.pay(WEAPONS[w].craft ?? {})) return;
    W.owned.push(w); W.eq = w;
    sfx.craft();
    this.hud.toast(t('crafted', { w: t(`w_${w}` as Key) }), 'ok');
    this.persist(false);
    if (this.hud.armoryOpen) this.hud.openArmory(this.st);
  }
  private upgradeWeapon(w: WeaponId, u: UpgradeId) {
    const l = this.st.weapons.lvl[w];
    if (l[u] >= UPG_MAX || !this.pay(upgradeCost(l[u]))) return;
    l[u]++;
    sfx.craft();
    this.hud.toast(t('upgraded'), 'ok');
    this.persist(false);
    if (this.hud.armoryOpen) this.hud.openArmory(this.st);
  }

  private sleep() {
    // dorme até as 07:00 do próximo sol simulando em passos de 15 min
    const g = this.game, st = this.st;
    const h = g.sky0.ltstHours;
    const hours = h < 7 ? 7 - h : 24 - h + 7;
    const steps = Math.ceil(hours / 0.25);
    for (let i = 0; i < steps; i++) {
      g.sol += 0.25 / 24;
      st.sol = g.sol;
      g.updateSky(0);
      const out = simulate(st, 0.25 * 1.0275, { inHabitat: true, working: false, lampOn: false, ltst: g.sky0.ltstHours, sunSinAlt: Math.sin(g.sky0.sunAlt), solarConst: g.sky0.solarConst });
      this.lastOut = out;
      if (out.events.includes('dead')) { this.die(); return; }
      if (out.events.includes('win')) { this.win(); return; }
    }
    g.tau = st.tau;
    g.updateEnv(true); g.measureSky(); g.updateSky(0);
    this.persist(true);
    this.hud.toast(t('int_woke'), 'ok');
  }

  // ------------------------------------------------ fim de jogo
  private die() {
    if (this.dead) return;
    this.dead = true;
    this.speak('vo_dead');
    this.game.player.frozen = true;
    this.game.input.enabled = false;
    this.game.input.move.x = this.game.input.move.y = 0;
    this.exitBuild(); this.hud.toggleMap(false);
    if (document.pointerLockElement) document.exitPointerLock();
    this.hud.closeHab();
    this.inHab = false;
    this.game.setInterior(false);
    this.hud.showEnd(false, Math.floor(this.st.sol));
  }
  private win() {
    this.won = true;
    this.speak('vo_win');
    this.persist(false);
    this.game.input.enabled = false;
    if (document.pointerLockElement) document.exitPointerLock();
    this.hud.showEnd(true, Math.floor(this.st.sol), this.st.stats);
  }
  private respawn() {
    this.respawnFrom(null);
  }
  private respawnFrom(loaded: GameState | null) {
    const saved = loaded ?? load();
    const deaths = this.st.stats.deaths + 1;
    const st = saved ?? newState(this.st.difficulty);
    st.stats.deaths = deaths;
    if (st.difficulty === 'hard') { this.begin(newState('hard')); return; }
    // renasce na eclusa com o traje recarregado a partir da base (se houver)
    const door = this.world.doorPos(st);
    if (door) { st.player.x = door.x; st.player.z = door.z; }
    this.dead = false;
    st.suit.health = Math.max(st.suit.health, 60);
    st.suit.o2 = Math.max(st.suit.o2, BAL.suitO2Cap * 0.5);
    st.suit.batt = Math.max(st.suit.batt, BAL.suitBattCap * 0.5);
    this.game.input.enabled = true;
    this.begin(st);
    this.game.input.requestLock();
  }

  // ------------------------------------------------ marcadores
  objWorld(): ObjWorld {
    const w = this.world;
    const c0 = w.loot.find((l) => l.id === 'crate0')!.pos;
    const door = w.doorPos(this.st);
    return {
      crate0: { x: c0.x, z: c0.z },
      door: door ? { x: door.x, z: door.z } : null,
      site: (id) => { const s = w.sites.find((x) => x.id === id)!; return { x: s.pos.x, z: s.pos.z }; },
      antenna: { x: w.antennaPos.x, z: w.antennaPos.z },
    };
  }

  private updateWaypoint(oi: number) {
    const o = OBJECTIVES[oi];
    // objetivos sem alvo próprio (construções) apontam de volta para a base
    const ow = this.objWorld();
    const tgt = o.target?.(this.st, ow) ?? (this.st.objective > 1 ? ow.door : null);
    const g = this.game;
    if (!tgt || this.inHab || this.dead) { this.hud.setWaypoint(null); return; }
    const p = new THREE.Vector3(tgt.x, g.terrain.heightAt(tgt.x, tgt.z) + 2.2, tgt.z);
    const dist = Math.hypot(p.x - g.player.pos.x, p.z - g.player.pos.z);
    if (dist < 3) { this.hud.setWaypoint(null); return; }
    const v = p.clone().project(g.camera);
    const { w: W, h: H } = viewSize();
    let x = (v.x * 0.5 + 0.5) * W, y = (-v.y * 0.5 + 0.5) * H;
    const behind = v.z > 1;
    if (behind) { x = W - x; y = H - 40; }
    x = Math.max(40, Math.min(W - 40, x));
    y = Math.max(70, Math.min(H - 60, y));
    // no toque, não deixa o marcador cair em cima dos botões (canto inferior direito / joystick)
    if (this.game.input.touchMode) {
      if (x > W - 270 && y > H - 230) y = H - 230;
      if (x < 240 && y > H - 190) y = H - 190;
    }
    this.hud.setWaypoint(x, y, dist);
  }

  private drawMap() {
    const w = this.world, st = this.st, g = this.game;
    const markers: { x: number; z: number; color: string; label: string; big?: boolean }[] = [];
    for (const s of w.sites) markers.push({ x: s.pos.x, z: s.pos.z, color: s.id === 'gypsum' ? '#f3ead8' : '#ffcf8a', label: t(s.name as Key) });
    const hab = w.habitat(st);
    if (hab) markers.push({ x: hab.x, z: hab.z, color: '#7ee0a0', label: t('b_habitat'), big: true });
    const tgt = OBJECTIVES[st.objective].target?.(st, this.objWorld());
    if (tgt) markers.push({ x: tgt.x, z: tgt.z, color: '#ff8a3d', label: '◎', big: true });
    this.hud.drawMap(markers, { x: g.player.pos.x, z: g.player.pos.z, yaw: g.player.yaw }, WORLD.size);
  }
}
