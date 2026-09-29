import * as THREE from 'three';
import { CSM } from 'three/examples/jsm/csm/CSM.js';
import { WORLD, type TerrainData, type Crater } from './world/config';
import { Terrain, LAYER_IDS, type TerrainTextures } from './world/terrain';
import { Rocks, ROCK_IDS, loadRockAsset, type RockAsset } from './world/rocks';
import { Sky } from './world/sky';
import { computeSky, directTransmittance, type SkyState } from './world/astro';
import { sunTransmit, skyAmbient } from './world/atmosphere';
import { fogUniforms, installMarsFog } from './render/marsfog';
import { setCSM, enhanceObject } from './render/materials';
import { buildCrashSite, carveCrash, makeLanderMaterials } from './world/lander';
import { Footprints, Dust, Tracks, DustDevils } from './world/effects';
import { Rover } from './world/rover';
import { sfx } from './audio/sfx';
import { BAL } from './sim/balance';
import { Pipeline } from './render/pipeline';
import { Physics, initRapier } from './core/physics';
import { Input } from './core/input';
import { QUALITY, DynamicResolution, type QualityId, type QualitySettings } from './core/quality';
import { Player } from './player/player';
import { Astronaut } from './player/astronaut';
import { viewSize } from './core/viewport';
import { Interior } from './world/interior';
import { updateNightFx } from './world/nightfx';

export type Progress = (key: string, frac: number) => void;
const ASSETS = './assets';

export interface GameOptions { quality: QualityId; fov: number; sensitivity: number; invertY: boolean; resScale: number | 'dynamic' }

export class Game {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  pipeline!: Pipeline;
  csm: CSM | null = null;
  q: QualitySettings;
  input: Input;
  terrain!: Terrain;
  rocks!: Rocks;
  sky = new Sky();
  physics!: Physics;
  player!: Player;
  astro = new Astronaut();
  interior = new Interior();
  /** dentro do habitat: sem Sol/céu, só luz interna */
  inside = false;
  /** 0 dia … 1 noite fechada */
  night = 0;
  /** gelo no visor (0..1), definido pela simulação de temperatura */
  visorFrost = 0;
  private fxT = 0;
  dyn = new DynamicResolution();
  pmrem: THREE.PMREMGenerator;
  envScene = new THREE.Scene();
  envRT: THREE.WebGLRenderTarget | null = null;
  private envTimer = 0;
  private probeRT = new THREE.WebGLCubeRenderTarget(8, { type: THREE.HalfFloatType });
  private probeCam = new THREE.CubeCamera(1, 20000, this.probeRT);
  private probeBuf = new Uint16Array(8 * 8 * 4);
  private skyLum = 0.1;
  private probeTimer = 0;
  private lastEnvSun = new THREE.Vector3();
  private lastEnvTau = -1;
  // tempo: sóis desde o pouso (fração = hora local / 24)
  sol = 1 + 8.2 / 24;
  timeScale = 24 * 60 / 40 / 60; // 1 sol = 40 min reais (sóis por segundo × 3600... ver tick)
  tau = 0.55;
  sky0!: SkyState;
  exposure = 1;
  running = false;
  paused = true;
  private acc = 0;
  private lastT = 0;
  private frameMs = 16;
  fps = 60;
  private fpsAcc = 0; private fpsN = 0;
  opts: GameOptions;
  lampOn = false;
  menuMode = true;
  private menuT = 0;
  texTier: '1k' | '2k' | '4k' = '1k';
  private rockAssets: RockAsset[] = [];
  onFrame?: (dt: number) => void;
  crash!: ReturnType<typeof buildCrashSite>;
  footprints!: Footprints;
  rover!: Rover;
  tracks!: Tracks;
  devils!: DustDevils;
  driving = false;
  private driveCamYaw = 0;
  dust!: Dust;
  private sunColI = new THREE.Color();
  private ambC = new THREE.Color();

  constructor(public canvas: HTMLCanvasElement, opts: GameOptions) {
    this.opts = opts;
    this.q = QUALITY[opts.quality];
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false, depth: true, alpha: false, preserveDrawingBuffer: false });
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.setPixelRatio(this.pixelRatio());
    this.renderer.setSize(innerWidth, innerHeight, false);
    this.camera = new THREE.PerspectiveCamera(opts.fov, innerWidth / innerHeight, 0.08, 16000);
    this.camera.layers.enable(0);
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.input = new Input(canvas);
    installMarsFog();
    this.scene.fog = new THREE.FogExp2(0x000000, 0.0001);
    this.scene.add(this.sky.mesh, this.sky.phobos, this.sky.deimos);
    this.envScene.add(this.sky.envMesh);
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.paused = true; });
    addEventListener('resize', () => this.resize());
  }

  pixelRatio() {
    let dpr = Math.min(devicePixelRatio || 1, this.q.pixelRatioCap);
    // orçamento de pixels (exceto Máxima): evita renderizar 4K nativo em GPUs médias
    if (this.q.id !== 'max') dpr = Math.min(dpr, Math.sqrt((this.q.id === 'ultra' ? 5.5e6 : 3.7e6) / Math.max(1, innerWidth * innerHeight)));
    const s = this.opts.resScale === 'dynamic' ? this.dyn.scale : this.opts.resScale;
    return Math.max(0.35, dpr * s);
  }

  resize() {
    const { w, h } = viewSize();
    this.renderer.setPixelRatio(this.pixelRatio());
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // na vertical, abre o campo de visão para não ficar "espremido" (limitado a 95°)
    const a = this.camera.aspect;
    this.camera.fov = a < 1 ? Math.min(95, this.opts.fov * Math.pow(1 / a, 0.5)) : this.opts.fov;
    this.camera.updateProjectionMatrix();
    this.pipeline?.setSize(w, h);
    this.csm?.updateFrustums();
  }

  // ------------------------------------------------------------ carregamento
  private texLoader = new THREE.ImageBitmapLoader().setOptions({ imageOrientation: 'none', premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  loadTex = (url: string, srgb: boolean) =>
    new Promise<THREE.Texture>((res, rej) => {
      this.texLoader.load(url, (bmp) => {
        const t = new THREE.Texture(bmp as unknown as HTMLImageElement);
        t.flipY = false;
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        t.anisotropy = Math.min(16, this.renderer.capabilities.getMaxAnisotropy());
        t.generateMipmaps = true;
        t.minFilter = THREE.LinearMipmapLinearFilter;
        t.needsUpdate = true;
        res(t);
      }, undefined, rej);
    });

  async loadTerrainTextures(tier: '1k' | '2k' | '4k'): Promise<TerrainTextures> {
    const a = await Promise.all(LAYER_IDS.map((id) => this.loadTex(`${ASSETS}/tex/${tier}/${id}_a.webp`, true)));
    const n = await Promise.all(LAYER_IDS.map((id) => this.loadTex(`${ASSETS}/tex/${tier}/${id}_n.webp`, false)));
    return { a, n };
  }

  generateTerrain(onFrac: (f: number) => void): Promise<TerrainData> {
    const workers = Math.max(2, Math.min(8, (navigator.hardwareConcurrency || 4) - 1));
    const res = WORLD.res;
    const heights = new Float32Array(res * res);
    let far: Float32Array | null = null;
    let craters: Crater[] = [];
    let done = 0;
    return new Promise((resolve, reject) => {
      const rowsPer = Math.ceil(res / workers);
      for (let w = 0; w < workers; w++) {
        const j0 = w * rowsPer, j1 = Math.min(res, j0 + rowsPer);
        const worker = new Worker(new URL('./world/terrain.worker.ts', import.meta.url), { type: 'module' });
        worker.onerror = (e) => reject(e);
        worker.onmessage = (e) => {
          const d = e.data;
          heights.set(d.heights, d.j0 * res);
          if (d.far) far = d.far;
          craters = d.craters;
          worker.terminate();
          done++;
          onFrac(done / workers);
          if (done === workers) {
            let minH = Infinity, maxH = -Infinity;
            for (let i = 0; i < heights.length; i++) { const h = heights[i]; if (h < minH) minH = h; if (h > maxH) maxH = h; }
            resolve({ heights, far: far!, craters, minH, maxH });
          }
        };
        worker.postMessage({ seed: WORLD.seed, j0, j1, far: w === 0 });
      }
    });
  }

  async load(progress: Progress) {
    const parts = { terrain: 0, physics: 0, tex: 0, models: 0 };
    const report = (key: string) => progress(key, parts.terrain * 0.35 + parts.physics * 0.1 + parts.tex * 0.3 + parts.models * 0.25);
    const initialTier = this.q.texTier === '1k' ? '1k' : '1k'; // começa leve; alta resolução vem em segundo plano
    const [data, R, tex, rockAssets] = await Promise.all([
      this.generateTerrain((f) => { parts.terrain = f; report('load_terrain'); }),
      initRapier().then((r) => { parts.physics = 1; report('load_physics'); return r; }),
      this.loadTerrainTextures(initialTier).then((t) => { parts.tex = 1; report('load_textures'); return t; }),
      Promise.all([
        ...ROCK_IDS.map((id) => loadRockAsset(ASSETS, id, this.loadTex, '1k')),
      ]).then(async (r) => { await this.astro.load(`${ASSETS}/models/astronaut_base.glb`); parts.models = 1; report('load_models'); return r; }),
    ]);
    this.rockAssets = rockAssets;
    this.texTier = initialTier;
    this.setupShadows();
    carveCrash(data.heights, WORLD.res, WORLD.size);
    this.terrain = new Terrain(data, tex, this.q.antiTiling);
    this.scene.add(this.terrain.group);
    const crash = buildCrashSite(this.terrain, makeLanderMaterials());
    enhanceObject(crash.group);
    this.scene.add(crash.group);
    this.crash = crash;
    const avoid = [{ x: -8, z: -4, r: 9 }, { x: 0, z: 0, r: 6 }, { x: 15, z: -2, r: 10 }, { x: 16, z: -16, r: 6 }, ...crash.crates.map((c) => ({ x: c.x, z: c.z, r: 2 }))];
    this.rocks = new Rocks(rockAssets, this.terrain, this.q.rockDensity, avoid);
    this.scene.add(this.rocks.group);

    this.physics = new Physics(R);
    this.physics.addHeightfield(data.heights, WORLD.res, WORLD.size);
    this.physics.addRocks(this.rocks.colliders(0.45));
    this.physics.addBounds(WORLD.size);
    this.physics.addBoxes(crash.colliders);
    this.interior.addColliders(this.physics);
    this.scene.add(this.interior.group, ...this.interior.lights);
    const spawn = new THREE.Vector3(1, 0, 3);
    spawn.y = this.terrain.heightAt(spawn.x, spawn.z);
    this.player = new Player(this.physics, this.terrain, spawn);
    this.player.yaw = Math.atan2(-(-8 - 1), -(-4 - 3)) + 0.5; // olhando para o módulo, levemente de lado
    this.scene.add(this.astro.root, this.astro.headlamp, this.astro.headlamp.target);
    this.footprints = new Footprints(this.terrain);
    this.scene.add(this.footprints.mesh);
    this.rover = new Rover(this.physics, this.terrain);
    this.rover.spawn(16, -16, 1.9);
    this.scene.add(this.rover.root, this.rover.blob);
    this.tracks = new Tracks(this.terrain);
    this.scene.add(this.tracks.mesh);
    this.devils = new DustDevils(this.terrain);
    this.scene.add(this.devils.group);
    this.dust = new Dust(this.q.particles);
    this.scene.add(this.dust.points);
    this.physics.world.step();

    this.pipeline = new Pipeline(this.renderer, this.scene, this.camera, this.q);
    this.resize();
    this.updateSky(0);
    this.player.updateCamera(this.camera, this.player.pos, 0.016, this.camCollide);
    this.terrain.update(this.camera.position, this.q.lodScale, 0, true);
    this.rocks.update(this.camera.position, true);
    progress('load_shaders', 0.97);
    await this.renderer.compileAsync(this.scene, this.camera);
    this.updateEnv(true);
    this.measureSky();
    this.updateSky(0);
    this.pipeline.render(0.016);
    progress('load_done', 1);
    // alta resolução em segundo plano
    this.upgradeTextures();
  }

  private async upgradeTextures() {
    const want = this.q.texTier;
    const order: ('2k' | '4k')[] = want === '4k' ? ['2k', '4k'] : want === '2k' ? ['2k'] : [];
    for (const tier of order) {
      try {
        const tex = await this.loadTerrainTextures(tier);
        if (this.q.texTier === '1k') { tex.a.concat(tex.n).forEach((t) => t.dispose()); return; }
        this.terrain.setTextures(tex);
        this.texTier = tier;
        if (tier === '2k') {
          for (let i = 0; i < ROCK_IDS.length; i++) {
            const [a, n] = await Promise.all([
              this.loadTex(`${ASSETS}/rocks/${ROCK_IDS[i]}_2k_a.webp`, true),
              this.loadTex(`${ASSETS}/rocks/${ROCK_IDS[i]}_2k_n.webp`, false),
            ]);
            this.rocks.setTextures(i, a, n);
          }
        }
      } catch (e) {
        console.warn('upgradeTextures', e);
        return;
      }
    }
  }

  camCollide = (from: THREE.Vector3, dir: THREE.Vector3, max: number) =>
    this.physics.castRay(from, dir, max, this.player.collider);

  setupShadows() {
    if (this.csm) {
      this.csm.remove();
      this.csm.dispose();
    }
    const q = this.q;
    this.csm = new CSM({
      maxFar: q.shadowFar,
      cascades: q.shadowCascades,
      mode: 'practical',
      parent: this.scene,
      shadowMapSize: q.shadowMapSize,
      lightDirection: new THREE.Vector3(-1, -1, -1).normalize(),
      camera: this.camera,
      lightIntensity: 3,
      lightMargin: 120,
      shadowBias: -0.00015,
    });
    this.csm.fade = true;
    for (const l of this.csm.lights) {
      l.shadow.normalBias = 0.035;
      l.shadow.radius = 3.5;
      l.shadow.camera.layers.enable(1);
    }
    setCSM(this.csm);
  }

  setQuality(id: QualityId) {
    const prevCascades = this.q.shadowCascades, prevSize = this.q.shadowMapSize;
    this.q = QUALITY[id];
    this.opts.quality = id;
    if (this.q.shadowCascades !== prevCascades || this.q.shadowMapSize !== prevSize || !this.csm) this.setupShadows();
    else this.csm.maxFar = this.q.shadowFar;
    this.terrain.setAntiTiling(this.q.antiTiling);
    this.pipeline.build(this.q);
    this.resize();
    if (this.texTier === '1k' && this.q.texTier !== '1k') this.upgradeTextures();
    else if (this.q.texTier === '4k' && this.texTier !== '4k') this.upgradeTextures();
  }

  // ------------------------------------------------------------ céu / luz
  updateSky(dt: number) {
    const s = computeSky(this.sol);
    this.sky0 = s;
    const sun = new THREE.Vector3(...s.sunDir);
    const dayLight = THREE.MathUtils.smoothstep(sun.y, -0.05, 0.15);
    this.astro?.updateLamp(this.inside ? 1 : dayLight);
    this.night = 1 - THREE.MathUtils.smoothstep(sun.y, -0.12, 0.05);
    const U = this.sky.uniforms;
    U.uSun.value.copy(sun);
    U.uTau.value = this.tau;
    const power = s.solarConst / 590;
    U.uSunPower.value = power * 1.25;
    U.uSunCos.value = Math.cos(THREE.MathUtils.degToRad(s.sunAngularDiamDeg / 2));
    U.uEarth.value.set(...s.earthDir);
    // rotação das estrelas (dia sideral marciano ~24h37m) em torno do polo celeste
    const lat = THREE.MathUtils.degToRad(WORLD.latitudeDeg);
    const rot = new THREE.Matrix4().makeRotationX(-(Math.PI / 2 - lat)).multiply(new THREE.Matrix4().makeRotationY(this.sol * Math.PI * 2 * 1.0027));
    U.uStarRot.value.setFromMatrix4(rot);
    U.uStorm.value = THREE.MathUtils.smoothstep(this.tau, 1.5, 4);

    // luz direta do Sol
    const T = sunTransmit(sun.y, this.tau);
    const direct = directTransmittance(this.tau, Math.max(sun.y, 0));
    const horizonFade = THREE.MathUtils.smoothstep(sun.y, -0.01, 0.03);
    const sunI = 4.2 * power * Math.max(direct, 0.02) * horizonFade;
    const color = new THREE.Color(1, 0.96, 0.9).multiply(new THREE.Color(Math.pow(T.r, 0.25), Math.pow(T.g, 0.25), Math.pow(T.b, 0.25)));
    this.sunColI.copy(color).multiplyScalar(sunI / Math.PI);
    // à noite a mesma luz direcional vira o luar de Fobos + estrelas: fraca, azulada, com sombras suaves
    const nightK = 1 - THREE.MathUtils.smoothstep(sun.y, -0.1, 0.02);
    const moonDir = new THREE.Vector3(...s.phobosDir);
    if (moonDir.y < 0.25) moonDir.set(0.35, 0.8, -0.45);
    moonDir.normalize();
    const nightI = 0.032 * nightK * (1 - THREE.MathUtils.smoothstep(this.tau, 1, 4) * 0.8);
    if (this.csm) {
      const useMoon = nightI > sunI;
      this.csm.lightDirection.copy(useMoon ? moonDir : sun).negate();
      for (const l of this.csm.lights) {
        l.intensity = this.inside ? 0 : useMoon ? nightI : sunI;
        if (useMoon) l.color.setRGB(0.55, 0.66, 1.0); else l.color.copy(color);
      }
    }
    // névoa
    fogUniforms.uFogSun.value.copy(sun);
    fogUniforms.uFogTau.value = this.tau;
    fogUniforms.uFogSunPower.value = power * 1.25;
    fogUniforms.uFogDensity.value = 0.0008 * this.tau + THREE.MathUtils.smoothstep(this.tau, 1.2, 5) * 0.004;
    // exposição automática (estimativa analítica da luminância média da cena)
    const amb = skyAmbient(sun.y, this.tau, power * 1.25, this.ambC);
    const ambL = amb.r * 0.2126 + amb.g * 0.7152 + amb.b * 0.0722;
    void ambL;
    // luminância da cena ≈ solo iluminado pelo Sol + céu medido (sonda cúbica do próprio shader do céu)
    const lampL = this.driving && this.rover?.lightsOn ? 0.9 : this.lampOn && !this.driving ? 0.12 : 0;
    const sceneL = this.inside ? 0.5 : 0.3 * sunI * Math.max(sun.y, 0.0) / Math.PI + 0.55 * this.skyLum + lampL + 0.3 * nightI * moonDir.y / Math.PI + 0.0004;
    // adaptação parcial (como o olho/câmera): cenas escuras continuam mais escuras que o dia
    const key = 0.27 * THREE.MathUtils.clamp(Math.pow(sceneL / 0.35, 0.5), 0.04, 1.05);
    const targetExp = THREE.MathUtils.clamp(key / sceneL, 0.3, 12);
    this.exposure = dt > 0 ? THREE.MathUtils.damp(this.exposure, targetExp, 1.2, dt) : targetExp;
    this.pipeline && (this.pipeline.exposure.exposure = this.exposure);
    this.renderer.toneMappingExposure = this.exposure;
  }

  /** mede a radiância média do céu/horizonte renderizando o céu num cubo 8×8 */
  measureSky(exact = false) {
    if (!exact) {
      // estimativa analítica (sem leitura síncrona da GPU): céu médio + brilho noturno residual
      const c = skyAmbient(this.sky.uniforms.uSun.value.y, this.tau, this.sky.uniforms.uSunPower.value, this.ambC);
      this.skyLum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b + 0.0003;
      return;
    }
    this.probeCam.update(this.renderer, this.envScene);
    let sum = 0, n = 0;
    const H = THREE.DataUtils.fromHalfFloat;
    for (const f of [0, 1, 2, 4, 5]) { // laterais + zênite (face 3 = solo)
      this.renderer.readRenderTargetPixels(this.probeRT as unknown as THREE.WebGLRenderTarget, 0, 0, 8, 8, this.probeBuf, f);
      for (let i = 0; i < 64; i++) {
        const r = H(this.probeBuf[i * 4]), g = H(this.probeBuf[i * 4 + 1]), b = H(this.probeBuf[i * 4 + 2]);
        const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        if (Number.isFinite(l)) { sum += Math.min(l, 50); n++; }
      }
    }
    this.skyLum = n ? sum / n : 0.1;
  }

  updateEnv(force = false) {
    const s = this.sky.uniforms.uSun.value as THREE.Vector3;
    if (!force && s.angleTo(this.lastEnvSun) < THREE.MathUtils.degToRad(1.5) && Math.abs(this.tau - this.lastEnvTau) < 0.15) return;
    this.lastEnvTau = this.tau;
    this.lastEnvSun.copy(s);
    const rt = this.pmrem.fromScene(this.envScene, 0, 1, 20000, { size: 128 });
    this.scene.environment = rt.texture;
    this.envRT?.dispose();
    this.envRT = rt;
  }

  // ------------------------------------------------------------ laço
  start() {
    this.running = true;
    this.paused = false;
    this.lastT = performance.now();
    this.renderer.setAnimationLoop((t) => this.frame(t));
  }

  /** para testes: desliga o laço e renderiza sob demanda */
  freeze(on: boolean) {
    if (on) this.renderer.setAnimationLoop(null);
    else { this.lastT = performance.now(); this.renderer.setAnimationLoop((t) => this.frame(t)); }
  }
  renderOnce(simSeconds = 0) {
    const n = Math.round(simSeconds * 60);
    for (let i = 0; i < n; i++) this.tick(1 / 60);
    this.frame(this.lastT + 16.7);
    this.lastT += 16.7;
  }

  private pauseSkip = 0;
  private insideStep = 0;
  private frame(now: number) {
    const rawDt = (now - this.lastT) / 1000;
    this.lastT = now;
    const dt = Math.min(rawDt, 0.1); // aba escondida / travadas não explodem a simulação
    const t0 = performance.now();
    if (!this.paused) this.tick(dt);
    // pausado (fora do menu): desenha a ~15 fps para poupar bateria e aquecimento
    this.pauseSkip = this.paused && !this.menuMode ? (this.pauseSkip + 1) % 4 : 0;
    if (this.pauseSkip === 0) this.render(dt);
    this.frameMs = THREE.MathUtils.lerp(this.frameMs, rawDt * 1000, 0.1);
    this.fpsAcc += rawDt; this.fpsN++;
    if (this.fpsAcc > 0.5) { this.fps = this.fpsN / this.fpsAcc; this.fpsAcc = 0; this.fpsN = 0; }
    if (this.opts.resScale === 'dynamic' && !this.paused && this.dyn.update(rawDt * 1000, dt)) this.resize();
    void t0;
  }

  private tick(dt: number) {
    const STEP = 1 / 60;
    this.acc += dt;
    let n = 0;
    // olhar
    const look = this.input.takeLook();
    const k = 0.0022 * (this.camera.fov / 70);
    this.player.yaw -= look.x * k;
    this.player.pitch = THREE.MathUtils.clamp(this.player.pitch - look.y * k, -1.35, 1.35);
    if (this.input.consume('camera')) this.toggleCamera();
    if (this.input.consume('light')) { if (this.driving) this.rover.setLights(!this.rover.lightsOn); else this.setLamp(!this.lampOn); }
    while (this.acc >= STEP && n < 4) {
      if (this.driving) {
        const i = this.input;
        const on = i.enabled;
        this.rover.step(STEP, on ? i.move.y : 0, on ? i.move.x : 0, on ? i.isHeld('jump') : true);
        // o astronauta acompanha o assento do motorista (colisor desativado)
        const seat = new THREE.Vector3(-0.45, 0.9, 0.6).applyQuaternion(this.rover.quat).add(this.rover.pos);
        this.player.prevPos.copy(this.player.pos);
        this.player.pos.set(seat.x, seat.y - 0.9, seat.z);
        this.player.body.setNextKinematicTranslation({ x: seat.x, y: seat.y + 20, z: seat.z });
      } else if (this.input.enabled) { this.rover.step(STEP, 0, 0, true, false); this.player.step(STEP, this.input); }
      else { this.rover.step(STEP, 0, 0, true, false); this.player.frozen = true; this.player.step(STEP, this.input); this.player.frozen = false; }
      this.physics.step();
      this.rover.postStep();
      this.acc -= STEP;
      n++;
    }
    if (n === 4) this.acc = 0;
    // relógio marciano
    this.sol += dt / (BAL.realMinPerSol * 60);
    this.onFrame?.(dt);
  }

  private camPivot = new THREE.Vector3();
  private camPivotV = new THREE.Vector3();
  private camPivotInit = false;
  /** câmera de perseguição do rover: o mouse/toque orbita, com retorno suave para trás do veículo */
  private driveCamera(dt: number, alpha: number) {
    const rp = this.rover.root.position;
    const ry = this.rover.yaw();
    const idle = Math.abs(this.input.move.x) + Math.abs(this.input.move.y) > 0.1;
    let off = this.player.yaw - (ry + Math.PI);
    off = Math.atan2(Math.sin(off), Math.cos(off));
    if (idle && Math.abs(this.rover.speed) > 1) this.player.yaw -= off * Math.min(1, dt * 1.5);
    const yaw = this.player.yaw;
    const pitch = Math.min(-0.05, this.player.pitch);
    const dist = 9.5;
    // pivô com mola criticamente amortecida: a suspensão balança o rover, não a câmera
    const target = new THREE.Vector3(rp.x, rp.y + 2.3, rp.z);
    if (!this.camPivotInit || this.camPivot.distanceTo(target) > 8) { this.camPivot.copy(target); this.camPivotV.set(0, 0, 0); this.camPivotInit = true; }
    const h = Math.min(dt, 1 / 30);
    for (const [ax, w] of [['x', 9], ['y', 4.5], ['z', 9]] as const) {
      const a = w * w * (target[ax] - this.camPivot[ax]) - 2 * w * this.camPivotV[ax];
      this.camPivotV[ax] += a * h; this.camPivot[ax] += this.camPivotV[ax] * h;
    }
    const pivot = this.camPivot;
    const dir = new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    const cam = pivot.clone().addScaledVector(dir, -dist);
    const gh = this.terrain.heightAt(cam.x, cam.z) + 0.6;
    if (cam.y < gh) cam.y = gh;
    this.camera.position.copy(cam);
    this.camera.lookAt(pivot);
    void alpha;
  }

  forceExitVehicle() {
    if (!this.driving) return;
    this.driving = false;
    this.player.collider.setEnabled(true);
    this.astro.root.visible = true;
    this.input.clearPressed();
  }

  /** entra/sai do rover (F) */
  toggleVehicle(): 'enter' | 'exit' | 'far' | 'blocked' {
    if (this.driving) {
      const door = this.rover.driverDoor();
      if (Math.abs(this.rover.speed) > 1.2) return 'blocked';
      this.driving = false;
      this.input.clearPressed();
      this.player.collider.setEnabled(true);
      this.player.teleport(door.x, door.z, 0.4);
      this.astro.root.visible = true;
      if (this.rover.lightsOn && this.lampOn === false) { /* mantém faróis ligados */ }
      return 'exit';
    }
    if (this.player.pos.distanceTo(this.rover.pos) > 4.2) return 'far';
    this.driving = true;
    this.camPivotInit = false;
    this.input.clearPressed();
    this.player.collider.setEnabled(false);
    this.astro.root.visible = false;
    this.player.yaw = this.rover.yaw() + Math.PI;
    this.player.pitch = -0.28;
    return 'enter';
  }

  toggleCamera() {
    this.player.firstPerson = !this.player.firstPerson;
    this.astro.setFirstPerson(this.player.firstPerson);
    this.pipeline.visor.strength = this.player.firstPerson ? 1 : 0;
  }

  setInterior(on: boolean) {
    this.inside = on;
    this.interior.setActive(on);
    this.sky.mesh.visible = !on;
    this.dust.points.visible = !on;
    this.devils.group.visible = !on;
    (this.scene as THREE.Scene & { environmentIntensity: number }).environmentIntensity = on ? 0.12 : 1;
    this.updateSky(0);
  }

  setLamp(on: boolean) {
    this.lampOn = on;
    this.astro.setLamp(on);
  }

  private render(dt: number) {
    if (!this.player) return;
    const alpha = this.acc / (1 / 60);
    const feet = this.player.renderPos(Math.min(1, alpha));
    // astronauta
    this.astro.root.position.copy(feet);
    const sp = this.player.horizontalSpeed();
    if (sp > 0.15) {
      const target = Math.atan2(-this.player.vel.x, -this.player.vel.z) + Math.PI;
      let d = target - this.astro.root.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.astro.root.rotation.y += d * Math.min(1, dt * 8);
    }
    if (this.player.firstPerson) this.astro.root.rotation.y = this.player.yaw + Math.PI;
    this.astro.update(this.paused && !this.menuMode ? 0 : dt, sp, this.player.grounded);
    if (this.menuMode) {
      // câmera cinematográfica do menu: órbita lenta ao redor do astronauta com o módulo ao fundo
      this.menuT += dt;
      // enquadramento fixo com leve deriva: astronauta à direita, módulo ao fundo
      const a = -0.35 + Math.sin(this.menuT * 0.05) * 0.18;
      const r = 5.0;
      const lx = feet.x + 3.0, lz = feet.z + 0.5; // alvo deslocado (texto do menu à esquerda)
      this.camera.position.set(feet.x + Math.sin(a) * r + 2.2, 0, feet.z + Math.cos(a) * r + 1.5);
      this.camera.position.y = Math.max(this.terrain.heightAt(this.camera.position.x, this.camera.position.z) + 1.0, feet.y + 1.55);
      this.camera.lookAt((feet.x + lx) / 2 - 1.2, feet.y + 1.35, (feet.z + lz) / 2 - 1.0);
    } else if (this.driving) this.driveCamera(dt, alpha);
    else this.player.updateCamera(this.camera, feet, dt, this.camCollide);
    this.camera.updateMatrixWorld();

    this.updateSky(dt);
    this.probeTimer += dt;
    if (this.probeTimer > 0.5) { this.probeTimer = 0; this.measureSky(); }
    // lanterna do capacete segue o olhar
    {
      const eye = feet.clone(); eye.y += 1.68;
      const dir = new THREE.Vector3(-Math.sin(this.player.yaw) * Math.cos(this.player.pitch), Math.sin(this.player.pitch) - 0.12, -Math.cos(this.player.yaw) * Math.cos(this.player.pitch));
      this.astro.headlamp.position.copy(eye).addScaledVector(dir, 0.25);
      this.astro.headlamp.target.position.copy(eye).addScaledVector(dir, 12);
      this.astro.headlamp.target.updateMatrixWorld();
    }
    this.envTimer += dt;
    if (this.envTimer > 1.5) { this.envTimer = 0; this.updateEnv(); }
    const cp = this.camera.position;
    this.sky.placeMoon(this.sky.phobos, new THREE.Vector3(...this.sky0.phobosDir), cp, 0.2);
    this.sky.placeMoon(this.sky.deimos, new THREE.Vector3(...this.sky0.deimosDir), cp, 0.04);
    if (this.inside) { this.sky.phobos.visible = false; this.sky.deimos.visible = false; }
    this.fxT += dt;
    updateNightFx(this.fxT, this.night);
    this.sky.uniforms.uTime.value = this.fxT;
    this.pipeline.visor.frost = this.player.firstPerson && !this.inside && !this.driving ? this.visorFrost : 0;
    fogUniforms.uFogViewToWorld.value.setFromMatrix4(this.camera.matrixWorld);
    fogUniforms.uFogCamY.value = cp.y;
    this.rover.render(Math.min(1, alpha));
    this.tracks.update(this.rover);
    if (this.inside) {
      // passos no piso metálico do habitat (sem pegadas no terreno)
      if (this.player.grounded && sp > 0.4 && !this.paused) { this.insideStep += dt * sp; if (this.insideStep > 0.75) { this.insideStep = 0; sfx.step(); } }
    } else if (!this.driving && this.footprints.update(feet, this.player.yaw, this.player.grounded, sp) && !this.paused) sfx.step();
    const storm = THREE.MathUtils.smoothstep(this.tau, 1.2, 4);
    this.dust.uniforms.uWind.value.set(2.5 + storm * 16, 0, 1.2 + storm * 6);
    this.dust.uniforms.uBox.value = 26 - storm * 10;
    this.dust.update(this.paused ? 0 : dt, cp, this.sky.uniforms.uSun.value, this.sunColI, this.ambC, 0.6 + this.tau * 0.6 + storm * 3);
    this.devils.update(this.paused ? 0 : dt, cp, this.sky0.ltstHours, this.tau, this.sunColI, this.ambC);
    this.terrain.update(cp, this.q.lodScale, 2);
    this.rocks.update(cp);
    this.csm?.update();
    this.pipeline.render(dt);
  }

  debugState() {
    return {
      pos: this.player.pos.toArray().map((v) => +v.toFixed(2)),
      vel: this.player.vel.toArray().map((v) => +v.toFixed(2)),
      grounded: this.player.grounded,
      ground: +this.terrain.heightAt(this.player.pos.x, this.player.pos.z).toFixed(2),
      sol: +this.sol.toFixed(4),
      ltst: +this.sky0.ltstHours.toFixed(2),
      sunAlt: +THREE.MathUtils.radToDeg(this.sky0.sunAlt).toFixed(1),
      tau: this.tau,
      exposure: +this.exposure.toFixed(3),
      fps: +this.fps.toFixed(1),
      quality: this.q.id,
      tex: this.texTier,
      calls: this.renderer.info.render.calls,
      tris: this.renderer.info.render.triangles,
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures,
    };
  }
}
