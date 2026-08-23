/**
 * Prefixa caminhos de arquivos em /public com o basePath do deploy
 * (no GitHub Pages o site vive em /teste). O next/image faz isso sozinho,
 * mas <img> comum não — use este helper para qualquer asset de public/.
 */
export const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function comBase(caminho: string): string {
  return `${BASE}${caminho}`;
}
