import { useEffect, useRef } from 'react'

const MOBILE_SHEET = '(max-width: 680px)'

const isMobileSheet = () => window.matchMedia(MOBILE_SHEET).matches

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
      root.style.setProperty('--sheet-vh', `${Math.round(vv.height)}px`)
      root.style.setProperty('--sheet-top', `${Math.round(vv.offsetTop)}px`)
    }
    apply()
    vv?.addEventListener('resize', apply)
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
      vv?.removeEventListener('resize', apply)
      vv?.removeEventListener('scroll', apply)
      if (lock) {
        document.body.style.overflow = prevBody
        root.style.overflow = prevRoot
      }
      root.style.removeProperty('--sheet-vh')
      root.style.removeProperty('--sheet-top')
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
