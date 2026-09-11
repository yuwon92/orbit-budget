import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import './index.css'

const root = createRoot(document.getElementById('root')!)

// 개발 전용 꾸미기 프리뷰. import.meta.env.DEV가 빌드 때 false로 접히면서 이 블록과
// 동적 import 대상이 통째로 빠진다. 정적 import로 두면 컴포넌트는 트리셰이킹돼도
// CSS는 side effect라 남아 배포 CSS에 프리뷰 100줄이 실린다.
if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('cosmetics-preview')) {
  void import('./components/PlanetCosmeticsPreview').then(({ PlanetCosmeticsPreview }) => {
    root.render(
      <StrictMode>
        <PlanetCosmeticsPreview />
      </StrictMode>,
    )
  })
} else {
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  )
}
