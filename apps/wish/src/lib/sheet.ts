import { useEffect, useRef } from 'react'

const MOBILE_SHEET = '(max-width: 680px)'

const isMobileSheet = () => window.matchMedia(MOBILE_SHEET).matches

/** 키보드가 차지하지 않은 실제 화면 안에 시트를 두고, 열린 동안 뒤 문서를 고정한다. */
export function useSheetViewport() {
  useEffect(() => {
    const root = document.documentElement
    const body = document.body
    const viewport = window.visualViewport
    const scrollY = window.scrollY

    const apply = () => {
      if (!viewport) return
      root.style.setProperty('--sheet-vh', `${Math.round(viewport.height)}px`)
      root.style.setProperty('--sheet-top', `${Math.round(viewport.offsetTop)}px`)
    }

    apply()
    viewport?.addEventListener('resize', apply)
    viewport?.addEventListener('scroll', apply)

    const lock = isMobileSheet()
    const previous = {
      rootOverflow: root.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyWidth: body.style.width,
    }

    if (lock) {
      root.style.overflow = 'hidden'
      body.style.overflow = 'hidden'
      body.style.position = 'fixed'
      body.style.top = `-${scrollY}px`
      body.style.width = '100%'
    }

    return () => {
      viewport?.removeEventListener('resize', apply)
      viewport?.removeEventListener('scroll', apply)
      root.style.removeProperty('--sheet-vh')
      root.style.removeProperty('--sheet-top')

      if (lock) {
        root.style.overflow = previous.rootOverflow
        body.style.overflow = previous.bodyOverflow
        body.style.position = previous.bodyPosition
        body.style.top = previous.bodyTop
        body.style.width = previous.bodyWidth
        window.scrollTo({ top: scrollY, behavior: 'instant' })
      }
    }
  }, [])
}

/** 자동 포커스가 문서 전체를 밀지 않도록 스크롤 없이 입력칸에 커서를 둔다. */
export function useSheetFocus<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    ref.current?.focus({ preventScroll: true })
  }, [])
  return ref
}
