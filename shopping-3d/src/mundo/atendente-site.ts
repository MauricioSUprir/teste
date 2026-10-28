/**
 * A atendente do caixa das lojas âncora: a mesma do site (Rocketbox
 * "Business_Female_01", MIT, com o blazer da loja). Respira parada atrás do
 * balcão; quando alguém chega perto, vira para a pessoa e conversa gesticulando.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

export class AtendenteSite {
  readonly grupo = new THREE.Group();
  private mixer: THREE.AnimationMixer | null = null;
  private respirar: THREE.AnimationAction | null = null;
  private falar: THREE.AnimationAction | null = null;
  private falando = false;
  private rumoBase: number | null = null;
  private lixo: { dispose: () => void }[] = [];

  constructor(url: string) {
    loader
      .loadAsync(url)
      .then((g) => {
        g.scene.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          m.castShadow = true;
          m.receiveShadow = true;
          m.frustumCulled = false;
          this.lixo.push(m.geometry);
          for (const mat of Array.isArray(m.material) ? m.material : [m.material]) this.lixo.push(mat);
        });
        this.grupo.add(g.scene);
        this.mixer = new THREE.AnimationMixer(g.scene);
        const clipe = (nome: string) => g.animations.find((a) => a.name === nome) ?? null;
        const r = clipe("respirar");
        const f = clipe("falar");
        if (r) {
          this.respirar = this.mixer.clipAction(r);
          this.respirar.play();
        }
        if (f) {
          this.falar = this.mixer.clipAction(f);
          this.falar.setEffectiveWeight(0);
          this.falar.play();
        }
      })
      .catch(() => {
        // sem o modelo: o caixa fica sem a atendente
      });
  }

  atualizar(dt: number, pessoa: THREE.Vector3) {
    if (!this.mixer) return;
    if (this.rumoBase === null) this.rumoBase = this.grupo.rotation.y;
    const p = this.grupo.position;
    const d = Math.hypot(pessoa.x - p.x, pessoa.z - p.z);
    const quer = d < 3.6;
    if (quer !== this.falando && this.respirar && this.falar) {
      this.falando = quer;
      if (quer) {
        this.falar.reset().setEffectiveWeight(1);
        this.falar.crossFadeFrom(this.respirar, 0.5, false);
      } else {
        this.respirar.reset().setEffectiveWeight(1);
        this.respirar.crossFadeFrom(this.falar, 0.6, false);
      }
    }
    // vira para quem está no balcão (no máximo ~55° para cada lado)
    let alvo = this.rumoBase;
    if (d < 6) {
      const ang = Math.atan2(pessoa.x - p.x, pessoa.z - p.z);
      const dif = Math.atan2(Math.sin(ang - this.rumoBase), Math.cos(ang - this.rumoBase));
      alvo = this.rumoBase + THREE.MathUtils.clamp(dif, -0.95, 0.95);
    }
    const dr = Math.atan2(Math.sin(alvo - this.grupo.rotation.y), Math.cos(alvo - this.grupo.rotation.y));
    this.grupo.rotation.y += dr * Math.min(1, dt * 3);
    this.mixer.update(dt);
  }

  descartar() {
    this.mixer?.stopAllAction();
    this.lixo.forEach((x) => x.dispose());
    this.grupo.removeFromParent();
  }
}
