import { defineConfig } from 'vite';

export default defineConfig({
  // Relative paths so a build can be served from any directory.
  base: './',
  server: { host: true, port: 5180 },
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: { three: ['three'] },
      },
    },
  },
});
