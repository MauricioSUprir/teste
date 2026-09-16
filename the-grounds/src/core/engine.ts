/**
 * Núcleo de renderização: contexto WebGL, pós-processamento, resolução
 * dinâmica, sombras e medição de desempenho.
 */

import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js'
import { AfterimagePass } from 'three/addons/postprocessing/AfterimagePass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js'
import { clamp } from './math'
import type { GraphicsSettings, ShadowQuality } from './settings'

const SHADOW_MAP_SIZE: Record<ShadowQuality, number> = { off: 0, baixo: 1024, medio: 2048, alto: 4096 }
const SHADOW_RANGE: Record<ShadowQuality, number> = { off: 0, baixo: 60, medio: 110, alto: 170 }

export interface PerfSample {
  fps: number
  frameMs: number
  /** Intervalo real medido entre dois quadros, em ms. */
  realMs: number
  cpuMs: number
  drawCalls: number
  triangles: number
  programs: number
  renderScale: number
  width: number
  height: number
}

export class Engine {
  readonly renderer: THREE.WebGLRenderer
  readonly scene = new THREE.Scene()
  readonly camera: THREE.PerspectiveCamera
  readonly canvas: HTMLCanvasElement
  readonly sun: THREE.DirectionalLight
  readonly hemi: THREE.HemisphereLight
  readonly fog: THREE.Fog

  private composer: EffectComposer | null = null
  private renderPass!: RenderPass
  private bloomPass: UnrealBloomPass | null = null
  gtaoPass: GTAOPass | null = null
  private fxaaPass: ShaderPass | null = null
  afterimagePass: AfterimagePass | null = null
  private settings: GraphicsSettings
  private effectiveScale = 1
  private cssWidth = 1
  private cssHeight = 1
  private frameTimes: number[] = []
  private lastPerf: PerfSample = {
    fps: 0, frameMs: 0, realMs: 0, cpuMs: 0, drawCalls: 0, triangles: 0, programs: 0,
    renderScale: 1, width: 0, height: 0,
  }
  private scaleCooldown = 0
  readonly maxAnisotropy: number

  private pmrem: THREE.PMREMGenerator | null = null
  private envCube: THREE.WebGLCubeRenderTarget | null = null
  private envCamera: THREE.CubeCamera | null = null
  private envTarget: THREE.Texture | null = null
  private envTimer = 0
  /** Relógio do quadro anterior e média do intervalo real entre quadros. */
  private ultimoQuadro = 0
  private msReais = 0

  constructor(canvas: HTMLCanvasElement, settings: GraphicsSettings) {
    this.canvas = canvas
    this.settings = settings

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false, // MSAA é feito pelo composer/FXAA; evita custo duplo
      powerPreference: 'high-performance',
      stencil: false,
      alpha: false,
    })
    this.renderer.setClearColor(0x87a6c8, 1)
    // Com pós-processamento cada passe chamaria render() e zeraria os
    // contadores; acumulamos manualmente para medir a cena inteira.
    this.renderer.info.autoReset = false
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.shadowMap.enabled = settings.shadows !== 'off'
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy()

    this.camera = new THREE.PerspectiveCamera(60, 1, 0.12, settings.viewDistance * 1.6)

    this.fog = new THREE.Fog(0x9fb6cc, settings.viewDistance * 0.35, settings.viewDistance)
    this.scene.fog = this.fog

    this.hemi = new THREE.HemisphereLight(0x9fc0ea, 0x4a4438, 0.9)
    this.scene.add(this.hemi)

    this.sun = new THREE.DirectionalLight(0xfff1de, 2.6)
    this.sun.castShadow = settings.shadows !== 'off'
    this.configureShadow(settings.shadows)
    this.scene.add(this.sun)
    this.scene.add(this.sun.target)

    this.buildComposer()
    this.setupEnvironment()
    this.resize()
  }

  /**
   * Ambiente para reflexos: um cubo de baixa resolução do próprio céu é
   * refiltrado por PMREM. Assim vidro, metal e asfalto molhado refletem a
   * atmosfera correta em cada horário, sem depender de arquivo externo.
   */
  private setupEnvironment(): void {
    this.pmrem = new THREE.PMREMGenerator(this.renderer)
    this.pmrem.compileCubemapShader()
    this.envCube = new THREE.WebGLCubeRenderTarget(128, {
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
    })
    this.envCamera = new THREE.CubeCamera(1, 4000, this.envCube)
  }

  /**
   * Reamostra o ambiente. `skyOnly` recebe apenas a cúpula do céu para evitar
   * capturar a geometria da cidade (que geraria reflexos incorretos e custo).
   */
  refreshEnvironment(skyMesh: THREE.Object3D, dt: number, force = false): THREE.Texture | null {
    if (!this.pmrem || !this.envCamera || !this.envCube) return this.envTarget
    this.envTimer -= dt
    if (!force && this.envTimer > 0) return this.envTarget

    this.envTimer = 2.0
    const prevParent = skyMesh.parent
    const tmp = new THREE.Scene()
    tmp.add(skyMesh)
    this.envCamera.update(this.renderer, tmp)
    if (prevParent) prevParent.add(skyMesh)

    const prev = this.envTarget
    this.envTarget = this.pmrem.fromCubemap(this.envCube.texture).texture
    prev?.dispose()
    this.scene.environment = this.envTarget
    this.scene.environmentIntensity = 1.0
    return this.envTarget
  }

  private configureShadow(q: ShadowQuality): void {
    const size = SHADOW_MAP_SIZE[q]
    const range = SHADOW_RANGE[q]
    this.sun.castShadow = q !== 'off'
    if (q === 'off') return
    this.sun.shadow.mapSize.set(size, size)
    const cam = this.sun.shadow.camera
    cam.left = -range
    cam.right = range
    cam.top = range
    cam.bottom = -range
    cam.near = 1
    cam.far = range * 4.2
    cam.updateProjectionMatrix()
    // O viés normal precisa acompanhar o tamanho do texel em metros, senão
    // superfícies planas amplas (telhados, ruas) se auto-sombreiam.
    const texelWorld = (range * 2) / size
    this.sun.shadow.bias = -0.00008
    this.sun.shadow.normalBias = Math.max(0.06, texelWorld * 1.6)
    this.sun.shadow.radius = q === 'alto' ? 3.0 : 2.0
  }

  /** Reposiciona a luz solar para acompanhar a câmera, mantendo sombras nítidas. */
  updateSunShadow(focus: THREE.Vector3, sunDir: THREE.Vector3): void {
    const q = this.settings.shadows
    if (q === 'off') {
      // Sem mapa de sombra a luz ainda precisa de direção correta.
      this.sun.target.position.copy(focus)
      this.sun.position.copy(focus).addScaledVector(sunDir, 180)
      this.sun.target.updateMatrixWorld()
      this.sun.updateMatrixWorld()
      return
    }
    const range = SHADOW_RANGE[q]
    // Trava o alvo em passos de texel para eliminar cintilação da sombra.
    const texelWorld = (range * 2) / SHADOW_MAP_SIZE[q]
    const fx = Math.round(focus.x / texelWorld) * texelWorld
    const fz = Math.round(focus.z / texelWorld) * texelWorld
    this.sun.target.position.set(fx, focus.y, fz)
    this.sun.position.copy(this.sun.target.position).addScaledVector(sunDir, range * 2.2)
    this.sun.target.updateMatrixWorld()
    this.sun.updateMatrixWorld()
  }

  private buildComposer(): void {
    this.composer?.dispose()
    const s = this.settings
    const needsComposer = s.ssao || s.bloom || s.antialias !== 'off' || s.motionBlur
    if (!needsComposer) { this.composer = null; return }

    const composer = new EffectComposer(this.renderer)
    composer.setPixelRatio(1)
    this.renderPass = new RenderPass(this.scene, this.camera)
    composer.addPass(this.renderPass)

    if (s.ssao) {
      const gtao = new GTAOPass(this.scene, this.camera, 1, 1)
      gtao.output = GTAOPass.OUTPUT.Default
      gtao.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1.2, thickness: 1.0, scale: 1.0, samples: 12 })
      gtao.blendIntensity = 0.85
      composer.addPass(gtao)
      this.gtaoPass = gtao
    } else this.gtaoPass = null

    if (s.motionBlur) {
      const ai = new AfterimagePass(0.62)
      composer.addPass(ai)
      this.afterimagePass = ai
    } else this.afterimagePass = null

    if (s.bloom) {
      const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.34, 0.72, 0.92)
      composer.addPass(bloom)
      this.bloomPass = bloom
    } else this.bloomPass = null

    composer.addPass(new OutputPass())

    if (s.antialias !== 'off') {
      const fxaa = new ShaderPass(FXAAShader)
      composer.addPass(fxaa)
      this.fxaaPass = fxaa
    } else this.fxaaPass = null

    this.composer = composer
  }

  applySettings(s: GraphicsSettings): void {
    const rebuild =
      s.ssao !== this.settings.ssao ||
      s.bloom !== this.settings.bloom ||
      s.antialias !== this.settings.antialias ||
      s.motionBlur !== this.settings.motionBlur
    const shadowChanged = s.shadows !== this.settings.shadows
    this.settings = s

    this.renderer.shadowMap.enabled = s.shadows !== 'off'
    if (shadowChanged) {
      this.configureShadow(s.shadows)
      this.renderer.shadowMap.needsUpdate = true
    }
    this.camera.far = s.viewDistance * 1.6
    this.camera.updateProjectionMatrix()
    this.fog.near = s.viewDistance * 0.35
    this.fog.far = s.viewDistance

    if (rebuild) this.buildComposer()
    this.effectiveScale = s.renderScale
    this.resize()
  }

  setFov(fov: number): void {
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = fov
      this.camera.updateProjectionMatrix()
    }
  }

  /** Largura/altura CSS do canvas, respeitando o limite de saída configurado. */
  resize(): void {
    const parent = this.canvas.parentElement
    const w = parent?.clientWidth || window.innerWidth
    const h = parent?.clientHeight || window.innerHeight
    this.cssWidth = Math.max(1, w)
    this.cssHeight = Math.max(1, h)

    const dpr = window.devicePixelRatio || 1
    // Resolução de saída (backbuffer) = CSS * DPR, limitada pelo teto do usuário.
    let outW = this.cssWidth * dpr
    const cap = this.settings.outputWidthCap
    let ratio = dpr
    if (cap > 0 && outW > cap) ratio = cap / this.cssWidth
    // Nunca ultrapassa 3840 de largura de backbuffer (teto de 4K).
    if (this.cssWidth * ratio > 3840) ratio = 3840 / this.cssWidth

    const scale = clamp(this.effectiveScale, 0.4, 2)
    this.renderer.setPixelRatio(ratio * scale)
    this.renderer.setSize(this.cssWidth, this.cssHeight, true)

    const bw = Math.round(this.cssWidth * ratio * scale)
    const bh = Math.round(this.cssHeight * ratio * scale)
    this.composer?.setSize(this.cssWidth, this.cssHeight)
    this.composer?.setPixelRatio(ratio * scale)
    this.fxaaPass?.material.uniforms['resolution'].value.set(1 / bw, 1 / bh)
    this.bloomPass?.setSize(bw, bh)

    this.camera.aspect = this.cssWidth / this.cssHeight
    this.camera.updateProjectionMatrix()

    this.lastPerf.width = bw
    this.lastPerf.height = bh
    this.lastPerf.renderScale = scale
  }

  /** Resolução dinâmica: ajusta a escala para manter o alvo de fps. */
  private updateDynamicResolution(frameMs: number, dt: number): void {
    if (!this.settings.dynamicResolution) {
      if (this.effectiveScale !== this.settings.renderScale) {
        this.effectiveScale = this.settings.renderScale
        this.resize()
      }
      return
    }
    this.scaleCooldown -= dt
    if (this.scaleCooldown > 0) return
    const target = 1000 / this.settings.targetFps
    const base = this.settings.renderScale
    const min = base * 0.6
    let next = this.effectiveScale
    if (frameMs > target * 1.30) next = Math.max(min, this.effectiveScale - 0.08)
    else if (frameMs < target * 0.80) next = Math.min(base, this.effectiveScale + 0.05)
    if (Math.abs(next - this.effectiveScale) > 0.005) {
      this.effectiveScale = next
      this.resize()
      this.scaleCooldown = 0.6
    } else {
      this.scaleCooldown = 0.25
    }
  }

  render(dt: number, cpuMs: number): void {
    this.renderer.info.reset()
    const t0 = performance.now()
    // `dt` chega limitado pelo laço (para a física não explodir após uma
    // pausa), então medir fps a partir dele satura o número. O relógio real
    // entre dois quadros é a única leitura honesta.
    if (this.ultimoQuadro > 0) {
      const real = t0 - this.ultimoQuadro
      if (real > 0.5) this.msReais = this.msReais > 0 ? this.msReais * 0.85 + real * 0.15 : real
    }
    this.ultimoQuadro = t0
    if (this.composer) this.composer.render(dt)
    else this.renderer.render(this.scene, this.camera)
    const gpuIssueMs = performance.now() - t0

    const total = cpuMs + gpuIssueMs
    // Descarta o primeiro quadro (compilação de shaders) da média.
    if (this.frameTimes.length === 0 && total > 200) return
    this.frameTimes.push(total)
    if (this.frameTimes.length > 60) this.frameTimes.shift()
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length

    const info = this.renderer.info
    this.lastPerf.frameMs = avg
    this.lastPerf.cpuMs = cpuMs
    this.lastPerf.fps = this.msReais > 0 ? 1000 / this.msReais : 0
    this.lastPerf.realMs = this.msReais
    this.lastPerf.drawCalls = info.render.calls
    this.lastPerf.triangles = info.render.triangles
    this.lastPerf.programs = info.programs?.length ?? 0

    this.updateDynamicResolution(dt * 1000, dt)
  }

  get perf(): PerfSample { return this.lastPerf }
  get outputWidth(): number { return this.lastPerf.width }
  get outputHeight(): number { return this.lastPerf.height }

  dispose(): void {
    this.composer?.dispose()
    this.pmrem?.dispose()
    this.envCube?.dispose()
    this.envTarget?.dispose()
    this.renderer.dispose()
  }
}
