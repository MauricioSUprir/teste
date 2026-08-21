import type { NextConfig } from "next";

/**
 * STATIC_EXPORT=1 gera o site 100% estático em `out/` (usado para a demo no
 * GitHub Pages). BASE_PATH define o subcaminho quando servido fora da raiz
 * (ex.: /teste em usuario.github.io/teste). O deploy de produção (VPS/Dokploy,
 * docs/02) roda sem essas variáveis, com SSR/ISR normais.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(process.env.STATIC_EXPORT === "1" && {
    output: "export" as const,
    basePath: process.env.BASE_PATH ?? "",
    trailingSlash: true,
  }),
};

export default nextConfig;
