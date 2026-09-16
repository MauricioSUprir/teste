/**
 * Audio.
 *
 * Every sound is synthesised at runtime: no samples to license, no assets to
 * download, and each effect can be parameterised by what actually happened
 * (a heavy landing really is lower and louder than a light one).
 *
 * Music is layered: a base loop plus stems that fade in as a round heats up,
 * so intensity changes never restart the track.
 */
import { clamp, lerp } from '../shared/math';

export type SfxName =
  | 'step' | 'jump' | 'land' | 'landHard' | 'dive' | 'slide' | 'impact' | 'ragdoll'
  | 'bounce' | 'checkpoint' | 'finish' | 'eliminated' | 'qualify' | 'countdown'
  | 'go' | 'uiClick' | 'uiHover' | 'uiBack' | 'reward' | 'whoosh' | 'alarm' | 'confetti';

export interface AudioSettings {
  master: number;
  music: number;
  sfx: number;
  ui: number;
  muted: boolean;
}

const SCALE = [0, 2, 3, 5, 7, 9, 10]; // natural minor - energetic but not saccharine

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain!: GainNode;
  private musicGain!: GainNode;
  private sfxGain!: GainNode;
  private uiGain!: GainNode;
  private compressor!: DynamicsCompressorNode;
  private listenerPos = { x: 0, y: 0, z: 0 };
  private noiseBuffer: AudioBuffer | null = null;
  settings: AudioSettings = { master: 0.85, music: 0.5, sfx: 0.85, ui: 0.7, muted: false };

  private musicTimer = 0;
  private musicStep = 0;
  private musicIntensity = 0;
  private targetIntensity = 0;
  private musicRunning = false;
  private musicKey = 0;
  private lastStepTime = 0;

  /** Browsers require a gesture; call this from the first click/tap. */
  resume(): void {
    if (!this.ctx) this.init();
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
  }

  private init(): void {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctor();
    const ctx = this.ctx;
    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -14;
    this.compressor.knee.value = 22;
    this.compressor.ratio.value = 7;
    this.compressor.attack.value = 0.004;
    this.compressor.release.value = 0.18;
    this.compressor.connect(ctx.destination);

    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = this.settings.master;
    this.masterGain.connect(this.compressor);

    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = this.settings.music;
    this.musicGain.connect(this.masterGain);

    this.sfxGain = ctx.createGain();
    this.sfxGain.gain.value = this.settings.sfx;
    this.sfxGain.connect(this.masterGain);

    this.uiGain = ctx.createGain();
    this.uiGain.gain.value = this.settings.ui;
    this.uiGain.connect(this.masterGain);

    // One second of noise, reused by every percussive sound.
    const len = ctx.sampleRate;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buf;
  }

  applySettings(s: Partial<AudioSettings>): void {
    Object.assign(this.settings, s);
    if (!this.ctx) return;
    const m = this.settings.muted ? 0 : this.settings.master;
    this.masterGain.gain.setTargetAtTime(m, this.ctx.currentTime, 0.05);
    this.musicGain.gain.setTargetAtTime(this.settings.music, this.ctx.currentTime, 0.05);
    this.sfxGain.gain.setTargetAtTime(this.settings.sfx, this.ctx.currentTime, 0.05);
    this.uiGain.gain.setTargetAtTime(this.settings.ui, this.ctx.currentTime, 0.05);
  }

  setListener(x: number, y: number, z: number): void {
    this.listenerPos.x = x; this.listenerPos.y = y; this.listenerPos.z = z;
  }

  /** Distance attenuation + a little stereo, without the cost of PannerNodes. */
  private spatialGain(x?: number, y?: number, z?: number): { gain: number; pan: number } {
    if (x === undefined || y === undefined || z === undefined) return { gain: 1, pan: 0 };
    const dx = x - this.listenerPos.x, dy = y - this.listenerPos.y, dz = z - this.listenerPos.z;
    const d = Math.hypot(dx, dy, dz);
    const gain = clamp(1 - d / 48, 0, 1) ** 1.6;
    const pan = clamp(dx / 22, -1, 1);
    return { gain, pan };
  }

  private env(dest: AudioNode, gain: number, pan: number): GainNode {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    if (pan !== 0 && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      g.connect(p);
      p.connect(dest);
    } else {
      g.connect(dest);
    }
    g.gain.value = gain;
    return g;
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number,
               dest: AudioNode, pan = 0, sweepTo?: number): void {
    const ctx = this.ctx!;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (sweepTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), now + dur);
    const g = this.env(dest, 0, pan);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(vol, now + Math.min(0.012, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(g);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  private noise(dur: number, vol: number, dest: AudioNode, pan = 0,
                filterFreq = 1200, q = 1, sweepTo?: number): void {
    const ctx = this.ctx!;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.setValueAtTime(filterFreq, now);
    filt.Q.value = q;
    if (sweepTo) filt.frequency.exponentialRampToValueAtTime(Math.max(40, sweepTo), now + dur);
    const g = this.env(dest, 0, pan);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(vol, now + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(filt);
    filt.connect(g);
    src.start(now);
    src.stop(now + dur + 0.02);
  }

  /** Plays an effect, optionally positioned in the world. */
  play(name: SfxName, opts: { x?: number; y?: number; z?: number; power?: number; pitch?: number } = {}): void {
    if (!this.ctx || this.settings.muted) return;
    const { gain, pan } = this.spatialGain(opts.x, opts.y, opts.z);
    if (gain <= 0.004) return;
    const power = clamp(opts.power ?? 1, 0, 3);
    const pitch = opts.pitch ?? 1;
    const dest = name.startsWith('ui') ? this.uiGain : this.sfxGain;
    const v = gain;

    switch (name) {
      case 'step': {
        // Rate-limit: a crowd of 32 runners would otherwise be a wall of noise.
        const t = this.ctx.currentTime;
        if (t - this.lastStepTime < 0.045) return;
        this.lastStepTime = t;
        this.noise(0.07, 0.16 * v * power, dest, pan, 900 * pitch, 1.4, 420);
        break;
      }
      case 'jump':
        this.tone(330 * pitch, 0.16, 'triangle', 0.16 * v, dest, pan, 620);
        this.noise(0.09, 0.07 * v, dest, pan, 1600, 0.8, 700);
        break;
      case 'land':
        this.noise(0.13, 0.17 * v * power, dest, pan, 520, 1.1, 180);
        this.tone(150, 0.12, 'sine', 0.12 * v * power, dest, pan, 80);
        break;
      case 'landHard':
        this.noise(0.24, 0.3 * v, dest, pan, 380, 0.9, 90);
        this.tone(96, 0.28, 'sine', 0.26 * v, dest, pan, 48);
        break;
      case 'dive':
        this.noise(0.3, 0.14 * v, dest, pan, 500, 0.7, 2400);
        this.tone(240, 0.24, 'triangle', 0.1 * v, dest, pan, 520);
        break;
      case 'slide':
        this.noise(0.38, 0.12 * v, dest, pan, 1800, 2.2, 600);
        break;
      case 'impact':
        this.tone(190 * pitch, 0.17, 'square', 0.13 * v * power, dest, pan, 70);
        this.noise(0.16, 0.16 * v * power, dest, pan, 700, 0.8, 200);
        break;
      case 'ragdoll':
        this.tone(140, 0.34, 'sawtooth', 0.14 * v, dest, pan, 55);
        this.noise(0.3, 0.2 * v, dest, pan, 420, 0.7, 110);
        break;
      case 'bounce':
        this.tone(260, 0.2, 'sine', 0.19 * v, dest, pan, 900);
        break;
      case 'checkpoint':
        this.tone(660, 0.1, 'triangle', 0.14 * v, dest, pan);
        setTimeout(() => this.ctx && this.tone(990, 0.16, 'triangle', 0.13 * v, dest, pan), 70);
        break;
      case 'qualify':
      case 'finish': {
        const notes = [523, 659, 784, 1047];
        notes.forEach((f, i) => setTimeout(() => {
          if (this.ctx) this.tone(f, 0.3, 'triangle', 0.16 * v, dest, pan);
        }, i * 85));
        break;
      }
      case 'eliminated':
        [392, 330, 262].forEach((f, i) => setTimeout(() => {
          if (this.ctx) this.tone(f, 0.34, 'triangle', 0.15 * v, dest, pan);
        }, i * 130));
        break;
      case 'countdown':
        this.tone(440 * pitch, 0.16, 'square', 0.16 * v, dest, pan);
        break;
      case 'go':
        this.tone(880, 0.4, 'square', 0.2 * v, dest, pan, 1320);
        this.noise(0.4, 0.12 * v, dest, pan, 2200, 0.6, 400);
        break;
      case 'uiClick':
        this.tone(760, 0.06, 'square', 0.1, dest, 0, 980);
        break;
      case 'uiHover':
        this.tone(560, 0.04, 'sine', 0.05, dest, 0);
        break;
      case 'uiBack':
        this.tone(420, 0.08, 'square', 0.08, dest, 0, 280);
        break;
      case 'reward':
        [659, 784, 988, 1319].forEach((f, i) => setTimeout(() => {
          if (this.ctx) this.tone(f, 0.26, 'triangle', 0.12, dest, 0);
        }, i * 70));
        break;
      case 'whoosh':
        this.noise(0.34, 0.1 * v, dest, pan, 300, 0.6, 2600);
        break;
      case 'alarm':
        [740, 560, 740, 560].forEach((f, i) => setTimeout(() => {
          if (this.ctx) this.tone(f, 0.18, 'sawtooth', 0.11 * v, dest, pan);
        }, i * 180));
        break;
      case 'confetti':
        this.noise(0.5, 0.1 * v, dest, pan, 3000, 0.5, 900);
        break;
    }
  }

  // ── music ──────────────────────────────────────────────────────────────
  startMusic(key = 0): void {
    if (!this.ctx) this.init();
    this.musicRunning = true;
    this.musicKey = key;
    this.musicStep = 0;
    this.musicTimer = 0;
  }

  stopMusic(): void { this.musicRunning = false; }

  /** 0 = calm menu, 1 = final sprint. Ramps smoothly, never restarts. */
  setIntensity(v: number): void { this.targetIntensity = clamp(v, 0, 1); }

  /** Called every frame; schedules the next step when due. */
  updateMusic(dt: number, bpm = 128): void {
    if (!this.musicRunning || !this.ctx || this.settings.muted) return;
    this.musicIntensity = lerp(this.musicIntensity, this.targetIntensity, 1 - Math.exp(-0.8 * dt));
    const stepDur = 60 / bpm / 2; // eighth notes
    this.musicTimer += dt;
    while (this.musicTimer >= stepDur) {
      this.musicTimer -= stepDur;
      this.playStep(this.musicStep++, stepDur);
    }
  }

  private playStep(step: number, dur: number): void {
    const dest = this.musicGain;
    const i = this.musicIntensity;
    const bar = Math.floor(step / 8) % 4;
    const s = step % 8;
    const root = 48 + this.musicKey; // MIDI-ish
    const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

    // Bass pulse - always present, it is the heartbeat.
    if (s % 2 === 0) {
      const deg = SCALE[(bar * 2) % SCALE.length];
      this.tone(midi(root + deg - 12), dur * 1.6, 'triangle', 0.1 + i * 0.05, dest);
    }
    // Kick + hat.
    this.noise(0.06, 0.05 + i * 0.05, dest, 0, s % 4 === 0 ? 120 : 6000, s % 4 === 0 ? 0.7 : 1.6,
      s % 4 === 0 ? 60 : 4000);
    // Arpeggio layer rises with intensity.
    if (i > 0.25 && s % 1 === 0) {
      const idx = (step * 3) % SCALE.length;
      const oct = i > 0.7 ? 12 : 0;
      this.tone(midi(root + 12 + SCALE[idx] + oct), dur * 0.9, 'square', (0.026 + i * 0.03), dest);
    }
    // Pad chord on the bar.
    if (s === 0) {
      const deg = SCALE[(bar * 2) % SCALE.length];
      [0, 3, 7].forEach((o) => this.tone(midi(root + deg + o), dur * 7, 'sine', 0.022 + i * 0.016, dest));
    }
  }

  /** Short stinger that ducks the music, for qualification moments. */
  stinger(kind: 'qualify' | 'eliminated' | 'phase'): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, now);
    this.musicGain.gain.linearRampToValueAtTime(this.settings.music * 0.25, now + 0.06);
    this.musicGain.gain.linearRampToValueAtTime(this.settings.music, now + 1.1);
    if (kind === 'qualify') this.play('qualify');
    else if (kind === 'eliminated') this.play('eliminated');
    else this.play('alarm');
  }

  get isReady(): boolean { return this.ctx !== null; }
}

export const audio = new AudioManager();
