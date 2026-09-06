import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'node:url'

// Orbit은 도메인 루트에 둔다. 이미 홈 화면에 설치된 앱의 start_url이 '/'라서
// 경로를 바꾸면 브라우저가 다른 앱으로 보고 기존 아이콘이 빈 화면을 연다.
// Wish는 /wish/ 하위에 올린다.
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: '/',
  build: {
    // dist 루트를 비우므로 반드시 Orbit → Wish 순서로 빌드할 것 (npm run build가 그 순서)
    outDir: '../../dist',
    emptyOutDir: true,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // 루트 scope 서비스 워커가 /wish/ 이동까지 가로채 Orbit 화면을 돌려주는 것을 막는다
        navigateFallbackDenylist: [/^\/wish\//],
      },
      manifest: {
        // 앱 정체성을 고정한다. 없으면 브라우저가 start_url로 식별해서
        // 나중에 경로를 바꾸면 설치된 앱을 업데이트하지 못하고 아이콘이 하나 더 생긴다.
        id: '/',
        name: 'Orbit — 오늘의 예산',
        short_name: 'Orbit',
        description: '오늘 쓸 수 있는 금액을 알려주는 개인 예산 앱',
        lang: 'ko',
        start_url: '/',
        scope: '/',
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
