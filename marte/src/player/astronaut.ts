import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { enhanceObject } from '../render/materials';
import { buildSuit, makeSuitMaterials } from './suit';

export class Astronaut {
  readonly root = new THREE.Group();
  mixer!: THREE.AnimationMixer;
  private actions: Record<string, THREE.AnimationAction> = {};
  private current = '';
  headBone: THREE.Object3D | null = null;
  headlamp: THREE.SpotLight;
  helmet = new THREE.Group();
  private visorMat!: THREE.MeshPhysicalMaterial;

  constructor() {
    this.headlamp = new THREE.SpotLight(0xfff1dd, 0, 60, THREE.MathUtils.degToRad(32), 0.55, 1.6);
    this.headlamp.castShadow = false;
    this.headlamp.visible = false;
  }

  async load(url: string) {
    const gltf = await new GLTFLoader().loadAsync(url);
    const model = gltf.scene;
    model.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
        m.frustumCulled = false;
        m.visible = false; // o corpo base vira só esqueleto; o traje é montado em peças
      }
      if (!this.headBone && /Head$/.test(o.name)) this.headBone = o;
    });
    // escala para 1,83 m (≈ 1,78 m + botas/capacete)
    const box = new THREE.Box3().setFromObject(model);
    const h = box.max.y - box.min.y;
    model.scale.multiplyScalar(1.74 / h);
    this.root.add(model);

    const mats = makeSuitMaterials();
    model.updateMatrixWorld(true);
    buildSuit(model, mats);
    this.buildHelmet(mats.hard);
    this.buildBackpack(model, mats.hard);

    this.mixer = new THREE.AnimationMixer(model);
    for (const clip of gltf.animations) {
      if (!['idle', 'walk', 'run'].includes(clip.name)) continue;
      const a = this.mixer.clipAction(clip);
      a.enabled = true;
      a.setEffectiveWeight(0);
      a.play();
      this.actions[clip.name] = a;
    }
    this.setAnim('idle', 0);
    enhanceObject(this.root);
  }

  private buildHelmet(suit: THREE.Material) {
    if (!this.headBone) return;
    const g = this.helmet;
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.19, 48, 32), suit);
    shell.scale.set(1, 1.08, 1.05);
    const visorGeo = new THREE.SphereGeometry(0.197, 48, 32, Math.PI / 2 - Math.PI * 0.4, Math.PI * 0.8, Math.PI * 0.2, Math.PI * 0.45);
    this.visorMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(1.0, 0.76, 0.33), metalness: 1, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 2 });
    this.visorMat.userData.noDust = true;
    const visor = new THREE.Mesh(visorGeo, this.visorMat);
    visor.scale.set(1, 1.08, 1.05);
    const ringGeo = new THREE.TorusGeometry(0.165, 0.026, 16, 48);
    ringGeo.rotateX(Math.PI / 2);
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshStandardMaterial({ color: 0x8b8f96, metalness: 0.9, roughness: 0.3 }));
    ring.position.y = -0.16;
    const lampGeo = new THREE.CylinderGeometry(0.022, 0.026, 0.05, 20);
    lampGeo.rotateX(Math.PI / 2);
    const lampMat = new THREE.MeshStandardMaterial({ color: 0x33363a, metalness: 0.6, roughness: 0.4, emissive: new THREE.Color(0xfff0d8), emissiveIntensity: 0 });
    for (const s of [-1, 1]) {
      const lamp = new THREE.Mesh(lampGeo, lampMat);
      lamp.position.set(0.135 * s, 0.07, 0.07);
      lamp.name = 'lamp';
      g.add(lamp);
    }
    g.add(shell, visor, ring);
    g.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    // compensa a escala do osso (armature 0,01 × escala do modelo)
    this.headBone.updateWorldMatrix(true, false);
    const ws = new THREE.Vector3();
    this.headBone.getWorldScale(ws);
    g.scale.setScalar(1 / ws.x);
    g.position.set(0, 0.075 / ws.x, 0.015 / ws.x);
    this.headBone.add(g);
  }

  private buildBackpack(model: THREE.Object3D, suit: THREE.Material) {
    let spine: THREE.Object3D | null = null;
    model.traverse((o) => { if (!spine && /Spine2$/.test(o.name)) spine = o; });
    if (!spine) return;
    const sp = spine as THREE.Object3D;
    sp.updateWorldMatrix(true, false);
    const ws = new THREE.Vector3();
    sp.getWorldScale(ws);
    const pack = new THREE.Group();
    const body = new THREE.Mesh(new RoundedBoxGeometry(0.46, 0.6, 0.22, 4, 0.05), suit);
    const detailMat = new THREE.MeshStandardMaterial({ color: 0x2a2c30, metalness: 0.5, roughness: 0.5 });
    const vent = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.12, 0.03, 2, 0.01), detailMat);
    vent.position.set(0, -0.18, -0.115);
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.45, 20), new THREE.MeshStandardMaterial({ color: 0xb8bcc2, metalness: 0.85, roughness: 0.25 }));
    tank.position.set(0.17, 0.02, -0.1);
    const tank2 = tank.clone(); tank2.position.x = -0.17;
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.35, 6), detailMat);
    ant.position.set(0.18, 0.45, 0.0);
    pack.add(body, vent, tank, tank2, ant);
    pack.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    pack.scale.setScalar(1 / ws.x);
    pack.position.set(0, 0.02 / ws.x, -0.2 / ws.x);
    sp.add(pack);
  }

  setAnim(name: string, fade = 0.25) {
    if (name === this.current || !this.actions[name]) return;
    const next = this.actions[name];
    next.reset().setEffectiveWeight(1).fadeIn(fade);
    if (this.current && this.actions[this.current]) this.actions[this.current].fadeOut(fade);
    this.current = name;
  }

  /** anima de acordo com a velocidade horizontal (passadas longas e lentas da gravidade marciana) */
  update(dt: number, speed: number, grounded: boolean) {
    if (!this.mixer) return;
    if (!grounded) {
      this.setAnim('run', 0.3);
      this.actions.run.timeScale = 0.25;
    } else if (speed < 0.25) {
      this.setAnim('idle', 0.35);
    } else if (speed < 2.0) {
      this.setAnim('walk', 0.3);
      this.actions.walk.timeScale = THREE.MathUtils.clamp(speed / 1.45, 0.4, 1.4) * 0.85;
    } else {
      this.setAnim('run', 0.3);
      this.actions.run.timeScale = THREE.MathUtils.clamp(speed / 4.2, 0.45, 1.0) * 0.8;
    }
    this.mixer.update(dt);
  }

  setLamp(on: boolean) {
    this.headlamp.intensity = on ? 160 : 0;
    this.headlamp.visible = on;
    this.helmet.traverse((o) => {
      if (o.name === 'lamp') ((o as THREE.Mesh).material as THREE.MeshStandardMaterial).emissiveIntensity = on ? 8 : 0;
    });
  }

  setFirstPerson(fp: boolean) {
    this.root.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).layers.set(fp ? 1 : 0); });
    // no modo 1ª pessoa o corpo continua projetando sombra (camada 1 é incluída na luz)
  }
}
