import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 두 앱을 같은 origin에서 띄워 IndexedDB 연동을 실제 개발 환경에서도 검증한다.
// Orbit: /apps/orbit/ · Wish A: /apps/wish/ · Wish B: /apps/wish-lab/
export default defineConfig({
  plugins: [react()],
  server: {
    open: '/apps/orbit/',
  },
})
