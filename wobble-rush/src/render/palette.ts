/**
 * Material palettes.
 *
 * Every colour in the game comes from here so a map, a season or an event can
 * restyle the whole thing by swapping one palette. Materials are cached and
 * shared: a hundred props must not mean a hundred materials.
 */
import * as THREE from 'three';
import {
  panelTexture, plateTexture, hazardTexture, grateTexture, rubberTexture,
  glassTexture, bandTexture, beltTexture,
} from './textures';

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
  conveyor: number;
}

export const PALETTES: Record<string, PaletteSpec> = {
  foundry: {
    floor: 0x9fd8ea,
    metal: 0x6f86b8,
    accent: 0xffd166,
    trim: 0x364a7a,
    pipe: 0x8f7fd6,
    glass: 0x8ad6ff,
    rubber: 0xff8a3d,
    hazard: 0xff5470,
    lightPanel: 0x5cf2c8,
    grate: 0x6fc6d9,
    conveyor: 0x3b4a8a,
  },
  dusk: {
    conveyor: 0x4a3f7a,
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

/** World units covered by one texture tile. Keeps texel density uniform. */
export const TEXTURE_TILE = 4;

/**
 * Shared, cached material for a style key.
 * Textures are procedural and tinted from the same colour as the material, so
 * a single `color` override restyles a whole section of a map.
 */
export function styleMaterial(palette: string, style: StyleKey, override?: number): THREE.Material {
  const spec = PALETTES[palette] ?? PALETTES.foundry;
  const color = override ?? spec[style] ?? spec.floor;
  const key = `${style}:${color}`;
  const hit = cache.get(key);
  if (hit) return hit;

  let mat: THREE.Material;
  switch (style) {
    case 'lightPanel':
      mat = new THREE.MeshBasicMaterial({ color, toneMapped: false });
      break;
    case 'glass':
      mat = new THREE.MeshStandardMaterial({
        map: glassTexture(color), roughness: 0.14, metalness: 0.05,
        transparent: true, opacity: 0.62,
      });
      break;
    case 'metal':
      mat = new THREE.MeshStandardMaterial({ map: plateTexture(color), roughness: 0.45, metalness: 0.32 });
      break;
    case 'pipe':
      mat = new THREE.MeshStandardMaterial({
        map: bandTexture(color, spec.accent), roughness: 0.5, metalness: 0.28,
      });
      break;
    case 'rubber':
      mat = new THREE.MeshStandardMaterial({ map: rubberTexture(color), roughness: 0.88, metalness: 0 });
      break;
    case 'grate':
      mat = new THREE.MeshStandardMaterial({ map: grateTexture(color), roughness: 0.6, metalness: 0.2 });
      break;
    case 'hazard':
      mat = new THREE.MeshStandardMaterial({
        map: hazardTexture(color, 0x1b2233), roughness: 0.55, metalness: 0.08,
      });
      break;
    case 'conveyor':
      mat = new THREE.MeshStandardMaterial({ map: beltTexture(color, spec.lightPanel), roughness: 0.78 });
      break;
    case 'accent':
      mat = new THREE.MeshStandardMaterial({ color, roughness: 0.38, metalness: 0.12 });
      break;
    case 'trim':
      mat = new THREE.MeshStandardMaterial({ map: plateTexture(color), roughness: 0.52, metalness: 0.25 });
      break;
    default:
      mat = new THREE.MeshStandardMaterial({
        map: panelTexture(color, spec.accent), roughness: 0.68, metalness: 0.04,
      });
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
