/**
 * Consulta a API do Poly Haven e gera `src/assets/cdn-manifest.json` com as
 * URLs exatas dos mapas PBR (CC0) usados pelo jogo.
 *
 * Rodar apenas quando a seleção de materiais mudar:
 *   node tools/build-texture-manifest.mjs
 */
import { writeFileSync } from 'node:fs'

/** chave do material no jogo -> asset CC0 do Poly Haven */
const SELECTION = {
  asfalto:          { id: 'asphalt_02',            uvScale: 7.0 },
  asfaltoGasto:     { id: 'road_damaged',          uvScale: 8.0 },
  calcada:          { id: 'concrete_pavers_02',    uvScale: 3.2 },
  meioFio:          { id: 'worn_concrete_floor',   uvScale: 2.0 },
  concreto:         { id: 'concrete_wall_008',     uvScale: 2.6 },
  fachada:          { id: 'white_plaster_rough_02', uvScale: 2.4 },
  fachadaGasta:     { id: 'worn_mossy_plasterwall', uvScale: 2.6 },
  fachadaPastilha:  { id: 'rectangular_facade_tiles', uvScale: 1.8 },
  tijolo:           { id: 'red_bricks_02',         uvScale: 2.2 },
  telha:            { id: 'ceramic_roof_01',       uvScale: 1.6 },
  grama:            { id: 'sparse_grass',          uvScale: 4.0 },
  terra:            { id: 'dirt_floor',            uvScale: 4.0 },
  madeira:          { id: 'wood_planks',           uvScale: 2.0 },
  madeiraEscura:    { id: 'dark_wood',             uvScale: 1.6 },
  azulejo:          { id: 'square_tiled_wall',     uvScale: 1.2 },
  pisoInterno:      { id: 'tiled_floor_001',       uvScale: 2.0 },
  paralelepipedo:   { id: 'cobblestone_floor_08',  uvScale: 3.0 },
  metal:            { id: 'rusty_metal_04',        uvScale: 2.0 },
  metalPintado:     { id: 'painted_metal_shutter', uvScale: 2.0 },
}

const MAP_KEYS = { Diffuse: 'map', nor_gl: 'normalMap', Rough: 'roughnessMap', AO: 'aoMap' }

async function fetchJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return res.json()
}

function pick(files, name, res) {
  const entry = files[name]
  if (!entry) return null
  const byRes = entry[res]
  if (!byRes) return null
  return byRes.jpg?.url ?? byRes.png?.url ?? null
}

const out = { generatedAt: new Date().toISOString(), source: 'Poly Haven (CC0)', materials: {} }

for (const [key, cfg] of Object.entries(SELECTION)) {
  process.stdout.write(`${key} (${cfg.id}) ... `)
  try {
    const files = await fetchJson(`https://api.polyhaven.com/files/${cfg.id}`)
    const entry = { id: cfg.id, uvScale: cfg.uvScale, credit: `Poly Haven — ${cfg.id} (CC0)`, res: {} }
    for (const res of ['1k', '2k']) {
      const maps = {}
      for (const [phName, matKey] of Object.entries(MAP_KEYS)) {
        const url = pick(files, phName, res)
        if (url) maps[matKey] = url
      }
      // Alguns assets usam 'nor_gl' aninhado de outra forma
      if (!maps.normalMap) {
        const alt = pick(files, 'nor_dx', res)
        if (alt) { maps.normalMap = alt; entry.normalIsDirectX = true }
      }
      if (Object.keys(maps).length > 0) entry.res[res] = maps
    }
    if (!entry.res['1k']) throw new Error('sem mapas 1k')
    out.materials[key] = entry
    console.log('ok', Object.keys(entry.res['1k']).join(','))
  } catch (e) {
    console.log('FALHOU:', e.message)
  }
}

writeFileSync(new URL('../src/assets/cdn-manifest.json', import.meta.url), JSON.stringify(out, null, 2))
console.log(`\n${Object.keys(out.materials).length}/${Object.keys(SELECTION).length} materiais no manifesto`)
