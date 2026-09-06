import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: '/wish/',
  build: {
    outDir: '../../dist/wish',
    emptyOutDir: true,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Orbit Wish — 위시를 현실로',
        short_name: 'Orbit Wish',
        description: 'Orbit 예산과 연결되는 목표형 위시리스트',
        lang: 'ko',
        start_url: '/wish/',
        scope: '/wish/',
        display: 'standalone',
        theme_color: '#111827',
        background_color: '#f5f2ff',
        icons: [
          { src: '/wish/wish-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
    }),
  ],
})
