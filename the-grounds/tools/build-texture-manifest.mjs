/**
 * Consulta a API do Poly Haven e gera `src/assets/cdn-manifest.json` com as
 * URLs exatas dos mapas PBR (CC0) usados pelo jogo.
 *
 * Rodar apenas quando a seleção de materiais mudar:
 *   node tools/build-texture-manifest.mjs
 */
import { writeFileSync } from 'node:fs'

/** chave do material no jogo -> asset CC0 do Poly Haven */
/**
 * Seleção enxuta e contemporânea: superfícies limpas, de construção recente.
 * Materiais muito desgastados dão ar de vila antiga europeia, não de cidade
 * brasileira atual — por isso o desgaste entra por variação de cor e por
 * poucos materiais específicos, não como padrão.
 */
const SELECTION = {
  asfalto:          { id: 'asphalt_04',              uvScale: 8.0 },
  asfaltoGasto:     { id: 'asphalt_02',              uvScale: 8.0 },
  calcada:          { id: 'square_concrete_pavers',  uvScale: 3.0 },
  meioFio:          { id: 'concrete_floor_01',       uvScale: 2.4 },
  concreto:         { id: 'concrete_wall_005',       uvScale: 3.0 },
  fachada:          { id: 'white_plaster_02',        uvScale: 3.2 },
  fachadaGasta:     { id: 'plaster_grey_04',         uvScale: 3.0 },
  fachadaPastilha:  { id: 'rectangular_facade_tiles_02', uvScale: 2.2 },
  tijolo:           { id: 'large_red_bricks',        uvScale: 2.6 },
  telha:            { id: 'grey_roof_tiles_02',      uvScale: 1.8 },
  telhaCeramica:    { id: 'ceramic_roof_01',         uvScale: 1.8 },
  grama:            { id: 'leafy_grass',             uvScale: 4.5 },
  terra:            { id: 'dirt_floor',              uvScale: 4.5 },
  madeira:          { id: 'wood_floor',              uvScale: 2.4 },
  madeiraEscura:    { id: 'dark_paneled_wood',       uvScale: 2.0 },
  azulejo:          { id: 'long_white_tiles',        uvScale: 1.4 },
  pisoInterno:      { id: 'large_grey_tiles',        uvScale: 2.6 },
  paralelepipedo:   { id: 'patterned_paving',        uvScale: 3.0 },
  metal:            { id: 'metal_plate',             uvScale: 2.2 },
  metalPintado:     { id: 'painted_metal_shutter',   uvScale: 2.0 },
  vidroPredio:      { id: 'concrete_tile_facade',    uvScale: 3.0 },
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
