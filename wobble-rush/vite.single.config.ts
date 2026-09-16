import { defineConfig } from 'vite';

/** Single-file build: one bundle, no code splitting, relative paths. */
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    sourcemap: false,
    outDir: 'dist-single',
    cssCodeSplit: false,
    rollupOptions: {
      output: { inlineDynamicImports: true, manualChunks: undefined },
    },
  },
});
