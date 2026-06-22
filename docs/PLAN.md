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
- **User**: `googleId`, `email`, `name`, `picture`
- **Friendship**: `requester`, `recipient`, `status`(pending|accepted) — 친구 그래프 = 캘린더 열람 권한. 가시성 제어는 그룹/일정으로 분리
- **Tier(그룹)**: `owner`, `name`, `code`(고유), `members[]` — 사용자가 만들고 이메일/코드로 멤버 추가
- **Event**: `owner`, `title`, `start`, `end`, `allDay`, `location`, `memo`, `visibility`(public|private), `audienceTiers[]`(비공개 시 상세 열람 그룹)

---

## 현재 상태 — Phase 1 + 1.5 동작 ✅
**구글 로그인 + 내 스케줄 작성 + 공유/비공개(그룹별) 노출** 까지 실제 동작(로그인·일정 생성 검증 완료).

구현됨:
- [x] 백엔드: Express, MongoDB(Atlas) 연결, Google OAuth+JWT, requireAuth, 시작 시 env 가드
- [x] 모델: User / Friendship / Tier(그룹) / Event
- [x] 라우트: auth · events(CRUD) · friends(요청/수락/거절) · tiers(그룹 CRUD·멤버·코드가입) · calendar(공유/비공개·그룹 반영)
- [x] 프론트: 랜딩 · OAuth 콜백 · 대시보드(일정 생성/삭제 + 월 달력 + 클릭·드래그 기간선택 + 공유/비공개·그룹) · 친구 · 그룹 관리(`/tiers`) · 친구 캘린더
- [x] 디자인 시스템 고도화(globals.scss 토큰·버튼·카드·네비·캘린더)
- [x] 루트 통합 실행(`concurrently`, `npm run dev`) · 문서(README/CLAUDE/PLAN/ONBOARDING)
- [x] 환경: `backend/.env`(Atlas 연결·구글 OAuth 입력 완료) + `frontend/.env.local` (gitignore)
- [x] 엔드투엔드 검증: Atlas 연결 + 구글 로그인 리다이렉트 + 로그인 후 일정 생성 동작 확인 (2026-06-22)

### 다음 작업 (Phase 1 마무리 — 바로 이어서 할 일)
- [ ] **일정 수정 UI** — PATCH API 있음, 화면 미연결 (현재 생성/삭제만)
- [ ] **일정 입력 항목 확장** — `allDay`·위치·메모 폼 미연결(모델엔 있음)
- [ ] **토큰 만료 자동 로그아웃** — `/api/auth/me` 실패 시 랜딩으로

---

## Phase 1.5 — 공유/그룹 모델 재설계 ✅ (2026-06-22)
- [x] `Tier`(그룹) 모델: owner·name·고유 `code`·members[]. 라우트 `/api/tiers` (생성/삭제/멤버추가(이메일)/멤버제거/코드가입 `join`)
- [x] Event 가시성 재정의: `public`(공유=친구 모두 상세) / `private`(비공개=선택 `audienceTiers` 멤버만 상세, 그 외 "바쁨"). 구 `default`→public 호환
- [x] 캘린더 라우트: 친구면 열람, 일정별 public→상세 / private→내가 그 그룹 멤버일 때만 상세
- [x] 프론트: `/tiers` 그룹 관리 페이지, 대시보드 공유/비공개+그룹 체크박스, 친구·친구캘린더 정리, Nav '그룹'
- [x] 레거시 정리: 구 `Friendship.close/normal` 필드 + `/api/friends/:id/tier` 라우트 제거. UI 표기 '등급'→'그룹' 통일

## 부가 도구 — 연차 계산기 ✅ (2026-06-22, MyBudget 이식)
- [x] 브릿지 알고리즘 TS 이식(`frontend/src/lib/leave.ts`) + 고정 공휴일 내장(`lib/holidays.ts`)
- [x] `/tools/leave` 페이지: 잔여연차·시작일·갱신일·최대연속·스타일 입력 → 잔여 연차 내 최적 조합 + 전체 추천(효율·휴무일·공휴일명)
- [x] Nav '연차' 링크
- 추후: 음력(설/추석/부처님오신날)·대체공휴일은 data.go.kr API 키 연동으로 확장(현재는 주말+양력 고정공휴일 기준으로 동작)

---

## 백로그 (Phase 2+ — 우선순위 순)

### Phase 2 — 공통 빈 시간 찾기 (핵심 가치)
- [ ] 모임 그룹: 기존 `Tier`(그룹) 재사용 (members 기반 일정 취합)
- [ ] 기간 선택 → 그룹 전원 일정 취합 → **겹치는 빈 시간/날짜 계산** API
- [ ] "저녁부터 가능" 등 **부분 가용** 표시 (시간대 슬롯 단위)
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
- 일정 시간은 단순 `datetime-local`(타임존/반복 일정 미지원).
- 테스트 코드 없음.
