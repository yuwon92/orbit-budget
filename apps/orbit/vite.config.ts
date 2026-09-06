import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: '/orbit/',
  build: {
    outDir: '../../dist/orbit',
    emptyOutDir: true,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Orbit — 오늘의 예산',
        short_name: 'Orbit',
        description: '오늘 쓸 수 있는 금액을 알려주는 개인 예산 앱',
        lang: 'ko',
        start_url: '/orbit/',
        scope: '/orbit/',
        display: 'standalone',
        theme_color: '#f8fafd',
        background_color: '#f8fafd',
        icons: [
          { src: '/orbit/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/orbit/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/orbit/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
