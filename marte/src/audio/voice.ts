// Voz da ARES: toca o áudio pré-gravado do idioma atual se existir (manifest), com volume ajustável.
import { getLang } from '../core/i18n';

let manifest: Record<string, string[]> | null = null;
const loading = fetch('./assets/voice/manifest.json').then((r) => (r.ok ? r.json() : {})).then((m) => { manifest = m; }).catch(() => { manifest = {}; });

export class Voice {
  volume = 0.9;
  enabled = true;
  private current: HTMLAudioElement | null = null;
  async play(key: string) {
    await loading;
    if (!this.enabled || !manifest) return;
    const lang = getLang();
    if (!manifest[lang]?.includes(key)) return;
    this.current?.pause();
    const a = new Audio(`./assets/voice/${lang}/${key}.mp3`);
    a.volume = this.volume;
    this.current = a;
    a.play().catch(() => {});
  }
  stop() { this.current?.pause(); this.current = null; }
}
