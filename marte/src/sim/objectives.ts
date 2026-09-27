import type { GameState } from './state';
import type { Key } from '../core/i18n';

export interface Objective {
  key: Key; // texto do objetivo
  voice: Key; // fala da ARES ao iniciar
  done: (st: GameState) => boolean;
  target?: (st: GameState, w: ObjWorld) => { x: number; z: number } | null;
}
export interface ObjWorld {
  crate0: { x: number; z: number };
  door: { x: number; z: number } | null;
  site: (id: string) => { x: number; z: number };
  antenna: { x: number; z: number };
}

const count = (st: GameState, t: string) => st.buildings.filter((b) => b.type === t).length;

export const OBJECTIVES: Objective[] = [
  { key: 'obj_crate', voice: 'vo_intro', done: (s) => s.looted.includes('crate0'), target: (_s, w) => w.crate0 },
  { key: 'obj_habitat', voice: 'vo_habitat', done: (s) => count(s, 'habitat') > 0 },
  { key: 'obj_enter', voice: 'vo_enter', done: (s) => !!s.flags.enteredHab, target: (_s, w) => w.door },
  { key: 'obj_panel', voice: 'vo_panel', done: (s) => count(s, 'panel') > 0 },
  { key: 'obj_scrap', voice: 'vo_scrap', done: (s) => s.inv.scrap + s.stats.built * 3 >= 10 && s.inv.electronics >= 3, target: (_s, w) => w.site('crash') },
  { key: 'obj_battery', voice: 'vo_battery', done: (s) => count(s, 'battery') > 0 },
  { key: 'obj_moxie', voice: 'vo_moxie', done: (s) => count(s, 'moxie') > 0, target: (_s, w) => w.site('shield') },
  { key: 'obj_gypsum', voice: 'vo_gypsum', done: (s) => s.inv.gypsum + s.hab.gypsum >= 10 || count(s, 'extractor') > 0, target: (_s, w) => w.site('gypsum') },
  { key: 'obj_extractor', voice: 'vo_extractor', done: (s) => count(s, 'extractor') > 0 },
  { key: 'obj_bioreactor', voice: 'vo_bioreactor', done: (s) => count(s, 'bioreactor') > 0, target: (_s, w) => w.site('chute') },
  { key: 'obj_explore', voice: 'vo_explore', done: (s) => s.inv.electronics >= 6 && s.inv.scrap >= 10, target: (_s, w) => w.site('cruise') },
  { key: 'obj_antenna', voice: 'vo_antenna', done: (s) => s.antennaFixedSol !== null, target: (_s, w) => w.antenna },
  { key: 'obj_rescue', voice: 'vo_rescue', done: (s) => !!s.flags.won },
];
