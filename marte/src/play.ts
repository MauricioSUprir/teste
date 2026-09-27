// Controlador de jogo: liga simulação de sobrevivência, interação, construção, objetivos e HUD ao motor.
import * as THREE from 'three';
import type { Game } from './game';
import { Hud } from './ui/hud';
import { WorldSim, type LootPoint } from './sim/world';
import { newState, save, load, type GameState } from './sim/state';
import { simulate, type SimOut } from './sim/survival';
import { BAL, ANTENNA_COST, ANTENNA_KWH, type BuildId, type ItemId } from './sim/balance';
import { OBJECTIVES, type ObjWorld } from './sim/objectives';
import { t, type Key } from './core/i18n';
import { WORLD } from './world/config';
import { Voice } from './audio/voice';
import { sfx } from './audio/sfx';

const HOLD: Record<string, number> = { crate: 1.2, wreck: 2.0, gypsum: 2.6, antenna: 4.0, door: 0, panel_clean: 2.0 };

export class Play {
  st: GameState = newState();
  world: WorldSim;
  hud: Hud;
  voice = new Voice();
  inHab = false;
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
    this.world = new WorldSim(game.crash.mats, game.terrain, game.physics, game.crash.crates, game.crash.landerPos);
    game.scene.add(this.world.group);
    this.hud = new Hud(document.getElementById('hud')!);
    this.hud.buildMap(game.terrain.heights, WORLD.res);
    this.hud.onBuildPick = (b) => this.pickBuild(b);
    this.hud.onBuildClose = () => this.closeBuildMenu();
    this.hud.onSleep = () => this.sleep();
    this.hud.onExit = () => this.exitHab();
    this.hud.onRespawn = () => this.respawn();
    this.hud.onMenu = () => { this.hud.hideEnd(); this.onQuitToMenu?.(); };
  }

  // ------------------------------------------------ ciclo de vida
  begin(st: GameState) {
    this.st = st;
    this.dead = false;
    this.won = !!st.flags.won;
    this.inHab = false;
    this.hud.closeHab(); this.hud.closeBuild(); this.hud.hideEnd(); this.hud.toggleMap(false);
    this.world.cancelGhost();
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
    if (this.won) this.hud.showEnd(true, Math.floor(st.sol));
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
    const pp = g.driving ? g.rover.driverDoor() : g.player.pos;
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

    if (!this.inHab && !this.dead && !this.won) {
      this.handleVehicle(dt);
      if (!g.driving) { this.handleInteraction(dt); this.handleBuild(); }
    }
    if (input.consume('map')) this.hud.toggleMap();
    if (this.hud.mapOpen) this.drawMap();

    // objetivos
    // objetivos nunca regridem: avança a partir do atual
    let oi = st.objective;
    while (oi < OBJECTIVES.length - 1 && OBJECTIVES[oi].done(st)) oi++;
    if (oi !== st.objective) {
      if (oi > st.objective) this.hud.toast(`✓ ${t('obj_done')}`, 'ok');
      st.objective = oi;
    }
    if (this.objAnnounced !== oi) { this.objAnnounced = oi; this.speak(OBJECTIVES[oi].voice); }
    this.updateWaypoint(oi);

    // autossalvamento (só em estado estável)
    this.autoSaveT += dt;
    if (this.autoSaveT > 90 && g.player.grounded && !g.driving && !this.dead && !this.won) { this.autoSaveT = 0; this.persist(false); }

    sfx.update(dt, { tau: st.tau, exertion: Math.min(1, g.player.horizontalSpeed() / 3.4 + (this.holdT > 0 ? 0.3 : 0)), o2Frac: st.suit.o2 / BAL.suitO2Cap, inHelmet: !this.inHab && !g.driving, roverSpeed: g.rover.speed, driving: g.driving, paused: g.paused });
    this.hudT += dt;
    if (this.hudT > 0.1) { this.hud.update(st, OBJECTIVES[oi].key, this.hudT); this.hud.setRover(g.driving, g.rover.speed, g.rover.battery, g.rover.batteryCap); this.hudT = 0; }
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
    } else if (g.player.pos.distanceTo(r.pos) < 4.2) {
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
    if (input.consume('build')) {
      if (this.world.ghost) { this.world.cancelGhost(); return; }
      if (this.hud.buildOpen) { this.closeBuildMenu(); return; }
      g.input.enabled = false;
      if (document.pointerLockElement) document.exitPointerLock();
      this.hud.openBuild(st, (b) => this.world.canAfford(st, b));
      return;
    }
    if (this.world.ghost) {
      this.world.updateGhost(st, g.player.pos, g.player.yaw);
      this.hud.showPrompt(this.world.ghostValid ? t('build_hint') : t('build_invalid'), 0, false);
      if (input.consume('interact')) {
        const b = this.world.placeGhost(st);
        if (b) { this.hud.toast(`✓ ${t(`b_${b.type}` as Key)}`, 'ok'); sfx.build(); }
        else this.hud.toast(t('build_invalid'), 'warn');
      }
    }
  }
  private pickBuild(b: BuildId) {
    this.closeBuildMenu();
    this.world.startGhost(b);
  }
  closeBuildMenu() {
    this.hud.closeBuild();
    this.game.input.enabled = true;
    this.game.input.requestLock();
  }

  // ------------------------------------------------ habitat
  private enterHab() {
    const g = this.game;
    this.inHab = true;
    sfx.door();
    this.st.flags.enteredHab = true;
    g.player.frozen = true;
    g.astro.root.visible = false;
    g.input.enabled = false;
    if (document.pointerLockElement) document.exitPointerLock();
    if (this.st.inv.gypsum > 0) { this.st.hab.gypsum += this.st.inv.gypsum; this.st.inv.gypsum = 0; this.hud.toast(t('hab_deposit'), 'info'); }
    this.persist(true);
    this.refreshHab();
  }
  refreshHab() { this.hud.openHab(this.st, this.lastOut?.habGenW ?? 0, this.lastOut?.habLoadW ?? 0); }
  private exitHab() {
    const g = this.game;
    this.inHab = false;
    sfx.door();
    this.hud.closeHab();
    g.player.frozen = false;
    g.astro.root.visible = true;
    const door = this.world.doorPos(this.st);
    if (door) { g.player.teleport(door.x, door.z, 0.3); const h = this.world.habitat(this.st)!; g.player.yaw = h.rot + Math.PI; }
    g.input.enabled = true;
    g.input.requestLock();
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
    this.refreshHab();
  }

  // ------------------------------------------------ fim de jogo
  private die() {
    if (this.dead) return;
    this.dead = true;
    this.speak('vo_dead');
    this.game.player.frozen = true;
    this.game.input.enabled = false;
    this.game.input.move.x = this.game.input.move.y = 0;
    this.hud.closeBuild(); this.hud.toggleMap(false); this.world.cancelGhost();
    if (document.pointerLockElement) document.exitPointerLock();
    this.hud.closeHab();
    this.hud.showEnd(false, Math.floor(this.st.sol));
  }
  private win() {
    this.won = true;
    this.speak('vo_win');
    this.persist(false);
    this.game.input.enabled = false;
    if (document.pointerLockElement) document.exitPointerLock();
    this.hud.showEnd(true, Math.floor(this.st.sol));
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
    const tgt = o.target?.(this.st, this.objWorld()) ?? null;
    const g = this.game;
    if (!tgt || this.inHab || this.dead) { this.hud.setWaypoint(null); return; }
    const p = new THREE.Vector3(tgt.x, g.terrain.heightAt(tgt.x, tgt.z) + 2.2, tgt.z);
    const dist = Math.hypot(p.x - g.player.pos.x, p.z - g.player.pos.z);
    if (dist < 3) { this.hud.setWaypoint(null); return; }
    const v = p.clone().project(g.camera);
    const W = innerWidth, H = innerHeight;
    let x = (v.x * 0.5 + 0.5) * W, y = (-v.y * 0.5 + 0.5) * H;
    const behind = v.z > 1;
    if (behind) { x = W - x; y = H - 40; }
    x = Math.max(40, Math.min(W - 40, x));
    y = Math.max(70, Math.min(H - 60, y));
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
