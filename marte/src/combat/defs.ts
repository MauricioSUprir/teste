// Armas, melhorias e criaturas — números revisados pelos conselheiros (justo no celular, integrado à sobrevivência).
import type { ItemId } from '../sim/balance';

export type WeaponId = 'cutter' | 'pistol' | 'arc';
export type UpgradeId = 'dmg' | 'rate' | 'eff';

export interface WeaponDef {
  id: WeaponId;
  dmg: number;          // dano por acerto
  cooldown: number;     // s entre disparos
  range: number;        // m
  wh: number;           // energia do traje por disparo (Wh)
  melee?: boolean;      // cone curto (cortador)
  chain?: number;       // alvos extras (arco elétrico)
  craft?: Partial<Record<ItemId, number>>;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  // ferramenta de corte do traje: sem custo de energia (nunca deixa o jogador sem defesa)
  cutter: { id: 'cutter', dmg: 25, cooldown: 0.45, range: 2.6, wh: 0, melee: true },
  pistol: { id: 'pistol', dmg: 18, cooldown: 0.3, range: 40, wh: 2.5, craft: { scrap: 6, electronics: 2 } },
  arc: { id: 'arc', dmg: 45, cooldown: 0.9, range: 32, wh: 12, chain: 2, craft: { electronics: 6, chitin: 4 } },
};
export const WEAPON_ORDER: WeaponId[] = ['cutter', 'pistol', 'arc'];

/** +20% por nível (3 níveis) — custo: quitina 3/6/10 + eletrônicos 1/2/3 */
export const UPG_STEP = 0.2;
export const UPG_MAX = 3;
export const upgradeCost = (level: number): Partial<Record<ItemId, number>> => ({ chitin: [3, 6, 10][level] ?? 99, electronics: [1, 2, 3][level] ?? 99 });

/** armas só consomem a bateria do traje até 20%: o aquecimento/suporte de vida nunca fica sem energia */
export const WEAPON_BATT_FLOOR = 0.2;

export interface WeaponsState {
  owned: WeaponId[];
  eq: WeaponId;
  lvl: Record<WeaponId, Record<UpgradeId, number>>;
}
export const newWeapons = (): WeaponsState => ({
  owned: ['cutter'],
  eq: 'cutter',
  lvl: { cutter: { dmg: 0, rate: 0, eff: 0 }, pistol: { dmg: 0, rate: 0, eff: 0 }, arc: { dmg: 0, rate: 0, eff: 0 } },
});

export function weaponStats(w: WeaponId, st: WeaponsState) {
  const d = WEAPONS[w], l = st.lvl[w];
  return {
    ...d,
    dmg: d.dmg * (1 + UPG_STEP * l.dmg),
    cooldown: d.cooldown / (1 + UPG_STEP * l.rate),
    wh: d.wh / (1 + UPG_STEP * l.eff),
  };
}

// ---------- criaturas
export const CRAWLER = {
  hp: 60,
  dmg: 8,
  attackEvery: 2.0,   // s entre botes
  windup: 0.6,        // s de aviso (as manchas brilham e o bicho se ergue)
  lungeRange: 2.2,
  chaseRange: 35,
  speed: 3.1,         // m/s (o jogador corre a 3,4)
  maxAttackers: 2,    // os outros rodeiam a 6 m
  circleR: 6,
  radius: 0.7,        // esfera de acerto
};
export const SPAWN = {
  minDist: 45, maxDist: 70,
  habitatSafe: 60,    // nunca nascem/perseguem perto da base
  cooldownAfterKill: 90,
};
