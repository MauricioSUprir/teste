// Efeitos de armas em pools (sem luzes novas, sem recompilar): traçantes, arco elétrico recortado,
// lâmina de plasma, faíscas (gravidade marciana 3,72) e icor verde-escuro das criaturas.
import * as THREE from 'three';

const G = 3.72;

export class CombatVFX {
  group = new THREE.Group();
  private tracers: { m: THREE.Mesh; t: number; life: number }[] = [];
  private arcs: { l: THREE.Line; t: number; a: THREE.Vector3; b: THREE.Vector3; regen: number }[] = [];
  private blade: THREE.Mesh;
  private bladeT = 0;
  private sparks: THREE.Points;
  private sp: { p: THREE.Vector3; v: THREE.Vector3; t: number; life: number; c: THREE.Color }[] = [];
  private spPos: Float32Array; private spCol: Float32Array;
  private readonly MAXS = 300;

  constructor() {
    const trMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.85, 0.55), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const trGeo = new THREE.BoxGeometry(1, 1, 1); trGeo.translate(0, 0, 0.5);
    for (let i = 0; i < 16; i++) { const m = new THREE.Mesh(trGeo, trMat); m.visible = false; m.frustumCulled = false; this.group.add(m); this.tracers.push({ m, t: 0, life: 0 }); }
    const arcMat = new THREE.LineBasicMaterial({ color: new THREE.Color(0.7, 0.9, 1.0), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    for (let i = 0; i < 4; i++) {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(13 * 3), 3));
      const l = new THREE.Line(g, arcMat); l.visible = false; l.frustumCulled = false; this.group.add(l);
      this.arcs.push({ l, t: 0, a: new THREE.Vector3(), b: new THREE.Vector3(), regen: 0 });
    }
    // lâmina do cortador: leque de plasma azulado
    const bg = new THREE.RingGeometry(0.35, 1.6, 20, 1, -0.55, 1.1); bg.rotateX(-Math.PI / 2); bg.rotateY(Math.PI / 2);
    this.blade = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.62, 0.85, 1.0), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true, fog: false })); // 1 programa só (DoubleSide transparente compilaria a variante de trás na 1ª vez)
    this.blade.frustumCulled = false;
    this.group.add(this.blade);
    this.spPos = new Float32Array(this.MAXS * 3); this.spCol = new Float32Array(this.MAXS * 3);
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(this.spPos, 3));
    sg.setAttribute('color', new THREE.BufferAttribute(this.spCol, 3));
    this.sparks = new THREE.Points(sg, new THREE.PointsMaterial({ size: 0.06, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    this.sparks.frustumCulled = false;
    this.group.add(this.sparks);
  }

  warm(on: boolean) {
    this.tracers[0].m.visible = on; this.arcs[0].l.visible = on; this.blade.visible = on;
  }

  tracer(a: THREE.Vector3, b: THREE.Vector3) {
    const tr = this.tracers.find((x) => x.t <= 0) ?? this.tracers[0];
    const len = a.distanceTo(b);
    tr.m.position.copy(a); tr.m.lookAt(b); tr.m.scale.set(0.012, 0.012, len);
    tr.m.visible = true; tr.t = 0.06; tr.life = 0.06;
  }

  arc(a: THREE.Vector3, b: THREE.Vector3) {
    const ar = this.arcs.find((x) => x.t <= 0) ?? this.arcs[0];
    ar.a.copy(a); ar.b.copy(b); ar.t = 0.18; ar.regen = 0; ar.l.visible = true;
    this.jag(ar);
  }
  private jag(ar: { l: THREE.Line; a: THREE.Vector3; b: THREE.Vector3 }) {
    const p = ar.l.geometry.attributes.position as THREE.BufferAttribute;
    const d = ar.a.distanceTo(ar.b);
    for (let i = 0; i <= 12; i++) {
      const k = i / 12;
      const x = THREE.MathUtils.lerp(ar.a.x, ar.b.x, k), y = THREE.MathUtils.lerp(ar.a.y, ar.b.y, k), z = THREE.MathUtils.lerp(ar.a.z, ar.b.z, k);
      const j = i === 0 || i === 12 ? 0 : d * 0.05;
      p.setXYZ(i, x + (Math.random() - 0.5) * j, y + (Math.random() - 0.5) * j, z + (Math.random() - 0.5) * j);
    }
    p.needsUpdate = true;
  }

  slash(pos: THREE.Vector3, yaw: number) {
    this.blade.position.copy(pos);
    this.blade.rotation.set(0, yaw, 0);
    this.bladeT = 0.14;
  }

  /** faíscas: metal (laranja) ou icor (verde-escuro) */
  burst(at: THREE.Vector3, n: number, kind: 'metal' | 'ichor' | 'plasma' | 'dust') {
    const col = kind === 'metal' ? new THREE.Color(1.0, 0.6, 0.25) : kind === 'ichor' ? new THREE.Color(0.1, 0.22, 0.1) : kind === 'plasma' ? new THREE.Color(0.9, 0.5, 0.2) : new THREE.Color(0.35, 0.22, 0.14);
    for (let i = 0; i < n; i++) {
      if (this.sp.length >= this.MAXS) this.sp.shift();
      const v = new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 2.5 + 0.5, (Math.random() - 0.5) * 3);
      if (kind === 'dust') v.multiplyScalar(0.6);
      this.sp.push({ p: at.clone(), v, t: 0, life: 0.35 + Math.random() * 0.5, c: col });
    }
  }

  update(dt: number) {
    for (const tr of this.tracers) if (tr.t > 0) { tr.t -= dt; if (tr.t <= 0) tr.m.visible = false; }
    for (const ar of this.arcs) if (ar.t > 0) {
      ar.t -= dt; ar.regen -= dt;
      if (ar.regen <= 0) { ar.regen = 0.04; this.jag(ar); }
      if (ar.t <= 0) ar.l.visible = false;
    }
    this.bladeT = Math.max(0, this.bladeT - dt);
    (this.blade.material as THREE.MeshBasicMaterial).opacity = this.bladeT > 0 ? Math.min(1, this.bladeT / 0.07) * 0.8 : 0;
    this.blade.visible = this.bladeT > 0;
    let n = 0;
    this.sp = this.sp.filter((s) => (s.t += dt) < s.life);
    for (const s of this.sp) {
      s.v.y -= G * dt;
      s.p.addScaledVector(s.v, dt);
      const f = 1 - s.t / s.life;
      this.spPos[n * 3] = s.p.x; this.spPos[n * 3 + 1] = s.p.y; this.spPos[n * 3 + 2] = s.p.z;
      this.spCol[n * 3] = s.c.r * f * 3; this.spCol[n * 3 + 1] = s.c.g * f * 3; this.spCol[n * 3 + 2] = s.c.b * f * 3;
      n++;
    }
    const g = this.sparks.geometry;
    g.setDrawRange(0, n);
    (g.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (g.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  }
}
