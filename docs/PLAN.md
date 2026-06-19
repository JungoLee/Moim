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
- 공개 제어 핵심: 일정 가시성 = **친구별 등급**(`close`/`normal`) × **일정별 `visibility`**(`default`/`private`)

### 데이터 모델 (현재)
- **User**: `googleId`, `email`, `name`, `picture`
- **Friendship**: `requester`, `recipient`, `status`(pending|accepted), `requesterTierForRecipient`, `recipientTierForRequester`
  - 등급은 **방향성** — 내가 친구에게 부여한 등급이 "그 친구가 내 일정을 보는 수준"
  - `close` = 상세 노출(+추후 시간요청 가능), `normal` = 바쁜 블록만
- **Event**: `owner`, `title`, `start`, `end`, `allDay`, `location`, `memo`, `visibility`(default|private)

---

## 현재 상태 — Phase 1 (MVP) 스캐폴드 완료 ✅
**구글 로그인 + 내 스케줄 작성 + 공유/비공유(등급별) 노출** 동작 골격까지.

구현됨:
- [x] 백엔드: Express 서버, Mongo 연결, Google OAuth+JWT, requireAuth 미들웨어
- [x] 모델: User / Friendship / Event
- [x] 라우트: auth(google/callback/me), events(CRUD), friends(요청/수락/거절/등급), calendar(등급 반영 조회)
- [x] 프론트: 로그인 랜딩, OAuth 콜백 토큰 수신, 대시보드(내 일정 CRUD), 친구(추가/요청/등급), 친구 캘린더 보기
- [x] 핸드오프 문서: README / CLAUDE.md / 이 PLAN
- [x] 빌드 검증: 프론트 `next build` 통과, 백엔드 `node --check` 통과

> **실행 전 필요**: `backend/.env` 에 실제 `MONGODB_URI` + Google OAuth 자격증명 입력해야 로그인 가능. (README 참고)

### 다음 작업 (Phase 1 마무리 — 바로 이어서 할 일)
- [x] **달력 그리드 UI** — 월(月) 그리드 공용 컴포넌트 `frontend/src/components/Calendar.tsx` 추가. 대시보드(날짜 클릭 시 09~10시 프리필) + 친구 캘린더(`바쁨`/상세 칩)에 연결. (주(週) 뷰는 추후)
- [x] **루트 통합 실행** — 루트 `package.json`(`concurrently`)로 `npm run dev` 시 backend+frontend 동시 실행
- [x] **백엔드 env 가드** — 시작 시 필수 환경변수 누락이면 친절히 안내 후 종료(cryptic crash 방지)
- [ ] **로그인 직후 UX** — `/api/auth/me` 실패(토큰 만료) 시 자동 로그아웃 → 랜딩
- [ ] 실제 OAuth 자격증명으로 **엔드투엔드 로그인 1회 검증** (사용자 환경에서)
- [ ] 일정 수정(현재 생성/삭제만; PATCH API 는 있으나 UI 미연결)

---

## 백로그 (Phase 2+ — 우선순위 순)

### Phase 2 — 공통 빈 시간 찾기 (핵심 가치)
- [ ] 그룹(모임) 개념 모델: `Group{ name, members[] }`
- [ ] 기간 선택 → 그룹 전원 일정 취합 → **겹치는 빈 시간/날짜 계산** API
- [ ] "저녁부터 가능" 등 **부분 가용** 표시 (시간대 슬롯 단위)
- [ ] 빈 시간 결과 시각화(히트맵/추천 날짜)

### Phase 3 — 시간 요청 (친한친구 기반)
- [ ] `TimeRequest{ from, to(user), start, end, message, status }`
- [ ] close 등급 친구에게만 요청 가능, 수락/거절 → 수락 시 일정 자동 생성 옵션
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
- 친구 등급 기본값 `normal`(보수적). close 로 올려야 상세 노출.
- 일정 시간은 단순 `datetime-local`(타임존/반복 일정 미지원).
- 테스트 코드 없음.
