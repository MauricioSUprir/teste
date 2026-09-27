import { pt } from '../locales/pt';
import { en } from '../locales/en';
import { es } from '../locales/es';
import { fr } from '../locales/fr';

export type Dict = typeof pt;
export type Key = keyof Dict;
export type Lang = 'pt' | 'en' | 'es' | 'fr';
const dicts: Record<Lang, Record<Key, string>> = { pt, en, es, fr };
export const LANGS: { id: Lang; name: string }[] = [
  { id: 'pt', name: 'Português' },
  { id: 'en', name: 'English' },
  { id: 'es', name: 'Español' },
  { id: 'fr', name: 'Français' },
];

let lang: Lang = detect();
const listeners = new Set<() => void>();

function detect(): Lang {
  try {
    const s = localStorage.getItem('ares.lang') as Lang | null;
    if (s && s in dicts) return s;
  } catch { /* ignore */ }
  const n = (navigator.language || 'pt').slice(0, 2) as Lang;
  return n in dicts ? n : 'pt';
}

export function getLang() { return lang; }
export function setLang(l: Lang) {
  lang = l;
  try { localStorage.setItem('ares.lang', l); } catch { /* ignore */ }
  document.documentElement.lang = l;
  listeners.forEach((f) => f());
}
export function onLang(f: () => void) { listeners.add(f); return () => listeners.delete(f); }

export function t(key: Key, vars?: Record<string, string | number>): string {
  let s = dicts[lang][key] ?? pt[key] ?? String(key);
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

/** aplica traduções a elementos com data-i18n */
export function translateDom(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n as Key); });
}
