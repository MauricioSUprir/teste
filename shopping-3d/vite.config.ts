import { defineConfig } from "vite";

// caminhos relativos: o mesmo build funciona na raiz de um domínio ou numa subpasta
export default defineConfig({
  base: "./",
  build: { target: "es2022", chunkSizeWarningLimit: 1200 },
  server: { host: true },
});
