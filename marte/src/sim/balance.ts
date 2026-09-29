// Balanceamento (horas de JOGO; 1 sol = 40 min reais por padrão).
// Baseado em dados reais com ajustes de jogabilidade explicitados.
export const BAL = {
  realMinPerSol: 40,
  // traje (EVA)
  suitO2Cap: 0.75, // kg — ~9 h de EVA (≈14 min reais trabalhando)
  o2RestKgH: 0.035, // kg/h em repouso (NASA)
  o2WorkKgH: 0.085, // kg/h caminhando/trabalhando
  suitBattCap: 1400, // Wh
  suitBaseW: 85, // suporte de vida + rádio + ventilação
  lampW: 12,
  heaterWPerC: 1.2, // W por °C abaixo de -10 °C
  // saúde
  suffocationHpPerMin: 7, // por minuto de JOGO sem O2 (≈14 min de jogo ≈ 23 s reais)
  hypothermiaHpPerMin: 1.2,
  radLethal: 1000, // mSv (doença aguda ~1 Sv)
  radSurfaceMsvSol: 0.67,
  radHabitatFactor: 0.35,
  fallSafe: 4.5, // m/s de impacto sem dano (≈ 2,7 m de queda em Marte)
  fallDamagePerMs: 18,
  // habitat
  habO2Start: 5.0, // kg
  habWaterStart: 15, // kg
  habFoodStart: 7, // rações (1 por sol)
  habO2PerSol: 0.84,
  habWaterPerSol: 1.5, // perda líquida após reciclagem
  habBaseLoadW: 90, // suporte de vida (ventilação, CO2, controle)
  habHeaterW: 120, // noite (proporcional ao frio; habitat coberto de regolito)
  habBattStart: 10, // kWh
  habBattCap: 10,
  // produção
  panelAreaM2: 5,
  panelEff: 0.22,
  dustPerSol: 0.002,
  dustStormPerSol: 0.06, // uma tempestade tira ~40% dos painéis → limpar importa
  batteryKWh: 10,
  moxieKgPerSol: 1.0,
  moxieW: 150, // [compromisso de jogo: MOXIE-XL ~4× a produção real por watt]
  extractorW: 500,
  extractorKgWaterPerKWh: 0.8, // desidratação de gesso a ~150 °C
  gypsumWaterFrac: 0.2, // CaSO4·2H2O ≈ 20,9 % de água
  bioreactorW: 100,
  bioreactorWaterPerSol: 1.0,
  bioreactorRationsPerSol: 1.0,
  // coleta
  gypsumPerHarvest: 5, // kg por coleta
  buildRadius: 40, // m do habitat
  rescueSols: 3, // igual à fala do rádio ("três sóis")
};

export type ItemId = 'scrap' | 'electronics' | 'gypsum' | 'culture' | 'kit_habitat' | 'kit_panel' | 'ration';
export type BuildId = 'habitat' | 'panel' | 'battery' | 'moxie' | 'extractor' | 'bioreactor';

export const COSTS: Record<BuildId, Partial<Record<ItemId, number>>> = {
  habitat: { kit_habitat: 1 },
  panel: { scrap: 4, electronics: 1 },
  battery: { scrap: 3, electronics: 3 },
  moxie: { scrap: 6, electronics: 4 },
  extractor: { scrap: 5, electronics: 2 },
  bioreactor: { scrap: 8, electronics: 2, culture: 1 },
};
// o kit de painel solar substitui o custo do primeiro painel
export const ANTENNA_COST: Partial<Record<ItemId, number>> = { scrap: 10, electronics: 6 };
export const ANTENNA_KWH = 2;
