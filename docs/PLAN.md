# Moim 개발 계획 (living plan)

> 이 문서는 **단일 출처**다. 새 세션(사람·Claude Code)은 여기 "현재 상태"와 "다음 작업"부터 읽고 시작한다.
> 작업이 끝나면 해당 항목을 정리하고(완료 표시 또는 삭제), 새 요청은 백로그에 추가한다.

---

## 비전 (전체 기능 그림)
친구들과 스케줄을 공유하고 함께 비는 시간을 찾아 모임·여행을 잡는 소셜 캘린더.

1. **구글 로그인**
2. **내 스케줄 공유** — 공유 대상엔 상세, 비공유 대상엔 "이 사람 이 시간 바쁨"만 노출
3. **친한친구 기반 시간 요청** — "이 시간 내주세요" 요청 → 수락/거절. 부담 줄이려 친한친구에게만
4. **근무 스케줄 방(room)** — 오전/오후/밤샘/스케줄 근무 등 친구들끼리 근무표 작성
5. **공통 빈 시간 찾기** — 모두 작성 시 겹치는 빈 날/시간, "저녁부터 가능" 같은 부분 가용 표시 → 여행·모임 날짜 추천
6. **실시간 웹 채팅** — 친구/그룹 채팅
7. **여행 플랜** — 친구들과 여행 일정·체크리스트
8. **토큰 입장** — 토큰으로 특정 캘린더 입장 + 스케줄표 편집 (비회원/초대 흐름)
9. **AdSense** — 광고 수익

---

## 아키텍처 (확정)
- 프론트: **Next.js(App Router) + TS + SCSS** (`frontend/`)
- 백: **Node + Express(ESM) + MongoDB(Mongoose)** (`backend/`)
- 인증: **Google OAuth(passport)** → 백엔드 **JWT** 발급 → 프론트 `localStorage` 저장 + `Authorization: Bearer` 호출
- 실시간(채팅/협업): 추후 **Socket.io** 를 백엔드에 추가 예정
- 공개 제어 핵심: 일정 가시성 = **일정별 공유/비공개**(`public`/`private`) × **그룹(Tier)** — 공유=친구 모두 상세, 비공개=선택 그룹 멤버만 상세(그 외 "바쁨")
- 배포: **Render**(`render.yaml` Blueprint) — 백 `moim-api`(`moim-api.onrender.com`)·프론트 `moim-web`(`moim-web.onrender.com`) 2개 web 서비스 + MongoDB Atlas. 프론트 `NEXT_PUBLIC_API_URL`=백엔드 URL, main push 시 autoDeploy

### 데이터 모델 (현재)
- **User**: `googleId`, `email`, `name`, `nickname`(표시명, 있으면 우선), `picture`, `isAdmin`, `leave`(연차 계산기 설정: remaining·start·renewal·maxConsec·style — 갱신일 지나면 서버가 자동 이월)
- **Friendship**: `requester`, `recipient`, `status`(pending|accepted) — 친구 그래프 = 캘린더 열람 권한. 가시성 제어는 그룹/일정으로 분리
- **Tier(그룹)**: `owner`, `name`, `code`(고유), `color`(캘린더 라인 색), `members[]` — 사용자가 만들고 이메일/코드로 멤버 추가. 생성 시 색상 지정
- **Room(모임 방)**: `owner`, `name`, `code`(초대), `members[]`, `availabilities[{user, marks[{date,status(yes|no|after),time}]}]`, `comments[]` — 멤버별 가능/불가/시간 → 모두 되는 날 집계 + 채팅(메시지=comments, 작성자 picture 동봉)
- **Event**: `owner`, `title`, `start`, `end`, `allDay`, `location`, `memo`, `visibility`(public|private), `audienceTiers[]`(비공개 시 상세 열람 그룹)
- **TimeRequest**: `from`, `to`, `title`, `start`, `end`, `allDay`, `message`, `status`(pending|accepted|declined) — 친구에게 시간 요청, 수락 시 양쪽 일정 생성(allDay 반영)

---

## 현재 상태 — Phase 1 + 1.5 동작 ✅
**구글 로그인 + 내 스케줄 작성 + 공유/비공개(그룹별) 노출** 까지 실제 동작(로그인·일정 생성 검증 완료).

구현됨:
- [x] 백엔드: Express, MongoDB(Atlas) 연결, Google OAuth+JWT, requireAuth, 시작 시 env 가드
- [x] 모델: User / Friendship / Tier(그룹) / Room(모임) / Event / TimeRequest(시간요청)
- [x] 라우트: auth · events(CRUD) · friends · tiers(그룹) · rooms(방·가용성) · calendar · admin(가입자/권한) · requests(시간요청)
- [x] 프론트: 랜딩 · 대시보드(**FullCalendar** 월/주 + 클릭·드래그 → 일정 모달[**커스텀 날짜 picker** + 24시 시간 + 메모] + 공유/비공개·그룹, 일정 클릭=수정/삭제) · 친구 · 그룹(`/tiers`) · 친구 캘린더 · 모임(`/rooms`, 3모드+댓글) · 연차(`/tools/leave`) · 관리자(`/admin`)
- [x] 계정 메뉴(드로어): 구글 아바타 · **닉네임 설정**(없으면 구글 이름) · 고유 번호 복사 · 관리자 링크(권한 시) · 로그아웃 · 이용약관/개인정보 · ESC 닫기. 기본 관리자 `tough123181@gmail.com`(env `ADMIN_EMAILS`). **관리자 페이지**(`/admin`): 통계 개요 · 회원 권한/탈퇴(데이터 cascade) · 모임/그룹 모더레이션(삭제), 탭 UI
- [x] 메인(홈) `/home`: 받은 친구요청 알림 · 다가오는 일정 · 내 모임 요약 (로그인 후 랜딩)
- [x] 인터랙션: 전역 토스트, 모달/드로어 애니메이션, 클릭 카드 hover, **401 시 자동 로그아웃**
- [x] 디자인 시스템 고도화(globals.scss 토큰·버튼·카드·네비·캘린더)
- [x] 루트 통합 실행(`concurrently`, `npm run dev`) · 문서(README/CLAUDE/PLAN/ONBOARDING)
- [x] 환경: `backend/.env`(Atlas 연결·구글 OAuth 입력 완료) + `frontend/.env.local` (gitignore)
- [x] 엔드투엔드 검증: Atlas 연결 + 구글 로그인 리다이렉트 + 로그인 후 일정 생성 동작 확인 (2026-06-22)
- [x] **배포(Render)** — `render.yaml` Blueprint로 `moim-api`(백)·`moim-web`(프론트) + Atlas. Render outbound IP를 Atlas Network Access에 등록 + 구글 콘솔 운영 콜백 URI 등록 (2026-06-22)
- [x] **구글 로그인 팝업화** — 전체 이동 → `window.open` 팝업 + 동일 출처 localStorage `storage` 이벤트로 부모창 복귀(COOP 안전), 콜백 페이지는 팝업이면 자동 닫힘
- [x] **랜딩 리디자인** — 글래스 카드 + 부유 광원, MOIM 워드마크(Black Ops One) 확대, Pretendard 전역 로드, 구글 공식 화이트 로그인 버튼
- [x] **AdSense 코드 연동** — `NEXT_PUBLIC_ADSENSE_CLIENT` 설정 시 layout이 Auto ads 스크립트 로드 + 수동 배치용 `AdUnit` 컴포넌트 + `public/ads.txt`. (ID 미설정 시 광고 비활성 / 게시자 승인·도메인은 대기)
- [x] **그룹 색상 + 공용 컴포넌트** — 그룹(Tier)별 `color`(`lib/colors.ts` 팔레트)로 캘린더 라인 구분(공개=초록·비공개=주황 기본), 공용 `Avatar`(프로필+실루엣 폴백)·`Notice`(폼 인라인 알림) 도입
- [x] **모임 입장 버그 수정** — `GET /rooms/:id` populate 시 `isMember`가 비-방장 멤버를 막던 버그 수정 + 접근 불가/로딩 빈 상태 카드(`.app-empty`)
- [x] **일정 입력 확장** — 종일(`allDay`) 토글(체크 시 시간 select 숨김·하루 전체 저장)·위치(`location`) 입력 추가. 목록/캘린더/포맷(`formatRange` allDay 인지)·수정 흐름 반영
- [x] **그룹 색 사후 변경** — `PATCH /api/tiers/:id`(본인 소유·`#rrggbb` 검증) + `/tiers` 각 그룹 카드 색상 스와치로 기존 색 변경

#### 2026-06-23 묶음 (UX 고도화 + 모임 채팅 + 리팩토링)
- [x] **달력 표시 통일** — 모든 달력 제목 `YYYY-MM`, 하루 일정도 막대(블록), 시간 24시 표기·제목 말줄임·시간영역 고정, 주 뷰 시간 드래그는 종일 아님(드래그 시각 프리필)
- [x] **rem 반응형** — 루트 `font-size: clamp(14~16px)` + `--space-*`/`--radius-*` 토큰 rem화 → 전 화면 연속 스케일. 모바일 네비 **가로 스크롤**(글자 깨짐 해결)·여백 컴팩트
- [x] **그룹 색 팔레트 고도화** — 공용 `ColorPalette`(프리셋 + 🎨 토글 **원형 컬러휠**`@uiw/react-color`), 대시보드 범례에서도 색 변경
- [x] **커스텀 드롭다운(Select)** — 요청 폼 친구 선택 등 네이티브 select 대체. 요청 폼 라벨형 재구성
- [x] **네이티브 alert/confirm 제거** — 전역 커스텀 확인창(`lib/confirm`+`ConfirmHost`, Promise 기반, danger 변형)
- [x] **모임 채팅** — 댓글 사이드 → 우하단 FAB **플로팅 채팅**(말풍선·6초 폴링·좌상단 리사이즈·본인 삭제). 진짜 푸시는 Socket.io(Phase 4)
- [x] **시간 요청 종일** — `TimeRequest.allDay`, 수락 시 종일 일정 생성
- [x] **타인 프로필 모달** — 멤버 칩/채팅 아바타 클릭 → 캘린더 보기·친구/시간 요청·그룹 추가·이메일 복사. 홈 다가오는 일정 **D-day** 배지
- [x] **공용화 리팩토링** — `lib/datetime`(HOURS/MINUTES·날짜 헬퍼)·`lib/marks`·`components/TimeSelect`·`components/Modal` 로 중복 제거, 호버 떠오름 효과 일괄 제거
- [x] **전 탭 PageHero(visual-top)** — 아이콘 배지+그라데이션 제목+설명 공용 헤더(대시보드/친구/모임/그룹/요청/친구 캘린더/연차). 연차 hero 도 PageHero 로 통합
- [x] **네비 현재 메뉴 강조** — `aria-current` 브랜드 그라데이션 + 로고 확대 + 가로 스크롤 시 활성 탭 중앙 정렬(paint 전 즉시), 아바타 모듈 캐시(이동 깜빡임 제거)
- [x] **우하단 FAB 컨텍스트 액션** — `lib/quickActions` 레지스트리(페이지가 '만들기' 등 등록) + 세션 1회 자동 펼침 + 스태거 X 슬라이드 모션, 바깥 클릭 통과
- [x] **달력 월/주 토글 제거** — 월 뷰 고정(timeGridPlugin 제거)
- [x] **연차 설정 저장** — `User.leave` + `GET/PUT /api/auth/leave`(갱신일 자동 이월), 홈 '추천 연차' 카드, 연차 폼 세그먼트 칩·풀폭 정렬, `Accordion` 컴포넌트
- [x] **DatePicker `block`(풀폭) + 일정 점 표시**, 2차 리팩토링(leave.ts 날짜헬퍼 datetime 재사용, 미사용 plugin/CSS 정리)

### 다음 작업 (남은 것)
- [ ] **안 읽음 표시 본격화** — 홈에 받은 친구요청 배지는 됨. 새 채팅/모임 변경 등 알림은 추후(lastSeen 기반)
- [ ] **Nav 공통 레이아웃화** — 현재 각 페이지가 `<Nav/>` 렌더 → 이동마다 리마운트(짧은 깜빡임). route group 레이아웃으로 올려 네비/FAB 고정·본문만 교체하면 SPA 체감 향상
- [ ] **실시간 채팅(Socket.io)** — 현재 6초 폴링. 진짜 푸시는 Phase 4

---

## Phase 1.5 — 공유/그룹 모델 재설계 ✅ (2026-06-22)
- [x] `Tier`(그룹) 모델: owner·name·고유 `code`·members[]. 라우트 `/api/tiers` (생성/삭제/멤버추가(이메일)/멤버제거/코드가입 `join`)
- [x] Event 가시성 재정의: `public`(공유=친구 모두 상세) / `private`(비공개=선택 `audienceTiers` 멤버만 상세, 그 외 "바쁨"). 구 `default`→public 호환
- [x] 캘린더 라우트: 친구면 열람, 일정별 public→상세 / private→내가 그 그룹 멤버일 때만 상세
- [x] 프론트: `/tiers` 그룹 관리 페이지, 대시보드 공개 드롭다운(공유/비공개/🔒그룹), 친구·친구캘린더 정리, Nav '그룹'
- [x] 레거시 정리: 구 `Friendship.close/normal` 필드 + `/api/friends/:id/tier` 라우트 제거. UI 표기 '등급'→'그룹' 통일

## 부가 도구 — 연차 계산기 ✅ (2026-06-22, MyBudget 이식)
- [x] 브릿지 알고리즘 TS 이식(`frontend/src/lib/leave.ts`) + 고정 공휴일 내장(`lib/holidays.ts`)
- [x] `/tools/leave` 페이지: 잔여연차·시작일·갱신일·최대연속·스타일 입력 → 잔여 연차 내 최적 조합 + 전체 추천(효율·휴무일·공휴일명)
- [x] Nav '연차' 링크
- [x] 버그 수정(2026-06-23): 겹침 검사를 연차일→**휴무 기간(span) 전체** 기준으로 변경(같은 주말을 끼는 금/월 구간 중복선택·휴무일 부풀림 해소) · 달력 이벤트를 **문자열 날짜+allDay**로 수정(Date 객체가 시간 이벤트로 오인돼 월 뷰에 안 그려지던 문제) · 달력 블록에 **효율(N x) 표기**, 달력을 상단 메인으로
- [x] 추천 품질(2026-06-23): **공휴일 낀 구간 우선 선택**(어린이날 등 연휴를 일반 주말보다 먼저) + 남는 연차를 **1년에 고르게 분산**(farthest-point, 2주 버킷) → 여름 쏠림/8월 공백 해소. 추천 계산은 `computeLeavePlan()` 으로 공용화(연차 페이지·홈 카드 공유)
- [x] 공휴일 전면 개편(2026-06-23, `lib/holidays.ts`): **2026–2031** + 음력(설날·추석·부처님오신날) + **대체공휴일 자동 계산**(관공서 규정 제3조: 설·추석=일요일/중복, 어린이날·국경일·부처님·성탄절=토/일, 신정·현충일 제외) + **제헌절 2026 부활** 반영. 음력 당일만 매년 갱신(LUNAR 테이블). 2026·2027 권위자료 교차검증 완료
- [x] 설정 영속화(2026-06-23): 시작일/갱신일 등 **DB 저장**(User.leave + `/api/auth/leave` GET/PUT), **갱신일 경과 시 KST 기준 자동 이월**(다음 해로). 로그인 시에만 저장·복원(익명은 클라이언트 기본값)
- [x] 홈에 **추천 연차 카드**(다가오는 추천 구간 3개 + 총 휴무 요약) · 접기 영역은 공용 **Accordion**(애니메이션) 컴포넌트로
- 추후: 임시공휴일·선거일은 미반영(LUNAR 테이블 옆에 수동 추가 가능)

---

## 백로그 (Phase 2+ — 우선순위 순)

### Phase 2 — 공통 빈 시간 찾기 (핵심 가치)
- [x] **모임 방(약속 잡기)** ✅ — `Room`(코드 초대) + `/rooms`. 3모드(되는날 / 안되는날 드래그 / 시간만 가능) → **모두 되는 날** + 시간 조율 가능일, 우하단 **플로팅 채팅**(말풍선·6초 폴링·본인 메시지 삭제·방 입장 시 자동 오픈). Nav '모임'
- [x] **부분 가용** ✅ — "시간만 가능" 모드로 "HH:MM 이후" 표시·집계
- [ ] 기존 등록 일정(Event)에서 자동 취합 (수동 표시 없이 겹치는 빈 시간 계산)
- [ ] 빈 시간 결과 시각화(히트맵/추천 날짜)

### Phase 3 — 시간 요청 ✅ (2026-06-22)
- [x] `TimeRequest` 모델 + `/api/requests`(받은/보낸/생성/수락/거절/취소)
- [x] 친구에게 요청 → **수락 시 양쪽 캘린더에 일정 자동 생성**, 거절/취소
- [x] `/requests` 페이지(보내기 폼 + 받은/보낸 목록) + Nav '요청' + 홈 받은 요청 배너(인앱 알림)
- 비고: 현재 모든 친구에게 요청 가능(특정 그룹 한정은 추후 옵션)

### Phase 4 — 실시간 채팅
- [ ] 백엔드 Socket.io 도입(JWT 핸드셰이크 인증)
- [ ] `ChatRoom` / `Message` 모델, 1:1 및 그룹
- [ ] 프론트 채팅 UI(실시간 수신, 미읽음)

### Phase 5 — 근무 스케줄 방
- [ ] 근무 유형(오전/오후/밤샘/커스텀) 정의 + 방(room) 단위 근무표
- [ ] 근무표 → Event/가용성으로 환산해 Phase 2 빈 시간 계산에 반영

### Phase 6 — 여행 플랜
- [ ] `TripPlan{ group, dates, items[], checklist[] }`
- [ ] 빈 시간 결과에서 바로 여행 날짜 확정 흐름 연결

### Phase 7 — 토큰 입장(초대/비회원 편집)
- [ ] `InviteToken{ token, calendar/group, scope, expiresAt }`
- [ ] 토큰 링크로 특정 캘린더/근무표 입장 + 제한된 편집

### Phase 8 — 수익화 & 배포
- [x] 배포 ✅ — **Render**(백 `moim-api` + 프론트 `moim-web`) + Mongo Atlas, `render.yaml` Blueprint (2026-06-22)
- [x] **AdSense 코드 연동** ✅ — layout Auto ads 스크립트 + 수동 슬롯 `AdUnit` + `public/ads.txt` + `NEXT_PUBLIC_ADSENSE_CLIENT` (2026-06-22)
- [ ] **AdSense 활성화** (코드는 준비 완료 — 남은 건 구글 쪽 신청·승인 절차)
  - [ ] [adsense.google.com](https://adsense.google.com) 가입 — 사이트 URL = 운영 도메인(현 `moim-web.onrender.com`, 또는 커스텀 도메인)
  - [ ] 발급된 게시자 ID(`ca-pub-…`)를 프론트 env `NEXT_PUBLIC_ADSENSE_CLIENT` 에 설정(Render 환경변수) + `public/ads.txt` 의 `pub-…` 숫자 교체 → 재배포
  - [ ] 애드센스 사이트 **심사 통과 대기**(보통 수일~2주, 그동안 광고 자리는 빈칸)
  - [ ] ⚠️ 승인 리스크: 콘텐츠가 로그인 뒤에 숨어 있으면 "콘텐츠 부족"으로 거절 가능 → **로그인 없이 보이는 공개 소개 페이지**(서비스 설명/스크린샷 등) 보강 필요. (개인정보 처리방침·이용약관은 이미 있음)
  - [ ] 승인 후: 대시보드에서 **Auto ads** 켜기(자동 배치) 또는 광고 단위 슬롯 발급 → `<AdUnit slot="…" />` 로 수동 배치
- [ ] 운영 보안: JWT → httpOnly 쿠키 전환, CORS/Rate limit, 입력 검증 강화
- [ ] 커스텀 도메인 + free 플랜 콜드스타트 대응(starter 승격 또는 헬스 핑)

---

## 알려진 한계 / 기술 부채 (MVP 의도된 단순화)
- 로그인 토큰을 **URL 쿼리(`?token=`)로 전달 + localStorage 저장** → 운영 전 httpOnly 쿠키로 전환 필요(Phase 8).
- 프론트 `next build` 시 **ESLint 건너뜀**(`next.config.mjs`) — eslint-config-next 추가 후 되돌릴 것.
- 일정 기본 가시성은 `public`(공유). 비공개는 그룹을 만들어 지정해야 상세 노출.
- 일정 입력은 커스텀 날짜 picker + 24시 시간 select + 종일 토글(타임존/반복 일정 미지원).
- 연차 계산기 공휴일은 양력 고정만 내장(음력·대체공휴일 미반영 — data.go.kr 키 연동 시 해소).
- 테스트 코드 없음.
- Render free 플랜은 15분 무트래픽 시 슬립 → 첫 요청 콜드스타트 지연(~50s). 프론트/백 **2개 서비스**라 로그인 시 백엔드 콜드스타트가 한 번 더 노출됨. **완화 적용**: 랜딩 진입 시 `warmApi()`가 백엔드 `/api/health` 를 미리 깨워 2차 화면 감소. 완전 제거는 **Starter 승격**(`render.yaml` `plan: free`→`starter`, 코드 변경 불필요). ※ 무료는 계정당 750 인스턴스-시간/월(2개 상시 keep-alive는 초과).
