/**
 * Som da loja 3D, todo gerado na hora pelo navegador (Web Audio) — nenhum
 * arquivo para baixar e nenhuma música de terceiros:
 *
 *  - bossa nova ambiente: violão de nylon na batida da bossa (corda dedilhada
 *    de verdade, pelo algoritmo de Karplus-Strong), baixo no polegar, vassourinha,
 *    aro e um Rhodes soltando notas dos acordes, num reverb de salão. A harmonia
 *    é uma sequência de acordes de bossa (ii-V com substituto de trítono), sem
 *    copiar nenhuma música;
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

// um compasso por acorde: baixo do polegar (fundamental e quinta) e as notas que os dedos puxam
const ACORDES: { baixo: [number, number]; dedos: number[] }[] = [
  { baixo: [48, 43], dedos: [52, 59, 62] }, // Cmaj9
  { baixo: [45, 40], dedos: [55, 61, 65] }, // A7(b13)
  { baixo: [50, 45], dedos: [53, 60, 64] }, // Dm9
  { baixo: [43, 50], dedos: [53, 59, 64] }, // G13
  { baixo: [40, 47], dedos: [55, 59, 62] }, // Em7
  { baixo: [45, 40], dedos: [55, 58, 61] }, // A7(b9)
  { baixo: [50, 45], dedos: [53, 60, 64] }, // Dm9
  { baixo: [49, 44], dedos: [59, 65, 67] }, // Db7(#11)
];
const BPM = 128;
const SEMI = 60 / BPM / 4; // uma semicolcheia
// batida da bossa nos 16 tempos do compasso: dedos (a última antecipa o próximo acorde) e polegar
const DEDOS = [0, 3, 6, 10, 13];
const POLEGAR = [0, 8];
const ARO = [6, 13];
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
  let proximoPasso = 0; // hora do próximo tempo (semicolcheia)
  let passo = 0; // contador de semicolcheias desde o começo
  const cordas = new Map<string, AudioBuffer>();
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
    musica.gain.value = 0.2;
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
    proximoPasso = ctx.currentTime + 0.3;
    relogio = setInterval(agendar, 100);
    document.addEventListener("visibilitychange", aoMudarVisibilidade);
  }
  function aoMudarVisibilidade() {
    if (!ctx) return;
    if (document.hidden) void ctx.suspend();
    else if (ligado) void ctx.resume();
  }

  /**
   * Corda dedilhada (Karplus-Strong): um ruído curto e abafado circula numa
   * linha de atraso do tamanho do período da nota, perdendo os agudos a cada
   * volta — é o que dá o som de nylon. Fica guardada por nota.
   */
  function corda(midi: number, grave: boolean): AudioBuffer | null {
    if (!ctx) return null;
    const chave = `${midi}-${grave}`;
    const pronta = cordas.get(chave);
    if (pronta) return pronta;
    const sr = ctx.sampleRate;
    const dur = grave ? 2.2 : 1.7;
    const buf = ctx.createBuffer(1, Math.floor(sr * dur), sr);
    const d = buf.getChannelData(0);
    const N = Math.max(2, Math.round(sr / hz(midi)));
    const linha = new Float32Array(N);
    const abafado = grave ? 0.25 : 0.45; // o polegar é mais macio que os dedos
    let ant = 0;
    for (let i = 0; i < N; i++) {
      ant += abafado * (Math.random() * 2 - 1 - ant);
      linha[i] = ant;
    }
    const perda = grave ? 0.9975 : 0.996;
    let k = 0;
    for (let i = 0; i < d.length; i++) {
      const v = linha[k];
      const prox = linha[(k + 1) % N];
      linha[k] = perda * 0.5 * (v + prox);
      d[i] = v * (i > d.length - 2000 ? (d.length - i) / 2000 : 1);
      k = (k + 1) % N;
    }
    cordas.set(chave, buf);
    return buf;
  }

  function tocarCorda(midi: number, t: number, vol: number, grave: boolean, pan = 0) {
    if (!ctx || !musica) return;
    const buf = corda(midi, grave);
    if (!buf) return;
    const s = ctx.createBufferSource();
    s.buffer = buf;
    // o atraso é inteiro: corrige a afinação pela velocidade
    s.playbackRate.value = Math.round(ctx.sampleRate / hz(midi)) / (ctx.sampleRate / hz(midi));
    const corpo = ctx.createBiquadFilter(); // caixa do violão: tira o chiado agudo
    corpo.type = "lowpass";
    corpo.frequency.value = grave ? 1400 : 3200;
    const g = ctx.createGain();
    g.gain.value = vol;
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    s.connect(corpo).connect(g).connect(p).connect(musica);
    s.start(t);
  }

  /** Rhodes: senoide com um pouco de sino e tremolo, bem baixinho */
  function rhodes(midi: number, t: number, vol: number) {
    if (!ctx || !musica) return;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(vol, t + 0.015);
    env.gain.exponentialRampToValueAtTime(0.0008, t + 2.4);
    const pan = ctx.createStereoPanner();
    pan.pan.value = acaso() * 0.8 - 0.4;
    env.connect(pan).connect(musica);
    for (const [mult, v] of [
      [1, 1],
      [2, 0.12],
      [4.02, 0.05],
    ]) {
      const o = ctx.createOscillator();
      o.frequency.value = hz(midi) * mult;
      const g = ctx.createGain();
      g.gain.value = v;
      o.connect(g).connect(env);
      o.start(t);
      o.stop(t + 2.5);
    }
  }

  /** vassourinha (ruído agudo curto) e aro (clique de madeira) */
  function percussao(t: number, aro: boolean, forca: number) {
    if (!ctx || !musica || !ruido) return;
    const s = ctx.createBufferSource();
    s.buffer = ruido;
    const f = ctx.createBiquadFilter();
    f.type = aro ? "bandpass" : "highpass";
    f.frequency.value = aro ? 1700 : 5200;
    f.Q.value = aro ? 6 : 0.7;
    const g = ctx.createGain();
    const dur = aro ? 0.05 : 0.07;
    g.gain.setValueAtTime((aro ? 0.5 : 0.09) * forca, t);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    s.connect(f).connect(g).connect(musica);
    s.start(t, acaso() * 0.2);
    s.stop(t + dur + 0.02);
  }

  /** uma semicolcheia da bossa */
  function tocarPasso(n: number, t: number) {
    const noCompasso = n % 16;
    const compasso = Math.floor(n / 16);
    const acorde = ACORDES[compasso % ACORDES.length];
    const proximo = ACORDES[(compasso + 1) % ACORDES.length];
    // um leve "balanço": as semicolcheias pares ficam um tiquinho atrás
    const tt = t + (noCompasso % 2 ? 0.012 : 0);
    if (POLEGAR.includes(noCompasso)) tocarCorda(acorde.baixo[noCompasso === 0 ? 0 : 1], tt, 0.55, true, -0.1);
    if (DEDOS.includes(noCompasso)) {
      const notas = noCompasso === 13 ? proximo.dedos : acorde.dedos; // antecipa o acorde que vem
      notas.forEach((m, i) => tocarCorda(m, tt + i * 0.006, 0.24, false, 0.15));
    }
    percussao(tt, false, noCompasso % 4 === 2 ? 1 : noCompasso % 2 ? 0.45 : 0.7);
    if (ARO.includes(noCompasso)) percussao(tt, true, 0.6);
    // Rhodes: de vez em quando, uma nota dos acordes (nunca em cima da batida)
    if (noCompasso % 4 === 2 && acaso() < 0.3) rhodes(acorde.dedos[Math.floor(acaso() * acorde.dedos.length)] + 12, tt, 0.13);
  }

  function agendar() {
    if (!ctx || ctx.state !== "running") return;
    const ate = ctx.currentTime + 0.35;
    while (proximoPasso < ate) {
      tocarPasso(passo, proximoPasso);
      passo++;
      proximoPasso += SEMI;
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
