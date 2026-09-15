import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  server: { host: true, port: 5180 },
  preview: { host: true, port: 4173 },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: { three: ['three'] },
      },
    },
  },
})
