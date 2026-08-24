import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O driver do libSQL (banco Turso) tem binários nativos e não pode ser
  // empacotado pelo webpack — fica como dependência externa do servidor.
  serverExternalPackages: ["@prisma/adapter-libsql", "@libsql/client", "libsql"],
};

export default nextConfig;
