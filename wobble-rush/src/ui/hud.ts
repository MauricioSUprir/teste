/**
 * In-match HUD.
 *
 * Built from DOM rather than in-canvas text: crisp at any resolution, free to
 * animate, and trivially responsive on phones. During a round it shows only
 * three things - your position, the qualifying count, and the clock - because
 * anything more competes with the thing that matters, which is the course.
 */
import { t } from './i18n';

export interface HudState {
  position: number;
  total: number;
  qualified: number;
  qualifyTarget: number;
  timeLeft: number;
  countdown: number;
  showCountdown: boolean;
  objective: string;
  mapName: string;
  variantName: string;
  checkpoint: number;
  runTime: number;
  personalBest: number;
  showTimer: boolean;
  /** Survival rounds count who is left, not who got through. */
  survival?: boolean;
}

export class Hud {
  readonly root: HTMLElement;
  private posValue: HTMLElement;
  private posTotal: HTMLElement;
  private qualBar: HTMLElement;
  private qualText: HTMLElement;
  private clock: HTMLElement;
  private countdown: HTMLElement;
  private banner: HTMLElement;
  private toastWrap: HTMLElement;
  private timer: HTMLElement;
  private objective: HTMLElement;
  private bannerTimer = 0;
  private lastPosition = 0;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'hud';
    this.root.innerHTML = `
      <div class="hud-top">
        <div class="hud-pos"><span class="hud-pos-value">-</span><span class="hud-pos-total"></span></div>
        <div class="hud-objective"></div>
        <div class="hud-clock">0:00</div>
      </div>
      <div class="hud-qualify">
        <div class="hud-qualify-bar"><i></i></div>
        <div class="hud-qualify-text"></div>
      </div>
      <div class="hud-timer"></div>
      <div class="hud-countdown"></div>
      <div class="hud-banner"></div>
      <div class="hud-toasts"></div>
    `;
    parent.appendChild(this.root);
    this.posValue = this.root.querySelector('.hud-pos-value')!;
    this.posTotal = this.root.querySelector('.hud-pos-total')!;
    this.qualBar = this.root.querySelector('.hud-qualify-bar i')!;
    this.qualText = this.root.querySelector('.hud-qualify-text')!;
    this.clock = this.root.querySelector('.hud-clock')!;
    this.countdown = this.root.querySelector('.hud-countdown')!;
    this.banner = this.root.querySelector('.hud-banner')!;
    this.toastWrap = this.root.querySelector('.hud-toasts')!;
    this.timer = this.root.querySelector('.hud-timer')!;
    this.objective = this.root.querySelector('.hud-objective')!;
  }

  setVisible(v: boolean): void {
    this.root.style.display = v ? '' : 'none';
  }

  update(dt: number, s: HudState): void {
    const ord = ordinal(s.position);
    if (this.posValue.textContent !== ord) {
      this.posValue.textContent = ord;
      // Gaining places should feel good; losing them should be noticed.
      if (s.position < this.lastPosition) this.pulse(this.posValue, 'up');
      else if (s.position > this.lastPosition && this.lastPosition > 0) this.pulse(this.posValue, 'down');
      this.lastPosition = s.position;
    }
    this.posTotal.textContent = `/${s.total}`;
    this.objective.textContent = s.objective;

    const pct = s.qualifyTarget > 0 ? Math.min(1, s.qualified / s.qualifyTarget) : 0;
    this.qualBar.style.width = `${pct * 100}%`;
    this.qualText.textContent = s.survival
      ? t('hud.survivors', { n: s.qualified, total: s.qualifyTarget })
      : t('hud.qualified', { n: s.qualified, total: s.qualifyTarget });

    const mins = Math.floor(Math.max(0, s.timeLeft) / 60);
    const secs = Math.floor(Math.max(0, s.timeLeft) % 60);
    this.clock.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    this.clock.classList.toggle('urgent', s.timeLeft <= 15);

    if (s.showTimer) {
      const delta = s.personalBest > 0 ? s.runTime - s.personalBest : 0;
      this.timer.style.display = '';
      this.timer.innerHTML = `<b>${fmtTime(s.runTime)}</b>` +
        (s.personalBest > 0
          ? `<span class="${delta <= 0 ? 'ahead' : 'behind'}">${delta <= 0 ? '-' : '+'}${fmtTime(Math.abs(delta))}</span>`
          : '');
    } else {
      this.timer.style.display = 'none';
    }

    if (s.showCountdown) {
      const n = Math.ceil(s.countdown);
      const label = n <= 0 ? t('hud.go') : String(n);
      if (this.countdown.textContent !== label) {
        this.countdown.textContent = label;
        this.countdown.classList.remove('pop');
        void this.countdown.offsetWidth;
        this.countdown.classList.add('pop');
      }
      this.countdown.style.display = '';
    } else {
      this.countdown.style.display = 'none';
      this.countdown.textContent = '';
    }

    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.banner.classList.remove('show');
    }
  }

  private pulse(el: HTMLElement, dir: 'up' | 'down'): void {
    el.classList.remove('pulse-up', 'pulse-down');
    void el.offsetWidth;
    el.classList.add(dir === 'up' ? 'pulse-up' : 'pulse-down');
  }

  /** Big centred warning, used by Round Director telegraphs. */
  showBanner(text: string, sub = '', duration = 3): void {
    this.banner.innerHTML = `<b>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
    this.banner.classList.add('show');
    this.bannerTimer = duration;
  }

  /** Small transient message: checkpoint reached, record beaten, etc. */
  toast(text: string, kind: 'info' | 'good' | 'bad' = 'info'): void {
    const el = document.createElement('div');
    el.className = `hud-toast ${kind}`;
    el.textContent = text;
    this.toastWrap.appendChild(el);
    setTimeout(() => el.classList.add('out'), 1700);
    setTimeout(() => el.remove(), 2300);
  }
}

export function ordinal(n: number): string {
  if (n <= 0) return '-';
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0
    ? `${m}:${s.toFixed(2).padStart(5, '0')}`
    : s.toFixed(2);
}
