/**
 * Material palettes.
 *
 * Every colour in the game comes from here so a map, a season or an event can
 * restyle the whole thing by swapping one palette. Materials are cached and
 * shared: a hundred props must not mean a hundred materials.
 */
import * as THREE from 'three';

export interface PaletteSpec {
  floor: number;
  metal: number;
  accent: number;
  trim: number;
  pipe: number;
  glass: number;
  rubber: number;
  hazard: number;
  lightPanel: number;
  grate: number;
}

export const PALETTES: Record<string, PaletteSpec> = {
  foundry: {
    floor: 0xe8ecf4,
    metal: 0x8fa3c4,
    accent: 0x3ddad0,
    trim: 0x2f3b52,
    pipe: 0xb9c6de,
    glass: 0x8ad6ff,
    rubber: 0xff8a3d,
    hazard: 0xff5470,
    lightPanel: 0x5cf2c8,
    grate: 0xa8b6d1,
  },
  dusk: {
    floor: 0xd8d2ea,
    metal: 0x7a6fa8,
    accent: 0xffb35c,
    trim: 0x3a2f55,
    pipe: 0x9f96c4,
    glass: 0xc9a6ff,
    rubber: 0xff7b9c,
    hazard: 0xff5470,
    lightPanel: 0xffd98a,
    grate: 0x9288bb,
  },
};

export type StyleKey = keyof PaletteSpec;

const cache = new Map<string, THREE.Material>();

/** Shared, cached material for a style key in a palette. */
export function styleMaterial(palette: string, style: StyleKey, override?: number): THREE.Material {
  const spec = PALETTES[palette] ?? PALETTES.foundry;
  const color = override ?? spec[style] ?? spec.floor;
  const key = `${style}:${color}`;
  let mat = cache.get(key);
  if (mat) return mat;

  switch (style) {
    case 'lightPanel':
      mat = new THREE.MeshBasicMaterial({ color, toneMapped: false });
      break;
    case 'glass':
      mat = new THREE.MeshStandardMaterial({
        color, roughness: 0.12, metalness: 0.05, transparent: true, opacity: 0.55,
      });
      break;
    case 'metal':
    case 'pipe':
      mat = new THREE.MeshStandardMaterial({ color, roughness: 0.42, metalness: 0.35 });
      break;
    case 'rubber':
      mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0 });
      break;
    case 'accent':
    case 'hazard':
      mat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.1 });
      break;
    default:
      mat = new THREE.MeshStandardMaterial({ color, roughness: 0.66, metalness: 0.04 });
      break;
  }
  cache.set(key, mat);
  return mat;
}

/** Character skin tones - deliberately saturated and readable at distance. */
export const SKIN_COLORS = [
  0xff7a5c, 0x5cc9ff, 0xffd166, 0x9b7bff, 0x4ade80, 0xff8fd6,
  0x36d1c4, 0xff5470, 0xa3e635, 0x7dd3fc, 0xfbbf24, 0xc084fc,
];

export const TEAM_COLORS = [0x3ddad0, 0xff8a3d, 0x9b7bff, 0xff5470, 0x4ade80, 0xffd166];

export function disposePalette(): void {
  for (const m of cache.values()) m.dispose();
  cache.clear();
}
