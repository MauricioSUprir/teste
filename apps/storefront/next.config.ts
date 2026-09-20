import type { NextConfig } from "next";

/**
 * STATIC_EXPORT=1 gera o site 100% estático em `out/` (usado para a demo no
 * GitHub Pages). BASE_PATH define o subcaminho quando servido fora da raiz
 * (ex.: /teste em usuario.github.io/teste). O deploy de produção (VPS/Dokploy,
 * docs/02) roda sem essas variáveis, com SSR/ISR normais.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  // BASE_PATH é lido pelo servidor; o <img> comum roda no navegador e precisa
  // do mesmo valor. Derivar aqui evita o bug de definir um e esquecer o outro,
  // que deixou as logos das marcas quebradas em /pro, /pulse e /bradeco.
  env: { NEXT_PUBLIC_BASE_PATH: process.env.BASE_PATH ?? "" },
  ...(process.env.STATIC_EXPORT === "1" && {
    output: "export" as const,
    basePath: process.env.BASE_PATH ?? "",
    trailingSlash: true,
  }),
};

export default nextConfig;
