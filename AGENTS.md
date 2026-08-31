# Orbit Budget — 코드 구조 가이드

현재 코드 기준 구조 문서. 설계 의도는 [budget-app-guide.md](budget-app-guide.md), 디자인 시스템은 [budget-app-ui-guide.md](budget-app-ui-guide.md) 참고.

## 스택

React 19 + TypeScript + Vite / Dexie(IndexedDB) / date-fns / lucide-react / vite-plugin-pwa
서버·로그인·번들러 설정 없음. 라우터 없음(상태로 탭 전환). CSS 파일 하나.

## 명령

| 명령 | 내용 |
|---|---|
| `npm run dev` | 개발 서버 |
| `npm run build` | `tsc -b` + vite 빌드 |
| `npm run verify` | `scripts/verify-budget.ts` — 순수 계산 함수 검산 (node가 .ts 직접 실행) |

**계산 로직을 고치면 `npm run verify`를 반드시 통과시킬 것.** 테스트 프레임워크 없음, assert 스크립트 하나가 전부.

## 파일 지도

| 파일 | 역할 |
|---|---|
| `src/App.tsx` (472줄) | 화면 4개(Home/Calendar/Transactions/Settings) + 셸. 뷰가 전부 여기 있음 |
| `src/lib/types.ts` | 도메인 타입 전부 |
| `src/lib/budget.ts` (392줄) | **모든 계산. 순수 함수만. DB·UI 접근 금지** |
| `src/lib/db.ts` | Dexie 인스턴스, 스키마, 시드, 카테고리 팔레트 |
| `src/lib/recurring.ts` | 반복 거래 생성·동기화 (DB 쓰기) |
| `src/lib/csv.ts` | CSV 문자열 생성 + 다운로드 |
| `src/lib/hooks.ts` | `useCategories()` (sortOrder 정렬) |
| `src/lib/format.ts` | `money()` — 천 단위 콤마 |
| `src/index.css` | 전역 CSS 한 파일. 클래스명 기반 |
| `scripts/verify-budget.ts` | 검산 |
| `scripts/gen-icons.ts` | PWA 아이콘 생성 |

### 컴포넌트 (`src/components/`)

| 파일 | 역할 |
|---|---|
| `ExpenseSheet.tsx` | 거래 추가/수정 바텀시트. `transaction`=수정, `preset`=카테고리·금액 프리필 |
| `CategorySettings.tsx` (375줄) | 카테고리 목록 + 폼(예산 계산 도구 UI 포함) |
| `RecurringSettings.tsx` | 반복 거래 목록 + 폼 |
| `ReserveSheet.tsx` | 월 예비비 입력 |
| `QuickAddOrbs.tsx` | 홈 퀵 슬롯 구슬 줄 |
| `DailyBreakdown.tsx` | 홈 히어로 몫 목록. **계산 안 함, 그리기만** |
| `CategoryPlanet.tsx` | 카테고리 색 구슬 (9줄) |

## 데이터 모델 (`types.ts`)

```
Category        id, name, monthlyBudget, color, isFixed, sortOrder,
                budgetRule?, hiddenOnHome?, quickSlot?
Transaction     id, date('yyyy-MM-dd'), amount(항상 양수), type, categoryId|null,
                memo, isPlanned, createdAt, recurringRuleId?
RecurringRule   id, name, amount, type, categoryId, dayOfMonth,
                startDate, endDate|null, lastGeneratedMonth|null
MonthSettings   yearMonth('yyyy-MM'), reserveAmount
```

```ts
Frequency  = { mode:'perWeek'; timesPerWeek } | { mode:'weekdays'; weekdays:number[]; timesPerDay }
BudgetRule = { kind:'manual' }
           | { kind:'perUse';  unitAmount; freq }      // 한 번에 얼마 x 횟수
           | { kind:'commute'; fare; roundTrip; freq } // 편도 요금 x 왕복
           | { kind:'recurringSum' }                   // 이 카테고리 반복 지출 합
```

날짜는 전부 `'yyyy-MM-dd'` 문자열, 월은 `'yyyy-MM'`. 문자열 비교로 대소 판단(`t.date < today`).
요일은 `0=일 … 6=토`. 주 시작은 **일요일**(`weekStartsOn: 0`, 달력과 일치).

## DB

Dexie `'orbital-budget'`. 스토어: `categories`(id) / `transactions`(id, **date**, categoryId) / `recurringRules`(id) / `monthSettings`(yearMonth).

- **인덱스가 아닌 필드 추가는 버전 업 불필요.** `budgetRule`·`hiddenOnHome`·`quickSlot` 전부 무마이그레이션으로 추가됨
- `db.version(2).stores({})`는 빈 선언이지만 **지우면 기존 DB가 안 열림**
- `db.on('populate')`로 기본 카테고리 4개 시드(예산 0)

## 계산 (`budget.ts`)

전부 순수 함수. 금액은 정수, 나눗셈은 `Math.floor` 내림이 기본.

**오늘 예산 흐름**
```
availableAmount = totalIncome - occurredExpense(오늘 이전)
calcTodayBudget = (availableAmount - upcomingExpense - reserveAmount) / remainingDays
remainingToday  = todayBudget - spentOnDate(오늘)
```

**예산 계산 도구** — `budgetRule` → 월 예산
`weeksInMonth` `weekdayCountInMonth` `monthlyOccurrences` `budgetFromRule`
`activeRecurringForCategory` `recurringSumForCategory`
- 요일 지정이면 **그 달 실제 요일 수**로 계산(달마다 값이 다름)
- **횟수를 먼저 반올림**해서 금액이 단가의 배수로 떨어짐 (6,500 x 43회)
- 구독 합계는 발생일이 아니라 **규칙이 그 달에 걸쳐 있는지**로 판정

**홈 히어로** — `buildBreakdown` → `BreakdownRow[]`, `breakdownTotal`
- `periodAllowance` — 주 한도면 **주 예산**, 요일 지정이면 **그날 몫**(아닌 날은 0)
- `dailyAllowance` — 하루 환산. **'자유' 몫 계산에만** 사용
- `usageLimit` — `{scope:'week'|'day', limit, active}`. 교통 왕복이면 한도 2배(편도마다 한 번 누름)
- `자유 = 오늘 예산 - Σ(보이는 카테고리 하루 환산) - (그 카테고리들 밖의 오늘 지출)`
- **히어로 큰 숫자 = 줄들의 합**(`breakdownTotal`). 주 단위 줄이 섞이므로 순수한 하루치가 아님

**퀵 슬롯** — `quickAddAmount`(교통은 **편도**), `inQuickSlot`(`quickSlot ?? 단가 있으면 true`)

`freeBudget`은 검산 전용, 화면 미사용.

## 화면 (`App.tsx`)

`App`이 탭·테마·시트·설정 하위화면 상태를 전부 보유. 자식에 콜백으로 내려줌.

```ts
active:      'home' | 'calendar' | 'transactions' | 'settings'
settingsSub: 'categories' | 'recurring' | null
sheet:       { transaction?, preset? } | null   // {}=추가, transaction=수정, preset=프리필
dark:        boolean → <html class="dark">
```

앱 시작 시 `materializeRecurring()` → `syncRuleBudgets()` → `requestPersistentStorage()`.

**HomeView** 구성: 히어로(큰 숫자 · 오늘 예산 · `DailyBreakdown` · 오늘 사용액) → `QuickAddOrbs`(**카드 밖**) → 이번 달 예산 카드 그리드 → 오늘 내역.
카드의 ⋯ 메뉴에서 `홈에서 숨기기`(횟수·교통만) / `퀵 슬롯에서 숨기기·추가하기`(전 카테고리) 토글. `menuFor` state 하나로 한 번에 하나만 열림.

**반복 거래 동기화** — `RecurringSettings`에서 규칙을 저장·삭제하면 `resyncRuleForMonth`/`deleteRule` 후 `syncRuleBudgets` 호출. `budgetRule`이 `manual`이 아닌 카테고리의 `monthlyBudget`만 덮어씀.

## 스타일 규칙

- `src/index.css` 한 파일. 상단은 원본 프로토타입 CSS(한 줄에 몰아쓴 압축 형태), **하단이 기능별 오버라이드 블록**. 새 스타일은 파일 **끝에 주석 헤더와 함께 추가**하고, 기존 규칙 수정보다 오버라이드를 우선
- 반응형 분기: 900 / 680 / 400px
- 테마: `:root` 변수 + `:root.dark` 재정의. 색은 항상 `var(--...)`
- **텍스트에 배경색 칩·하이라이트 금지.** 상태 구분은 색 점 + 부호 + 흐린 회색 텍스트
- 음수는 `.negative` / `.over` 클래스로 `var(--danger)`

## 함정

- **전역 `.dot{position:absolute}`** 이 행성 장식용으로 존재. 목록용 점은 `.cat-dot` 사용
- `@media(max-width:400px)`에서 카드가 2단 그리드로 바뀜. `.category-top>button`은 그 폭에서 절대 위치로 고정
- 주간 집계는 주가 달을 걸치므로 월 쿼리(`startsWith(month)`)로 부족. `where('date').between(weekStart, weekEnd)` 별도 조회 필요
- `useLiveQuery`는 Dexie 경유 변경만 감지. 테스트에서 raw IndexedDB로 쓰면 갱신 안 됨(새로고침 필요)
- `ExpenseSheet` 저장 시 `createdAt`·`recurringRuleId` 보존
- 메모 없는 거래는 목록에서 제목이 곧 카테고리명 → 부제목 생략

## 문서 상태

- `README.md` — 사용자용. 기능·계산식·주의사항
- `budget-app-guide.md` / `budget-app-ui-guide.md` — 기획·디자인 원본
- ⚠️ `CURRENT-UI-GUIDE.md` — **오래됨.** "목업 데이터, DB·계산·CSV 미구현"이라고 적혀 있으나 전부 구현됨. 신뢰하지 말 것
