export interface Category {
  id: string
  name: string // "식비", "교통비", "카페"
  monthlyBudget: number // 월 예산. 0이면 예산 미설정
  color: string // 화면 표시용 hex
  isFixed: boolean // 고정비 여부. true면 자유 예산에서 제외
  sortOrder: number // 목록 표시 순서
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
  dayOfMonth: number // 매달 며칠
  startDate: string
  endDate: string | null // null이면 무기한
  lastGeneratedMonth: string | null // 이 달("yyyy-MM")까지 예정 거래를 만들었음. 중복 생성 방지
}

export interface MonthSettings {
  yearMonth: string // "2026-09"
  reserveAmount: number // 예비비. 자유 예산에서 미리 떼어둘 금액
}
