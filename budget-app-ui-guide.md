# Budget App UI Design Guide

## 1. Design Concept

### Core Theme: My Financial Planet

앱 전체의 디자인 모티프는 **행성(Planet)** 으로 한다.

행성은 단순한 장식 요소가 아니라 다음처럼 앱의 구조와 느슨하게 연결한다.

- 한 달의 예산 = 하나의 행성
- 내가 사용할 수 있는 돈 = 행성의 에너지
- 카테고리 = 행성을 둘러싼 작은 위성
- 소비 진행률 = orbit 또는 ring
- 예정 지출 = 앞으로 다가오는 작은 천체

다만 모든 UI를 우주처럼 만들지는 않는다.

기본 원칙은 다음과 같다.

> Financial App 80% + Planet Identity 20%

전체적으로는 **깔끔하고 차분한 금융 앱**을 유지하고, 특정 화면과 포인트에서만 **pastel cosmic / pixel-space aesthetic**이 드러나도록 한다.

---

## 2. No Emoji Policy

앱에서는 **이모지를 전혀 사용하지 않는다.**

카테고리, 버튼, 네비게이션, 빈 상태, 알림, 상태 표시 등 모든 UI에서 이모지 대신 다음 요소를 사용한다.

- Lucide Icons
- Phosphor Icons
- 직접 제작한 단순한 SVG
- CSS로 만든 원, 궤도, 점, 선
- pixel-art 스타일의 커스텀 그래픽

예를 들어 식비, 카페, 교통 같은 카테고리도 음식이나 탈것 이모지를 쓰지 않는다.

대신 다음처럼 처리한다.

- Food: 작은 원형 행성 아이콘
- Cafe: ring이 있는 소형 행성 아이콘
- Transport: orbit line이 긴 행성 아이콘
- Subscription: 작은 위성이 붙은 행성 아이콘
- Investment: 서로 다른 크기의 두 원
- Etc: neutral dot 또는 plain category icon

앱 전체에서 이모지가 하나라도 섞이면 디자인 언어가 급격히 가벼워질 수 있으므로 금지한다.

---

## 3. Visual Direction

레퍼런스 이미지에서 가져올 요소는 다음 정도다.

### 가져올 것

- Powder blue
- Cyan / aqua
- Lavender
- Pale pink
- Soft yellow
- Iridescent 느낌의 색 조합
- Saturn-like ring
- 작은 별 또는 sparkle을 연상시키는 기하학적 포인트
- 약간의 pixel-art 감성
- Dark background에서 은은한 glow

### 그대로 가져오지 않을 것

- 지나치게 많은 pixel texture
- 복잡한 별 배경
- 강한 neon
- 게임 UI 같은 테두리
- pixel font
- 모든 카드의 gradient
- 모든 버튼의 glow
- CD 자체를 직접적인 핵심 모티프로 사용하는 것
- 이모지

목표는 다음과 같다.

> Pixel space game UI가 아니라, 깔끔한 금융 앱에 Y2K cosmic identity가 들어간 느낌

---

## 4. Overall Design Keywords

### 지향

- Clean
- Calm
- Soft
- Cosmic
- Iridescent
- Friendly
- Minimal
- Slightly playful

### 피해야 할 방향

- Cyberpunk
- Gamer
- Crypto
- Neon fintech
- Childish
- Excessively cute

특히 금융 앱이기 때문에 **신뢰감과 숫자의 가독성**이 가장 중요하다.

---

## 5. Color System

레퍼런스 이미지의 색감을 기준으로 다음 팔레트를 추천한다.

### Brand Colors

| Name | Color | Usage |
|---|---|---|
| Planet Blue | `#8EBEFF` | Primary |
| Cosmic Cyan | `#83E4E3` | Secondary |
| Orbit Lavender | `#B7A7F8` | Accent |
| Stardust Pink | `#E4B7E9` | Accent |
| Star Yellow | `#F7E58D` | Small highlight |

색을 한꺼번에 다 사용하지 않는다.

기본적으로 **Blue + Lavender**를 브랜드의 중심으로 하고, Cyan / Pink / Yellow는 작은 포인트로만 사용한다.

---

## 6. Light Theme

배경을 완전한 순백색으로만 구성하기보다 아주 약한 cool tone을 넣는다.

```text
Background         #F8FAFD
Surface            #FFFFFF
Surface Secondary  #F1F4F9

Text Primary       #181A20
Text Secondary     #747985
Text Tertiary      #A4A9B4

Border             #E7EAF0

Primary            #7FAEF5
Secondary          #9D94E8
Accent Cyan        #76D7D7
```

전체 화면 대부분은 neutral color로 유지한다.

행성 그래픽이나 주요 progress에서만 브랜드 컬러를 보여준다.

전체적인 느낌은 다음과 같다.

```text
white
to
very pale blue-gray
to
lavender / cyan accents
```

레퍼런스의 밝은 이미지에서 보이는 색감을 훨씬 절제해서 사용하는 방식이다.

---

## 7. Dark Theme

완전한 `#000000`보다는 아주 짙은 blue-black을 추천한다.

```text
Background         #0C0D12
Surface            #15171E
Surface Secondary  #1C1E27

Text Primary       #F5F7FB
Text Secondary     #A7ACB8
Text Tertiary      #686D78

Border             #292C36

Primary            #91BFFF
Secondary          #ADA2FF
Accent Cyan        #83DDDC
```

Dark theme에서는 레퍼런스의 검은 우주 배경과 파스텔 행성 느낌을 활용할 수 있다.

단, 별이나 장식 점을 화면 전체에 뿌리지는 않는다.

Hero area 주변에 다음 정도만 허용한다.

- 3~5개의 작은 pixel dot
- 아주 약한 blur glow
- 1~2개의 단순한 cross-shaped light mark

이 장식 역시 이모지가 아니라 SVG나 CSS로 직접 만든다.

---

## 8. Theme Consistency

Light / Dark theme에서 브랜드 컬러 자체는 크게 바꾸지 않는다.

대신 brightness와 contrast만 조절한다.

```text
Light
Planet Blue -> #7FAEF5

Dark
Planet Blue -> #91BFFF
```

이렇게 해야 theme을 바꿔도 같은 앱이라는 느낌이 유지된다.

---

## 9. Typography

픽셀 느낌은 **그래픽에만 사용한다.**

숫자나 금융 정보에 pixel font를 사용하지 않는다.

### Korean / UI

- Pretendard
- SUIT
- Inter + Pretendard

### Numbers

금액은 tabular number를 사용한다.

```css
font-variant-numeric: tabular-nums;
```

금액이 변화해도 글자 폭이 흔들리지 않게 한다.

---

## 10. Typography Hierarchy

### Remaining Budget

가장 중요한 숫자다.

```text
32,400 KRW
```

또는 실제 UI에서 통화 기호를 사용할 경우:

```text
KRW 32,400
```

권장 크기:

```text
36-44px
700 weight
```

모바일에서도 한눈에 들어와야 한다.

### Today's Budget

한 단계 낮게 표현한다.

```text
오늘 예산
41,200원
```

```text
14px label
18-20px number
```

### Category

```text
식비
124,000 / 258,000
```

카테고리 이름보다 금액 정보가 약간 더 중요하게 느껴져도 좋다.

---

## 11. Planet Identity

행성을 단순 로고가 아니라 **UI motif**로 사용한다.

예를 들어 Home hero에 작은 행성 illustration을 배치한다.

행성은 다음 요소로 구성한다.

- 단순한 sphere
- 얇은 orbit ring
- 2~3개의 pastel patch
- 일부 pixel-like edge
- 작은 light point

숫자를 행성 안에 억지로 넣기보다는, 행성 그래픽을 숫자 옆이나 배경 쪽에 보조적으로 배치하는 것이 좋다.

---

## 12. Recommended Home Layout

홈 화면은 다음 정보 순서를 유지한다.

1. 날짜
2. 오늘 예산
3. 남은 금액
4. 진행률
5. 항목별 예산 카드
6. 오늘 지출 내역
7. 하단 고정 지출 추가 버튼

예시 구조:

```text
------------------------------------------------
September 13                          Theme

오늘 사용할 수 있는 금액

32,400원

오늘 예산 41,200원

[ monthly progress indicator ]

                           [planet graphic]
------------------------------------------------


이번 달 예산

------------------------------------------------
식비
124,000 / 258,000
[ progress bar ]
------------------------------------------------

------------------------------------------------
카페
31,000 / 43,000
[ progress bar ]
------------------------------------------------


오늘 지출

12:30    점심              -12,000
16:20    카페               -4,500


                     [ Add Expense ]
```

---

## 13. Hero Card

Home에서 **가장 디자인을 줄 수 있는 공간**이다.

Hero card는 다른 카드보다 약간 특별하게 만든다.

### Light

```text
white to very pale lavender / blue gradient
```

### Dark

```text
dark navy to subtle purple
```

예:

```css
background:
  linear-gradient(
    135deg,
    rgba(142, 190, 255, .18),
    rgba(183, 167, 248, .14),
    rgba(131, 228, 227, .10)
  );
```

gradient 대비는 매우 낮게 유지한다.

---

## 14. Planet Graphic

행성 그래픽은 실제 NASA 이미지처럼 사실적으로 만들기보다 추상적으로 만든다.

추천 요소:

- 단순한 sphere
- 1개의 orbit ring
- 2~3개의 irregular pastel patches
- pixel-like edge 일부
- 작은 geometric light marks

권장 크기:

```text
64px-120px
```

Hero에는 하나만 사용하는 것을 기본으로 한다.

---

## 15. Pixel Style Rule

레퍼런스의 픽셀 감성은 매력적이지만 앱 전체에 적용하면 금융 앱보다 게임처럼 보일 가능성이 크다.

따라서 pixel 요소는 다음 영역에만 사용한다.

### 사용 가능

- Planet illustration
- Loading animation
- Empty state
- 작은 별 모양의 커스텀 SVG
- Onboarding
- Monthly summary
- Splash screen

### 사용 금지

- Body text
- 숫자
- Navigation icons
- Input
- 일반 button
- Table
- Calendar text
- 오류 메시지
- 금융 핵심 수치

---

## 16. Cards

카드는 최대한 단순하게 만든다.

### Light

```text
background: white
border: #ECEEF3
radius: 16px
```

### Dark

```text
background: #15171E
border: #242730
```

Shadow는 거의 사용하지 않는다.

Light theme에서만 아주 약하게:

```text
0 2px 12px rgba(20, 30, 60, .04)
```

정도를 사용한다.

---

## 17. Radius System

앱 전체가 부드러운 인상을 가지되 너무 귀엽게 보이지 않도록 radius를 통일한다.

```text
Small controls     10px
Input              12px
Card               16px
Hero card          20px
Bottom sheet       24px
Floating button    50%
```

---

## 18. Budget Progress

일반 category progress는 horizontal bar를 유지한다.

```text
[========------]
```

전체 월 budget 같은 핵심 지표에서는 **Orbit Progress**를 사용할 수 있다.

예를 들어 행성 주변의 얇은 ring 중 일부만 primary color로 채워 진행률을 표현한다.

다만 모든 category progress를 원형으로 만들지는 않는다.

카테고리 간 비교에서는 horizontal bar가 훨씬 빠르게 읽힌다.

---

## 19. Progress Colors

### Normal

```text
Planet Blue
```

### Warning

예산의 80% 이상 사용 시:

```text
Soft Amber
#E7B96A
```

### Danger

예산의 100% 초과 시:

```text
Coral Red
#EF7777
```

추천 정리:

```text
Normal    #8EBEFF
Warning   #E7B96A
Danger    #EF7777
```

Danger color에는 glow를 넣지 않는다.

---

## 20. Category Colors

카테고리마다 완전히 다른 강한 색을 주는 것은 피한다.

같은 palette 안에서 variation을 준다.

```text
Food          #8EBEFF
Cafe          #B7A7F8
Transport     #83DAD8
Subscription  #C4A8E7
Beauty        #E6B8DC
Investment    #95B7E9
Other         #A8AEBB
```

전체적인 색온도가 유지되어야 한다.

---

## 21. Category Planet

카테고리 아이콘에 이모지를 사용하지 않는다.

대신 작은 abstract planet을 카테고리 아이콘으로 활용할 수 있다.

예:

```text
Food          solid circle + small patch
Cafe          small ring
Transport     long horizontal orbit
Subscription  small satellite dot
Investment    dual-circle composition
Other         neutral outlined circle
```

각각 texture, ring, dot이 조금씩 다른 작은 행성 형태를 사용한다.

다만 카테고리마다 완전히 새로운 일러스트를 만들 필요는 없다.

기본 planet asset 3~4종을 만들고 색과 ring 구조만 다르게 적용하는 편이 일관성이 좋다.

---

## 22. Calendar

달력은 정보 밀도가 높은 화면이므로 가장 절제한다.

각 날짜에는 다음만 보여준다.

- 그날 지출 총액
- 예정 거래 indicator
- 수입 indicator

예:

```text
13
16,500
[small dot]
```

indicator 예:

```text
Blue dot = planned transaction
Cyan dot = income
```

선택 날짜:

```text
pale lavender circle
```

오늘:

```text
thin blue outline
```

선택 날짜와 오늘의 상태는 서로 다르게 표현한다.

---

## 23. Add Expense Button

모바일에서는 하단에 고정된 주요 액션 버튼을 둔다.

이모지나 장식 아이콘 없이 Lucide의 `Plus` 아이콘을 사용한다.

추천 형태:

```text
[ + Add Expense ]
```

또는 작은 floating action button으로 `Plus` SVG 아이콘만 사용한다.

버튼을 누르면 bottom sheet가 열린다.

---

## 24. Expense Input

지출 입력 화면은 최대한 장식을 제거한다.

예:

```text
지출 추가

12,000원

[ 식비 ] [ 카페 ] [ 교통 ]
[ 구독 ] [ 미용 ] [ 기타 ]

오늘
메모 추가

[ 저장 ]
```

이 화면에는 행성 그래픽을 넣지 않는다.

돈을 입력하는 순간은 장식보다 속도와 정확성이 우선이다.

---

## 25. Navigation

Bottom Navigation은 최대 4개를 권장한다.

```text
Home
Calendar
Transactions
Settings
```

아이콘은 Lucide 또는 Phosphor의 simple line icon을 사용한다.

예:

```text
Home          Home icon
Calendar      Calendar icon
Transactions  List icon
Settings      Settings icon
```

선택 상태에만 아주 작은 cosmic accent를 준다.

Light:

```text
very pale lavender pill
```

Dark:

```text
rgba(173, 162, 255, .12)
```

---

## 26. Icons

UI icon은 pixel art로 만들지 않는다.

추천:

- Lucide
- Phosphor
- Heroicons

기본 원칙:

> Planet illustration과 기능 아이콘의 시각 언어를 분리한다.

이렇게 해야 앱이 전문적으로 보인다.

---

## 27. Decorative Marks

별이나 sparkle을 이모지로 넣지 않는다.

필요하면 직접 만든 SVG 또는 CSS 도형을 사용한다.

예를 들어 다음 형태가 가능하다.

- 작은 4-point cross
- 1~3px square dot
- 얇은 plus-shaped light mark
- 작은 outlined diamond

한 화면에 3~6개 정도만 허용한다.

Hero나 empty state 주변에서만 사용한다.

---

## 28. Animation

이 컨셉에서는 작은 animation이 효과적이다.

### Planet Float

Home 진입 후 행성이 아주 천천히 떠 있는 느낌을 준다.

```text
translateY: 0 -> -3px
duration: 3-4s
infinite alternate
```

### Orbit

행성 ring은 아주 천천히 회전할 수 있다.

```text
20-30 sec / rotation
```

### Number

지출 추가 후 금액이 자연스럽게 갱신된다.

```text
32,400
to
20,400
```

약 300ms 정도의 짧은 count animation을 사용한다.

### Progress

Progress bar는 값 변경 시 부드럽게 이동한다.

---

## 29. 하지 말아야 할 Animation

- 별이 계속 빠르게 반짝이는 효과
- 화면 전체 particle
- 빠른 orbit animation
- 숫자가 튀는 animation
- 버튼 glow pulse
- 돈이 날아다니는 효과
- 이모지 기반 animation

이런 효과는 금융 앱의 안정감을 떨어뜨린다.

---

## 30. Empty States

Empty state는 planet identity를 평소보다 강하게 사용할 수 있는 영역이다.

예:

```text
[small pixel planet illustration]

아직 지출이 없어요

오늘의 첫 기록을 남겨보세요.

[ 지출 추가 ]
```

이때도 이모지는 사용하지 않는다.

행성은 별도의 SVG 또는 pixel-art asset으로 제작한다.

---

## 31. Light / Dark Theme Toggle

Theme toggle에는 이모지를 사용하지 않는다.

Lucide의 `Sun`, `Moon`, `CircleHalf` 같은 line icon을 사용하거나, 직접 만든 half-lit planet SVG를 사용할 수 있다.

전환 animation은 200~300ms 정도로 제한한다.

```css
transition:
  background-color 200ms,
  color 200ms,
  border-color 200ms;
```

---

## 32. Information Hierarchy

항상 우선순위는 다음과 같다.

```text
1. 남은 금액
2. 오늘 예산
3. 예산 진행상황
4. 카테고리
5. 거래
6. 장식
```

Planet graphic은 절대 1~5보다 강하게 보여서는 안 된다.

이 규칙 하나만 지켜도 디자인이 안정된다.

---

## 33. Suggested Design Tokens

실제 구현에서는 CSS variables로 관리한다.

```css
:root {
  --background: #f8fafd;
  --surface: #ffffff;
  --surface-secondary: #f1f4f9;

  --text-primary: #181a20;
  --text-secondary: #747985;

  --border: #e7eaf0;

  --planet-blue: #8ebeff;
  --cosmic-cyan: #83e4e3;
  --orbit-lavender: #b7a7f8;
  --stardust-pink: #e4b7e9;
  --star-yellow: #f7e58d;

  --warning: #e7b96a;
  --danger: #ef7777;
}

.dark {
  --background: #0c0d12;
  --surface: #15171e;
  --surface-secondary: #1c1e27;

  --text-primary: #f5f7fb;
  --text-secondary: #a7acb8;

  --border: #292c36;

  --planet-blue: #91bfff;
  --cosmic-cyan: #83dddc;
  --orbit-lavender: #ada2ff;
}
```

---

## 34. Component Style Summary

| Component | Style |
|---|---|
| App Background | Neutral |
| Hero | Subtle cosmic gradient |
| Planet | Pastel pixel / soft 3D |
| Cards | Clean neutral |
| Buttons | Mostly solid primary |
| Progress | Blue / lavender |
| Inputs | Plain, high contrast |
| Functional Icons | Simple line icon |
| Decorative Graphics | Custom SVG / pixel |
| Error | Coral red |
| Warning | Muted amber |
| Navigation | Minimal |
| Animation | Subtle |
| Emoji | Do not use |

---

## 35. Where to Use Planet Aesthetic

Planet aesthetic을 상대적으로 많이 사용해도 되는 곳은 네 곳으로 제한한다.

1. Home Hero
2. Empty State
3. Onboarding
4. Loading

나머지 화면은 일반적인 깔끔한 금융 앱처럼 만든다.

목표는 처음 앱을 열었을 때는 시각적으로 기억에 남고, 실제 사용 중에는 빠르고 안정적으로 느껴지는 것이다.

---

## 36. Core Design Principles

1. **Planet은 UI 전체가 아니라 Brand Accent다.**
2. **Pastel Blue + Lavender가 중심이고 Cyan / Pink / Yellow는 포인트로만 쓴다.**
3. **Dark는 cosmic, Light는 airy한 느낌으로 만들되 같은 디자인 언어를 유지한다.**
4. **Pixel style은 illustration에만 사용하고 숫자, 버튼, 텍스트에는 사용하지 않는다.**
5. **Home의 남은 금액이 어떤 그래픽보다 가장 먼저 보여야 한다.**
6. **이모지는 앱 전체에서 사용하지 않는다.**
7. **기능 아이콘은 Lucide / Phosphor 같은 line icon으로 통일한다.**
8. **장식 요소는 SVG, CSS shape, pixel asset으로만 만든다.**

---

## 37. Final Visual Direction

레퍼런스의 dark cosmic 분위기와 light pastel palette를 하나의 디자인 시스템 안에서 연결한다.

CD 자체를 주요 모티프로 가져올 필요는 없다.

대신 CD에서 보이는 다음 특성을 행성 surface에 반영한다.

- iridescent blue
- lavender
- cyan
- pale pink
- low-contrast highlight

결과적으로 앱은 다음 인상을 목표로 한다.

> Clean financial interface with a restrained pastel cosmic identity.

금융 정보가 항상 주인공이고, 행성은 브랜드를 기억하게 만드는 시각적 장치로만 사용한다.
