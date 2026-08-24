import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Proxy /api -> servidor Node local (server/index.js) durante o dev.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
})
