# Orbit 제품군 — 코드 구조 가이드

Orbit Budget과 companion 앱 Orbit Wish의 현재 코드 기준 구조 문서. 설계 의도는 `budget-app-guide.md`, 디자인 시스템은 `budget-app-ui-guide.md` (둘 다 gitignore된 로컬 전용 파일).

## 스택

React 19 + TypeScript + Vite / Dexie(IndexedDB) / date-fns / lucide-react / vite-plugin-pwa
서버·로그인 없음. 데이터는 전부 브라우저 로컬. 두 앱은 동일 origin에서 `orbital-budget` DB를 연결하고 Wish 자체 데이터는 `orbital-wish` DB에 분리.

## 명령

| 명령 | 내용 |
|---|---|
| `npm run dev` | 두 앱 통합 개발 서버 (`/apps/orbit/`, `/apps/wish/`). IndexedDB 공유 검증에 필수 |
| `npm run dev:orbit` | Orbit 단독 개발 서버 |
| `npm run dev:wish` | Wish 단독 개발 서버 |
| `npm run build` | `clean → wish → orbit` 순서 고정. Orbit 빌드가 `wish/**`까지 서비스 워커에 담는다 |
| `npm run verify` | `verify-budget.ts` + `verify-wish.ts` — 순수 계산 검산 (node가 .ts 직접 실행) |

**계산 로직을 고치면 `npm run verify`를 반드시 통과시킬 것.** 테스트 프레임워크 없음, assert 스크립트 하나가 전부.

## 파일 지도

| 파일 | 역할 |
|---|---|
| `apps/orbit/src/App.tsx` | Orbit 화면 4개(Home/Calendar/Transactions/Settings) + 셸 |
| `apps/orbit/src/lib/sheet.ts` | 바텀시트용 훅 — `useSheetViewport`, `useSheetFocus` |
| `apps/orbit/src/lib/csv.ts` | CSV 문자열 생성 + 다운로드 |
| `apps/orbit/src/lib/hooks.ts` | `useCategories()` (sortOrder 정렬) |
| `apps/orbit/src/index.css` | Orbit 전역 CSS 한 파일. 클래스명 기반 |
| `apps/wish/src/App.tsx` | Wish 셸 — 탭·테마·시트·저장소 구독. 화면은 갖지 않음 |
| `apps/wish/src/screens/` | 탭 화면 4개 — `HubScreen`(오르빗 허브)/`QuestScreen`(퀘스트 로그)/`CodexScreen`(우주 도감)/`ObservatoryScreen`(관측소). 관측소 하위 화면도 여기 |
| `apps/wish/src/missions.ts` | 오늘의 미션 문구·상태. 앱 고유 개념이라 wish-core에 두지 않음 |
| `apps/wish/src/planet.ts` | 픽셀 행성 블록 생성. 진행률 → 티끌·위성·행성·고리·위성대·성계 |
| `apps/wish/src/cosmetics.ts` | 꾸미기 16종의 ID·표시명·해금 레벨·색상/픽셀 좌표 원본(source of truth) |
| `apps/wish/src/cosmeticBlocks.ts` | 꾸미기 데이터를 SVG `rect` 블록으로 변환하고 seed 기반 결정적 배치를 만드는 렌더러 |
| `apps/wish/src/lib/labels.ts` | 단계 이름·칭호 문구·도감 칸 수 |
| `apps/wish/src/lib/hooks.ts` | `useWishes`/`useWishEvents`/`useClaims`/`usePlayer`. **App에서만 구독하고 prop으로 내림** |
| `apps/wish/src/lib/budget.ts` | Orbit 예산 요약을 읽는 통로. 저장소가 나뉘는 환경에서는 **이 파일만 서버 조회로 교체** |
| `apps/wish/src/lib/format.ts` | `todayString`·`formatDate`·`pad2` |
| `apps/wish/src/components/` | `PixelPlanet`(행성·궤도 링), `PixelBar`, `OrbitMap`, `RewardOverlay`, `Sheets` |
| `apps/wish/src/components/PlanetCosmeticsPreview.tsx` | 꾸미기 프리셋 개발용 비교 화면. `npm run dev` → `/apps/wish/?cosmetics-preview`. 프로덕션 번들에서는 트리셰이킹으로 빠진다 |
| `apps/wish/src/index.css` | Wish 전역 CSS 한 파일. 밝은 노랑 우주 |
| `packages/wish-core/src/types.ts` | Wish·WishEvent·Claim·Player 타입 |
| `packages/wish-core/src/wish.ts` | 하루 몫·남은 일수·하루 판정·월 저금 합계·구매 잠금. **순수 함수만** |
| `packages/wish-core/src/xp.ts` | 배점표·레벨 곡선·미션 수령 단위·연속 기록·통계·칭호. **순수 함수만** |
| `packages/wish-bridge/src/db.ts` | `orbital-wish` Dexie 인스턴스와 v1 스키마 |
| `packages/wish-bridge/src/index.ts` | **위시 데이터의 유일한 쓰기 창구.** 이벤트와 savedAmount를 한 트랜잭션에서 갱신 |
| `packages/budget-core/src/types.ts` | Orbit 도메인 타입 전부 |
| `packages/budget-core/src/budget.ts` | **모든 계산. 순수 함수만. DB·UI 접근 금지** |
| `packages/budget-core/src/format.ts` | 금액·요일 표시 함수 |
| `packages/orbit-bridge/src/db.ts` | Orbit Dexie 인스턴스, 스키마·마이그레이션, 쓰기 헬퍼 |
| `packages/orbit-bridge/src/recurring.ts` | 반복 거래 생성·동기화 |
| `packages/orbit-bridge/src/index.ts` | Wish용 예산 스냅샷(`OrbitBudgetSnapshot`) + 자유비용 제외 위시 구매 거래 쓰기. 어제 남은 예산(`carryoverAmount`)도 여기서 계산 |
| `packages/orbit-bridge/src/settings.ts` | 두 앱이 함께 읽는 설정(`orbit-planned-income`) |
| `scripts/verify-budget.ts` | Orbit 계산 검산 |
| `scripts/verify-wish.ts` | Wish 계산 검산 |
| `scripts/gen-icons.ts` | PWA 아이콘 생성 |

**설치되는 PWA는 하나다.** iOS가 홈 화면 앱마다 저장소를 나누기 때문에, 아이콘을 두 개 만들면 Wish가 Orbit 예산을 읽지 못한다(기기 확인 완료). manifest·서비스 워커는 `apps/orbit`에만 있고 Wish는 같은 앱의 `/wish/` 화면이다. 코드베이스는 그대로 분리돼 있어 나중에 도메인을 나눌 때 manifest만 되살리면 된다.

Wish는 게임 허브 흐름이다. 자원 HUD 상시 노출, 오늘의 미션과 보상 수령, 퀘스트 로그·우주 도감 분리, 설정은 관측소 설정 하위 화면. 제품 규칙과 수치는 `orbit-wish-spec.md`, 디자인은 `orbit-wish-ui-design-guide.md`(둘 다 gitignore된 로컬 문서).

**관측소 하위 화면은 `.wl-content` 안에서 탭 뷰 전체를 대체한다.** 바텀시트가 아니고 하단 탭·HUD는 그대로 둔다 — 680px 이하에서 `.wl-nav`는 셸의 flex 아이템이라 숨기면 스크롤이 튄다. 상태는 `App.tsx`의 `obsSub` 하나이고, 탭 이동은 `goScreen()`을 거쳐 `obsSub`를 반드시 비운다(안 그러면 다른 탭에 갔다 돌아왔을 때 하위 화면이 그대로 뜬다). 뒤로가기는 각 화면 헤더의 `.back-button`뿐 — 라우터가 없어 브라우저·스와이프 뒤로가기는 미지원. 알려진 격차.

Wish는 Orbit 예산을 `getOrbitSnapshot()`으로 읽고, 구매 확정 때만 `createWishPurchaseTransaction()`으로 거래를 쓴다. `connected`는 DB가 열리는지가 아니라 데이터가 있는지로 판단한다 — 저장소가 분리된 환경에서는 빈 DB가 새로 만들어질 뿐이라 존재 여부로는 알 수 없다. 위시 저금은 이번 달 순저금 합계로 자유비용에서 실제 차감한다. 스냅샷의 `carryoverAmount`는 어제 끝난 예산 기간에서 자유비용으로 넘어온 잔액 합계(`releasedLeftovers`)이며, 카테고리별 내역은 `carryoverRows`에 그대로 실어 보낸다. 남은 자유비용을 넘지 않게 자른다 — 스냅샷이 이번 달 거래만 읽으므로 매달 1일은 기준일이 지난달이라 0이고 `carryoverDate`도 null이다.

**Wish 데이터는 `orbital-wish`(Dexie)에 저장된다.** 위시·이벤트·수령 기록·Player 네 스토어. 화면은 `packages/wish-bridge`를 통해서만 쓰고, Wish 앱 읽기는 `apps/wish/src/lib/hooks.ts`의 `useLiveQuery` 네 개가 전부다. Orbit 홈은 `listWishes()`·`listWishEvents()`를 live query로 읽어 기간이 있는 active 위시만 표시한다.

**하루 몫과 남은 예산 넘기기는 별개 미션이다.** `deposit`의 `source`가 갈라준다 — `manual`만 하루 몫 판정(`actionDepositsOn`·`dayStatus`)에 들어가고, `carryover`는 자기 미션만, `transfer`는 어느 쪽도 아니다. 넘기기로 하루 몫이 채워지면 안 된다.

**XP는 어디에도 저장하지 않는다.** `WishEvent`와 `Claim`(수령 영수증)에서 매번 다시 계산한다. 배점을 바꾸면 과거 기록도 새 배점으로 재계산된다. 미션은 행마다 개별 수령 버튼이 있고 아래 `CLAIM` 버튼이 미수령 전부를 한 번에 받는다. 승격 전 초안(위시 상세 중심 4탭, `PlanetVisual`, `orbital-wish` 스키마 선언)은 커밋 `70d9ce5`에 남아 있다.

**Wish 꾸미기 원본은 별도 이미지가 아니라 `apps/wish/src/cosmetics.ts`의 팔레트와 픽셀 좌표 코드다.** 프리셋 ID는 팔레트 `solar`/`mint`/`coral`/`lavender`, 링 `single`/`double`/`debris`, 궤도 장식 `moonlet`/`probe`/`meteor`/`star-cluster`, 배경 `starfield`/`nebula`/`constellation`, 완주 효과 `sparkles`/`comet-trail`의 총 16개다. `cosmeticBlocks.ts`가 이를 SVG `rect`로 변환하며 seed가 같으면 같은 배치가 나오게 한다. 전체 비교는 개발 URL `/apps/wish/?cosmetics-preview`(`npm run dev:wish`면 `/?cosmetics-preview`)의 `PlanetCosmeticsPreview.tsx`에서 한다. 프리뷰 전용 CSS는 `components/PlanetCosmeticsPreview.css`에 따로 둔다 — `index.css`에 두면 쓰지 않는 100줄이 배포 CSS에 실린다(JS는 빠지는데 CSS만 남는다). 별도 SVG/PNG를 만들거나 `exports/wish-planets`에 섞지 않는다. 해당 폴더는 기존 행성 성장 단계 추출물이다. 현재 꾸미기는 `Player`·DB·`wish-bridge` 저장에 연결하지 않았으며, 향후에는 선택한 프리셋 ID만 연결해 저장한다.

### Orbit 컴포넌트 (`apps/orbit/src/components/`)

| 파일 | 역할 |
|---|---|
| `ExpenseSheet.tsx` | 거래 추가/수정 바텀시트. `transaction`=수정, `preset`=카테고리·금액 프리필, `initialDate`=날짜 지정 |
| `CategorySettings.tsx` (381줄) | 카테고리 목록 + 폼(예산 계산 도구 UI 포함) |
| `RecurringSettings.tsx` | 반복 거래 목록 + 폼 |
| `ReserveSheet.tsx` | 월 예비비 입력 |
| `QuickAddOrbs.tsx` | 홈 퀵 슬롯 구슬 줄 + 편집(표시 토글·순서 이동) + 실행 취소 알림 |
| `WishSavings.tsx` | 홈 위시 저금 줄 + 금액 조정·못 모아요 전용 시트 |
| `DailyBreakdown.tsx` | 홈 히어로 예산 행 목록. **계산 안 함, 그리기만** |
| `CategoryPlanet.tsx` | 카테고리 색 구슬 (9줄) |

## 데이터 모델 (`types.ts`)

```
Category        id, name, monthlyBudget, color, isFixed, sortOrder,
                budgetRule?, hiddenOnHome?, quickSlot?, quickOrder?
Transaction     id, date('yyyy-MM-dd'), amount(항상 양수), type, categoryId|null,
                memo, isPlanned, createdAt, recurringRuleId?, excludedFromFreeAmount?
RecurringRule   id, name, amount, type, categoryId, interval?('monthly'|'weekly'),
                dayOfMonth, weekdays?(0=일…6=토, 여러 개),
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
요일은 `0=일 … 6=토`. 주 예산 기간의 주 시작은 **월요일**(월~일). 달력 화면 그리드는 일요일 시작.

- `interval`이 없으면 월 단위(예전 규칙). 주 단위는 `weekdays`(여러 요일 가능)를 쓰고 `dayOfMonth`는 안 씀(주기를 되돌릴 때를 위해 값은 남겨둠)
- `isPlanned`는 저장 시 `date > 오늘`로 자동 결정. `materializeRecurring`이 앱을 열 때 오늘 이하 날짜를 전부 `false`로 확정
- `excludedFromFreeAmount`는 위시 구매 거래 전용. 거래·카테고리 통계에는 포함하지만 `monthlyFreeAmount`에서는 완전히 제외
- `hiddenOnHome`은 히어로 예산 행 **표시만** 숨김. 계산에는 그대로 들어감
- `isFixed`는 현재 **라벨 전용**(목록의 `고정비` 칩). 계산에서 안 씀
- `quickOrder`는 퀵 슬롯 줄에서의 순서. 없으면 `sortOrder` 순으로 뒤에 붙음
- 카테고리 순서(`sortOrder`)를 바꾸는 UI는 없음. 순서 변경 UI는 퀵 슬롯에만 있음

## DB

Dexie `'orbital-budget'`. 스토어: `categories`(id) / `transactions`(id, **date**, categoryId) / `recurringRules`(id) / `monthSettings`(yearMonth).

- **인덱스가 아닌 필드 추가는 버전 업 불필요.** `budgetRule`·`hiddenOnHome`·`quickSlot`·`quickOrder` 전부 무마이그레이션으로 추가됨
- `db.version(2).stores({})`는 빈 선언이지만 **지우면 기존 DB가 안 열림**
- `db.version(3)`은 구 팔레트 색 → v2 팔레트 색 1회 치환. 팔레트 밖 사용자 지정 색은 보존
- `db.on('populate')`로 기본 카테고리 4개 시드(예산 0)
- 퀵 슬롯 쓰기는 `setQuickSlot`·`moveQuickSlot`이 담당. 둘 다 트랜잭션 안에서 `quickOrder`를 0..n-1로 **다시 매김**(번호 없는 슬롯이 섞이면 새 슬롯이 맨 앞으로 튄다)
- `db.ts` → `budget.ts` 단방향 import. 반대 방향(계산이 DB를 읽는 것) 금지

## 계산 (`budget.ts`)

전부 순수 함수. 금액은 정수, 나눗셈은 `Math.floor` 내림이 기본.

**자유비용 모델** — 히어로 큰 숫자는 `monthlyFreeAmount` 하나다.

```
남은 자유비용 = 총수입 - Σ(카테고리 월 예산) - 예비비 + 조정
```

조정(`adjustment`)에 들어가는 것:

- 카테고리가 없거나 지워진 카테고리의 지출 → **전액 즉시 차감**(실제·예정 구분 없음)
- 기간 예산을 넘긴 만큼 → **즉시 차감**
- **이미 끝난** 일/주 기간의 미사용액 → 자유비용으로 환급. 진행 중·미래 기간의 잔액은 카테고리에 남겨둠
- 어떤 예산 기간에도 안 걸치는 날의 지출(요일 지정 카테고리의 비지정 요일 등) → 전액 차감

`monthlyFreeAmount(txs, categories, today, reserve, includePlannedIncome = true, wishSavedAmount = 0)` — `includePlannedIncome`이 false면 `isPlanned` 수입을 빼고 센다(설정 첫 카드의 `자유비용에 예정 수입 포함` 토글). **수입에만 걸린다.** 예정 지출은 어차피 나갈 돈이라 늘 차감한다. `wishSavedAmount`는 이번 달 순저금으로 예비비처럼 한 번 차감한다.

**기간 배분**(내부 `categoryBudgetPeriods`) — 횟수·교통 카테고리의 월 예산을 실제 달력 주/요일 기간에 앞에서부터 채운다. 달을 걸치는 주는 월 경계에서 자르고, 배분 총합은 월 예산을 넘지 않는다.

**끝난 기간의 잔액 환급** — Wish의 `남은 예산 저금하기` 미션이 가져가는 값.

- `releasedLeftovers(categories, transactions, date)` → `ReleasedLeftover[]`. 그 날로 끝난 예산 기간(`period.to === date`)마다 `allowance - spent`가 양수인 줄
- `releasedLeftoverTotal(...)` — 그 합계. **다음 날 자유비용에 더해지는 금액과 같은 값**(위 조정의 `period.to < today` 환급). 두 계산이 갈라지면 안 됨 — 검산이 날 경계 전후 `monthlyFreeAmount` 차이와 대조한다
- 요일 지정 카테고리는 사용일마다, 주 단위 카테고리는 주가 끝나는 일요일(또는 월말)에만 한 줄
- 초과한 기간은 줄이 없다. 초과분은 쓴 그 날 이미 차감됐다
- `manual`·`recurringSum`은 기간이 월 전체라 날마다 풀리는 잔액이 없다

**예산 계산 도구** — `budgetRule` → 월 예산
`weeksInMonth` `weekdayCountInMonth` `monthlyOccurrences` `budgetFromRule`
`activeRecurringForCategory` `monthlyAmountForRule` `recurringSumForCategory`

- 요일 지정이면 **그 달 실제 요일 수**로 계산(달마다 값이 다름)
- **횟수를 먼저 반올림**해서 금액이 단가의 배수로 떨어짐 (6,500 x 43회)
- 구독 합계는 발생일이 아니라 **규칙이 그 달에 걸쳐 있는지**로 판정
- 주 단위 규칙의 월 부담은 `monthlyAmountForRule` — 금액 x **고른 요일들이 그 달에 나오는 횟수**(`weekdayCountInMonth`). 시작·종료로 잘린 달도 온전한 한 달치로 잡는다

**히어로 예산 행** — `buildBreakdown(categories, transactions, today)` → `BreakdownRow[]`

- `budgetRule`이 횟수·교통인 카테고리만 한 줄씩. **'자유' 행은 없음**(자유비용은 큰 숫자 하나로 표시)
- 줄마다 자기 기간: 주 한도면 이번 주, 요일 지정이면 오늘 몫(비지정 요일은 0원 행 + `active:false`)
- `usageLimit` — `{scope:'week'|'day', limit, active}`. 교통 왕복이면 한도 2배(편도마다 한 번 누름)

**퀵 슬롯** — `quickAddAmount`(교통은 **편도**), `inQuickSlot`(`quickSlot ?? 단가 있으면 true`), `quickSlotCategories`(`quickOrder` 순, 미지정은 `sortOrder`로 뒤에)

`calcTodayBudget`·`dailyAllowance`·`breakdownTotal`·`freeBudget` 등 옛 "오늘 예산" 계열 함수는 자유비용 개편 때 **삭제됨**. 오래된 코드나 문서에서 이름을 보면 되살리지 말 것.

## 화면 (`App.tsx`)

`App`이 탭·테마·시트·설정 하위화면 상태를 전부 보유. 자식에 콜백으로 내려줌.

```ts
active:      'home' | 'calendar' | 'transactions' | 'settings'
settingsSub: 'categories' | 'recurring' | null
sheet:       { transaction?, preset?, initialDate? } | null   // {}=추가
dark:        boolean → <html class="dark">
plannedIncome: boolean  // 자유비용에 예정 수입을 넣을지. 기본 true
```

`plannedIncome`은 `localStorage['orbit-planned-income']`(`'include'`|`'exclude'`)에 저장하고, 값이 없으면 포함이 기본이다. `monthlyFreeAmount`의 `includePlannedIncome` 인자로만 흘러간다 — 사이드바 사용률·거래 목록 같은 다른 화면은 예정 수입을 늘 포함한다.

테마는 `localStorage['orbit-theme']`에 저장하고, 고른 적이 없으면 `prefers-color-scheme`를 따른다. `index.html`의 인라인 스크립트가 첫 페인트 전에 같은 키를 읽어 `.dark`를 붙인다(키를 바꾸면 양쪽 다 고칠 것).

`useToday()`가 1분마다 날짜를 확인해 자정을 넘기면 화면과 동기화를 다시 돌린다.
날짜가 바뀔 때마다 `materializeRecurring()` → `syncRuleBudgets()`, 최초 1회 `requestPersistentStorage()`.

**HomeView** — 히어로(`남은 자유비용` 큰 숫자 · 오늘 사용액 · `DailyBreakdown`) → `QuickAddOrbs`(**카드 밖**) → `WishSavings`(대상 있을 때만) → 이번 달 예산 카드 그리드 → 오늘 내역.
카드 그리드는 **모든 카테고리**를 낸다. `monthlyBudget > 0`이면 진행률·남은 금액·진행바, 아니면 사용액과 `예산 미설정` 한 줄만. 섹션 헤더 `편집` → 카테고리 설정.
카드 제목은 버튼(`.category-title`) — 누르면 거래 내역으로 이동하며 그 카테고리 · 이번 달 1일~말일 필터가 걸린다(`TxFocus`).
카드 ⋯ 메뉴: `홈에서 숨기기`(횟수·교통만) / `퀵 슬롯에서 숨기기·추가하기`(전 카테고리). `menuFor` state 하나로 한 번에 하나만 열림.

**TransactionsView** — `전체`·`예정` 탭 → 검색·필터 줄 → 조회 기간 줄 → 날짜별 그룹.

- 조회 기간 기본값은 **오늘까지 최근 1주일**(`presetRange('week')`). 프리셋 `1주일`/`1개월`/`전체`, 날짜 직접 지정 가능. `전체`는 빈 문자열로 경계 없음
- 홈 카드에서 넘어오면 `focus` prop으로 카테고리 필터·조회 기간을 **초기 state에** 넣고 필터 패널을 펼친 채 연다. 반영 즉시 `clearFocus()`로 비워, 나중에 탭으로 다시 들어올 때 옛 필터가 되살아나지 않게 한다(탭·사이드바로 거래 탭에 들어갈 때도 `txFocus`를 비움)
- `예정` 탭은 **조회 기간을 무시**하고 `isPlanned`만 모아 가까운 날짜부터(오름차순) 보여줌. 검색·종류·카테고리 필터는 두 탭 모두에 걸림

**셸** — 홈·거래 탭에서만 추가 버튼. 데스크톱은 `.desktop-add`(fixed 알약), 모바일은 `.fab-add`(오른쪽 아래 원형).

**반복 거래 동기화** — `RecurringSettings`에서 규칙을 저장·삭제하면 `resyncRuleForMonth`/`deleteRule` 후 `syncRuleBudgets` 호출. `budgetRule`이 `manual`이 아닌 카테고리의 `monthlyBudget`만 덮어씀.

`occurrenceDates(rule, month)`가 그 달 발생일 전부를 낸다 — 월 단위 0~1건, 주 단위는 고른 요일마다 4~5건씩. `materializeRecurring`은 `lastGeneratedMonth`로 달 단위 중복을 막고, **이미 있는 날짜는 건너뛴다**. 그래서 `resyncRuleForMonth`가 `lastGeneratedMonth`를 늘 `null`로 되돌려도 지난 발생분이 다시 생기지 않고, 주 단위 규칙을 달 중간에 고쳐도 남은 날짜가 새 값으로 다시 선다.

## 모바일 셸 레이아웃 (680px 이하)

주소창이 접혔다 펴지며 하단 바가 흔들리거나 들뜨는 문제를 이 구조로 막았다. **건드리기 전에 이유를 볼 것.**

- `html,body{height:100%;overflow:hidden;overscroll-behavior:none}` — 페이지 자체는 스크롤하지 않음
- `.app-shell{height:100dvh;display:flex;flex-direction:column}` — `dvh`라 보이는 영역을 따라감(`svh`면 주소창이 접힐 때 하단 바가 들뜬다)
- 스크롤은 `main` 하나만(`overflow-y:auto`). `.bottom-nav`는 `position:static` 플렉스 아이템
- 화면에 고정할 요소는 `position:fixed`가 아니라 **셸 기준 `position:absolute`**(`.fab-add`가 그 예). 하단 바 위 여백은 `bottom:92px`(바 76px + 16px)
- 하단에 겹치는 것들: `.fab-add` → `.quick-undo-toast{bottom:160px}` → 본문 아래 여백 64px

## 스타일 규칙

- `apps/orbit/src/index.css` 한 파일. 상단은 원본 프로토타입 CSS(한 줄에 몰아쓴 압축 형태), **하단이 기능별 오버라이드 블록**. 새 스타일은 파일 **끝에 주석 헤더와 함께 추가**하고, 기존 규칙 수정보다 오버라이드를 우선
- 반응형 분기: 900 / 680 / 400px
- 테마: `:root` 변수 + `:root.dark` 재정의. 색은 항상 `var(--...)`
- **텍스트에 배경색 칩·하이라이트 금지.** 상태 구분은 색 점 + 부호 + 흐린 회색 텍스트
- 음수는 `.negative` / `.over` 클래스로 `var(--danger)`
- 카테고리 구슬(`.category-planet`)의 하이라이트는 **비율값**(25%/21.5%). 크기를 바꿔도 모양이 같아야 함

## 함정

- **Wish 하단 탭 아이콘은 위치 기반**(`apps/wish/src/index.css` `.wl-nav button:nth-child(n)`). 🪐🚀⭐🔭가 `NAV` 배열 순서가 아니라 **자식 순서**에 묶여 있다. 탭을 늘리거나 순서를 바꾸면 아이콘이 조용히 어긋난다 — 탭은 4개 고정이고, 새 화면은 탭이 아니라 하위 화면 상태로 붙일 것
- **전역 `.dot{position:absolute}`** 이 행성 장식용으로 존재. 목록용 점은 `.cat-dot` 사용
- 달력 점 색 클래스(`.planned`/`.income`/`.spent`)는 이름이 흔해 다른 곳과 부딪힌다. `.calendar-amount`/`.calendar-legend` 안으로 한정해 뒀으니 전역으로 되돌리지 말 것(예전엔 `!important` 전역이라 거래 내역 수입 원 배경까지 덮었다)
- `.category-card p{font-size:12px}`가 카드 안 모든 `p`를 이김. 카드 안에 작은 글씨를 넣으려면 `.category-card .클래스`로 선택자를 올릴 것
- `@media(max-width:400px)`에서 카드가 2단 그리드로 바뀜. `.category-top>button`은 그 폭에서 절대 위치로 고정
- 모바일에서 `input{font-size:16px!important}`(iOS 확대 방지). 작은 입력칸을 만들 때 크기가 예상과 다름
- 글자를 `font-size:0`으로 숨긴 버튼은 `gap`·`padding`이 남아 아이콘이 한쪽으로 쏠림. 정사각형 + `justify-content:center`로 잡을 것
- `useLiveQuery`는 Dexie 경유 변경만 감지. 테스트에서 raw IndexedDB로 쓰면 갱신 안 됨(새로고침 필요)
- `ExpenseSheet` 저장 시 `createdAt`·`recurringRuleId` 보존
- 메모 없는 거래는 목록에서 제목이 곧 카테고리명 → 부제목 생략

## 문서 상태

- `README.md` — 사용자용. 기능·계산식·주의사항. 명사형으로 짧게, 서술형 배경 설명 금지
- `budget-app-guide.md` / `budget-app-ui-guide.md` — 기획·디자인 원본. gitignore된 로컬 전용
