/**
 * Vitrine de campanha no topo da home, logo abaixo dos banners — para uma
 * live ou ação de uma marca. Liga por loja; para tirar, `ativo: false` e
 * publicar de novo. Os textos ficam em copy.home.destaqueMarca.
 */
import type { LojaId } from "@/lib/loja";

export const DESTAQUE_HOME: { ativo: boolean; lojas: LojaId[]; marca: string; logo: string } = {
  // Wahl em destaque na BeautyNow e na Be2Beauty (live de 29/10; desligado à meia-noite)
  ativo: false,
  lojas: ["beautynow", "be2beauty"],
  marca: "wahl",
  // logo da marca (escura): no quadro escuro ela aparece em branco
  logo: "/logos-marcas/wahl.png",
};
