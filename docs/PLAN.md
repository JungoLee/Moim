# Moim 개발 계획 (living plan)

> 이 문서는 **단일 출처**다. 새 세션(사람·Claude Code)은 여기 "현재 상태"와 "다음 작업"부터 읽고 시작한다.
> 작업이 끝나면 해당 항목을 정리하고(완료 표시 또는 삭제), 새 요청은 백로그에 추가한다.
> 완료 작업의 상세 이력은 **git log** 가 출처 — 여기엔 요약만 남긴다.

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
- **Tier(그룹)**: `owner`, `name`, `code`(고유), `color`(캘린더 라인 색), `members[]` — 사용자가 만들고 이메일/코드로 멤버 추가. 생성 시 색상 지정, 사후 변경 가능
- **Room(모임 방)**: `owner`, `name`, `code`(초대), `joinByUrl`(true면 비멤버도 URL 진입 시 자동 가입), `members[]`, `availabilities[{user, marks[{date,status(yes|no|after),time}]}]`, `comments[]` — 멤버별 가능/불가/시간 → 모두 되는 날 집계 + 채팅(메시지=comments, 작성자 picture 동봉)
- **Event**: `owner`, `title`, `start`, `end`, `allDay`, `location`, `memo`, `visibility`(public|private), `audienceTiers[]`(비공개 시 상세 열람 그룹)
- **TimeRequest**: `from`, `to`, `title`, `start`, `end`, `allDay`, `message`, `status`(pending|accepted|declined) — 친구에게 시간 요청, 수락 시 양쪽 일정 생성(allDay 반영)
- **LoginCode**: `email`(unique), `codeHash`(sha256), `expiresAt`(TTL 10분), `attempts`(최대 5회), `sentAt`(재전송 60초 쿨다운) — 이메일 코드 로그인 일회용 코드

---

## 현재 상태 — Phase 1·1.5·2(모임)·3(시간요청) 동작 + Render 배포 ✅

구현된 것 (도메인별 요약 — 상세 이력은 git log):

- **인증·계정**: 구글 OAuth **팝업 로그인**(localStorage `storage` 이벤트로 부모창 복귀) + JWT, **이메일 코드 로그인**(아무 이메일 → 12자리 코드 발송(nodemailer/SMTP, 미설정 시 콘솔 출력) → 검증 → JWT. 같은 이메일 구글 계정과 자동 통합), 닉네임 설정, 계정 드로어(아바타·고유번호 복사·이용약관/개인정보·로그아웃), **회원 탈퇴**(cascade — `requireAuth`가 `User.exists` 확인으로 탈퇴 계정의 잔여 JWT 차단, 로그아웃/탈퇴는 전체 페이지 로드로 캐시 초기화), **401 자동 로그아웃**, 비로그인으로 방 URL 진입 시 로그인 후 원래 방 복귀, **인앱 브라우저(카카오톡 등) 감지 → 기본 브라우저 탈출**(구글 disallowed_useragent 우회)
- **일정·캘린더**: FullCalendar **월 뷰**(주 토글 제거), 클릭·드래그 → 통합 모달(커스텀 DatePicker + 24시 TimeSelect + 종일 토글 + 위치 + 메모), 일정 클릭=수정/삭제, **공유/비공개 × 그룹** 가시성, 그룹별 라인 색(공개=초록·비공개=주황 기본). **타임존 왕복 버그 수정**(종일 종료일 +1·타임드 시간 밀림, 2026-06-24) + 종일 다중일 일정 마지막 날 채움 수정
- **친구·그룹**: 친구 요청/수락/거절, 그룹(Tier) 생성·이메일/코드로 멤버 추가, 그룹 설정 모달(코드 복사·색 변경 `PATCH /api/tiers/:id`·삭제), 멤버 아코디언(공용 `MemberRow`), 친구 캘린더(공유=상세/비공개=바쁨)
- **모임(rooms)**: 코드 초대 + 3모드 가용성(되는날/안되는날 드래그/시간 이후) → **모두 되는 날 집계**, 가용성 캘린더 주말 파스텔 배경(일=핑크·토=하늘)·비활성 셀 어둡게(2026-06-25), **플로팅 채팅**(말풍선·6초 폴링·안읽은 배지·연속 메시지 그룹핑·본인 삭제·리사이즈), 방장 설정 모달(이름 변경·코드 재발급·멤버 강퇴·**URL 가입 토글**·삭제), 공유 모달(URL/코드 복사), 타인 프로필 모달(캘린더 보기·친구/시간 요청·그룹 추가)
- **시간 요청**: `TimeRequest` + `/requests` 페이지(보내기/받은/보낸), **수락 시 양쪽 캘린더에 일정 자동 생성**(종일 지원), 홈 받은 요청 배너
- **연차 계산기**(`/tools/leave`): 브릿지 알고리즘(공휴일 낀 구간 우선 + 연중 고른 분산), 공휴일 **2026–2031** 내장(음력·대체공휴일 자동, `lib/holidays.ts`), 설정 DB 저장(`User.leave`, 갱신일 자동 이월), 홈 **추천 연차 카드**(`computeLeavePlan` 공용)
- **홈**(`/home`): 친구요청 알림 · 다가오는 일정(D-day) · 내 모임 요약 · 추천 연차 (로그인 후 랜딩)
- **관리자**(`/admin`): 통계 개요 · 회원 권한/탈퇴(cascade) · 모임/그룹 모더레이션. 기본 관리자는 env `ADMIN_EMAILS`
- **공통 UI**: 디자인 토큰(globals.scss) + rem 반응형(clamp), PageHero(전 탭), Nav(활성 강조·중앙 스크롤) + 우하단 FAB(`lib/quickActions`), 공용 컴포넌트(Modal·Select·TimeSelect·DatePicker·ColorPalette+휠·Avatar·MemberRow·Notice·Accordion·Tooltip), 커스텀 confirm(`lib/confirm`)·토스트, 랜딩 글래스 리디자인
- **사용 가이드(스포트라이트 투어)**: FAB '📖 사용 가이드' → 대상 요소를 `box-shadow` 컷아웃으로 강조 + 스텝 설명 카드(`lib/guide` 라우트별 정의 + `GuideHost`, 대상은 각 페이지 `data-guide` 속성). 7개 탭 + **모임 방 내부**(/rooms/:id, 멤버·모드·드래그 표시·집계·채팅/공유 5스텝) 지원, 조건부 섹션 자동 스킵, 설명 카드는 실제 높이 측정 후 화면 안 클램프
- **배포·수익화**: Render Blueprint 배포 + Atlas(2026-06-22), 랜딩 진입 시 `warmApi()` 콜드스타트 완화, **AdSense 코드 연동**(Auto ads 스크립트 + `AdUnit` 수동 슬롯 + `ads.txt` — 승인 절차만 남음, Phase 8 참조)
- **리팩토링**: `lib/`(api·datetime·marks·clipboard·confirm·quickActions) 공용화, 데드코드 정리 3차까지(2026-07-08: `AvailabilityCalendar` 미사용 `mode` prop, `leave.ts` 내부 전용 함수 unexport, 미사용 `@fullcalendar/timegrid` 의존성 제거)

### 다음 작업 (남은 것)
- [ ] **이메일 코드 수동 승인(TEMP) 제거** — Render free 가 SMTP 를 막아 임시 운영 중: 운영 서버는 코드를 DB 에만 저장 → ① 로컬 **메일 전송기**(`backend: npm run mail-worker`, 같은 Atlas 폴링 → Gmail 발송, PC 켜져 있을 때) ② 전송기 꺼져 있으면 **관리자 페이지 "코드 대기" 목록에서 수동 전달**이 폴백. **Brevo 가입 후 `BREVO_API_KEY` 를 Render 에 넣으면 운영이 직접 발송**하게 되며, 그 뒤 `TEMP(email-approval)` 마커가 달린 코드(LoginCode.code 평문 필드 · admin `/login-codes` 라우트 · admin 페이지 대기 섹션 · auth request 분기 · `workers/mailWorker.js`)를 일괄 삭제
- [ ] **안 읽음 표시 본격화** — 받은 친구요청 배지 + 모임 채팅 안읽음 카운트(클라 `lastRead`)는 됨. **서버 `lastSeen` 영속**·다른 알림(모임 변경 등)은 추후
- [ ] **Nav 공통 레이아웃화** — 현재 각 페이지가 `<Nav/>` 렌더 → 이동마다 리마운트(짧은 깜빡임). route group 레이아웃으로 올려 네비/FAB 고정·본문만 교체하면 SPA 체감 향상
- [ ] **실시간 채팅(Socket.io)** — 현재 6초 폴링. 진짜 푸시는 Phase 4

---

## 백로그 (Phase 2+ — 우선순위 순)

### Phase 2 — 공통 빈 시간 찾기 (남은 것)
- [x] 모임 방(3모드 가용성 + 모두 되는 날 집계 + 부분 가용 "HH:MM 이후") ✅ — 위 "현재 상태" 참조
- [ ] 기존 등록 일정(Event)에서 자동 취합 (수동 표시 없이 겹치는 빈 시간 계산)
- [ ] 빈 시간 결과 시각화(히트맵/추천 날짜)

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

### Phase 8 — 수익화 & 운영
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
- 연차 계산기 공휴일은 `lib/holidays.ts` 에 2026–2031 양력+음력+대체공휴일 내장(음력 당일은 LUNAR 테이블, 임시공휴일·선거일은 수동 추가).
- `EnMono` 는 실제 폰트 파일 없이 시스템 모노스페이스 별칭(`local()`) — 환경별 글리프 차이 있음. 실제 폰트 확보 시 `@font-face src: url()` 연결.
- `AdUnit` 컴포넌트는 현재 어디서도 렌더하지 않음(수동 광고 배치용 대기 — AdSense 승인 후 사용, 삭제 금지).
- 이메일 코드 발송: **Render free 플랜이 외부 SMTP 포트(25·465·587)를 차단** → 운영은 **Brevo HTTP API**(`BREVO_API_KEY`, 무료 300통/일), 로컬은 Gmail SMTP+앱 비밀번호. 둘 다 없으면 코드가 서버 콘솔에만 출력. 사용자 증가 시 Resend/SES 등으로 교체(`utils/mailer.js` 한 파일만 수정).
- 테스트 코드 없음.
- Render free 플랜은 15분 무트래픽 시 슬립 → 첫 요청 콜드스타트 지연(~50s). 프론트/백 **2개 서비스**라 로그인 시 백엔드 콜드스타트가 한 번 더 노출됨. **완화 적용**: 랜딩 진입 시 `warmApi()`가 백엔드 `/api/health` 를 미리 깨워 2차 화면 감소. 완전 제거는 **Starter 승격**(`render.yaml` `plan: free`→`starter`, 코드 변경 불필요). ※ 무료는 계정당 750 인스턴스-시간/월(2개 상시 keep-alive는 초과).
