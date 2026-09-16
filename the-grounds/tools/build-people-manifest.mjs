/**
 * Gera `src/assets/people-manifest.json` com as URLs dos tecidos CC0 do Poly
 * Haven usados nas roupas dos personagens.
 *
 * Pele, cabelo e barba continuam procedurais: não existe varredura CC0 de pele
 * humana no acervo, e usar um tecido no lugar dela fica pior que a procedural.
 *
 *   node tools/build-people-manifest.mjs
 */
import { writeFileSync } from 'node:fs'

/**
 * Cada chave é um tipo de peça de roupa do jogo. `uvScale` é em metros: um
 * tecido de camiseta repete a cada poucos centímetros, muito mais denso que
 * uma parede.
 */
const SELECTION = {
  camiseta:   { id: 'cotton_jersey',     uvScale: 0.16 },
  moletom:    { id: 'knitted_fleece',    uvScale: 0.18 },
  jaqueta:    { id: 'caban',             uvScale: 0.20 },
  camisa:     { id: 'stretch_poplin',    uvScale: 0.14 },
  jeans:      { id: 'denim_fabric_04',   uvScale: 0.20 },
  calcaSocial:{ id: 'poly_wool_herringbone', uvScale: 0.18 },
  veludo:     { id: 'ribbed_corduroy',   uvScale: 0.16 },
  esportivo:  { id: 'jersey_melange',    uvScale: 0.15 },
  agasalho:   { id: 'polar_fleece',      uvScale: 0.18 },
  couro:      { id: 'fabric_leather_01', uvScale: 0.22 },
  linho:      { id: 'rough_linen',       uvScale: 0.15 },
  malhaGrossa:{ id: 'jogging_melange',   uvScale: 0.17 },
}

const MAP_KEYS = { Diffuse: 'map', nor_gl: 'normalMap', Rough: 'roughnessMap' }

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

const out = { generatedAt: new Date().toISOString(), source: 'Poly Haven (CC0)', tecidos: {} }

for (const [key, cfg] of Object.entries(SELECTION)) {
  process.stdout.write(`${key} (${cfg.id}) ... `)
  try {
    const files = await fetchJson(`https://api.polyhaven.com/files/${cfg.id}`)
    const entry = { id: cfg.id, uvScale: cfg.uvScale, credit: `Poly Haven — ${cfg.id} (CC0)`, res: {} }
    // Roupa fica perto da câmera mas ocupa pouca área: 1k basta e é o que
    // mantém a soma de downloads honesta.
    for (const res of ['1k']) {
      const maps = {}
      for (const [phName, matKey] of Object.entries(MAP_KEYS)) {
        const url = pick(files, phName, res)
        if (url) maps[matKey] = url
      }
      if (!maps.normalMap) {
        const alt = pick(files, 'nor_dx', res)
        if (alt) { maps.normalMap = alt; entry.normalIsDirectX = true }
      }
      if (Object.keys(maps).length > 0) entry.res[res] = maps
    }
    if (!entry.res['1k']) throw new Error('sem mapas 1k')
    out.tecidos[key] = entry
    console.log('ok', Object.keys(entry.res['1k']).join(','))
  } catch (e) {
    console.log('FALHOU:', e.message)
  }
}

writeFileSync(new URL('../src/assets/people-manifest.json', import.meta.url), JSON.stringify(out, null, 2))
console.log(`\n${Object.keys(out.tecidos).length}/${Object.keys(SELECTION).length} tecidos no manifesto`)
