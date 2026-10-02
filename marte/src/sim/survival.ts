import { BAL } from './balance';
import type { GameState } from './state';
import { globalIrradiance } from '../world/astro';

/** temperatura do ar a 1,5 m em Jezero (MEDA): mín. ≈ -80 °C antes do amanhecer, máx. ≈ -15 °C às 13h30 */
export function marsTemp(h: number, tau = 0.5) {
  const min = -80 + Math.min(20, (tau - 0.5) * 6), max = -15 - Math.min(18, Math.max(0, tau - 0.5) * 5);
  const x = ((h - 5.8 + 24) % 24) / 24;
  const peak = (13.5 - 5.8) / 24;
  const f = x < peak ? Math.sin((x / peak) * Math.PI / 2) : Math.cos(((x - peak) / (1 - peak)) * Math.PI / 2);
  return min + (max - min) * Math.max(0, f);
}

export interface SimContext {
  inHabitat: boolean;
  working: boolean; // andando/coletando
  lampOn: boolean;
  ltst: number;
  sunSinAlt: number;
  solarConst: number;
}

export interface SimOut {
  events: string[];
  suitW: number;
  habGenW: number;
  habLoadW: number;
  outsideT: number;
}

const DIFF = { easy: 0.6, normal: 1, hard: 1.4 };

/** avança a simulação em dtH horas de jogo */
export function simulate(st: GameState, dtH: number, c: SimContext): SimOut {
  const ev: string[] = [];
  const k = DIFF[st.difficulty];
  const T = marsTemp(c.ltst, st.tau);
  const dtSol = dtH / 24.66;
  const prev = { o2: st.suit.o2 / BAL.suitO2Cap, batt: st.suit.batt / BAL.suitBattCap, health: st.suit.health, ho2: st.hab.o2, hw: st.hab.water, hf: st.hab.food, hb: st.hab.batt };

  // ---------------- tempestades
  if (!st.storm && st.sol >= st.nextStormSol) {
    const peak = 2.4 + ((st.nextStormSol * 997) % 1) * 1.8;
    st.storm = { active: true, peakTau: peak, startSol: st.sol, endSol: st.sol + 2.2 };
    ev.push('storm_start');
  }
  let targetTau = 0.5 + 0.08 * Math.sin((st.sol % 1) * Math.PI * 2);
  if (st.storm) {
    const s = st.storm;
    const t = (st.sol - s.startSol) / (s.endSol - s.startSol);
    if (t >= 1) { st.storm = null; st.nextStormSol = st.sol + 4.5 + ((st.sol * 131) % 1) * 2.5; ev.push('storm_end'); }
    else targetTau = 0.5 + (s.peakTau - 0.5) * Math.min(1, t / 0.2) * Math.min(1, (1 - t) / 0.45);
  }
  st.tau += (targetTau - st.tau) * Math.min(1, dtH * 0.8);

  // ---------------- habitat (energia e recursos)
  let gen = 0, load = 0;
  const hab = st.buildings.some((b) => b.type === 'habitat');
  if (hab) {
    const G = globalIrradiance(c.solarConst, st.tau, c.sunSinAlt);
    for (const b of st.buildings) {
      if (b.type === 'panel') {
        gen += BAL.panelAreaM2 * BAL.panelEff * G * (1 - b.dust);
        b.dust = Math.min(0.9, b.dust + dtSol * (st.storm ? BAL.dustStormPerSol * 3 : BAL.dustPerSol));
      }
    }
    const cold = Math.min(1, Math.max(0, (-10 - T) / 70));
    load += BAL.habBaseLoadW + BAL.habHeaterW * cold;
    const has = (t: string) => st.buildings.filter((b) => b.type === t).length;
    const powered = st.hab.batt > 0.05;
    // MOXIE: CO2 → O2
    const nMox = has('moxie');
    if (nMox && powered) { load += BAL.moxieW * nMox; st.hab.o2 += BAL.moxieKgPerSol * nMox * dtSol; }
    // extrator: gesso → água (energia por kg de água)
    if (has('extractor') && powered && st.hab.gypsum > 0) {
      const kgWater = Math.min(st.hab.gypsum * BAL.gypsumWaterFrac, (BAL.extractorW / 1000) * dtH * BAL.extractorKgWaterPerKWh);
      load += BAL.extractorW;
      st.hab.water += kgWater;
      st.hab.gypsum = Math.max(0, st.hab.gypsum - kgWater / BAL.gypsumWaterFrac);
    }
    // fotobiorreator de espirulina
    const nBio = has('bioreactor');
    if (nBio && powered && st.hab.water > 1) {
      load += BAL.bioreactorW * nBio;
      st.hab.water -= BAL.bioreactorWaterPerSol * nBio * dtSol;
      st.hab.food += BAL.bioreactorRationsPerSol * nBio * dtSol;
    }
    // colônia: módulos residenciais (suporte de vida) e torres de defesa
    load += BAL.residenceW * has('residence') + BAL.turretW * has('turret');
    st.hab.battCap = BAL.habBattCap + BAL.batteryKWh * has('battery');
    st.hab.batt = Math.min(st.hab.battCap, Math.max(0, st.hab.batt + ((gen - load) / 1000) * dtH));
    // consumo do astronauta (água e comida vêm sempre da base)
    st.hab.water = Math.max(0, st.hab.water - BAL.habWaterPerSol * k * dtSol);
    st.hab.food = Math.max(0, st.hab.food - 1 * k * dtSol);
    if (c.inHabitat) st.hab.o2 = Math.max(0, st.hab.o2 - BAL.o2RestKgH * k * dtH);
    else st.hab.o2 = Math.max(0, st.hab.o2 - BAL.o2RestKgH * 0.3 * dtH); // vazamento/purga da eclusa
  }

  // ---------------- traje
  const heater = Math.max(0, -10 - T) * BAL.heaterWPerC;
  const suitW = BAL.suitBaseW + heater + (c.lampOn ? BAL.lampW : 0);
  if (c.inHabitat) {
    // reabastece pela eclusa
    const needO2 = BAL.suitO2Cap - st.suit.o2;
    const give = Math.min(needO2, 3 * dtH, st.hab.o2);
    st.suit.o2 += give; st.hab.o2 -= give;
    const needWh = BAL.suitBattCap - st.suit.batt;
    const wh = Math.min(needWh, 5000 * dtH, st.hab.batt * 1000);
    st.suit.batt += wh; st.hab.batt -= wh / 1000;
    st.suit.health = Math.min(100, st.suit.health + 6 * dtH * (st.hab.food > 0 && st.hab.water > 0 ? 1 : 0));
  } else {
    st.suit.o2 = Math.max(0, st.suit.o2 - (c.working ? BAL.o2WorkKgH : BAL.o2RestKgH) * k * dtH);
    st.suit.batt = Math.max(0, st.suit.batt - suitW * dtH);
  }
  st.suit.rad += BAL.radSurfaceMsvSol * dtSol * (c.inHabitat ? BAL.radHabitatFactor : 1) * (st.storm ? 0.85 : 1);

  // ---------------- saúde
  let dmg = 0;
  if (st.suit.o2 <= 0 && !c.inHabitat) dmg += BAL.suffocationHpPerMin * 60 * dtH;
  if (st.suit.batt <= 0 && !c.inHabitat && T < -20) dmg += BAL.hypothermiaHpPerMin * 60 * dtH * ((-20 - T) / 40);
  if (hab && st.hab.water <= 0) dmg += 30 * dtSol;
  if (hab && st.hab.food <= 0) dmg += 25 * dtSol;
  if (c.inHabitat && st.hab.o2 <= 0) dmg += 30 * dtH;
  if (st.suit.rad > BAL.radLethal) dmg += 20 * dtSol;
  st.suit.health = Math.max(0, st.suit.health - dmg);

  // ---------------- alertas (histerese por limiar)
  const o2 = st.suit.o2 / BAL.suitO2Cap, batt = st.suit.batt / BAL.suitBattCap;
  if (!c.inHabitat) {
    if (prev.o2 > 0.3 && o2 <= 0.3) ev.push('o2_low');
    if (prev.o2 > 0.15 && o2 <= 0.15) ev.push('o2_crit');
    if (prev.o2 > 0 && o2 <= 0) ev.push('o2_empty');
    if (prev.batt > 0.2 && batt <= 0.2) ev.push('batt_low');
    if (prev.batt > 0 && batt <= 0) ev.push('batt_empty');
  }
  if (prev.health > 30 && st.suit.health <= 30) ev.push('health_low');
  // avisos da base (reserva para menos de ~1,5 sol)
  if (hab) {
    const cap = st.hab.battCap || BAL.habBattCap;
    if (prev.ho2 > BAL.habO2PerSol * 1.5 && st.hab.o2 <= BAL.habO2PerSol * 1.5) ev.push('hab_o2_low');
    if (prev.hw > BAL.habWaterPerSol * 1.5 && st.hab.water <= BAL.habWaterPerSol * 1.5) ev.push('hab_water_low');
    if (prev.hf > 1.5 && st.hab.food <= 1.5) ev.push('hab_food_low');
    if (prev.hb > cap * 0.15 && st.hab.batt <= cap * 0.15) ev.push('hab_power_low');
  }
  if (prev.health > 0 && st.suit.health <= 0) ev.push('dead');
  // a vitória agora é a civilização (sim/colony.ts): a antena chama colonos em vez de um resgate
  return { events: ev, suitW, habGenW: gen, habLoadW: load, outsideT: T };
}
