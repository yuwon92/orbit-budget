import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: '/wish-lab/',
  build: {
    outDir: '../../dist/wish-lab',
    emptyOutDir: true,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Orbit Wish Lab — Yellow Universe',
        short_name: 'Wish Lab',
        description: 'Orbit Wish의 Yellow Pixel 디자인 실험',
        lang: 'ko',
        start_url: '/wish-lab/',
        scope: '/wish-lab/',
        display: 'standalone',
        theme_color: '#ffd43b',
        background_color: '#fffdf8',
        icons: [
          { src: '/wish-lab/wish-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
    }),
  ],
})
