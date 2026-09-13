import type { MetadataRoute } from "next";
import { NEGOCIO } from "@/lib/negocio";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // páginas de uso pessoal ou restrito não entram na busca
      disallow: ["/checkout", "/conta", "/admin", "/afiliado"],
    },
    // cada loja aponta para o próprio mapa do site
    sitemap: `${NEGOCIO.site}/sitemap.xml`,
  };
}
