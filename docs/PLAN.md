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

### 데이터 모델 (현재)
- **User**: `googleId`, `email`, `name`, `nickname`(표시명, 있으면 우선), `picture`, `isAdmin`
- **Friendship**: `requester`, `recipient`, `status`(pending|accepted) — 친구 그래프 = 캘린더 열람 권한. 가시성 제어는 그룹/일정으로 분리
- **Tier(그룹)**: `owner`, `name`, `code`(고유), `members[]` — 사용자가 만들고 이메일/코드로 멤버 추가
- **Room(모임 방)**: `owner`, `name`, `code`(초대), `members[]`, `availabilities[{user, marks[{date,status(yes|no|after),time}]}]`, `comments[]` — 멤버별 가능/불가/시간 → 모두 되는 날 집계 + 댓글
- **Event**: `owner`, `title`, `start`, `end`, `allDay`, `location`, `memo`, `visibility`(public|private), `audienceTiers[]`(비공개 시 상세 열람 그룹)

---

## 현재 상태 — Phase 1 + 1.5 동작 ✅
**구글 로그인 + 내 스케줄 작성 + 공유/비공개(그룹별) 노출** 까지 실제 동작(로그인·일정 생성 검증 완료).

구현됨:
- [x] 백엔드: Express, MongoDB(Atlas) 연결, Google OAuth+JWT, requireAuth, 시작 시 env 가드
- [x] 모델: User / Friendship / Tier(그룹) / Room(모임) / Event
- [x] 라우트: auth · events(CRUD) · friends · tiers(그룹) · rooms(방·가용성) · calendar · admin(가입자/권한)
- [x] 프론트: 랜딩 · 대시보드(**FullCalendar** 월/주 + 클릭·드래그 → 일정 모달[**커스텀 날짜 picker** + 24시 시간 + 메모] + 공유/비공개·그룹, 일정 클릭=수정/삭제) · 친구 · 그룹(`/tiers`) · 친구 캘린더 · 모임(`/rooms`, 3모드+댓글) · 연차(`/tools/leave`) · 관리자(`/admin`)
- [x] 계정 메뉴(드로어): 구글 아바타 · **닉네임 설정**(없으면 구글 이름) · 고유 번호 복사 · 관리자 링크(권한 시) · 로그아웃 · 이용약관/개인정보 · ESC 닫기. 기본 관리자 `tough123181@gmail.com`(env `ADMIN_EMAILS`), 관리자 페이지에서 권한 부여/회수
- [x] 메인(홈) `/home`: 받은 친구요청 알림 · 다가오는 일정 · 내 모임 요약 (로그인 후 랜딩)
- [x] 인터랙션: 전역 토스트, 모달/드로어 애니메이션, 클릭 카드 hover, **401 시 자동 로그아웃**
- [x] 디자인 시스템 고도화(globals.scss 토큰·버튼·카드·네비·캘린더)
- [x] 루트 통합 실행(`concurrently`, `npm run dev`) · 문서(README/CLAUDE/PLAN/ONBOARDING)
- [x] 환경: `backend/.env`(Atlas 연결·구글 OAuth 입력 완료) + `frontend/.env.local` (gitignore)
- [x] 엔드투엔드 검증: Atlas 연결 + 구글 로그인 리다이렉트 + 로그인 후 일정 생성 동작 확인 (2026-06-22)

### 다음 작업 (남은 것)
- [ ] **일정 입력 확장** — `allDay`·위치(`location`) 폼 미연결(제목·시간·메모·공개범위는 됨)
- [ ] **안 읽음 표시 본격화** — 홈에 받은 친구요청 배지는 됨. 새 댓글/모임 변경 등 알림은 추후(lastSeen 기반)
- [ ] **날짜 picker 라이브러리화** — 현재 자체 커스텀 달력. 필요 시 react-datepicker 등으로 교체 검토

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
- 추후: 음력(설/추석/부처님오신날)·대체공휴일은 data.go.kr API 키 연동으로 확장(현재는 주말+양력 고정공휴일 기준으로 동작)

---

## 백로그 (Phase 2+ — 우선순위 순)

### Phase 2 — 공통 빈 시간 찾기 (핵심 가치)
- [x] **모임 방(약속 잡기)** ✅ — `Room`(코드 초대) + `/rooms`. 3모드(되는날 / 안되는날 드래그 / 시간만 가능) → **모두 되는 날** + 시간 조율 가능일, 사이드 **댓글**(스티키). Nav '모임'
- [x] **부분 가용** ✅ — "시간만 가능" 모드로 "HH:MM 이후" 표시·집계
- [ ] 기존 등록 일정(Event)에서 자동 취합 (수동 표시 없이 겹치는 빈 시간 계산)
- [ ] 빈 시간 결과 시각화(히트맵/추천 날짜)

### Phase 3 — 시간 요청 (친한친구 기반)
- [ ] `TimeRequest{ from, to(user), start, end, message, status }`
- [ ] 특정 그룹(친한친구 등) 멤버에게만 요청 가능, 수락/거절 → 수락 시 일정 자동 생성 옵션
- [ ] 알림(인앱) 표시

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
- [ ] **AdSense** 연동 (Next 배포 + 도메인 + 승인 필요)
- [ ] 배포: 프론트(Vercel 등) / 백(Render·Railway 등) / Mongo Atlas
- [ ] 운영 보안: JWT → httpOnly 쿠키 전환, CORS/Rate limit, 입력 검증 강화

---

## 알려진 한계 / 기술 부채 (MVP 의도된 단순화)
- 로그인 토큰을 **URL 쿼리(`?token=`)로 전달 + localStorage 저장** → 운영 전 httpOnly 쿠키로 전환 필요(Phase 8).
- 프론트 `next build` 시 **ESLint 건너뜀**(`next.config.mjs`) — eslint-config-next 추가 후 되돌릴 것.
- 일정 기본 가시성은 `public`(공유). 비공개는 그룹을 만들어 지정해야 상세 노출.
- 일정 입력은 커스텀 날짜 picker + 24시 시간 select(타임존/반복 일정 미지원).
- 연차 계산기 공휴일은 양력 고정만 내장(음력·대체공휴일 미반영 — data.go.kr 키 연동 시 해소).
- 테스트 코드 없음.
