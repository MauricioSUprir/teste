// Níveis de qualidade + escala de resolução dinâmica.
export type QualityId = 'low' | 'medium' | 'high' | 'ultra' | 'max';

export interface QualitySettings {
  id: QualityId;
  pixelRatioCap: number; // multiplicador máximo de devicePixelRatio
  texTier: '1k' | '2k' | '4k';
  shadowCascades: number;
  shadowMapSize: number;
  shadowFar: number;
  ao: boolean;
  aoHalfRes: boolean;
  bloom: boolean;
  smaa: boolean;
  antiTiling: boolean;
  lodScale: number; // multiplica as distâncias de LOD do terreno
  rockDensity: number; // 0..1
  drawDistance: number;
  particles: number;
}

export const QUALITY: Record<QualityId, QualitySettings> = {
  low: { id: 'low', pixelRatioCap: 0.75, texTier: '1k', shadowCascades: 1, shadowMapSize: 1024, shadowFar: 120, ao: false, aoHalfRes: true, bloom: false, smaa: false, antiTiling: false, lodScale: 0.55, rockDensity: 0.25, drawDistance: 2500, particles: 300 },
  medium: { id: 'medium', pixelRatioCap: 1, texTier: '1k', shadowCascades: 2, shadowMapSize: 1024, shadowFar: 200, ao: false, aoHalfRes: true, bloom: true, smaa: true, antiTiling: true, lodScale: 0.8, rockDensity: 0.45, drawDistance: 5000, particles: 800 },
  high: { id: 'high', pixelRatioCap: 1.5, texTier: '2k', shadowCascades: 3, shadowMapSize: 2048, shadowFar: 350, ao: true, aoHalfRes: true, bloom: true, smaa: true, antiTiling: true, lodScale: 1, rockDensity: 0.7, drawDistance: 9000, particles: 1500 },
  ultra: { id: 'ultra', pixelRatioCap: 2, texTier: '2k', shadowCascades: 4, shadowMapSize: 2048, shadowFar: 500, ao: true, aoHalfRes: false, bloom: true, smaa: true, antiTiling: true, lodScale: 1.35, rockDensity: 1, drawDistance: 12000, particles: 2500 },
  max: { id: 'max', pixelRatioCap: 4, texTier: '4k', shadowCascades: 4, shadowMapSize: 4096, shadowFar: 700, ao: true, aoHalfRes: false, bloom: true, smaa: true, antiTiling: true, lodScale: 1.8, rockDensity: 1, drawDistance: 12000, particles: 4000 },
};

export const isMobile = (() => {
  const ua = navigator.userAgent;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua));
})();

export function autoQuality(gl: WebGL2RenderingContext | null): QualityId {
  if (!gl) return 'low';
  const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 8;
  const cores = navigator.hardwareConcurrency || 4;
  if (isMobile) return mem >= 6 && cores >= 8 ? 'medium' : 'low';
  let renderer = '';
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  if (ext) renderer = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL));
  if (/SwiftShader|llvmpipe|Software/i.test(renderer)) return 'low';
  if (/RTX|RX 6|RX 7|RX 9|Apple M[2-9]|Arc/i.test(renderer) && maxTex >= 16384) return 'ultra';
  if (/Intel|UHD|Iris|Mali|Adreno/i.test(renderer)) return 'medium';
  return 'high';
}

/** Escala de resolução dinâmica guiada pelo p90 do tempo de quadro. */
export class DynamicResolution {
  scale = 1;
  private samples: number[] = [];
  private overT = 0;
  private underT = 0;
  enabled = true;
  constructor(public targetMs = 16.7, public min = 0.5) {}
  /** retorna true se a escala mudou */
  update(frameMs: number, dt: number): boolean {
    if (!this.enabled) return false;
    this.samples.push(frameMs);
    if (this.samples.length > 30) this.samples.shift();
    if (this.samples.length < 30) return false;
    const sorted = [...this.samples].sort((a, b) => a - b);
    const p90 = sorted[27];
    if (p90 > this.targetMs * 1.15) { this.overT += dt; this.underT = 0; } else if (p90 < this.targetMs * 0.8) { this.underT += dt; this.overT = 0; } else { this.overT = 0; this.underT = 0; }
    if (this.overT > 0.6 && this.scale > this.min) { this.scale = Math.max(this.min, this.scale - 0.1); this.overT = 0; this.samples.length = 0; return true; }
    if (this.underT > 3 && this.scale < 1) { this.scale = Math.min(1, this.scale + 0.05); this.underT = 0; this.samples.length = 0; return true; }
    return false;
  }
}
