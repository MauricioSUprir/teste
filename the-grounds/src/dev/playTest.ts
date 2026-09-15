/** Cena de teste jogável: mundo + personagem + controle + câmera. */
import { Game } from '../game/game'
import { defaultAppearance, randomAppearance } from '../character/appearance'

export async function runPlayTest(canvas: HTMLCanvasElement): Promise<void> {
  const q = new URLSearchParams(location.search)
  const app = q.get('aleatorio') === '1' ? randomAppearance(Date.now() & 0xffff) : defaultAppearance()
  app.torso = 'camiseta'
  app.corTorso = 0xf2c230
  app.pernas = 'bermuda'
  app.pes = 'tenis'

  const game = new Game(canvas, app)
  if (q.get('ik') === '0') game.player.character.ikAtivo = false
  // Diagnóstico: suspende o personagem no ar, isolando oclusão do cenário.
  const voar = Number(q.get('voar') ?? 0)
  if (q.has('hora')) { game.world.hour = Number(q.get('hora')); game.world.timeFrozen = true }
  if (q.has('chuva')) { game.world.weather.rain = Number(q.get('chuva')); game.world.weather.wetness = Number(q.get('chuva')) }
  if (q.get('camera') === 'primeira') { game.player.cameraOnFoot = 'primeiraPessoa'; game.player.rig.setMode('primeiraPessoa') }

  const hud = document.createElement('div')
  hud.id = 'hud-debug'
  document.body.appendChild(hud)

  const barra = document.createElement('div')
  barra.id = 'carregando'
  barra.innerHTML = '<div class="titulo">THE GROUNDS</div><div class="sub">Vila Preciosa</div><div class="trilho"><i></i></div><div class="etapa">Iniciando</div>'
  document.body.appendChild(barra)

  const x = Number(q.get('x') ?? 24)
  const z = Number(q.get('z') ?? -96)
  await game.prepare(x, z, (p, texto) => {
    const i = barra.querySelector('i') as HTMLElement
    const e = barra.querySelector('.etapa') as HTMLElement
    if (i) i.style.width = `${Math.round(p * 100)}%`
    if (e) e.textContent = texto
  })
  barra.remove()

  game.player.rig.yaw = Number(q.get('yaw') ?? 0)
  if (voar > 0) {
    const p = game.player.controller.position
    game.player.controller.teleport(p.x, p.y + voar, p.z)
    game.player.controller.config.gravity = 0
    game.player.character.ikAtivo = false
  }
  game.start()

  // Permite dirigir o teste sem travar o ponteiro (útil no automatizado).
  const forcarControle = q.get('livre') === '1'
  if (forcarControle) {
    Object.defineProperty(game.input, 'pointerLocked', { get: () => true })
  }
  canvas.addEventListener('click', () => game.input.requestPointerLock())

  setInterval(() => {
    const s = game.stats()
    hud.innerHTML = `
      <b>${s.fps} fps</b> · ${s.frameMs} ms · ${s.resolucao} (x${s.escala})<br>
      desenhos ${s.draws} · triângulos ${(s.tris / 1000).toFixed(0)}k<br>
      setores ${s.setores} (+${s.pendentes}) · colisores ${s.colisores}<br>
      ${s.bairro} · ${s.posicao}<br>
      alturas ${s.alturas}<br>
      ${s.estado} · ${s.hora} · chuva ${s.chuva} · texturas ${s.cdn}<br>
      ${s.malhas}<br>
      ${s.partes}<br>
      obst: ${s.obstaculos}<br>
      ${s.entrada}<br>
      ocl: ${s.oclusao}
    `
  }, 250)

  ;(window as unknown as Record<string, unknown>).__game = {
    game,
    stats: () => game.stats(),
    /** Injeta movimento sem depender do travamento do ponteiro. */
    mover: (x: number, y: number, sprint = false) => {
      game.input.override = { moveX: x, moveY: y, sprint }
    },
    parar: () => { game.input.override = null },
    olhar: (dx: number, dy: number) => game.player.rig.look(dx, dy),
    tp: (px: number, pz: number) => game.player.teleport(px, pz),
  }
}
