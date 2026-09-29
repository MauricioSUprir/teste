// Detalhes que dão vida à noite: sinalizadores piscando (vermelho) na base e no módulo de pouso,
// janelas com luz quente vazando. Materiais compartilhados animados a cada quadro.
import * as THREE from 'three';

export const BEACON_MAT = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: new THREE.Color(1, 0.08, 0.03), emissiveIntensity: 1 });
BEACON_MAT.userData.noDust = true;
export const WINDOW_MAT = new THREE.MeshPhysicalMaterial({ color: 0x0a1016, roughness: 0.05, clearcoat: 1, emissive: new THREE.Color(1, 0.72, 0.42), emissiveIntensity: 1 });
WINDOW_MAT.userData.noDust = true;

export function beacon(r = 0.07) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), BEACON_MAT);
  m.castShadow = false;
  return m;
}

/** night 0 (dia) … 1 (noite fechada) */
export function updateNightFx(t: number, night: number) {
  // pisca curto a cada 1,6 s (padrão de sinalizador de aviação)
  const ph = t % 1.6;
  const flash = ph < 0.12 ? 1 : ph < 0.3 ? 0.15 : 0.05;
  BEACON_MAT.emissiveIntensity = flash * (3 + night * 22);
  WINDOW_MAT.emissiveIntensity = 0.2 + night * 3.2;
}
