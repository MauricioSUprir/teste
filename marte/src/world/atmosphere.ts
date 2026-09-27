// Modelo analítico da atmosfera marciana (poeira domina: Rayleigh do CO2 é desprezível, τ_R≈0,004).
// Céu diurno caramelo pela absorção de azul da poeira (~1,5 µm); halo azulado ao redor do Sol por
// espalhamento frontal (Henyey-Greenstein g≈0,7), visível sobretudo no crepúsculo (dura ~2 h).
// A MESMA função existe em GLSL (céu, névoa, mapa de ambiente) e em TS (cor da luz, exposição).
import * as THREE from 'three';

export const ATMOS_GLSL = /* glsl */ `
const vec3 DUST_COL = vec3(0.60, 0.33, 0.155);
const vec3 DUST_HORIZON = vec3(0.78, 0.55, 0.36);
const vec3 HALO_COL = vec3(0.30, 0.50, 0.95);
const vec3 SUN_EXT = vec3(0.90, 1.0, 1.18);
float hgPhase(float mu, float g){ float g2=g*g; return (1.0-g2)/(4.0*3.14159265*pow(max(1.0+g2-2.0*g*mu,1e-4),1.5)); }
vec3 sunTransmit(float sunY, float tau){
  float m = 1.0/(max(sunY,0.0)+0.035+0.12*max(-sunY,0.0));
  return exp(-tau*0.55*m*SUN_EXT);
}
// radiância do céu (linear, unidades do jogo) para direção v, Sol s, profundidade óptica tau
vec3 marsSky(vec3 v, vec3 s, float tau, float sunPower){
  float mu = dot(v,s);
  float hv = max(v.y, 0.0);
  float mv = 1.0/(hv+0.06);
  float day = smoothstep(-0.30, 0.10, s.y);
  float lowSun = 1.0 - smoothstep(0.0, 0.45, s.y);
  vec3 T = sunTransmit(s.y, tau) * day;
  float pathV = 1.0 - exp(-max(tau,0.05)*mv*0.8);
  vec3 base = mix(DUST_COL, DUST_HORIZON, pow(1.0-hv, 3.0));
  // o céu escurece levemente no zênite com τ baixo, fica mais "leitoso" com τ alto
  vec3 iso = base * pathV * (0.55 + 0.45*smoothstep(0.2,1.5,tau));
  float haloAmt = mix(0.35, 1.3, lowSun) * (1.0 - smoothstep(2.0, 5.0, tau)*0.8);
  vec3 halo = HALO_COL * hgPhase(mu, 0.72) * haloAmt * (0.35 + pathV);
  vec3 glare = vec3(1.0,0.92,0.82) * hgPhase(mu, 0.96) * 0.05 * (1.0 - lowSun*0.6);
  // luz residual do crepúsculo (Sol abaixo do horizonte até ~-18°)
  float twi = smoothstep(-0.32, 0.0, s.y) * (1.0 - smoothstep(0.0, 0.2, s.y));
  vec3 twilight = HALO_COL * 0.05 * twi * pow(max(mu*0.5+0.5,0.0), 6.0) * (1.0 - hv);
  // tempestade: céu uniforme, escuro e alaranjado
  float storm = smoothstep(1.5, 5.0, tau);
  vec3 stormCol = vec3(0.42, 0.25, 0.14) * (0.25 + 0.75*exp(-tau*0.25));
  vec3 col = (iso*0.9 + halo*0.55 + glare) * T + twilight;
  col = mix(col, stormCol * max(max(T.r,T.g),T.b) * 1.1, storm*0.75);
  // luz noturna residual (estrelas + airglow + Fobos/Deimos): muito fraca, azul-acinzentada
  col += vec3(0.00022, 0.00024, 0.0003) * (0.6 + 0.4*hv) * (1.0 - storm*0.8) / max(sunPower, 0.1);
  return col * sunPower;
}
vec3 marsGround(vec3 s, float tau, float sunPower){
  vec3 T = sunTransmit(s.y, tau) * smoothstep(-0.30, 0.10, s.y);
  return vec3(0.34, 0.21, 0.13) * (T * max(s.y,0.0) * 1.1 + 0.18*T) * sunPower + vec3(0.0002,0.00018,0.00016);
}
`;

const DUST_COL = [0.6, 0.33, 0.155];
const DUST_HORIZON = [0.78, 0.55, 0.36];
const SUN_EXT = [0.9, 1.0, 1.18];
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function sunTransmit(sunY: number, tau: number, out = new THREE.Color()) {
  const m = 1 / (Math.max(sunY, 0) + 0.035 + 0.12 * Math.max(-sunY, 0));
  return out.setRGB(Math.exp(-tau * 0.55 * m * SUN_EXT[0]), Math.exp(-tau * 0.55 * m * SUN_EXT[1]), Math.exp(-tau * 0.55 * m * SUN_EXT[2]));
}

/** Radiância média aproximada do hemisfério celeste (para exposição / luz ambiente). */
export function skyAmbient(sunY: number, tau: number, sunPower: number, out = new THREE.Color()) {
  const day = smooth(-0.3, 0.1, sunY);
  const T = sunTransmit(sunY, tau);
  const path = 1 - Math.exp(-Math.max(tau, 0.05) * 0.8 * 2.2);
  const k = path * (0.55 + 0.45 * smooth(0.2, 1.5, tau)) * 0.9 * day * sunPower;
  const hz = 0.35;
  return out.setRGB(
    (DUST_COL[0] * (1 - hz) + DUST_HORIZON[0] * hz) * k * T.r,
    (DUST_COL[1] * (1 - hz) + DUST_HORIZON[1] * hz) * k * T.g,
    (DUST_COL[2] * (1 - hz) + DUST_HORIZON[2] * hz) * k * T.b,
  );
}
