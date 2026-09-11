import { Component, type ReactNode } from 'react'

/**
 * 화면을 그리다 난 오류를 받아 흰 화면 대신 안내를 띄운다. 저장된 데이터는 건드리지
 * 않는다 — 다시 불러오면 같은 데이터로 새로 그린다.
 *
 * 저장 실패처럼 그리기 밖에서 난 오류는 여기로 오지 않는다. 그쪽은 App의
 * unhandledrejection 알림이 맡는다.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="crash-screen" role="alert">
        <strong>화면 오류</strong>
        <p>저장된 데이터는 그대로 · 다시 불러오면 복구</p>
        <button onClick={() => window.location.reload()}>다시 불러오기</button>
      </main>
    )
  }
}
