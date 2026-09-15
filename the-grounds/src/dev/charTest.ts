/** Cena de verificação do personagem: pose, deformação, roupas e animação. */
import * as THREE from 'three'
import { Engine } from '../core/engine'
import { defaultSettings } from '../core/settings'
import { Character } from '../character/character'
import { defaultAppearance, randomAppearance, type Appearance } from '../character/appearance'
import { ACTION_DURATION, type ActionKind } from '../character/animation'

export async function runCharTest(canvas: HTMLCanvasElement): Promise<void> {
  const settings = defaultSettings()
  settings.graphics.shadows = 'alto'
  settings.graphics.viewDistance = 60
  const engine = new Engine(canvas, settings.graphics)
  engine.renderer.setClearColor(0x2a3138, 1)
  engine.scene.fog = null

  const q = new URLSearchParams(location.search)
  const count = Number(q.get('n') ?? 5)
  const modo = q.get('modo') ?? 'andar'
  const vel = Number(q.get('vel') ?? 3.2)

  // Chão de referência
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({ color: 0x51565c, roughness: 0.95 }),
  )
  floor.rotation.x = -Math.PI / 2
  floor.receiveShadow = true
  engine.scene.add(floor)

  // Grade a cada metro para conferir escala
  const grid = new THREE.GridHelper(60, 60, 0x6a7078, 0x454b52)
  ;(grid.material as THREE.Material).opacity = 0.35
  ;(grid.material as THREE.Material).transparent = true
  engine.scene.add(grid)

  engine.sun.position.set(6, 12, 8)
  engine.sun.target.position.set(0, 1, 0)
  engine.sun.intensity = 2.6
  engine.sun.castShadow = true
  engine.hemi.intensity = 0.85
  engine.scene.add(new THREE.AmbientLight(0xffffff, 0.22))

  const chars: Character[] = []
  for (let i = 0; i < count; i++) {
    const app: Appearance = i === 0 ? defaultAppearance() : randomAppearance(1000 + i * 7919)
    if (q.get('nu') === '1') {
      app.torso = 'semCamisa'; app.pernas = 'shortEsportivo'; app.pes = 'descalco'
      app.chapeu = 'nenhum'; app.oculos = 'nenhum'; app.mochila = 'nenhum'
    }
    if (i === 0) { app.torso = 'uniforme'; app.pes = 'chuteira'; app.pernas = 'shortEsportivo'; app.corTorso = 0xf2c230 }
    const c = new Character(app, { castShadow: true })
    c.setPosition((i - (count - 1) / 2) * 1.3, 0, 0)
    engine.scene.add(c.group)
    chars.push(c)
  }

  const close = q.get('close') === '1'
  if (close) {
    engine.camera.position.set(0.35, 1.62, 1.05)
    engine.camera.lookAt(0, 1.55, 0)
    engine.setFov(34)
  } else {
    engine.camera.position.set(0, 1.5, 4.4)
    engine.camera.lookAt(0, 0.95, 0)
    engine.setFov(42)
  }

  const env = engine.refreshEnvironment(new THREE.Object3D(), 0, true)
  void env

  let t = 0
  let actionT = 0
  const actions: ActionKind[] = ['chute', 'passe', 'comemorar', 'aceno', 'cabeceio', 'interagir']
  let actionIndex = 0
  const clock = new THREE.Clock()
  let frames = 0

  const loop = () => {
    const dt = Math.min(0.05, clock.getDelta())
    t += dt
    for (let i = 0; i < chars.length; i++) {
      const c = chars[i]
      const inp = c.input
      inp.grounded = true
      if (modo === 'parado') { inp.speed = 0 }
      else if (modo === 'acao') {
        inp.speed = 0
        actionT += dt / chars.length
        const kind = actions[(actionIndex + i) % actions.length]
        inp.action = kind
        inp.actionProgress = (t % ACTION_DURATION[kind]) / ACTION_DURATION[kind]
      } else {
        inp.speed = vel
        inp.forwardness = 1
      }
      inp.lookYaw = Math.sin(t * 0.4 + i) * 0.35
      inp.lookPitch = Math.sin(t * 0.3) * 0.12
      c.setYaw(close || q.get('frente') === '1' ? 0 : Math.sin(t * 0.25 + i * 0.7) * 0.9)
      c.update(dt, () => 0)
    }
    if (t > 3) { actionIndex++; }
    engine.render(dt, 0)
    frames++
    ;(window as unknown as { __frames: number }).__frames = frames
    requestAnimationFrame(loop)
  }
  loop()

  if (q.get('wire') === '1') {
    for (const c of chars) {
      c.group.traverse((o) => {
        const m = o as THREE.Mesh
        if (m.isMesh) (m.material as THREE.MeshStandardMaterial).wireframe = true
      })
    }
  }

  ;(window as unknown as Record<string, unknown>).__smoke = {
    stats: () => ({
      personagens: chars.length,
      malhas: chars[0] ? countMeshes(chars[0]) : null,
      altura: chars.map((c) => c.height.toFixed(2)),
      tris: engine.renderer.info.render.triangles,
    }),
  }
}

function countMeshes(c: Character): Record<string, number> {
  const out: Record<string, number> = {}
  c.group.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.isMesh && m.geometry) out[m.name] = m.geometry.attributes.position.count
  })
  return out
}
