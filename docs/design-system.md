# 디자인 시스템 (2.0 전면 개편)

> 화면의 **단일 기준**이다. 화면을 새로 만들거나 고칠 때 여기 적힌 토큰·클래스·규칙만 쓴다.
> 2026-10 전면 개편(2.0, 10-08 배포)에서 시안 A안(모임 보드)을 **보드 테마**, C안(사람×날짜 표)을 **표 테마**로 둘 다 만들었다. 사용자가 탭으로 고르고, 고른 값은 계정에 저장한다.
> 처음엔 "만들 것" 명세였고, 2026-10-13 현재 코드(2.0.3) 기준으로 고쳐 썼다. 시안 캔버스는 반영 뒤 사용자가 지웠다(2026-10-08). 전·후 비교 그림은 `C:\workspace\OPNAE\_screenshots\Moim-renewal\_compare`.

## 0. 결정 사항

| 항목 | 결정 |
|---|---|
| 테마 | `html[data-theme="board"]` = **보드**(기본, 어두움, 왼쪽 메뉴, 모임 방은 겹침 달력), `html[data-theme="table"]` = **표**(밝음, 위 남색 메뉴, 모임 방은 사람×날짜 표). 화면 전체가 바뀐다 |
| 테마 저장 | 계정 `users.ui_theme`(`'board'`·`'table'`·`''`) + 이 브라우저 `localStorage.moim_ui_theme`(첫 그림 깜빡임 방지용 사본). 계정 값이 우선 |
| 코드 원칙 | **화면 코드(React)는 한 벌.** 테마 차이는 ① 토큰 값 ② 틀(AppShell) 배치 — CSS 로만(네 틀을 다 그리고 테마·화면 폭이 보일 것을 고른다) ③ 모임 방 보기(`RoomBoardView`/`RoomTableView`) ④ 홈(`HomeBoard`/`HomeTable`) 네 곳에만 둔다. React 분기(`useTheme()`)는 ③·④ 를 고르는 `app/(app)/rooms/detail/page.tsx`·`app/(app)/home/page.tsx` 두 곳뿐. 데이터·문구·동작은 공용 훅(`useRoom`, `useHomeData`)에서 한 번만 |
| 메뉴 | 4개: 홈(`/home`) · 캘린더(`/dashboard`) · 모임(`/rooms`) · 사람(`/friends`·`/tiers`·`/requests`·`/u`). 연차 계산(`/tools/leave`)은 보조 링크. 시간 요청은 홈 '답할 것' + 사람 › 시간 요청 탭 |
| 플로팅 + 버튼 | **없앴다**(옛 QuickActions). 각 화면의 할 일은 화면 머리의 버튼으로, 채팅은 모임 방 안 패널로, 사용 가이드는 화면 머리의 `?` 버튼으로 |
| 로고 | `app/icon.svg`(달력 아이콘)와 'MOIM' 글자(Black Ops One)를 그대로 쓴다(`shell/BrandMark`). 아이콘 파일은 고치지 않는다. 틀의 로고 글자는 그라데이션 `#8ea2ff → #c0a3ff → #7be0d0`(`Shell.module.scss`), 랜딩 로그인 카드는 `--c-primary → --c-accent` |
| 색 | 로고에서 뽑았다 — 아이콘 판 남색 `#141a2c`, 그라데이션 양 끝 인디고 `#7c8cff` · 틸 `#46d6c2` |
| 글꼴 | 본문·숫자 Pretendard(버전 고정 CDN). 숫자는 `font-variant-numeric: tabular-nums`. 로고 글자만 Black Ops One(next/font). 한글 화면에 고정폭 글꼴을 쓰지 않는다(옛 `EnMono` 별칭은 지웠다) |
| 치수 | 기존 규칙 유지: SCSS 에서 `rem(px)`(`@use '@/styles/rem' as *;`). 루트 글자 크기는 `clamp(14px, 12px + 0.45vw, 18px)` 그대로(넓은 화면 글자 크게 — 사용자 요청이었음). 미디어 쿼리만 px |
| 클래스 | 전역 공용 부품은 **`ui-` 접두어**(예전 `app-*` 는 다시 쓰지 않는다). 화면 전용은 CSS Module |

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
frontend/src/components/shell/       AppShell(네 틀) · ShellContext · nav · BrandMark · ThemeSwitch · Shell.module.scss
frontend/src/components/room/        모임 방 부품(두 보기 공용 + 보기별)
frontend/src/components/home/        홈 부품
frontend/src/components/people/      PeopleTabs
frontend/src/lib/                    공용 함수·훅 (datetime · theme/themeInit · roomCandidates · roomStatus · share …)
frontend/src/release/                업데이트 내역(releases.ts) · ReleaseModal
frontend/src/app/<route>/*.module.scss  화면 전용
```

- `app/layout.tsx` 가 `tokens → base → components → fullcalendar` 순서로 import 한다(옛 `app/globals.scss` 는 지웠다).
- 로그인 뒤 화면은 route group `app/(app)/` 아래에 있고 `app/(app)/layout.tsx` 가 `AppShell` 을 한 번만 그린다(이동할 때 메뉴가 다시 만들어지지 않아 깜빡임 없음). 주소에는 `(app)` 이 안 나온다.
  - `(app)` 안: home · dashboard · friends · tiers · requests · rooms · rooms/detail · u · tools/leave · admin
  - 밖: `/`(랜딩) · `/auth/callback`
  - `/tools/leave` 는 로그아웃 상태에서도 열린다 → AppShell 이 토큰이 없으면 '간단한 머리'(로고 + `ThemeSwitch`(local) + 로그인 버튼)만 그린다. 그 밖의 화면은 주소를 sessionStorage `postLoginRedirect` 에 두고 `/` 로 보낸다(로그인 뒤 복귀).
- 상태는 클래스 대신 **속성**: `aria-current`·`aria-selected`·`aria-pressed`·`aria-expanded`·`data-state`·`data-level`·`[hidden]`·`:disabled`.
- 테마 차이는 각 SCSS 파일 **맨 아래** 한 블록에 모은다: 전역 파일은 `html[data-theme='table'] …`, 모듈은 `:global(html[data-theme='table']) .x { … }`. 그 밖에 흩지 않는다.
- 인라인 `style={{}}` 은 **데이터로 정해지는 값만**(그룹 색, 아바타 색, 진행 막대 폭, 칸 수 같은 CSS 변수 `--n`·`--m`·`--ev`, 화면 위치를 재서 놓는 팝업 좌표). 그 밖에는 금지. 히트 단계 색은 인라인이 아니라 `data-level` + CSS. (남은 예외: `ColorWheel` 밝기 슬라이더의 `width`·`marginTop` — UPGRADE-IDEAS D)

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
| `--c-on-warn` | `#2a1600` | `#2a1600` | 채움 위 글자 |
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
| `--c-input-bg` | `#0b0f1c` | `#ffffff` | 입력칸 바탕(`ui-input`·`ui-select`·`ui-textarea`) |
| `--c-seg-bg` | `#0b0f1c` | `#eef0f6` | 분할 버튼(`ui-seg`) 바탕 |
| `--c-tab-line` | `#46d6c2` | `#141a2c` | 밑줄 탭(`ui-tabs`) 선택 밑줄 |

`color-scheme` 도 tokens.scss 에 있다(보드 `dark`, 표 `light`).
모바일 아래 탭은 표 테마에서 흰 바탕(`--c-surface`)에 `--c-text-3`/`--c-text` 글자다(시안 C 모바일), 보드 테마의 현재 탭은 `--c-accent` — 둘 다 `shell/Shell.module.scss` 에서(표 테마 덮어쓰기는 맨 아래 블록).

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
--shadow-card: none;                          // 표: 0 1px 2px rgba(20,26,44,.04)
--z-shell: 50; --z-sheet: 80; --z-modal: 100; --z-toast: 120; --z-confirm: 130; --z-guide: 140;
--shell-w: rem(248);      // 보드 사이드바 폭
--topbar-h: rem(60);      // 표 위 메뉴 높이
--mobilebar-h: 56px;      // 모바일 위 머리
--tabbar-h: 64px;         // 모바일 아래 탭 (safe-area 더함)
--content-max: rem(1320);
--ease: cubic-bezier(.2,.7,.3,1); --dur: 160ms;   // 전환
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
- `color-scheme`: 보드 `dark`, 표 `light`(tokens.scss).

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
| `ui-input` · `ui-select` · `ui-textarea` | 높이 `--h-md`, 바탕 `--c-input-bg`, 테두리 `--c-line-strong`, focus 때 `--c-focus` 테두리 |
| `ui-field` | 세로 묶음: `ui-label` + 입력 + `ui-help`(13, `--c-text-3`) / `ui-error`(13, `--c-danger`) |
| `ui-form` | `display:flex; flex-direction:column; gap: var(--sp-4)` |
| `ui-inline` · `ui-spacer` | 가로 한 줄 묶음 · 남는 폭 밀어내기 |
| `ui-actions` | 팝업·폼 아래 버튼 줄. 오른쪽 정렬, 취소(왼쪽)·주 동작(오른쪽). 좁은 화면에선 꽉 차게 |
| `ui-card` | `--c-surface` + 1px `--c-line` + `--r-xl`(좁은 화면·표 테마는 `--r-lg`) + 안쪽 `--sp-5`. `ui-card__head`(제목 + 오른쪽 동작), `ui-card__title`(17/700), `ui-card__sub` |
| `ui-seg` | 분할 버튼(보기·표시 방법). 안의 `button[aria-pressed=true]` 가 선택. 바탕 `--c-seg-bg`. `ui-seg--block` = 꽉 차게 |
| `ui-tabs` | 밑줄 탭. `role=tablist` 안 `button[role=tab][aria-selected]` 또는 `a[aria-current=page]`. 선택 밑줄 `--c-tab-line`(보드 accent, 표 primary) |
| `ui-chip` | 작은 알약 태그. 변형 `--accent` · `--warn` · `--req` · `--muted` · `--primary` (각 soft 바탕 + text 색) |
| `ui-badge` | 숫자 배지(빨강 `--c-danger`, 99+). `ui-badge--primary` = 메뉴의 홈 배지(표 테마 위 메뉴에선 accent). `ui-dot` 은 8px 점 |
| `ui-avatar` | 원형. `--sm` 28 · (기본) 36 · `--lg` 56. 사진 없으면 이름 첫 글자(`initialOf()` — 한글 3~4자 이름은 둘째 글자, 김하늘 → 하) + 사람마다 정해진 파스텔 색(`avatarColor(id)`) |
| `ui-list` · `ui-row` | 목록. 행 = 아바타 + 본문(`ui-row__main` 안 `ui-row__title`/`ui-row__sub`) + 오른쪽 동작(`ui-row__side`). 행 사이 1px `--c-line` |
| `ui-empty` | 빈 상태. `ui-empty__icon`(선 SVG) + `ui-empty__title`·`ui-empty__text` + 동작 버튼 하나 |
| `ui-skeleton` | 불러오는 중 자리(회색 막대). "없습니다"를 불러오기 전에 보이지 않게 이걸 먼저 |
| `ui-progress` | 진행 막대(찍은 사람/멤버 — 폭은 인라인 데이터 값) |
| `ui-legend` | 범례 줄(`ui-legend__sw` 색 칸 + 글) |
| `ui-switch` | 켜기/끄기(체크박스 + `ui-switch__track`) |
| `ui-scrim` · `ui-modal` | 팝업. 가운데 카드, `--r-xl`, 최대 폭 `rem(520)`(`ui-modal--sm` 420 · `--lg` 720). **좁은 화면(<600)에선 아래에서 올라오는 시트**(위 모서리만 둥글게, 손잡이 막대) |
| `ui-modal__head` · `ui-modal__title` · `ui-modal__body` · `ui-modal__foot` | 머리(제목 + 닫기 ✕) · 본문(스크롤) · 아래 버튼 줄 |
| `ui-drawer` · `ui-drawer-scrim` | 오른쪽에서 나오는 계정 서랍(폭 `min(100%, rem(380))`) |
| `ui-popover` · `ui-menu` | 버튼 아래 뜨는 작은 팝업 · 그 안 항목 목록 |
| `ui-confirm` | 확인창(최상단, `ui-confirm-scrim` · `__title` · `__msg`). 확인 버튼에 포커스, Enter 는 **포커스된 버튼**만 누른다 |
| `ui-page` | 화면 본문 그릇(`max-width: var(--content-max)`, 좌우 `--sp-8`, 모바일 `--sp-4`) |
| `ui-page-head` | 화면 머리: `ui-page-head__main` 안 `ui-page-head__eyebrow`(13, `--c-text-3`) · `h1`(보드 30/700, 표 26/700 — 모바일 24/22) · `ui-page-head__sub`(14, `--c-text-2`) · 오른쪽 `ui-page-head__actions` |
| `ui-grid-2` | 본문 + 옆 패널: `display:flex; flex-wrap:wrap; gap`. `ui-grid-2__main` `flex: 999 1 rem(560)`, `ui-grid-2__side` `flex: 1 1 rem(320)` — 좁으면 자동으로 쌓인다 |
| `ui-num` · `ui-muted` | 숫자 고정폭(tabular-nums) · 흐린 글자 |
| `ui-sr-only` | 화면에서 숨기고 읽기 프로그램만 |

### 4-2. React 컴포넌트

| 컴포넌트 | 하는 일 |
|---|---|
| `shell/AppShell` | 로그인 확인(토큰 없으면 주소를 기억하고 `/` 로 — `/tools/leave` 만 간단한 머리) → `ShellProvider` → 네 틀을 **모두 그리고 CSS 가 하나만 보인다**(깜빡임 없음): 보드 데스크톱 왼쪽 사이드바(로고 · 메뉴 4 + 연차 계산 · '내 모임' 6개까지 + 모두 보기 · 새 모임 · `ThemeSwitch` + 내 계정) / 표 데스크톱 위 남색 메뉴(로고 · 메뉴 4 · 연차 계산 링크 · `ThemeSwitch` · 아바타) / 모바일 위 머리(로고 · `ThemeSwitch` · 아바타) / 모바일 아래 탭 4개(배지·점). 별도 Sidebar·TopBar·BottomTabs 파일은 없다 |
| `shell/ShellContext` | `ShellProvider` / `useShell()` — `me`(내 정보 1회 조회, 받으면 계정 테마 적용) · `inbox`(받은 대기 시간 요청 + 받은 친구 요청) · `rooms`(내 모임 목록) + `refreshMe`·`refreshInbox`·`refreshRooms`, `inboxCount()` |
| `shell/nav` | `NAV`(메뉴 4개) · `LEAVE_LINK` · `normPath()`(끝 '/' 떼기 — 정적 export 는 둘 다 온다) |
| `shell/BrandMark` | 로고(icon.svg + 'MOIM'). props `href`·`size` |
| `shell/ThemeSwitch` | '보드 \| 표' 두 칸(`.themeSwitch`, `aria-pressed`). 누르면 즉시 `data-theme` 바꾸고 `chooseTheme()` → `PATCH /api/auth/me {uiTheme}`. props `tone`('shell' 메뉴 위 / 'surface' 카드·서랍 위)·`local`(서버에 저장하지 않음 — 로그아웃 상태 랜딩·연차 계산) |
| `PageHeader` | `ui-page-head` 를 그린다. props: `eyebrow`·`title`·`badge`(제목 옆 칩)·`sub`·`actions`. 그 화면에 사용 가이드가 있으면 `?` 버튼(`data-guide="help"`) 자동 표시 |
| `Modal` | `ui-scrim`+`ui-modal`. props: `title`·`onClose`·`footer`·`size('sm'\|'md'\|'lg')`·`className`. ESC(`useEscClose`)·바깥 클릭 닫기·열 때 첫 입력에 포커스·닫으면 연 버튼으로 포커스 복귀 |
| `Calendar` | FullCalendar 월 뷰 감싸기(일정 화면·친구 캘린더). 친구의 볼 수 없는 일정은 회색 '비공개 일정', 내가 보낸 대기 시간 요청도 점선 블록, 공휴일 이름 칸 안 |
| `Avatar` | 사진 또는 첫 글자 원. `size` prop |
| `Toaster` | 아래 가운데 알림(`Toaster.module.scss`). 성공 `--c-accent`·오류 `--c-danger` 왼쪽 점, 모바일은 아래 탭 위 |
| `TierPicker` | '그룹에 추가' 칩 목록(친구 목록·친구 캘린더·프로필 공용) |
| `CopyButton` | 복사 버튼. `share` 를 주면 휴대폰·태블릿(`(hover: none) and (pointer: coarse)`)에선 기기 공유창, PC 에선 복사(`lib/share.ts` — 2.0.3) |
| `people/PeopleTabs` | 사람 세 화면 위 탭(친구 N · 그룹 N · 시간 요청) |
| `Select`·`TimeSelect`·`DatePicker`·`ColorPalette`(+`ColorWheel`)·`CodeBoxes`·`Accordion`·`MemberRow`·`Notice`·`ConfirmHost`·`GuideHost`·`AccountDrawer`·`LegalModal`·`UserProfileModal`·`LandingContent`·`JsonLd` | 겉모양은 `ui-*`·모듈. `Notice` 는 `role="status"`/오류는 `role="alert"` |
| `release/ReleaseModal` | 업데이트 내역(단일 출처 `release/releases.ts`) — 계정 서랍에서 연다 |
| `AdUnit` | 수동 광고 슬롯 — AdSense 승인 전이라 아직 아무 데서도 안 쓴다(지우지 않는다) |

옛 `QuickActions`·`lib/quickActions.ts`·`PageHero`·`Nav`·`app/globals.scss` 는 2.0 에서 지웠다.

`Icon` 은 선 아이콘 한 벌(24 격자, stroke 2, round, props `size`·`stroke`·`className`): home · calendar · rooms(달력+가운데 칸, 로고와 같은 모양) · users · user-plus · sun · bell · chat · send · plus · check · x · chevron-left/right/down · arrow-left · settings · share · link · copy · trash · edit · help · logout · enter · search · clock · lock · mail · more · tag · refresh · eraser. 이모지는 아이콘 대신 쓰지 않는다(문구 안 이모지도 쓰지 않는다).

### 4-3. 모임 방 부품 (components/room/)

| 부품 | 내용 |
|---|---|
| `useRoom(roomId)` | 방·멤버·marks·대화·확정 상태를 한 번에 가진다(두 보기 공용, 타입 `RoomApi`). 멤버가 아니면 먼저 URL 가입(`POST /join-url`)을 시도하고 안 되면 `phase='denied'`. 화면이 보이고 저장 중이 아닐 때 30초마다 방 전체를 다시 받는다. 주요 반환: `phase`·`room`·`members`/`ordered`(나 먼저)·`total`·`isOwner`·`ownerName`·`availabilities`·`myMarks`·`summary`·`cands`(후보)·`markedIds`/`markedCount`·`holidays`·`comments`·`unread`(이 브라우저 `localStorage` `moim_chat_seen_<id>` 기준)·`markChatSeen`·`refreshComments`·`mode`/`setMode`·`afterTime`/`setAfterTime`·`month`/`shiftMonth`/`goToday`·`reload`, 동작 `applyMarks(dates, isDrag)`(현재 `mode` 로)·`resetMine()`·`confirm(range, changing?)`·`unconfirm()` |
| `lib/roomCandidates.ts` | 집계(순수 함수): `summarize`(날짜 → yes·after·no 수) · `heatLevel` · `marksByUser`(사람 → 날짜 → 표시) · 후보 계산: ① 전원 yes 가 이어진 구간(2일 이상 = '연속 N일', 1순위) ② 전원 yes 하루 ③ yes+after = 전원(시간 조율) — 앞에서부터 최대 6개. 오늘 이전 제외 |
| `format.ts` | 칸 읽어 주는 글 — `hourText`('19:00' → '19시') · `markWords`(가능·안 됨·19:00 이후·없음). 날짜를 말로는 `lib/datetime` `fmtDayWords` |
| `useDragSelect` | 달력·표 공용 누르기/끌기 — 포인터 이벤트, 터치는 280ms 길게 눌러 끌기(끄는 동안 스크롤 막기), 키보드 Enter/Space |
| `ModeBar` | `ui-seg` [되는 날 · 안 되는 날 · 저녁 이후] + 저녁 이후일 때 시각 선택(`TimeSelect`) + '내 표시 지우기' + 새로고침 아이콘 |
| `MemberStrip` | 멤버 칩(아바타 + 이름 + 찍었으면 ✓, 아직이면 '아직') + 진행 한 줄('N명 중 M명 찍음' / 'N명 모두 날짜를 찍었어요'). 내가 아닌 사람 누르면 프로필. 모바일에선 숨긴다 |
| `MonthNav` | `‹ 2026년 11월 ›` + [오늘]. `short` 면 '11월' |
| `HeatCalendar` | 보드 보기의 달력. 칸 = 날짜 + `n/총` + 히트 바탕(`data-level`) + 내 표시(가능 ○ / 안 됨 숫자 취소선 / 저녁 이후 `19:00~`) |
| `MemberMatrix` | 표 보기의 표. 줄 = 멤버(나 먼저), 칸 = 그 달의 날짜. 맨 아래 '되는 사람' 합계 줄. 전원 가능한 날 = 머리·합계 칸 `--c-primary` 채움 + 칸 테두리. **내 줄만** 누르기·끌기로 고친다. 넓으면 상자 안 가로 스크롤 |
| `MatrixList` | 표 보기 모바일: 줄 = 날짜(오늘 이후), 칸 = 멤버. 위 거르기 `MatrixFilters` [전체 · 3명 이상(멤버 4명 이상일 때만) · 모두 가능] — 기본은 4명 이상이면 '3명 이상', 고치기를 켜면 '전체'. '내 줄 고치기'를 켜면 날짜 줄을 눌러 내 칸을 바꾼다 |
| `CandidateList` | 후보 목록. 1순위는 큰 카드('추천 · 연속 이틀'). 방장만 '확정' 버튼, 아니면 '방장이 확정할 수 있어요'. 확정된 방이면 맨 위 '확정된 날짜' 카드 + (방장) 바꾸기·확정 취소. 같은 파일의 `CandidateStrip` = 모바일 아래 띠(1순위 + 확정, 후보 2개 이상이면 '후보 N개 보기') |
| `RoomChat` | 방 안에 붙는 대화 패널(떠다니는 창 아님). 말풍선·연속 메시지 묶기·내 메시지 삭제(방장은 남의 것도). **패널이 보이고 탭이 활성일 때만** 6초 폴링(`document.hidden` 이면 멈춤) |
| `SheetPanel` | 데스크톱은 카드, 모바일은 열면 전체 화면 시트 — 같은 요소 하나라 대화 패널이 두 벌 생기지 않는다 |
| `RoomMobileHead` | 모바일 방 머리(뒤로 · 방 이름 · 한 줄 설명) + `HeadIconButton`(초대·설정·대화, 배지) |
| `RoomSettingsModal` · `RoomShareModal` | 설정(방장: 이름·URL 가입·코드 재발급·멤버 내보내기·삭제 / 멤버: 코드·멤버 목록과 '방장만…' 안내) · '친구 초대'(링크 `CopyButton share` — 휴대폰은 '공유하기'로 기기 공유창, PC 는 '링크 복사' + 코드 복사) |
| `RoomBoardView` / `RoomTableView` | 테마별 배치(6-3) |

## 5. 표시 규칙

- **날짜**: 긴 꼴 `11월 21일 (토)`, 말로 `11월 21일 토요일`(홈 머리·읽어 주는 글), 짧은 꼴 `11/21 (토)`, 같은 달 구간 `11/21 (토) – 22 (일)`, 다른 달 `11/30 (월) – 12/1 (화)`. 달 머리 `2026년 11월`. 예전 `2026-09`·`2026-09-01 (화)` 꼴은 쓰지 않는다. 함수는 `lib/datetime.ts` 에 모은다: `fmtDay` · `fmtDayWords` · `fmtDayShort` · `fmtDayRange`(Date 두 개) · `fmtKeyRange`('YYYY-MM-DD' 두 개) · `fmtMonth` · `fcMonthTitle`(FullCalendar 제목).
- **시각**: 24시간 `19:00`(`fmtTime`). 일정 시각은 `fmtEventTime`(종일 `11/21 (토) 종일`, 시간 지정 `11/21 (토) 19:00 – 21:00`). 상대 시각(`fmtRelative`) `방금`·`N분 전`·`N시간 전`·`어제`·그 밖은 짧은 날짜. 종일 구간을 서버에 보낼 땐 `allDayIsoRange`(첫날 00:00 · 끝날 23:59 로컬).
- **요일 색**: 일요일·공휴일 `--c-sun`, 토요일 `--c-sat`. 공휴일은 `lib/holidays.ts` 를 모임 달력·표·홈 주간에도 쓴다(칸에 이름 작게).
- **가능 상태 말**: 가능 · 안 됨 · `19:00 이후`(달력 칸은 `19:00~`). 집계 말: `5명 모두 종일 가능`(+ `· N일 연속`) · `4명 + 이도윤 19시 이후`(`hourText`).
- **방 상태 태그**(목록·사이드바·홈 공통, `roomStatus()` 한 곳에서 — `label`·`tone`·`desc`(한 줄 설명)·`progress` 를 돌려준다): 확정 `확정 11/21` (`--accent`) · 후보 있음 `후보 N`(N = 오늘 이후 전원 yes 인 날 수 `fullDayCount` — 방 안 '후보 날짜 N' 과 다를 수 있다) (`--accent`) · 내가 안 찍었고 누군가는 찍음 `내 차례` (`--warn`) · 아무도 안 찍음 `시작 전` (`--muted`) · 그 밖 `N/M 찍음` (`--primary`).
- **요청 상태**: 대기 `답 기다리는 중`(`--req`) · 수락 `수락함`(`--accent`) · 거절 `거절함`(`--muted`).
- 숫자는 `tabular-nums`. 사람 수는 `5명`, 진행은 `4/5`.
- 사람 이름은 **닉네임 우선**(`lib/format` `displayName()` — 없으면 구글 이름, 그것도 없으면 '사용자'), 어디서나 같게.

## 6. 화면 배치

### 6-1. 틀 (AppShell)

네 틀 모두 `AppShell.tsx` 안 마크업이고 `Shell.module.scss` 가 테마·화면 폭으로 하나만 보인다.
- **보드 데스크톱**: 왼쪽 사이드바(폭 `--shell-w`, `--c-shell`, 화면 높이 고정·안에서 스크롤) + 오른쪽 본문(`ui-page`).
- **표 데스크톱**: 위 남색 메뉴(높이 `--topbar-h`, `--c-shell`, 위에 붙음) + 아래 본문.
- **모바일(<900)** 두 테마 공통 구조: 위 머리(붙음, 늘 로고 + `ThemeSwitch` + 아바타 — 뒤로·방 이름은 모임 방 안 `RoomMobileHead` 가 맡는다) + 본문 + 아래 탭(붙음, `padding-bottom: env(safe-area-inset-bottom)`). 본문 아래 여백 = 탭 높이.
- 메뉴 배지: 홈 = 답할 것 수(받은 대기 시간 요청 + 받은 친구 요청, `ui-badge--primary`), 사람 = 받은 친구 요청이 있으면 점. 한 번 불러와 틀(`useShell()`)이 들고 있고, 수락·거절하면 `refreshInbox()` 로 다시.
- 계정: 아바타 → `AccountDrawer`(프로필·관리자 칩 · 화면 보드/표 · 닉네임 · 고유 번호 · 관리자 화면 · 업데이트 내역 · 이용약관 · 개인정보 처리방침 · 로그아웃 · 회원 탈퇴). 사용 가이드는 서랍이 아니라 화면 머리 `?` 버튼.

### 6-2. 홈 (`/home`)

공통 데이터 `useHomeData({ withFriends })`(친구 일정은 표 테마일 때만 받는다): 받은 대기 시간 요청, 받은 친구 요청, 내 일정(오늘부터 7일), 내 모임(상태 포함), 추천 연차(시작일 = 저장된 시작일이 미래면 그 날, 아니면 오늘 → `computeLeavePlan` 결과 중 끝나는 날이 오늘 이후인 첫 구간). 같이 쓰는 조각은 `home/HomeParts`(`AnswerButtons`·`LeaveCard`·`SkeletonBlock`), 이번 주 계산은 `home/week.ts`(`BANDS`·`busyBands`·`eventsOnDay`).

- **보드(HomeBoard)**: 머리 eyebrow `10월 8일 목요일`(`fmtDayWords`), 제목 `김하늘 님, 답할 게 3개 있어요`(불러오기 전 `○○ 님, 안녕하세요`, 없으면 `오늘 일정 N개` / `오늘은 비어 있어요`), 동작 [새 일정]. → '답할 것' 카드 줄(카드마다 아바타·종류·제목·시각·수락/거절, 없으면 '지금 답할 것이 없어요' 한 줄) → `ui-grid-2`: 왼쪽 '이번 주' 7칸(오늘 테두리, 공휴일 이름, 일정 작은 블록, '캘린더 열기') / 오른쪽 '내 모임' 카드 4개까지(상태 태그·진행 막대·한 줄 설명, '모임 N개 모두 보기') + '추천 연차' 카드.
- **표(HomeTable)**: 제목 `이번 주, 누가 언제 비나` + 설명 `{날짜 구간} · 친구 일정은 “바쁨”만 보여요`, 동작 [새 일정]·[모임 만들기] → 표: 줄 = 나 + 친구, 칸 = 7일, 칸 안 3띠(오전 06–12 · 오후 12–18 · 저녁 18–24, 바쁨 = `--c-text-2` 계열 채움(보드엔 안 씀), 빔 = 빈 칸 테두리) → 맨 아래 '다 같이 빔' 줄 → [보는 친구 고르기](기본 앞에서 5명, '모두 보기·모두 끄기', 선택은 localStorage `moim_home_friends`) / 오른쪽 '답할 것' 목록(수락·거절) + '내 모임' 목록 + '추천 연차'. 친구 일정은 `GET /api/calendar/friends` 한 번으로 받는다(8장).
- 모바일: 보드 = 답할 것 카드(가로로 넘기기, 폭 86%) → 이번 주(가로 7칸, 좁으면 상자 안 가로 스크롤) → 모임. 표 = 표(이름 칸 64px, <600 에선 아바타만 34px + 7칸) → 답할 것 → 모임.

### 6-3. 모임 방 (`/rooms/detail?id=`)

공통 머리: eyebrow `모임` · 제목 = 방 이름 · sub `멤버 5명 · 방장 김하늘` (+ 확정됐으면 `ui-chip--accent` `확정 11/21 (토) – 22 (일)`) · 동작 [초대] [설정 아이콘]. 아래 `MemberStrip` + `5명 중 4명 찍음`.

- **보드(RoomBoardView)**: `ui-grid-2` — 왼쪽 카드: `MonthNav`(`‹ 2026년 11월 ›` + [오늘]) + `ModeBar` + `HeatCalendar` + 아래 줄(`날짜를 누르거나 끌어서 표시해요` — 터치 기기는 따로 안내 · 히트 범례 `0명 ■■■■■ 모두`). 오른쪽 카드: `ui-tabs` [후보 날짜 N · 대화 (안 읽음 배지)] → `CandidateList` 또는 `RoomChat`. 대화 탭이 아닐 때 카드 맨 아래에 마지막 메시지 한 줄 미리보기(누르면 대화 탭).
- **표(RoomTableView)**: 머리 동작 `MonthNav`(짧은 꼴 `‹ 11월 ›` + [오늘]) · [초대] · [설정 아이콘] · [내 줄 고치기](주 버튼, 켜면 '고치기 끝' — 안내 '표에서 내 줄을 눌러 표시해요'와 `ModeBar` 가 나타나고 내 줄이 눌린다). `MemberMatrix` 카드 + 범례(가능 · 저녁 이후 · 안 됨 · 모두 가능한 날). 아래 두 카드 '후보'(`CandidateList`) · '대화'(`RoomChat`) — 모듈 `.bottom`(각 `flex: 1 1 rem(420)`, 같은 높이).
- **모바일 보드**: `RoomMobileHead`(뒤로 · 방 이름 · `5명 모두 찍음`(확정이면 `확정 …`) · 오른쪽 아이콘 [초대][설정][대화(배지)]) → `ModeBar`(꽉 차게) → `HeatCalendar`(칸 높이 52) → 안내 한 줄 → 아래 탭 위에 붙는 `CandidateStrip`(1순위 + 확정 버튼 — 방장 아니면 '방장이 확정해요', 후보 2개 이상이면 '후보 N개 보기' → 시트). 대화는 머리 버튼 → 전체 화면 시트(`SheetPanel`). `MemberStrip` 은 모바일에서 숨긴다.
- **모바일 표**: 남색 머리(뒤로 · 방 이름 · `N월 · 진행`) + 둘째 줄 거르기 칩 + [초대][설정][대화] 아이콘 → `MonthNav`(짧은 꼴) → `MatrixList` → 아래 탭 위 1순위 후보 띠(남색 바탕) → 대화는 머리 버튼 → 시트.
- 초대(2.0.3): PC·모바일 모두 [초대] → `RoomShareModal`('친구 초대'). 그 안의 링크 버튼이 휴대폰·태블릿은 '공유하기'(기기 공유창), PC 는 '링크 복사'.
- 확정: 후보의 [확정] → 확인창 `11/21 (토) – 22 (일)로 확정할까요? 멤버 5명의 캘린더에 비공개 일정으로 들어가요.` → `POST /api/rooms/:id/confirm` → 토스트 `확정했어요. 모두의 캘린더에 넣었어요`.
- 멤버가 아니면: 먼저 URL 가입을 시도하고(방장이 켰으면 바로 들어간다), 안 되면 `ui-empty`(자물쇠 아이콘) `이 모임의 멤버가 아니에요` + 안내 + [모임 목록으로].

### 6-4. 모임 목록 (`/rooms`)

머리: 제목 `모임` · 설명 · 동작 [초대 코드로 입장] [새 모임] (주). 본문: 카드 격자(`repeat(auto-fill, minmax(rem(300), 1fr))`): 이름 · 상태 태그 · 진행 막대(찍은 사람/멤버) · `멤버 N명 · 내가 방장` · 한 줄 설명(`roomStatus().desc` — `3/5명 찍음 · 모두 되는 날 2일`, `5명 중 3명 찍음 · 나도 아직이에요`, `… 로 정했어요` 등). 빈 상태: `아직 모임이 없어요` + [새 모임]. `?new=1` 이면 새 모임 팝업, `?join=1` 이면 입장 팝업을 바로 연다(사이드바·홈에서 씀). 입장 코드는 `CodeBoxes`(8칸, 대문자) 재사용.

### 6-5. 캘린더 (`/dashboard`) · 친구 캘린더 (`/u?id=`)

- 머리: `내 캘린더` · sub `날짜를 누르거나 끌어서 일정을 넣어요` · 동작 [새 일정] (주). `?new=1` 이면 새 일정 팝업.
- 카드 안 FullCalendar(월). 툴바: `‹ 2026년 11월 ›` + [오늘]. 칸 숫자 오른쪽 위 작게, 일정 블록은 채움색 + 글자 계산. 공휴일 이름 칸 안 작게.
- 범례: 공개 · 비공개 · 시간 요청 · 모임 확정 · 답 기다리는 요청(내가 보낸 대기 요청 — 점선 블록) · 그룹 색(누르면 색 바꾸기).
- 일정 팝업(`Modal`, 제목 `새 일정`/`일정`): 제목 · 날짜(DatePicker) · 시간(TimeSelect)/종일 스위치 · 장소 · 메모 · 공개 범위(`ui-seg` 공개/비공개 + 비공개면 그룹 칩 선택) · 출처 안내(시간 요청·모임 확정이면 `ui-chip`) · [삭제] (왼쪽) [취소][저장].
- 친구 캘린더: 머리 eyebrow `사람` · 제목 `서준이 님의 캘린더` · 동작 [시간 요청 보내기] [그룹에 추가]. '바쁨' 블록은 회색 `비공개 일정`. 내 것을 열면 동작 버튼이 없다.

### 6-6. 사람 (`/friends` · `/tiers` · `/requests`)

세 화면 위에 같은 `PeopleTabs`(`ui-tabs`, 링크): `친구 N` · `그룹 N` · `시간 요청`(대기 있으면 배지). 머리 제목은 `사람`.
- **친구**: 머리 동작 [친구 추가](팝업: 이메일 → 요청). '받은 친구 요청' 목록(수락·거절) → '내 친구' `ui-list`: 아바타 · 이름(닉네임) · 이메일(보조, 작게) · 동작 [캘린더] [시간 요청] [그룹에 추가 ▾](칩 팝오버).
- **그룹**: 머리 동작 [그룹 만들기] [코드로 가입]. 그룹 카드: 색 점 · 이름 · 멤버 수 · 아바타 겹침 · 코드 복사 · [설정](색·멤버 추가/빼기·삭제 — 이름은 바꿀 수 없다, `PATCH /api/tiers/:id` 는 색만). 설명 한 줄: `비공개 일정을 이 그룹에게만 자세히 보여줄 수 있어요`.
- **시간 요청**: 머리 동작 [시간 요청 보내기] (주). 안쪽 `ui-seg` [받은 요청 · 보낸 요청]. 행: 아바타 · 제목 · 시각(`fmtEventTime`) · 메시지 · 상태 칩 · 동작(받은 대기: 칩 없이 수락·거절 / 보낸 대기: 취소). 보내기 팝업: 친구(Select) · 날짜 · 시간/종일 · 제목 · 메시지. `?to=<userId>` 로 들어오면 받는 사람을 고른 채 팝업이 열린다(프로필·친구 목록에서). **시각은 ISO(`toISOString()`·종일은 `allDayIsoRange`)로 보낸다**(2.0 버그 수정).

### 6-7. 연차 계산 (`/tools/leave`)

머리: eyebrow `도구` · 제목 `연차 계산기` · sub `주말·공휴일을 엮어 연차를 가장 길게 써요`. `ui-grid-2`: 왼쪽 설정 카드(남은 연차·시작일·갱신일·최대 연속·방식 `ui-seg`) + [계획 만들기] (주) / 오른쪽 결과: 요약 숫자(`연차 15일 → 휴무 56일`) + 구간 목록(날짜 구간 · `연차 1일 · 4일 쉬기` · 공휴일 이름 · 효율 배지 `4x`, '길게 몰아서'는 `+N점`) + 결과 달력(FullCalendar, 범례) + '전체 후보 N개 보기'(`Accordion`). 시작일은 기본 오늘, 지난 날을 고르면 오늘부터 계산(2.0.2). 로그아웃 상태도 같은 화면(머리만 간단, 설정은 저장 안 됨).

### 6-8. 관리자 (`/admin`)

머리 eyebrow `관리자` · 제목 `운영`. `ui-tabs` [개요 · 회원 · 모임 · 그룹](옆에 개수). 개요 = 숫자 카드 격자. 나머지 = `<table>`(상자 안 가로 스크롤) + 행 동작(관리자 지정·탈퇴·삭제는 `ui-btn--danger`).

### 6-9. 랜딩 (`/`) · 로그인 · 콜백

- 테마: 저장된 `moim_ui_theme` 를 따른다(없으면 보드).
- 위 줄: [연차 계산기] 링크 + `ThemeSwitch`(local).
- 첫 화면: 가운데 로그인 카드 — 로고 아이콘(56) + 'MOIM' 글자 + 한 줄 소개 + [Google 계정으로 계속하기](구글 흰 버튼 규정 유지) + `또는` + [이메일로 계속하기] → 이메일 입력 → `CodeBoxes` 6칸(메일함 바로가기 버튼). 인앱 브라우저면 기본 브라우저로 여는 안내.
- 아래 소개(LandingContent): 문제 → 기능 4 → 쓰는 법 4단계(4단계 '날짜 확정' = 실제 기능) → 로그인 없이 쓰는 연차 계산기 → 자주 묻는 질문(JSON-LD 와 같은 내용).

## 7. 테마 전환

1. `app/layout.tsx` `<head>` 의 작은 인라인 스크립트가 그리기 전에 `localStorage.moim_ui_theme`(없으면 `board`)를 `html[data-theme]` 에 넣는다 — 깜빡임 방지. `suppressHydrationWarning` 을 `<html>` 에.
   스크립트·키·기본값은 `lib/themeInit.ts`(`THEME_INIT_SCRIPT`·`THEME_KEY`='moim_ui_theme'·`DEFAULT_THEME`·`isTheme`).
2. `ShellProvider`(`shell/ShellContext`) 가 `/api/auth/me` 를 받으면 `user.uiTheme` 가 있으면 `applyTheme()` 으로 덮고 localStorage 도 맞춘다.
3. `ThemeSwitch` 를 누르면 `chooseTheme()`(`lib/theme.ts`): 즉시 `data-theme`·localStorage 변경 → `PATCH /api/auth/me { uiTheme }`(실패하면 토스트, 화면은 그대로). `local` 이면 PATCH 를 보내지 않는다.
4. 테마 전용 React 분기는 `useTheme()` 로만 하고, 분기하는 곳은 홈·모임 방 page 두 곳뿐이다(0장 '코드 원칙').
5. `<meta name="theme-color">` 는 보드 `#0b0f1c`, 표 `#141a2c` — 처음엔 `layout.tsx` 의 `#0b0f1c` 이고 `applyTheme()` 이 불릴 때 바뀐다(첫 그림 스크립트는 meta 를 건드리지 않는다).

## 8. 데이터·API 계약 (2.0 에서 바뀐 것)

| 항목 | 내용 |
|---|---|
| `users.ui_theme` | TEXT NOT NULL DEFAULT `''`. `GET /api/auth/me` 의 `user.uiTheme`. `PATCH /api/auth/me` 가 `{ uiTheme: 'board'\|'table' }` 도 받는다(닉네임과 따로 보내도 서로 안 지움) |
| `rooms.confirmed_start` · `confirmed_end` · `confirmed_at` | TEXT NOT NULL DEFAULT `''`. 날짜는 `YYYY-MM-DD`(끝 포함) |
| `GET /api/rooms` | 방마다 `memberCount`·`markedCount`(1개 이상 찍은 멤버 수)·`myMarked`·`fullDayCount`(오늘 이후 전원 yes 날 수)·`confirmed: {start,end}\|null`·`isOwner` 추가 |
| `GET /api/rooms/:id` | `room.confirmed: {start,end,at}\|null` 추가 |
| `POST /api/rooms/:id/confirm` | 방장만. `{ startDate, endDate, start, end }`(`start`·`end` = 브라우저가 만든 ISO — 종일 규칙은 일정 화면과 같다: 첫날 00:00 · 끝날 23:59 로컬). 이전 확정 일정을 지우고 **멤버 모두에게** 비공개 종일 일정(`origin_kind='room'`, `origin_request_id=방 id`, 제목 = 방 이름) 생성 + 방에 기록. 한 batch. 응답 `{ confirmed, eventCount }` |
| `DELETE /api/rooms/:id/confirm` | 방장만. 그 방에서 만든 일정 지우고 기록 비움 |
| `GET /api/calendar/friends?from&to` | `{ friends, busy }` — 내 친구 전원의 일정 **시간만**(`busy: [{ userId, start, end, allDay }]`) + 친구 목록(`userBrief`). 제목·장소·메모는 공개 일정이라도 싣지 않는다 |
| 일정 `origin.kind` | `'timeRequest'` · `'room'`(새). 색·배지는 `eventColor()` 한 곳에서 |
| 버그 수정 | 일정·그룹·캘린더 조회의 `IN (?…)` 를 소유자 조건 JOIN/하위 쿼리로(바인딩 100개 한도). 시간 요청 수락은 `status='pending'` 조건으로 먼저 바꾸고 바뀐 행이 없으면 409. 확인창 Enter 는 포커스된 버튼만. 시간 요청 시각은 ISO 로 보냄 |

운영 DB 변경은 `worker/migrations/2026-10-renewal.sql`(ALTER TABLE ADD COLUMN 4개) — **2026-10-08 운영에 적용 끝**(직전 백업 `backup/d1-20261008-before-renewal.sql`). 다시 돌리면 "duplicate column" 오류로 멈춘다. `worker/schema.sql` 에도 같은 칸이 있다(새로 만드는 DB 용).

## 9. 접근성

- 클릭되는 것은 `button`·`a`. `div` 에 onClick 금지. (지금 남은 예외: 팝업 바깥 바탕(scrim) 클릭 닫기 — `Modal`·`AccountDrawer`·`ConfirmHost`, 사용 가이드 설명 카드 `GuideHost` 의 '다음' — 키보드로는 ESC·버튼으로 같은 일을 한다)
- 아이콘만 있는 버튼은 `aria-label`. 배지 숫자는 `aria-label="안 읽은 메시지 2개"` 처럼 말로.
- 팝업: `role="dialog"` + `aria-modal` + `aria-labelledby`(제목), 열 때 포커스 안으로, 닫으면 돌아옴, ESC 닫기(겹친 창은 맨 위만 — `useEscClose`).
- `ui-seg` 버튼은 `aria-pressed`, 탭은 `role=tab`+`aria-selected`, 현재 메뉴는 `aria-current="page"`.
- 달력·표 칸: `aria-label="11월 21일 토요일, 5명 중 5명 가능, 내 표시: 가능"`. 키보드로 칸에 가서 Enter/Space 로 현재 방식 적용.
- 대비: 본문 4.5:1, 큰 글(24px+)·굵은 18.66px+ 3:1. 색만으로 구분하지 않는다(가능/안 됨/저녁 이후는 글자·무늬도 함께 — 안 됨 = 숫자 취소선, 저녁 이후 = 시각 글자).
- 터치 대상 44px 이상(모바일).

## 10. 확인 방법

1. `frontend` 폴더에서 `npx tsc --noEmit` → 루트에서 `npm run build`(dev 서버가 없을 때만).
2. 옛 클래스 0건: `grep -rnE "app-[a-z]|brand-mark|room-day|evt-busy" frontend/src --include=*.tsx --include=*.ts --include=*.scss` 결과 없음(단 `app/` 폴더 경로 문자열은 제외).
3. 쓰는 `ui-*` 클래스가 CSS 에 다 있는지 / 정의만 있고 안 쓰는 게 없는지: tsx·ts 에서 `ui-…` 이름을 모으고 scss 의 `.ui-…` 정의와 양쪽으로 대조한다(조합 클래스 `ui-chip--${tone}` 은 가능한 값까지). 2026-10-13 대조 결과 양쪽 0건. 절차는 refactoring-guide §5.
4. 가짜 데이터 격리 환경(`npx wrangler dev --local --persist-to .wrangler/renewal --port 8791`, 루트에서 — 2.0 때 만든 가짜 7명 DB 가 남아 있다. 만드는 스크립트는 저장소에 없다. `worker/seed.sql` 은 실데이터라 쓰지 않는다)에서 두 테마 × 데스크톱 1440·모바일 390 전 화면 촬영, 콘솔 오류 0, 모바일 가로 넘침 0(`document.documentElement.scrollWidth <= innerWidth`).
5. API 를 고쳤으면 `scripts/verify-api.mjs`(70 항목, 키 없는 설정 — CLAUDE.md '빌드 · 검증').
6. 전·후 비교 그림은 `C:\workspace\OPNAE\_screenshots\Moim-renewal\{_before,_after,_compare}`.

## 11. 사용 가이드 대상 (`data-guide`)

`lib/guide.ts` 가 이 이름으로 스포트라이트를 건다(모임 방 키는 `'/rooms/:id'` — 실제 주소 `/rooms/detail` 에 대응). 화면을 고칠 때 같은 역할의 요소에 그대로 붙인다(없으면 그 스텝은 자동으로 건너뛴다). 화면 머리의 `?` 버튼은 `help`.
모바일(<900) 모임 방은 화면 머리(`PageHeader`)가 없어 `?` 버튼이 없다 — 가이드는 데스크톱에서만 시작된다. 표 보기의 `room-modes` 는 [내 줄 고치기]를 켰을 때만 있다.

| 화면 | 이름 |
|---|---|
| 홈 | `home-inbox` · `home-week`(보드) · `home-free`(표) · `home-rooms` · `home-leave` |
| 캘린더 | `cal` · `cal-new` · `cal-legend` |
| 사람 | `people-tabs` · `friends-add` · `friends-requests` · `friends-list` · `tiers-new` · `tiers-list` · `req-new` · `req-list` |
| 모임 목록 | `rooms-new` · `rooms-join` · `rooms-list` |
| 모임 방 | `room-members` · `room-modes` · `room-cal`(보드 달력/표 표) · `room-cands` · `room-chat` · `room-invite` |
| 연차 계산 | `leave-form` · `leave-calc` · `leave-result` |
