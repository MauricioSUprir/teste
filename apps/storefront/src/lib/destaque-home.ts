/**
 * Vitrine de campanha no topo da home, logo abaixo dos banners — para uma
 * live ou ação de uma marca. Liga por loja; para tirar, `ativo: false` e
 * publicar de novo. Os textos ficam em copy.home.destaqueMarca.
 */
import type { LojaId } from "@/lib/loja";

export const DESTAQUE_HOME: { ativo: boolean; lojas: LojaId[]; marca: string } = {
  // live da Wahl na Be2Beauty (pedido da Fabiana, 29/10)
  ativo: true,
  lojas: ["be2beauty"],
  marca: "wahl",
};
