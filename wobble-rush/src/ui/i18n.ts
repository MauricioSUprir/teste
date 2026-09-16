/**
 * Localisation.
 *
 * No user-facing string is ever written inline in game code - everything goes
 * through a key, so adding a language is a data change. Layouts are built to
 * tolerate strings roughly twice as long as English.
 */
export type LangCode = 'pt-BR' | 'en' | 'es';

type Dict = Record<string, string>;

const EN: Dict = {
  'app.title': 'WOBBLE RUSH',
  'hud.qualified': 'QUALIFIED {n}/{total}',
  'hud.go': 'GO!',
  'hud.objective.race': 'REACH THE FINISH',
  'hud.objective.survive': 'DO NOT FALL',
  'menu.play': 'PLAY',
  'menu.practice': 'PRACTICE',
  'menu.customize': 'CUSTOMIZE',
  'menu.settings': 'SETTINGS',
  'menu.profile': 'PROFILE',
  'menu.quit': 'BACK',
  'match.searching': 'FINDING PLAYERS',
  'match.found': 'PLAYERS FOUND',
  'match.loading': 'LOADING COURSE',
  'round.qualified': 'QUALIFIED!',
  'round.eliminated': 'ELIMINATED',
  'round.finish': 'FINISH',
  'round.photoFinish': 'PHOTO FINISH!',
  'round.checkpoint': 'CHECKPOINT',
  'round.newRecord': 'NEW RECORD!',
  'results.title': 'RESULTS',
  'results.playAgain': 'PLAY AGAIN',
  'results.menu': 'MAIN MENU',
  'results.spectate': 'WATCH',
  'map.sky_foundry.name': 'SKY FOUNDRY',
  'variant.standard': 'STANDARD RUN',
  'variant.standard.desc': 'All routes open',
  'variant.gauntlet': 'GAUNTLET',
  'variant.gauntlet.desc': 'Left bridge sealed, heavy machinery online',
  'variant.highroad': 'HIGH ROAD',
  'variant.highroad.desc': 'Upper catwalk open, shortcut closed',
  'variant.overdrive': 'OVERDRIVE',
  'variant.overdrive.desc': 'Every route open, everything faster',
  'phase.surge': 'PRESSURE SURGE',
  'phase.surge.sub': 'Machinery speeding up',
  'phase.collapse': 'SECTOR COLLAPSE',
  'phase.collapse.sub': 'The glass path is failing',
  'phase.blackout': 'BLACKOUT',
  'phase.blackout.sub': 'Emergency power only',
  'settings.graphics': 'GRAPHICS',
  'settings.audio': 'AUDIO',
  'settings.controls': 'CONTROLS',
  'settings.accessibility': 'ACCESSIBILITY',
  'common.back': 'BACK',
  'common.on': 'ON',
  'common.off': 'OFF',
};

const PT: Dict = {
  'app.title': 'WOBBLE RUSH',
  'hud.qualified': 'CLASSIFICADOS {n}/{total}',
  'hud.go': 'JÁ!',
  'hud.objective.race': 'CHEGUE AO FIM',
  'hud.objective.survive': 'NÃO CAIA',
  'menu.play': 'JOGAR',
  'menu.practice': 'TREINO',
  'menu.customize': 'PERSONALIZAR',
  'menu.settings': 'AJUSTES',
  'menu.profile': 'PERFIL',
  'menu.quit': 'VOLTAR',
  'match.searching': 'PROCURANDO JOGADORES',
  'match.found': 'JOGADORES ENCONTRADOS',
  'match.loading': 'CARREGANDO PISTA',
  'round.qualified': 'CLASSIFICADO!',
  'round.eliminated': 'ELIMINADO',
  'round.finish': 'CHEGADA',
  'round.photoFinish': 'CHEGADA APERTADA!',
  'round.checkpoint': 'CHECKPOINT',
  'round.newRecord': 'NOVO RECORDE!',
  'results.title': 'RESULTADOS',
  'results.playAgain': 'JOGAR DE NOVO',
  'results.menu': 'MENU PRINCIPAL',
  'results.spectate': 'ASSISTIR',
  'map.sky_foundry.name': 'FUNDIÇÃO CELESTE',
  'variant.standard': 'PERCURSO PADRÃO',
  'variant.standard.desc': 'Todas as rotas abertas',
  'variant.gauntlet': 'CORREDOR POLONÊS',
  'variant.gauntlet.desc': 'Ponte esquerda fechada, maquinário pesado ligado',
  'variant.highroad': 'VIA ELEVADA',
  'variant.highroad.desc': 'Passarela superior aberta, atalho fechado',
  'variant.overdrive': 'SOBRECARGA',
  'variant.overdrive.desc': 'Todas as rotas abertas, tudo mais rápido',
  'phase.surge': 'PICO DE PRESSÃO',
  'phase.surge.sub': 'O maquinário está acelerando',
  'phase.collapse': 'COLAPSO DO SETOR',
  'phase.collapse.sub': 'O caminho de vidro está cedendo',
  'phase.blackout': 'APAGÃO',
  'phase.blackout.sub': 'Somente energia de emergência',
  'settings.graphics': 'GRÁFICOS',
  'settings.audio': 'ÁUDIO',
  'settings.controls': 'CONTROLES',
  'settings.accessibility': 'ACESSIBILIDADE',
  'common.back': 'VOLTAR',
  'common.on': 'LIGADO',
  'common.off': 'DESLIGADO',
};

const ES: Dict = {
  ...EN,
  'hud.qualified': 'CLASIFICADOS {n}/{total}',
  'hud.go': '¡YA!',
  'menu.play': 'JUGAR',
  'menu.practice': 'PRÁCTICA',
  'menu.customize': 'PERSONALIZAR',
  'menu.settings': 'AJUSTES',
  'round.qualified': '¡CLASIFICADO!',
  'round.eliminated': 'ELIMINADO',
  'map.sky_foundry.name': 'FUNDICIÓN CELESTE',
};

const DICTS: Record<LangCode, Dict> = { 'pt-BR': PT, en: EN, es: ES };

let current: LangCode = (() => {
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'en';
  if (nav.startsWith('pt')) return 'pt-BR';
  if (nav.startsWith('es')) return 'es';
  return 'en';
})();

export function setLanguage(lang: LangCode): void { current = lang; }
export function getLanguage(): LangCode { return current; }

/** Looks up a key, falling back to English and then to the key itself. */
export function t(key: string, params?: Record<string, string | number>): string {
  const dict = DICTS[current] ?? EN;
  let s = dict[key] ?? EN[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) s = s.replace(`{${k}}`, String(v));
  }
  return s;
}
