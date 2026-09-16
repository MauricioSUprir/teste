import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Durante o dev, /api vai para o servidor Node local (server/index.js),
// que e quem guarda a chave da Anthropic. O navegador nunca ve a chave.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    host: true,
    proxy: { '/api': 'http://localhost:8787' },
  },
})
