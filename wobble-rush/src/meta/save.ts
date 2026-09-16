/**
 * Save data and progression.
 *
 * Versioned from day one and merged field-by-field on load, so adding fields in
 * a later update never wipes a player's account - the expansion roadmap assumes
 * years of new systems landing on top of this.
 */
import { clamp } from '../shared/math';

export const SAVE_VERSION = 1;
const KEY = 'wobble-rush.save.v1';

export interface MapRecord {
  bestTime: number;
  runs: number;
  finishes: number;
  falls: number;
  /** Mastery flags: noFall, underTarget, allCheckpoints... */
  mastery: string[];
}

export interface SaveData {
  version: number;
  playerName: string;
  createdAt: number;
  look: { skin: number; accent: number };
  /** Account-wide progression (never resets between seasons). */
  xp: number;
  level: number;
  coins: number;
  /** Lifetime prestige stats. */
  stats: {
    matches: number;
    wins: number;
    finals: number;
    qualifies: number;
    falls: number;
    checkpoints: number;
    dives: number;
    playTime: number;
    bestPosition: number;
  };
  records: Record<string, MapRecord>;
  settings: {
    quality: 'low' | 'medium' | 'high' | 'ultra' | 'auto';
    /** Set once the player picks a quality themselves - stops mobile defaults. */
    qualityTouched: boolean;
    master: number;
    music: number;
    sfx: number;
    sensitivity: number;
    invertY: boolean;
    shake: number;
    showTimer: boolean;
    language: string;
    reducedMotion: boolean;
    highContrast: boolean;
    uiScale: number;
  };
  /** Unlocked cosmetics by id. */
  unlocked: string[];
  seenTutorial: boolean;
}

function defaults(): SaveData {
  return {
    version: SAVE_VERSION,
    playerName: '',
    createdAt: Date.now(),
    look: { skin: 0xff7a5c, accent: 0x3ddad0 },
    xp: 0,
    level: 1,
    coins: 0,
    stats: {
      matches: 0, wins: 0, finals: 0, qualifies: 0, falls: 0,
      checkpoints: 0, dives: 0, playTime: 0, bestPosition: 0,
    },
    records: {},
    settings: {
      quality: 'auto',
      qualityTouched: false,
      master: 0.85, music: 0.5, sfx: 0.85,
      sensitivity: 1, invertY: false, shake: 1,
      showTimer: false, language: '', reducedMotion: false,
      highContrast: false, uiScale: 1,
    },
    unlocked: ['skin.default'],
    seenTutorial: false,
  };
}

/** XP needed to go from `level` to the next one - gentle early, steady later. */
export function xpForLevel(level: number): number {
  return Math.round(180 + level * 95 + Math.pow(level, 1.55) * 12);
}

export class SaveManager {
  data: SaveData = defaults();
  private dirty = false;
  private saveTimer = 0;

  load(): SaveData {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SaveData>;
        this.data = mergeDeep(defaults(), parsed) as SaveData;
        this.data.version = SAVE_VERSION;
      }
    } catch {
      // Corrupt or blocked storage is never fatal - play with a fresh profile.
      this.data = defaults();
    }
    return this.data;
  }

  save(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
      this.dirty = false;
    } catch {
      /* storage may be full or disabled; losing progress is better than crashing */
    }
  }

  markDirty(): void { this.dirty = true; }

  /** Debounced autosave, called from the frame loop. */
  tick(dt: number): void {
    if (!this.dirty) return;
    this.saveTimer += dt;
    if (this.saveTimer > 1.5) { this.saveTimer = 0; this.save(); }
  }

  /** Awards XP and returns how many levels were gained. */
  addXp(amount: number): number {
    this.data.xp += Math.max(0, Math.round(amount));
    let gained = 0;
    let need = xpForLevel(this.data.level);
    while (this.data.xp >= need) {
      this.data.xp -= need;
      this.data.level++;
      gained++;
      need = xpForLevel(this.data.level);
    }
    this.markDirty();
    return gained;
  }

  addCoins(n: number): void {
    this.data.coins = Math.max(0, this.data.coins + Math.round(n));
    this.markDirty();
  }

  recordFor(mapId: string): MapRecord {
    let r = this.data.records[mapId];
    if (!r) {
      r = { bestTime: 0, runs: 0, finishes: 0, falls: 0, mastery: [] };
      this.data.records[mapId] = r;
    }
    return r;
  }

  /** Returns true when this run set a new personal best. */
  submitRun(mapId: string, time: number, finished: boolean, falls: number): boolean {
    const r = this.recordFor(mapId);
    r.runs++;
    r.falls += falls;
    let record = false;
    if (finished) {
      r.finishes++;
      if (time > 0 && (r.bestTime === 0 || time < r.bestTime)) {
        r.bestTime = time;
        record = true;
      }
      if (falls === 0 && !r.mastery.includes('noFall')) r.mastery.push('noFall');
    }
    this.markDirty();
    return record;
  }

  reset(): void {
    this.data = defaults();
    this.save();
  }
}

function mergeDeep<T>(base: T, patch: unknown): T {
  if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) {
    return (patch === undefined ? base : patch) as T;
  }
  const out = { ...(base as object) } as Record<string, unknown>;
  for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
    if (k in out && typeof out[k] === 'object' && out[k] !== null && !Array.isArray(out[k])) {
      out[k] = mergeDeep(out[k], v);
    } else if (v !== undefined) {
      out[k] = v;
    }
  }
  return out as T;
}

export const saveManager = new SaveManager();
export { clamp };
