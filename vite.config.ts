import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Orbit — 오늘의 예산',
        short_name: 'Orbit',
        description: '오늘 쓸 수 있는 금액을 알려주는 개인 예산 앱',
        lang: 'ko',
        start_url: '/',
        display: 'standalone',
        theme_color: '#f8fafd',
        background_color: '#f8fafd',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
