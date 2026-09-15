/** Cena de verificação: monta o mundo e permite orbitar para inspeção visual. */
import * as THREE from 'three'
import { Engine } from '../core/engine'
import { defaultSettings } from '../core/settings'
import { MaterialLibrary } from '../world/materials'
import { World } from '../world/world'
import { terrainHeight } from '../world/terrain'
import { CDN_PRIORITY, CdnTextureLoader } from '../assets/cdnTextures'
import type { WorldMaterialKey } from '../world/materials'

export async function runSmoke(canvas: HTMLCanvasElement): Promise<void> {
  const settings = defaultSettings()
  settings.graphics.viewDistance = 700
  const q = new URLSearchParams(location.search)
  if (q.get('ssao') === '0') settings.graphics.ssao = false
  if (q.get('shadows') === '0') settings.graphics.shadows = 'off'
  if (q.get('bloom') === '0') settings.graphics.bloom = false
  if (q.get('aa') === '0') settings.graphics.antialias = 'off'
  const engine = new Engine(canvas, settings.graphics)
  const materials = new MaterialLibrary('medio', engine.maxAnisotropy)
  const cdn = new CdnTextureLoader(engine.maxAnisotropy, settings.graphics.textureQuality)
  const cdnState = { done: 0, total: CDN_PRIORITY.length, failed: 0 }
  const world = new World(materials, settings.graphics)
  engine.scene.add(world.root)

  const params = new URLSearchParams(location.search)
  const px = Number(params.get('x') ?? 40)
  const pz = Number(params.get('z') ?? -120)
  const eye = new THREE.Vector3(px, terrainHeight(px, pz) + Number(params.get('h') ?? 18), pz)
  const yaw = Number(params.get('yaw') ?? 0.7)
  const pitch = Number(params.get('pitch') ?? -0.22)
  world.hour = Number(params.get('hour') ?? 10)
  world.timeFrozen = params.has('hour')
  if (params.has('rain')) {
    world.weather.rain = Number(params.get('rain'))
    world.weather.wetness = Number(params.get('rain'))
  }

  const target = new THREE.Vector3(
    eye.x + Math.sin(yaw) * Math.cos(pitch),
    eye.y + Math.sin(pitch),
    eye.z + Math.cos(yaw) * Math.cos(pitch),
  )
  engine.camera.position.copy(eye)
  engine.camera.lookAt(target)

  // Carrega tudo antes de desenhar (cena de teste, sem orçamento por quadro).
  world.updateStreaming(eye)
  const t0 = performance.now()
  while (world.pendingSectors > 0 && performance.now() - t0 < 20000) {
    world.processBuildQueue(200)
  }
  world.update(0.016, eye, engine.fog, engine.sun, engine.hemi)
  engine.updateSunShadow(eye, world.sky.sunDirection)

  // Texturas fotogramétricas: substituem as procedurais conforme chegam.
  if (params.get('cdn') !== '0') {
    await cdn.loadAll(
      CDN_PRIORITY,
      (key, maps) => materials.applyCdnMaps(key as WorldMaterialKey, maps),
      (p) => { cdnState.done = p.done; cdnState.failed = p.failed },
    )
  }
  const env = engine.refreshEnvironment(world.sky.mesh, 0, true)
  materials.setEnvironment(env)

  let frames = 0
  const clock = new THREE.Clock()
  const loop = () => {
    const dt = Math.min(0.05, clock.getDelta())
    world.update(dt, engine.camera.position, engine.fog, engine.sun, engine.hemi)
    engine.updateSunShadow(engine.camera.position, world.sky.sunDirection)
    const e = engine.refreshEnvironment(world.sky.mesh, dt)
    if (e) materials.setEnvironment(e)
    engine.render(dt, 0)
    frames++
    ;(window as unknown as { __frames: number }).__frames = frames
    requestAnimationFrame(loop)
  }
  loop()

  ;(window as unknown as Record<string, unknown>).__smoke = {
    world, engine,
    stats: () => ({
      setores: world.loadedSectors,
      pendentes: world.pendingSectors,
      colisores: world.collision.count,
      campos: world.pitches.length,
      predios: world.allBuildings.length,
      draws: engine.perf.drawCalls,
      tris: engine.perf.triangles,
      cdn: `${cdnState.done - cdnState.failed}/${cdnState.total}`,
      creditos: cdn.credits.length,
    }),
  }
}
