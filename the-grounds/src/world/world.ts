/**
 * Mundo: orquestra relevo, setores urbanos, água, clima, ciclo dia/noite e
 * iluminação, com carregamento progressivo por proximidade e nível de detalhe.
 */

import * as THREE from 'three'
import { clamp, damp, lerp, makeRng, smoothstep } from '../core/math'
import type { GraphicsSettings } from '../core/settings'
import { Sky } from '../core/sky'
import { CollisionWorld } from './collision'
import { GeometryBatcher, disposeObject, type NivelDetalhe } from './geometry'
import { CityLayout, districtAt, type Block } from './layout'
import { MaterialLibrary, type WorldMaterialKey } from './materials'
import { buildBlockContent, planPitchForBlock, type PitchSpec } from './blocks'
import { buildBuilding, buildBuildingLod, planBlockBuildings, type BuildingSpec } from './buildings'
import { buildRoadsForSector } from './roads'
import type { PropContext } from './props'
import type { TrafficLightHandle } from './props'
import { buildTerrainChunk, MAP_HALF, terrainHeight, terrainNormal, WATER_LEVEL } from './terrain'
import { sampleRiverCenterline, Water } from './water'

export const SECTOR_SIZE = 128

interface Sector {
  key: string
  sx: number; sz: number
  detail: NivelDetalhe
  group: THREE.Group
  lamps: { x: number; y: number; z: number }[]
  trafficLights: TrafficLightHandle[]
  buildings: BuildingSpec[]
}

export interface WeatherState {
  /** 0 = seco, 1 = chuva forte. */
  rain: number
  cloudCover: number
  windSpeed: number
  /** Molhado do chão, com inércia (seca devagar). */
  wetness: number
}

export class World {
  readonly root = new THREE.Group()
  readonly layout: CityLayout
  readonly collision = new CollisionWorld()
  readonly materials: MaterialLibrary
  readonly sky = new Sky()
  readonly water: Water
  readonly pitches: PitchSpec[] = []
  readonly allBuildings: BuildingSpec[] = []

  /** Hora do dia em horas decimais (0-24). */
  hour = 9.5
  /** Segundos reais por hora do jogo. */
  hourDuration = 110
  timeFrozen = false
  readonly weather: WeatherState = { rain: 0, cloudCover: 0.32, windSpeed: 0.4, wetness: 0 }
  private weatherTimer = 140
  private weatherTarget = 0

  private sectors = new Map<string, Sector>()
  private terrainChunks = new Map<string, { mesh: THREE.Mesh; lod: number }>()
  private buildQueue: { sx: number; sz: number; detail: NivelDetalhe; priority: number }[] = []
  /** Setor sendo construído em etapas, entre quadros. */
  private emConstrucao: Generator<void, void, void> | null = null
  private terrainGroup = new THREE.Group()
  private sectorGroup = new THREE.Group()
  private settings: GraphicsSettings
  private lampPool: THREE.PointLight[] = []
  private elapsed = 0
  private lightPhase = 0
  private trafficPhaseTimer = 0
  /** 0 = eixo X verde, 1 = eixo Z verde, 2/3 = amarelo de transição. */
  trafficPhase: 0 | 1 = 0
  trafficAmber = false
  private blockSpecCache = new Map<number, BuildingSpec[]>()
  private nextBuildingId = 1
  readonly rainSystem: RainSystem

  constructor(materials: MaterialLibrary, settings: GraphicsSettings, seed?: number) {
    this.materials = materials
    this.settings = settings
    this.layout = new CityLayout(seed)
    this.root.add(this.sky.mesh)
    this.root.add(this.terrainGroup)
    this.root.add(this.sectorGroup)

    this.water = new Water(sampleRiverCenterline(), 30)
    this.root.add(this.water.mesh)

    // Índice global de campos e edifícios (barato: sem geometria).
    for (const block of this.layout.blocks) {
      const p = planPitchForBlock(block)
      if (p) this.pitches.push(p)
    }

    this.rainSystem = new RainSystem()
    this.root.add(this.rainSystem.points)

    // Luzes pontuais reutilizáveis para a noite
    for (let i = 0; i < 12; i++) {
      const l = new THREE.PointLight(0xffd9a0, 0, 26, 2)
      l.visible = false
      this.lampPool.push(l)
      this.root.add(l)
    }
  }

  applySettings(s: GraphicsSettings): void {
    this.settings = s
  }

  /** Fichas de edifícios de uma quadra (memorizadas). */
  buildingsOfBlock(block: Block): BuildingSpec[] {
    const hit = this.blockSpecCache.get(block.id)
    if (hit) return hit
    const specs = planBlockBuildings(block, this.nextBuildingId)
    this.nextBuildingId += specs.length + 1
    this.blockSpecCache.set(block.id, specs)
    this.allBuildings.push(...specs)
    return specs
  }

  // ------------------------------------------------------------------------
  // Consultas de superfície
  // ------------------------------------------------------------------------

  /**
   * Altura pisável considerando pontes, calçadas e lajes.
   * `fromY` limita a busca: superfícies muito acima desse valor são ignoradas,
   * o que evita colocar o jogador em cima de um prédio ao procurar o chão.
   */
  surfaceHeight(x: number, z: number, fromY = 1e4): number {
    const t = terrainHeight(x, z)
    const s = this.collision.supportHeight(x, z, fromY)
    if (s !== null && s > t && s <= fromY + 0.6) return s
    return t
  }

  groundHeight(x: number, z: number): number { return terrainHeight(x, z) }
  groundNormal(x: number, z: number, out?: THREE.Vector3): THREE.Vector3 { return terrainNormal(x, z, out) }

  /** Nome do bairro em um ponto. */
  districtName(x: number, z: number): string { return districtAt(x, z) }

  /** Campo de futebol mais próximo. */
  nearestPitch(x: number, z: number): { pitch: PitchSpec; dist: number } | null {
    let best: { pitch: PitchSpec; dist: number } | null = null
    for (const p of this.pitches) {
      const d = Math.hypot(p.x - x, p.z - z)
      if (!best || d < best.dist) best = { pitch: p, dist: d }
    }
    return best
  }

  /** Edifícios carregados num raio (para interiores e IA). */
  buildingsNear(x: number, z: number, radius: number): BuildingSpec[] {
    const out: BuildingSpec[] = []
    for (const block of this.layout.blocksNear(x, z, radius + 60)) {
      for (const b of this.buildingsOfBlock(block)) {
        if (Math.hypot(b.x - x, b.z - z) <= radius) out.push(b)
      }
    }
    return out
  }

  // ------------------------------------------------------------------------
  // Streaming
  // ------------------------------------------------------------------------

  private sectorKey(sx: number, sz: number): string { return `${sx},${sz}` }

  /** Garante que os setores próximos existam; enfileira os que faltam. */
  updateStreaming(center: THREE.Vector3): void {
    const csx = Math.floor(center.x / SECTOR_SIZE)
    const csz = Math.floor(center.z / SECTOR_SIZE)
    // Anel colado no jogador em detalhe máximo; um anel intermediário mantém
    // o relevo das fachadas sem os miúdos; o resto é só volume.
    const highR = 1
    const medioR = 2
    const lowR = Math.max(medioR + 1, Math.ceil(this.settings.viewDistance / SECTOR_SIZE))
    const maxR = Math.min(lowR, Math.ceil((MAP_HALF * 2) / SECTOR_SIZE))

    const wanted = new Set<string>()
    for (let i = -maxR; i <= maxR; i++) {
      for (let j = -maxR; j <= maxR; j++) {
        const sx = csx + i, sz = csz + j
        if (Math.abs(sx * SECTOR_SIZE) > MAP_HALF + SECTOR_SIZE) continue
        if (Math.abs(sz * SECTOR_SIZE) > MAP_HALF + SECTOR_SIZE) continue
        const dist = Math.hypot(i, j)
        if (dist > maxR) continue
        const detail: NivelDetalhe = dist <= highR ? 'alto' : dist <= medioR ? 'medio' : 'baixo'
        const key = this.sectorKey(sx, sz)
        wanted.add(key)
        const existing = this.sectors.get(key)
        if (existing && existing.detail === detail) continue
        if (existing && existing.detail !== detail) this.unloadSector(key)
        if (!this.buildQueue.some((q) => q.sx === sx && q.sz === sz && q.detail === detail)) {
          this.buildQueue.push({ sx, sz, detail, priority: dist })
        }
      }
    }

    for (const key of [...this.sectors.keys()]) {
      if (!wanted.has(key)) this.unloadSector(key)
    }
    this.buildQueue = this.buildQueue.filter((q) => wanted.has(this.sectorKey(q.sx, q.sz)))
    this.buildQueue.sort((a, b) => a.priority - b.priority)

    this.updateTerrain(csx, csz, maxR)
  }

  /** Constrói setores pendentes dentro de um orçamento de tempo (ms). */
  processBuildQueue(budgetMs: number): number {
    const t0 = performance.now()
    let built = 0
    while (performance.now() - t0 < budgetMs) {
      if (!this.emConstrucao) {
        const job = this.buildQueue.shift()
        if (!job) break
        const key = this.sectorKey(job.sx, job.sz)
        if (this.sectors.has(key)) continue
        this.emConstrucao = this.construirSetor(job.sx, job.sz, job.detail)
      }
      // Uma etapa por volta: a checagem de tempo acontece entre etapas, então
      // o pior caso do quadro é o custo de uma etapa, não o do setor inteiro.
      if (this.emConstrucao.next().done) {
        this.emConstrucao = null
        built++
      }
    }
    return built
  }

  get pendingSectors(): number { return this.buildQueue.length + (this.emConstrucao ? 1 : 0) }

  /**
   * Setores ainda na fila dentro de `anel` anéis do jogador.
   *
   * É o que precisa estar pronto antes de entrar no jogo. Esperar a fila
   * inteira significa levantar a cidade até o horizonte com o jogador olhando
   * para uma tela de carregamento — e o que está longe pode perfeitamente
   * chegar depois, enquanto ele já anda.
   */
  pendingNearSectors(anel = 2.1): number {
    let n = this.emConstrucao ? 1 : 0
    for (const q of this.buildQueue) if (q.priority <= anel) n++
    return n
  }
  get loadedSectors(): number { return this.sectors.size }

  /**
   * Constrói um setor em etapas. Um setor do centro leva mais de cem
   * milissegundos de uma vez só, o que aparece como um tranco na imagem; aqui
   * o trabalho é cortado em pedaços e o laço decide quantos cabem no quadro.
   */
  private *construirSetor(sx: number, sz: number, detail: NivelDetalhe): Generator<void, void, void> {
    const key = this.sectorKey(sx, sz)
    const x0 = sx * SECTOR_SIZE
    const z0 = sz * SECTOR_SIZE
    const x1 = x0 + SECTOR_SIZE
    const z1 = z0 + SECTOR_SIZE

    const batcher = new GeometryBatcher()
    const group = new THREE.Group()
    group.name = `setor-${key}`
    const lamps: { x: number; y: number; z: number }[] = []
    const propCtx: PropContext = { batcher, collision: this.collision, owner: key, lamps }
    const buildings: BuildingSpec[] = []
    const pitchesOut: PitchSpec[] = []

    const roads = buildRoadsForSector(this.layout, { x0, z0, x1, z1 }, batcher, this.collision, key, propCtx, detail)
    yield

    for (const block of this.layout.blocksInRect(x0, z0, x1, z1)) {
      if (block.kind === 'edificado') {
        for (const spec of this.buildingsOfBlock(block)) {
          if (detail === 'baixo') buildBuildingLod(spec, batcher)
          else buildBuilding(spec, batcher, this.collision, key, detail)
          buildings.push(spec)
          yield
        }
      } else {
        buildBlockContent(block, batcher, this.collision, key, propCtx, detail, pitchesOut)
        yield
      }
    }

    const meshes = batcher.build((k) => this.materials.get(k as WorldMaterialKey))
    for (const m of meshes) {
      // Superfícies rasas já vêm marcadas para não projetar sombra; setores de
      // baixo detalhe não projetam nada.
      // Só o anel colado no jogador projeta sombra. Deixar o anel médio
      // projetar dobra a geometria do mapa de sombras — foi o que pesou
      // quando as fachadas ganharam moldura, peitoril e verga.
      m.castShadow = m.castShadow && detail === 'alto'
      m.receiveShadow = true
      group.add(m)
    }
    this.sectorGroup.add(group)
    this.sectors.set(key, { key, sx, sz, detail, group, lamps, trafficLights: roads.trafficLights, buildings })
  }

  private unloadSector(key: string): void {
    const s = this.sectors.get(key)
    if (!s) return
    this.sectorGroup.remove(s.group)
    disposeObject(s.group)
    this.collision.removeOwner(key)
    this.sectors.delete(key)
  }

  private updateTerrain(csx: number, csz: number, maxR: number): void {
    const wanted = new Set<string>()
    for (let i = -maxR; i <= maxR; i++) {
      for (let j = -maxR; j <= maxR; j++) {
        const sx = csx + i, sz = csz + j
        const dist = Math.hypot(i, j)
        if (dist > maxR) continue
        if (Math.abs(sx * SECTOR_SIZE) > MAP_HALF + SECTOR_SIZE * 2) continue
        if (Math.abs(sz * SECTOR_SIZE) > MAP_HALF + SECTOR_SIZE * 2) continue
        const lod = dist <= 1.5 ? 4 : dist <= 3.5 ? 8 : dist <= 7 ? 16 : 32
        const key = `${sx},${sz}`
        wanted.add(key)
        const existing = this.terrainChunks.get(key)
        if (existing && existing.lod === lod) continue
        if (existing) {
          this.terrainGroup.remove(existing.mesh)
          existing.mesh.geometry.dispose()
        }
        const cx = sx * SECTOR_SIZE + SECTOR_SIZE / 2
        const cz = sz * SECTOR_SIZE + SECTOR_SIZE / 2
        const geo = buildTerrainChunk(cx, cz, SECTOR_SIZE + 0.4, lod)
        const mesh = new THREE.Mesh(geo, this.terrainMaterial())
        mesh.position.set(0, 0, 0)
        mesh.receiveShadow = true
        mesh.castShadow = false
        mesh.name = `terreno-${key}`
        this.terrainGroup.add(mesh)
        this.terrainChunks.set(key, { mesh, lod })
      }
    }
    for (const [key, chunk] of [...this.terrainChunks]) {
      if (wanted.has(key)) continue
      this.terrainGroup.remove(chunk.mesh)
      chunk.mesh.geometry.dispose()
      this.terrainChunks.delete(key)
    }
  }

  private _terrainMat: THREE.Material | null = null
  private terrainMaterial(): THREE.Material {
    if (!this._terrainMat) {
      const base = this.materials.get('grama') as THREE.MeshStandardMaterial
      const m = base.clone()
      m.vertexColors = true
      // A UV do relevo já vem em escala de mundo: a textura repete sozinha.
      for (const key of ['map', 'normalMap', 'roughnessMap'] as const) {
        const t = m[key]
        if (t) {
          const c = t.clone()
          c.wrapS = c.wrapT = THREE.RepeatWrapping
          c.repeat.set(1, 1)
          c.needsUpdate = true
          m[key] = c
        }
      }
      m.needsUpdate = true
      this._terrainMat = m
    }
    return this._terrainMat
  }

  // ------------------------------------------------------------------------
  // Tempo, clima e luz
  // ------------------------------------------------------------------------

  update(dt: number, center: THREE.Vector3, fog: THREE.Fog, sun: THREE.DirectionalLight, hemi: THREE.HemisphereLight): void {
    this.elapsed += dt
    if (!this.timeFrozen) {
      this.hour = (this.hour + dt / this.hourDuration) % 24
    }
    this.updateWeather(dt)

    this.sky.update(
      { hour: this.hour, cloudCover: this.weather.cloudCover, haze: 0.18 + this.weather.rain * 0.35, windSpeed: this.weather.windSpeed },
      this.elapsed,
    )

    const day = this.sky.daylight
    const rainDim = 1 - this.weather.rain * 0.55

    sun.color.copy(this.sky.sunColor)
    sun.intensity = lerp(0.04, 3.1, day) * rainDim
    hemi.color.copy(this.sky.ambientTop)
    hemi.groundColor.copy(this.sky.ambientBottom)
    hemi.intensity = lerp(0.22, 0.95, day) * lerp(1, 1.25, this.weather.cloudCover)

    fog.color.copy(this.sky.fogColor)
    const vd = this.settings.viewDistance
    fog.near = lerp(vd * 0.35, vd * 0.06, this.weather.rain)
    fog.far = lerp(vd, vd * 0.48, this.weather.rain)

    // Luzes artificiais acendem no crepúsculo
    const nightFactor = 1 - smoothstep(0.06, 0.34, day)
    this.lightPhase = damp(this.lightPhase, nightFactor, 1.2, dt)
    this.materials.setNightLights(this.lightPhase * 2.4 + 0.04)
    this.updateLampLights(center)

    this.water.update(
      this.elapsed, this.sky.sunDirection, this.sky.sunColor,
      this.sky.ambientTop, this.sky.fogColor, day, this.weather.rain, fog,
    )
    this.rainSystem.update(dt, center, this.weather.rain, this.weather.windSpeed)
    this.updateTrafficPhase(dt)
  }

  private updateTrafficPhase(dt: number): void {
    this.trafficPhaseTimer += dt
    const green = 14
    const amber = 3
    const cycle = (green + amber) * 2
    const t = this.trafficPhaseTimer % cycle
    if (t < green) { this.trafficPhase = 0; this.trafficAmber = false }
    else if (t < green + amber) { this.trafficPhase = 0; this.trafficAmber = true }
    else if (t < green * 2 + amber) { this.trafficPhase = 1; this.trafficAmber = false }
    else { this.trafficPhase = 1; this.trafficAmber = true }
  }

  private updateWeather(dt: number): void {
    this.weatherTimer -= dt
    if (this.weatherTimer <= 0) {
      const rng = makeRng(Math.floor(this.elapsed * 13.7) ^ 0x7f3a)
      const r = rng()
      this.weatherTarget = r < 0.58 ? 0 : r < 0.84 ? 0.35 : 1
      this.weatherTimer = 90 + rng() * 160
    }
    this.weather.rain = damp(this.weather.rain, this.weatherTarget, 0.10, dt)
    const targetCloud = clamp(0.2 + this.weatherTarget * 0.7, 0, 1)
    this.weather.cloudCover = damp(this.weather.cloudCover, targetCloud, 0.09, dt)
    this.weather.windSpeed = damp(this.weather.windSpeed, 0.25 + this.weatherTarget * 0.9, 0.12, dt)
    // Chão molhado sobe rápido com chuva e seca devagar
    const wetTarget = this.weather.rain > 0.15 ? 1 : 0
    this.weather.wetness = damp(this.weather.wetness, wetTarget, wetTarget > 0 ? 0.25 : 0.035, dt)
    this.applyWetness()
  }

  private lastWetApplied = -1
  private applyWetness(): void {
    const w = this.weather.wetness
    if (Math.abs(w - this.lastWetApplied) < 0.02) return
    this.lastWetApplied = w
    for (const key of ['asfalto', 'calcada', 'concreto', 'paralelepipedo', 'meioFio'] as WorldMaterialKey[]) {
      const m = this.materials.get(key) as THREE.MeshStandardMaterial
      m.roughness = lerp(1.0, 0.22, w)
      m.metalness = lerp(0.0, 0.12, w)
      m.envMapIntensity = lerp(0.6, 1.6, w)
      m.needsUpdate = true
    }
  }

  private updateLampLights(center: THREE.Vector3): void {
    if (this.lightPhase < 0.05) {
      for (const l of this.lampPool) l.visible = false
      return
    }
    const candidates: { x: number; y: number; z: number; d: number }[] = []
    for (const s of this.sectors.values()) {
      if (s.detail !== 'alto') continue
      for (const l of s.lamps) {
        const d = (l.x - center.x) ** 2 + (l.z - center.z) ** 2
        if (d < 60 * 60) candidates.push({ ...l, d })
      }
    }
    candidates.sort((a, b) => a.d - b.d)
    for (let i = 0; i < this.lampPool.length; i++) {
      const l = this.lampPool[i]
      const c = candidates[i]
      if (!c) { l.visible = false; continue }
      l.visible = true
      l.position.set(c.x, c.y, c.z)
      l.intensity = this.lightPhase * 22
      l.distance = 24
    }
  }

  /** Semáforos visíveis para a IA de trânsito. */
  trafficLightsNear(x: number, z: number, radius: number): TrafficLightHandle[] {
    const out: TrafficLightHandle[] = []
    for (const s of this.sectors.values()) {
      for (const t of s.trafficLights) {
        if (Math.hypot(t.x - x, t.z - z) <= radius) out.push(t)
      }
    }
    return out
  }

  /** Posição segura para reposicionar jogador/veículo preso. */
  findSafeSpot(x: number, z: number): THREE.Vector3 {
    for (let r = 0; r < 60; r += 4) {
      for (let a = 0; a < 8; a++) {
        const ang = (a / 8) * Math.PI * 2
        const px = x + Math.cos(ang) * r
        const pz = z + Math.sin(ang) * r
        if (Math.abs(px) > MAP_HALF || Math.abs(pz) > MAP_HALF) continue
        const h = terrainHeight(px, pz)
        if (h < WATER_LEVEL + 0.4) continue
        const hits = this.collision.query(px, pz, 1.2).filter((c) => c.solid && c.y + c.hy > h + 0.3)
        if (hits.length === 0) return new THREE.Vector3(px, h, pz)
      }
    }
    return new THREE.Vector3(x, terrainHeight(x, z), z)
  }

  dispose(): void {
    for (const key of [...this.sectors.keys()]) this.unloadSector(key)
    for (const c of this.terrainChunks.values()) c.mesh.geometry.dispose()
    this.terrainChunks.clear()
    this.water.dispose()
    this.sky.dispose()
    this.rainSystem.dispose()
  }
}

// --------------------------------------------------------------------------
// Chuva
// --------------------------------------------------------------------------

class RainSystem {
  readonly points: THREE.Points
  private material: THREE.ShaderMaterial
  private count = 2600
  private radius = 22

  constructor() {
    const geo = new THREE.BufferGeometry()
    const pos = new Float32Array(this.count * 3)
    const speed = new Float32Array(this.count)
    for (let i = 0; i < this.count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * this.radius * 2
      pos[i * 3 + 1] = Math.random() * 18
      pos[i * 3 + 2] = (Math.random() - 0.5) * this.radius * 2
      speed[i] = 14 + Math.random() * 12
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1))

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0 },
        uOrigin: { value: new THREE.Vector3() },
        uWind: { value: new THREE.Vector2() },
      },
      vertexShader: /* glsl */ `
        attribute float aSpeed;
        uniform float uTime;
        uniform vec3 uOrigin;
        uniform vec2 uWind;
        varying float vFade;
        void main() {
          vec3 p = position;
          float fall = mod(p.y - uTime * aSpeed, 18.0);
          vec3 world = vec3(p.x + uOrigin.x + uWind.x * fall * 0.06,
                            fall + uOrigin.y - 2.0,
                            p.z + uOrigin.z + uWind.y * fall * 0.06);
          vFade = clamp(fall / 18.0, 0.0, 1.0);
          vec4 mv = viewMatrix * vec4(world, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = max(1.5, 90.0 / -mv.z);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uOpacity;
        varying float vFade;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float a = smoothstep(0.5, 0.0, length(vec2(c.x * 3.0, c.y)));
          gl_FragColor = vec4(0.72, 0.78, 0.86, a * uOpacity * (0.25 + vFade * 0.75));
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    })

    this.points = new THREE.Points(geo, this.material)
    this.points.frustumCulled = false
    this.points.visible = false
    this.points.renderOrder = 5
  }

  update(dt: number, center: THREE.Vector3, rain: number, wind: number): void {
    this.material.uniforms.uTime.value += dt
    this.material.uniforms.uOpacity.value = rain
    ;(this.material.uniforms.uOrigin.value as THREE.Vector3).copy(center)
    ;(this.material.uniforms.uWind.value as THREE.Vector2).set(wind * 3, wind * 1.2)
    this.points.visible = rain > 0.02
  }

  dispose(): void {
    this.points.geometry.dispose()
    this.material.dispose()
  }
}
