// Interior do habitat inflável (percorrível). Fica num "bolsão" isolado acima do mapa: ao entrar pela
// eclusa o jogador é levado para cá; o Sol/céu são desligados e a iluminação passa a ser só a interna.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Physics } from '../core/physics';
import { HAB_R } from './structures';
import { detail } from '../render/detail';

export const INTERIOR_ORIGIN = new THREE.Vector3(0, 1500, 0);
const R = HAB_R - 0.05; // raio interno (mesmo tamanho do habitat visto de fora)
const WALL_H = 2.4;

export type InteriorAction = 'exit' | 'console' | 'sleep' | 'food' | 'plants';
export interface InteriorSpot { action: InteriorAction; pos: THREE.Vector3; label: string }

function canvasTex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void, srgb = true) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  draw(cv.getContext('2d')!);
  const t = new THREE.CanvasTexture(cv);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export class Interior {
  group = new THREE.Group();
  lights: THREE.PointLight[] = [];
  spots: InteriorSpot[] = [];
  spawn = new THREE.Vector3();
  spawnYaw = 0;
  private screenCtx!: CanvasRenderingContext2D;
  private screenTex!: THREE.CanvasTexture;
  private growMat!: THREE.MeshStandardMaterial;
  private lampMat!: THREE.MeshStandardMaterial;
  private alarmMat!: THREE.MeshStandardMaterial;
  private t = 0;
  active = false;

  constructor() {
    const O = INTERIOR_ORIGIN;
    this.group.position.copy(O);
    const g = this.group;

    // ---------- materiais
    const fabric = new THREE.MeshStandardMaterial({
      color: 0xf1ede6, roughness: 0.92, side: THREE.BackSide,
      map: canvasTex(1024, 256, (c) => {
        c.fillStyle = '#efebe4'; c.fillRect(0, 0, 1024, 256);
        // costuras verticais e faixas de restrição (tecido de Vectran)
        for (let i = 0; i < 24; i++) { const x = (i / 24) * 1024; c.fillStyle = 'rgba(120,110,95,0.35)'; c.fillRect(x, 0, 3, 256); c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(x + 3, 0, 2, 256); }
        for (const y of [40, 128, 216]) { c.fillStyle = 'rgba(150,140,125,0.35)'; c.fillRect(0, y, 1024, 5); }
        for (let i = 0; i < 4000; i++) { c.fillStyle = `rgba(0,0,0,${Math.random() * 0.03})`; c.fillRect(Math.random() * 1024, Math.random() * 256, 2, 2); }
      }),
    });
    const domeMat = fabric.clone();
    domeMat.map = canvasTex(1024, 512, (c) => {
      c.fillStyle = '#ece8e1'; c.fillRect(0, 0, 1024, 512);
      for (let i = 0; i < 24; i++) { const x = (i / 24) * 1024; c.fillStyle = 'rgba(120,110,95,0.3)'; c.fillRect(x, 0, 3, 512); }
    });
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xa6a9ae, roughness: 0.6, metalness: 0.35,
      map: canvasTex(512, 512, (c) => {
        c.fillStyle = '#8d9096'; c.fillRect(0, 0, 512, 512);
        // piso de grade de alumínio com placas
        for (let y = 0; y < 512; y += 16) for (let x = 0; x < 512; x += 16) { c.fillStyle = (x + y) % 32 ? '#7c8086' : '#999ca2'; c.fillRect(x + 2, y + 2, 12, 12); }
        c.strokeStyle = 'rgba(30,30,30,0.6)'; c.lineWidth = 4;
        for (let i = 0; i <= 512; i += 128) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, 512); c.stroke(); c.beginPath(); c.moveTo(0, i); c.lineTo(512, i); c.stroke(); }
        // poeira marciana trazida nas botas
        for (let i = 0; i < 900; i++) { c.fillStyle = `rgba(150,80,40,${Math.random() * 0.15})`; c.beginPath(); c.arc(Math.random() * 512, Math.random() * 512, Math.random() * 6, 0, 7); c.fill(); }
      }),
    });
    floorMat.map!.wrapS = floorMat.map!.wrapT = THREE.RepeatWrapping;
    floorMat.map!.repeat.set(3, 3);
    detail(floorMat, { set: 'tread', tile: 0.45, albedo: 0.8, normal: 1 });
    detail(fabric, { set: 'fabric', tile: 0.25, albedo: 0.5 });
    detail(domeMat, { set: 'fabric', tile: 0.25, albedo: 0.5 });
    const white = detail(new THREE.MeshStandardMaterial({ color: 0xe8e8e6, roughness: 0.45, metalness: 0.1 }), { set: 'panel', tile: 0.9, albedo: 0.45 });
    const alu = detail(new THREE.MeshStandardMaterial({ color: 0xb8bcc2, roughness: 0.38, metalness: 0.9 }), { set: 'plate', tile: 0.4, albedo: 0.4 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x24272c, roughness: 0.6, metalness: 0.3 });
    const blue = new THREE.MeshStandardMaterial({ color: 0x2e4a78, roughness: 0.85 });
    const orange = new THREE.MeshStandardMaterial({ color: 0xd8742c, roughness: 0.8 });
    this.lampMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: new THREE.Color(1, 0.93, 0.82), emissiveIntensity: 4 });
    this.growMat = new THREE.MeshStandardMaterial({ color: 0x220022, emissive: new THREE.Color(0.9, 0.2, 1), emissiveIntensity: 3 });
    this.alarmMat = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: new THREE.Color(1, 0.1, 0.05), emissiveIntensity: 0 });

    // ---------- casca
    const floor = new THREE.Mesh(new THREE.CircleGeometry(R, 64), floorMat);
    floor.rotation.x = -Math.PI / 2;
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(R, R, WALL_H, 64, 1, true), fabric);
    wall.position.y = WALL_H / 2;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(R, 64, 24, 0, Math.PI * 2, 0, Math.PI / 2), domeMat);
    dome.position.y = WALL_H; dome.scale.y = 0.62;
    g.add(floor, wall, dome);
    // anel de luz no teto + arcos estruturais
    const ringLamp = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.06, 8, 64), this.lampMat);
    ringLamp.rotation.x = Math.PI / 2; ringLamp.position.y = WALL_H + R * 0.62 - 0.35;
    g.add(ringLamp);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.06, WALL_H, 0.06), alu);
      rib.position.set(Math.cos(a) * (R - 0.05), WALL_H / 2, Math.sin(a) * (R - 0.05));
      g.add(rib);
    }
    const band = new THREE.Mesh(new THREE.TorusGeometry(R - 0.05, 0.04, 6, 96), alu);
    band.rotation.x = Math.PI / 2; band.position.y = WALL_H;
    g.add(band);
    // dutos de ventilação
    const duct = new THREE.Mesh(new THREE.TorusGeometry(R - 0.25, 0.09, 8, 96, Math.PI * 1.3), white);
    duct.rotation.x = Math.PI / 2; duct.rotation.z = 0.4; duct.position.y = 2.15;
    g.add(duct);

    // ---------- eclusa (+Z)
    const frame = new THREE.Mesh(new RoundedBoxGeometry(1.5, 2.2, 0.3, 3, 0.1), alu);
    frame.position.set(0, 1.1, R - 0.1);
    const door = new THREE.Mesh(new RoundedBoxGeometry(1.1, 1.9, 0.1, 3, 0.1), white);
    door.position.set(0, 1.05, R - 0.28);
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.03, 8, 24), dark);
    wheel.position.set(0, 1.05, R - 0.35);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.18), new THREE.MeshStandardMaterial({
      emissive: new THREE.Color(1, 1, 1), emissiveIntensity: 2.5, color: 0x000000,
      emissiveMap: canvasTex(256, 64, (c) => { c.fillStyle = '#021'; c.fillRect(0, 0, 256, 64); c.fillStyle = '#3f6'; c.font = 'bold 34px sans-serif'; c.textAlign = 'center'; c.fillText('AIRLOCK ▲', 128, 45); }),
    }));
    sign.position.set(0, 2.3, R - 0.28); sign.rotation.y = Math.PI;
    const alarm = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), this.alarmMat);
    alarm.position.set(0.9, 2.1, R - 0.3);
    g.add(frame, door, wheel, sign, alarm);

    // ---------- console de controle (−Z) com telas ao vivo
    const desk = new THREE.Mesh(new RoundedBoxGeometry(2.6, 0.08, 0.8, 2, 0.03), white);
    desk.position.set(0, 0.85, -R + 0.75);
    const deskBase = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.8, 0.6), dark);
    deskBase.position.set(0, 0.42, -R + 0.8);
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 320;
    this.screenCtx = cv.getContext('2d')!;
    this.screenTex = new THREE.CanvasTexture(cv); this.screenTex.colorSpace = THREE.SRGBColorSpace;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.72), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: new THREE.Color(1, 1, 1), emissiveIntensity: 1.6, emissiveMap: this.screenTex, roughness: 0.2 }));
    screen.position.set(0, 1.45, -R + 0.42);
    screen.rotation.x = -0.12;
    const bezel = new THREE.Mesh(new RoundedBoxGeometry(2.42, 0.84, 0.06, 2, 0.02), dark);
    bezel.position.set(0, 1.45, -R + 0.38); bezel.rotation.x = -0.12;
    const chair = new THREE.Group();
    const seat = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.1, 0.5, 2, 0.04), blue); seat.position.y = 0.5;
    const back = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.55, 0.08, 2, 0.04), blue); back.position.set(0, 0.8, 0.22);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.45, 8), alu); post.position.y = 0.25;
    chair.add(seat, back, post); chair.position.set(0.3, 0, -R + 1.7); chair.rotation.y = 0.3;
    // teclado
    const kb = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 0.18), dark); kb.position.set(-0.2, 0.9, -R + 0.95);
    g.add(desk, deskBase, screen, bezel, chair, kb);
    this.drawScreen(null);

    // ---------- beliche (+X)
    const bed = new THREE.Group();
    const bframe = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.35, 2.05), alu); bframe.position.y = 0.3;
    const mattress = new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.16, 2.0, 2, 0.06), white); mattress.position.y = 0.55;
    const blanket = new THREE.Mesh(new RoundedBoxGeometry(0.92, 0.08, 1.3, 2, 0.04), blue); blanket.position.set(0, 0.64, 0.33);
    const pillow = new THREE.Mesh(new RoundedBoxGeometry(0.6, 0.1, 0.35, 2, 0.05), white); pillow.position.set(0, 0.66, -0.75);
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.06, 2.05), alu); upper.position.y = 1.55;
    const bag = new THREE.Mesh(new RoundedBoxGeometry(0.85, 0.2, 1.9, 2, 0.08), orange); bag.position.y = 1.7;
    for (const [x, z] of [[-0.45, -1], [0.45, -1], [-0.45, 1], [0.45, 1]]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.8, 8), alu); p.position.set(x, 0.9, z); bed.add(p); }
    bed.add(bframe, mattress, blanket, pillow, upper, bag);
    bed.position.set(R - 1.25, 0, -0.6);
    g.add(bed);

    // ---------- estoque (−X): prateleiras com rações e tanques de água
    const shelf = new THREE.Group();
    for (let k = 0; k < 4; k++) {
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 1.6), alu); board.position.y = 0.25 + k * 0.5; shelf.add(board);
      for (let j = 0; j < 4; j++) {
        if ((k * 7 + j * 3) % 5 === 0) continue;
        const box = new THREE.Mesh(new RoundedBoxGeometry(0.32, 0.26, 0.32, 1, 0.03), k % 2 ? white : new THREE.MeshStandardMaterial({ color: 0xd9c9a3, roughness: 0.9 }));
        box.position.set(0, 0.4 + k * 0.5, -0.55 + j * 0.37); shelf.add(box);
      }
    }
    for (const z of [-0.8, 0.8]) for (const y of [0, 2]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.0, 6), alu); p.position.set(0, 1.0, z); shelf.add(p); void y; }
    shelf.position.set(-R + 0.6, 0, -1.3);
    g.add(shelf);
    for (let i = 0; i < 3; i++) {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 1.3, 24), new THREE.MeshStandardMaterial({ color: 0xdfe6ee, roughness: 0.3, metalness: 0.6 }));
      tank.position.set(-R + 0.75, 0.65, 0.4 + i * 0.62);
      g.add(tank);
    }

    // ---------- horta sob luz de cultivo (−X/+Z)
    const rack = new THREE.Group();
    const tray = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 0.55), white); tray.position.y = 0.9;
    const soil = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.04, 0.47), new THREE.MeshStandardMaterial({ color: 0x3b2618, roughness: 1 })); soil.position.y = 0.97;
    rack.add(tray, soil);
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f8f3a, roughness: 0.7 });
    for (let i = 0; i < 14; i++) {
      const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07 + (i % 3) * 0.02, 0), leafMat);
      leaf.position.set(-0.6 + (i % 7) * 0.2, 1.04 + (i % 2) * 0.03, i < 7 ? -0.12 : 0.12);
      leaf.scale.y = 0.7; rack.add(leaf);
    }
    const grow = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.04, 0.12), this.growMat); grow.position.y = 1.55;
    for (const x of [-0.68, 0.68]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.6, 6), alu); leg.position.set(x, 0.8, 0); rack.add(leg); }
    rack.add(grow);
    rack.position.set(-2.1, 0, 2.75); rack.rotation.y = -0.85;
    g.add(rack);

    // ---------- mesa + traje reserva pendurado
    const table = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.05, 32), white); table.position.set(1.5, 0.75, 1.9);
    const tleg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.75, 8), alu); tleg.position.set(1.5, 0.37, 1.9);
    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.1, 16), orange); mug.position.set(1.35, 0.83, 1.8);
    const tablet = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.01, 0.18), dark); tablet.position.set(1.65, 0.785, 2.0); tablet.rotation.y = 0.4;
    g.add(table, tleg, mug, tablet);

    // ---------- luzes (sempre na cena; intensidade 0 fora do habitat → sem recompilar shaders)
    // (fora do grupo: um grupo invisível tiraria as luzes da cena e mudaria a contagem de luzes)
    const main = new THREE.PointLight(0xfff0dc, 0, 14, 1.6); main.position.set(O.x, O.y + WALL_H + 0.9, O.z);
    const desklight = new THREE.PointLight(0x9fd0ff, 0, 5, 2); desklight.position.set(O.x, O.y + 1.6, O.z - R + 1.2);
    this.lights = [main, desklight];

    g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = false; m.receiveShadow = false; } });
    g.visible = false;

    // pontos de interação (coordenadas de mundo)
    const w = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).add(O);
    this.spots = [
      { action: 'exit', pos: w(0, 0, R - 0.7), label: 'int_exit' },
      { action: 'console', pos: w(0, 0, -R + 1.45), label: 'int_console' },
      { action: 'sleep', pos: w(R - 2.0, 0, -0.6), label: 'int_sleep' },
      { action: 'food', pos: w(-R + 1.3, 0, -1.3), label: 'int_food' },
      { action: 'plants', pos: w(-1.6, 0, 2.2), label: 'int_plants' },
    ];
    this.spawn.copy(w(0, 0.05, R - 1.2));
    this.spawnYaw = 0; // olhando para −Z (para dentro)
  }

  /** colisores: piso, parede circular e móveis */
  addColliders(phys: Physics) {
    const O = INTERIOR_ORIGIN;
    const q0 = { x: 0, y: 0, z: 0, w: 1 };
    const boxes: { pos: { x: number; y: number; z: number }; half: { x: number; y: number; z: number }; quat: { x: number; y: number; z: number; w: number } }[] = [];
    boxes.push({ pos: { x: O.x, y: O.y - 0.25, z: O.z }, half: { x: R + 1, y: 0.25, z: R + 1 }, quat: q0 });
    boxes.push({ pos: { x: O.x, y: O.y + WALL_H + R * 0.62 + 0.3, z: O.z }, half: { x: R + 1, y: 0.25, z: R + 1 }, quat: q0 });
    const N = 32;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a);
      boxes.push({ pos: { x: O.x + Math.cos(a) * (R + 0.2), y: O.y + 3, z: O.z + Math.sin(a) * (R + 0.2) }, half: { x: 0.25, y: 3.2, z: (Math.PI * R) / N + 0.15 }, quat: { x: q.x, y: q.y, z: q.z, w: q.w } });
    }
    const add = (x: number, y: number, z: number, hx: number, hy: number, hz: number) => boxes.push({ pos: { x: O.x + x, y: O.y + y, z: O.z + z }, half: { x: hx, y: hy, z: hz }, quat: q0 });
    add(0, 0.45, -R + 0.8, 1.3, 0.45, 0.42); // console
    add(R - 1.25, 0.9, -0.6, 0.5, 0.9, 1.05); // beliche
    add(-R + 0.6, 1.0, -1.3, 0.28, 1.0, 0.85); // prateleiras
    add(-R + 0.75, 0.65, 1.02, 0.3, 0.65, 0.95); // tanques
    add(1.5, 0.4, 1.9, 0.55, 0.4, 0.55); // mesa
    phys.addBoxes(boxes);
  }

  setActive(on: boolean) {
    this.active = on;
    this.group.visible = on;
    this.lights[0].intensity = on ? 38 : 0;
    this.lights[1].intensity = on ? 6 : 0;
  }

  /** anima luzes/alertas e atualiza as telas (dados da base) */
  update(dt: number, data: { o2: number; o2Sols: number; water: number; food: number; batt: number; battCap: number; gen: number; load: number; sol: number; ltst: number; outT: number } | null) {
    if (!this.active) return;
    this.t += dt;
    const low = data ? data.o2Sols < 1.5 || data.batt < data.battCap * 0.15 : false;
    this.alarmMat.emissiveIntensity = low ? (Math.sin(this.t * 6) > 0 ? 6 : 0.3) : 0;
    this.growMat.emissiveIntensity = 2.6 + Math.sin(this.t * 0.7) * 0.2;
    if (Math.floor(this.t * 2) !== Math.floor((this.t - dt) * 2)) this.drawScreen(data);
  }

  private drawScreen(d: Parameters<Interior['update']>[1]) {
    const c = this.screenCtx, W = 1024, H = 320;
    c.fillStyle = '#04090d'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#0d2230'; for (let y = 0; y < H; y += 4) c.fillRect(0, y, W, 1);
    c.font = 'bold 30px monospace'; c.fillStyle = '#7fd4ff';
    c.fillText('ARES HAB-1 · SUPORTE DE VIDA', 24, 44);
    if (!d) { this.screenTex.needsUpdate = true; return; }
    c.fillStyle = '#9fb8c8'; c.font = '24px monospace';
    const hh = Math.floor(d.ltst), mm = Math.floor((d.ltst - hh) * 60);
    c.fillText(`SOL ${Math.floor(d.sol)}  ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}  EXT ${Math.round(d.outT)}°C`, 24, 82);
    const bars: [string, number, string, string][] = [
      ['O2', Math.min(1, d.o2Sols / 6), `${d.o2.toFixed(1)} kg · ${d.o2Sols.toFixed(1)} sol`, d.o2Sols < 1.5 ? '#ff5a3c' : '#5fe08a'],
      ['H2O', Math.min(1, d.water / 15), `${d.water.toFixed(1)} kg`, d.water < 3 ? '#ff5a3c' : '#4fb6ff'],
      ['FOOD', Math.min(1, d.food / 7), `${d.food.toFixed(1)} rac.`, d.food < 1.5 ? '#ff5a3c' : '#ffc857'],
      ['PWR', d.batt / Math.max(1, d.battCap), `${d.batt.toFixed(1)}/${d.battCap.toFixed(0)} kWh  +${Math.round(d.gen)}W −${Math.round(d.load)}W`, d.batt < d.battCap * 0.15 ? '#ff5a3c' : '#ffe27a'],
    ];
    bars.forEach(([k, f, txt, col], i) => {
      const y = 120 + i * 48;
      c.fillStyle = '#9fb8c8'; c.font = 'bold 26px monospace'; c.fillText(k, 24, y + 22);
      c.fillStyle = '#10222e'; c.fillRect(120, y, 380, 26);
      c.fillStyle = col; c.fillRect(120, y, 380 * Math.max(0, Math.min(1, f)), 26);
      c.fillStyle = '#d8e8f0'; c.font = '22px monospace'; c.fillText(txt, 520, y + 21);
    });
    this.screenTex.needsUpdate = true;
  }

  /** ponto de interação mais próximo à frente do jogador */
  nearest(pos: THREE.Vector3, fwd: THREE.Vector3): InteriorSpot | null {
    let best: InteriorSpot | null = null, bd = 1.7;
    for (const s of this.spots) {
      const dx = s.pos.x - pos.x, dz = s.pos.z - pos.z;
      const d = Math.hypot(dx, dz);
      if (d > bd) continue;
      if (d > 0.6 && (dx * fwd.x + dz * fwd.z) / d < -0.2) continue;
      best = s; bd = d;
    }
    return best;
  }
}
