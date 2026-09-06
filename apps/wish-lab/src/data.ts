// Wish Lab 샘플 데이터. 새로고침하면 초기화되는 디자인 검토용 상태.
import type { CodexEntry, LabWish } from './game'

function dateAfter(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toLocaleDateString('sv-SE')
}

export const INITIAL_WISHES: LabWish[] = [
  { id: 'headphones', name: '오래 쓸 헤드폰', targetAmount: 320_000, savedAmount: 217_000, targetDate: dateAfter(18), state: 'active', seed: 41, startedDays: 22, keptDays: 19 },
  { id: 'desk-lamp', name: '작업실 조명', targetAmount: 86_000, savedAmount: 86_000, targetDate: dateAfter(9), state: 'waiting', seed: 77, startedDays: 14, keptDays: 12 },
]

export const INITIAL_CODEX: CodexEntry[] = [
  { id: 'camera', name: '필름 카메라', amount: 210_000, days: 34, keptDays: 28, stardust: 1_240, date: '2026-08-12', seed: 12 },
  { id: 'chair', name: '독서 의자', amount: 168_000, days: 21, keptDays: 17, stardust: 760, date: '2026-06-03', seed: 5 },
  { id: 'ticket', name: '공연 티켓', amount: 132_000, days: 18, keptDays: 16, stardust: 640, date: '2026-04-19', seed: 29 },
]

/** 도감 총 칸 수. 채우지 못한 칸은 실루엣으로 남는다. */
export const CODEX_SLOTS = 12

export const BADGES = [
  { id: 'first', name: '첫 궤도', detail: '첫 위시 완주', icon: '🪐', earned: true },
  { id: 'long', name: '장기 관측', detail: '30일 이상 완주', icon: '🔭', earned: true },
  { id: 'thrift', name: '절약가', detail: '남은 예산 10회', icon: '🪙', earned: false },
  { id: 'patience', name: '인내', detail: '더 기다리기 5회', icon: '⌛', earned: false },
  { id: 'habit', name: '관측 습관', detail: '연속 14일', icon: '📡', earned: false },
  { id: 'letgo', name: '정리', detail: '위시를 잘 놓아주기', icon: '📦', earned: true },
]

export const STATS = {
  totalXp: 620,
  streak: 6,
  bestStreak: 14,
  keptDays: 42,
  carryovers: 8,
  carryoverAmount: 96_300,
  waits: 3,
  vaultAmount: 303_000,
  freeAmount: 92_400,
}
