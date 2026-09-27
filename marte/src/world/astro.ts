// Astronomia marciana simplificada a partir do algoritmo Mars24 (Allison & McEwen 2000, NASA GISS).
// O jogo avança Ls pelo relógio de sóis; hora = tempo solar local verdadeiro (LTST) em Jezero.
import { WORLD } from './config';

const D2R = Math.PI / 180;
export const SOL_SECONDS = 88775.244; // 24h39m35.244s

export interface SkyState {
  sunDir: [number, number, number]; // mundo: +X leste, +Y cima, -Z norte
  sunAlt: number; // rad
  sunDistAU: number;
  solarConst: number; // W/m² no topo da atmosfera
  sunAngularDiamDeg: number;
  phobosDir: [number, number, number];
  deimosDir: [number, number, number];
  earthDir: [number, number, number];
  ls: number;
  ltstHours: number;
}

function horizToWorld(alt: number, az: number): [number, number, number] {
  // az medido a partir do norte, sentido leste
  const c = Math.cos(alt);
  return [c * Math.sin(az), Math.sin(alt), -c * Math.cos(az)];
}

function equToHoriz(decl: number, hourAngle: number, lat: number) {
  const sinAlt = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(hourAngle);
  const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
  const y = -Math.sin(hourAngle) * Math.cos(decl);
  const x = Math.sin(decl) * Math.cos(lat) - Math.cos(decl) * Math.cos(hourAngle) * Math.sin(lat);
  const az = Math.atan2(y, x);
  return { alt, az };
}

/** @param solFloat sóis desde o início (ex.: 3.25 = sol 3, 06:00 LTST) @param ls0 Ls inicial em graus */
export function computeSky(solFloat: number, ls0 = 20): SkyState {
  const lat = WORLD.latitudeDeg * D2R;
  // anomalia média avança 0,5384°/sol (360°/668,6 sóis); equação do centro não uniforme
  const M0 = ls0 - 251 - 10.691 * Math.sin((ls0 - 251) * D2R);
  const M = (M0 + solFloat * 0.5384) * D2R;
  const ls = (((251 + M / D2R + 10.691 * Math.sin(M) + 0.623 * Math.sin(2 * M) + 0.05 * Math.sin(3 * M)) % 360) + 360) % 360;
  const lsR = ls * D2R;
  // distância heliocêntrica (e = 0,0934, periélio em Ls 251°)
  const e = 0.0934;
  const r = (1.5236 * (1 - e * e)) / (1 + e * Math.cos((ls - 251) * D2R));
  const solarConst = 1361 / (r * r);
  const decl = Math.asin(0.42565 * Math.sin(lsR)) + 0.25 * D2R * Math.sin(lsR);
  const ltst = ((solFloat % 1) + 1) % 1 * 24;
  const H = (ltst - 12) * 15 * D2R;
  const sun = equToHoriz(decl, H, lat);

  // Fobos: órbita retrógrada aparente (nasce a oeste), período sinódico ~11,1 h, inclinação ~1°
  // Aproximação: move-se no plano equatorial; altitude máxima ~62° ao sul de Jezero (paralaxe grande).
  const phPhase = ((solFloat * 24.66) / 11.12) % 1; // voltas aparentes
  const phHA = (0.5 - phPhase) * 2 * Math.PI; // ângulo horário decrescente: nasce a OESTE
  const ph = equToHoriz(-0.0 * D2R, phHA, lat);
  const phAltTopo = Math.atan2(Math.sin(ph.alt) - 0.3616, Math.cos(ph.alt)); // paralaxe topocêntrica (R_Marte/a = 0,3616)
  // Deimos: quase síncrono; nasce a leste e fica ~2,5 sóis no céu (ciclo ~5,4 sóis)
  const dePhase = (solFloat / 5.4) % 1;
  const deHA = (dePhase - 0.5) * 2 * Math.PI;
  const de = equToHoriz(0, deHA, lat);
  const deAltTopo = Math.atan2(Math.sin(de.alt) - 0.1445, Math.cos(de.alt));
  // Terra: estrela azul próxima ao Sol (≤47° de elongação) — posição fixa relativa ao Sol nesta campanha
  const earth = equToHoriz(decl - 0.18, H + 0.62, lat);

  return {
    sunDir: horizToWorld(sun.alt, sun.az),
    sunAlt: sun.alt,
    sunDistAU: r,
    solarConst,
    sunAngularDiamDeg: 0.533 / r,
    phobosDir: horizToWorld(phAltTopo, ph.az),
    deimosDir: horizToWorld(deAltTopo, de.az),
    earthDir: horizToWorld(earth.alt, earth.az),
    ls,
    ltstHours: ltst,
  };
}

/** Transmitância direta do feixe solar através da poeira (tau) para ângulo zenital z. */
export function directTransmittance(tau: number, sinAlt: number) {
  if (sinAlt <= 0) return 0;
  // massa de ar com correção de curvatura (Kasten-Young adaptado)
  const zDeg = 90 - Math.asin(sinAlt) / D2R;
  const m = 1 / (sinAlt + 0.50572 * Math.pow(96.07995 - zDeg, -1.6364));
  return Math.exp(-tau * m);
}

/** Irradiância global em superfície horizontal (W/m²) — ajuste aproximado às tabelas de Appelbaum. */
export function globalIrradiance(S: number, tau: number, sinAlt: number) {
  if (sinAlt <= 0) return 0;
  const m = 1 / Math.max(sinAlt, 0.02);
  const f = 0.9 * Math.exp(-0.3 * tau * Math.pow(m, 0.6));
  return (S * sinAlt * f) / 0.9;
}
