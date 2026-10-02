import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { Physics } from '../core/physics';
import type { Input } from '../core/input';
import type { Terrain } from '../world/terrain';
import { WORLD } from '../world/config';

// Locomoção em gravidade marciana (3,721 m/s²):
// - aderência limitada a μ·g ≈ 0,85·3,72 ≈ 3,2 m/s² → arrancadas/frenagens "pesadas"
// - salto: v0 ≈ 2,1 m/s → altura ≈ 0,6 m, tempo no ar ≈ 1,1 s
// - transição caminhada→galope ≈ 1,3 m/s; galope máx. ~3,4 m/s
export const MOVE = {
  walk: 1.7, // caminhada firme (um pouco acima da transição de Froude 0,5 — jogo mais ágil)
  run: 3.6,
  accelGround: 3.2,
  accelAir: 0.35,
  jumpV: 2.15,
  capsuleRadius: 0.32,
  capsuleHalf: 0.58,
  eye: 1.62,
};

export class Player {
  pos = new THREE.Vector3(); // pés
  prevPos = new THREE.Vector3();
  vel = new THREE.Vector3();
  yaw = 0;
  pitch = -0.22;
  grounded = false;
  firstPerson = false;
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  controller: RAPIER.KinematicCharacterController;
  lastImpact = 0; // m/s no último impacto (para dano)
  private airTime = 0;
  frozen = false;
  camDist = 4.6;
  private camDistSmooth = 4.6;
  headBob = 0;
  private tmpN = new THREE.Vector3();

  constructor(private phys: Physics, private terrain: Terrain, spawn: THREE.Vector3) {
    const R = phys.R;
    this.pos.copy(spawn);
    this.prevPos.copy(spawn);
    this.body = phys.world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn.x, spawn.y + MOVE.capsuleHalf + MOVE.capsuleRadius, spawn.z));
    this.collider = phys.world.createCollider(R.ColliderDesc.capsule(MOVE.capsuleHalf, MOVE.capsuleRadius).setFriction(0.8), this.body);
    this.controller = phys.world.createCharacterController(0.02);
    this.controller.setUp({ x: 0, y: 1, z: 0 });
    this.controller.setMaxSlopeClimbAngle(THREE.MathUtils.degToRad(41));
    this.controller.setMinSlopeSlideAngle(THREE.MathUtils.degToRad(34));
    this.controller.enableAutostep(0.28, 0.2, false);
    this.controller.enableSnapToGround(0.25);
    this.controller.setApplyImpulsesToDynamicBodies(true);
    this.controller.setCharacterMass(130); // astronauta + traje
  }

  teleport(x: number, z: number, yOff = 0.2, absY?: number) {
    const y = absY ?? this.terrain.heightAt(x, z) + yOff;
    this.pos.set(x, y, z);
    this.prevPos.copy(this.pos);
    this.vel.set(0, 0, 0);
    this.body.setNextKinematicTranslation({ x, y: y + MOVE.capsuleHalf + MOVE.capsuleRadius, z });
    this.body.setTranslation({ x, y: y + MOVE.capsuleHalf + MOVE.capsuleRadius, z }, true);
  }

  /** passo fixo de física (dt = 1/60) */
  step(dt: number, input: Input, speedMul = 1) {
    this.prevPos.copy(this.pos);
    if (this.frozen) return;
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const target = new THREE.Vector3().addScaledVector(fwd, input.move.y).addScaledVector(right, input.move.x);
    const mag = Math.min(1, target.length());
    if (mag > 0) target.normalize();
    // joystick analógico: metade do curso = caminhada, curso cheio = galope (sem degrau brusco)
    const base = input.analog
      ? (mag <= 0.55 ? MOVE.walk * (mag / 0.55) : MOVE.walk + (MOVE.run - MOVE.walk) * Math.min(1, (mag - 0.55) / 0.37))
      : (input.sprint ? MOVE.run : MOVE.walk) * mag;
    let speed = base * speedMul;
    // morros: subida suave quase não freia (o controlador já projeta o passo na rampa); só rampas fortes pesam
    if (this.grounded && mag > 0) {
      const n = this.terrain.normalAt(this.pos.x, this.pos.z, this.tmpN);
      const up = -(n.x * target.x + n.z * target.z); // >0 = subindo
      if (up > 0.18) speed *= Math.max(0.6, 1 - (up - 0.18) * 1.2);
    }
    target.multiplyScalar(speed);

    // pulinhos sobre pedrinhas/lombadas (fração de segundo no ar) não tiram a aderência do jogador
    const accel = this.grounded || (this.airTime < 0.25 && this.vel.y < 1) ? MOVE.accelGround : MOVE.accelAir;
    const hv = new THREE.Vector3(this.vel.x, 0, this.vel.z);
    const dv = target.sub(hv);
    const maxDv = accel * dt;
    if (dv.length() > maxDv) dv.setLength(maxDv);
    this.vel.x += dv.x;
    this.vel.z += dv.z;

    // pulo com "buffer" (apertou um pouco antes de tocar o chão) e "coyote time" (acabou de sair da borda)
    if (input.consume('jump')) this.jumpBuf = 0.15;
    else this.jumpBuf = Math.max(0, this.jumpBuf - dt);
    this.coyote = this.grounded ? 0.1 : Math.max(0, this.coyote - dt);
    if (this.grounded && this.vel.y < 0) this.vel.y = -0.5;
    if (this.jumpBuf > 0 && (this.grounded || this.coyote > 0) && this.vel.y <= 0.1) {
      this.vel.y = MOVE.jumpV * (input.sprint ? 1.08 : 1); this.grounded = false; this.jumpBuf = 0; this.coyote = 0;
    }
    this.vel.y -= WORLD.gravity * dt;

    // no chão, o passo segue a inclinação do terreno: na subida o controlador não "come" a velocidade
    let climbY = 0;
    if (this.grounded) {
      const n = this.terrain.normalAt(this.pos.x, this.pos.z, this.tmpN);
      if (n.y > 0.72) climbY = -(n.x * this.vel.x + n.z * this.vel.z) / n.y; // dy/dt ao longo da rampa
    }
    const desired = { x: this.vel.x * dt, y: (this.vel.y + Math.max(0, climbY)) * dt, z: this.vel.z * dt };
    this.controller.computeColliderMovement(this.collider, desired);
    const mv = this.controller.computedMovement();
    const wasGrounded = this.grounded;
    this.grounded = this.controller.computedGrounded();
    const t = this.body.translation();
    let nx = t.x + mv.x, ny = t.y + mv.y, nz = t.z + mv.z;

    // rede de segurança: nunca abaixo do terreno
    const hg = this.terrain.heightAt(nx, nz);
    const feet = ny - MOVE.capsuleHalf - MOVE.capsuleRadius;
    if (!Number.isFinite(nx + ny + nz) || feet < hg - 0.35) {
      ny = hg + MOVE.capsuleHalf + MOVE.capsuleRadius + 0.02;
      if (!Number.isFinite(nx) || !Number.isFinite(nz)) { nx = this.pos.x; nz = this.pos.z; }
      this.vel.y = 0;
      this.grounded = true;
    }
    this.body.setNextKinematicTranslation({ x: nx, y: ny, z: nz });
    // velocidade real (colisões podem ter bloqueado)
    const realV = new THREE.Vector3(mv.x / dt, mv.y / dt, mv.z / dt);
    if (!wasGrounded && this.grounded) {
      this.lastImpact = Math.max(0, -this.vel.y);
      this.landImpulse = this.lastImpact;
      this.airTime = 0;
    }
    if (this.grounded) {
      // só perde velocidade se bateu de verdade (pedra/parede); rampa e pedrinha não acumulam freada quadro a quadro
      const want = Math.hypot(this.vel.x, this.vel.z), got = Math.hypot(realV.x, realV.z);
      if (want > 0.05 && got < want * 0.55) { const k = got / want; this.vel.x *= Math.max(k, 0.5); this.vel.z *= Math.max(k, 0.5); }
      if (this.vel.y < 0) this.vel.y = 0;
    }
    else {
      this.airTime += dt;
      if (realV.y > this.vel.y + 0.5 && this.vel.y > 0) this.vel.y = realV.y;
      // bateu em algo no ar: não guarda velocidade "fantasma"
      if (Math.hypot(realV.x, realV.z) < Math.hypot(this.vel.x, this.vel.z) - 0.05) { this.vel.x = realV.x; this.vel.z = realV.z; }
    }
    // bate a cabeça
    if (!this.grounded && this.vel.y > 0 && mv.y < desired.y * 0.5) this.vel.y = 0;

    this.pos.set(nx, ny - MOVE.capsuleHalf - MOVE.capsuleRadius, nz);
  }

  horizontalSpeed() { return Math.hypot(this.vel.x, this.vel.z); }

  /** posição interpolada para renderização */
  renderPos(alpha: number, out = new THREE.Vector3()) {
    return out.lerpVectors(this.prevPos, this.pos, alpha);
  }

  private landImpulse = 0;
  private jumpBuf = 0;
  private coyote = 0;
  private eyeY = NaN;
  private dip = 0; private dipV = 0;
  updateCamera(cam: THREE.PerspectiveCamera, feet: THREE.Vector3, dt: number, collide: (from: THREE.Vector3, dir: THREE.Vector3, max: number) => number | null) {
    // suaviza degraus/encaixe no chão (sem atrasar quedas e pulos grandes)
    const fy = feet.y + MOVE.eye;
    if (!Number.isFinite(this.eyeY) || Math.abs(fy - this.eyeY) > 0.6 || !this.grounded) this.eyeY = fy;
    else this.eyeY = THREE.MathUtils.damp(this.eyeY, fy, 14, dt);
    // mola da aterrissagem (joelhos absorvem o impacto)
    if (this.landImpulse > 1.2) this.dipV -= Math.min(0.9, 0.2 * this.landImpulse);
    this.landImpulse = 0;
    this.dipV += (-60 * this.dip - 2 * 0.6 * Math.sqrt(60) * this.dipV) * dt;
    this.dip += this.dipV * dt;
    const eye = new THREE.Vector3(feet.x, this.eyeY + this.dip, feet.z);
    const sp = this.horizontalSpeed();
    if (this.grounded && sp > 0.2) this.headBob += dt * (sp > 2 ? 5.2 : 6.4) * Math.min(1, sp / 1.4);
    const bob = this.grounded ? Math.sin(this.headBob) * 0.025 * Math.min(1, sp / 2) : 0;
    const dir = new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
    if (this.firstPerson) {
      cam.position.copy(eye).addScaledVector(dir, 0.12);
      cam.position.y += bob;
      cam.lookAt(cam.position.clone().add(dir));
      return;
    }
    // 3ª pessoa: câmera sobre o ombro com colisão
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const pivot = eye.clone().addScaledVector(right, 0.35);
    pivot.y += 0.35;
    const back = dir.clone().negate();
    let want = this.camDist;
    const hit = collide(pivot, back, want + 0.3);
    if (hit !== null) want = Math.max(0.6, hit - 0.3);
    this.camDistSmooth = want < this.camDistSmooth ? want : THREE.MathUtils.damp(this.camDistSmooth, want, 4, dt);
    cam.position.copy(pivot).addScaledVector(back, this.camDistSmooth);
    const gh = this.terrain.heightAt(cam.position.x, cam.position.z) + 0.35;
    if (cam.position.y < gh) cam.position.y = gh;
    cam.lookAt(pivot.clone().addScaledVector(dir, 2));
  }
}
