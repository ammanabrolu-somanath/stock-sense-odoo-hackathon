import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      '@domain': path.resolve(import.meta.dirname, './shared/domain'),
    },
  },
  server: {
    port: 5173,
    // API_PORT lets the e2e suite run its own API beside a developer's (see playwright.config.ts).
    proxy: { '/api': `http://localhost:${process.env.API_PORT ?? 3001}` },
  },
})
