import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'node:url'

// Wish는 독립 PWA가 아니라 Orbit 앱 안의 한 화면이다.
//
// iOS는 홈 화면 앱마다 저장소 컨테이너를 나눈다. 같은 도메인이어도 아이콘을 두 개
// 만들면 Wish가 Orbit의 예산을 볼 수 없다(실측으로 확인). 그래서 manifest와
// 서비스 워커를 Orbit 하나로 합치고, Wish는 그 앱의 /wish/ 페이지로 둔다.
//
// 나중에 도메인을 나누고 서버를 두기로 하면 여기 manifest를 되살리면 된다.
// 화면 코드는 apps/wish/src/lib/budget.ts의 어댑터만 서버 조회로 바꾸면 그대로 쓴다.
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: '/wish/',
  build: {
    outDir: '../../dist/wish',
    emptyOutDir: true,
  },
  plugins: [
    react(),
    // 이전 배포에서 /wish/ 스코프에 설치된 서비스 워커를 스스로 해지시킨다.
    // 그냥 지우면 옛 워커가 남아 계속 /wish/를 가로챈다.
    // 기기들이 한 번씩 열어 정리된 뒤에는 이 플러그인 자체를 빼도 된다.
    VitePWA({
      selfDestroying: true,
      manifest: false,
      injectRegister: 'script-defer',
    }),
  ],
})
