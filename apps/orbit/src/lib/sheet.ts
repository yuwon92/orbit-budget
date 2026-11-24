import { useEffect, useRef } from 'react'

const MOBILE_SHEET = '(max-width: 680px)'

const isMobileSheet = () => window.matchMedia(MOBILE_SHEET).matches

/** 지금 열린 시트 수. 시트 위에 시트를 띄울 때(지출 입력 → 카테고리 수정) 안쪽이 닫혀도 바깥 값을 지우지 않게 */
let openSheets = 0

/**
 * 바텀시트가 열려 있는 동안 배경 스크롤을 막고, 보이는 영역(visualViewport) 크기를
 * CSS 변수로 넘긴다. iOS는 키보드가 올라와도 fixed 요소 기준이 되는 레이아웃 뷰포트가
 * 그대로라, 이 값이 없으면 시트가 키보드 뒤로 밀려 윗부분이 잘린다.
 */
export function useSheetViewport() {
  useEffect(() => {
    const root = document.documentElement
    const vv = window.visualViewport
    const apply = () => {
      if (!vv) return
      // 키보드가 가린 아래쪽 높이. iOS 홈 화면 앱은 키보드가 없어도 안전 영역만큼 작은 차이를
      // 보고하므로 화면의 20% 이상 가려졌을 때만 키보드로 본다(Wish 시트와 같은 기준).
      const occludedBottom = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))
      const keyboardThreshold = Math.min(160, Math.round(window.innerHeight * 0.2))
      root.style.setProperty('--sheet-vh', `${Math.round(vv.height)}px`)
      root.style.setProperty('--sheet-top', `${Math.round(vv.offsetTop)}px`)
      root.style.setProperty('--sheet-bottom', `${occludedBottom >= keyboardThreshold ? occludedBottom : 0}px`)
    }
    // 키보드가 열려 시트가 줄어든 뒤, 커서가 있는 칸만큼만 시트 안을 스크롤한다.
    // iOS가 직접 맞추면 메모칸처럼 아래쪽 칸에서 시트를 과하게 밀어 올린다.
    const reveal = () => {
      const focused = document.activeElement
      if (!(focused instanceof HTMLElement) || !focused.closest('.expense-sheet')) return
      if (!focused.matches('input, textarea, select')) return
      requestAnimationFrame(() => focused.scrollIntoView({ block: 'nearest' }))
    }
    const onResize = () => { apply(); reveal() }
    openSheets += 1
    apply()
    vv?.addEventListener('resize', onResize)
    vv?.addEventListener('scroll', apply)
    // 배경이 스크롤되면 iOS가 키보드에 맞춰 페이지를 밀어 올려 시트 위쪽이 잘린다.
    // 데스크톱은 시트가 옆 패널이라 잠그지 않는다(스크롤바가 사라지며 화면이 튄다).
    const lock = isMobileSheet()
    const prevBody = document.body.style.overflow
    const prevRoot = root.style.overflow
    if (lock) {
      document.body.style.overflow = 'hidden'
      root.style.overflow = 'hidden'
    }
    return () => {
      vv?.removeEventListener('resize', onResize)
      vv?.removeEventListener('scroll', apply)
      if (lock) {
        document.body.style.overflow = prevBody
        root.style.overflow = prevRoot
      }
      openSheets -= 1
      // 아래에 아직 시트가 있으면 그 시트가 계속 이 값을 쓴다
      if (openSheets > 0) return
      root.style.removeProperty('--sheet-vh')
      root.style.removeProperty('--sheet-top')
      root.style.removeProperty('--sheet-bottom')
    }
  }, [])
}

/**
 * 시트가 열릴 때 첫 입력칸에 커서를 둔다. 브라우저 기본 autoFocus는 시트 안을 멋대로
 * 스크롤해 제목·금액칸을 잘라먹으므로 preventScroll로 직접 넣는다.
 * onMobile이 false면 좁은 화면에서는 커서를 두지 않는다(키보드가 폼을 다 가림).
 */
export function useSheetFocus<T extends HTMLElement>({ onMobile = true } = {}) {
  const ref = useRef<T>(null)
  useEffect(() => {
    if (!onMobile && isMobileSheet()) return
    ref.current?.focus({ preventScroll: true })
  }, [onMobile])
  return ref
}
