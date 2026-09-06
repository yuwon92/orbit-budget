import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'node:url'

// 제품군 전체가 이 앱 하나로 설치된다. 예산은 '/', 위시는 '/wish/'.
//
// iOS는 홈 화면 앱마다 저장소를 나누므로 아이콘을 두 개 만들면 두 제품이 서로의
// 데이터를 못 본다. 그래서 manifest와 서비스 워커는 여기 하나뿐이고, Wish 빌드
// 결과물까지 이 워커가 함께 캐시한다.
//
// 빌드 순서 주의: Wish가 먼저 dist/wish에 결과물을 넣고, 그 다음 Orbit이
// dist를 채우면서 wish/** 까지 프리캐시에 담는다. emptyOutDir를 켜면 앞 단계가
// 지워지므로 꺼 둔다. dist 정리는 npm run clean이 맡는다.
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: '/',
  build: {
    outDir: '../../dist',
    emptyOutDir: false,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png'],
      workbox: {
        // 루트 index.html로 되돌리는 것은 예산 화면에만. /wish/는 자기 문서가 있다
        navigateFallbackDenylist: [/^\/wish\//],
        // dist 아래 두 앱의 문서·스크립트·스타일을 모두 담는다.
        // 아이콘과 manifest는 플러그인이 따로 넣으므로 여기서 빼야 중복되지 않는다
        globPatterns: ['**/*.{js,css,html,svg}'],
        // 픽셀 폰트는 외부 CDN에서 온다. 한 번 받으면 캐시해 오프라인에서도 유지한다
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://cdn.jsdelivr.net' || url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'pixel-font',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
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
