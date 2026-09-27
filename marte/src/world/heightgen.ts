// Geração procedural do relevo inspirado no fundo da cratera Jezero:
// delta sedimentar em camadas a oeste, planície ondulada, crateras (N(>D) ∝ D^-2, prof. 0,2D, borda 0,04D,
// ejecta ∝ (r/R)^-3), cristas eólicas/dunas e a borda da cratera Jezero no horizonte distante.
import { Simplex2, mulberry32, smoothstep } from './noise';
import { WORLD, type Crater, type TerrainData } from './config';

export function makeHeightFn(seed: number) {
  const n1 = new Simplex2(seed);
  const n2 = new Simplex2(seed + 1);
  const n3 = new Simplex2(seed + 2);
  const rnd = mulberry32(seed + 7);

  // ---- crateras (distribuição em lei de potência)
  const craters: Crater[] = [];
  const half = WORLD.size / 2 + 400;
  const Dmin = 4, Dmax = 320;
  let tries = 0;
  const fixed = [
    { x: 260, z: 140, D: 170, age: 0.9 },
    { x: -140, z: -420, D: 110, age: 0.7 },
    { x: 610, z: -120, D: 75, age: 1 },
    { x: 90, z: 520, D: 60, age: 0.8 },
    { x: -250, z: 90, D: 38, age: 1 },
    { x: 120, z: -150, D: 24, age: 1 },
  ];
  for (const f of fixed) craters.push({ x: f.x, z: f.z, r: f.D / 2, depth: 0.2 * f.D * (0.55 + 0.45 * f.age), rim: 0.04 * f.D * (0.5 + 0.5 * f.age), age: f.age });
  while (craters.length < 420 && tries++ < 8000) {
    const u = rnd();
    const D = Dmin / Math.sqrt(1 - u * (1 - (Dmin / Dmax) ** 2)); // CDF inversa de N(>D) ∝ D^-2
    const x = (rnd() * 2 - 1) * half, z = (rnd() * 2 - 1) * half;
    const R = D / 2;
    // mantém a área de pouso (0,0) livre de crateras grandes
    if (Math.hypot(x, z) < 90 + R * 2 && R > 3) continue;
    if (x < -620 && R > 40) continue; // delta
    const age = 0.35 + 0.65 * rnd();
    craters.push({ x, z, r: R, depth: 0.2 * D * (0.55 + 0.45 * age), rim: 0.04 * D * (0.5 + 0.5 * age), age });
  }
  // grade espacial para busca rápida
  const CELL = 64, GN = Math.ceil((half * 2) / CELL) + 1;
  const grid: number[][] = Array.from({ length: GN * GN }, () => []);
  craters.forEach((c, i) => {
    const reach = c.r * 3.2;
    const x0 = Math.floor((c.x - reach + half) / CELL), x1 = Math.floor((c.x + reach + half) / CELL);
    const z0 = Math.floor((c.z - reach + half) / CELL), z1 = Math.floor((c.z + reach + half) / CELL);
    for (let gz = Math.max(0, z0); gz <= Math.min(GN - 1, z1); gz++)
      for (let gx = Math.max(0, x0); gx <= Math.min(GN - 1, x1); gx++) grid[gz * GN + gx].push(i);
  });

  // ---- mesas / buttes (restos de erosão do delta)
  const buttes = [
    { x: -420, z: -260, r: 70, h: 26 },
    { x: -330, z: 380, r: 55, h: 19 },
    { x: 360, z: -470, r: 42, h: 14 },
    { x: 520, z: 300, r: 60, h: 17 },
  ];

  const terrace = (h: number, step: number, k: number) => {
    const t = h / step, f = t - Math.floor(t);
    return (Math.floor(t) + (1 - k) * f + k * smoothstep(0.35, 0.65, f)) * step;
  };

  function height(x: number, z: number, detail = true): number {
    // planície base
    let h = 7 * n1.fbm(x / 700, z / 700, 4) + 2.2 * n2.fbm(x / 170, z / 170, 4);

    // delta sedimentar (oeste) — escarpa com borda irregular e estratos
    const edge = x + 640 + 150 * n3.fbm(z / 520, 3.1, 4) + 14 * n1.noise(z / 110, 7.7);
    const plateau = smoothstep(70, -60, edge);
    if (plateau > 0) {
      let ph = 38 + 6 * n2.fbm(x / 260, z / 260, 3);
      ph = plateau * ph;
      const cut = 1 - smoothstep(0.25, 0.75, Math.abs(n3.ridged(x / 220, z / 220, 3) - 0.7) * 3); // canais erodidos
      ph *= 1 - 0.35 * cut * (1 - smoothstep(0.9, 1, plateau));
      h += terrace(ph, 5.5, 0.55 * smoothstep(0.02, 0.4, plateau) * (1 - smoothstep(0.92, 1, plateau)));
    }
    // buttes
    for (const b of buttes) {
      const d = Math.hypot(x - b.x, z - b.z) + 9 * n1.noise(x / 75, z / 75);
      const m = smoothstep(b.r + 22, b.r - 10, d);
      if (m > 0) h += terrace(b.h * m, 4.5, 0.6 * (1 - smoothstep(0.92, 1, m)));
    }

    // cristas eólicas transversais (TARs) / dunas em faixas
    const duneMask = smoothstep(0.15, 0.45, n2.fbm(x / 500 + 11, z / 500 - 4, 3)) * (1 - plateau);
    if (duneMask > 0) {
      const w = 0.6; // direção do vento
      const s = (x * Math.cos(w) + z * Math.sin(w)) / 13 + 1.2 * n1.fbm(x / 160, z / 160, 2);
      const crest = Math.pow(1 - Math.abs(Math.sin(s)), 2.2);
      h += duneMask * (1.4 * crest + 0.6 * n3.fbm(x / 35, z / 35, 2));
    }

    // crateras
    const gx = Math.floor((x + half) / CELL), gz = Math.floor((z + half) / CELL);
    if (gx >= 0 && gz >= 0 && gx < GN && gz < GN) {
      for (const i of grid[gz * GN + gx]) {
        const c = craters[i];
        const d = Math.hypot(x - c.x, z - c.z);
        const warp = 1 + 0.035 * n1.noise((x - c.x) / (c.r * 1.3) + i * 3.7, (z - c.z) / (c.r * 1.3));
        const r = (d / c.r) * warp;
        if (r > 3.2) continue;
        const inner = -c.depth + (c.depth + c.rim) * Math.pow(r, 2.0 + c.age);
        const outer = c.rim * Math.pow(Math.max(r, 1), -3) * (1 - smoothstep(2.4, 3.2, r));
        const k = smoothstep(0.92, 1.08, r);
        const prof = inner * (1 - k) + outer * k;
        h += prof * (0.55 + 0.45 * c.age);
      }
    }

    // borda distante da cratera Jezero (45 km de diâmetro) — horizonte montanhoso
    const dist = Math.hypot(x, z);
    if (dist > 1800) {
      const ang = Math.atan2(z, x);
      const rim = smoothstep(1800, 9000, dist) * (320 + 480 * (0.5 + 0.5 * Math.sin(ang * 2.0 + 1.3)));
      h += rim * (0.55 + 0.45 * n1.ridged(x / 1600, z / 1600, 5)) + 30 * n2.fbm(x / 900, z / 900, 4) * smoothstep(2500, 5000, dist);
    }

    if (detail) h += 0.22 * n3.fbm(x / 7, z / 7, 3) + 0.08 * n1.noise(x / 2.3, z / 2.3);
    return h;
  }

  return { height, craters };
}

export function generateRows(seed: number, j0: number, j1: number, withFar: boolean) {
  const { height, craters } = makeHeightFn(seed);
  const { res, size, farRes, farSize } = WORLD;
  const heights = new Float32Array((j1 - j0) * res);
  const step = size / (res - 1);
  for (let j = j0; j < j1; j++) {
    const z = -size / 2 + j * step;
    const o = (j - j0) * res;
    for (let i = 0; i < res; i++) heights[o + i] = height(-size / 2 + i * step, z);
  }
  let far: Float32Array | null = null;
  if (withFar) {
    far = new Float32Array(farRes * farRes);
    const fstep = farSize / (farRes - 1);
    for (let j = 0; j < farRes; j++)
      for (let i = 0; i < farRes; i++) far[j * farRes + i] = height(-farSize / 2 + i * fstep, -farSize / 2 + j * fstep, false);
  }
  return { heights, far, craters };
}

export function generateTerrain(seed = WORLD.seed): TerrainData {
  const r = generateRows(seed, 0, WORLD.res, true);
  let minH = Infinity, maxH = -Infinity;
  for (const h of r.heights) { if (h < minH) minH = h; if (h > maxH) maxH = h; }
  return { heights: r.heights, far: r.far!, craters: r.craters, minH, maxH };
}
