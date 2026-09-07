// 화면에 나가는 한국어 문구와 아이콘. 계산 규칙은 @orbit/wish-core에 있고
// 여기에는 그 결과에 붙는 이름만 둔다.
import type { PlanetStage } from '@orbit/wish-core/types'
import type { TitleId } from '@orbit/wish-core/xp'

export const STAGE_NAMES: Record<PlanetStage, string> = {
  seed: '티끌',
  moon: '위성',
  planet: '행성',
  ring: '고리',
  satellites: '위성대',
  system: '성계',
}

/** 도감 총 칸 수. 채우지 못한 칸은 실루엣으로 남는다 */
export const CODEX_SLOTS = 12

export const TITLES: { id: TitleId; name: string; detail: string; icon: string }[] = [
  { id: 'first', name: '첫 궤도', detail: '첫 위시 완주', icon: '🪐' },
  { id: 'long', name: '장기 관측', detail: '30일 이상 완주', icon: '🔭' },
  { id: 'thrift', name: '절약가', detail: '남은 예산 10회', icon: '🪙' },
  { id: 'patience', name: '인내', detail: '더 기다리기 5회', icon: '⌛' },
  { id: 'habit', name: '관측 습관', detail: '연속 14일', icon: '📡' },
  { id: 'constellation', name: '성계 형성', detail: '완주한 위시 5개', icon: '✨' },
  { id: 'letgo', name: '정리', detail: '목표 도달 뒤 놓아주기', icon: '📦' },
]
