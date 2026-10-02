import { BAL, type BuildId, type ItemId } from './balance';
import { newColony, type ColonyState } from './colony';
import { newWeapons, UPG_MAX, WEAPON_ORDER, type WeaponsState } from '../combat/defs';

export const SAVE_VERSION = 2;

export interface Building { id: number; type: BuildId; x: number; z: number; rot: number; dust: number }
export interface GameState {
  version: number;
  difficulty: 'easy' | 'normal' | 'hard';
  sol: number;
  tau: number;
  player: { x: number; y: number; z: number; yaw: number };
  suit: { o2: number; batt: number; health: number; rad: number };
  inv: Record<ItemId, number>;
  hab: { o2: number; water: number; food: number; batt: number; battCap: number; gypsum: number };
  buildings: Building[];
  nextId: number;
  looted: string[]; // ids de pontos de coleta já usados
  objective: number;
  flags: Record<string, boolean>;
  antennaFixedSol: number | null;
  stats: { distance: number; deaths: number; built: number };
  storm: { active: boolean; peakTau: number; startSol: number; endSol: number } | null;
  nextStormSol: number;
  rover: { x: number; z: number; yaw: number; batt: number };
  weapons: WeaponsState;
  stats2?: { kills: number; nests?: number };
  nests?: Record<string, number>;
  colony?: ColonyState; // colmeia destruída → sol da destruição (volta a crescer)
}

export function newState(difficulty: GameState['difficulty'] = 'normal'): GameState {
  return {
    version: SAVE_VERSION,
    difficulty,
    sol: 1 + 7.6 / 24,
    tau: 0.5,
    player: { x: 1, y: 0, z: 3, yaw: 0 },
    suit: { o2: BAL.suitO2Cap * 0.45, batt: BAL.suitBattCap * 0.62, health: 100, rad: 0 },
    inv: { scrap: 0, electronics: 0, gypsum: 0, culture: 0, kit_habitat: 0, kit_panel: 0, ration: 0, chitin: 0, core: 0 },
    hab: { o2: BAL.habO2Start, water: BAL.habWaterStart, food: BAL.habFoodStart, batt: BAL.habBattStart * 0.6, battCap: BAL.habBattCap, gypsum: 0 },
    buildings: [],
    nextId: 1,
    looted: [],
    objective: 0,
    flags: {},
    antennaFixedSol: null,
    stats: { distance: 0, deaths: 0, built: 0 },
    storm: null,
    nextStormSol: 4.4,
    rover: { x: 16, z: -16, yaw: 1.9, batt: 30 },
    colony: newColony(),
    weapons: newWeapons(),
    stats2: { kills: 0 },
  };
}

// ---------- salvamento robusto: versão + checksum + backup
const KEY = 'ares.save.v1';
function checksum(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16);
}

export function save(st: GameState): boolean {
  try {
    const data = JSON.stringify(st);
    const blob = JSON.stringify({ v: SAVE_VERSION, at: Date.now(), sum: checksum(data), data });
    const prev = localStorage.getItem(KEY);
    if (prev) localStorage.setItem(KEY + '.bak', prev);
    localStorage.setItem(KEY, blob);
    return true;
  } catch {
    return false;
  }
}

function parse(raw: string | null): GameState | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw);
    if (checksum(o.data) !== o.sum) return null;
    const st = JSON.parse(o.data) as GameState;
    return migrate(st);
  } catch {
    return null;
  }
}

function migrate(st: GameState): GameState | null {
  if (!st || typeof st !== 'object') return null;
  const base = newState(st.difficulty ?? 'normal');
  // completa campos novos com padrões (robusto a versões futuras/antigas)
  const merged = { ...base, ...st, suit: { ...base.suit, ...st.suit }, inv: { ...base.inv, ...st.inv }, hab: { ...base.hab, ...st.hab }, stats: { ...base.stats, ...st.stats }, flags: { ...st.flags }, rover: { ...base.rover, ...st.rover } };
  // armas (v2): completa e valida níveis
  const w = newWeapons();
  const sw = (st as Partial<GameState>).weapons;
  if (sw) {
    w.owned = Array.isArray(sw.owned) ? sw.owned.filter((x) => WEAPON_ORDER.includes(x)) : w.owned;
    if (!w.owned.includes('cutter')) w.owned.unshift('cutter');
    w.eq = w.owned.includes(sw.eq) ? sw.eq : 'cutter';
    for (const id of WEAPON_ORDER) for (const u of ['dmg', 'rate', 'eff'] as const) w.lvl[id][u] = Math.max(0, Math.min(UPG_MAX, Math.floor(sw.lvl?.[id]?.[u] ?? 0)));
  }
  merged.weapons = w;
  // saves antigos já tinham construção: computador de pulso considerado montado
  // saves de antes do computador de pulso: quem já abriu a 1ª caixa (que não trazia sucata) ganha o computador pronto
  if (merged.buildings.length > 0 || merged.objective > 1 || merged.looted.includes('crate0')) merged.flags.computer = true;
  merged.colony = { ...newColony(), ...((st as Partial<GameState>).colony ?? {}) };
  // saves que já tinham sido "resgatados": agora a antena chama colonos — continuam rumo à civilização
  if (merged.flags.won && merged.colony.pop <= 1 && merged.colony.ships === 0) { merged.flags.won = false; merged.flags.freeplay = true; merged.colony.nextSol = merged.sol + 0.15; }
  merged.nests = { ...((st as Partial<GameState>).nests ?? {}) };
  merged.stats2 = { kills: 0, ...(st as Partial<GameState>).stats2 };
  merged.version = SAVE_VERSION;
  const nums = [merged.sol, merged.player.x, merged.player.z, merged.suit.o2, merged.suit.batt, merged.suit.health];
  if (nums.some((n) => !Number.isFinite(n))) return null;
  return merged;
}

export function load(): GameState | null {
  try {
    return parse(localStorage.getItem(KEY)) ?? parse(localStorage.getItem(KEY + '.bak'));
  } catch {
    return null;
  }
}
export function hasSave() { return load() !== null; }
export function clearSave() { try { localStorage.removeItem(KEY); localStorage.removeItem(KEY + '.bak'); } catch { /* ignore */ } }
