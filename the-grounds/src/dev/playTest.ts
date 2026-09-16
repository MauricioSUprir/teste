/** Cena de teste jogável: mundo + personagem + controle + câmera. */
import * as THREE from 'three'
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
  canvas.addEventListener('click', () => {
    game.audio.iniciar()
    game.audio.retomar()
    game.input.requestPointerLock()
  })
  window.addEventListener('keydown', () => { game.audio.iniciar(); game.audio.retomar() }, { once: true })

  setInterval(() => {
    const s = game.stats()
    hud.innerHTML = `
      <b>${s.fps} fps</b> · quadro ${s.quadroMs} ms · cpu+gpu ${s.frameMs} ms · ${s.resolucao} (x${s.escala})<br>
      desenhos ${s.draws} · triângulos ${(s.tris / 1000).toFixed(0)}k<br>
      setores ${s.setores} (+${s.pendentes}) · colisores ${s.colisores}<br>
      ${s.bairro} · ${s.posicao}<br>
      alturas ${s.alturas}<br>
      ${s.estado} · ${s.hora} · chuva ${s.chuva} · texturas ${s.cdn}<br>
      ${s.malhas}<br>
      ${s.partes}<br>
      obst: ${s.obstaculos}<br>
      ${s.entrada}<br>
      ocl: ${s.oclusao}<br>
      perfil: ${s.perfil}<br>
      futebol: ${s.futebol}<br>
      erro: ${game.ultimoErro || '—'}<br>
      carros ${game.traffic.count} · pessoas ${game.crowd.count} · interiores ${game.interiores.count}<br>
      interação: ${game.interacoes.atual?.rotulo ?? '—'} · dentro: ${game.interiores.atual ? 'sim' : 'não'}
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
    bola: () => game.soltarBola(),
    /** Vai até a porta do prédio mais próximo e entra. */
    porta: (dentro = true) => {
      const p = game.player.position
      const perto = game.world.buildingsNear(p.x, p.z, 80)
      if (perto.length === 0) return null
      let melhor = perto[0]
      let d = Infinity
      for (const b of perto) {
        const dd = Math.hypot(b.door.x - p.x, b.door.z - p.z)
        if (dd < d) { d = dd; melhor = b }
      }
      const fx = Math.sin(melhor.yaw)
      const fz = Math.cos(melhor.yaw)
      const dist = dentro ? -1.6 : 2.2
      game.player.teleport(melhor.door.x + fx * dist, melhor.door.z + fz * dist, melhor.yaw + Math.PI)
      game.player.rig.yaw = melhor.yaw + Math.PI
      return { nome: melhor.label ?? melhor.type, tipo: melhor.interior, x: melhor.x, z: melhor.z }
    },
    /** Censo de malhas visíveis: quem realmente custa desenhos. */
    censo: () => {
      const cat = new Map<string, { n: number; tris: number; sombra: number }>()
      const cam = game.engine.camera
      cam.updateMatrixWorld()
      const frustum = new THREE.Frustum().setFromProjectionMatrix(
        new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse),
      )
      game.engine.scene.traverseVisible((o: THREE.Object3D) => {
        const m = o as THREE.Mesh
        if (!m.isMesh || !m.geometry?.attributes?.position) return
        if (m.geometry.boundingSphere == null) m.geometry.computeBoundingSphere()
        const bs = m.geometry.boundingSphere!.clone().applyMatrix4(m.matrixWorld)
        if (!frustum.intersectsSphere(bs)) return
        const nome = m.name || m.type
        const chave = nome.replace(/[0-9_.:-]+$/, '') || nome
        const idx = m.geometry.index
        const tris = (idx ? idx.count : m.geometry.attributes.position.count) / 3
        const e = cat.get(chave) ?? { n: 0, tris: 0, sombra: 0 }
        e.n += 1
        e.tris += tris
        if (m.castShadow) e.sombra += 1
        cat.set(chave, e)
      })
      return [...cat.entries()]
        .sort((a, b) => b[1].n - a[1].n)
        .slice(0, 28)
        .map(([k, v]) => `${k}: ${v.n} malhas, ${(v.tris / 1000).toFixed(0)}k tris, ${v.sombra} c/sombra`)
    },
    /** Abre treino livre no campo mais próximo. */
    treino: () => {
      const p = game.player.position
      let alvo = null as null | typeof game.world.pitches[number]
      let d = Infinity
      for (const c of game.world.pitches) {
        const dd = Math.hypot(c.x - p.x, c.z - p.z)
        if (dd < d) { d = dd; alvo = c }
      }
      if (!alvo) return null
      game.iniciarTreino(alvo.id)
      return { id: alvo.id, nome: alvo.name }
    },
    /** Esconde o painel de diagnóstico, para avaliar a imagem limpa. */
    limpo: () => { hud.style.display = 'none'; return true },
    /** Dispara um chute do jogador com a potência dada (0..1). */
    chute: (potencia = 0.8) => {
      game.player.potenciaChute = Math.max(0, Math.min(1, potencia))
      game.player.playAction(potencia > 0.6 ? 'chuteForte' : 'chute')
      return { potencia: game.player.potenciaChute }
    },
    /** Estado do menu contextual aberto. */
    menu: () => (game.escolha
      ? { titulo: game.escolha.titulo, indice: game.escolha.indice,
          opcoes: game.escolha.opcoes.map((o) => o.rotulo) }
      : null),
    partida: (id?: string) => {
      let alvo = id ? game.world.pitches.find((x) => x.id === id) : undefined
      if (!alvo) {
        const p = game.player.position
        let d = Infinity
        for (const c of game.world.pitches) {
          const dd = Math.hypot(c.x - p.x, c.z - p.z)
          if (dd < d) { d = dd; alvo = c }
        }
      }
      if (!alvo) return null
      game.iniciarPartida(alvo.id)
      return { id: alvo.id, nome: alvo.name, x: alvo.x, z: alvo.z, tipo: alvo.kind }
    },
    carro: () => {
      const v = game.traffic.veiculoProximo(game.player.position.x, game.player.position.z, 40)
      if (v) { game.traffic.liberar(v); game.player.entrarNoVeiculo(v) }
      return !!v
    },
  }
}
