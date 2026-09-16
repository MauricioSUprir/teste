import { defineConfig } from 'vite';

export default defineConfig({
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
