// "Rastejadores": artrópodes subterrâneos marcianos (ficção científica "pé no chão").
// Corpo segmentado de quitina escura empoeirada, 6 pernas com passada em tripé (IK analítico de 2 ossos),
// manchas bioluminescentes turquesa (brilham à noite e ACENDEM antes do bote — o aviso para desviar).
// Desempenho: corpo = 1 malha por criatura (material clonado só para o flash de dano, mesmo programa),
// todas as pernas = 1 InstancedMesh, todas as manchas = 1 Points aditivo. Sem luzes novas.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Terrain } from '../world/terrain';
import { enhance, unregister } from '../render/materials';
import { CRAWLER } from './defs';
import type { ItemId } from '../sim/balance';

const MAX = 12;
const LEGS = 6;
const SPOTS = 12; // 8 manchas + 4 olhos
const L1 = 0.42, L2 = 0.5;

export type CState = 'emerge' | 'hunt' | 'chase' | 'circle' | 'windup' | 'lunge' | 'recover' | 'flee' | 'burrow' | 'dead';

export interface Crawler {
  id: number;
  pos: THREE.Vector3;
  yaw: number;
  hp: number;
  state: CState;
  t: number;          // tempo no estado
  atkCd: number;
  phase: number;      // fase da passada
  speed: number;
  flash: number;      // flash branco de dano (s)
  body: THREE.Mesh;
  mat: THREE.MeshStandardMaterial;
  feet: THREE.Vector3[];
  scripted: boolean;  // primeiro contato: foge com 50% de vida
  circleA: number;
  lungeDir: THREE.Vector3;
  hitDone: boolean;
  rear: number;       // quanto está empinado (0..1)
  alive: boolean;
  air: number;        // altura do pulo (bote em arco)
  vy: number;
  guard: THREE.Vector3 | null; // guarda de colmeia: não se enterra de dia, volta para casa
  raid: THREE.Vector3 | null;  // ataque à colônia: marcha até a base e sabota a energia
}

export type Loot = Partial<Record<ItemId, number>>;
export interface CreatureEvents { playerHit: number; screech: boolean; died: Crawler[]; windup: boolean; sabotage: number }

function bodyGeometry() {
  // corpo inteiro por torno (lathe) ao longo do eixo: cabeça, tórax e abdômen com estrangulamentos
  const prof: [number, number][] = [
    [-0.86, 0.0], [-0.8, 0.07], [-0.66, 0.2], [-0.45, 0.3], [-0.22, 0.31], [-0.05, 0.22], [0.0, 0.19],
    [0.06, 0.26], [0.2, 0.3], [0.33, 0.25], [0.4, 0.16], [0.44, 0.18], [0.54, 0.2], [0.66, 0.15], [0.74, 0.06], [0.77, 0.0],
  ];
  const pts = prof.map(([z, r]) => new THREE.Vector2(Math.max(0.001, r), z));
  const g = new THREE.LatheGeometry(pts, 28);
  g.rotateX(Math.PI / 2); // eixo do torno (y) → comprimento em z
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = -p.getZ(i);
    // placas de armadura: anéis em relevo ao longo do corpo
    const ring = 1 + 0.06 * Math.max(0, Math.sin(z * 26));
    x *= ring * 1.12; y *= ring;
    // ventre achatado, dorso arqueado
    y = y < 0 ? y * 0.45 : y * 0.78;
    p.setXYZ(i, x, y + 0.02, z);
  }
  g.computeVertexNormals();
  const parts: { g: THREE.BufferGeometry; c: [number, number, number] }[] = [{ g, c: [1, 1, 1] }];
  // quilha de espinhos dorsais altos (silhueta agressiva contra o céu)
  for (let i = 0; i < 6; i++) { const c = new THREE.ConeGeometry(0.035, 0.22 - i * 0.02, 6); c.rotateX(-0.45); c.translate(0, 0.26 - Math.abs(i - 2) * 0.012, 0.3 - i * 0.18); parts.push({ g: c, c: [1.4, 1.1, 1] }); }
  // carne da boca: vermelho-escuro, visível de frente entre as mandíbulas
  const mouth = new THREE.SphereGeometry(0.06, 10, 8); mouth.scale(1.2, 0.7, 0.6); mouth.translate(0, -0.01, 0.76);
  parts.push({ g: mouth, c: [5.0, 0.45, 0.4] });
  for (const s of [-1, 1]) {
    // mandíbulas: foices longas abertas para os lados
    const m = new THREE.ConeGeometry(0.05, 0.34, 7); m.rotateX(Math.PI / 2); m.rotateY(-s * 0.7); m.translate(s * 0.13, -0.03, 0.9);
    parts.push({ g: m, c: [1.6, 1.25, 1.1] });
    // dentes internos
    for (let k = 0; k < 3; k++) { const d = new THREE.ConeGeometry(0.012, 0.06, 4); d.rotateZ(s * Math.PI / 2); d.translate(s * (0.07 + k * 0.025), -0.02, 0.8 + k * 0.05); parts.push({ g: d, c: [6, 5.5, 5] }); }
    // palpos sensoriais
    const pa = new THREE.CylinderGeometry(0.012, 0.006, 0.28, 5); pa.rotateX(1.2); pa.rotateZ(s * 0.5); pa.translate(s * 0.1, 0.1, 0.8); parts.push({ g: pa, c: [1, 1, 1] });
  }
  const merged = mergeGeometries(parts.map(({ g: q, c }) => {
    const n = q.index ? q.toNonIndexed() : q; n.deleteAttribute('uv');
    const col = new Float32Array(n.attributes.position.count * 3);
    for (let i = 0; i < col.length; i += 3) { col[i] = c[0]; col[i + 1] = c[1]; col[i + 2] = c[2]; }
    n.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return n;
  }))!;
  return merged;
}

// posições das manchas no corpo (espaço local)
const SPOT_LOCAL = [
  [0.12, 0.13, 0.5], [-0.12, 0.13, 0.5], [0.24, 0.12, 0.12], [-0.24, 0.12, 0.12],
  [0.26, 0.15, -0.35], [-0.26, 0.15, -0.35], [0.14, 0.2, -0.62], [-0.14, 0.2, -0.62],
  // 4 olhos vermelhos na cabeça (os últimos 4)
  [0.06, 0.12, 0.74], [-0.06, 0.12, 0.74], [0.11, 0.09, 0.68], [-0.11, 0.09, 0.68],
].map(([x, y, z]) => new THREE.Vector3(x, y, z));
const EYE0 = 8;
const HUNT_STATES = new Set<CState>(['chase', 'circle', 'windup', 'lunge', 'recover']);
// quadris (3 por lado) e fase da passada em tripé (0 = grupo A, π = grupo B)
const HIPS = [[0.26, 0.28], [0.3, 0.05], [0.28, -0.25]].flatMap(([x, z], i) => [
  { p: new THREE.Vector3(x, 0.02, z), side: 1, ph: i % 2 ? Math.PI : 0 },
  { p: new THREE.Vector3(-x, 0.02, z), side: -1, ph: i % 2 ? 0 : Math.PI },
]);

export class Creatures {
  group = new THREE.Group();
  list: Crawler[] = [];
  private bodyGeo = bodyGeometry();
  private baseMat: THREE.MeshStandardMaterial;
  private legs: THREE.InstancedMesh;
  private spots: THREE.Points;
  private spotPos: Float32Array;
  private spotI: Float32Array;
  private nextId = 1;
  private m = new THREE.Matrix4();
  private tmpQ = new THREE.Quaternion();
  private tmpV = new THREE.Vector3();
  // rascunhos reaproveitados (sem lixo de memória por quadro no iPhone)
  private sToP = new THREE.Vector3(); private sDir = new THREE.Vector3(); private sWant = new THREE.Vector3();
  private sQ = new THREE.Quaternion(); private sTilt = new THREE.Quaternion(); private sE = new THREE.Euler();
  private sOut = new THREE.Vector3(); private sFwd = new THREE.Vector3(); private sBend = new THREE.Vector3(); private sCross = new THREE.Vector3(); private sScale = new THREE.Vector3(1, 1, 1);
  private static UP = new THREE.Vector3(0, 1, 0);
  night = 0;
  drops: { mesh: THREE.Mesh; give: Loot; t: number }[] = [];
  private dropGeo = new THREE.DodecahedronGeometry(0.12, 0);
  private dropMat: THREE.MeshStandardMaterial;

  constructor(private terrain: Terrain) {
    // quitina basalto-marrom, rugosidade 0,55; a poeira nas faces de cima vem do patch "std" (enhance)
    // quitina escura e brilhante (verniz natural), leve tom avermelhado de óxido nas placas
    this.baseMat = enhance(new THREE.MeshStandardMaterial({ vertexColors: true, color: new THREE.Color(0.07, 0.035, 0.025), roughness: 0.45, metalness: 0.0, envMapIntensity: 0.35, emissive: new THREE.Color(1, 1, 1), emissiveIntensity: 0 }), 'clean');
    // segmento de perna afunilado com junta esférica na base (1 malha, 12 instâncias por criatura)
    const seg = new THREE.CylinderGeometry(0.018, 0.034, 1, 7, 1); seg.translate(0, 0.5, 0);
    const joint = new THREE.SphereGeometry(0.038, 8, 6);
    const legGeo = mergeGeometries([seg.toNonIndexed(), joint.toNonIndexed()].map((q) => { q.deleteAttribute('uv'); return q; }))!;
    const legMat = enhance(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.035, 0.024, 0.02), roughness: 0.6, metalness: 0.0, envMapIntensity: 0.35 }), 'clean');
    this.legs = new THREE.InstancedMesh(legGeo, legMat, MAX * LEGS * 2);
    this.legs.count = 0;
    this.legs.castShadow = true;
    this.legs.frustumCulled = false;
    // manchas: pontos aditivos que ignoram a névoa (ficam visíveis a 40 m na tempestade)
    this.spotPos = new Float32Array(MAX * SPOTS * 3);
    this.spotI = new Float32Array(MAX * SPOTS);
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(this.spotPos, 3));
    sg.setAttribute('aI', new THREE.BufferAttribute(this.spotI, 1));
    // cor por ponto: manchas turquesa, olhos vermelhos
    const sc = new Float32Array(MAX * SPOTS * 3);
    for (let i = 0; i < MAX * SPOTS; i++) { const eye = i % SPOTS >= EYE0; sc.set(eye ? [1.0, 0.12, 0.04] : [0.25, 0.88, 0.78], i * 3); }
    sg.setAttribute('aC', new THREE.BufferAttribute(sc, 3));
    sg.setDrawRange(0, 0);
    const sm = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      uniforms: { uScale: { value: 600 } },
      vertexShader: `attribute float aI; attribute vec3 aC; varying float vI; varying vec3 vC; uniform float uScale;
        void main(){ vI = aI; vC = aC; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv;
          // olhos: mínimo de 3 px para serem vistos a 20 m no iPhone
          float mn = aC.r > 0.9 ? 4.0 : 2.0;
          gl_PointSize = clamp(uScale * 0.035 / -mv.z, mn, 14.0) * (0.7 + 0.3*min(aI, 2.0)); }`,
      fragmentShader: `varying float vI; varying vec3 vC;
        void main(){ vec2 d = gl_PointCoord - 0.5; float a = exp(-dot(d,d)*18.0);
          gl_FragColor = vec4(vC * a * min(vI, 6.0) * 0.55, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.spots = new THREE.Points(sg, sm);
    this.spots.frustumCulled = false;
    this.dropMat = enhance(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.16, 0.26, 0.15), roughness: 0.4, emissive: new THREE.Color(0.25, 0.88, 0.78), emissiveIntensity: 0.6 }), 'clean');
    this.group.add(this.legs, this.spots);
  }

  /** materiais pré-compilados no carregamento (evita travadas no primeiro contato) */
  warmup(scene: THREE.Scene) {
    const b = new THREE.Mesh(this.bodyGeo, enhance(this.baseMat.clone(), 'clean'));
    const d = new THREE.Mesh(this.dropGeo, this.dropMat);
    b.position.set(0, -5000, 0); d.position.set(0, -5000, 0);
    scene.add(b, d);
    return () => { scene.remove(b, d); };
  }

  alive() { return this.list.filter((c) => c.alive && c.state !== 'dead'); }

  spawn(x: number, z: number, scripted = false, guard: THREE.Vector3 | null = null) {
    if (this.list.length >= MAX) return null;
    // clone precisa passar pelo enhance (névoa/sombras); mesma chave de cache → mesmo programa compilado
    const mat = enhance(this.baseMat.clone(), 'clean');
    const body = new THREE.Mesh(this.bodyGeo, mat);
    body.castShadow = true; body.receiveShadow = true;
    this.group.add(body);
    const pos = new THREE.Vector3(x, this.terrain.heightAt(x, z) - 0.6, z);
    const c: Crawler = {
      id: this.nextId++, pos, yaw: Math.random() * Math.PI * 2, hp: CRAWLER.hp, state: 'emerge', t: 0, atkCd: 1, phase: Math.random() * 6,
      speed: 0, flash: 0, body, mat, feet: HIPS.map(() => pos.clone()), scripted, circleA: Math.random() * 6.28, lungeDir: new THREE.Vector3(), hitDone: false, rear: 0, alive: true, air: 0, vy: 0, guard, raid: null,
    };
    this.list.push(c);
    return c;
  }

  /** dano; retorna true se matou */
  damage(c: Crawler, dmg: number, from: THREE.Vector3) {
    if (!c.alive || c.state === 'dead') return false;
    c.hp -= dmg;
    c.flash = 0.08;
    // empurrão
    const k = new THREE.Vector3().subVectors(c.pos, from).setY(0).normalize().multiplyScalar(0.25);
    c.pos.add(k);
    if (c.state === 'emerge' || c.state === 'burrow') c.state = 'chase';
    if (c.hp <= 0) { c.state = 'dead'; c.t = 0; c.hp = 0; return true; }
    if (c.scripted && c.hp <= CRAWLER.hp * 0.5) { c.state = 'flee'; c.t = 0; }
    else if (c.hp < CRAWLER.hp * 0.25 && !c.scripted) { c.state = 'flee'; c.t = 0; }
    return false;
  }

  /** raio (origem, direção unitária) contra esferas das criaturas: a mais próxima */
  raycast(o: THREE.Vector3, d: THREE.Vector3, max: number) {
    let best: Crawler | null = null, bt = max;
    const oc = new THREE.Vector3();
    for (const c of this.list) {
      if (!c.alive || c.state === 'dead' || c.state === 'emerge' && c.t < 0.5) continue;
      const center = c.pos.clone().setY(c.pos.y + 0.25);
      oc.subVectors(o, center);
      const b = oc.dot(d), cc = oc.lengthSq() - CRAWLER.radius * CRAWLER.radius;
      const h = b * b - cc;
      if (h < 0) continue;
      const tt = -b - Math.sqrt(h);
      if (tt > 0 && tt < bt) { bt = tt; best = c; }
    }
    return best ? { c: best, t: bt } : null;
  }

  update(dt: number, ctx: { player: THREE.Vector3; canAttack: boolean; habitat: THREE.Vector3 | null; retreat: boolean; dmgMul: number; day: boolean }): CreatureEvents {
    const ev: CreatureEvents = { playerHit: 0, screech: false, died: [], windup: false, sabotage: 0 };
    const P = ctx.player;
    // quem pode atacar: os 2 mais próximos que estão perseguindo
    const hunters = this.list.filter((c) => c.alive && HUNT_STATES.has(c.state))
      .sort((a, b) => a.pos.distanceTo(P) - b.pos.distanceTo(P));
    const attackers = new Set(hunters.slice(0, CRAWLER.maxAttackers).map((c) => c.id));

    for (const c of this.list) {
      if (!c.alive) continue;
      c.t += dt;
      c.flash = Math.max(0, c.flash - dt);
      c.atkCd = Math.max(0, c.atkCd - dt);
      const toP = this.sToP.subVectors(P, c.pos).setY(0);
      const dist = toP.length();
      const dirP = dist > 1e-3 ? this.sDir.copy(toP).divideScalar(dist) : this.sDir.set(0, 0, 1);
      const nearHab = ctx.habitat ? Math.hypot(c.pos.x - ctx.habitat.x, c.pos.z - ctx.habitat.z) : Infinity;
      const want = this.sWant.set(0, 0, 0); let spd = 0;
      c.rear = THREE.MathUtils.damp(c.rear, c.state === 'windup' ? 1 : 0, 10, dt);
      const home = c.guard ? Math.hypot(c.pos.x - c.guard.x, c.pos.z - c.guard.z) : 0;
      const pHome = c.guard ? Math.hypot(P.x - c.guard.x, P.z - c.guard.z) : 0;
      const giveUp = !ctx.canAttack || ctx.retreat || (!c.guard && !c.raid && nearHab < 12) || (!!c.guard && (home > 38 || pHome > 34)) || (!!c.raid && dist > 18);
      switch (c.state) {
        case 'emerge': // sai da toca
          if (c.t > 1.4) { c.state = 'hunt'; c.t = 0; ev.screech = true; }
          break;
        case 'hunt':
          if (ctx.day && dist > 25 && !c.guard && !c.scripted && !c.raid) { c.state = 'burrow'; c.t = 0; break; }
          if (c.raid && giveUp) {
            // marcha até a colônia; chegando, rodeia os prédios sabotando cabos (drena a bateria da base)
            const rx = c.raid.x - c.pos.x, rz = c.raid.z - c.pos.z, rd = Math.hypot(rx, rz);
            if (rd > 9) { want.set(rx, 0, rz).normalize(); spd = CRAWLER.speed * 0.8; }
            else { c.circleA += dt * 0.4; want.set(c.raid.x + Math.cos(c.circleA) * 6 - c.pos.x, 0, c.raid.z + Math.sin(c.circleA) * 6 - c.pos.z).normalize(); spd = 1.4; ev.sabotage += dt; }
            break;
          }
          if (c.guard && giveUp) {
            // patrulha em volta da colmeia
            c.circleA += dt * 0.25;
            const tx = c.guard.x + Math.cos(c.circleA) * 7, tz = c.guard.z + Math.sin(c.circleA) * 7;
            want.set(tx - c.pos.x, 0, tz - c.pos.z); const l = want.length(); want.normalize(); spd = Math.min(home > 14 ? 2.4 : 0.9, l);
            break;
          }
          if (giveUp) { want.copy(dirP).negate(); spd = 1.2; break; }
          want.copy(dirP); spd = 1.6;
          if (dist < CRAWLER.chaseRange) { c.state = 'chase'; c.t = 0; ev.screech = true; }
          break;
        case 'chase':
        case 'circle': {
          if (giveUp) { c.state = 'hunt'; c.t = 0; break; }
          if (!attackers.has(c.id)) {
            // rodeia a 6 m esperando a vez
            c.state = 'circle';
            c.circleA += dt * 0.5;
            want.set(P.x + Math.cos(c.circleA) * CRAWLER.circleR - c.pos.x, 0, P.z + Math.sin(c.circleA) * CRAWLER.circleR - c.pos.z); const l = want.length(); want.normalize(); spd = Math.min(CRAWLER.speed, l * 1.5);
          } else {
            c.state = 'chase';
            want.copy(dirP); spd = CRAWLER.speed;
            if (dist < CRAWLER.lungeRange + 0.8 && c.atkCd <= 0) { c.state = 'windup'; c.t = 0; ev.windup = true; }
          }
          if (dist > CRAWLER.chaseRange * 1.6) { c.state = 'hunt'; c.t = 0; }
          break;
        }
        case 'windup': // aviso: para, empina, manchas acendem
          want.copy(dirP); spd = 0;
          if (c.t > 0.6) { c.state = 'lunge'; c.t = 0; c.lungeDir.copy(dirP); c.hitDone = false; c.vy = 1.6; c.air = 0.01; ev.screech = true; }
          break;
        case 'lunge': // bote em arco na gravidade marciana: 1,6 m/s para cima → ~0,86 s no ar, ~3,9 m
          want.copy(c.lungeDir); spd = 4.5;
          c.vy -= 3.72 * dt; c.air = Math.max(0, c.air + c.vy * dt);
          if (!c.hitDone && dist < 1.25 && Math.abs(c.air) < 1.2) { c.hitDone = true; ev.playerHit += 8 * ctx.dmgMul; }
          if ((c.air <= 0 && c.t > 0.1) || c.t > 1.2) { c.air = 0; c.state = 'recover'; c.t = 0; c.atkCd = 2.0; }
          break;
        case 'recover':
          want.copy(dirP).negate(); spd = 1.8;
          if (c.t > 1.1) { c.state = 'chase'; c.t = 0; }
          break;
        case 'flee':
          want.copy(dirP).negate(); spd = CRAWLER.speed * 1.2;
          if (dist > 60 || c.t > 12) { c.state = 'burrow'; c.t = 0; }
          break;
        case 'burrow':
          if (c.t > 1.6) { c.alive = false; }
          break;
        case 'dead':
          if (c.t > 4) { c.alive = false; }
          break;
      }
      // movimento
      if (spd > 0 && want.lengthSq() > 1e-4) {
        const targetYaw = Math.atan2(want.x, want.z);
        let dy = targetYaw - c.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        c.yaw += dy * Math.min(1, dt * (c.state === 'lunge' ? 2 : 7));
      }
      c.speed = THREE.MathUtils.damp(c.speed, spd, 6, dt);
      if (c.state !== 'dead' && c.state !== 'emerge' && c.state !== 'burrow') {
        c.pos.x += Math.sin(c.yaw) * c.speed * dt;
        c.pos.z += Math.cos(c.yaw) * c.speed * dt;
        // não atravessa o jogador
        if (dist < 1.0 && c.state !== 'lunge') { c.pos.x -= dirP.x * (1.0 - dist); c.pos.z -= dirP.z * (1.0 - dist); }
      }
    }
    // separação entre criaturas
    for (const a of this.list) for (const b of this.list) {
      if (a === b || !a.alive || !b.alive) continue;
      const dx = a.pos.x - b.pos.x, dz = a.pos.z - b.pos.z, d = Math.hypot(dx, dz);
      if (d < 1.5 && d > 1e-3) { const k = (1.5 - d) * 0.5; a.pos.x += dx / d * k; a.pos.z += dz / d * k; }
    }
    // mortos: vira pedaços de quitina para coletar
    for (const c of this.list) if (c.state === 'dead' && !c.body.userData.dropped && c.t > 0.8) {
      c.body.userData.dropped = true;
      ev.died.push(c);
    }
    this.list = this.list.filter((c) => { if (!c.alive) { this.group.remove(c.body); unregister(c.mat); c.mat.dispose(); } return c.alive; });
    this.animate(dt);
    return ev;
  }

  dropLoot(at: THREE.Vector3, give: Loot) {
    const mesh = new THREE.Mesh(this.dropGeo, this.dropMat);
    mesh.position.set(at.x, this.terrain.heightAt(at.x, at.z) + 0.12, at.z);
    mesh.castShadow = true;
    this.group.add(mesh);
    this.drops.push({ mesh, give, t: 0 });
  }
  /** coleta automática ao passar perto */
  collect(p: THREE.Vector3, dt: number) {
    const got: Loot[] = [];
    this.drops = this.drops.filter((d) => {
      d.t += dt;
      d.mesh.rotation.y += dt * 1.5;
      d.mesh.position.y = this.terrain.heightAt(d.mesh.position.x, d.mesh.position.z) + 0.14 + Math.sin(d.t * 3) * 0.03;
      if (Math.hypot(d.mesh.position.x - p.x, d.mesh.position.z - p.z) < 1.4) { got.push(d.give); this.group.remove(d.mesh); return false; }
      if (d.t > 600) { this.group.remove(d.mesh); return false; }
      return true;
    });
    return got;
  }

  clear() {
    for (const c of this.list) { this.group.remove(c.body); unregister(c.mat); c.mat.dispose(); }
    this.list = [];
    for (const d of this.drops) this.group.remove(d.mesh);
    this.drops = [];
  }

  // ---------- animação: corpo alinhado ao terreno, pernas em tripé com IK, manchas
  private animate(dt: number) {
    let li = 0, si = 0;
    const up = Creatures.UP;
    const hipW = new THREE.Vector3(), footT = new THREE.Vector3(), knee = new THREE.Vector3(), mid = new THREE.Vector3(), dir = new THREE.Vector3();
    for (const c of this.list) {
      const gy = this.terrain.heightAt(c.pos.x, c.pos.z);
      // emergir/enterrar e morte
      let sink = 0;
      if (c.state === 'emerge') sink = (1 - Math.min(1, c.t / 1.2)) * 0.7;
      else if (c.state === 'burrow') sink = Math.min(1, c.t / 1.4) * 0.8;
      else if (c.state === 'dead') sink = Math.max(0, c.t - 1.5) * 0.12;
      c.phase += dt * (2 + c.speed * 3.2);
      const bob = Math.abs(Math.sin(c.phase)) * 0.03 * Math.min(1, c.speed);
      c.pos.y = gy + 0.34 + bob - sink + c.rear * 0.12 + c.air;
      const n = this.terrain.normalAt(c.pos.x, c.pos.z);
      this.tmpQ.setFromUnitVectors(up, n);
      const q = this.sQ.setFromAxisAngle(up, c.yaw);
      q.premultiply(this.tmpQ);
      // empinar (aviso) e morte (de lado)
      const tilt = this.sTilt.setFromEuler(this.sE.set(-c.rear * 0.45, 0, c.state === 'dead' ? Math.min(1.4, c.t * 2.5) : 0));
      q.multiply(tilt);
      c.body.position.copy(c.pos);
      c.body.quaternion.copy(q);
      c.body.visible = true;
      // flash de dano (branco) / brilho noturno de base
      c.mat.emissive.setRGB(1, 1, 1);
      c.mat.emissiveIntensity = c.flash > 0 ? 0.9 : 0;
      // pernas
      const dead = c.state === 'dead';
      for (let k = 0; k < LEGS; k++) {
        const h = HIPS[k];
        hipW.copy(h.p).applyQuaternion(q).add(c.pos);
        const out = this.sOut.set(h.side * 0.62, 0, h.p.z * 1.4 + 0.05).applyQuaternion(q);
        const stride = Math.min(0.35, 0.1 + c.speed * 0.08);
        const ph = c.phase + h.ph;
        const fwd = this.sFwd.set(Math.sin(c.yaw), 0, Math.cos(c.yaw));
        footT.copy(c.pos).add(out).addScaledVector(fwd, Math.sin(ph) * stride);
        const lift = dead ? 0.25 : Math.max(0, Math.cos(ph)) * 0.12 * Math.min(1, c.speed + 0.2);
        footT.y = this.terrain.heightAt(footT.x, footT.z) + lift - (dead ? -0.2 : 0);
        if (c.state === 'windup' && k < 2) footT.y += c.rear * 0.35; // pernas da frente erguidas
        // IK de 2 ossos: joelho acima do meio do segmento quadril→pé
        const d = Math.min(L1 + L2 - 0.01, hipW.distanceTo(footT));
        const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d);
        const hk = Math.sqrt(Math.max(0, L1 * L1 - a * a));
        dir.subVectors(footT, hipW).normalize();
        const bend = this.sBend.crossVectors(dir, this.sCross.crossVectors(up, dir)).normalize();
        if (bend.y < 0) bend.negate();
        knee.copy(hipW).addScaledVector(dir, a).addScaledVector(bend, hk);
        footT.copy(hipW).addScaledVector(dir, d);
        for (const [A, B] of [[hipW, knee], [knee, footT]] as const) {
          mid.subVectors(B, A);
          const len = mid.length();
          this.tmpQ.setFromUnitVectors(up, mid.normalize());
          this.m.compose(A, this.tmpQ, this.sScale.set(1, len, 1));
          this.legs.setMatrixAt(li++, this.m);
        }
      }
      // manchas: ~0,15 de dia, 2,5 à noite, pulsando 0,6 Hz; ACENDEM (5) no aviso de bote
      const pulse = 0.85 + 0.15 * Math.sin(c.t * 3.77 + c.id);
      let inten = (0.15 + 2.35 * this.night) * pulse;
      // olhos: sempre acesos (1,6 de dia, 3 à noite), 6 no aviso de bote
      let eye = (1.6 + 1.4 * this.night) * pulse;
      if (c.state === 'windup' || c.state === 'lunge') { inten = 5; eye = 6; }
      const fade = c.state === 'dead' ? Math.max(0, 1 - c.t / 2) : c.state === 'emerge' ? Math.min(1, c.t) : 1;
      for (let k = 0; k < SPOT_LOCAL.length; k++) {
        const w = this.tmpV.copy(SPOT_LOCAL[k]).applyQuaternion(q).add(c.pos);
        this.spotPos[si * 3] = w.x; this.spotPos[si * 3 + 1] = w.y; this.spotPos[si * 3 + 2] = w.z;
        this.spotI[si] = (k >= EYE0 ? eye : inten) * fade;
        si++;
      }
    }
    this.legs.count = li;
    this.legs.instanceMatrix.needsUpdate = true;
    const g = this.spots.geometry;
    g.setDrawRange(0, si);
    (g.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (g.attributes.aI as THREE.BufferAttribute).needsUpdate = true;
  }
}
