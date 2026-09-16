/**
 * The match client.
 *
 * Owns one round: a fixed-step simulation, the visual world, and the glue that
 * turns simulation events into things you can see and hear. The simulation here
 * is the *same class* the authoritative server runs, so switching from offline
 * play to networked play later is a matter of where the inputs come from, not a
 * rewrite of the game.
 */
import * as THREE from 'three';
import { MatchSim, RoundPhase } from '../shared/world';
import { MapDef } from '../shared/mapdef';
import { makeRules, RuleSet, TICK_DT } from '../shared/config';
import { InputCmd, makeInput, MoveState, SimEventKind, PlayerSim, Btn } from '../shared/types';
import { BotBrain, makeBotRoster, BotDifficulty } from '../shared/bots';
import { SceneRig } from '../render/scene';
import { MapRenderer } from '../render/mapBuilder';
import { VFX } from '../render/vfx';
import { CharacterBatch } from '../render/characterBatch';
import { SKIN_COLORS } from '../render/palette';
import { PlayerView } from './playerView';
import { CameraController } from './camera';
import { InputManager } from './input';
import { Hud, fmtTime } from '../ui/hud';
import { audio } from '../audio/audio';
import { t } from '../ui/i18n';
import { clamp, damp, Rng, hashString } from '../shared/math';
import { Surface } from '../shared/collision';

export interface MatchOptions {
  map: MapDef;
  seed: number;
  botCount: number;
  botDifficulty: BotDifficulty;
  rules?: Partial<RuleSet>;
  variantId?: string;
  /** Practice mode: no bots, instant restart, timer shown. */
  practice?: boolean;
  playerName: string;
  playerLook: { skin: number; accent: number };
  showTimer?: boolean;
  personalBest?: number;
}

export interface MatchResult {
  position: number;
  total: number;
  qualified: boolean;
  time: number;
  falls: number;
  variantId: string;
  mapId: string;
  newRecord: boolean;
}

const SURFACE_COLORS: Record<number, number> = {
  [Surface.Metal]: 0xd6dced,
  [Surface.Rubber]: 0xffb08a,
  [Surface.Glass]: 0xbfe9ff,
  [Surface.Grate]: 0xc3cddf,
  [Surface.Slime]: 0xa8ff9e,
  [Surface.Conveyor]: 0x9fe6d6,
  [Surface.Padded]: 0xffd7e0,
};

export class MatchClient {
  readonly sim: MatchSim;
  private mapRenderer: MapRenderer;
  views = new Map<number, PlayerView>();
  batch = new CharacterBatch(40);
  private brains = new Map<number, BotBrain>();
  private localId = 1;
  private cmd: InputCmd = makeInput();
  private accumulator = 0;
  private cmdSeq = 0;
  private hud: Hud;
  private nightAmount = 0;
  private targetNight = 0;
  private finished = false;
  private result: MatchResult | null = null;
  private runClock = 0;
  private opts: MatchOptions;
  private rng: Rng;
  private lastBannerPhase = '';
  private spectateIndex = -1;
  private spectating = false;
  private localFinishTime = 0;
  onFinished?: (r: MatchResult) => void;

  constructor(
    private rig: SceneRig,
    private vfx: VFX,
    private camera: CameraController,
    private input: InputManager,
    hudParent: HTMLElement,
    opts: MatchOptions,
  ) {
    this.opts = opts;
    this.rng = new Rng(hashString(`${opts.map.id}:${opts.seed}`));
    this.sim = new MatchSim({
      map: opts.map,
      rules: makeRules(opts.rules),
      seed: opts.seed,
      variantId: opts.variantId,
      countdownTime: opts.practice ? 1.2 : 3.4,
    });

    // Local player first so they get the front-centre spawn slot.
    const me = this.sim.addPlayer(this.localId, opts.playerName);
    this.addView(me, opts.playerLook.skin, opts.playerLook.accent, true);

    if (!opts.practice) {
      const roster = makeBotRoster(opts.botCount, opts.seed, opts.botDifficulty);
      roster.forEach((r, i) => {
        const id = i + 2;
        const p = this.sim.addPlayer(id, r.name, { isBot: true });
        this.brains.set(id, new BotBrain(id, r.difficulty, r.personality, opts.seed + id * 31));
        const skin = SKIN_COLORS[(i + 3) % SKIN_COLORS.length];
        const accent = SKIN_COLORS[(i + 7) % SKIN_COLORS.length];
        this.addView(p, skin, accent, false);
      });
    }

    this.rig.scene.add(this.batch.root);
    this.mapRenderer = new MapRenderer(opts.map, this.sim);
    this.rig.scene.add(this.mapRenderer.root);
    this.rig.applyAmbient(opts.map.ambient);

    this.hud = new Hud(hudParent);
    this.camera.setFollow();
    this.camera.snapBehind(me.pos.x, me.pos.y, me.pos.z);

    audio.startMusic(0);
    audio.setIntensity(0.3);
  }

  private addView(p: PlayerSim, skin: number, accent: number, local: boolean): void {
    const view = new PlayerView(p, { skin, accent });
    view.isLocal = local;
    view.onFootstep = (x, y, z, surface) => {
      audio.play('step', { x, y, z, power: local ? 1 : 0.55, pitch: 0.9 + this.rng.next() * 0.25 });
      this.vfx.emit('dust', x, y + 0.05, z, 2, SURFACE_COLORS[surface] ?? 0xd6dced);
    };
    this.views.set(p.id, view);
    // The rig joins the scene graph for transforms; its geometry is drawn by
    // the instanced batch, not by the rig itself.
    this.rig.scene.add(view.wobbler.root);
    this.batch.add(view.wobbler);
  }

  get localPlayer(): PlayerSim | undefined { return this.sim.byId.get(this.localId); }

  /** Advances simulation and visuals. `dt` is real elapsed seconds. */
  update(dt: number): void {
    const clamped = Math.min(dt, 0.25);
    this.accumulator += clamped;

    let steps = 0;
    while (this.accumulator >= TICK_DT && steps < 5) {
      this.accumulator -= TICK_DT;
      this.simStep();
      steps++;
    }
    // If we fell badly behind, drop the backlog rather than spiral.
    if (this.accumulator > TICK_DT * 5) this.accumulator = 0;

    const alpha = clamp(this.accumulator / TICK_DT, 0, 1);
    this.renderStep(clamped, alpha);
  }

  private simStep(): void {
    const inputs = new Map<number, InputCmd>();

    const me = this.localPlayer;
    if (me) {
      const intent = this.input.poll();
      this.cmd.seq = ++this.cmdSeq;
      this.cmd.tick = this.sim.tick;
      this.cmd.moveX = intent.moveX;
      this.cmd.moveZ = intent.moveZ;
      this.cmd.camYaw = this.camera.getYaw();
      this.cmd.buttons = intent.buttons;
      inputs.set(this.localId, this.cmd);
    }

    for (const [id, brain] of this.brains) {
      const p = this.sim.byId.get(id);
      if (p) inputs.set(id, brain.update(this.sim, p, TICK_DT));
    }

    this.sim.step(inputs);
    this.consumeEvents();

    for (const [id, view] of this.views) {
      const p = this.sim.byId.get(id);
      if (p) view.pushState(p);
    }

    if (this.sim.phase === RoundPhase.Running) this.runClock += TICK_DT;
    this.checkRoundEnd();
  }

  private consumeEvents(): void {
    const me = this.localPlayer;
    for (const e of this.sim.events) {
      const local = e.playerId === this.localId;
      switch (e.kind) {
        case SimEventKind.Jump:
          audio.play('jump', { x: e.x, y: e.y, z: e.z, power: local ? 1 : 0.6 });
          this.vfx.emit('dust', e.x, e.y + 0.05, e.z, 4, 0xe8ecf4);
          break;
        case SimEventKind.Land: {
          const hard = e.value > 13;
          audio.play(hard ? 'landHard' : 'land', {
            x: e.x, y: e.y, z: e.z, power: clamp(e.value / 12, 0.3, 1.6),
          });
          this.vfx.emit('landPuff', e.x, e.y + 0.06, e.z,
            Math.round(clamp(e.value / 3, 3, 12)), SURFACE_COLORS[e.ref] ?? 0xd6dced,
            0, 1, 0, clamp(e.value / 10, 0.4, 1.6));
          if (local && hard) this.rig.addShake(clamp(e.value / 40, 0.08, 0.4));
          break;
        }
        case SimEventKind.Dive:
          audio.play('dive', { x: e.x, y: e.y, z: e.z, power: local ? 1 : 0.6 });
          this.vfx.emit('trail', e.x, e.y + 0.7, e.z, 6, 0xbfe9ff);
          break;
        case SimEventKind.DiveLand:
          audio.play('slide', { x: e.x, y: e.y, z: e.z });
          this.vfx.emit('landPuff', e.x, e.y + 0.06, e.z, 7, 0xd6dced);
          break;
        case SimEventKind.Impact:
          audio.play('impact', { x: e.x, y: e.y, z: e.z, power: clamp(e.value / 10, 0.3, 1.5) });
          this.vfx.emit('impact', e.x, e.y + 0.9, e.z, e.ref > 0 ? 9 : 5, 0xffd166,
            0, 1, 0, clamp(e.value / 10, 0.4, 1.4));
          if (local) this.rig.addShake(clamp(e.value / 26, 0.05, 0.45));
          break;
        case SimEventKind.Ragdoll:
          audio.play('ragdoll', { x: e.x, y: e.y, z: e.z });
          this.vfx.emit('impact', e.x, e.y + 0.9, e.z, 14, 0xff8a3d, 0, 1, 0, 1.4);
          if (local) this.rig.addShake(0.5);
          break;
        case SimEventKind.Bounce:
          audio.play('bounce', { x: e.x, y: e.y, z: e.z });
          this.vfx.emit('bounce', e.x, e.y + 0.2, e.z, 8, 0x5cf2c8);
          break;
        case SimEventKind.Checkpoint:
          this.vfx.emit('checkpoint', e.x, e.y + 0.6, e.z, 16, 0x5cf2c8);
          if (local) {
            audio.play('checkpoint', { power: 1 });
            this.hud.toast(t('round.checkpoint'), 'good');
          }
          break;
        case SimEventKind.Fall:
          if (local) {
            audio.play('whoosh');
            this.rig.addShake(0.2);
          }
          break;
        case SimEventKind.Respawn:
          this.vfx.emit('respawn', e.x, e.y + 0.8, e.z, 14, 0x9b7bff);
          if (local) this.camera.snapBehind(e.x, e.y, e.z);
          break;
        case SimEventKind.Finish: {
          this.vfx.emit('finish', e.x, e.y + 1, e.z, 26, 0xffd166);
          this.vfx.emit('confetti', e.x, e.y + 2.5, e.z, 26, 0x5cf2c8);
          if (local) {
            this.localFinishTime = e.value;
            audio.stinger('qualify');
            this.hud.showBanner(t('round.qualified'),
              e.tag === 'photo' ? t('round.photoFinish') : `${fmtTime(e.value)}`, 3.4);
            this.rig.addShake(0.25);
          } else if (e.tag === 'photo') {
            audio.play('confetti', { x: e.x, y: e.y, z: e.z });
          }
          break;
        }
        case SimEventKind.Eliminated:
          if (local) {
            audio.stinger('eliminated');
            this.hud.showBanner(t('round.eliminated'), '', 3);
          }
          break;
        case SimEventKind.AbilityUsed:
          // Director channel: ref -1 telegraph, ref -2 applied.
          if (e.ref === -1 && e.tag?.startsWith('telegraph:')) {
            const id = e.tag.slice('telegraph:'.length);
            this.onTelegraph(id, e.value);
          } else if (e.ref === -2 && e.tag?.startsWith('phase:')) {
            this.onPhaseApplied(e.tag.slice('phase:'.length), e.value);
          }
          break;
        default:
          break;
      }
    }
    this.sim.clearEvents();
    void me;
  }

  private onTelegraph(id: string, seconds: number): void {
    const ev = this.opts.map.phaseEvents.find((p) => p.id === id);
    if (!ev) return;
    this.hud.showBanner(t(ev.bannerKey), t(`${ev.bannerKey}.sub`), Math.max(2, seconds));
    audio.play('alarm');
    this.lastBannerPhase = id;
  }

  private onPhaseApplied(id: string, intensity: number): void {
    const ev = this.opts.map.phaseEvents.find((p) => p.id === id);
    this.rig.addShake(clamp(intensity, 0.1, 1));
    audio.stinger('phase');
    if (ev?.fx === 'blackout') this.targetNight = 0.85;
    if (ev?.fx === 'overdrive') audio.setIntensity(0.75);
    if (ev?.fx === 'collapse') this.vfx.emit('impact', 12, 0, 114, 26, 0x8ad6ff, 0, 1, 0, 1.6);
    this.mapRenderer.syncGroups();
    void this.lastBannerPhase;
  }

  private renderStep(dt: number, alpha: number): void {
    const look = this.input.consumeLook();
    if (!this.camera.isIntro()) this.camera.look(look.x, look.y);

    for (const view of this.views.values()) view.render(dt, alpha);

    // Camera follows either the local player or, once out, whoever we watch.
    const focusView = this.spectating ? this.getSpectateView() : this.views.get(this.localId);
    if (focusView) {
      const p = focusView.position;
      const wasIntro = this.camera.isIntro();
      this.camera.update(dt, p.x, p.y, p.z, focusView.currentSpeed, focusView.verticalSpeed, this.sim.world);
      // Hand control back cleanly instead of snapping from the flyover pose.
      if (wasIntro && !this.camera.isIntro()) this.camera.snapBehind(p.x, p.y, p.z);
      this.rig.followShadow(p.x, p.y, p.z);
      audio.setListener(p.x, p.y, p.z);
    }

    this.mapRenderer.update(dt, this.sim.tick * TICK_DT);
    this.batch.sync(this.rig.camera);
    this.vfx.update(dt, this.rig.camera);

    this.nightAmount = damp(this.nightAmount, this.targetNight, 1.6, dt);
    this.rig.setNight(this.nightAmount);

    this.updateHud(dt);
    audio.updateMusic(dt, this.opts.map.bpm);
  }

  private updateHud(dt: number): void {
    const me = this.localPlayer;
    if (!me) return;
    const total = this.sim.players.length;
    const pos = this.sim.positionOf(this.localId);
    const timeLeft = this.opts.map.timeLimit - Math.max(0, this.sim.runTime);

    this.hud.update(dt, {
      position: pos,
      total,
      qualified: this.sim.qualifiedCount,
      qualifyTarget: this.opts.practice ? 1 : this.sim.qualifyCount,
      timeLeft,
      countdown: -this.sim.runTime,
      showCountdown: this.sim.phase === RoundPhase.Countdown ||
        (this.sim.phase === RoundPhase.Running && this.sim.runTime < 0.9),
      objective: t('hud.objective.race'),
      mapName: t(this.opts.map.nameKey),
      variantName: t(`variant.${this.sim.director.variantId}`),
      checkpoint: me.checkpoint,
      runTime: this.runClock,
      personalBest: this.opts.personalBest ?? 0,
      showTimer: this.opts.showTimer ?? this.opts.practice ?? false,
    });

    // Music intensity tracks how close the leader is to the end.
    const progress = clamp(me.bestProgress / this.opts.map.courseLength, 0, 1);
    audio.setIntensity(clamp(0.28 + progress * 0.6, 0, 1));
  }

  private checkRoundEnd(): void {
    if (this.finished) return;
    const me = this.localPlayer;
    if (!me) return;
    const timeUp = this.sim.runTime >= this.opts.map.timeLimit;
    const everyoneDone = this.sim.phase === RoundPhase.Running && this.sim.racingCount() === 0;
    const enoughQualified = !this.opts.practice && this.sim.qualifiedCount >= this.sim.qualifyCount;
    const meDone = me.finishTick >= 0;

    if (this.opts.practice) {
      if (meDone) this.endRound(true);
      return;
    }
    if (meDone && (enoughQualified || everyoneDone)) this.endRound(true);
    else if (meDone && !this.spectating) this.beginSpectate();
    else if (timeUp || everyoneDone || enoughQualified) this.endRound(meDone);
  }

  private beginSpectate(): void {
    this.spectating = true;
    this.spectateIndex = 0;
    this.hud.toast(t('results.spectate'), 'info');
  }

  private getSpectateView(): PlayerView | undefined {
    const racing = this.sim.players.filter((p) => p.finishTick < 0 && !p.eliminated);
    if (racing.length === 0) return this.views.get(this.localId);
    const target = racing[Math.abs(this.spectateIndex) % racing.length];
    return target ? this.views.get(target.id) : this.views.get(this.localId);
  }

  cycleSpectate(dir: number): void {
    this.spectateIndex += dir;
  }

  private endRound(qualified: boolean): void {
    if (this.finished) return;
    this.finished = true;
    const me = this.localPlayer!;
    const pos = me.finishTick >= 0 ? me.rank : this.sim.positionOf(this.localId);
    const pb = this.opts.personalBest ?? 0;
    const newRecord = pb > 0
      ? this.localFinishTime > 0 && this.localFinishTime < pb
      : this.localFinishTime > 0;
    this.result = {
      position: pos,
      total: this.sim.players.length,
      qualified,
      time: this.localFinishTime || this.runClock,
      falls: me.falls,
      variantId: this.sim.director.variantId,
      mapId: this.opts.map.id,
      newRecord,
    };
    if (newRecord && this.localFinishTime > 0) this.hud.toast(t('round.newRecord'), 'good');
    this.onFinished?.(this.result);
  }

  getResult(): MatchResult | null { return this.result; }

  /** Everything the player can see about the current layout, for the intro card. */
  getVariantInfo(): { name: string; desc: string } {
    const v = this.opts.map.variants.find((x) => x.id === this.sim.director.variantId);
    return {
      name: v ? t(v.nameKey) : '',
      desc: v?.descKey ? t(v.descKey) : '',
    };
  }

  setHudVisible(v: boolean): void { this.hud.setVisible(v); }

  dispose(): void {
    for (const view of this.views.values()) {
      this.batch.remove(view.wobbler);
      this.rig.scene.remove(view.wobbler.root);
      view.dispose();
    }
    this.views.clear();
    this.rig.scene.remove(this.batch.root);
    this.batch.dispose();
    this.rig.scene.remove(this.mapRenderer.root);
    this.mapRenderer.dispose();
    this.hud.root.remove();
    audio.stopMusic();
  }
}

export { THREE, Btn, MoveState };
