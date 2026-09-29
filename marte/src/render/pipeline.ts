import * as THREE from 'three';
import { EffectComposer, RenderPass, EffectPass, BloomEffect, SMAAEffect, ToneMappingEffect, ToneMappingMode, VignetteEffect, Effect, SMAAPreset, BlendFunction } from 'postprocessing';
import { N8AOPostPass } from 'n8ao';
import type { QualitySettings } from '../core/quality';

class ExposureEffect extends Effect {
  constructor() {
    super('ExposureEffect', /* glsl */ `
      uniform float exposure; uniform float saturation; uniform vec3 lift; uniform float blackPoint;
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor){
        vec3 c = max(inputColor.rgb * exposure - blackPoint, 0.0);
        float l = dot(c, vec3(0.2126,0.7152,0.0722));
        c = mix(vec3(l), c, saturation) + lift;
        outputColor = vec4(max(c, 0.0), inputColor.a);
      }`, {
      uniforms: new Map<string, THREE.Uniform>([
        ['exposure', new THREE.Uniform(1)],
        ['saturation', new THREE.Uniform(0.96)],
        ['lift', new THREE.Uniform(new THREE.Vector3(0, 0, 0))],
        ['blackPoint', new THREE.Uniform(0.0042)],
      ]),
    });
  }
  set exposure(v: number) { (this.uniforms.get('exposure') as THREE.Uniform).value = v; }
  get exposure() { return (this.uniforms.get('exposure') as THREE.Uniform).value; }
}

/** Efeito de visor do capacete (1ª pessoa): aberração cromática leve nas bordas + reflexo sutil. */
class VisorEffect extends Effect {
  constructor() {
    super('VisorEffect', /* glsl */ `
      uniform float strength; uniform float dust; uniform float frost;
      float h12(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h12(i),h12(i+vec2(1,0)),f.x), mix(h12(i+vec2(0,1)),h12(i+vec2(1,1)),f.x), f.y); }
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor){
        vec2 d = uv - 0.5; float r = length(d*vec2(1.0,0.8));
        vec3 c = inputColor.rgb;
        float edge = smoothstep(0.46, 0.75, r)*strength;
        c *= 1.0 - edge*0.75;
        // poeira fina no visor
        float g = h12(floor(uv*vec2(420.0,260.0)));
        c += vec3(0.9,0.6,0.4) * step(0.9985, g) * dust * 0.08;
        c = mix(c, c*vec3(1.03,0.99,0.95), strength*0.5);
        // geada no visor no frio extremo da noite: cristais a partir das bordas
        if (frost > 0.001) {
          // cristais finos crescendo das bordas (padrão de samambaia = ruído em várias escalas)
          float n = vn(uv*vec2(90.0,56.0))*0.5 + vn(uv*vec2(260.0,160.0))*0.3 + vn(uv*vec2(22.0,14.0))*0.2;
          float veins = smoothstep(0.55, 0.62, vn(uv*vec2(180.0,110.0) + n*4.0));
          float grow = smoothstep(0.5 - frost*0.1, 0.72, r + (n - 0.5)*0.22);
          float f = clamp(grow*(0.35 + 0.65*veins), 0.0, 1.0) * frost;
          float lum = max(max(c.r,c.g),c.b);
          c = mix(c, vec3(0.7,0.8,0.9)*(0.12 + 0.88*lum) + vec3(0.015,0.02,0.03), f*0.6);
          c += vec3(0.8,0.9,1.0) * step(0.997, h12(floor(uv*vec2(900.0,560.0)))) * f * 0.25; // brilhos de gelo
        }
        outputColor = vec4(c, inputColor.a);
      }`, {
      uniforms: new Map<string, THREE.Uniform>([['strength', new THREE.Uniform(0)], ['dust', new THREE.Uniform(0)], ['frost', new THREE.Uniform(0)]]),
    });
  }
  set strength(v: number) { (this.uniforms.get('strength') as THREE.Uniform).value = v; }
  set dust(v: number) { (this.uniforms.get('dust') as THREE.Uniform).value = v; }
  set frost(v: number) { (this.uniforms.get('frost') as THREE.Uniform).value = v; }
}

export class Pipeline {
  composer: EffectComposer;
  exposure = new ExposureEffect();
  visor = new VisorEffect();
  private n8ao: any = null; // eslint-disable-line
  private bloom: BloomEffect | null = null;
  private renderPass: RenderPass;

  constructor(public renderer: THREE.WebGLRenderer, public scene: THREE.Scene, public camera: THREE.PerspectiveCamera, q: QualitySettings) {
    this.composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: 0 });
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);
    this.build(q);
  }

  build(q: QualitySettings) {
    // remove tudo menos o RenderPass
    for (const p of [...this.composer.passes]) if (p !== this.renderPass) { this.composer.removePass(p); p.dispose(); }
    const w = this.renderer.domElement.width, h = this.renderer.domElement.height;
    this.n8ao = null;
    if (q.ao) {
      const ao = new N8AOPostPass(this.scene, this.camera, w, h);
      ao.configuration.aoRadius = 1.1;
      ao.configuration.distanceFalloff = 0.6;
      ao.configuration.intensity = 1.35;
      ao.configuration.halfRes = q.aoHalfRes || w * h > 4e6;
      ao.configuration.depthAwareUpsampling = true;
      ao.configuration.gammaCorrection = false;
      ao.configuration.aoSamples = q.id === 'max' ? 24 : 16;
      ao.configuration.denoiseSamples = 8;
      ao.configuration.denoiseRadius = 12;
      ao.configuration.color = new THREE.Color(0.18, 0.08, 0.04);
      this.composer.addPass(ao);
      this.n8ao = ao;
    }
    const effects: Effect[] = [this.exposure];
    this.bloom = null;
    if (q.bloom) {
      this.bloom = new BloomEffect({ intensity: 0.55, luminanceThreshold: 0.95, luminanceSmoothing: 0.35, mipmapBlur: true, radius: 0.75 });
      effects.push(this.bloom);
    }
    effects.push(new ToneMappingEffect({ mode: ToneMappingMode.AGX }));
    effects.push(new VignetteEffect({ offset: 0.32, darkness: 0.42, blendFunction: BlendFunction.NORMAL }));
    effects.push(this.visor);
    if (q.smaa) effects.push(new SMAAEffect({ preset: q.id === 'max' || q.id === 'ultra' ? SMAAPreset.ULTRA : SMAAPreset.HIGH }));
    this.composer.addPass(new EffectPass(this.camera, ...effects));
  }

  setSize(w: number, h: number) {
    this.composer.setSize(w, h, false);
  }

  render(dt: number) {
    this.composer.render(dt);
  }
}
