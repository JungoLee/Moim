# 디자인 시스템 (2.0 전면 개편)

> 2026-10 전면 개편의 **단일 기준**이다. 화면을 새로 만들거나 고칠 때 여기 적힌 토큰·클래스·규칙만 쓴다.
> 시안 A안(모임 보드)을 **보드 테마**, C안(사람×날짜 표)을 **표 테마**로 둘 다 만든다. 사용자가 탭으로 고르고, 고른 값은 계정에 저장한다.
> 시안 캔버스는 반영 뒤 사용자가 지웠다(2026-10-08). 전·후 비교 그림은 `C:\workspace\OPNAE\_screenshots\Moim-renewal\_compare`.

## 0. 결정 사항

| 항목 | 결정 |
|---|---|
| 테마 | `html[data-theme="board"]` = **보드**(기본, 어두움, 왼쪽 메뉴, 모임 방은 겹침 달력), `html[data-theme="table"]` = **표**(밝음, 위 남색 메뉴, 모임 방은 사람×날짜 표). 화면 전체가 바뀐다 |
| 테마 저장 | 계정 `users.ui_theme`(`'board'`·`'table'`·`''`) + 이 브라우저 `localStorage.moim_ui_theme`(첫 그림 깜빡임 방지용 사본). 계정 값이 우선 |
| 코드 원칙 | **화면 코드(React)는 한 벌.** 테마 차이는 ① 토큰 값 ② 틀(AppShell) 배치 ③ 모임 방 보기(`RoomBoardView`/`RoomTableView`)·홈 첫 블록(`HomeBoard`/`HomeTable`) 네 곳에만 둔다. 데이터·문구·동작은 공용 훅(`useRoom`, `useHomeData`)에서 한 번만 |
| 메뉴 | 4개: 홈(`/home`) · 캘린더(`/dashboard`) · 모임(`/rooms`) · 사람(`/friends`·`/tiers`·`/requests`·`/u`). 연차 계산(`/tools/leave`)은 보조 링크. 시간 요청은 홈 '답할 것' + 사람 › 시간 요청 탭 |
| 플로팅 + 버튼 | **없앤다**(QuickActions). 각 화면의 할 일은 화면 머리의 버튼으로, 채팅은 모임 방 안 패널로, 사용 가이드는 화면 머리의 `?` 버튼으로 |
| 로고 | `app/icon.svg`(달력 아이콘)와 'MOIM' 글자(Black Ops One)를 그대로 쓴다. 아이콘 파일은 고치지 않는다. 글자는 보드에서 기존 그라데이션, 표의 남색 바 위에서도 그라데이션, 밝은 바탕 위에서는 `--c-text` 단색 |
| 색 | 로고에서 뽑았다 — 아이콘 판 남색 `#141a2c`, 그라데이션 양 끝 인디고 `#7c8cff` · 틸 `#46d6c2` |
| 글꼴 | 본문·숫자 Pretendard(버전 고정 CDN). 숫자는 `font-variant-numeric: tabular-nums`. 로고 글자만 Black Ops One(next/font). 예전 `EnMono`(시스템 고정폭 별칭)는 지운다 — 한글 화면에 고정폭을 쓰지 않는다 |
| 치수 | 기존 규칙 유지: SCSS 에서 `rem(px)`(`@use '@/styles/rem' as *;`). 루트 글자 크기는 `clamp(14px, 12px + 0.45vw, 18px)` 그대로(넓은 화면 글자 크게 — 사용자 요청이었음). 미디어 쿼리만 px |
| 클래스 | 전역 공용 부품은 **`ui-` 접두어**(예전 `app-*` 는 전부 없앤다). 화면 전용은 CSS Module |

## 1. 파일 구조

```
frontend/src/styles/
  _rem.scss          px→rem 함수(기존)
  _bp.scss           브레이크포인트 변수·믹스인
  tokens.scss        :root(보드 값) + html[data-theme='table'] 덮어쓰기
  base.scss          reset · html/body · 포커스 · 스크롤바 · 한국어 줄바꿈 · 모션 줄이기
  components.scss    공용 부품 ui-* (4장)
  fullcalendar.scss  FullCalendar 덮어쓰기(토큰만 씀)
frontend/src/components/<Name>.tsx (+ <Name>.module.scss)   공용 컴포넌트
frontend/src/components/shell/       AppShell · Sidebar · TopBar · MobileBar · BottomTabs · ThemeSwitch
frontend/src/components/room/        모임 방 부품(두 보기 공용 + 보기별)
frontend/src/components/home/        홈 부품
frontend/src/app/<route>/*.module.scss  화면 전용
```

- `app/layout.tsx` 가 `tokens → base → components → fullcalendar` 순서로 import 한다. **`app/globals.scss` 는 지운다.**
- 로그인 뒤 화면은 route group `app/(app)/` 아래로 옮기고 `app/(app)/layout.tsx` 가 `AppShell` 을 한 번만 그린다(이동할 때 메뉴가 다시 만들어지며 깜빡이던 것 해결). 주소는 그대로다.
  - `(app)` 안: home · dashboard · friends · tiers · requests · rooms · rooms/detail · u · tools/leave · admin
  - 밖: `/`(랜딩) · `/auth/callback`
  - `/tools/leave` 는 로그아웃 상태에서도 열린다 → AppShell 이 토큰이 없으면 '간단한 머리'(로고 + 로그인 버튼)만 그린다.
- 상태는 클래스 대신 **속성**: `aria-current`·`aria-selected`·`aria-pressed`·`aria-expanded`·`data-state`·`data-level`·`[hidden]`·`:disabled`.
- 테마 차이는 각 SCSS 파일 **맨 아래** 한 블록에 모은다: 전역 파일은 `html[data-theme='table'] …`, 모듈은 `:global(html[data-theme='table']) .x { … }`. 그 밖에 흩지 않는다.
- 인라인 `style={{}}` 은 **데이터로 정해지는 값만**(그룹 색, 히트 단계 색, 진행 막대 폭). 그 밖에는 금지.

## 2. 토큰 (tokens.scss)

### 색 — 이름은 같고 값만 테마별

| 토큰 | 보드(어두움) | 표(밝음) | 쓰임 |
|---|---|---|---|
| `--c-bg` | `#0b0f1c` | `#f3f4f8` | 페이지 바탕 |
| `--c-surface` | `#121829` | `#ffffff` | 카드·패널 |
| `--c-surface-2` | `#182037` | `#f6f7fa` | 카드 안 묶음·hover |
| `--c-surface-3` | `#1f2844` | `#eef0f6` | 눌림·선택 바탕 |
| `--c-line` | `#1f2844` | `#dfe2ec` | 테두리 |
| `--c-line-strong` | `#2c3760` | `#c9cedf` | 입력칸·버튼 테두리 |
| `--c-text` | `#e9edf8` | `#141a2c` | 본문 |
| `--c-text-2` | `#aeb8d8` | `#3d4560` | 보조 글 |
| `--c-text-3` | `#8f9bc0` | `#5b6482` | 흐린 글(캡션) — 표면 대비 4.5:1 이상 |
| `--c-link` | `#aab4ff` | `#3f4bd1` | 링크 |
| `--c-primary` | `#7c8cff` | `#141a2c` | 주 버튼·선택 |
| `--c-primary-hover` | `#96a3ff` | `#262f4f` | |
| `--c-on-primary` | `#0b0f1c` | `#ffffff` | 주 버튼 글자 |
| `--c-primary-soft` | `#1c2442` | `#e8eaf3` | 선택된 메뉴·칩 바탕 |
| `--c-accent` | `#46d6c2` | `#46d6c2` | 가능·모두·확정(채움) |
| `--c-on-accent` | `#04231f` | `#062a26` | 채움 위 글자 |
| `--c-accent-text` | `#46d6c2` | `#0b6b5e` | 바탕 위 '가능' 글자 |
| `--c-accent-soft` | `#143033` | `#d9f6f1` | 가능 연한 바탕 |
| `--c-warn` | `#f0a85a` | `#e8913a` | 저녁 이후·내 차례(채움) |
| `--c-warn-text` | `#f0a85a` | `#9a5a12` | |
| `--c-warn-soft` | `#33261a` | `#fff1e0` | |
| `--c-danger` | `#ff8a8a` | `#d64545` | 삭제·오류·알림 점 |
| `--c-on-danger` | `#2a0b0b` | `#ffffff` | |
| `--c-danger-soft` | `#3a1c22` | `#fdeaea` | |
| `--c-req` | `#b9a6ff` | `#6d5be0` | 시간 요청 글자 |
| `--c-req-soft` | `#2c2450` | `#f3f1ff` | |
| `--c-sun` | `#ff9b9b` | `#d64545` | 일요일·공휴일 |
| `--c-sat` | `#9bb6ff` | `#3f6fd8` | 토요일 |
| `--c-shell` | `#0f1426` | `#141a2c` | 사이드바·위 메뉴·아래 탭 바탕 |
| `--c-shell-line` | `#1d2540` | `#141a2c` | |
| `--c-shell-text` | `#aeb8d8` | `#aeb8d8` | 메뉴 글자 |
| `--c-shell-active` | `#ffffff` | `#ffffff` | 현재 메뉴 글자 |
| `--c-shell-active-bg` | `#1c2442` | `#262f4f` | 현재 메뉴 바탕 |
| `--c-focus` | `#aab4ff` | `#3f4bd1` | 포커스 링 |
| `--c-scrim` | `rgba(5,8,16,.62)` | `rgba(20,26,44,.42)` | 팝업 뒤 |

모바일 아래 탭은 표 테마에서 흰 바탕(`--c-surface`)에 `--c-text-3`/`--c-text` 글자다(시안 C 모바일) — `BottomTabs.module.scss` 맨 아래 블록에서 덮어쓴다.

### 가능 날짜·히트 단계 (공통 이름)

| 토큰 | 보드 | 표 | 뜻 |
|---|---|---|---|
| `--avail-yes` | `#46d6c2` | `#46d6c2` | 가능 |
| `--avail-after` | `#f0a85a` | `#f6b26b` | 저녁(시각) 이후 |
| `--avail-no` | `#3a4466` | `#eceef4` | 안 됨 |
| `--heat-0` | `#141b2e` | `#ffffff` | 아무도 |
| `--heat-1` | `#15293a` | `#eefaf7` | |
| `--heat-2` | `#173a48` | `#d6f4ee` | |
| `--heat-3` | `#195057` | `#b5ece2` | |
| `--heat-4` | `#1c6b6c` | `#86e1d2` | |
| `--heat-5` | `#46d6c2` | `#46d6c2` | 모두(글자 `--c-on-accent`) |

히트 단계 = `Math.round(yes / 멤버 수 × 4)` (0~4), **멤버 전원 yes 일 때만 5**. 저녁 이후 인원은 단계에 넣지 않고 칸 아래 `+N 저녁`(`--c-warn-text`)으로 따로 쓴다.

### 일정 색 (lib/colors.ts — 채움색, 글자는 `readableText()`)

공개 `#2fb59f` · 비공개 `#e08a3c` · 비공개+그룹 = 그룹 색 · 시간 요청 `#8b5cf6` · **모임 확정 `#5b6cf0`(새로)** · 친구 '바쁨' = `--c-surface-3` 바탕 + `--c-text-3` 글자. 두 테마 같은 값(채움 위 글자색을 계산하므로 바탕과 무관).

### 글꼴·크기

```scss
--font-sans: 'Pretendard Variable', Pretendard, system-ui, -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;
--font-brand: var(--font-brand-next), sans-serif; // Black Ops One — 로고 글자만
```

크기는 토큰 대신 `rem()` 로 쓴다. 쓰는 값만: 12 캡션 · 13 보조 · 14 작은 본문 · **15 본문** · 17 카드 제목 · 20 강조 숫자 · 26 표 테마 화면 제목 · 30 보드 테마 화면 제목. 굵기 400/500/600/700(보드), 표 테마 제목은 700.

### 간격·높이·반경·그림자·층

```scss
--sp-1: rem(4);  --sp-2: rem(8);  --sp-3: rem(12); --sp-4: rem(16);
--sp-5: rem(20); --sp-6: rem(24); --sp-8: rem(32); --sp-10: rem(40);
--h-sm: rem(32); --h-md: rem(40); --h-lg: rem(48);   // 버튼·입력 높이. 모바일 터치 대상은 44px 이상
--r-sm: rem(8);  --r-md: rem(10); --r-lg: rem(14); --r-xl: rem(18); --r-pill: 999px;
--shadow-pop: 0 12px 40px rgba(0,0,0,.45);   // 표: 0 12px 32px rgba(20,26,44,.16)
--z-shell: 50; --z-sheet: 80; --z-modal: 100; --z-toast: 120; --z-confirm: 130; --z-guide: 140;
--shell-w: rem(248);      // 보드 사이드바 폭
--topbar-h: rem(60);      // 표 위 메뉴 높이
--tabbar-h: 64px;         // 모바일 아래 탭 (safe-area 더함)
--content-max: rem(1320);
```

### 화면 폭 구간 (_bp.scss)

```scss
$bp-shell: 900px;   // 이상 = 데스크톱 틀(보드 사이드바 / 표 위 메뉴), 미만 = 모바일 틀(머리 + 아래 탭)
$bp-narrow: 600px;  // 미만 = 한 줄 배치, 팝업은 아래에서 올라오는 시트
@mixin desktop { @media (min-width: $bp-shell) { @content; } }
@mixin mobile  { @media (max-width: $bp-shell - 1) { @content; } }
@mixin narrow  { @media (max-width: $bp-narrow - 1) { @content; } }
```

## 3. 기본 규칙 (base.scss)

- `*{box-sizing:border-box}`, body 바탕 `--c-bg`, 글자 `--c-text`, `--font-sans`, 본문 `rem(15)`/1.6.
- **한국어 줄바꿈**: `body { word-break: keep-all; overflow-wrap: anywhere; }`.
- 가로 넘침 금지: `html, body { overflow-x: clip; }`. 넓은 표·달력은 자기 상자 안에서만 `overflow-x: auto`.
- 포커스: `:focus-visible { outline: 2px solid var(--c-focus); outline-offset: 2px; }` (마우스 클릭엔 안 보임).
- 모션 줄이기: `@media (prefers-reduced-motion: reduce)` 에서 전환·애니메이션 0.
- 이미지: `img, svg, video { max-width: 100%; } img, video { height: auto; }` (기존 규칙 유지).
- 링크 `--c-link`, 밑줄 없음, hover 밑줄.
- `color-scheme`: 보드 `dark`, 표 `light`.

## 4. 공용 부품

### 4-1. 전역 클래스 (components.scss)

| 클래스 | 설명 |
|---|---|
| `ui-btn` | 기본 버튼(테두리형). 높이 `--h-md`, 반경 `--r-md`, 바탕 `--c-surface`, 테두리 `--c-line-strong`, 글자 15/500 |
| `ui-btn--primary` | 주 동작. `--c-primary` 바탕 + `--c-on-primary` 글자 + 700 |
| `ui-btn--accent` | 수락·확정. `--c-accent` + `--c-on-accent` |
| `ui-btn--danger` | 삭제. `--c-danger-soft` 바탕 + `--c-danger` 글자(테두리 없음). 확인창 안 위험 버튼은 채움(`--c-danger` + `--c-on-danger`) — `ui-btn--danger-solid` |
| `ui-btn--ghost` | 글자만(바탕·테두리 없음, hover 때 `--c-surface-2`) |
| `ui-btn--sm` / `--lg` / `--block` / `--icon` | 높이 32 / 48, 폭 100%, 정사각형(아이콘만 — `aria-label` 필수) |
| `ui-input` · `ui-textarea` | 높이 `--h-md`, 바탕 `--c-bg`(보드)/`--c-surface`(표), 테두리 `--c-line-strong`, focus 때 `--c-focus` 테두리 |
| `ui-field` | 세로 묶음: `ui-label` + 입력 + `ui-help`(13, `--c-text-3`) / `ui-error`(13, `--c-danger`) |
| `ui-form` | `display:flex; flex-direction:column; gap: var(--sp-4)` |
| `ui-actions` | 팝업·폼 아래 버튼 줄. 오른쪽 정렬, 취소(왼쪽)·주 동작(오른쪽). 좁은 화면에선 꽉 차게 |
| `ui-card` | `--c-surface` + 1px `--c-line` + `--r-xl` + 안쪽 `--sp-5`. `ui-card__head`(제목 + 오른쪽 동작), `ui-card__title`(17/700) |
| `ui-seg` | 분할 버튼(보기·표시 방법). 안의 `button[aria-pressed=true]` 가 선택. 바탕 `--c-bg`(보드)/`--c-surface-3`(표) |
| `ui-tabs` | 밑줄 탭. `role=tablist` 안 `button[role=tab][aria-selected]` 또는 `a[aria-current=page]`. 선택 밑줄 보드 `--c-accent`, 표 `--c-primary` |
| `ui-chip` | 작은 알약 태그. 변형 `--accent` · `--warn` · `--req` · `--muted` · `--primary` (각 soft 바탕 + text 색) |
| `ui-badge` | 숫자 배지(빨강 `--c-danger`, 99+). `ui-dot` 은 8px 점 |
| `ui-avatar` | 원형. `--sm` 28 · (기본) 36 · `--lg` 56. 사진 없으면 이름 첫 글자 + 사람마다 정해진 파스텔 색(`avatarColor(id)`) |
| `ui-list` · `ui-row` | 목록. 행 = 아바타 + 본문(`ui-row__main` 제목/보조) + 오른쪽 동작(`ui-row__side`). 행 사이 1px `--c-line` |
| `ui-empty` | 빈 상태. 아이콘(선 SVG) + 한 줄 설명 + 동작 버튼 하나 |
| `ui-skeleton` | 불러오는 중 자리(회색 막대). "없습니다"를 불러오기 전에 보이지 않게 이걸 먼저 |
| `ui-legend` | 범례 줄(색 칸 + 글) |
| `ui-switch` | 켜기/끄기(체크박스 + 트랙) |
| `ui-scrim` · `ui-modal` | 팝업. 가운데 카드, `--r-xl`, 최대 폭 `rem(520)`. **좁은 화면(<600)에선 아래에서 올라오는 시트**(위 모서리만 둥글게, 손잡이 막대) |
| `ui-modal__head` · `ui-modal__body` · `ui-modal__foot` | 머리(제목 + 닫기 ✕) · 본문(스크롤) · 아래 버튼 줄 |
| `ui-drawer` | 오른쪽에서 나오는 계정 서랍(폭 `rem(360)`, 좁은 화면 100%) |
| `ui-confirm` | 확인창(최상단). 확인 버튼에 포커스, Enter 는 **포커스된 버튼**만 누른다 |
| `ui-page` | 화면 본문 그릇(`max-width: var(--content-max)`, 좌우 `--sp-8`, 모바일 `--sp-4`) |
| `ui-page-head` | 화면 머리: `ui-page-head__eyebrow`(13, `--c-text-3`) · `h1`(보드 30/700, 표 26/700) · `ui-page-head__sub`(14, `--c-text-2`) · 오른쪽 `ui-page-head__actions` |
| `ui-grid-2` | 본문 + 옆 패널: `display:flex; flex-wrap:wrap; gap`. 본문 `flex: 999 1 rem(560)`, 옆 `flex: 1 1 rem(320)` — 좁으면 자동으로 쌓인다 |
| `ui-sr-only` | 화면에서 숨기고 읽기 프로그램만 |

### 4-2. React 컴포넌트

| 컴포넌트 | 하는 일 |
|---|---|
| `shell/AppShell` | 로그인 확인 → `MeProvider`(내 정보 1회 조회, `useMe()`) → 테마 적용 → 데스크톱/모바일 틀. 토큰이 없으면 랜딩으로(단 `/tools/leave` 는 간단한 머리만) |
| `shell/Sidebar` | 보드 데스크톱 왼쪽 메뉴: 로고 · 메뉴 4 + 연차 계산 · '내 모임' 목록(상태 태그) · 새 모임 · 아래 `ThemeSwitch` + 내 계정 |
| `shell/TopBar` | 표 데스크톱 위 남색 메뉴: 로고 · 메뉴 4 · 오른쪽 연차 계산 링크 · `ThemeSwitch` · 아바타 |
| `shell/MobileBar` · `shell/BottomTabs` | 모바일 머리(로고 또는 뒤로 + 제목, 오른쪽 `ThemeSwitch` 작은 형 · 아바타) + 아래 탭 4개(배지·점) |
| `shell/ThemeSwitch` | `ui-seg` 두 칸 '보드 \| 표'. 누르면 즉시 `data-theme` 바꾸고 `PATCH /api/auth/me {uiTheme}` |
| `PageHeader` | `ui-page-head` 를 그린다. props: `eyebrow`·`title`·`sub`·`actions`. 그 화면에 사용 가이드가 있으면 `?` 버튼 자동 표시. **옛 `PageHero` 는 지운다** |
| `Modal` | `ui-scrim`+`ui-modal`. props: `title`·`onClose`·`footer`·`size('sm'\|'md'\|'lg')`. ESC(`useEscClose`)·바깥 클릭 닫기·열 때 첫 입력에 포커스·닫으면 연 버튼으로 포커스 복귀 |
| `Avatar` | 사진 또는 첫 글자 원. `size` prop |
| `Toaster` | 아래 가운데 알림(`Toaster.module.scss`). 성공 `--c-accent`·오류 `--c-danger` 왼쪽 점, 모바일은 아래 탭 위 |
| `TierPicker` | '그룹에 추가' 칩 목록(친구 목록·프로필 공용) |
| `Select`·`TimeSelect`·`DatePicker`·`ColorPalette`·`CodeBoxes`·`CopyButton`·`Tooltip`·`Accordion`·`MemberRow`·`Notice`·`Toaster`·`ConfirmHost`·`GuideHost`·`AccountDrawer`·`LegalModal`·`ReleaseModal`·`UserProfileModal` | 기능 그대로, 겉모양만 `ui-*`·모듈로 새로. `Notice` 는 `role="status"`/오류는 `role="alert"` |
| `room/*` | 4-3 참고 |
| 지우는 것 | `QuickActions`·`lib/quickActions.ts`·`PageHero`·`Nav`·`Icon` 의 옛 이름 일부(새 `Icon` 으로 교체)·`app/globals.scss` |

`Icon` 은 선 아이콘 한 벌(24 격자, stroke 2, round): home · calendar · rooms(달력+가운데 칸, 로고와 같은 모양) · users · sun · bell · chat · plus · check · x · chevron-left/right · settings · share · link · copy · trash · help · logout · edit · search · clock · lock. 이모지는 아이콘 대신 쓰지 않는다(문구 안 이모지도 지운다).

### 4-3. 모임 방 부품 (components/room/)

| 부품 | 내용 |
|---|---|
| `useRoom(roomId)` | 방·멤버·marks·댓글·확정 상태 불러오기, `applyMarks(dates, mode)`, `resetMine()`, `confirm(range)`, `unconfirm()`, 집계(`summary`·`candidates`·`markedIds`). 두 보기가 같이 쓴다 |
| `lib/roomCandidates.ts` | 후보 계산(순수 함수): ① 전원 yes 가 이어진 구간(2일 이상 = '연속 N일', 1순위) ② 전원 yes 하루 ③ yes+after = 전원(시간 조율) — 앞에서부터 최대 6개. 오늘 이전 제외 |
| `ModeBar` | `ui-seg` [되는 날 · 안 되는 날 · 저녁 이후] + 저녁 이후일 때 시각 선택(`TimeSelect`) + '내 표시 지우기' |
| `MemberStrip` | 멤버 칩(아바타 + 이름 + 찍었으면 ✓, 아직이면 '아직'). 내가 아닌 사람 누르면 프로필 |
| `HeatCalendar` | 보드 보기의 달력. 칸 = 날짜 + `n/총` + 히트 바탕 + 내 표시(가능 ○ / 안 됨 숫자 취소선 / 저녁 이후 `19:00~`). **포인터 이벤트**로 누르기·끌기(터치 포함, 끄는 동안 스크롤 막기) |
| `MemberMatrix` | 표 보기의 표. 줄 = 멤버(나 먼저), 칸 = 그 달의 날짜. 맨 아래 '되는 사람' 합계 줄. 전원 가능한 날 = 머리·합계 칸 `--c-primary` 채움 + 칸 테두리. **내 줄만** 누르기·끌기로 고친다. 넓으면 상자 안 가로 스크롤 |
| `MatrixList` | 표 보기 모바일: 줄 = 날짜, 칸 = 멤버. 위 거르기 [전체 · 3명 이상 · 모두 가능]. '내 줄 고치기'를 켜면 날짜 줄을 눌러 내 칸을 바꾼다 |
| `CandidateList` | 후보 목록. 1순위는 큰 카드('추천 · 연속 이틀'). 방장만 '확정' 버튼, 아니면 '방장이 확정할 수 있어요'. 확정된 방이면 맨 위 '확정된 날짜' 카드 + (방장) 바꾸기·확정 취소 |
| `RoomChat` | 방 안에 붙는 대화 패널(떠다니는 창 아님). 말풍선·연속 메시지 묶기·내 메시지 삭제·안 읽음 수. **패널이 보이고 탭이 활성일 때만** 6초 폴링(`document.hidden` 이면 멈춤) |
| `RoomSettingsModal` · `RoomShareModal` | 방장 설정(이름·URL 가입·코드 재발급·멤버 내보내기·삭제) · 초대(링크·코드 복사) |
| `RoomBoardView` / `RoomTableView` | 테마별 배치(6-3) |

## 5. 표시 규칙

- **날짜**: 긴 꼴 `11월 21일 (토)`, 짧은 꼴 `11/21 (토)`, 같은 달 구간 `11/21 (토) – 22 (일)`, 다른 달 `11/30 (월) – 12/1 (화)`. 달 머리 `2026년 11월`. 예전 `2026-09` 꼴은 쓰지 않는다. 함수는 `lib/datetime.ts` 에 모은다(`fmtDay`·`fmtDayShort`·`fmtRange`·`fmtMonth`).
- **시각**: 24시간 `19:00`. 상대 시각 `방금`·`N분 전`·`N시간 전`·`어제`·그 밖은 짧은 날짜.
- **요일 색**: 일요일·공휴일 `--c-sun`, 토요일 `--c-sat`. 공휴일은 `lib/holidays.ts` 를 모임 달력·표·홈 주간에도 쓴다(칸에 이름 작게).
- **가능 상태 말**: 가능 · 안 됨 · `19:00 이후`(짧게 `19시~`). 집계 말: `5명 모두` · `4명 + 이도윤 19시 이후`.
- **방 상태 태그**(목록·사이드바·홈 공통, `roomStatus()` 한 곳에서): 확정 `확정 11/21` (`--accent`) · 후보 있음 `후보 N` (`--accent`) · 나만 안 찍음 `내 차례` (`--warn`) · 아무도 안 찍음 `시작 전` (`--muted`) · 그 밖 `N/M 찍음` (`--primary`).
- **요청 상태**: 대기 `답 기다리는 중`(`--req`) · 수락 `수락함`(`--accent`) · 거절 `거절함`(`--muted`).
- 숫자는 `tabular-nums`. 사람 수는 `5명`, 진행은 `4/5`.
- 사람 이름은 **닉네임 우선**(`displayName()`), 어디서나 같게.

## 6. 화면 배치

### 6-1. 틀 (AppShell)

- **보드 데스크톱**: 왼쪽 `Sidebar`(폭 `--shell-w`, `--c-shell`, 화면 높이 고정·안에서 스크롤) + 오른쪽 본문(`ui-page`).
- **표 데스크톱**: 위 `TopBar`(높이 `--topbar-h`, `--c-shell`, 위에 붙음) + 아래 본문.
- **모바일(<900)** 두 테마 공통 구조: 위 `MobileBar`(붙음) + 본문 + 아래 `BottomTabs`(붙음, `padding-bottom: env(safe-area-inset-bottom)`). 본문 아래 여백 = 탭 높이.
- 메뉴 배지: 홈 = 답할 것 수(받은 대기 시간 요청 + 받은 친구 요청), 사람 = 받은 친구 요청이 있으면 점. 한 번 불러와 틀이 들고 있고, 수락·거절하면 `refreshInbox()` 로 다시.
- 계정: 아바타 → `AccountDrawer`(닉네임·고유 번호·화면 보드/표·관리자·사용 가이드·업데이트 내역·약관·로그아웃·탈퇴).

### 6-2. 홈 (`/home`)

공통 데이터 `useHomeData()`: 받은 대기 시간 요청, 받은 친구 요청, 내 일정(오늘부터 7일), 내 모임(상태 포함), 추천 연차(`computeLeavePlan` 첫 항목).

- **보드(HomeBoard)**: 머리 eyebrow `10월 8일 목요일`, 제목 `김하늘 님, 답할 게 3개 있어요`(없으면 `오늘 일정 N개` / `오늘은 비어 있어요`), 동작 [새 일정]. → '답할 것' 카드 줄(카드마다 아바타·종류·제목·시각·수락/거절) → `ui-grid-2`: 왼쪽 '이번 주' 7칸(오늘 테두리, 공휴일 이름, 일정 작은 블록) / 오른쪽 '내 모임' 카드(상태 태그·진행 막대·한 줄 설명) + '추천 연차' 카드.
- **표(HomeTable)**: 제목 `이번 주, 누가 언제 비나` + 설명 `친구 일정은 “바쁨”만 보여요` → 표: 줄 = 나 + 친구, 칸 = 7일, 칸 안 3띠(오전 06–12 · 오후 12–18 · 저녁 18–24, 바쁨 = `--c-text-2` 계열 채움(보드엔 안 씀), 빔 = 빈 칸 테두리) → 맨 아래 '다 같이 빔' 줄 → [보는 친구 고르기](선택은 localStorage `moim_home_friends`) / 오른쪽 '답할 것' 목록(수락·거절) + '내 모임' 목록 + '추천 연차'. 친구 일정은 `GET /api/calendar/friends` 한 번으로 받는다(8장).
- 모바일: 보드 = 답할 것 카드 세로 → 이번 주(가로 7칸, 좁으면 상자 안 가로 스크롤) → 모임. 표 = 표(이름 칸 64px + 7칸) → 답할 것 → 모임.

### 6-3. 모임 방 (`/rooms/detail?id=`)

공통 머리: eyebrow `모임` · 제목 = 방 이름 · sub `멤버 5명 · 방장 김하늘` (+ 확정됐으면 `ui-chip--accent` `확정 11/21 (토) – 22 (일)`) · 동작 [초대] [설정 아이콘]. 아래 `MemberStrip` + `5명 중 4명 찍음`.

- **보드(RoomBoardView)**: `ui-grid-2` — 왼쪽 카드: 달 이동(`‹ 2026년 11월 ›`) + `ModeBar` + `HeatCalendar` + 아래 줄(`날짜를 누르거나 끌어서 표시해요` · 히트 범례 `0명 ■■■■■ 모두`). 오른쪽 카드: `ui-tabs` [후보 날짜 N · 대화 (안 읽음 배지)] → `CandidateList` 또는 `RoomChat`. 대화 탭이 아닐 때 카드 맨 아래에 마지막 메시지 한 줄 미리보기(누르면 대화 탭).
- **표(RoomTableView)**: 머리 오른쪽에 기간 이동(`‹ 11월 ›`) · [초대] · [내 줄 고치기](켜면 `ModeBar` 가 나타나고 내 줄이 눌린다). `MemberMatrix` 카드 + 범례(가능 · 저녁 이후 · 안 됨 · 모두 가능한 날). 아래 `ui-grid-2`: `CandidateList` 카드 + `RoomChat` 카드(같은 높이).
- **모바일 보드**: 머리(뒤로·방 이름·`5명 모두 찍음`·대화 버튼(배지)) → `ModeBar`(꽉 차게) → `HeatCalendar`(칸 높이 52) → 안내 한 줄 → 아래 탭 위에 붙는 후보 카드(1순위 + 확정 버튼, '모두 보기' 누르면 시트로 전체). 대화는 버튼 → 전체 화면 시트.
- **모바일 표**: 남색 머리(뒤로·방 이름·[내 줄 고치기]) + 거르기 칩 → `MatrixList` → 아래 탭 위 1순위 후보 띠(남색 바탕) → 대화는 머리 버튼 → 시트.
- 확정: 후보의 [확정] → 확인창 `11/21 (토) – 22 (일)로 확정할까요? 멤버 5명의 캘린더에 비공개 일정으로 들어가요.` → `POST /api/rooms/:id/confirm` → 토스트 `확정했어요. 모두의 캘린더에 넣었어요`.
- 멤버가 아니면: `ui-empty`(자물쇠 아이콘) `이 모임의 멤버가 아니에요` + [모임 목록으로].

### 6-4. 모임 목록 (`/rooms`)

머리: 제목 `모임` · 동작 [초대 코드로 입장] [새 모임](주). 본문: 카드 격자(`repeat(auto-fill, minmax(rem(300), 1fr))`): 이름 · 상태 태그 · 진행 막대(찍은 사람/멤버) · 한 줄 설명(`5명 다 찍음 · 추천 11/21 (토) – 22 (일)` 등). 빈 상태: `아직 모임이 없어요` + [새 모임]. `?new=1` 이면 새 모임 팝업을 바로 연다(사이드바·홈에서 씀). 입장 코드는 `CodeBoxes`(8칸, 대문자) 재사용.

### 6-5. 캘린더 (`/dashboard`) · 친구 캘린더 (`/u?id=`)

- 머리: `내 캘린더` · sub `날짜를 누르거나 끌어서 일정을 넣어요` · 동작 [새 일정](주). `?new=1` 이면 새 일정 팝업.
- 카드 안 FullCalendar(월). 툴바: `‹ 2026년 11월 ›` + [오늘]. 칸 숫자 오른쪽 위 작게, 일정 블록은 채움색 + 글자 계산. 공휴일 이름 칸 안 작게.
- 범례: 공개 · 비공개 · 시간 요청 · 모임 확정 · 그룹 색(누르면 색 바꾸기 — 기존 기능).
- 일정 팝업(`Modal`, 제목 `새 일정`/`일정`): 제목 · 날짜(DatePicker) · 시간(TimeSelect)/종일 스위치 · 장소 · 메모 · 공개 범위(`ui-seg` 공개/비공개 + 비공개면 그룹 칩 선택) · 출처 안내(시간 요청·모임 확정이면 `ui-chip`) · [삭제](왼쪽) [취소][저장].
- 친구 캘린더: 머리 eyebrow `사람` · 제목 `서준이 님의 캘린더` · 동작 [시간 요청 보내기] [그룹에 추가]. '바쁨' 블록은 회색 `비공개 일정`.

### 6-6. 사람 (`/friends` · `/tiers` · `/requests`)

세 화면 위에 같은 `PeopleTabs`(`ui-tabs`, 링크): `친구 N` · `그룹 N` · `시간 요청`(대기 있으면 배지). 머리 제목은 `사람`.
- **친구**: 머리 동작 [친구 추가](팝업: 이메일 → 요청). '받은 친구 요청' 목록(수락·거절) → '내 친구' `ui-list`: 아바타 · 이름(닉네임) · 이메일(보조, 작게) · 동작 [캘린더] [시간 요청] [그룹에 추가 ▾](칩 팝오버).
- **그룹**: 머리 동작 [그룹 만들기] [코드로 가입]. 그룹 카드: 색 점 · 이름 · 멤버 수 · 아바타 겹침 · 코드 복사 · [설정](색·이름·멤버 추가/빼기·삭제). 설명 한 줄: `비공개 일정을 이 그룹에게만 자세히 보여줄 수 있어요`.
- **시간 요청**: 머리 동작 [시간 요청 보내기](주). 안쪽 `ui-seg` [받은 요청 · 보낸 요청]. 행: 아바타 · 제목 · 시각(`fmtRange`) · 메시지 · 상태 칩 · 동작(받은 대기: 수락·거절 / 보낸 대기: 취소). 보내기 팝업: 친구(Select) · 날짜 · 시간/종일 · 제목 · 메시지. **시각은 `new Date(...).toISOString()` 으로 보낸다**(버그 수정).

### 6-7. 연차 계산 (`/tools/leave`)

머리: eyebrow `도구` · 제목 `연차 계산기` · sub `주말·공휴일을 엮어 연차를 가장 길게`. `ui-grid-2`: 왼쪽 설정 카드(남은 연차·시작일·갱신일·최대 연속·방식 `ui-seg`) + [계획 만들기](주) / 오른쪽 결과: 요약 숫자(`연차 15일 → 휴무 56일`) + 구간 목록(날짜 구간 · `연차 1일 · 4일 쉬기` · 공휴일 이름 · 효율 배지 `4x`). 로그아웃 상태도 같은 화면(머리만 간단).

### 6-8. 관리자 (`/admin`)

머리 eyebrow `관리자` · 제목 `운영`. `ui-tabs` [개요 · 회원 · 모임 · 그룹]. 개요 = 숫자 카드 격자. 나머지 = `ui-list`(넓으면 표 형태, 상자 안 가로 스크롤) + 행 동작(관리자 지정·탈퇴·삭제는 `ui-btn--danger`).

### 6-9. 랜딩 (`/`) · 로그인 · 콜백

- 테마: 저장된 `moim_ui_theme` 를 따른다(없으면 보드).
- 첫 화면: 가운데 로그인 카드 — 로고 아이콘(56) + 'MOIM' 글자 + 한 줄 소개 + [Google 계정으로 계속하기](구글 흰 버튼 규정 유지) + `또는` + [이메일로 계속하기] → 이메일 입력 → `CodeBoxes` 6칸. 인앱 브라우저 안내는 그대로.
- 아래 소개(LandingContent): 문제 → 기능 4 → 쓰는 법 4단계(**4단계 '날짜 확정'은 이제 실제 기능**) → 로그인 없이 쓰는 연차 계산기 → 자주 묻는 질문. 부유하는 빛 원·유리 효과는 지운다.

## 7. 테마 전환

1. `app/layout.tsx` `<head>` 의 작은 인라인 스크립트가 그리기 전에 `localStorage.moim_ui_theme`(없으면 `board`)를 `html[data-theme]` 에 넣는다 — 깜빡임 방지. `suppressHydrationWarning` 을 `<html>` 에.
2. `AppShell` 이 `/api/auth/me` 를 받으면 `user.uiTheme` 가 있으면 그 값으로 덮고 localStorage 도 맞춘다.
3. `ThemeSwitch` 를 누르면: 즉시 `data-theme`·localStorage 변경 → `PATCH /api/auth/me { uiTheme }`(실패하면 토스트, 화면은 그대로).
4. 테마 전용 React 분기는 `useTheme()` 로만 하고, 분기하는 곳은 0장 '코드 원칙'의 네 곳뿐이다.
5. `<meta name="theme-color">` 는 보드 `#0b0f1c`, 표 `#141a2c`.

## 8. 데이터·API 계약 (2.0 에서 바뀐 것)

| 항목 | 내용 |
|---|---|
| `users.ui_theme` | TEXT NOT NULL DEFAULT `''`. `GET /api/auth/me` 의 `user.uiTheme`. `PATCH /api/auth/me` 가 `{ uiTheme: 'board'\|'table' }` 도 받는다(닉네임과 따로 보내도 서로 안 지움) |
| `rooms.confirmed_start` · `confirmed_end` · `confirmed_at` | TEXT NOT NULL DEFAULT `''`. 날짜는 `YYYY-MM-DD`(끝 포함) |
| `GET /api/rooms` | 방마다 `memberCount`·`markedCount`(1개 이상 찍은 멤버 수)·`myMarked`·`fullDayCount`(오늘 이후 전원 yes 날 수)·`confirmed: {start,end}\|null` 추가 |
| `GET /api/rooms/:id` | `room.confirmed: {start,end,at}\|null` 추가 |
| `POST /api/rooms/:id/confirm` | 방장만. `{ startDate, endDate, start, end }`(`start`·`end` = 브라우저가 만든 ISO — 종일 규칙은 일정 화면과 같다: 첫날 00:00 · 끝날 23:59 로컬). 이전 확정 일정을 지우고 **멤버 모두에게** 비공개 종일 일정(`origin_kind='room'`, `origin_request_id=방 id`, 제목 = 방 이름) 생성 + 방에 기록. 한 batch |
| `DELETE /api/rooms/:id/confirm` | 방장만. 그 방에서 만든 일정 지우고 기록 비움 |
| `GET /api/calendar/friends?from&to` | 내 친구 전원의 일정 **시간만**(`{ userId, start, end, allDay }`) + 친구 목록(`userBrief`). 제목·장소·메모는 공개 일정이라도 싣지 않는다 |
| 일정 `origin.kind` | `'timeRequest'` · `'room'`(새). 색·배지는 `eventColor()` 한 곳에서 |
| 버그 수정 | 일정·그룹·캘린더 조회의 `IN (?…)` 를 소유자 조건 JOIN/하위 쿼리로(바인딩 100개 한도). 시간 요청 수락은 `status='pending'` 조건으로 먼저 바꾸고 바뀐 행이 없으면 409. 확인창 Enter 는 포커스된 버튼만. 시간 요청 시각은 ISO 로 보냄 |

운영 DB 변경은 `worker/migrations/2026-10-renewal.sql`(ALTER TABLE ADD COLUMN 4개). **배포 전에 사용자 확인 후** 백업하고 적용한다. `worker/schema.sql` 에도 같은 칸을 넣는다(새로 만드는 DB 용).

## 9. 접근성

- 클릭되는 것은 `button`·`a`. `div` 에 onClick 금지.
- 아이콘만 있는 버튼은 `aria-label`. 배지 숫자는 `aria-label="안 읽은 메시지 2개"` 처럼 말로.
- 팝업: `role="dialog"` + `aria-modal` + `aria-labelledby`(제목), 열 때 포커스 안으로, 닫으면 돌아옴, ESC 닫기(겹친 창은 맨 위만 — `useEscClose`).
- `ui-seg` 버튼은 `aria-pressed`, 탭은 `role=tab`+`aria-selected`, 현재 메뉴는 `aria-current="page"`.
- 달력·표 칸: `aria-label="11월 21일 토요일, 5명 중 5명 가능, 내 표시: 가능"`. 키보드로 칸에 가서 Enter/Space 로 현재 방식 적용.
- 대비: 본문 4.5:1, 큰 글(24px+)·굵은 18.66px+ 3:1. 색만으로 구분하지 않는다(가능/안 됨/저녁 이후는 글자·무늬도 함께 — 안 됨 = 숫자 취소선, 저녁 이후 = 시각 글자).
- 터치 대상 44px 이상(모바일).

## 10. 확인 방법

1. `npx tsc --noEmit` → `npm run build`(dev 서버가 없을 때만).
2. 옛 클래스 0건: `grep -rnE "app-[a-z]|brand-mark|room-day|evt-busy" frontend/src --include=*.tsx --include=*.ts --include=*.scss` 결과 없음(단 `app/` 폴더 경로 문자열은 제외).
3. 쓰는 클래스가 CSS 에 다 있는지: `scripts/check-classes.mjs`(tsx 의 `className="ui-…"` 를 모아 scss 정의와 대조).
4. 가짜 데이터 격리 환경(`wrangler dev --local --persist-to .wrangler/renewal --port 8791`)에서 두 테마 × 데스크톱 1440·모바일 390 전 화면 촬영, 콘솔 오류 0, 모바일 가로 넘침 0(`document.documentElement.scrollWidth <= innerWidth`).
5. 전·후 비교 그림은 `C:\workspace\OPNAE\_screenshots\Moim-renewal\{_before,_after,_compare}`.

## 11. 사용 가이드 대상 (`data-guide`)

`lib/guide.ts` 가 이 이름으로 스포트라이트를 건다. 화면을 고칠 때 같은 역할의 요소에 그대로 붙인다(없으면 그 스텝은 자동으로 건너뛴다). 화면 머리의 `?` 버튼은 `help`.

| 화면 | 이름 |
|---|---|
| 홈 | `home-inbox` · `home-week`(보드) · `home-free`(표) · `home-rooms` · `home-leave` |
| 캘린더 | `cal` · `cal-new` · `cal-legend` |
| 사람 | `people-tabs` · `friends-add` · `friends-requests` · `friends-list` · `tiers-new` · `tiers-list` · `req-new` · `req-list` |
| 모임 목록 | `rooms-new` · `rooms-join` · `rooms-list` |
| 모임 방 | `room-members` · `room-modes` · `room-cal`(보드 달력/표 표) · `room-cands` · `room-chat` · `room-invite` |
| 연차 계산 | `leave-form` · `leave-calc` · `leave-result` |
