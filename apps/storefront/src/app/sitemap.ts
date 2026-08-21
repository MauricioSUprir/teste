import type { MetadataRoute } from "next";

export const dynamic = "force-static";
import { categorias, marcas, necessidades, produtos } from "@/lib/catalogo/consultas";

const BASE = "https://www.beautynowstore.com.br";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: BASE, changeFrequency: "daily", priority: 1 },
    ...categorias.map((c) => ({
      url: `${BASE}/categoria/${c.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.9,
    })),
    ...produtos.map((p) => ({
      url: `${BASE}/produto/${p.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...marcas.map((m) => ({
      url: `${BASE}/marca/${m.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...necessidades.map((n) => ({
      url: `${BASE}/necessidade/${n.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    { url: `${BASE}/atendimento`, changeFrequency: "monthly", priority: 0.4 },
  ];
}
