// Áudio procedural (WebAudio). Atmosfera marciana: impedância acústica ~1/100 da Terra → sons externos
// abafados e graves (passa-baixas), o que domina é o som dentro do capacete (respiração, ventilação).
export class Sfx {
  ctx: AudioContext | null = null;
  master!: GainNode;
  private windGain!: GainNode;
  private windFilter!: BiquadFilterNode;
  private fanGain!: GainNode;
  private motorOsc!: OscillatorNode;
  private motorGain!: GainNode;
  private motorFilter!: BiquadFilterNode;
  private breathGain!: GainNode;
  private breathFilter!: BiquadFilterNode;
  private breathPhase = 0;
  private humGain: GainNode | null = null;
  private humOsc: OscillatorNode | null = null;
  private creakT = 3;
  private noiseBuf!: AudioBuffer;
  volume = 0.8;
  private started = false;

  /** precisa ser chamado dentro de um gesto do usuário */
  unlock() {
    if (this.started) { this.ctx?.resume(); return; }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.started = true;
    try { (navigator as unknown as { audioSession?: { type: string } }).audioSession!.type = 'playback'; } catch { /* iOS 17+ */ }
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    const comp = ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(ctx.destination);
    // ruído branco reutilizável
    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    let b = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b = 0.97 * b + 0.03 * w; d[i] = w * 0.5 + b * 2.5; }
    // vento (grave, abafado)
    const wind = this.noise();
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'lowpass';
    this.windFilter.frequency.value = 280;
    this.windFilter.Q.value = 0.7;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.05;
    wind.connect(this.windFilter).connect(this.windGain).connect(this.master);
    // ventilação do traje (zumbido suave)
    const fan = this.noise();
    const fanF = ctx.createBiquadFilter();
    fanF.type = 'bandpass'; fanF.frequency.value = 900; fanF.Q.value = 0.6;
    this.fanGain = ctx.createGain(); this.fanGain.gain.value = 0.018;
    fan.connect(fanF).connect(this.fanGain).connect(this.master);
    const hum = ctx.createOscillator(); hum.type = 'sine'; hum.frequency.value = 118;
    const humG = ctx.createGain(); humG.gain.value = 0.006;
    hum.connect(humG).connect(this.master); hum.start();
    this.humGain = humG; this.humOsc = hum;
    // respiração (ruído filtrado com envelope)
    const br = this.noise();
    this.breathFilter = ctx.createBiquadFilter();
    this.breathFilter.type = 'bandpass'; this.breathFilter.frequency.value = 1400; this.breathFilter.Q.value = 0.9;
    this.breathGain = ctx.createGain(); this.breathGain.gain.value = 0;
    br.connect(this.breathFilter).connect(this.breathGain).connect(this.master);
    // motor do rover (elétrico: zumbido que sobe com a rotação)
    this.motorOsc = ctx.createOscillator(); this.motorOsc.type = 'sawtooth'; this.motorOsc.frequency.value = 60;
    this.motorFilter = ctx.createBiquadFilter(); this.motorFilter.type = 'lowpass'; this.motorFilter.frequency.value = 400;
    this.motorGain = ctx.createGain(); this.motorGain.gain.value = 0;
    this.motorOsc.connect(this.motorFilter).connect(this.motorGain).connect(this.master);
    this.motorOsc.start();
  }

  private noise() {
    const s = this.ctx!.createBufferSource();
    s.buffer = this.noiseBuf; s.loop = true; s.start();
    return s;
  }

  setVolume(v: number) { this.volume = v; if (this.master) this.master.gain.value = v; }
  suspend(on: boolean) { if (!this.ctx) return; if (on) this.ctx.suspend(); else this.ctx.resume(); }

  /** atualização contínua */
  update(dt: number, p: { tau: number; exertion: number; o2Frac: number; inHelmet: boolean; roverSpeed: number; driving: boolean; paused: boolean; night?: number; cold?: number; inside?: boolean }) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const storm = Math.min(1, Math.max(0, (p.tau - 1) / 3));
    const night = p.night ?? 0, cold = p.cold ?? 0;
    // à noite o vento quase some (silêncio marciano); dentro do habitat só se ouve a ventilação
    const wind = p.inside ? 0.004 : (0.035 - night * 0.02) + storm * 0.22;
    this.windGain.gain.setTargetAtTime(p.paused ? 0 : wind, t, 0.5);
    this.windFilter.frequency.setTargetAtTime(220 + storm * 500, t, 0.8);
    this.fanGain.gain.setTargetAtTime(p.paused ? 0 : p.inside ? 0.03 : 0.016, t, 0.3);
    // aquecedor do traje trabalha mais no frio (zumbido sobe de volume e tom)
    if (this.humGain && this.humOsc) {
      this.humGain.gain.setTargetAtTime(p.paused || p.inside ? 0.002 : 0.006 + cold * 0.02, t, 0.8);
      this.humOsc.frequency.setTargetAtTime(118 + cold * 40, t, 1.5);
    }
    // estalos de contração térmica do traje/regolito nas noites geladas
    if (!p.paused && !p.inside && cold > 0.3) {
      this.creakT -= dt;
      if (this.creakT <= 0) {
        this.creakT = 4 + Math.random() * 9;
        this.blip(90 + Math.random() * 60, 0.09, 'triangle', 0.02 * cold, 0, -40);
        if (Math.random() < 0.5) this.blip(2400 + Math.random() * 1500, 0.02, 'square', 0.004 * cold, 0.05);
      }
    }
    // respiração: 14/min em repouso, até 32/min com esforço ou hipóxia
    const rate = (14 + p.exertion * 12 + (p.o2Frac < 0.15 ? 10 : 0)) / 60;
    this.breathPhase += dt * rate;
    const ph = this.breathPhase % 1;
    const env = ph < 0.4 ? Math.sin((ph / 0.4) * Math.PI) * 0.8 : ph < 0.5 ? 0 : Math.sin(((ph - 0.5) / 0.45) * Math.PI) * 1.0;
    this.breathGain.gain.setTargetAtTime(p.paused || !p.inHelmet ? 0 : Math.max(0, env) * (0.035 + p.exertion * 0.03), t, 0.05);
    this.breathFilter.frequency.setTargetAtTime(ph < 0.45 ? 1600 : 1100, t, 0.1);
    const sp = Math.abs(p.roverSpeed);
    this.motorGain.gain.setTargetAtTime(p.driving && !p.paused ? 0.025 + sp * 0.012 : 0, t, 0.2);
    this.motorOsc.frequency.setTargetAtTime(55 + sp * 38, t, 0.15);
    this.motorFilter.frequency.setTargetAtTime(300 + sp * 120, t, 0.2);
  }

  private blip(freq: number, dur: number, type: OscillatorType, gain: number, when = 0, slide = 0) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  }
  private thud(gain: number, freq = 90) {
    const ctx = this.ctx;
    if (!ctx) return;
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq * 3;
    const g = ctx.createGain(); const t = ctx.currentTime;
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    s.connect(f).connect(g).connect(this.master); s.start(t, Math.random()); s.stop(t + 0.2);
    this.blip(freq, 0.12, 'sine', gain * 0.8);
  }

  step() { this.thud(0.12, 70 + Math.random() * 25); }
  land(v: number) { this.thud(Math.min(0.5, 0.1 + v * 0.06), 55); }
  pickup() { this.blip(880, 0.08, 'sine', 0.06); this.blip(1320, 0.12, 'sine', 0.05, 0.07); }
  build() { this.thud(0.3, 60); this.blip(520, 0.2, 'triangle', 0.05, 0.05); this.blip(780, 0.25, 'triangle', 0.05, 0.18); }
  click() { this.blip(1400, 0.04, 'square', 0.02); }
  // ---- combate (tudo procedural; no ar rarefeito o som chega abafado, pelo traje)
  private noiseHit(gain: number, type: BiquadFilterType, freq: number, dur: number, q = 0.8) {
    const ctx = this.ctx; if (!ctx) return;
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); const t = ctx.currentTime;
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.master); s.start(t, Math.random()); s.stop(t + dur + 0.02);
  }
  zap() { this.noiseHit(0.09, 'bandpass', 2600, 0.16, 2); this.blip(220, 0.14, 'sawtooth', 0.025, 0, 3); }
  shot() { this.noiseHit(0.16, 'lowpass', 900, 0.12); this.blip(160, 0.08, 'square', 0.04, 0, 0.5); }
  arcShot() { this.noiseHit(0.12, 'highpass', 3000, 0.25); for (let i = 0; i < 4; i++) this.blip(900 + Math.random() * 1600, 0.03, 'square', 0.02, i * 0.035); }
  hitFlesh() { this.thud(0.18, 110); this.noiseHit(0.05, 'bandpass', 700, 0.1, 1.5); }
  screech() { this.blip(1900 + Math.random() * 500, 0.35, 'sawtooth', 0.018, 0, 0.55); this.blip(2600, 0.25, 'triangle', 0.012, 0.08, 0.7); }
  windup() { this.blip(600, 0.5, 'triangle', 0.03, 0, 2.2); }
  hurt() { this.thud(0.4, 60); this.blip(300, 0.2, 'square', 0.03, 0, 0.6); }
  craft() { this.build(); this.blip(1600, 0.15, 'sine', 0.04, 0.3); }
  objective() { this.blip(660, 0.18, 'sine', 0.05); this.blip(880, 0.18, 'sine', 0.05, 0.12); this.blip(1320, 0.35, 'sine', 0.045, 0.24); }
  alarm(level: 1 | 2) { for (let i = 0; i < (level === 2 ? 3 : 2); i++) this.blip(level === 2 ? 1250 : 880, 0.14, 'square', 0.035, i * 0.22); }
  radio() { this.blip(2200, 0.05, 'sine', 0.025); this.blip(1600, 0.06, 'sine', 0.02, 0.06); }
  door() { this.thud(0.25, 50); const ctx = this.ctx; if (!ctx) return; const s = ctx.createBufferSource(); s.buffer = this.noiseBuf; const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1500; const g = ctx.createGain(); const t = ctx.currentTime; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.06, t + 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4); s.connect(f).connect(g).connect(this.master); s.start(t); s.stop(t + 1.5); }
}

export const sfx = new Sfx();
