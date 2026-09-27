// Traje EVA construído em peças rígidas presas ao esqueleto animado (estilo xEMU/Z-2):
// tronco rígido (HUT), mangas/pernas em tecido volumoso, anéis de rolamento nas juntas, luvas, botas.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

function fabricNormalTexture(size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const img = g.createImageData(size, size);
  // trama (ripstop) + pregas suaves -> altura; normal por diferenças finitas
  const h = new Float32Array(size * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const wx = Math.sin((x / size) * Math.PI * 2 * 96), wy = Math.sin((y / size) * Math.PI * 2 * 96);
      const weave = 0.5 * (wx * (wy > 0 ? 1 : -1)) * 0.15;
      const rip = (x % 64 < 2 || y % 64 < 2) ? 0.35 : 0;
      const fold = 0.6 * Math.sin((y / size) * Math.PI * 2 * 3 + Math.sin((x / size) * Math.PI * 2) * 1.2);
      h[y * size + x] = weave + rip + fold * 0.5;
    }
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const hx = h[y * size + ((x + 1) % size)] - h[y * size + ((x - 1 + size) % size)];
      const hy = h[((y + 1) % size) * size + x] - h[((y - 1 + size) % size) * size + x];
      const nx = -hx * 1.2, ny = -hy * 1.2, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      const i = (y * size + x) * 4;
      img.data[i] = ((nx / l) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((ny / l) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((nz / l) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 3);
  t.colorSpace = THREE.NoColorSpace;
  t.anisotropy = 8;
  return t;
}

export function makeSuitMaterials() {
  const fabricN = fabricNormalTexture();
  const fabric = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0.8, 0.79, 0.76), roughness: 0.88, sheen: 1, sheenRoughness: 0.7, sheenColor: new THREE.Color(0.85, 0.83, 0.8), normalMap: fabricN, normalScale: new THREE.Vector2(0.55, 0.55) });
  const hard = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0.86, 0.86, 0.84), roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.4 });
  const metal = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.62, 0.64, 0.67), roughness: 0.28, metalness: 1 });
  const dark = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.06, 0.065, 0.07), roughness: 0.6, metalness: 0.2 });
  const glove = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0.7, 0.69, 0.66), roughness: 0.75, sheen: 0.6, sheenRoughness: 0.8, normalMap: fabricN, normalScale: new THREE.Vector2(0.3, 0.3) });
  const accent = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.75, 0.22, 0.08), roughness: 0.6 });
  const blue = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.08, 0.18, 0.45), roughness: 0.55 });
  return { fabric, hard, metal, dark, glove, accent, blue };
}

type Mats = ReturnType<typeof makeSuitMaterials>;

/** cria um segmento (cápsula) entre a origem do osso e a posição do filho, no espaço local do osso */
function segment(bone: THREE.Object3D, child: THREE.Object3D, r0: number, r1: number, mat: THREE.Material, invScale: number, inset = 0.05) {
  const dir = child.position.clone();
  const len = dir.length();
  const g = new THREE.CylinderGeometry(r1, r0, 1, 28, 6, false);
  // arredonda as extremidades com leve inchaço (tecido pressurizado)
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const bulge = 1 + 0.12 * Math.cos(y * Math.PI);
    p.setX(i, p.getX(i) * bulge);
    p.setZ(i, p.getZ(i) * bulge);
  }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat);
  const L = len * (1 - inset * 2);
  m.scale.set(invScale, L, invScale);
  m.position.copy(dir).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  bone.add(m);
  // tampas esféricas
  for (const [t, r] of [[0, r0], [1, r1]] as const) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(r * 1.03, 24, 16), mat);
    cap.scale.setScalar(invScale);
    cap.position.copy(dir).multiplyScalar(t === 0 ? inset * 0.6 : 1 - inset * 0.6);
    bone.add(cap);
  }
  return m;
}

function ring(bone: THREE.Object3D, towards: THREE.Vector3 | null, r: number, t: number, mat: THREE.Material, invScale: number, at = 0) {
  const g = new THREE.TorusGeometry(r, t, 12, 40);
  g.rotateX(Math.PI / 2);
  const m = new THREE.Mesh(g, mat);
  m.scale.setScalar(invScale);
  if (towards) {
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), towards.clone().normalize());
    m.position.copy(towards).multiplyScalar(at);
  }
  bone.add(m);
  return m;
}

export function buildSuit(model: THREE.Object3D, mats: Mats) {
  const bones: Record<string, THREE.Object3D> = {};
  model.traverse((o) => {
    const n = o.name.replace(/^mixamorig:?/, '');
    if ((o as THREE.Bone).isBone) bones[n] = o;
  });
  const ws = new THREE.Vector3();
  const inv = (b: THREE.Object3D) => { b.updateWorldMatrix(true, false); b.getWorldScale(ws); return 1 / ws.x; };
  const B = (n: string) => bones[n];

  for (const side of ['Left', 'Right']) {
    const arm = B(`${side}Arm`), fore = B(`${side}ForeArm`), hand = B(`${side}Hand`);
    const up = B(`${side}UpLeg`), leg = B(`${side}Leg`), foot = B(`${side}Foot`), toe = B(`${side}ToeBase`);
    const sh = B(`${side}Shoulder`);
    if (arm && fore) { const s = inv(arm); segment(arm, fore, 0.074, 0.066, mats.fabric, s); ring(arm, fore.position, 0.078, 0.012, mats.metal, s, 0.05); }
    if (fore && hand) { const s = inv(fore); segment(fore, hand, 0.064, 0.052, mats.fabric, s, 0.02); ring(fore, hand.position, 0.056, 0.012, mats.metal, s, 0.92); ring(fore, hand.position, 0.06, 0.008, mats.blue, s, 0.85); }
    if (up && leg) { const s = inv(up); segment(up, leg, 0.105, 0.085, mats.fabric, s); ring(up, leg.position, 0.108, 0.013, mats.metal, s, 0.08); }
    if (leg && foot) { const s = inv(leg); segment(leg, foot, 0.084, 0.07, mats.fabric, s, 0.02); }
    if (sh && arm) { const s = inv(sh); segment(sh, arm, 0.09, 0.085, mats.hard, s, 0.0); }
    // luva
    if (hand) {
      const s = inv(hand);
      const mid = B(`${side}HandMiddle1`);
      const dir = mid ? mid.position.clone().normalize() : new THREE.Vector3(0, 1, 0);
      const gl = new THREE.Mesh(new RoundedBoxGeometry(0.085, 0.14, 0.045, 3, 0.02), mats.glove);
      gl.scale.setScalar(s);
      gl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      gl.position.copy(dir).multiplyScalar(0.06 * s);
      hand.add(gl);
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.05, 24), mats.glove);
      cuff.scale.setScalar(s);
      cuff.quaternion.copy(gl.quaternion);
      hand.add(cuff);
    }
    // bota
    if (foot && toe) {
      const s = inv(foot);
      const d = toe.position.clone();
      const len = d.length() / s;
      const boot = new THREE.Group();
      const upper = new THREE.Mesh(new RoundedBoxGeometry(0.13, len + 0.14, 0.15, 4, 0.045), mats.glove);
      const sole = new THREE.Mesh(new RoundedBoxGeometry(0.135, len + 0.17, 0.045, 3, 0.015), mats.dark);
      sole.position.z = -0.075;
      const ankle = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.14, 24), mats.glove);
      ankle.rotation.x = Math.PI / 2;
      ankle.position.set(0, -len * 0.45, 0.05);
      boot.add(upper, sole, ankle);
      boot.scale.setScalar(s);
      boot.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
      boot.position.copy(d).multiplyScalar(0.5);
      foot.add(boot);
    }
  }
  // tronco rígido (HUT), abdômen e quadril
  const hips = B('Hips'), spine = B('Spine'), spine1 = B('Spine1'), spine2 = B('Spine2'), neck = B('Neck');
  if (hips && spine) {
    const s = inv(hips);
    const brief = new THREE.Mesh(new RoundedBoxGeometry(0.36, 0.2, 0.25, 5, 0.08), mats.fabric);
    brief.scale.setScalar(s);
    brief.position.set(0, -0.02 * s, 0);
    hips.add(brief);
    ring(hips, new THREE.Vector3(0, 1, 0), 0.17, 0.014, mats.metal, s, 0).position.y = 0.09 * s;
  }
  if (spine && spine1) { const s = inv(spine); segment(spine, spine1, 0.16, 0.165, mats.fabric, s, 0.0); }
  if (spine2) {
    const s = inv(spine2);
    const hut = new THREE.Mesh(new RoundedBoxGeometry(0.44, 0.4, 0.3, 6, 0.11), mats.hard);
    hut.scale.setScalar(s);
    hut.position.set(0, 0.06 * s, 0.01 * s);
    spine2.add(hut);
    // módulo de controle no peito (DCM)
    const dcm = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.1, 0.07, 3, 0.015), mats.hard);
    dcm.scale.setScalar(s);
    dcm.position.set(0, 0.0, 0.18 * s);
    spine2.add(dcm);
    const panel = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.06, 0.012, 2, 0.004), mats.dark);
    panel.scale.setScalar(s);
    panel.position.set(0, 0.012 * s, 0.216 * s);
    panel.rotation.x = -0.35;
    spine2.add(panel);
    for (const [x, m] of [[-0.05, mats.accent], [0.0, mats.blue], [0.05, mats.metal]] as const) {
      const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.02, 14), m);
      knob.rotation.x = Math.PI / 2;
      knob.scale.setScalar(s);
      knob.position.set(x * s, -0.03 * s, 0.22 * s);
      spine2.add(knob);
    }
    // faixa de identificação (vermelha = comandante)
    for (const side of [-1, 1]) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.083, 0.009, 8, 32), mats.accent);
      band.rotation.x = Math.PI / 2;
      const up = B(side < 0 ? 'RightArm' : 'LeftArm');
      if (up) {
        const fore = B(side < 0 ? 'RightForeArm' : 'LeftForeArm')!;
        const su = inv(up);
        band.scale.setScalar(su);
        band.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), fore.position.clone().normalize());
        band.position.copy(fore.position).multiplyScalar(0.55);
        up.add(band);
      }
    }
  }
  if (neck) {
    const s = inv(neck);
    ring(neck, new THREE.Vector3(0, 1, 0), 0.13, 0.03, mats.metal, s, 0).position.y = 0.02 * s;
  }
  model.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
  return bones;
}
