/**
 * Som da loja 3D, todo gerado na hora pelo navegador (Web Audio) — nenhum
 * arquivo para baixar e nenhuma música de terceiros:
 *
 *  - bossa nova ambiente no estilo do Tom Jobim, mas de composição própria
 *    (nenhuma música dele é copiada — elas têm direito autoral): violão de nylon
 *    na batida da bossa (corda dedilhada de verdade, pelo algoritmo de
 *    Karplus-Strong) com o baixo no polegar, vassourinha e aro; a melodia na
 *    flauta, a ponte no piano em oitavas e, da segunda parte em diante, cordas
 *    bem suaves por baixo, como nos discos dele com arranjo de orquestra. A
 *    harmonia é a linguagem dele: sétimas maiores, nonas e décimas terceiras, o
 *    quarto grau menor, substitutos de trítono e a ponte que sai do tom;
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

// acordes em ré maior: baixo do polegar (fundamental e quinta) e as notas que os dedos puxam
type Acorde = { baixo: [number, number]; dedos: number[] };
const AC: Record<string, Acorde> = {
  Dmaj9: { baixo: [50, 45], dedos: [54, 61, 64] },
  Bm9: { baixo: [47, 42], dedos: [57, 61, 62] },
  Em9: { baixo: [40, 47], dedos: [55, 62, 66] },
  A13: { baixo: [45, 40], dedos: [55, 61, 66] },
  A7b9: { baixo: [45, 40], dedos: [55, 58, 61] },
  Fsm7: { baixo: [42, 49], dedos: [52, 57, 61] },
  B7b13: { baixo: [47, 42], dedos: [57, 63, 67] },
  Eb7s11: { baixo: [51, 46], dedos: [55, 57, 61] },
  Gmaj9: { baixo: [43, 50], dedos: [54, 57, 59] },
  Gm6: { baixo: [43, 50], dedos: [52, 58, 62] },
  F7s11: { baixo: [41, 48], dedos: [57, 59, 63] },
  Gm9: { baixo: [43, 50], dedos: [53, 57, 58] },
  C13: { baixo: [48, 43], dedos: [52, 57, 58] },
  Fmaj9: { baixo: [41, 48], dedos: [52, 55, 57] },
  Bbmaj9: { baixo: [46, 41], dedos: [57, 60, 62] },
};
// forma AABA de 32 compassos ("X|Y" = dois acordes no compasso, o segundo no meio)
const FORMA = [
  ...["Dmaj9", "Bm9", "Em9", "A13|A7b9", "Fsm7", "B7b13", "Em9", "Eb7s11"], // A
  ...["Dmaj9", "Gmaj9", "Gm6", "Fsm7", "F7s11", "Em9", "A7b9", "Dmaj9"], // A
  ...["Gm9", "C13", "Fmaj9", "Bbmaj9", "Em9", "A13", "Em9", "Eb7s11"], // B: a ponte sai do tom
  ...["Dmaj9", "Gmaj9", "Gm6", "Fsm7", "F7s11", "Em9", "A13|A7b9", "Dmaj9|Eb7s11"], // A (o Eb7 volta para o começo)
].map((c) => c.split("|").map((n) => AC[n]));
// melodia própria, por compasso: [semicolcheia em que entra, nota, duração em semicolcheias]
type Nota = [number, number, number];
// os 6 primeiros compassos da segunda e da última parte A (iguais)
const VOLTA_A: Nota[][] = [
  [[0, 69, 4], [4, 73, 4], [8, 76, 8]],
  [[0, 78, 12], [12, 76, 4]],
  [[0, 76, 8], [8, 74, 4], [12, 70, 4]],
  [[0, 69, 12], [12, 73, 4]],
  [[0, 71, 10], [12, 69, 4]],
  [[0, 67, 4], [4, 71, 4], [8, 74, 4], [12, 78, 4]],
];
const MELODIA: Nota[][] = [
  // A: flauta
  [[2, 76, 4], [6, 78, 4], [10, 76, 4], [14, 73, 12]],
  [[12, 74, 4]],
  [[0, 78, 8], [10, 79, 2], [12, 78, 4]],
  [[0, 76, 6], [8, 70, 6]],
  [[2, 69, 4], [6, 73, 4], [10, 76, 6]],
  [[0, 75, 8], [10, 79, 6]],
  [[0, 78, 12], [12, 76, 4]],
  [[0, 69, 12]],
  ...VOLTA_A,
  [[0, 76, 6], [6, 73, 4], [10, 70, 6]],
  [[0, 69, 14]],
  // B: piano em oitavas
  [[0, 74, 4], [4, 77, 4], [8, 81, 8]],
  [[0, 81, 8], [8, 79, 4], [12, 76, 4]],
  [[0, 79, 12], [12, 76, 4]],
  [[0, 74, 4], [4, 77, 4], [8, 81, 8]],
  [[0, 78, 8], [8, 76, 4], [12, 74, 4]],
  [[0, 78, 12], [12, 76, 4]],
  [[0, 79, 6], [6, 78, 4], [10, 74, 6]],
  [[0, 73, 8], [8, 69, 8]],
  // A: flauta de novo
  ...VOLTA_A,
  [[0, 76, 6], [6, 73, 2], [8, 70, 6]],
  [[0, 69, 14]],
];
const BPM = 120;
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

  /** flauta: senoide com um tiquinho de segunda harmônica, sopro no ataque e vibrato que chega devagar */
  function flauta(midi: number, t: number, dur: number, vol: number) {
    if (!ctx || !musica || !ruido) return;
    const f = hz(midi);
    const fim = t + dur;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(vol, t + 0.07);
    env.gain.setValueAtTime(vol, Math.max(t + 0.08, fim - 0.08));
    env.gain.linearRampToValueAtTime(0, fim + 0.12);
    const pan = ctx.createStereoPanner();
    pan.pan.value = -0.2;
    env.connect(pan).connect(musica);
    const vib = ctx.createOscillator();
    vib.frequency.value = 5.2;
    const prof = ctx.createGain();
    prof.gain.setValueAtTime(0, t);
    prof.gain.linearRampToValueAtTime(f * 0.005, t + 0.4);
    vib.connect(prof);
    for (const [mult, v] of [
      [1, 1],
      [2, 0.1],
      [3, 0.03],
    ]) {
      const o = ctx.createOscillator();
      o.frequency.value = f * mult;
      const deMult = ctx.createGain();
      deMult.gain.value = mult;
      prof.connect(deMult).connect(o.frequency);
      const g = ctx.createGain();
      g.gain.value = v;
      o.connect(g).connect(env);
      o.start(t);
      o.stop(fim + 0.15);
    }
    vib.start(t);
    vib.stop(fim + 0.15);
    // o sopro: um chiado curto na altura da nota
    const s = ctx.createBufferSource();
    s.buffer = ruido;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = f * 2;
    bp.Q.value = 2;
    const gs = ctx.createGain();
    gs.gain.setValueAtTime(vol * 0.5, t);
    gs.gain.exponentialRampToValueAtTime(0.0005, t + 0.12);
    s.connect(bp).connect(gs).connect(pan);
    s.start(t, acaso() * 0.15);
    s.stop(t + 0.14);
  }

  /** piano: parciais que somem mais rápido nos agudos, com o martelinho no começo */
  function piano(midi: number, t: number, dur: number, vol: number) {
    if (!ctx || !musica) return;
    const queda = Math.min(2.6, 1.2 + dur);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(vol, t + 0.006);
    env.gain.exponentialRampToValueAtTime(vol * 0.35, t + 0.25);
    env.gain.exponentialRampToValueAtTime(0.0006, t + queda);
    const pan = ctx.createStereoPanner();
    pan.pan.value = 0.15;
    env.connect(pan).connect(musica);
    for (const [mult, v] of [
      [1, 1],
      [2.001, 0.4],
      [3.003, 0.14],
      [4.008, 0.07],
    ]) {
      const o = ctx.createOscillator();
      o.frequency.value = hz(midi) * mult;
      const g = ctx.createGain();
      g.gain.value = v;
      o.connect(g).connect(env);
      o.start(t);
      o.stop(t + queda + 0.05);
    }
  }

  /** cordas: dois "serrotes" levemente desafinados por nota, abafados, entrando e saindo devagar */
  function cordasPad(notas: number[], t: number, dur: number) {
    const c = ctx;
    if (!c || !musica) return;
    const filtro = c.createBiquadFilter();
    filtro.type = "lowpass";
    filtro.frequency.value = 1500;
    filtro.Q.value = 0.4;
    const env = c.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.022, t + 0.7);
    env.gain.setValueAtTime(0.022, t + dur);
    env.gain.linearRampToValueAtTime(0, t + dur + 0.7);
    filtro.connect(env).connect(musica);
    notas.forEach((m, i) => {
      for (const desvio of [-7, 7]) {
        const o = c.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = hz(m + 12);
        o.detune.value = desvio;
        const p = c.createStereoPanner();
        p.pan.value = (i / Math.max(1, notas.length - 1)) * 1.2 - 0.6 + desvio / 70;
        o.connect(p).connect(filtro);
        o.start(t);
        o.stop(t + dur + 0.75);
      }
    });
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
    const compasso = Math.floor(n / 16) % FORMA.length;
    const acordes = FORMA[compasso];
    const acorde = noCompasso >= 8 && acordes[1] ? acordes[1] : acordes[0];
    const proximo = FORMA[(compasso + 1) % FORMA.length][0];
    const ponte = compasso >= 16 && compasso < 24;
    // um leve "balanço": as semicolcheias pares ficam um tiquinho atrás
    const tt = t + (noCompasso % 2 ? 0.012 : 0);
    // polegar: fundamental no 1; no 3, a quinta (ou a fundamental do acorde que entra no meio)
    if (POLEGAR.includes(noCompasso)) {
      const nota = noCompasso === 0 || (noCompasso === 8 && acordes[1]) ? acorde.baixo[0] : acorde.baixo[1];
      tocarCorda(nota, tt, 0.55, true, -0.1);
    }
    if (DEDOS.includes(noCompasso)) {
      const notas = noCompasso === 13 ? proximo.dedos : acorde.dedos; // antecipa o acorde que vem
      notas.forEach((m, i) => tocarCorda(m, tt + i * 0.006, 0.2, false, 0.15));
    }
    percussao(tt, false, noCompasso % 4 === 2 ? 0.8 : noCompasso % 2 ? 0.35 : 0.55);
    if (ARO.includes(noCompasso)) percussao(tt, true, 0.5);
    // cordas da segunda parte em diante, a cada troca de acorde
    if (compasso >= 8 && (noCompasso === 0 || (noCompasso === 8 && acordes[1]))) {
      cordasPad(acorde.dedos, t, (acordes[1] ? 8 : 16) * SEMI);
    }
    // melodia: flauta nas partes A, piano em oitavas na ponte
    for (const [inicio, nota, dur] of MELODIA[compasso]) {
      if (inicio !== noCompasso) continue;
      if (ponte) {
        piano(nota, tt, dur * SEMI, 0.16);
        piano(nota - 12, tt + 0.004, dur * SEMI, 0.11);
      } else flauta(nota, tt, dur * SEMI, 0.17);
    }
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
