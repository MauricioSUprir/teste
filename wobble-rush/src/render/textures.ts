/**
 * Procedural textures.
 *
 * Every texture in the game is painted into a canvas at runtime: no downloads,
 * no licensing, and any colour can be re-tinted per map or per season. They are
 * cached by their parameters so a hundred props share one GPU texture.
 *
 * Keep them *readable*: this is a competitive platformer, so surface detail
 * exists to tell you what a surface does, never to look busy.
 */
import * as THREE from 'three';

const cache = new Map<string, THREE.Texture>();
const SIZE = 256;

function canvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = SIZE; c.height = SIZE;
  return [c, c.getContext('2d')!];
}

function finish(c: HTMLCanvasElement, key: string): THREE.Texture {
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  cache.set(key, tex);
  return tex;
}

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

/** Mixes two colours; t=0 returns a, t=1 returns b. */
function mix(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * t) << 16) |
         (Math.round(ag + (bg - ag) * t) << 8) |
         Math.round(ab + (bb - ab) * t);
}

/** Floor panels: a tile grid with recessed grooves and a corner accent. */
export function panelTexture(base: number, accent: number): THREE.Texture {
  const key = `panel:${base}:${accent}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [c, g] = canvas();
  g.fillStyle = hex(base);
  g.fillRect(0, 0, SIZE, SIZE);

  // Subtle two-tone checker so large floors do not read as one flat sheet.
  g.fillStyle = hex(mix(base, 0xffffff, 0.06));
  g.fillRect(0, 0, SIZE / 2, SIZE / 2);
  g.fillRect(SIZE / 2, SIZE / 2, SIZE / 2, SIZE / 2);

  // Grooves between panels.
  g.strokeStyle = hex(mix(base, 0x000000, 0.28));
  g.lineWidth = 5;
  g.strokeRect(0, 0, SIZE, SIZE);
  g.beginPath();
  g.moveTo(SIZE / 2, 0); g.lineTo(SIZE / 2, SIZE);
  g.moveTo(0, SIZE / 2); g.lineTo(SIZE, SIZE / 2);
  g.stroke();

  // Accent corner marks - they make direction legible when you are spinning.
  g.fillStyle = hex(accent);
  for (const [x, y] of [[18, 18], [SIZE / 2 + 18, SIZE / 2 + 18]]) {
    g.fillRect(x, y, 26, 7);
    g.fillRect(x, y, 7, 26);
  }
  return finish(c, key);
}

/** Metal plate with rivets. */
export function plateTexture(base: number): THREE.Texture {
  const key = `plate:${base}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [c, g] = canvas();
  g.fillStyle = hex(base);
  g.fillRect(0, 0, SIZE, SIZE);
  g.strokeStyle = hex(mix(base, 0x000000, 0.3));
  g.lineWidth = 4;
  g.strokeRect(2, 2, SIZE - 4, SIZE - 4);
  g.fillStyle = hex(mix(base, 0xffffff, 0.22));
  for (const x of [22, SIZE - 22]) {
    for (const y of [22, SIZE - 22]) {
      g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fill();
    }
  }
  g.fillStyle = hex(mix(base, 0x000000, 0.12));
  g.fillRect(0, SIZE * 0.46, SIZE, 10);
  return finish(c, key);
}

/** Diagonal caution stripes - the universal "this will hurt" signal. */
export function hazardTexture(a: number, b: number): THREE.Texture {
  const key = `hazard:${a}:${b}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [c, g] = canvas();
  g.fillStyle = hex(mix(a, 0xffffff, 0.12));
  g.fillRect(0, 0, SIZE, SIZE);
  // Thin stripes: thick ones turn a bright hazard into a black brick.
  g.strokeStyle = hex(b);
  g.lineWidth = 15;
  for (let i = -SIZE; i < SIZE * 2; i += 56) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i + SIZE, SIZE); g.stroke();
  }
  return finish(c, key);
}

/** Perforated grate: reads as "you can see through this, it is a walkway". */
export function grateTexture(base: number): THREE.Texture {
  const key = `grate:${base}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [c, g] = canvas();
  g.fillStyle = hex(base);
  g.fillRect(0, 0, SIZE, SIZE);
  g.fillStyle = hex(mix(base, 0x000000, 0.45));
  const step = SIZE / 8;
  for (let x = 0; x < 8; x++) {
    for (let y = 0; y < 8; y++) {
      g.beginPath();
      g.arc(x * step + step / 2, y * step + step / 2, step * 0.26, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.strokeStyle = hex(mix(base, 0xffffff, 0.15));
  g.lineWidth = 3;
  g.strokeRect(0, 0, SIZE, SIZE);
  return finish(c, key);
}

/** Soft dots for rubber/padded surfaces. */
export function rubberTexture(base: number): THREE.Texture {
  const key = `rubber:${base}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [c, g] = canvas();
  g.fillStyle = hex(base);
  g.fillRect(0, 0, SIZE, SIZE);
  g.fillStyle = hex(mix(base, 0x000000, 0.16));
  const step = SIZE / 6;
  for (let x = 0; x < 6; x++) {
    for (let y = 0; y < 6; y++) {
      const ox = (y % 2) * step * 0.5;
      g.beginPath();
      g.arc(x * step + step / 2 + ox, y * step + step / 2, step * 0.2, 0, Math.PI * 2);
      g.fill();
    }
  }
  return finish(c, key);
}

/** Glass: faint diagonal sheen, mostly transparent in the material. */
export function glassTexture(base: number): THREE.Texture {
  const key = `glass:${base}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [c, g] = canvas();
  g.fillStyle = hex(base);
  g.fillRect(0, 0, SIZE, SIZE);
  g.strokeStyle = 'rgba(255,255,255,0.45)';
  g.lineWidth = 12;
  g.beginPath(); g.moveTo(-40, SIZE); g.lineTo(SIZE, -40); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.22)';
  g.lineWidth = 6;
  g.beginPath(); g.moveTo(40, SIZE); g.lineTo(SIZE + 80, -40); g.stroke();
  g.strokeStyle = hex(mix(base, 0xffffff, 0.5));
  g.lineWidth = 8;
  g.strokeRect(0, 0, SIZE, SIZE);
  return finish(c, key);
}

/** Pipes and columns: banded, so rotation is visible. */
export function bandTexture(base: number, band: number): THREE.Texture {
  const key = `band:${base}:${band}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [c, g] = canvas();
  g.fillStyle = hex(base);
  g.fillRect(0, 0, SIZE, SIZE);
  g.fillStyle = hex(band);
  g.fillRect(0, SIZE * 0.08, SIZE, SIZE * 0.1);
  g.fillRect(0, SIZE * 0.72, SIZE, SIZE * 0.1);
  g.fillStyle = hex(mix(base, 0x000000, 0.2));
  g.fillRect(0, SIZE * 0.42, SIZE, 6);
  return finish(c, key);
}

/** Conveyor belt: chevrons that show travel direction at a glance. */
export function beltTexture(base: number, mark: number): THREE.Texture {
  const key = `belt:${base}:${mark}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const [c, g] = canvas();
  g.fillStyle = hex(base);
  g.fillRect(0, 0, SIZE, SIZE);
  g.strokeStyle = hex(mark);
  g.lineWidth = 16;
  g.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const y = i * (SIZE / 3) + 30;
    g.beginPath();
    g.moveTo(SIZE * 0.18, y + 34);
    g.lineTo(SIZE * 0.5, y);
    g.lineTo(SIZE * 0.82, y + 34);
    g.stroke();
  }
  g.fillStyle = hex(mix(base, 0x000000, 0.35));
  g.fillRect(0, 0, 10, SIZE);
  g.fillRect(SIZE - 10, 0, 10, SIZE);
  return finish(c, key);
}

export function disposeTextures(): void {
  for (const t of cache.values()) t.dispose();
  cache.clear();
}

export { mix };
