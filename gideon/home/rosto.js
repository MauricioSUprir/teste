// GIDEON — rosto holográfico, no estilo do logo: cabeça de luz azul, pontos em grade na pele, olhos brilhantes, sorriso leve.
// A cabeça vem do modelo base do MakeHuman (CC0), gerada por ferramentas/gerar_cabeca.py: crânio, orelhas, pálpebras e pescoço
// de verdade. Rosto ORIGINAL (mulher adulta jovem, mistura dos tipos-base do MakeHuman; não é nenhuma pessoa real).
// Fala e expressões usam as "expressões" do próprio MakeHuman: abrir a boca, bico, esticar, sorrir, piscar e subir as sobrancelhas.
// Lê o estado da página por window.gideonSinais() → { estado, mic, voz, analisador }.
import * as T from "./vendor/three-gideon.js";
import { CABECA } from "./rosto-cabeca.js";

const sinais = () => (window.gideonSinais ? window.gideonSinais() : { estado: "desligado", mic: 0, voz: 0, analisador: null });
const de64 = (s, Tipo) => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return new Tipo(u.buffer); };

export function iniciarRosto(palco) {
  // ---------- malha da cabeça ----------
  const N = CABECA.n, B = de64(CABECA.pos, Float32Array), tri = de64(CABECA.tri, Uint16Array), arestasIdx = de64(CABECA.arestas, Uint16Array);
  const MORF = Object.fromEntries(Object.entries(CABECA.morfs).map(([k, m]) => [k, { i: de64(m.i, Uint16Array), d: de64(m.d, Float32Array) }]));
  let zMin = 1e9, zMax = -1e9; // centro da cabeça (para a grade de pontos)
  for (let i = 0; i < N; i++) if (B[i * 3 + 1] > -2) { zMin = Math.min(zMin, B[i * 3 + 2]); zMax = Math.max(zMax, B[i * 3 + 2]); }
  const centro = new T.Vector3(0, 1.5, (zMin + zMax) / 2);

  // ---------- cena ----------
  const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  // #04060c: o composer converte a cor de limpeza para sRGB duas vezes; este valor compensa e o fundo sai igual ao da página
  renderer.setClearColor(new T.Color().setRGB(0.0012 / 12.92, 0.0018 / 12.92, 0.0037 / 12.92), 1);
  renderer.domElement.id = "rosto";
  document.body.prepend(renderer.domElement);
  const cena = new T.Scene(), camera = new T.PerspectiveCamera(30, 1, 1, 400), cabeca = new T.Group(); cena.add(cabeca);
  const uni = { uCor: { value: new T.Color(0.25, 0.78, 1) }, uT: { value: 0 }, uBrilho: { value: 1 }, uCentro: { value: centro } };

  // pele de luz: borda brilhante, luz de cima e da esquerda, linhas de varredura, faixa que desce e pontos em grade (como no logo)
  const VERT = `attribute vec3 aBase; attribute float aRel; varying vec3 vN; varying vec3 vV; varying vec3 vW; varying vec3 vB; varying float vR;
    void main(){ vB = aBase; vR = aRel * 1.41; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vN = normalize(normalMatrix * normal);
      vec4 mv = viewMatrix * w; vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
  const FRAG = `uniform vec3 uCor, uCentro; uniform float uT, uBrilho, uGanho; varying vec3 vN; varying vec3 vV; varying vec3 vW; varying vec3 vB; varying float vR;
    void main(){ vec3 n = normalize(vN), V = normalize(vV); float fr = pow(1.0 - abs(dot(n, V)), 2.2);
      vec3 L = normalize(vec3(-0.6, 0.3, 0.74)), L2 = normalize(vec3(0.75, 0.1, 0.55)); // luz principal (frente-esquerda-cima) e de recorte (direita)
      float luz = max(dot(n, L), 0.0), luz2 = max(dot(n, L2), 0.0);
      float esp = pow(max(dot(reflect(-L, n), V), 0.0), 20.0);
      float linhas = 0.86 + 0.14 * sin(vW.y * 7.0 - uT * 2.2);
      float faixa = smoothstep(1.3, 0.0, abs(vW.y - (16.0 - mod(uT * 6.0, 46.0))));
      vec3 q = vB - uCentro;
      vec2 g = vec2(atan(q.x, q.z) * 8.0, vB.y) / 1.05; vec2 f = fract(g) - 0.5; float d = length(f);
      float rosto = smoothstep(-0.5, 3.5, vB.z) * smoothstep(-9.0, -6.0, vB.y);
      float pino = smoothstep(0.2, 0.08, d) * (0.5 + 0.5 * smoothstep(0.12, 0.0, length(f - vec2(-0.05, 0.06))));
      float pontos = pino * mix(0.7, 0.18, rosto);
      float relevo = vR > 0.0 ? 1.0 + 0.7 * vR : max(0.1, 1.0 + 1.3 * vR); // cavidades (olhos, narinas, cantos da boca) escurecem; saliências brilham
      float difuso = 0.04 + 0.6 * pow(luz, 1.3) + 0.2 * luz2;
      float a = (difuso * relevo * 0.52 + 0.3 * fr + 0.16 * esp * relevo) * linhas + 0.1 * faixa + pontos * (0.12 + 0.45 * luz) * relevo;
      a *= smoothstep(-12.5, -5.0, vB.y); // o pescoço some para baixo
      gl_FragColor = vec4(uCor * a * uBrilho * uGanho, 1.0); }`;
  const matPele = new T.ShaderMaterial({ uniforms: { ...uni, uGanho: { value: 1 } }, vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, blending: T.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  // passada só de profundidade (mesmo VERT, para bater exatamente): o que fica atrás da cabeça não aparece através dela
  const matProfundidade = new T.ShaderMaterial({ vertexShader: VERT, fragmentShader: "void main(){ gl_FragColor = vec4(0.0); }", colorWrite: false, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });

  const P = new Float32Array(B);
  const geo = new T.BufferGeometry();
  const pos = new T.BufferAttribute(P, 3).setUsage(T.DynamicDrawUsage);
  geo.setAttribute("position", pos); geo.setAttribute("aBase", new T.BufferAttribute(B, 3)); geo.setAttribute("aRel", new T.BufferAttribute(de64(CABECA.relevo, Int8Array), 1, true));
  geo.setIndex(new T.BufferAttribute(tri, 1)); geo.computeVertexNormals();
  const malha = new T.Mesh(geo, matPele); malha.renderOrder = 1; cabeca.add(malha);
  const profundidade = new T.Mesh(geo, matProfundidade); profundidade.renderOrder = 0; cabeca.add(profundidade);

  // linhas finas do quadriculado da malha (como um holograma), somem no pescoço
  const geoL = new T.BufferGeometry(); geoL.setAttribute("position", pos); geoL.setAttribute("aBase", new T.BufferAttribute(B, 3)); geoL.setAttribute("aRel", geo.getAttribute("aRel")); geoL.setIndex(new T.BufferAttribute(arestasIdx, 1));
  const matLinhas = new T.ShaderMaterial({ uniforms: { ...uni, uOpac: { value: 0.1 } }, transparent: true, blending: T.AdditiveBlending, depthWrite: false,
    vertexShader: `attribute vec3 aBase; attribute float aRel; varying float vY; varying float vR; void main(){ vY = aBase.y; vR = abs(aRel) * 1.41; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uCor; uniform float uOpac, uBrilho; varying float vY; varying float vR; void main(){ gl_FragColor = vec4(uCor * uOpac * uBrilho * (0.55 + 1.6 * vR) * smoothstep(-12.0, -4.0, vY), 1.0); }` });
  const linhas = new T.LineSegments(geoL, matLinhas); linhas.renderOrder = 3; cabeca.add(linhas);

  // dentro da boca: fundo escuro, dentes e língua fracos (aparecem quando ela abre; as expressões também os movem)
  const [bx, by, bz] = CABECA.boca;
  const fundoBoca = new T.Mesh(new T.CircleGeometry(1, 24), new T.MeshBasicMaterial({ color: 0x081428 }));
  fundoBoca.scale.set(1.9, 1.1, 1); fundoBoca.position.set(bx, by - 0.4, bz - 1.6); fundoBoca.renderOrder = 0; cabeca.add(fundoBoca);
  const geoBoca = new T.BufferGeometry();
  geoBoca.setAttribute("position", pos); geoBoca.setAttribute("aBase", geo.getAttribute("aBase")); geoBoca.setAttribute("aRel", geo.getAttribute("aRel"));
  geoBoca.setIndex(new T.BufferAttribute(de64(CABECA.triBoca, Uint16Array), 1));
  const matBoca = new T.ShaderMaterial({ uniforms: { ...uni, uGanho: { value: 0.35 } }, vertexShader: VERT, fragmentShader: FRAG, transparent: true, blending: T.AdditiveBlending, depthWrite: false });
  const dentes = new T.Mesh(geoBoca, matBoca); dentes.renderOrder = 2; cabeca.add(dentes);

  // ---------- olhos de luz ----------
  const matOlho = new T.ShaderMaterial({ uniforms: uni, transparent: true, blending: T.AdditiveBlending, depthWrite: false,
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uCor; uniform float uT, uBrilho; varying vec3 vP;
      void main(){ float d = acos(clamp(vP.z, -1.0, 1.0)); float ang = atan(vP.y, vP.x);
        float iris = smoothstep(0.55, 0.48, d), pupila = smoothstep(0.18, 0.14, d), aro = smoothstep(0.38, 0.5, d) * iris;
        float raios = 0.6 + 0.4 * sin(ang * 26.0 + d * 18.0 + uT * 0.4);
        float reflexo = smoothstep(0.12, 0.0, distance(vP.xy, vec2(-0.16, 0.2))) * iris;
        vec3 c = uCor * ((iris - pupila * 0.85) * (0.75 * raios + 1.2 * aro) + (1.0 - iris) * 0.22) + vec3(0.8, 0.95, 1.0) * (reflexo * 1.3 + (iris - pupila) * 0.18);
        gl_FragColor = vec4(c * uBrilho * 1.05, 1.0); }` });
  const olhos = CABECA.olhos.map(([x, y, z, r]) => {
    const o = new T.Mesh(new T.SphereGeometry(r * 0.97, 32, 24), matOlho);
    o.position.set(x, y, z); o.renderOrder = 2; cabeca.add(o); return o; });

  // ---------- fundo: riscos de luz horizontais, partículas e halo ----------
  const ponto = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d");
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.35, "rgba(255,255,255,.45)"); r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new T.CanvasTexture(c); })();
  const QR = 46, posRiscos = new Float32Array(QR * 6), corRiscos = new Float32Array(QR * 6), riscos = [];
  for (let i = 0; i < QR; i++) {
    const lado = i % 2 ? 1 : -1, y = -11 + Math.random() * 25, x0 = lado * (9 + Math.random() * 4), x1 = x0 + lado * (3 + Math.random() * 13);
    posRiscos.set([x0, y, -9, x1, y, -9], i * 6); riscos.push({ fase: Math.random() * 6.28, vel: 0.5 + Math.random() * 2.5, forca: 0.15 + Math.random() * 0.35 });
  }
  const geoRiscos = new T.BufferGeometry();
  geoRiscos.setAttribute("position", new T.BufferAttribute(posRiscos, 3)); geoRiscos.setAttribute("color", new T.BufferAttribute(corRiscos, 3).setUsage(T.DynamicDrawUsage));
  cena.add(new T.LineSegments(geoRiscos, new T.LineBasicMaterial({ vertexColors: true, transparent: true, blending: T.AdditiveBlending, depthWrite: false })));
  const QP = 260, posPart = new Float32Array(QP * 3), velPart = new Float32Array(QP);
  for (let i = 0; i < QP; i++) { posPart.set([(Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40, -14 + Math.random() * 20], i * 3); velPart[i] = 0.4 + Math.random() * 1.2; }
  const geoPart = new T.BufferGeometry(); geoPart.setAttribute("position", new T.BufferAttribute(posPart, 3).setUsage(T.DynamicDrawUsage));
  const particulas = new T.Points(geoPart, new T.PointsMaterial({ color: 0x5fd0ff, size: 0.25, map: ponto, transparent: true, opacity: 0.3, blending: T.AdditiveBlending, depthWrite: false }));
  cena.add(particulas);
  const halo = new T.Mesh(new T.PlaneGeometry(90, 90), new T.ShaderMaterial({ uniforms: uni, transparent: true, blending: T.AdditiveBlending, depthWrite: false,
    vertexShader: `varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uCor; uniform float uBrilho; varying vec2 vU; void main(){ float r = distance(vU, vec2(0.5, 0.52)) * 2.0;
      gl_FragColor = vec4(uCor * 0.018 * pow(max(1.0 - r, 0.0), 3.0) * uBrilho, 1.0); }` }));
  halo.position.set(0, 1, -22); cena.add(halo);

  // ---------- brilho (bloom) ----------
  const composer = new T.EffectComposer(renderer);
  composer.addPass(new T.RenderPass(cena, camera));
  const bloom = new T.UnrealBloomPass(new T.Vector2(256, 256), 0.6, 0.35, 0.12);
  if (!location.search.includes("semBloom")) composer.addPass(bloom);
  composer.addPass(new T.OutputPass());
  const MEIO = 0.8;
  function ajustar() {
    const W = window.innerWidth || 1, H = window.innerHeight || 1, r = palco.getBoundingClientRect(), w = r.width || W, h = Math.max(120, (r.height || H) - 56); // 56 px embaixo para o aviso e a barra do microfone
    renderer.setSize(W, H, false); composer.setSize(W, H); bloom.resolution.set(Math.round(W / 2), Math.round(H / 2));
    camera.aspect = W / H;
    const tg = Math.tan(T.MathUtils.degToRad(camera.fov / 2)), alt = 28, larg = 20; // cabeça inteira + começo do pescoço precisam caber no palco
    const dist = Math.max(alt / 2 / tg * (H / h), larg / 2 / (tg * camera.aspect) * (W / w)) * 1.05;
    camera.position.set(0, MEIO, dist); camera.lookAt(0, MEIO, 0);
    camera.setViewOffset(W, H, W / 2 - (r.left + w / 2), H / 2 - (r.top + h / 2), W, H); // desloca a imagem até o centro do palco
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(ajustar).observe(palco); window.addEventListener("resize", ajustar); ajustar();

  // ---------- animação ----------
  const ESTADOS = {
    desligado: { cor: [0.08, 0.28, 0.75], brilho: 0.55 }, conectando: { cor: [0.18, 0.32, 1], brilho: 0.85 },
    ouvindo: { cor: [0.12, 0.42, 1], brilho: 1 }, falando: { cor: [0.13, 0.45, 1], brilho: 1 },
    pensando: { cor: [0.32, 0.28, 1], brilho: 0.95 }, erro: { cor: [1, 0.2, 0.25], brilho: 0.75 },
  };
  const cor = new T.Color(0.08, 0.28, 0.75), corAlvo = new T.Color();
  let abre = 0, largura = 0, piscar = 0, proxPiscada = 2, fimPiscada = 0, sono = 1, sobrancelha = 0, brilho = 0.5, nivelOuvido = 0, sorriso = 0.15;
  const olhar = new T.Vector2(), olharAlvo = new T.Vector2(); let proxOlhar = 0, falha = 0, proxFalha = 6;
  const freq = new Uint8Array(256), alvoMundo = new T.Vector3(), t0 = performance.now();
  const pesos = { abre: 0, bico: 0, estica: 0, sorri: 0, pisca_e: 0, pisca_d: 0, sobe_e: 0, sobe_d: 0 }, antes = {};

  function aplicarExpressoes() { // posição = base + soma das expressões com seus pesos
    let mudou = false;
    for (const k in pesos) if (Math.abs(pesos[k] - (antes[k] ?? -1)) > 0.002) { mudou = true; break; }
    if (!mudou) return;
    P.set(B);
    for (const k in pesos) {
      antes[k] = pesos[k]; const w = pesos[k]; if (w < 0.002) continue;
      const m = MORF[k], I = m.i, D = m.d;
      for (let j = 0; j < I.length; j++) { const i = I[j] * 3, jj = j * 3; P[i] += D[jj] * w; P[i + 1] += D[jj + 1] * w; P[i + 2] += D[jj + 2] * w; }
    }
    pos.needsUpdate = true; geo.computeVertexNormals(); geoBoca.computeVertexNormals();
  }

  function quadro(agora) {
    try { passo(agora); } catch (e) { // qualquer falha no 3D: volta para o círculo, e a conversa continua
      console.error("rosto 3D:", e); renderer.domElement.remove(); document.body.classList.remove("com-rosto"); window.gideonOrbe?.(); return; }
    requestAnimationFrame(quadro);
  }
  function passo(agora) {
    const t = (agora - t0) / 1000, s = sinais(), e = ESTADOS[s.estado] ? s.estado : "desligado", cfg = ESTADOS[e];
    // voz → abertura da boca (sobe rápido, desce mais devagar) e formato (agudos esticam, graves arredondam em bico)
    let alvoAbre = 0, alvoLarg = 0;
    if (e === "falando" && s.voz > 0) {
      alvoAbre = Math.pow(Math.min(1, Math.max(0, (s.voz - 0.012) / 0.17)), 0.8);
      if (s.analisador) { s.analisador.getByteFrequencyData(freq);
        let g = 0, a = 0; for (let i = 2; i < 20; i++) g += freq[i]; for (let i = 43; i < 107; i++) a += freq[i];
        alvoLarg = Math.max(-1, Math.min(1, (a / 64 - (g / 18) * 0.55) / 60)); }
    }
    if (window.__boca !== undefined) { alvoAbre = window.__boca; alvoLarg = window.__largura ?? 0; } // só para fotos de teste
    abre += (alvoAbre - abre) * (alvoAbre > abre ? 0.55 : 0.25);
    largura += (alvoLarg - largura) * 0.2;
    sobrancelha += ((e === "falando" ? abre * 0.5 : e === "pensando" ? 0.6 : e === "ouvindo" ? 0.15 : 0) - sobrancelha) * 0.08;
    nivelOuvido += ((e === "ouvindo" ? Math.min(1, s.mic * 8) : 0) - nivelOuvido) * 0.2;
    sono += ((e === "desligado" ? 1 : 0) - sono) * 0.04;
    sorriso += ((e === "ouvindo" ? 0.3 : e === "falando" ? 0.18 : e === "erro" ? 0 : 0.15) - sorriso) * 0.05;
    if (t > proxPiscada) { fimPiscada = t + 0.16; proxPiscada = t + 2.2 + Math.random() * 4.5; }
    piscar = Math.max(sono * 0.9, t < fimPiscada ? Math.sin(Math.PI * (1 - (fimPiscada - t) / 0.16)) : 0);

    pesos.abre = abre * 0.6;
    pesos.bico = Math.max(0, -largura) * abre * 0.7;
    pesos.estica = Math.max(0, largura) * abre * 0.5;
    pesos.sorri = sorriso;
    pesos.pisca_e = pesos.pisca_d = piscar;
    pesos.sobe_e = pesos.sobe_d = sobrancelha;
    aplicarExpressoes();

    // cabeça viva: balanço lento e flutuação; olhos procuram você
    cabeca.rotation.y = 0.12 * Math.sin(t * 0.23) + 0.04 * Math.sin(t * 0.71);
    cabeca.rotation.x = 0.04 * Math.sin(t * 0.31) + (e === "ouvindo" ? -0.03 : 0) + abre * 0.03 + 0.05 * sono;
    cabeca.rotation.z = 0.025 * Math.sin(t * 0.19) + (e === "ouvindo" ? 0.03 : 0);
    cabeca.position.y = 0.3 * Math.sin(t * 0.8);
    if (window.__giro !== undefined) cabeca.rotation.set(0, window.__giro, 0); // só para fotos de teste (modo depurar)
    if (t > proxOlhar) { proxOlhar = t + 0.6 + Math.random() * 2.2; olharAlvo.set((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 2); }
    if (e === "pensando") olharAlvo.set(-7, 6);
    olhar.lerp(olharAlvo, 0.12);
    alvoMundo.set(camera.position.x + olhar.x, camera.position.y + olhar.y, camera.position.z);
    olhos.forEach((o) => o.lookAt(alvoMundo));

    // cor e brilho do estado; falhas rápidas de holograma de vez em quando
    corAlvo.setRGB(...cfg.cor); cor.lerp(corAlvo, 0.06);
    brilho += (cfg.brilho + abre * 0.1 + nivelOuvido * 0.2 - brilho) * 0.08;
    if (t > proxFalha) { falha = t + 0.07 + Math.random() * 0.08; proxFalha = t + 5 + Math.random() * 9; }
    const emFalha = t < falha && window.__giro === undefined;
    cabeca.position.x = emFalha ? (Math.random() - 0.5) * 0.7 : 0;
    uni.uCor.value.copy(cor); uni.uT.value = t;
    uni.uBrilho.value = brilho * (emFalha ? 0.55 : 1) * (0.97 + 0.03 * Math.sin(t * 37));
    riscos.forEach((r, i) => { const k = r.forca * brilho * Math.max(0, Math.sin(t * r.vel + r.fase)) ** 3;
      corRiscos.set([cor.r * k * 0.3, cor.g * k * 0.3, cor.b * k * 0.3, cor.r * k, cor.g * k, cor.b * k], i * 6); });
    geoRiscos.attributes.color.needsUpdate = true;
    for (let i = 0; i < QP; i++) { posPart[i * 3 + 1] += velPart[i] * 0.01; if (posPart[i * 3 + 1] > 20) posPart[i * 3 + 1] = -20; }
    geoPart.attributes.position.needsUpdate = true; particulas.material.color.copy(cor);
    bloom.strength = 0.55 + abre * 0.15 + nivelOuvido * 0.1;

    composer.render();
  }
  requestAnimationFrame(quadro);
  if (location.search.includes("depurar")) window.__rosto = { cena, halo, particulas, bloom, composer, renderer, cabeca, matLinhas, pesos };
  return { renderer };
}
