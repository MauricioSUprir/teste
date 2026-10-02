// Civilização: a antena chama colonos da Terra. Cada nave só desce quando a colônia está pronta
// (camas, oxigênio, comida, energia e defesa); se faltar algo, espera em órbita sem punição.
// População: Posto avançado (1) → Base (4) → Vila (10) → Civilização (20).
import { BAL } from './balance';
import type { GameState } from './state';

export interface ColonyState {
  pop: number;
  ships: number;              // naves que já pousaram
  nextSol: number | null;     // a partir de quando a próxima nave pode descer
  landing: number;            // >0: nave descendo agora (s restantes do roteiro)
  raidSol: number;            // último sol com ataque à colônia
}
export const newColony = (): ColonyState => ({ pop: 1, ships: 0, nextSol: null, landing: 0, raidSol: 0 });

export const SHIPS = [3, 6, 10];
export const SHIP_CARGO = { scrap: 8, electronics: 4, ration: 3 };
export const LEVELS = [
  { pop: 1, key: 'lvl_outpost' }, { pop: 4, key: 'lvl_base' }, { pop: 10, key: 'lvl_village' }, { pop: 20, key: 'lvl_civ' },
] as const;
export const CIV_POP = 20;

export function level(pop: number) { let l: (typeof LEVELS)[number] = LEVELS[0]; for (const x of LEVELS) if (pop >= x.pop) l = x; return l; }
export function nextTarget(pop: number) { return LEVELS.find((x) => x.pop > pop)?.pop ?? CIV_POP; }

const count = (st: GameState, t: string) => st.buildings.filter((b) => b.type === t).length;

export interface Req { key: string; have: number; need: number; ok: boolean }
/** requisitos para a nave k (0, 1, 2) */
export function requirements(st: GameState, k: number): Req[] {
  const n = SHIPS[k] ?? 0, after = (st.colony?.pop ?? 1) + n;
  const beds = 1 + BAL.bedsPerResidence * count(st, 'residence');
  const r = (key: string, have: number, need: number): Req => ({ key, have, need, ok: have >= need });
  return [
    r('req_beds', beds, after),
    r('req_o2', count(st, 'moxie'), Math.ceil(after / 6)),
    r('req_food', count(st, 'bioreactor'), Math.ceil(after / 8)),
    r('req_power', count(st, 'panel'), 3 + 2 * k),
    r('req_def', count(st, 'turret'), k),
  ];
}

/** passo da colônia; devolve eventos para o jogo (fala, pouso, vitória) */
export function colonyTick(st: GameState): ('ship_called' | 'ship_ready' | 'ship_waiting')[] {
  const c = st.colony!;
  const ev: ('ship_called' | 'ship_ready' | 'ship_waiting')[] = [];
  if (st.antennaFixedSol === null && !st.flags.freeplay) return ev;
  if (c.nextSol === null && c.ships === 0) { c.nextSol = (st.antennaFixedSol ?? st.sol) + BAL.rescueSols; ev.push('ship_called'); }
  if (c.landing > 0 || c.ships >= SHIPS.length || c.nextSol === null) return ev;
  if (st.sol < c.nextSol) return ev;
  if (requirements(st, c.ships).every((q) => q.ok)) ev.push('ship_ready');
  else if (!st.flags[`wait${c.ships}`]) { st.flags[`wait${c.ships}`] = true; ev.push('ship_waiting'); }
  return ev;
}

/** a nave tocou o chão: colonos e carga */
export function shipLanded(st: GameState) {
  const c = st.colony!;
  c.pop += SHIPS[c.ships] ?? 0;
  c.ships++;
  c.landing = 0;
  c.nextSol = st.sol + BAL.shipEverySols;
  st.inv.scrap += SHIP_CARGO.scrap; st.inv.electronics += SHIP_CARGO.electronics;
  st.hab.food += SHIP_CARGO.ration;
  if (c.pop >= CIV_POP) st.flags.civ = true;
}
