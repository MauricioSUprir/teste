// GIDEON — rosto holográfico, no estilo do logo: cabeça de luz azul, pontos em grade na pele, olhos brilhantes,
// sorriso leve. Rosto ORIGINAL (malha facial genérica do MediaPipe, não é a imagem de nenhuma pessoa).
// A boca abre com a voz do GIDEON; os olhos piscam e olham para você; a cabeça flutua.
// Lê o estado da página por window.gideonSinais() → { estado, mic, voz, analisador }.
import * as T from "./vendor/three-gideon.js";
import { POS, TRI } from "./rosto-malha.js";

const sinais = () => (window.gideonSinais ? window.gideonSinais() : { estado: "desligado", mic: 0, voz: 0, analisador: null });
const lerp = (a, b, t) => a + (b - a) * t;
const suave = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------- pontos da malha (numeração do MediaPipe) ----------
const LABIO_INF = [146, 91, 181, 84, 17, 314, 405, 321, 375, 95, 88, 178, 87, 14, 317, 402, 318, 324];
const LABIO_SUP = [185, 40, 39, 37, 0, 267, 269, 270, 409, 191, 80, 81, 82, 13, 312, 311, 310, 415];
const CANTOS = [61, 291, 78, 308];
const OLHOS = [
  { sup: [246, 161, 160, 159, 158, 157, 173], inf: [33, 7, 163, 144, 145, 153, 154, 155, 133], acima: [247, 30, 29, 27, 28, 56, 190] },
  { sup: [466, 388, 387, 386, 385, 384, 398], inf: [263, 249, 390, 373, 374, 380, 381, 382, 362], acima: [467, 260, 259, 257, 258, 286, 414] },
];
const SOBRANCELHAS = [156, 70, 63, 105, 66, 107, 55, 193, 35, 124, 46, 53, 52, 65, 383, 300, 293, 334, 296, 336, 285, 417, 265, 353, 276, 283, 282, 295];
const CONTORNO = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
const CENTRO = new T.Vector3(0, 1.5, -4.0); // meio da cabeça (de onde sai o crânio)

export function iniciarRosto(palco) {
  // ---------- malha do rosto (traços suaves e sorriso leve) ----------
  const N = POS.length / 3, B = new Float32Array(POS), tri = new Uint16Array(TRI);
  { let soma = 0; // garante que os triângulos olham para a frente
    for (let i = 0; i < tri.length; i += 3) { const [a, b, c] = [tri[i] * 3, tri[i + 1] * 3, tri[i + 2] * 3];
      soma += (B[b] - B[a]) * (B[c + 1] - B[a + 1]) - (B[b + 1] - B[a + 1]) * (B[c] - B[a]); }
    if (soma < 0) for (let i = 0; i < tri.length; i += 3) { const t = tri[i + 1]; tri[i + 1] = tri[i + 2]; tri[i + 2] = t; } }
  // proporções no estilo do logo e do holograma: rosto mais longo e estreito, maçãs marcadas, bochecha funda, maxilar fino até o queixo
  for (let i = 0; i < N; i++) {
    let x = B[i * 3], y = B[i * 3 + 1], z = B[i * 3 + 2];
    y += 0.3 * suave(-7, -9.4, y);                                                      // queixo um pouco menor (olhos ficam no meio da cabeça)
    x *= 0.9 * (1 - 0.2 * suave(-2.5, -10.5, y));                                       // mais estreito; maxilar afina até o queixo
    const ax = Math.abs(x);
    // relevo (rosto menos achatado): profundidade geral maior, olhos fundos, sobrancelha, nariz, maçãs, lábios e queixo saltando
    z = 0.6 + (z - 0.6) * 1.2;
    const orbita = 1 - suave(0.55, 1.45, Math.hypot((ax - 2.8) / 1.05, (y - 2.7) / 0.85));
    z -= 0.45 * orbita;                                                                  // olhos mais fundos
    z += 0.12 * suave(0.8, 1.8, ax) * suave(5.2, 4.4, ax) * suave(3.4, 3.9, y) * suave(5.4, 4.6, y); // arco da sobrancelha
    z += 0.55 * suave(3.0, 5.4, ax) * suave(-1.4, 0.4, y) * suave(2.6, 1.0, y);        // maçãs do rosto
    z -= 0.55 * suave(3.0, 5.0, ax) * suave(-1.6, -3.2, y) * suave(-6.4, -4.4, y);    // bochecha funda abaixo da maçã
    z += 0.6 * suave(2.8, 0.6, ax) * suave(-6.8, -8.2, y);                              // queixo marcado (não fica para trás no perfil)
    const nariz = suave(2.4, 1.0, ax) * suave(-3.0, -1.8, y) * suave(3.2, 2.0, y) * suave(5.0, 6.2, z);
    z += (z - 5.0) * 0.03 * nariz; x *= 1 - 0.12 * nariz;                               // nariz fino
    B[i * 3] = x; B[i * 3 + 1] = y; B[i * 3 + 2] = z;
  }
  for (const i of [185, 40, 39, 37, 0, 267, 269, 270, 409]) { B[i * 3 + 1] += 0.08; B[i * 3 + 2] += 0.15; }
  for (const i of [146, 91, 181, 84, 17, 314, 405, 321, 375]) { B[i * 3 + 1] -= 0.1; B[i * 3 + 2] += 0.15; }
  for (const i of SOBRANCELHAS) B[i * 3 + 1] += 0.15;
  for (const i of [95, 88, 178, 87, 14, 317, 402, 318, 324]) B[i * 3 + 1] += 0.42; // fecha a fresta da malha original
  for (const i of [191, 80, 81, 82, 13, 312, 311, 310, 415]) B[i * 3 + 1] -= 0.06;
  for (const [i, k] of [[61, 1], [291, 1], [78, 0.8], [308, 0.8], [146, 0.4], [375, 0.4], [185, 0.4], [409, 0.4], [57, 0.5], [287, 0.5]]) B[i * 3 + 1] += 0.22 * k; // sorriso
  for (const [i, k] of [[63, 0.2], [105, 0.2], [70, 0.1], [53, 0.15], [52, 0.12], [293, 0.2], [334, 0.2], [300, 0.1], [283, 0.15], [282, 0.12]]) B[i * 3 + 1] += k; // arco da sobrancelha
  for (const o of OLHOS) { // olhos um pouco mais abertos
    for (const i of o.sup) B[i * 3 + 1] += 0.13;
    for (const i of o.acima) B[i * 3 + 1] += 0.07;
    for (const i of o.inf.slice(1, -1)) B[i * 3 + 1] -= 0.07;
  }
  const yBoca = (B[13 * 3 + 1] + B[14 * 3 + 1]) / 2;

  const pesoQueixo = new Float32Array(N);
  for (let i = 0; i < N; i++) pesoQueixo[i] = suave(0, 1.3, yBoca - B[i * 3 + 1]);
  for (const i of LABIO_SUP) pesoQueixo[i] = 0;
  for (const i of LABIO_INF) pesoQueixo[i] = 1;
  for (const i of CANTOS) pesoQueixo[i] = 0.45;
  const naBoca = new Float32Array(N);
  for (const i of [...LABIO_SUP, ...LABIO_INF]) naBoca[i] = 0.55;
  for (const i of CANTOS) naBoca[i] = 1;
  const palpebras = OLHOS.map((o) => {
    const alvo = (i) => { let m = o.inf[0], d = 1e9; for (const j of o.inf) { const dd = Math.abs(B[j * 3] - B[i * 3]); if (dd < d) { d = dd; m = j; } } return B[m * 3 + 1] + 0.04; };
    const centro = [0, 0, 0]; for (const i of [...o.sup, ...o.inf]) for (let k = 0; k < 3; k++) centro[k] += B[i * 3 + k] / (o.sup.length + o.inf.length);
    return { sup: o.sup.map((i) => ({ i, alvo: alvo(i) })), acima: o.acima.map((i, n) => ({ i, abre: B[o.sup[n] * 3 + 1] - alvo(o.sup[n]) })), centro };
  });

  // ---------- crânio: estende o contorno do rosto para trás até fechar a cabeça ----------
  // Perfil no estilo do holograma: alto da cabeça grande, têmporas fechadas, nuca que entra para o pescoço.
  const PERFIL = [ // altura (y), meia-largura, frente (z), trás (z) — em cm
    [14.0, 0.0, -3.6, -3.6], [13.6, 2.5, -1.0, -6.4], [12.8, 4.4, 1.6, -9.4], [11.3, 5.8, 3.5, -11.4], [8.5, 6.6, 4.6, -12.9], [5, 6.75, 5.0, -13.3],
    [2, 6.6, 5.0, -12.6], [-1, 6.15, 4.8, -11.0], [-3.5, 5.6, 4.2, -9.3], [-5.6, 5.1, 3.0, -7.9], [-8.0, 3.6, 1.6, -6.6], [-9.6, 1.8, 0.2, -4.6], [-10.4, 0, -2.2, -2.2],
  ];
  const perfil = (y) => {
    if (y >= PERFIL[0][0]) return PERFIL[0];
    for (let k = 1; k < PERFIL.length; k++) if (y >= PERFIL[k][0]) { const a = PERFIL[k - 1], b = PERFIL[k], t = (y - b[0]) / (a[0] - b[0]); return b.map((v, n) => lerp(v, a[n], t)); }
    return PERFIL[PERFIL.length - 1];
  };
  const dentro = (p) => { const [, w, f, t] = perfil(p.y); if (w <= 0) return false; const zc = (f + t) / 2, dz = (f - t) / 2; return (p.x / w) ** 2 + ((p.z - zc) / dz) ** 2 <= 1; };
  const raioEm = (d) => { let a = 0, b = 30; for (let n = 0; n < 28; n++) { const m = (a + b) / 2; if (dentro(CENTRO.clone().addScaledVector(d, m))) a = m; else b = m; } return a; };
  const slerp = (a, b, t) => a.clone().applyQuaternion(new T.Quaternion().slerp(new T.Quaternion().setFromUnitVectors(a, b), t));
  const K = CONTORNO.length, M = 18, atras = new T.Vector3(0, 0.08, -1).normalize();
  const posCranio = new Float32Array((M + 1) * K * 3);
  for (let j = 0; j <= M; j++) for (let k = 0; k < K; k++) {
    const i = CONTORNO[k], v = new T.Vector3(B[i * 3], B[i * 3 + 1], B[i * 3 + 2]);
    const u = j / M, d0 = v.clone().sub(CENTRO), r0 = d0.length(); d0.normalize();
    const d = u < 1 ? slerp(d0, atras, u) : atras.clone();
    const r = lerp(r0, raioEm(d), suave(0, 0.35, u));
    posCranio.set(CENTRO.clone().add(d.multiplyScalar(r)).toArray(), (j * K + k) * 3);
  }
  const idxCranio = [];
  for (let j = 0; j < M; j++) for (let k = 0; k < K; k++) {
    const a = j * K + k, b = j * K + (k + 1) % K, c = (j + 1) * K + k, d = (j + 1) * K + (k + 1) % K;
    idxCranio.push(a, b, c, b, d, c);
  }
  { // vira os triângulos para fora, se preciso
    const p = (n) => new T.Vector3().fromArray(posCranio, idxCranio[n] * 3);
    const nrm = p(1).sub(p(0)).cross(p(2).sub(p(0))), fora = new T.Vector3().fromArray(posCranio, (K + 3) * 3).sub(CENTRO);
    if (nrm.dot(fora) < 0) for (let n = 0; n < idxCranio.length; n += 3) { const t = idxCranio[n + 1]; idxCranio[n + 1] = idxCranio[n + 2]; idxCranio[n + 2] = t; }
  }

  // ---------- cena ----------
  const renderer = new T.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  // #04060c: o composer converte a cor de limpeza para sRGB duas vezes; este valor compensa e o fundo sai igual ao da página
  renderer.setClearColor(new T.Color().setRGB(0.0012 / 12.92, 0.0018 / 12.92, 0.0037 / 12.92), 1);
  renderer.domElement.id = "rosto";
  document.body.prepend(renderer.domElement);
  const cena = new T.Scene(), camera = new T.PerspectiveCamera(30, 1, 1, 400), cabeca = new T.Group(); cena.add(cabeca);
  const uni = { uCor: { value: new T.Color(0.25, 0.78, 1) }, uT: { value: 0 }, uBrilho: { value: 1 } };

  // pele de luz: borda brilhante, volume suave, linhas de varredura, faixa que desce e pontos em grade (como no logo)
  const VERT = `attribute vec3 aBase; varying vec3 vN; varying vec3 vV; varying vec3 vW; varying vec3 vB;
    void main(){ vB = aBase; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vN = normalize(normalMatrix * normal);
      vec4 mv = viewMatrix * w; vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
  const FRAG = `uniform vec3 uCor; uniform float uT, uBrilho, uPinos, uSome; varying vec3 vN; varying vec3 vV; varying vec3 vW; varying vec3 vB;
    void main(){ vec3 n = normalize(vN); float fr = pow(1.0 - abs(dot(n, normalize(vV))), 2.0);
      vec3 L = normalize(vec3(-0.3, 0.6, 0.75)); float luz = max(dot(n, L), 0.0);
      float esp = pow(max(dot(reflect(-L, n), normalize(vV)), 0.0), 10.0);
      float linhas = 0.86 + 0.14 * sin(vW.y * 7.0 - uT * 2.2);
      float faixa = smoothstep(1.3, 0.0, abs(vW.y - (16.0 - mod(uT * 6.0, 46.0))));
      vec3 q = vB - vec3(0.0, 1.5, -4.0);
      vec2 g = vec2(atan(q.x, q.z) * 8.2, vB.y) / 1.12; vec2 f = fract(g) - 0.5; float d = length(f);
      float rosto = smoothstep(1.5, 4.5, vB.z);
      float pino = smoothstep(0.2, 0.09, d) * (0.5 + 0.5 * smoothstep(0.12, 0.0, length(f - vec2(-0.05, 0.06))));
      float grade = (smoothstep(0.05, 0.0, abs(f.x)) * 0.7 + smoothstep(0.04, 0.0, abs(f.y)) * 0.3) * 0.09;
      float pontos = uPinos * (pino * mix(0.75, 0.38, rosto) + grade * (1.0 - 0.6 * rosto));
      float a = (0.006 + 0.36 * fr + 0.34 * pow(luz, 1.8) + 0.2 * esp) * linhas + 0.14 * faixa + pontos * (0.22 + 0.7 * luz);
      a *= mix(1.0, 0.8 * smoothstep(-4.5, 4.5, vB.y), uSome); // pescoço some para baixo
      gl_FragColor = vec4(uCor * a * uBrilho, 1.0); }`;
  const pele = (pinos = 1) => { const m = new T.ShaderMaterial({ uniforms: { ...uni, uPinos: { value: pinos }, uSome: { value: 0 } }, vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, blending: T.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }); return m; };
  // mesma conta de posição da pele (mesmo VERT), para a profundidade bater exatamente e não tremer
  const matProfundidade = new T.ShaderMaterial({ vertexShader: VERT, fragmentShader: "void main(){ gl_FragColor = vec4(0.0); }", colorWrite: false, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  const solido = (m) => { m.add(new T.Mesh(m.geometry, matProfundidade)); return m; }; // passada só de profundidade, desenhada antes
  const matPele = pele(1);

  const geo = new T.BufferGeometry();
  const pos = new T.BufferAttribute(new Float32Array(B), 3).setUsage(T.DynamicDrawUsage);
  geo.setAttribute("position", pos); geo.setAttribute("aBase", new T.BufferAttribute(new Float32Array(B), 3));
  geo.setIndex(new T.BufferAttribute(tri, 1)); geo.computeVertexNormals();
  const malha = solido(new T.Mesh(geo, matPele)); malha.renderOrder = 1; cabeca.add(malha);

  const geoCranio = new T.BufferGeometry();
  const posC = new T.BufferAttribute(posCranio, 3).setUsage(T.DynamicDrawUsage);
  geoCranio.setAttribute("position", posC); geoCranio.setAttribute("aBase", new T.BufferAttribute(new Float32Array(posCranio), 3));
  geoCranio.setIndex(idxCranio); geoCranio.computeVertexNormals();
  const cranio = solido(new T.Mesh(geoCranio, matPele)); cranio.renderOrder = 1; cabeca.add(cranio);

  // orelhas: forma de C com a borda (hélice), a dobra de dentro e o lóbulo; um pouco abertas para fora
  const formaOrelha = new T.Shape();
  formaOrelha.moveTo(0, 2.3);
  formaOrelha.bezierCurveTo(0.25, 3.3, 1.9, 3.45, 2.55, 2.35);
  formaOrelha.bezierCurveTo(3.1, 1.4, 2.95, -0.4, 2.35, -1.45);
  formaOrelha.bezierCurveTo(1.95, -2.2, 1.65, -3.05, 0.95, -3.15);
  formaOrelha.bezierCurveTo(0.35, -3.2, 0.05, -2.65, 0.15, -2.0);
  formaOrelha.bezierCurveTo(0.4, -1.2, 0.05, -0.5, 0.15, 0.3);
  formaOrelha.lineTo(0, 2.3);
  const geoOrelha = new T.ExtrudeGeometry(formaOrelha, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.16, bevelSize: 0.2, bevelSegments: 3, curveSegments: 18 });
  const curva = (pts, z) => new T.CatmullRomCurve3(pts.map(([u, v]) => new T.Vector3(u, v, z)));
  const geoBorda = new T.TubeGeometry(curva([[0.35, 2.2], [0.9, 2.95], [1.9, 2.95], [2.55, 2.0], [2.65, 0.6], [2.2, -1.0], [1.6, -2.0]], 0.4), 40, 0.19, 8, false);
  const geoDobra = new T.TubeGeometry(curva([[1.0, 2.15], [1.7, 1.6], [1.9, 0.4], [1.5, -0.8], [1.0, -1.3]], 0.36), 30, 0.13, 8, false);
  const partesOrelha = [geoOrelha, geoBorda, geoDobra];
  for (const g of partesOrelha) g.setAttribute("aBase", g.attributes.position.clone());
  const matOrelha = pele(0);
  for (const lado of [-1, 1]) {
    const base = new T.Group(), giro = new T.Group();
    giro.rotation.y = lado * (Math.PI / 2 - 0.62); if (lado < 0) giro.scale.x = -1; // a de lá é o espelho da de cá
    for (const g of partesOrelha) { const m = solido(new T.Mesh(g, matOrelha)); m.renderOrder = 1; giro.add(m); }
    base.add(giro); base.position.set(lado * 6.4, 1.5, -3.0); base.rotation.x = -0.2; base.scale.setScalar(1.0);
    cabeca.add(base);
  }

  // pescoço: aparece embaixo do maxilar e some para baixo
  const geoPescoco = new T.CylinderGeometry(3.7, 4.3, 15, 40, 10, true); geoPescoco.setAttribute("aBase", geoPescoco.attributes.position.clone());
  const matPescoco = pele(0); matPescoco.uniforms.uSome.value = 1;
  const pescoco = solido(new T.Mesh(geoPescoco, matPescoco)); pescoco.scale.set(1, 1, 1.05); pescoco.position.set(0, -12.6, -3.3); pescoco.renderOrder = 2; cabeca.add(pescoco); // depois do rosto: a parte de trás do queixo fica escondida

  // linhas finas da malha do rosto
  const arestas = new Map();
  for (let i = 0; i < tri.length; i += 3) for (const [a, b] of [[tri[i], tri[i + 1]], [tri[i + 1], tri[i + 2]], [tri[i + 2], tri[i]]]) arestas.set(Math.min(a, b) * 1000 + Math.max(a, b), [a, b]);
  const geoL = new T.BufferGeometry(); geoL.setAttribute("position", pos); geoL.setIndex([...arestas.values()].flat());
  const matLinhas = new T.LineBasicMaterial({ color: 0x5fd8ff, transparent: true, opacity: 0.07, blending: T.AdditiveBlending, depthWrite: false });
  const linhas = new T.LineSegments(geoL, matLinhas); linhas.renderOrder = 3; cabeca.add(linhas);

  const laco = (l) => l.flatMap((v, k) => [v, l[(k + 1) % l.length]]);
  const OLHO_A = [33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7];
  const OLHO_B = [263, 466, 388, 387, 386, 385, 384, 398, 362, 382, 381, 380, 374, 373, 390, 249];
  const BOCA = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146];
  const BOCA_DENTRO = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95];
  const geoTracos = new T.BufferGeometry(); geoTracos.setAttribute("position", pos);
  geoTracos.setIndex([...laco(OLHO_A), ...laco(OLHO_B), ...laco(BOCA_DENTRO), ...laco(BOCA)]);
  const matTracos = new T.LineBasicMaterial({ color: 0x8fd8ff, transparent: true, opacity: 0.5, blending: T.AdditiveBlending, depthWrite: false });
  const tracos = new T.LineSegments(geoTracos, matTracos); tracos.renderOrder = 3; cabeca.add(tracos);

  // fundo da boca (escuro quando ela abre)
  const fundoBoca = new T.Mesh(new T.CircleGeometry(1, 24), new T.MeshBasicMaterial({ color: 0x04060c }));
  fundoBoca.scale.set(2.3, 1.1, 1); fundoBoca.position.set(0, yBoca - 0.35, 4.25); fundoBoca.renderOrder = 0; cabeca.add(fundoBoca);

  // ---------- olhos de luz ----------
  const matOlho = new T.ShaderMaterial({ uniforms: uni, transparent: true, blending: T.AdditiveBlending, depthWrite: false,
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uCor; uniform float uT, uBrilho; varying vec3 vP;
      void main(){ float d = acos(clamp(vP.z, -1.0, 1.0)); float ang = atan(vP.y, vP.x);
        float iris = smoothstep(0.52, 0.46, d), pupila = smoothstep(0.17, 0.13, d), aro = smoothstep(0.36, 0.47, d) * iris;
        float raios = 0.6 + 0.4 * sin(ang * 26.0 + d * 18.0 + uT * 0.4);
        float reflexo = smoothstep(0.12, 0.0, distance(vP.xy, vec2(-0.15, 0.18))) * iris;
        vec3 c = uCor * ((iris - pupila * 0.7) * (0.7 * raios + 1.1 * aro) + (1.0 - iris) * 0.55) + vec3(0.8, 0.95, 1.0) * (reflexo * 1.4 + iris * 0.35);
        gl_FragColor = vec4(c * uBrilho * 1.5, 1.0); }` });
  const olhos = palpebras.map((p) => {
    const o = new T.Mesh(new T.SphereGeometry(1.06, 32, 24), matOlho);
    o.position.set(p.centro[0], p.centro[1] - 0.05, p.centro[2] - 0.85); o.renderOrder = 2; cabeca.add(o); return o; });

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
  const bloom = new T.UnrealBloomPass(new T.Vector2(256, 256), 0.7, 0.32, 0.02);
  if (!location.search.includes("semBloom")) composer.addPass(bloom);
  composer.addPass(new T.OutputPass());
  const MEIO = 0.6;
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
  const P = pos.array, ESTADOS = {
    desligado: { cor: [0.08, 0.28, 0.75], brilho: 0.55 }, conectando: { cor: [0.18, 0.32, 1], brilho: 0.85 },
    ouvindo: { cor: [0.12, 0.42, 1], brilho: 1 }, falando: { cor: [0.13, 0.45, 1], brilho: 1 },
    pensando: { cor: [0.32, 0.28, 1], brilho: 0.95 }, erro: { cor: [1, 0.2, 0.25], brilho: 0.75 },
  };
  const cor = new T.Color(0.08, 0.28, 0.75), corAlvo = new T.Color();
  let abre = 0, largura = 0, piscar = 0, proxPiscada = 2, fimPiscada = 0, sono = 1, sobrancelha = 0, brilho = 0.5, nivelOuvido = 0;
  const olhar = new T.Vector2(), olharAlvo = new T.Vector2(); let proxOlhar = 0, falha = 0, proxFalha = 6;
  const freq = new Uint8Array(256), alvoMundo = new T.Vector3(), t0 = performance.now();

  function quadro(agora) {
    try { passo(agora); } catch (e) { // qualquer falha no 3D: volta para o círculo, e a conversa continua
      console.error("rosto 3D:", e); renderer.domElement.remove(); document.body.classList.remove("com-rosto"); window.gideonOrbe?.(); return; }
    requestAnimationFrame(quadro);
  }
  function passo(agora) {
    const t = (agora - t0) / 1000, s = sinais(), e = ESTADOS[s.estado] ? s.estado : "desligado", cfg = ESTADOS[e];
    // voz → abertura da boca (sobe rápido, desce mais devagar) e formato (agudos esticam, graves arredondam)
    let alvoAbre = 0, alvoLarg = 0;
    if (e === "falando" && s.voz > 0) {
      alvoAbre = Math.pow(Math.min(1, Math.max(0, (s.voz - 0.012) / 0.17)), 0.8);
      if (s.analisador) { s.analisador.getByteFrequencyData(freq);
        let g = 0, a = 0; for (let i = 2; i < 20; i++) g += freq[i]; for (let i = 43; i < 107; i++) a += freq[i];
        alvoLarg = Math.max(-1, Math.min(1, (a / 64 - (g / 18) * 0.55) / 60)); }
    }
    abre += (alvoAbre - abre) * (alvoAbre > abre ? 0.55 : 0.25);
    largura += (alvoLarg - largura) * 0.2;
    sobrancelha += ((e === "falando" ? abre * 0.6 : e === "pensando" ? 0.5 : 0) - sobrancelha) * 0.08;
    nivelOuvido += ((e === "ouvindo" ? Math.min(1, s.mic * 8) : 0) - nivelOuvido) * 0.2;
    sono += ((e === "desligado" ? 1 : 0) - sono) * 0.04;
    if (t > proxPiscada) { fimPiscada = t + 0.16; proxPiscada = t + 2.2 + Math.random() * 4.5; }
    piscar = Math.max(sono * 0.92, t < fimPiscada ? Math.sin(Math.PI * (1 - (fimPiscada - t) / 0.16)) : 0);

    // deforma o rosto a partir da base
    const ang = abre * 0.17, ca = Math.cos(ang), sa = Math.sin(ang), PY = 0, PZ = -1.5;
    for (let i = 0; i < N; i++) {
      let x = B[i * 3], y = B[i * 3 + 1], z = B[i * 3 + 2];
      const w = pesoQueixo[i];
      if (w > 0) { const a2 = ang * w, c2 = w === 1 ? ca : Math.cos(a2), s2 = w === 1 ? sa : Math.sin(a2), dy = y - PY, dz = z - PZ;
        y = PY + dy * c2 - dz * s2; z = PZ + dy * s2 + dz * c2; }
      if (naBoca[i]) x *= 1 + naBoca[i] * (0.07 * largura - 0.04 * abre);
      P[i * 3] = x; P[i * 3 + 1] = y; P[i * 3 + 2] = z;
    }
    for (const i of LABIO_SUP) P[i * 3 + 1] += abre * 0.12;
    for (const i of SOBRANCELHAS) P[i * 3 + 1] += sobrancelha * 0.3;
    for (const p of palpebras) {
      for (const { i, alvo } of p.sup) P[i * 3 + 1] = lerp(B[i * 3 + 1], alvo, piscar);
      for (const { i, abre: h } of p.acima) P[i * 3 + 1] = B[i * 3 + 1] + sobrancelha * 0.12 - h * piscar * 0.45;
    }
    pos.needsUpdate = true; geo.computeVertexNormals();
    for (let k = 0; k < K; k++) posCranio.set([P[CONTORNO[k] * 3], P[CONTORNO[k] * 3 + 1], P[CONTORNO[k] * 3 + 2]], k * 3); // a borda acompanha o queixo
    posC.needsUpdate = true; geoCranio.computeVertexNormals();

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
    const emFalha = t < falha;
    cabeca.position.x = emFalha ? (Math.random() - 0.5) * 0.7 : 0;
    uni.uCor.value.copy(cor); uni.uT.value = t;
    uni.uBrilho.value = brilho * (emFalha ? 0.55 : 1) * (0.97 + 0.03 * Math.sin(t * 37));
    matLinhas.color.copy(cor); matLinhas.opacity = 0.07 * brilho;
    matTracos.color.copy(cor).lerp(new T.Color(1, 1, 1), 0.35); matTracos.opacity = 0.13 * brilho;
    riscos.forEach((r, i) => { const k = r.forca * brilho * Math.max(0, Math.sin(t * r.vel + r.fase)) ** 3;
      corRiscos.set([cor.r * k * 0.3, cor.g * k * 0.3, cor.b * k * 0.3, cor.r * k, cor.g * k, cor.b * k], i * 6); });
    geoRiscos.attributes.color.needsUpdate = true;
    for (let i = 0; i < QP; i++) { posPart[i * 3 + 1] += velPart[i] * 0.01; if (posPart[i * 3 + 1] > 20) posPart[i * 3 + 1] = -20; }
    geoPart.attributes.position.needsUpdate = true; particulas.material.color.copy(cor);
    bloom.strength = 0.65 + abre * 0.2 + nivelOuvido * 0.12;

    composer.render();
  }
  requestAnimationFrame(quadro);
  if (location.search.includes("depurar")) window.__rosto = { cena, halo, particulas, bloom, composer, renderer, cabeca };
  return { renderer };
}
