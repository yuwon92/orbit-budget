/**
 * 예산 계산에 쓰는 주기. 요일 설정은 선택이다.
 * perWeek는 "주 N회"를 그 달 주수로 늘린 근사값,
 * weekdays는 그 달에 그 요일이 실제 며칠인지 세는 정확한 값.
 */
export type Frequency =
  | { mode: 'perWeek'; timesPerWeek: number }
  | { mode: 'weekdays'; weekdays: number[]; timesPerDay: number } // 0=일 … 6=토

/** 월 예산을 정하는 방법. manual 외에는 앱이 이번 달 기준으로 금액을 계산한다. */
export type BudgetRule =
  | { kind: 'manual' } // 직접 입력
  | { kind: 'perUse'; unitAmount: number; freq: Frequency } // 한 번에 얼마 × 횟수
  | { kind: 'commute'; fare: number; roundTrip: boolean; freq: Frequency } // 편도 요금 × 왕복 × 횟수
  | { kind: 'recurringSum' } // 이 카테고리의 반복 지출 합계

export interface Category {
  id: string
  name: string // "식비", "교통비", "카페"
  monthlyBudget: number // 월 예산. 0이면 예산 미설정
  color: string // 화면 표시용 hex
  isFixed: boolean // 고정비 여부. true면 자유 예산에서 제외
  sortOrder: number // 목록 표시 순서
  budgetRule?: BudgetRule // 예산 계산 방법. 없으면 직접 입력으로 본다
  hiddenOnHome?: boolean // 홈 히어로의 예산 행만 감춤. 계산에는 계속 포함된다
  quickSlot?: boolean // 홈 퀵 슬롯 구슬에 띄울지. 안 건드렸으면 횟수·교통만 기본으로 뜬다
  quickOrder?: number // 퀵 슬롯 줄에서의 순서. 없으면 카테고리 순서대로 뒤에 붙는다
}

export interface Transaction {
  id: string
  date: string // "2026-09-13" 형식
  amount: number // 항상 양수. 방향은 type으로 구분
  type: 'expense' | 'income'
  categoryId: string | null // 수입이거나 미분류면 null
  memo: string
  isPlanned: boolean // 예정 거래인지 실제 발생인지
  createdAt: number // 입력 시각 (epoch ms). 같은 날짜 안에서의 정렬과 시간 표시용
  recurringRuleId?: string // 반복 규칙이 자동 생성한 거래면 그 규칙의 id
}

export interface RecurringRule {
  id: string
  name: string // "넷플릭스", "용돈"
  amount: number
  type: 'expense' | 'income'
  categoryId: string | null
  interval?: 'monthly' | 'weekly' // 반복 주기. 없으면 월 단위(예전 규칙)
  dayOfMonth: number // 월 단위일 때 매달 며칠. 주 단위면 안 쓴다
  weekdays?: number[] // 주 단위일 때 매주 무슨 요일 (0=일 … 6=토). 여러 개 고를 수 있다
  startDate: string
  endDate: string | null // null이면 무기한
  lastGeneratedMonth: string | null // 이 달("yyyy-MM")까지 예정 거래를 만들었음. 중복 생성 방지
  // 주 단위는 한 달에 4~5건이 한꺼번에 만들어진다. 재생성 때는 날짜로 중복을 거른다.
}

export interface MonthSettings {
  yearMonth: string // "2026-09"
  reserveAmount: number // 예비비. 자유 예산에서 미리 떼어둘 금액
}
