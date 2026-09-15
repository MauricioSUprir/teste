/**
 * Interiores gerados sob demanda.
 *
 * Cada edifício do mapa já nasce com o térreo oco e um vão de porta; este
 * módulo preenche esse volume quando o jogador se aproxima, com divisórias,
 * piso, mobília, iluminação e pontos de interação — e desmonta tudo quando ele
 * se afasta, de modo que o custo não cresce com o tamanho da cidade.
 */

import * as THREE from 'three'
import { clamp, lerp, makeRng, pick, randInt, randRange, type Rng } from '../core/math'
import { GeometryBatcher, makeBox, makeCylinder, transform, withColor } from './geometry'
import type { CollisionWorld } from './collision'
import type { MaterialLibrary, WorldMaterialKey } from './materials'
import type { BuildingSpec, InteriorKind } from './buildings'

const PARED_T = 0.14
const PE_DIREITO = 2.85

export interface PontoInterativo {
  kind: 'porta' | 'interruptor' | 'sentar' | 'cama' | 'guardaRoupa' | 'geladeira'
    | 'espelho' | 'loja' | 'elevador' | 'tv' | 'maquina' | 'balcao'
  rotulo: string
  x: number; y: number; z: number
  raio: number
  /** Dados extras usados pelo jogo (por exemplo, o ângulo ao sentar). */
  yaw?: number
}

export interface InteriorConstruido {
  id: string
  spec: BuildingSpec
  group: THREE.Group
  pontos: PontoInterativo[]
  /** Luzes internas, acesas conforme o horário e o interruptor. */
  luzes: THREE.PointLight[]
  acesa: boolean
  /** Centro aproximado do ambiente, para o áudio. */
  centro: THREE.Vector3
  /** Raio em que o jogador é considerado "dentro". */
  raio: number
}

/** Retângulo de um cômodo em coordenadas locais do edifício. */
interface Comodo {
  x0: number; z0: number; x1: number; z1: number
  tipo: TipoComodo
}

type TipoComodo =
  | 'sala' | 'quarto' | 'cozinha' | 'banheiro' | 'corredor' | 'loja'
  | 'estoque' | 'balcao' | 'saguao' | 'escritorio' | 'vestiario' | 'garagem'

const CORES_PAREDE = [0xefe9dd, 0xe6e2d6, 0xdfe4e2, 0xe8dfd0, 0xdde3e8, 0xf0ece2]
const CORES_PISO = [0xcfc7b8, 0xc4bcae, 0xd6cfc2, 0xb9b2a6]

/**
 * Divide a planta baixa em cômodos por cortes sucessivos. Um imóvel pequeno
 * vira um cômodo só; um maior ganha sala, quarto, cozinha e banheiro.
 */
function planejarComodos(w: number, d: number, kind: InteriorKind, rng: Rng): Comodo[] {
  const area = w * d
  const inteiro: Comodo = { x0: -w / 2, z0: -d / 2, x1: w / 2, z1: d / 2, tipo: 'sala' }

  switch (kind) {
    case 'lojaRoupas': case 'lojaEsporte': case 'mercado': {
      if (area < 45) return [{ ...inteiro, tipo: 'loja' }]
      // Loja com estoque nos fundos.
      const corte = inteiro.z0 + d * randRange(rng, 0.62, 0.74)
      return [
        { x0: inteiro.x0, z0: corte, x1: inteiro.x1, z1: inteiro.z1, tipo: 'loja' },
        { x0: inteiro.x0, z0: inteiro.z0, x1: inteiro.x1, z1: corte, tipo: 'estoque' },
      ]
    }
    case 'cafe': {
      if (area < 40) return [{ ...inteiro, tipo: 'loja' }]
      const corte = inteiro.z0 + d * 0.30
      return [
        { x0: inteiro.x0, z0: corte, x1: inteiro.x1, z1: inteiro.z1, tipo: 'loja' },
        { x0: inteiro.x0, z0: inteiro.z0, x1: inteiro.x1, z1: corte, tipo: 'balcao' },
      ]
    }
    case 'saguao': case 'escritorio':
      return [{ ...inteiro, tipo: kind === 'saguao' ? 'saguao' : 'escritorio' }]
    case 'garagem':
      return [{ ...inteiro, tipo: 'garagem' }]
    case 'vestiario':
      return [{ ...inteiro, tipo: 'vestiario' }]
    default: {
      // Residência: sala na frente, quarto e cozinha atrás, banheiro pequeno.
      if (area < 32) return [{ ...inteiro, tipo: 'sala' }]
      const meio = inteiro.z0 + d * randRange(rng, 0.46, 0.56)
      const frente: Comodo = { x0: inteiro.x0, z0: meio, x1: inteiro.x1, z1: inteiro.z1, tipo: 'sala' }
      if (area < 60) {
        return [frente, { x0: inteiro.x0, z0: inteiro.z0, x1: inteiro.x1, z1: meio, tipo: 'cozinha' }]
      }
      const corteX = inteiro.x0 + w * randRange(rng, 0.44, 0.58)
      const banhoW = Math.min(2.2, w * 0.34)
      return [
        frente,
        { x0: inteiro.x0, z0: inteiro.z0, x1: corteX, z1: meio, tipo: 'quarto' },
        { x0: corteX, z0: inteiro.z0 + banhoW, x1: inteiro.x1, z1: meio, tipo: 'cozinha' },
        { x0: corteX, z0: inteiro.z0, x1: inteiro.x1, z1: inteiro.z0 + banhoW, tipo: 'banheiro' },
      ]
    }
  }
}

/** Nome do estabelecimento ou da residência, exibido na interação. */
function rotuloDe(kind: InteriorKind, spec: BuildingSpec): string {
  switch (kind) {
    case 'lojaRoupas': return spec.label ?? 'Loja de roupas'
    case 'lojaEsporte': return spec.label ?? 'Artigos esportivos'
    case 'cafe': return spec.label ?? 'Café'
    case 'mercado': return spec.label ?? 'Mercado'
    case 'saguao': return spec.label ?? 'Saguão'
    case 'escritorio': return 'Escritório'
    case 'garagem': return 'Garagem'
    case 'vestiario': return 'Vestiário'
    case 'apartamento': return 'Apartamento'
    default: return 'Residência'
  }
}

export class InteriorBuilder {
  constructor(private readonly materials: MaterialLibrary) {}

  /** Constrói o interior de um edifício e registra colisores e interações. */
  construir(
    spec: BuildingSpec, collision: CollisionWorld, owner: string,
  ): InteriorConstruido {
    const rng = makeRng(spec.seed ^ 0x1717)
    const batcher = new GeometryBatcher()
    const pontos: PontoInterativo[] = []
    const luzes: THREE.PointLight[] = []

    const w = spec.width - PARED_T * 2 - 0.1
    const d = spec.depth - PARED_T * 2 - 0.1
    const base = spec.baseY
    const alturaTeto = Math.min(spec.floorHeight, PE_DIREITO)

    const corParede = new THREE.Color(pick(rng, CORES_PAREDE))
    const corPiso = new THREE.Color(pick(rng, CORES_PISO))

    /** Converte coordenadas locais do edifício para o mundo. */
    const paraMundo = (lx: number, lz: number, out = new THREE.Vector3()): THREE.Vector3 => {
      const cos = Math.cos(spec.yaw)
      const sin = Math.sin(spec.yaw)
      return out.set(spec.x + lx * cos + lz * sin, base, spec.z - lx * sin + lz * cos)
    }

    /** Posiciona uma geometria local no mundo. */
    const put = (geo: THREE.BufferGeometry, lx: number, ly: number, lz: number, ryaw = 0) => {
      transform(geo, 0, 0, 0, ryaw)
      const p = paraMundo(lx, lz)
      return transform(geo, p.x, base + ly, p.z, spec.yaw)
    }

    const colisor = (lx: number, ly: number, lz: number, hx: number, hy: number, hz: number,
      tag: 'parede' | 'movel' = 'movel', walkable = true) => {
      const p = paraMundo(lx, lz)
      collision.add({ x: p.x, y: base + ly, z: p.z }, { x: hx, y: hy, z: hz }, spec.yaw, tag, owner, { walkable })
    }

    // --- Piso e rodapé -----------------------------------------------------
    const pisoMat: WorldMaterialKey = spec.interior === 'garagem' ? 'concreto'
      : spec.interior === 'cafe' || spec.interior === 'mercado' || spec.interior === 'saguao' ? 'azulejo'
        : 'pisoInterno'
    batcher.add(pisoMat, withColor(put(makeBox(w, 0.06, d, { uvScale: 1.6 }), 0, 0.03, 0), corPiso))

    // --- Cômodos -----------------------------------------------------------
    const comodos = planejarComodos(w, d, spec.interior, rng)
    for (let i = 1; i < comodos.length; i++) {
      this.divisoria(comodos[i], comodos[0], batcher, put, colisor, alturaTeto, corParede, rng)
    }

    for (const c of comodos) {
      this.mobiliar(c, spec, batcher, put, colisor, pontos, luzes, paraMundo, rng, alturaTeto, corParede)
    }

    // --- Iluminação --------------------------------------------------------
    for (const c of comodos) {
      const cx = (c.x0 + c.x1) / 2
      const cz = (c.z0 + c.z1) / 2
      batcher.add('luz', withColor(
        put(makeBox(Math.min(0.9, (c.x1 - c.x0) * 0.4), 0.05, Math.min(0.5, (c.z1 - c.z0) * 0.3), { uvScale: 1 }),
          cx, alturaTeto - 0.09, cz),
        new THREE.Color(0xfff2d8)))
      const p = paraMundo(cx, cz)
      const luz = new THREE.PointLight(0xffe9c4, 7, 10.5, 2)
      luz.position.set(p.x, base + alturaTeto - 0.25, p.z)
      luzes.push(luz)
    }

    // Interruptor ao lado da porta
    const interruptor = paraMundo(Math.min(w / 2 - 0.25, 1.0), d / 2 - 0.2)
    pontos.push({
      kind: 'interruptor', rotulo: 'Acender / apagar a luz',
      x: interruptor.x, y: base + 1.25, z: interruptor.z, raio: 1.5,
    })

    // Porta de saída
    const saida = paraMundo(0, d / 2 + 0.2)
    pontos.push({
      kind: 'porta', rotulo: 'Sair',
      x: saida.x, y: base + 1.0, z: saida.z, raio: 2.0, yaw: spec.yaw,
    })

    // Elevador ou escada em prédios altos
    if (spec.units > 0 && (spec.interior === 'saguao' || spec.interior === 'escritorio')) {
      const p = paraMundo(-w / 2 + 0.8, -d / 2 + 0.9)
      batcher.add('metal', withColor(
        put(makeBox(1.6, alturaTeto - 0.1, 0.16, { uvScale: 1 }), -w / 2 + 0.8, (alturaTeto - 0.1) / 2, -d / 2 + 0.15),
        new THREE.Color(0x9aa2aa)))
      pontos.push({
        kind: 'elevador', rotulo: `Elevador (${spec.units} andares)`,
        x: p.x, y: base + 1.1, z: p.z, raio: 2.0,
      })
    }

    const meshes = batcher.build((k) => this.materials.get(k as WorldMaterialKey))
    const group = new THREE.Group()
    group.name = `interior-${spec.id}`
    for (const m of meshes) {
      m.castShadow = false
      m.receiveShadow = true
      group.add(m)
    }
    for (const l of luzes) group.add(l)

    const centro = paraMundo(0, 0)
    centro.y = base + 1.2

    return {
      id: `interior-${spec.id}`,
      spec, group, pontos, luzes,
      acesa: false,
      centro,
      raio: Math.max(spec.width, spec.depth) * 0.6,
    }
  }

  /** Parede divisória com vão de passagem. */
  private divisoria(
    c: Comodo, _sala: Comodo,
    batcher: GeometryBatcher,
    put: (g: THREE.BufferGeometry, lx: number, ly: number, lz: number, ryaw?: number) => THREE.BufferGeometry,
    colisor: (lx: number, ly: number, lz: number, hx: number, hy: number, hz: number, tag?: 'parede' | 'movel', walkable?: boolean) => void,
    altura: number, cor: THREE.Color, rng: Rng,
  ): void {
    const larg = c.x1 - c.x0
    const prof = c.z1 - c.z0
    // A divisória fica no lado voltado para a sala (maior z).
    const vaoW = 0.95
    const meioX = (c.x0 + c.x1) / 2
    const z = c.z1
    const esq = (meioX - vaoW / 2) - c.x0
    const dir = c.x1 - (meioX + vaoW / 2)

    if (esq > 0.05) {
      batcher.add('fachada', withColor(put(makeBox(esq, altura, PARED_T, { uvScale: 1.6 }), c.x0 + esq / 2, altura / 2, z), cor))
      colisor(c.x0 + esq / 2, altura / 2, z, esq / 2, altura / 2, PARED_T / 2, 'parede', false)
    }
    if (dir > 0.05) {
      batcher.add('fachada', withColor(put(makeBox(dir, altura, PARED_T, { uvScale: 1.6 }), c.x1 - dir / 2, altura / 2, z), cor))
      colisor(c.x1 - dir / 2, altura / 2, z, dir / 2, altura / 2, PARED_T / 2, 'parede', false)
    }
    // Verga sobre o vão
    const vergaH = Math.max(0.1, altura - 2.05)
    batcher.add('fachada', withColor(put(makeBox(vaoW, vergaH, PARED_T, { uvScale: 1 }), meioX, altura - vergaH / 2, z), cor))
    colisor(meioX, altura - vergaH / 2, z, vaoW / 2, vergaH / 2, PARED_T / 2, 'parede', false)

    // Parede lateral quando o cômodo não encosta na parede externa.
    void larg; void prof; void rng
  }

  /** Mobília e interações por tipo de cômodo. */
  private mobiliar(
    c: Comodo, spec: BuildingSpec,
    batcher: GeometryBatcher,
    put: (g: THREE.BufferGeometry, lx: number, ly: number, lz: number, ryaw?: number) => THREE.BufferGeometry,
    colisor: (lx: number, ly: number, lz: number, hx: number, hy: number, hz: number, tag?: 'parede' | 'movel', walkable?: boolean) => void,
    pontos: PontoInterativo[],
    _luzes: THREE.PointLight[],
    paraMundo: (lx: number, lz: number, out?: THREE.Vector3) => THREE.Vector3,
    rng: Rng, altura: number, _corParede: THREE.Color,
  ): void {
    const w = c.x1 - c.x0
    const d = c.z1 - c.z0
    const cx = (c.x0 + c.x1) / 2
    const cz = (c.z0 + c.z1) / 2
    const base = spec.baseY
    const madeira = new THREE.Color(0x7a5535)
    const madeiraEsc = new THREE.Color(0x4a3524)
    const tecido = new THREE.Color(pick(rng, [0x6a4a3a, 0x3a4a5a, 0x4a5a3a, 0x5a4a5a, 0x7a6a5a]))
    const metal = new THREE.Color(0xb4bac0)
    const branco = new THREE.Color(0xeef2f4)

    const ponto = (kind: PontoInterativo['kind'], rotulo: string, lx: number, ly: number, lz: number, raio = 1.6, yaw?: number) => {
      const p = paraMundo(lx, lz)
      pontos.push({ kind, rotulo, x: p.x, y: base + ly, z: p.z, raio, yaw })
    }

    switch (c.tipo) {
      case 'sala': {
        // Sofá encostado na parede
        const sofaW = Math.min(w * 0.62, 2.1)
        const sx = cx
        const sz = c.z0 + 0.5
        batcher.add('tecido', withColor(put(makeBox(sofaW, 0.42, 0.85, { uvScale: 0.8 }), sx, 0.27, sz), tecido))
        batcher.add('tecido', withColor(put(makeBox(sofaW, 0.55, 0.22, { uvScale: 0.8 }), sx, 0.55, sz - 0.32), tecido))
        for (const s of [-1, 1]) {
          batcher.add('tecido', withColor(put(makeBox(0.2, 0.5, 0.85, { uvScale: 0.8 }), sx + s * (sofaW / 2 - 0.1), 0.5, sz), tecido))
        }
        colisor(sx, 0.3, sz, sofaW / 2, 0.3, 0.45)
        ponto('sentar', 'Sentar no sofá', sx, 0.5, sz + 0.1, 1.5, spec.yaw)

        // Mesa de centro
        batcher.add('madeira', withColor(put(makeBox(0.95, 0.06, 0.55, { uvScale: 0.6 }), cx, 0.42, cz + 0.2), madeira))
        for (const [ox, oz] of [[-0.42, -0.22], [0.42, -0.22], [-0.42, 0.22], [0.42, 0.22]] as const) {
          batcher.add('madeiraEscura', withColor(put(makeBox(0.06, 0.4, 0.06, { uvScale: 0.4 }), cx + ox, 0.2, cz + 0.2 + oz), madeiraEsc))
        }
        colisor(cx, 0.22, cz + 0.2, 0.5, 0.22, 0.3)

        // Televisão e móvel
        const tvZ = c.z1 - 0.35
        batcher.add('madeiraEscura', withColor(put(makeBox(1.3, 0.45, 0.4, { uvScale: 0.6 }), cx, 0.23, tvZ), madeiraEsc))
        batcher.add('plastico', withColor(put(makeBox(1.05, 0.62, 0.06, { uvScale: 0.5 }), cx, 0.78, tvZ), new THREE.Color(0x14171a)))
        batcher.add('luz', withColor(put(makeBox(0.98, 0.55, 0.02, { uvScale: 0.5 }), cx, 0.78, tvZ - 0.04), new THREE.Color(0x2a4a6a)))
        colisor(cx, 0.24, tvZ, 0.65, 0.24, 0.22)
        ponto('tv', 'Ligar a televisão', cx, 0.9, tvZ - 0.5, 1.6)

        // Tapete
        batcher.add('tecido', withColor(put(makeBox(Math.min(w * 0.7, 2.4), 0.02, Math.min(d * 0.5, 1.6), { uvScale: 1 }), cx, 0.07, cz + 0.1),
          new THREE.Color(0x8a7a6a)))
        break
      }

      case 'quarto': {
        const camaW = Math.min(w * 0.62, 1.45)
        const camaD = Math.min(d * 0.75, 2.0)
        const bx = c.x0 + camaW / 2 + 0.2
        const bz = cz
        batcher.add('madeiraEscura', withColor(put(makeBox(camaW, 0.32, camaD, { uvScale: 0.7 }), bx, 0.22, bz), madeiraEsc))
        batcher.add('tecido', withColor(put(makeBox(camaW - 0.06, 0.22, camaD - 0.1, { uvScale: 0.8 }), bx, 0.48, bz),
          new THREE.Color(0xd8d2c4)))
        batcher.add('tecido', withColor(put(makeBox(camaW - 0.2, 0.12, 0.4, { uvScale: 0.6 }), bx, 0.62, bz - camaD / 2 + 0.3), branco))
        batcher.add('madeiraEscura', withColor(put(makeBox(camaW, 0.7, 0.08, { uvScale: 0.6 }), bx, 0.5, bz - camaD / 2), madeiraEsc))
        colisor(bx, 0.3, bz, camaW / 2, 0.3, camaD / 2)
        ponto('cama', 'Dormir até de manhã', bx, 0.7, bz + camaD / 2 + 0.2, 1.8)

        // Guarda-roupa
        const gx = c.x1 - 0.35
        batcher.add('madeira', withColor(put(makeBox(0.6, 2.0, Math.min(d * 0.5, 1.4), { uvScale: 0.8 }), gx, 1.0, cz), madeira))
        colisor(gx, 1.0, cz, 0.3, 1.0, Math.min(d * 0.5, 1.4) / 2)
        ponto('guardaRoupa', 'Trocar de roupa', gx - 0.6, 1.0, cz, 1.7)

        // Espelho
        batcher.add('vidro', withColor(put(makeBox(0.5, 1.2, 0.04, { uvScale: 0.5 }), cx, 1.3, c.z1 - 0.12), new THREE.Color(0xdce6ee)))
        ponto('espelho', 'Ver-se no espelho', cx, 1.2, c.z1 - 0.7, 1.5)
        break
      }

      case 'cozinha': {
        const balcaoD = Math.min(d - 0.4, 0.6)
        const bz2 = c.z0 + balcaoD / 2 + 0.1
        batcher.add('madeira', withColor(put(makeBox(w - 0.3, 0.85, balcaoD, { uvScale: 0.8 }), cx, 0.43, bz2), madeira))
        batcher.add('azulejo', withColor(put(makeBox(w - 0.3, 0.05, balcaoD + 0.04, { uvScale: 0.5 }), cx, 0.88, bz2), branco))
        colisor(cx, 0.45, bz2, (w - 0.3) / 2, 0.45, balcaoD / 2)
        // Pia
        batcher.add('metal', withColor(put(makeBox(0.5, 0.06, 0.4, { uvScale: 0.3 }), cx - w * 0.2, 0.9, bz2), metal))
        // Fogão
        batcher.add('metal', withColor(put(makeBox(0.6, 0.06, 0.5, { uvScale: 0.3 }), cx + w * 0.2, 0.9, bz2), new THREE.Color(0x2a2e33))) 
        // Geladeira
        const gx = c.x1 - 0.4
        batcher.add('metal', withColor(put(makeBox(0.68, 1.75, 0.66, { uvScale: 0.8 }), gx, 0.88, c.z1 - 0.45), new THREE.Color(0xdfe3e6)))
        colisor(gx, 0.88, c.z1 - 0.45, 0.34, 0.88, 0.33)
        ponto('geladeira', 'Comer alguma coisa', gx - 0.7, 1.0, c.z1 - 0.45, 1.6)
        // Armários suspensos
        batcher.add('madeira', withColor(put(makeBox(w - 0.5, 0.65, 0.35, { uvScale: 0.6 }), cx, altura - 0.75, bz2), madeira))
        // Azulejo na parede
        batcher.add('azulejo', withColor(put(makeBox(w - 0.2, 1.0, 0.03, { uvScale: 0.5 }), cx, 1.4, c.z0 + 0.09), branco))
        break
      }

      case 'banheiro': {
        batcher.add('azulejo', withColor(put(makeBox(w - 0.1, altura - 0.2, 0.03, { uvScale: 0.5 }), cx, altura / 2, c.z0 + 0.08), branco))
        // Vaso e pia
        batcher.add('azulejo', withColor(put(makeBox(0.38, 0.42, 0.55, { uvScale: 0.3 }), c.x0 + 0.35, 0.21, cz), branco))
        batcher.add('azulejo', withColor(put(makeBox(0.34, 0.36, 0.18, { uvScale: 0.3 }), c.x0 + 0.35, 0.55, cz - 0.24), branco))
        batcher.add('azulejo', withColor(put(makeBox(0.5, 0.14, 0.38, { uvScale: 0.3 }), c.x1 - 0.35, 0.82, cz), branco))
        batcher.add('vidro', withColor(put(makeBox(0.42, 0.55, 0.03, { uvScale: 0.3 }), c.x1 - 0.35, 1.45, c.z0 + 0.1), new THREE.Color(0xdce6ee)))
        colisor(c.x0 + 0.35, 0.3, cz, 0.22, 0.3, 0.3)
        break
      }

      case 'loja': {
        // Araras e prateleiras
        const araras = randInt(rng, 2, 4)
        for (let i = 0; i < araras; i++) {
          const ax = lerp(c.x0 + 1.0, c.x1 - 1.0, araras === 1 ? 0.5 : i / (araras - 1))
          batcher.add('metal', withColor(put(makeCylinder(0.03, 1.5, 6, 0.5), ax, 0.75, cz), metal))
          const barra = makeCylinder(0.025, Math.min(1.6, d * 0.5), 6, 0.5)
          barra.rotateX(Math.PI / 2)
          batcher.add('metal', withColor(put(barra, ax, 1.45, cz), metal))
          const pecas = randInt(rng, 4, 8)
          for (let k = 0; k < pecas; k++) {
            const oz = lerp(-0.7, 0.7, pecas === 1 ? 0.5 : k / (pecas - 1)) * Math.min(1, d * 0.35)
            batcher.add('tecido', withColor(
              put(makeBox(0.07, 0.62, 0.34, { uvScale: 0.4 }), ax, 1.08, cz + oz),
              new THREE.Color(pick(rng, [0xd83a3a, 0x2f5fb3, 0x2f9e5a, 0xf2c230, 0xe8e8e8, 0x2a2a2a, 0xf07c2a]))))
          }
          colisor(ax, 0.75, cz, 0.12, 0.75, Math.min(0.8, d * 0.25))
        }
        // Balcão de atendimento
        const bx = c.x1 - 0.8
        const bz3 = c.z1 - 0.9
        batcher.add('madeira', withColor(put(makeBox(1.4, 0.95, 0.55, { uvScale: 0.6 }), bx, 0.48, bz3), madeira))
        colisor(bx, 0.48, bz3, 0.7, 0.48, 0.28)
        ponto('loja', rotuloDe(spec.interior, spec), bx, 1.1, bz3 - 0.7, 1.9)
        break
      }

      case 'balcao': {
        const bz4 = c.z1 - 0.7
        batcher.add('madeira', withColor(put(makeBox(w - 0.6, 1.05, 0.6, { uvScale: 0.6 }), cx, 0.52, bz4), madeira))
        batcher.add('madeiraEscura', withColor(put(makeBox(w - 0.5, 0.06, 0.7, { uvScale: 0.5 }), cx, 1.08, bz4), madeiraEsc))
        colisor(cx, 0.52, bz4, (w - 0.6) / 2, 0.52, 0.3)
        ponto('balcao', 'Pedir um café', cx, 1.15, bz4 - 0.8, 1.9)
        // Máquina e prateleira
        batcher.add('metal', withColor(put(makeBox(0.5, 0.45, 0.35, { uvScale: 0.4 }), cx - w * 0.25, 1.32, bz4), metal))
        batcher.add('madeira', withColor(put(makeBox(w - 0.8, 0.06, 0.3, { uvScale: 0.5 }), cx, 1.85, c.z1 - 0.2), madeira))
        break
      }

      case 'estoque': {
        for (let i = 0; i < 3; i++) {
          const sx2 = lerp(c.x0 + 0.5, c.x1 - 0.5, i / 2)
          batcher.add('metal', withColor(put(makeBox(0.42, 1.9, Math.min(1.4, d * 0.6), { uvScale: 0.7 }), sx2, 0.95, cz), new THREE.Color(0x8a9098)))
          colisor(sx2, 0.95, cz, 0.21, 0.95, Math.min(1.4, d * 0.6) / 2)
        }
        break
      }

      case 'saguao': {
        // Recepção e sofás de espera
        batcher.add('madeiraEscura', withColor(put(makeBox(Math.min(w * 0.5, 2.6), 1.05, 0.65, { uvScale: 0.7 }), cx, 0.52, c.z0 + 0.7), madeiraEsc))
        colisor(cx, 0.52, c.z0 + 0.7, Math.min(w * 0.5, 2.6) / 2, 0.52, 0.33)
        for (const s of [-1, 1]) {
          const sx3 = cx + s * Math.min(w * 0.3, 2.2)
          batcher.add('tecido', withColor(put(makeBox(1.5, 0.4, 0.7, { uvScale: 0.7 }), sx3, 0.25, cz + 0.4), tecido))
          colisor(sx3, 0.25, cz + 0.4, 0.75, 0.25, 0.35)
          ponto('sentar', 'Sentar', sx3, 0.5, cz + 0.4, 1.4, spec.yaw)
        }
        batcher.add('folhagem', withColor(put(makeCylinder(0.34, 0.9, 8, 0.5), c.x1 - 0.6, 0.45, c.z1 - 0.6), new THREE.Color(0x3a6b30)))
        break
      }

      case 'escritorio': {
        const mesas = randInt(rng, 2, 4)
        for (let i = 0; i < mesas; i++) {
          const mx = lerp(c.x0 + 1.0, c.x1 - 1.0, mesas === 1 ? 0.5 : i / (mesas - 1))
          batcher.add('madeira', withColor(put(makeBox(1.3, 0.05, 0.7, { uvScale: 0.6 }), mx, 0.74, cz), madeira))
          for (const [ox, oz] of [[-0.6, -0.3], [0.6, -0.3], [-0.6, 0.3], [0.6, 0.3]] as const) {
            batcher.add('metal', withColor(put(makeBox(0.05, 0.72, 0.05, { uvScale: 0.3 }), mx + ox, 0.36, cz + oz), metal))
          }
          batcher.add('plastico', withColor(put(makeBox(0.52, 0.34, 0.04, { uvScale: 0.3 }), mx, 0.95, cz - 0.2), new THREE.Color(0x14171a)))
          batcher.add('tecido', withColor(put(makeBox(0.45, 0.45, 0.45, { uvScale: 0.5 }), mx, 0.5, cz + 0.6), new THREE.Color(0x2a3038)))
          colisor(mx, 0.4, cz, 0.7, 0.4, 0.4)
          ponto('sentar', 'Sentar na cadeira', mx, 0.5, cz + 0.6, 1.3, spec.yaw)
        }
        break
      }

      case 'vestiario': {
        for (const s of [-1, 1]) {
          const bz5 = cz + s * Math.min(d * 0.28, 1.4)
          batcher.add('madeira', withColor(put(makeBox(w - 1.0, 0.09, 0.4, { uvScale: 0.6 }), cx, 0.45, bz5), madeira))
          for (let i = 0; i < 3; i++) {
            const px2 = lerp(c.x0 + 0.8, c.x1 - 0.8, i / 2)
            batcher.add('metal', withColor(put(makeBox(0.07, 0.42, 0.07, { uvScale: 0.3 }), px2, 0.21, bz5), metal))
          }
          colisor(cx, 0.24, bz5, (w - 1.0) / 2, 0.24, 0.2)
          ponto('sentar', 'Sentar no banco', cx, 0.5, bz5, 1.4, spec.yaw)
          // Armários
          batcher.add('metalPintado', withColor(put(makeBox(w - 1.0, 1.8, 0.4, { uvScale: 0.7 }), cx, 0.9, cz + s * Math.min(d * 0.45, 2.2)),
            new THREE.Color(0x3a6b8a)))
          colisor(cx, 0.9, cz + s * Math.min(d * 0.45, 2.2), (w - 1.0) / 2, 0.9, 0.2)
        }
        ponto('guardaRoupa', 'Vestir o uniforme', cx, 1.0, cz, 2.2)
        break
      }

      case 'garagem': {
        batcher.add('concreto', withColor(put(makeBox(w - 0.4, 0.04, d - 0.4, { uvScale: 2 }), cx, 0.08, cz), new THREE.Color(0xb4b0a6)))
        // Bancada e prateleira de ferramentas
        batcher.add('madeiraEscura', withColor(put(makeBox(w * 0.5, 0.9, 0.55, { uvScale: 0.7 }), cx, 0.45, c.z0 + 0.4), madeiraEsc))
        colisor(cx, 0.45, c.z0 + 0.4, w * 0.25, 0.45, 0.28)
        ponto('maquina', 'Guardar ou trocar de veículo', cx, 1.0, cz, 3.0)
        break
      }

      default:
        break
    }
  }
}

/** Gerencia quais interiores estão montados, conforme a distância do jogador. */
export class InteriorManager {
  private ativos = new Map<number, InteriorConstruido>()
  private builder: InteriorBuilder
  /** Interior em que o jogador está, quando houver. */
  atual: InteriorConstruido | null = null

  constructor(
    materials: MaterialLibrary,
    private readonly raiz: THREE.Object3D,
    private readonly collision: CollisionWorld,
  ) {
    this.builder = new InteriorBuilder(materials)
  }

  get count(): number { return this.ativos.size }

  /**
   * Monta interiores de edifícios próximos e remove os distantes.
   * `candidatos` são os edifícios já conhecidos ao redor do jogador.
   */
  atualizar(
    posicao: THREE.Vector3, candidatos: BuildingSpec[],
    distanciaMontar = 26, distanciaSoltar = 44, limite = 6,
  ): void {
    // Remove os que ficaram longe.
    for (const [id, interior] of [...this.ativos]) {
      const d = Math.hypot(interior.spec.x - posicao.x, interior.spec.z - posicao.z)
      if (d > distanciaSoltar) this.remover(id)
    }

    // Monta os mais próximos, respeitando o limite simultâneo.
    const ordenados = candidatos
      .map((b) => ({ b, d: Math.hypot(b.x - posicao.x, b.z - posicao.z) }))
      .filter((x) => x.d <= distanciaMontar)
      .sort((a, b) => a.d - b.d)

    for (const { b } of ordenados) {
      if (this.ativos.size >= limite) break
      if (this.ativos.has(b.id)) continue
      const interior = this.builder.construir(b, this.collision, `interior-${b.id}`)
      this.raiz.add(interior.group)
      this.ativos.set(b.id, interior)
    }

    // Determina em qual interior o jogador está.
    this.atual = null
    for (const interior of this.ativos.values()) {
      const dx = posicao.x - interior.spec.x
      const dz = posicao.z - interior.spec.z
      const cos = Math.cos(interior.spec.yaw)
      const sin = Math.sin(interior.spec.yaw)
      const lx = dx * cos - dz * sin
      const lz = dx * sin + dz * cos
      const dentro = Math.abs(lx) < interior.spec.width / 2
        && Math.abs(lz) < interior.spec.depth / 2
        && posicao.y < interior.spec.baseY + interior.spec.floorHeight
        && posicao.y > interior.spec.baseY - 1
      if (dentro) { this.atual = interior; break }
    }
  }

  /** Acende ou apaga as luzes de um interior. */
  alternarLuz(interior: InteriorConstruido, intensidade = 16): void {
    interior.acesa = !interior.acesa
    for (const l of interior.luzes) l.intensity = interior.acesa ? intensidade : 0
  }

  /**
   * Iluminação dos interiores.
   *
   * Mesmo de dia há uma base acesa: o sol não entra pelas paredes, e um
   * cômodo totalmente escuro durante o dia pareceria um erro, não uma escolha.
   */
  atualizarLuzes(claridade: number): void {
    for (const i of this.ativos.values()) {
      const base = lerp(11, 6, clamp(claridade, 0, 1))
      const alvo = i.acesa ? 18 : base
      for (const l of i.luzes) l.intensity = alvo
    }
  }

  /** Pontos de interação dos interiores montados. */
  *pontos(): Generator<{ interior: InteriorConstruido; ponto: PontoInterativo }> {
    for (const i of this.ativos.values()) {
      for (const p of i.pontos) yield { interior: i, ponto: p }
    }
  }

  private remover(id: number): void {
    const i = this.ativos.get(id)
    if (!i) return
    this.raiz.remove(i.group)
    i.group.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.geometry) m.geometry.dispose()
    })
    this.collision.removeOwner(i.id)
    this.ativos.delete(id)
  }

  dispose(): void {
    for (const id of [...this.ativos.keys()]) this.remover(id)
  }
}
