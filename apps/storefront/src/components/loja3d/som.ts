/**
 * Som da loja 3D, todo gerado na hora pelo navegador (Web Audio) — nenhum
 * arquivo para baixar e nenhuma música de terceiros:
 *
 *  - música ambiente de loja: acordes macios (pad) com um piano elétrico leve
 *    tocando notas soltas dos acordes, num reverb de salão;
 *  - o "plim-plom" da porta automática;
 *  - passos no porcelanato;
 *  - o produto caindo na cesta;
 *  - o "pop" do balão da Larissa.
 *
 * Navegador só deixa tocar som depois de um toque ou tecla: `destravar` é
 * chamado no primeiro clique dentro da loja. Com a aba escondida, tudo pausa.
 */

export interface Som {
  destravar: () => void;
  ligar: (sim: boolean) => void;
  porta: () => void;
  passo: () => void;
  cesta: () => void;
  balao: () => void;
  descartar: () => void;
}

// acordes (MIDI) de 4 compassos cada: Fmaj9, Em7, Dm9, Cmaj9, Am9, Bbmaj7
const ACORDES = [
  [53, 57, 60, 64, 67],
  [52, 55, 59, 62],
  [50, 53, 57, 60, 64],
  [48, 52, 55, 59, 62],
  [45, 48, 52, 55, 59],
  [46, 50, 53, 57],
];
const COMPASSO = 4.2; // segundos por acorde
const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

export function criarSom(): Som {
  type Contexto = AudioContext;
  let ctx: Contexto | null = null;
  let mestre: GainNode | null = null;
  let musica: GainNode | null = null;
  let efeitos: GainNode | null = null;
  let reverb: ConvolverNode | null = null;
  let ruido: AudioBuffer | null = null;
  let ligado = true;
  let relogio: ReturnType<typeof setInterval> | null = null;
  let proximoAcorde = 0;
  let indiceAcorde = 0;
  let proximaNota = 0;
  let semente = 7;
  const acaso = () => {
    semente = (semente * 16807) % 2147483647;
    return semente / 2147483647;
  };

  function montar() {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    ctx = new Ctor();
    mestre = ctx.createGain();
    mestre.gain.value = ligado ? 1 : 0;
    const limitador = ctx.createDynamicsCompressor();
    limitador.threshold.value = -12;
    mestre.connect(limitador).connect(ctx.destination);
    // reverb de salão: ruído que some aos poucos (2,4 s)
    reverb = ctx.createConvolver();
    const dur = 2.4;
    const ir = ctx.createBuffer(2, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3.2);
    }
    reverb.buffer = ir;
    const volta = ctx.createGain();
    volta.gain.value = 0.32;
    reverb.connect(volta).connect(mestre);
    musica = ctx.createGain();
    musica.gain.value = 0.055;
    musica.connect(mestre);
    musica.connect(reverb);
    efeitos = ctx.createGain();
    efeitos.gain.value = 0.5;
    efeitos.connect(mestre);
    const envio = ctx.createGain();
    envio.gain.value = 0.25;
    efeitos.connect(envio).connect(reverb);
    ruido = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.3), ctx.sampleRate);
    const r = ruido.getChannelData(0);
    for (let i = 0; i < r.length; i++) r[i] = Math.random() * 2 - 1;
    proximoAcorde = ctx.currentTime + 0.3;
    proximaNota = proximoAcorde + 1;
    relogio = setInterval(agendar, 200);
    document.addEventListener("visibilitychange", aoMudarVisibilidade);
  }
  function aoMudarVisibilidade() {
    if (!ctx) return;
    if (document.hidden) void ctx.suspend();
    else if (ligado) void ctx.resume();
  }

  /** pad: duas serras desafinadas por nota, filtro abrindo devagar */
  function pad(notas: number[], t: number, dur: number) {
    if (!ctx || !musica) return;
    const filtro = ctx.createBiquadFilter();
    filtro.type = "lowpass";
    filtro.Q.value = 0.4;
    filtro.frequency.setValueAtTime(520, t);
    filtro.frequency.linearRampToValueAtTime(1150, t + dur * 0.5);
    filtro.frequency.linearRampToValueAtTime(600, t + dur + 1.5);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.16, t + 1.6);
    env.gain.setValueAtTime(0.16, t + dur - 0.4);
    env.gain.linearRampToValueAtTime(0, t + dur + 1.8);
    filtro.connect(env).connect(musica);
    for (const n of notas) {
      for (const desafino of [-6, 7]) {
        const o = ctx.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = hz(n);
        o.detune.value = desafino;
        const g = ctx.createGain();
        g.gain.value = 0.12 / notas.length;
        o.connect(g).connect(filtro);
        o.start(t);
        o.stop(t + dur + 2);
      }
    }
    // baixo: a nota de baixo uma oitava abaixo, senoide
    const b = ctx.createOscillator();
    b.frequency.value = hz(notas[0] - 12);
    const gb = ctx.createGain();
    gb.gain.setValueAtTime(0, t);
    gb.gain.linearRampToValueAtTime(0.22, t + 0.8);
    gb.gain.linearRampToValueAtTime(0, t + dur + 0.6);
    b.connect(gb).connect(musica);
    b.start(t);
    b.stop(t + dur + 1);
  }

  /** piano elétrico: senoide com um harmônico e ataque rápido */
  function tecla(n: number, t: number, forca: number) {
    if (!ctx || !musica) return;
    const pan = ctx.createStereoPanner();
    pan.pan.value = acaso() * 1.2 - 0.6;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.5 * forca, t + 0.01);
    env.gain.exponentialRampToValueAtTime(0.001, t + 2.2);
    env.connect(pan).connect(musica);
    for (const [mult, vol] of [
      [1, 1],
      [2, 0.25],
      [3.01, 0.08],
    ]) {
      const o = ctx.createOscillator();
      o.type = mult === 1 ? "triangle" : "sine";
      o.frequency.value = hz(n) * mult;
      const g = ctx.createGain();
      g.gain.value = vol;
      o.connect(g).connect(env);
      o.start(t);
      o.stop(t + 2.3);
    }
  }

  function agendar() {
    if (!ctx || ctx.state !== "running") return;
    const ate = ctx.currentTime + 0.6;
    while (proximoAcorde < ate) {
      pad(ACORDES[indiceAcorde % ACORDES.length], proximoAcorde, COMPASSO);
      proximoAcorde += COMPASSO;
      indiceAcorde++;
    }
    while (proximaNota < ate) {
      const acorde = ACORDES[(indiceAcorde - 1 + ACORDES.length) % ACORDES.length];
      if (acaso() < 0.55) tecla(acorde[Math.floor(acaso() * acorde.length)] + 12 + (acaso() < 0.3 ? 12 : 0), proximaNota, 0.5 + acaso() * 0.5);
      proximaNota += [0.35, 0.7, 0.7, 1.05][Math.floor(acaso() * 4)];
    }
  }

  /** sino: fundamental + parciais de sino que somem devagar */
  function sino(f: number, t: number, vol: number) {
    if (!ctx || !efeitos) return;
    for (const [mult, v, dur] of [
      [1, 1, 1.8],
      [2.76, 0.3, 0.9],
      [5.4, 0.12, 0.5],
    ]) {
      const o = ctx.createOscillator();
      o.frequency.value = f * mult;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol * v, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
      o.connect(g).connect(efeitos);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
  }

  function chiado(t: number, dur: number, freq: number, q: number, vol: number) {
    if (!ctx || !efeitos || !ruido) return;
    const s = ctx.createBufferSource();
    s.buffer = ruido;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    s.connect(f).connect(g).connect(efeitos);
    s.start(t, acaso() * 0.15);
    s.stop(t + dur + 0.02);
  }

  function tom(t: number, de: number, para: number, dur: number, vol: number) {
    if (!ctx || !efeitos) return;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(de, t);
    o.frequency.exponentialRampToValueAtTime(para, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    o.connect(g).connect(efeitos);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  const agora = () => (ctx && ctx.state === "running" && ligado ? ctx.currentTime : null);

  return {
    destravar() {
      if (!ctx) montar();
      if (!ctx) return;
      if (!ligado) void ctx.suspend();
      else if (ctx.state !== "running") void ctx.resume();
    },
    ligar(sim) {
      ligado = sim;
      if (!ctx || !mestre) return;
      mestre.gain.setTargetAtTime(sim ? 1 : 0, ctx.currentTime, 0.15);
      if (sim) void ctx.resume();
      else setTimeout(() => !ligado && ctx && void ctx.suspend(), 500);
    },
    porta() {
      const t = agora();
      if (t === null) return;
      sino(659.3, t, 0.16);
      sino(523.3, t + 0.38, 0.16);
    },
    passo() {
      const t = agora();
      if (t === null) return;
      chiado(t, 0.07, 1500 + acaso() * 500, 1.4, 0.05);
      tom(t, 120, 70, 0.06, 0.05);
    },
    cesta() {
      const t = agora();
      if (t === null) return;
      tom(t, 540, 190, 0.14, 0.12);
      chiado(t + 0.03, 0.12, 3200, 0.8, 0.05);
    },
    balao() {
      const t = agora();
      if (t === null) return;
      tom(t, 700, 1100, 0.08, 0.06);
      sino(1318.5, t + 0.06, 0.05);
    },
    descartar() {
      if (relogio) clearInterval(relogio);
      document.removeEventListener("visibilitychange", aoMudarVisibilidade);
      void ctx?.close();
      ctx = null;
    },
  };
}
