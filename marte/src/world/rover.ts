// Rover pressurizado de exploração (6×6), visual procedural PBR + física de veículo Rapier.
// Massa 1100 kg, roda Ø 1,0 m, velocidade máx. ~5,5 m/s (≈ 20 km/h), suspensão ajustada para g = 3,721.
import * as THREE from 'three';
import { detail } from '../render/detail';
import type RAPIER from '@dimforge/rapier3d-compat';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Physics } from '../core/physics';
import type { Terrain } from './terrain';
import { enhanceObject, enhance } from '../render/materials';

function treadTexture() {
  const W = 64, H = 256;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  const img = g.createImageData(W, H);
  const h = (x: number, y: number) => { const v = ((y + (x < W / 2 ? 0 : 16)) % 32) < 12 ? 1 : 0; const edge = Math.abs(x - W / 2) < 3 ? 0 : 1; return v * edge; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const nx = (h(x - 1, y) - h(x + 1, y)) * 0.8, ny = (h(x, y - 1) - h(x, y + 1)) * 0.8;
    const l = Math.hypot(nx, ny, 1), i = (y * W + x) * 4;
    img.data[i] = (nx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (ny / l * 0.5 + 0.5) * 255; img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 6);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

export const ROVER = {
  mass: 1100,
  halfExt: { x: 1.3, y: 0.45, z: 2.95 },
  wheelR: 0.385,
  wheelW: 0.38,
  susRest: 0.42,
  maxForce: 2600, // N (total, dividido entre as 6 rodas)
  brake: 90,
  maxSteer: 0.52,
  maxSpeed: 5.6,
};

export class Rover {
  root = new THREE.Group();
  body!: RAPIER.RigidBody;
  collider!: RAPIER.Collider;
  vc!: RAPIER.DynamicRayCastVehicleController;
  wheels: THREE.Object3D[] = [];
  lights: THREE.SpotLight[] = [];
  blob!: THREE.Mesh;
  courtesy!: THREE.PointLight;
  private ledMat: THREE.MeshStandardMaterial;
  private tailMat: THREE.MeshStandardMaterial;
  steer = 0;
  speed = 0;
  battery = 30; // kWh
  batteryCap = 30;
  lightsOn = false;
  prevPos = new THREE.Vector3();
  pos = new THREE.Vector3();
  prevQuat = new THREE.Quaternion();
  quat = new THREE.Quaternion();
  // rodas nas posições reais do modelo da NASA (SEV): eixos a −1,7 / 0 / +1,7 m
  readonly wheelPos: [number, number][] = [[-1.7, 1.7], [1.7, 1.7], [-1.7, 0], [1.7, 0], [-1.7, -1.7], [1.7, -1.7]];
  private modelWheels = false;

  constructor(private phys: Physics, private terrain: Terrain) {
    this.ledMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: new THREE.Color(0.85, 0.93, 1), emissiveIntensity: 3, roughness: 0.3 });
    this.tailMat = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: new THREE.Color(1, 0.05, 0.02), emissiveIntensity: 1.5 });
    this.buildVisual();
    enhanceObject(this.root);
    enhance(this.ledMat, 'led');
  }

  private buildVisual() {
    const paint = detail(new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0.86, 0.86, 0.84), roughness: 0.45, metalness: 0.1, clearcoat: 0.35, clearcoatRoughness: 0.3 }), { set: 'panel', tile: 1.3, albedo: 0.65 });
    const steel = detail(new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0.62, 0.64, 0.66), roughness: 0.36, metalness: 1, clearcoat: 0.2 }), { set: 'plate', tile: 0.6, albedo: 0.5 });
    const dark = detail(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.045, 0.047, 0.05), roughness: 0.55, metalness: 0.3 }), { set: 'tread', tile: 0.5, albedo: 0.8 });
    const glass = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0.02, 0.025, 0.03), roughness: 0.04, metalness: 0.4, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.6 });
    const rubber = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.06, 0.06, 0.065), roughness: 0.92, normalMap: treadTexture(), normalScale: new THREE.Vector2(1.8, 1.8) });
    const orange = detail(new THREE.MeshStandardMaterial({ color: new THREE.Color(0.9, 0.34, 0.07), roughness: 0.5 }), { set: 'panel', tile: 1.0, albedo: 0.6 });
    const solar = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0.03, 0.06, 0.14), roughness: 0.15, metalness: 0.4, clearcoat: 1 });
    const g = this.root;
    const chassis = new THREE.Group();
    chassis.name = 'chassis';
    g.add(chassis);

    // perfil lateral facetado (estilo veículo pressurizado) extrudado na largura
    const prof = new THREE.Shape();
    const P: [number, number][] = [[-2.35, 0.0], [2.2, 0.0], [2.45, 0.35], [2.2, 0.75], [1.2, 1.55], [-1.6, 1.62], [-2.35, 1.2]];
    prof.moveTo(P[0][0], P[0][1]);
    for (const [x, y] of P.slice(1)) prof.lineTo(x, y);
    prof.closePath();
    const bodyGeo = new THREE.ExtrudeGeometry(prof, { depth: 2.1, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.14, bevelSegments: 6, curveSegments: 1 });
    bodyGeo.translate(0, 0, -1.05);
    bodyGeo.rotateY(-Math.PI / 2); // x do perfil → z do mundo (frente = +z)
    bodyGeo.computeVertexNormals();
    const body = new THREE.Mesh(bodyGeo, paint);
    body.position.y = 0.3;
    chassis.add(body);
    // vidro dianteiro inclinado (cabine): segue a aresta do perfil entre (2.2,0.75) e (1.2,1.55)
    {
      const p0 = new THREE.Vector3(0, 0.3 + 0.75, 2.2), p1 = new THREE.Vector3(0, 0.3 + 1.55, 1.2);
      const mid = p0.clone().add(p1).multiplyScalar(0.5);
      const len = p0.distanceTo(p1);
      const wind = new THREE.Mesh(new THREE.PlaneGeometry(1.95, len * 0.92), glass);
      wind.position.copy(mid);
      const n = new THREE.Vector3(0, p0.z - p1.z, p1.y - p0.y).normalize(); // normal para fora/cima
      wind.lookAt(mid.clone().add(n));
      wind.position.addScaledVector(n, 0.095);
      chassis.add(wind);
    }
    // janelas laterais
    for (const s of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.45), glass);
      w.position.set(s * 1.14, 1.55, 0.7);
      w.rotation.y = s * Math.PI / 2;
      chassis.add(w);
      // faixa de LED lateral
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 3.6), this.ledMat);
      led.position.set(s * 1.155, 0.62, -0.1);
      chassis.add(led);
      // porta com contorno
      const door = new THREE.Mesh(new RoundedBoxGeometry(0.04, 1.0, 0.9, 2, 0.02), dark);
      door.position.set(s * 1.15, 1.05, -0.6);
      chassis.add(door);
    }
    // barra de LED frontal (assinatura como na referência)
    const frontLed = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.06, 0.03), this.ledMat);
    frontLed.position.set(0, 0.95, 2.49);
    chassis.add(frontLed);
    for (const s of [-1, 1]) {
      const hl = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.1, 0.06, 2, 0.02), this.ledMat);
      hl.position.set(s * 0.72, 0.62, 2.66);
      chassis.add(hl);
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.03), this.tailMat);
      tl.position.set(s * 0.75, 1.1, -2.47);
      chassis.add(tl);
      const spot = new THREE.SpotLight(0xfff1e0, 0, 80, THREE.MathUtils.degToRad(26), 0.85, 1.6);
      spot.position.set(s * 0.72, 0.62, 2.7);
      spot.target.position.set(s * 0.72, -0.8, 14);
      chassis.add(spot, spot.target);
      this.lights.push(spot);
    }
    // luz de posição/cortesia no teto (silhueta do veículo à noite)
    const courtesy = new THREE.PointLight(0xffd9b0, 0, 9, 1.6);
    courtesy.position.set(0, 2.6, -0.3);
    chassis.add(courtesy);
    this.courtesy = courtesy;
    // teto solar, antena, câmeras, para-lamas, faixa laranja
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.04, 2.4), solar);
    roof.position.set(0, 1.95, -0.6);
    chassis.add(roof);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.9, 8), steel);
    mast.position.set(-0.7, 2.4, -1.8);
    const dish = new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 8, 0, Math.PI * 2, 0, 1.0), paint);
    dish.position.set(-0.7, 2.85, -1.8);
    dish.rotation.x = -0.9;
    chassis.add(mast, dish);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.32, 0.08, 1.2), orange);
    stripe.position.set(0, 0.42, -1.6);
    chassis.add(stripe);
    const skid = new THREE.Mesh(new RoundedBoxGeometry(2.0, 0.18, 4.4, 2, 0.06), dark);
    skid.position.y = 0.28;
    chassis.add(skid);
    for (const [x, z] of this.wheelPos) {
      // para-lama em arco sobre cada roda (eixo ao longo de X)
      const fg = new THREE.CylinderGeometry(0.64, 0.64, 0.46, 28, 1, true, 0.2, Math.PI - 0.4);
      fg.rotateZ(Math.PI / 2);
      const fender = new THREE.Mesh(fg, dark);
      (fender.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
      fender.position.set(x, 0.12, z);
      chassis.add(fender);
      // braço de suspensão (do chassi até o cubo)
      const arm = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(x) - 0.75, 0.08, 0.16), steel);
      arm.position.set(x > 0 ? (Math.abs(x) + 0.75) / 2 : -(Math.abs(x) + 0.75) / 2, 0.22, z);
      chassis.add(arm);
    }
    // rodas (malha separada, animadas pela física)
    for (let i = 0; i < 6; i++) {
      const w = new THREE.Group();
      const tireGeo = new THREE.CylinderGeometry(ROVER.wheelR, ROVER.wheelR, ROVER.wheelW, 40, 1);
      tireGeo.rotateZ(Math.PI / 2);
      const tire = new THREE.Mesh(tireGeo, rubber);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, ROVER.wheelW + 0.04, 24), steel);
      hub.rotation.z = Math.PI / 2;
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, ROVER.wheelW + 0.08, 16), dark);
      cap.rotation.z = Math.PI / 2;
      for (let k = 0; k < 5; k++) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(ROVER.wheelW + 0.06, 0.05, 0.36), steel);
        spoke.rotation.x = (k / 5) * Math.PI;
        w.add(spoke);
      }
      w.add(tire, hub, cap);
      this.wheels.push(w);
      g.add(w);
    }
    g.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    // sombra de contato (oclusão sob o veículo)
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const cg = c.getContext('2d')!;
    const grd = cg.createRadialGradient(64, 64, 8, 64, 64, 64);
    grd.addColorStop(0, 'rgba(0,0,0,0.75)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    cg.fillStyle = grd; cg.fillRect(0, 0, 128, 128);
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 5.6), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    blob.rotation.x = -Math.PI / 2;
    blob.renderOrder = 2;
    this.blob = blob;
  }

  spawn(x: number, z: number, yaw: number) {
    const R = this.phys.R, W = this.phys.world;
    const y = this.terrain.heightAt(x, z) + 1.4;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    this.body = W.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(x, y, z).setRotation(q).setLinearDamping(0.02).setAngularDamping(0.15).setCcdEnabled(true).setCanSleep(true));
    const h = ROVER.halfExt;
    // massa com centro baixo: colisor principal leve + lastro inferior
    this.collider = W.createCollider(R.ColliderDesc.cuboid(h.x, h.y, h.z).setTranslation(0, 0.75, 0.45).setDensity(ROVER.mass * 0.35 / (8 * h.x * h.y * h.z)).setFriction(0.5), this.body);
    W.createCollider(R.ColliderDesc.cuboid(h.x * 1.1, 1.0, 2.6).setTranslation(0, 2.2, 0.5).setDensity(0.5).setFriction(0.5), this.body); // cabine alta do SEV
    W.createCollider(R.ColliderDesc.cuboid(0.9, 0.12, 2.0).setTranslation(0, 0.35, 0).setDensity(ROVER.mass * 0.6 / (8 * 0.9 * 0.12 * 2.0)).setFriction(0.5), this.body);
    this.vc = W.createVehicleController(this.body);
    for (const [wx, wz] of this.wheelPos) {
      this.vc.addWheel({ x: wx, y: 0.45, z: wz }, { x: 0, y: -1, z: 0 }, { x: -1, y: 0, z: 0 }, ROVER.susRest, ROVER.wheelR);
    }
    for (let i = 0; i < 6; i++) {
      // suspensão mais macia (~1,5 Hz, balanço visível na baixa gravidade) e atrito de regolito (μ≈0,9)
      this.vc.setWheelSuspensionStiffness(i, 16);
      this.vc.setWheelSuspensionCompression(i, 2.4);
      this.vc.setWheelSuspensionRelaxation(i, 3.4);
      this.vc.setWheelMaxSuspensionTravel(i, 0.35);
      this.vc.setWheelMaxSuspensionForce(i, 12000);
      this.vc.setWheelFrictionSlip(i, 0.95);
      this.vc.setWheelSideFrictionStiffness(i, 0.85);
    }
    this.vc.indexUpAxis = 1;
    this.vc.setIndexForwardAxis = 2;
    this.syncFromBody();
    this.prevPos.copy(this.pos); this.prevQuat.copy(this.quat);
  }

  private syncFromBody() {
    const t = this.body.translation(), r = this.body.rotation();
    this.pos.set(t.x, t.y, t.z);
    this.quat.set(r.x, r.y, r.z, r.w);
  }

  /** passo fixo: throttle −1..1, steer −1..1, brake 0..1 */
  step(dt: number, throttle: number, steerIn: number, brake: boolean, occupied = true) {
    this.prevPos.copy(this.pos); this.prevQuat.copy(this.quat);
    const v = this.body.linvel();
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(this.quat);
    this.speed = v.x * fwd.x + v.y * fwd.y + v.z * fwd.z;
    const hasPower = this.battery > 0.01;
    // direção progressiva (menos esterço em alta)
    const steerTarget = -steerIn * ROVER.maxSteer * (1 - 0.45 * Math.min(1, Math.abs(this.speed) / ROVER.maxSpeed));
    this.steer += (steerTarget - this.steer) * Math.min(1, dt * 4);
    let force = 0;
    if (hasPower && throttle !== 0) {
      const lim = throttle > 0 ? ROVER.maxSpeed : ROVER.maxSpeed * 0.45;
      const sp = Math.abs(this.speed);
      const k = Math.max(0, 1 - sp / lim);
      force = throttle * ROVER.maxForce * (0.25 + 0.75 * k);
      // frear ao inverter
      if (Math.sign(throttle) !== Math.sign(this.speed) && sp > 0.5) force = 0;
    }
    const autoBrake = (throttle === 0 ? 8 : 0) + (brake ? ROVER.brake : 0) + (throttle !== 0 && Math.sign(throttle) !== Math.sign(this.speed) && Math.abs(this.speed) > 0.5 ? ROVER.brake * 0.6 : 0);
    for (let i = 0; i < 6; i++) {
      const front = i < 2, rear = i >= 4;
      this.vc.setWheelSteering(i, front ? this.steer : rear ? -this.steer * 0.45 : 0);
      this.vc.setWheelEngineForce(i, force / 6 * 1.0);
      this.vc.setWheelBrake(i, autoBrake / 6);
    }
    this.vc.updateVehicle(dt);
    // consumo: ~0,8 kWh/km + 0,15 kW base
    // tração + resistência ao rolamento (Crr≈0,12 em regolito) + base de 0,4 kW [compromisso]
    const rr = 0.12 * ROVER.mass * 3.721;
    if (occupied) this.battery = Math.max(0, this.battery - ((Math.abs(force) + (Math.abs(this.speed) > 0.2 ? rr : 0)) * Math.abs(this.speed) / 0.85) * dt / 3.6e6 - 0.4 * dt / 3600);
  }

  /** depois do passo do mundo físico: pose atual (sem atraso de 1 tick) + rede de segurança */
  postStep() {
    this.syncFromBody();
    // rede de segurança contra atravessar o chão / NaN
    const hg = this.terrain.heightAt(this.pos.x, this.pos.z);
    if (!Number.isFinite(this.pos.x + this.pos.y + this.pos.z) || this.pos.y < hg - 1.5) this.reset(this.prevPos.x, this.prevPos.z, this.yaw());
  }

  yaw() {
    const f = new THREE.Vector3(0, 0, 1).applyQuaternion(this.quat);
    return Math.atan2(f.x, f.z);
  }

  isFlipped() {
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.quat);
    return up.y < 0.3;
  }

  reset(x: number, z: number, yaw: number) {
    const y = this.terrain.heightAt(x, z) + 1.4;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    this.body.setTranslation({ x, y, z }, true);
    this.body.setRotation(q, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.syncFromBody();
    this.prevPos.copy(this.pos); this.prevQuat.copy(this.quat);
  }

  setLights(on: boolean) {
    this.lightsOn = on;
    for (const l of this.lights) l.intensity = on ? 220 : 0; // sempre visíveis: evita recompilar shaders
    this.courtesy.intensity = on ? 6 : 0;
    this.ledMat.emissiveIntensity = on ? 6 : 3;
  }

  /** atualiza a malha interpolada e a pose das rodas */
  /** troca o visual procedural pelo modelo oficial da NASA (Space Exploration Vehicle) */
  setModel(model: THREE.Object3D, front: 1 | -1 = 1) {
    const chassis = this.root.getObjectByName('chassis')!;
    // esconde as malhas procedurais (mantém as luzes)
    chassis.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.visible = false; });
    for (const w of this.wheels) w.clear();
    model.updateMatrixWorld(true);
    const holder = new THREE.Group();
    holder.name = 'sev';
    holder.rotation.y = front === 1 ? 0 : Math.PI;
    // centro das rodas do modelo fica na altura de repouso da suspensão; eixo do meio em z = 0
    const wheelY = 0.45 - ROVER.susRest;
    holder.position.set(0, wheelY + 1.86, 0);
    model.position.set(0, 0, 0.87 * front);
    holder.add(model);
    chassis.add(holder);
    this.root.updateMatrixWorld(true);
    // rodas do modelo → grupos animados pela física (casando pela posição mais próxima)
    const inv = new THREE.Matrix4().copy(this.root.matrixWorld).invert();
    const found: THREE.Object3D[] = [];
    model.traverse((o) => { if (/^wheel_\d$/.test(o.name) && !/^wheel_\d$/.test(o.parent?.name ?? '')) found.push(o); });
    for (const o of found) {
      // matriz completa do nó (inclui a desquantização do meshopt) no espaço do root do rover
      const ml = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
      const mesh = o as THREE.Mesh;
      mesh.geometry.computeBoundingBox();
      const cl = mesh.geometry.boundingBox!.getCenter(new THREE.Vector3()).applyMatrix4(ml);
      let best = 0, bd = Infinity;
      this.wheelPos.forEach(([x, z], i) => { const d = Math.hypot(x - cl.x, z - cl.z); if (d < bd) { bd = d; best = i; } });
      // a roda gira em torno do próprio centro: desloca a malha para a origem do grupo
      const local = new THREE.Matrix4().makeTranslation(-cl.x, -cl.y, -cl.z).multiply(ml);
      o.parent!.remove(o);
      local.decompose(o.position, o.quaternion, o.scale);
      this.wheels[best].add(o);
    }
    this.modelWheels = true;
    // faróis na frente do modelo
    this.lights.forEach((l, i) => { l.position.set(i ? 0.7 : -0.7, 1.0, 3.3); l.target.position.set(i ? 0.7 : -0.7, -0.6, 16); });
    this.courtesy.position.set(0, 2.9, 0);
    model.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    enhanceObject(model);
    for (const w of this.wheels) enhanceObject(w);
  }

  render(alpha: number) {
    this.root.position.lerpVectors(this.prevPos, this.pos, alpha);
    this.root.quaternion.slerpQuaternions(this.prevQuat, this.quat, alpha);
    const chassis = this.root.getObjectByName('chassis')!;
    chassis.position.set(0, 0, 0);
    for (let i = 0; i < 6; i++) {
      const w = this.wheels[i];
      const [wx, wz] = this.wheelPos[i];
      const susp = this.vc.wheelSuspensionLength(i) ?? ROVER.susRest;
      w.position.set(wx, 0.45 - susp, wz);
      const steer = this.vc.wheelSteering(i) ?? 0;
      const rot = this.vc.wheelRotation(i) ?? 0;
      w.rotation.set(rot, steer, 0, 'YXZ');
      // as rodas são filhas do root (espaço do chassi)
      if (w.parent !== this.root) this.root.add(w);
    }
    this.tailMat.emissiveIntensity = this.speed < -0.2 || !this.lightsOn ? 1.5 : 3;
    // sombra de contato no solo sob o veículo
    const rp = this.root.position;
    this.blob.position.set(rp.x, this.terrain.heightAt(rp.x, rp.z) + 0.04, rp.z);
    this.blob.rotation.set(-Math.PI / 2, 0, this.yaw(), 'YXZ');
    this.blob.rotation.set(-Math.PI / 2, 0, 0);
    this.blob.rotateZ(this.yaw());
  }

  driverDoor() {
    return new THREE.Vector3(-2.9, 0, -0.9).applyQuaternion(this.quat).add(this.pos); // escotilha lateral do SEV
  }
}
