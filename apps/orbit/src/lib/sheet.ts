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
    // 배경이 스크롤되면 iOS가 키보드에 맞춰 페이지를 밀어 올려 시트 위쪽이 잘린다.
    // 데스크톱은 시트가 옆 패널이라 잠그지 않는다(스크롤바가 사라지며 화면이 튄다).
    const lock = isMobileSheet()

    let alive = true
    let resets = 0
    const apply = () => {
      if (!vv || !alive) return
      // iOS는 아래쪽 입력칸(메모)을 누르면 키보드 높이만큼 문서를 밀어 올린다. 문서는
      // 스크롤하지 않는 구조라 밀린 만큼 되돌리고, 칸을 보이게 하는 일은 시트 안 스크롤이 맡는다.
      // 되돌린 직후의 visualViewport 값은 아직 밀린 상태라, 그 값으로 계산하면 키보드 높이가
      // 0에 가깝게 나와 시트가 키보드 뒤에 남는다. 되돌린 결과가 반영된 다음 프레임에 다시 잰다.
      // iOS가 계속 다시 밀면 프레임마다 되풀이하지 않도록 세 번까지만 되돌린다.
      if (lock && window.scrollY !== 0 && resets < 3) {
        resets += 1
        window.scrollTo(0, 0)
        requestAnimationFrame(apply)
        return
      }
      if (window.scrollY === 0) resets = 0
      // 키보드 판정은 보이는 높이가 줄어든 정도로만 한다. 밀린 거리(offsetTop)까지 빼고 판정하면
      // iOS가 화면을 밀어 올린 순간 가린 높이가 기준 아래로 떨어져 시트가 키보드 뒤로 내려간다.
      // iOS 홈 화면 앱은 키보드가 없어도 안전 영역만큼 작은 차이를 보고하므로 20% 기준을 둔다.
      const keyboardThreshold = Math.min(160, Math.round(window.innerHeight * 0.2))
      const keyboardOpen = window.innerHeight - vv.height >= keyboardThreshold
      const occludedBottom = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))
      root.style.setProperty('--sheet-vh', `${Math.round(vv.height)}px`)
      root.style.setProperty('--sheet-top', `${Math.round(vv.offsetTop)}px`)
      root.style.setProperty('--sheet-bottom', `${keyboardOpen ? occludedBottom : 0}px`)
    }

    // 키보드가 자리를 잡은 뒤 커서가 있는 칸이 보이도록 시트 안만 스크롤한다.
    // scrollIntoView는 문서까지 밀어 올릴 수 있어 쓰지 않는다. 칸에 딸린 줄(메모 추천)까지
    // 보여야 하면 감싼 요소에 data-sheet-reveal을 단다.
    let revealTimer = 0
    const reveal = (delay: number) => {
      if (!lock) return
      window.clearTimeout(revealTimer)
      revealTimer = window.setTimeout(() => {
        // 키보드가 다 올라온 뒤 한 번 더 잰다. 마지막 신호가 키보드가 덜 올라온 값이었어도 바로잡힌다.
        apply()
        const focused = document.activeElement
        if (!(focused instanceof HTMLElement) || !focused.matches('input, textarea, select')) return
        const sheet = focused.closest<HTMLElement>('.expense-sheet')
        if (!sheet) return
        const target = focused.closest<HTMLElement>('[data-sheet-reveal]') ?? focused
        const box = sheet.getBoundingClientRect()
        const header = sheet.querySelector('.sheet-top')?.getBoundingClientRect().height ?? 0
        const field = target.getBoundingClientRect()
        const below = field.bottom + 16 - box.bottom
        const above = box.top + header - field.top
        if (below > 0) sheet.scrollTop += Math.min(below, Math.max(0, -above))
        else if (above > 0) sheet.scrollTop -= above
      }, delay)
    }
    const onViewport = () => { apply(); reveal(80) }
    // 숫자 키보드에서 메모칸으로 옮길 때는 키보드 높이가 거의 그대로라 resize가 안 올 수 있다
    const onFocusIn = () => reveal(320)

    openSheets += 1
    apply()
    vv?.addEventListener('resize', onViewport)
    vv?.addEventListener('scroll', onViewport)
    // iOS가 문서를 밀었다 되돌릴 때 visualViewport scroll이 안 오는 경우가 있어 문서 스크롤도 듣는다
    window.addEventListener('scroll', onViewport)
    document.addEventListener('focusin', onFocusIn)
    const prevBody = document.body.style.overflow
    const prevRoot = root.style.overflow
    if (lock) {
      document.body.style.overflow = 'hidden'
      root.style.overflow = 'hidden'
    }
    return () => {
      alive = false
      vv?.removeEventListener('resize', onViewport)
      vv?.removeEventListener('scroll', onViewport)
      window.removeEventListener('scroll', onViewport)
      document.removeEventListener('focusin', onFocusIn)
      window.clearTimeout(revealTimer)
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
