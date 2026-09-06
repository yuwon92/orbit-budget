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
        // Orbit(id '/')과 다른 앱임을 고정한다. 같은 도메인의 두 번째 PWA
        id: '/wish/',
        name: 'Orbit Wish — 위시를 현실로',
        short_name: 'Orbit Wish',
        description: '자유비용을 모아 위시를 이루는 목표 관리 앱',
        lang: 'ko',
        start_url: '/wish/',
        scope: '/wish/',
        display: 'standalone',
        theme_color: '#ffd43b',
        background_color: '#fffdf8',
        icons: [
          { src: '/wish/wish-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
    }),
  ],
})
