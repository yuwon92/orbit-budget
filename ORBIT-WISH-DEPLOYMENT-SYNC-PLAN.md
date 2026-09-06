# Orbit · Orbit Wish 독립 PWA 배포 및 연동 계획

작성일: 2026-09-06

## 목표

- Orbit Budget과 Orbit Wish를 서로 다른 앱으로 유지
- 모바일 홈 화면에 두 앱을 각각 별도 아이콘으로 설치
- 각 앱의 PWA, 화면, 데이터 책임과 배포 분리
- Orbit의 예산 데이터를 Wish에서 안전하게 활용
- 모바일 브라우저 및 홈 화면 앱의 저장소 제약 대응

## 결론

두 앱을 독립 PWA로 배포하고 공용 서버를 통해 필요한 데이터만 동기화한다.

```text
Orbit Budget                       Orbit Wish
orbit.example.com                  wish.example.com
별도 아이콘·PWA                    별도 아이콘·PWA
자체 IndexedDB                     자체 IndexedDB
       │                                │
       └────── 공용 동기화 API/DB ──────┘
                       사용자 계정
```

같은 Git 저장소를 Vercel 프로젝트 두 개로 Import하되 각 앱은 별도의 배포 주소, manifest, 서비스 워커를 사용한다.

## 서버가 필요한 이유

브라우저 저장소는 origin을 기준으로 분리된다. 특히 iPhone과 iPad의 홈 화면 웹앱은 별도의 앱 컨테이너로 실행되므로, 같은 도메인 계열에 설치된 두 앱이라도 서로의 IndexedDB를 안정적으로 직접 읽는 구조로 간주하면 안 된다.

따라서 두 개의 독립된 홈 화면 앱이 계속 데이터를 공유하려면 공용 서버 또는 명시적인 수동 데이터 전달이 필요하다. 자동 연동이 목표이므로 공용 서버 방식을 기준으로 한다.

참고:

- WebKit Storage Policy: <https://webkit.org/blog/14403/updates-to-storage-policy/>
- WebKit iOS Home Screen Web App 저장소 설명: <https://webkit.org/blog/14787/webkit-features-in-safari-17-2/>
- 동일 도메인의 복수 PWA 고려사항: <https://web.dev/articles/building-multiple-pwas-on-the-same-domain>

## 배포 구조

### 권장 구조

| 구분 | Orbit Budget | Orbit Wish |
|---|---|---|
| Vercel 프로젝트 | Orbit 프로젝트 | Wish 프로젝트 |
| 앱 소스 | `apps/orbit` | `apps/wish` |
| 권장 주소 | `orbit.example.com` | `wish.example.com` |
| PWA manifest | Orbit 전용 | Wish 전용 |
| 서비스 워커 | Orbit scope | Wish scope |
| 로컬 DB | `orbital-budget` | `orbital-wish` |

`apps/wish-lab`은 디자인 비교용이므로 운영 앱으로 배포하지 않는다. 필요한 경우 Vercel Preview에서만 확인하고, 디자인이 확정되면 `apps/wish`에 반영한다.

### 기존 Orbit 주소 보존

이미 모바일 홈 화면에 추가된 Orbit이 계속 열리도록 다음 값을 함부로 바꾸지 않는다.

- 운영 도메인
- manifest `id`
- `start_url`
- `scope`
- 서비스 워커 scope

주소 변경이 필요하면 기존 주소에 리다이렉트를 두되, 설치된 PWA의 업데이트와 데이터 유지 여부를 iPhone과 Android에서 먼저 검증한다. 가능하면 기존 Orbit 운영 주소를 그대로 유지하고 Wish만 새로운 프로젝트와 주소로 추가한다.

## 데이터 책임

| 데이터 | 원본 앱 | 다른 앱의 접근 |
|---|---|---|
| 수입·지출·예산·예비비 | Orbit | Wish는 요약 읽기 |
| 남은 자유비용 | Orbit 계산 결과 | Wish는 스냅샷 읽기 |
| 위시·진행도·XP·업적 | Wish | Orbit은 필요 시 요약 읽기 |
| 위시 적립 요청 | Wish | Orbit이 승인 후 반영 |

Orbit의 계산 로직을 Wish나 서버에 복제하지 않는다. Orbit이 `budget-core`로 계산한 결과를 서버에 스냅샷으로 올리고 Wish가 이를 읽는다.

## 공용 계정과 서버

초기 서버 기능:

- 이메일 매직 링크 또는 패스키 로그인
- 두 앱이 공유하는 사용자 ID
- Orbit 예산 스냅샷 저장
- Wish와 WishEvent 저장 또는 동기화
- 마지막 동기화 시각 기록
- 기기 및 세션 관리

서버 구현은 관리형 인증과 데이터베이스 또는 별도 API로 구성할 수 있다. 구체적인 서비스는 개발 착수 전에 비용, 백업, 데이터 내보내기, 잠금 효과를 비교한 뒤 결정한다.

## 단계별 연동

### 1단계: Wish의 읽기 전용 예산 연결

1. Orbit이 남은 자유비용과 기준 월을 계산
2. 계산값과 계산 시각을 서버에 업로드
3. Wish가 동일 계정의 최신 스냅샷 조회
4. Wish에서 `사용 가능 금액`으로 표시
5. 오프라인이면 마지막 동기화 값과 경과 시간 표시

이 단계에서 Wish는 Orbit의 거래나 설정을 변경할 수 없다.

스냅샷 예시:

```ts
interface OrbitBudgetSnapshot {
  userId: string
  yearMonth: string
  freeAmount: number
  reserveAmount: number
  calculatedAt: number
  version: number
}
```

### 2단계: Wish의 가상 적립

Wish의 `오늘 모으기`는 우선 Wish 내부의 가상 배정액으로 기록한다.

```text
오늘 모으기
→ WishEvent 저장
→ Wish 진행도 증가
→ Orbit에는 아직 거래를 생성하지 않음
```

이 단계는 예산 스냅샷을 잘못 변경하거나 실제 지출과 혼동하는 문제를 피하기 위한 안전장치다.

### 3단계: Orbit 반영 요청

실제 Orbit 반영이 필요해지면 승인 흐름을 추가한다.

```text
Wish 적립
→ 서버에 Orbit 반영 대기 이벤트 생성
→ Orbit에서 사용자 확인
→ Orbit 거래·예비비·별도 배정 방식 중 확정된 규칙으로 반영
→ 처리 결과를 Wish에 동기화
```

초기에는 수동 승인을 기본으로 한다. 충분히 검증된 후에만 자동 반영을 선택 설정으로 추가한다.

## 오프라인 우선 구조

두 앱은 각각 자신의 IndexedDB를 계속 사용한다.

- 사용자 조작 즉시 로컬 저장
- 네트워크 연결 시 백그라운드 동기화
- 변경 항목에 `updatedAt`, `version`, `deletedAt` 기록
- 전송하지 못한 변경은 outbox에 보관
- 서버 반영 성공 후 outbox 정리
- 충돌 시 데이터 종류별 병합 규칙 적용

거래처럼 민감한 데이터는 단순한 최종 수정 시각 비교만 사용하지 않는다. 이벤트 ID와 처리 상태를 사용해 중복 반영을 방지한다.

## 기존 모바일 데이터 이전

현재 Orbit IndexedDB 데이터는 서버 도입 후 사용자가 명시적으로 한 번 업로드하도록 한다.

1. 로컬 데이터 백업 파일 생성
2. 로그인 또는 계정 생성
3. 업로드할 거래·카테고리·반복 규칙 수 확인
4. 서버 업로드
5. 서버 데이터와 로컬 데이터 검산
6. Wish에서 같은 계정으로 로그인
7. 예산 스냅샷 연결 확인

자동 이전보다 백업과 복구 기능을 먼저 구현한다.

## 앱 간 이동

Orbit과 Wish에 서로를 여는 링크를 둘 수 있다.

- Orbit 설정 또는 홈: `Orbit Wish 열기`
- Wish 설정: `Orbit Budget 열기`

운영체제와 브라우저에 따라 설치된 PWA 대신 브라우저가 열릴 수 있으므로 앱 간 데이터 전달을 링크 동작에 의존하지 않는다. 링크는 이동용이고 데이터 연동은 서버가 담당한다.

## 구현 순서

1. 현재 Orbit 운영 도메인, manifest, 서비스 워커 scope 확인
2. 기존 홈 화면 Orbit의 주소와 데이터 유지 조건 기록
3. Orbit과 Wish의 Vercel 프로젝트 및 도메인 확정
4. 두 PWA의 manifest `id`, 이름, 아이콘, `start_url`, `scope` 분리
5. 공용 인증과 사용자 모델 구현
6. 공용 동기화 DB와 API 구현
7. Orbit 예산 스냅샷 업로드 구현
8. Wish의 읽기 전용 스냅샷 연결
9. 백업·복구와 기존 Orbit 데이터 업로드 구현
10. Wish 가상 적립 이벤트 구현
11. Orbit 승인 기반 반영 구현
12. 오프라인 outbox와 충돌 처리 구현
13. iPhone과 Android에서 설치·업데이트·로그인·동기화 검증
14. 장애 복구와 데이터 내보내기 검증 후 자동 반영 여부 결정

## 배포 전 필수 검증

- 두 앱이 각자 다른 이름과 아이콘으로 설치되는지
- 각 아이콘이 올바른 시작 화면을 여는지
- 한 앱의 서비스 워커가 다른 앱 경로를 가로채지 않는지
- 기존 Orbit 홈 화면 앱이 업데이트 후에도 열리는지
- 기존 IndexedDB 데이터가 보존되는지
- 같은 계정으로 로그인했을 때 예산 스냅샷이 Wish에 보이는지
- 오프라인 상태에서도 두 앱의 로컬 기능이 작동하는지
- 재연결 후 중복 거래나 중복 적립이 생기지 않는지
- 로그아웃 시 기기 로컬 데이터 처리 방식이 명확한지
- 계정 삭제 및 데이터 내보내기가 가능한지

## 아직 결정해야 할 사항

- 실제 운영 도메인과 서브도메인 구성
- 인증 방식
- 서버 및 데이터베이스 제공자
- Wish 적립의 회계적 의미
- Orbit에서 적립을 거래, 예비비, 별도 배정 중 무엇으로 처리할지
- 반영 승인 방식과 취소·복구 규칙
- 여러 기기에서 동시에 수정할 때의 충돌 정책
- 계정 없이 사용할 수 있는 로컬 전용 모드 유지 여부

## 정지선

이 문서는 구현 계획만 정의한다. 현재 앱 코드, 데이터베이스, Vercel 설정, manifest 및 배포 주소는 변경하지 않는다.
