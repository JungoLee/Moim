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
- 프론트: **Next.js(App Router, 정적 export) + TS + SCSS** (`frontend/` → `out/`)
- 백: **Cloudflare Workers**(`worker/`, 수제 라우터) + **D1**(SQLite, 바인딩 `env.DB`)
- 인증: **Google OAuth**(fetch 직접 구현) → **JWT**(jose HS256, `{sub}`, 30일) → 프론트 `localStorage` + `Authorization: Bearer` 호출
- 실시간(채팅/협업): 현재 6초 폴링. Workers 에서는 Socket.io 대신 **Durable Objects + WebSocket** 이 대안(Phase 4 재검토)
- 공개 제어 핵심: 일정 가시성 = **일정별 공유/비공개**(`public`/`private`) × **그룹(Tier)** — 공유=친구 모두 상세, 비공개=선택 그룹 멤버만 상세(그 외 "바쁨")
- 배포: **단일 Cloudflare Workers** — https://moim.opnae.com (`wrangler.toml`, `custom_domain` 이라 DNS 자동). `/api/*` 는 워커, 그 외는 `frontend/out` 정적 자산. 프론트·API 가 같은 도메인이라 **CORS 없음**

### 데이터 모델 (D1 — 12 테이블)
> 기존 Mongo 문서를 분해한 결과. 응답 형태(`_id`·중첩 객체)는 `worker/db.js` 가 되조립해 프론트 계약을 유지한다.
> **id 는 TEXT** — 기존 행은 Mongo ObjectId(24-hex) 승계, 신규는 `crypto.randomUUID()`. 시각은 TEXT ISO8601 UTC, 불리언은 INTEGER 0/1.

- **users**: `google_id`(unique, 이메일 가입자는 `email:<주소>` 자리표시자 → 구글 로그인 시 실제 id 로 교체 = 계정 통합), `email`, `name`, `nickname`(표시명 우선), `picture`, `is_admin`, `leave_*`(연차 설정 5필드 평탄화 — 갱신일 지나면 조회 시 자동 이월)
- **friendships**: `requester`, `recipient`, `status`(pending|accepted), `UNIQUE(requester,recipient)` — 친구 그래프 = 캘린더 열람 권한
- **tiers** + **tier_members**: 그룹(`owner`·`name`·`code` 고유·`color`) + 멤버 조인 테이블
- **rooms** + **room_members** + **room_availability_marks**(`PK(room_id,user_id,date)` — 날짜당 1행을 DB 제약으로 승격) + **room_comments**(`author_name` = 작성 시점 표시명 스냅샷)
- **events** + **event_audience_tiers**: 일정(`visibility` public|private|default) + 비공개 상세 열람 그룹. `origin_*` 는 시간요청 출신 일정의 출처 스냅샷(`origin_request_id` 로 양쪽 사본 연결)
- **time_requests**: `from_user`·`to_user`(SQL 예약어 회피), `status`(pending|accepted|declined) — 수락 시 양쪽 일정 생성
- **login_codes**: `email`(PK), `code_hash`(sha256), `expires_at`, `attempts`(최대 5회), `sent_at`(60초 쿨다운). **D1 엔 TTL 이 없어** 코드 요청 시 만료행을 함께 DELETE
- 회원 탈퇴 cascade 는 **FK `ON DELETE CASCADE`** 가 전담(`DELETE FROM users` 한 줄) — 기존에 누락됐던 TimeRequest 고아 문제도 함께 해소

---

## 현재 상태 — Phase 1·1.5·2(모임)·3(시간요청) 동작 + **Cloudflare Workers + D1 배포** ✅

구현된 것 (도메인별 요약 — 상세 이력은 git log):

- **인증·계정**: 구글 OAuth **팝업 로그인**(localStorage `storage` 이벤트로 부모창 복귀) + JWT, **이메일 코드 로그인**(아무 이메일 → 12자리 코드 발송(nodemailer/SMTP, 미설정 시 콘솔 출력) → 검증 → JWT. 같은 이메일 구글 계정과 자동 통합), 닉네임 설정, 계정 드로어(아바타·고유번호 복사·이용약관/개인정보·로그아웃), **회원 탈퇴**(cascade — `requireAuth`가 `User.exists` 확인으로 탈퇴 계정의 잔여 JWT 차단, 로그아웃/탈퇴는 전체 페이지 로드로 캐시 초기화), **401 자동 로그아웃**, 비로그인으로 방 URL 진입 시 로그인 후 원래 방 복귀, **인앱 브라우저(카카오톡 등) 감지 → 기본 브라우저 탈출**(구글 disallowed_useragent 우회)
- **일정·캘린더**: FullCalendar **월 뷰**(주 토글 제거), 클릭·드래그 → 통합 모달(커스텀 DatePicker + 24시 TimeSelect + 종일 토글 + 위치 + 메모), 일정 클릭=수정/삭제, **공유/비공개 × 그룹** 가시성, 그룹별 라인 색(공개=초록·비공개=주황 기본). **타임존 왕복 버그 수정**(종일 종료일 +1·타임드 시간 밀림, 2026-06-24) + 종일 다중일 일정 마지막 날 채움 수정
- **친구·그룹**: 친구 요청/수락/거절, 그룹(Tier) 생성·이메일/코드로 멤버 추가, **친구 카드 "그룹에 추가" 팝업**(그룹 칩 선택·이미 포함 표시), 그룹 설정 모달(코드 복사·색 변경 `PATCH /api/tiers/:id`·삭제), 멤버 아코디언(공용 `MemberRow`), 친구 캘린더(공유=상세/비공개=바쁨)
- **모임(rooms)**: 코드 초대 + 3모드 가용성(되는날/안되는날 드래그/시간 이후) → **모두 되는 날 집계**, 가용성 캘린더 주말 파스텔 배경(일=핑크·토=하늘)·비활성 셀 어둡게(2026-06-25), **플로팅 채팅**(말풍선·6초 폴링·안읽은 배지·연속 메시지 그룹핑·본인 삭제·리사이즈), 방장 설정 모달(이름 변경·코드 재발급·멤버 강퇴·**URL 가입 토글**·삭제), 공유 모달(URL/코드 복사), 타인 프로필 모달(캘린더 보기·친구/시간 요청·그룹 추가)
- **시간 요청**: `TimeRequest` + `/requests` 페이지(보내기/받은/보낸), **수락 시 양쪽 캘린더에 일정 자동 생성**(종일 지원, **비공개로 생성**(둘 사이 약속 — 타 친구에겐 "바쁨"), 캘린더에서 **전용 보라색**(`REQUEST_COLOR`) 고정, `Event.origin` 출처 스냅샷(+`requestId` 쌍 연결) — 일정 클릭 시 누가·언제 요청했는지 표시, **상대가 자기 사본을 삭제했으면 클릭 시 커스텀 알림 + 같이 삭제 제안**(`originPartnerGone` 서버 주석). 기존 데이터는 `scripts/backfill-event-origin.mjs` 로 소급), 홈 받은 요청 배너, **Nav '시간 요청' 탭 빨간 점**(대기 요청 있을 때, 10초 TTL 캐시)
- **연차 계산기**(`/tools/leave`): 브릿지 알고리즘(공휴일 낀 구간 우선 + 연중 고른 분산), 공휴일 **2026–2031** 내장(음력·대체공휴일 자동, `lib/holidays.ts`), 설정 DB 저장(`User.leave`, 갱신일 자동 이월), 홈 **추천 연차 카드**(`computeLeavePlan` 공용)
- **홈**(`/home`): 친구요청 알림 · 다가오는 일정(D-day) · 내 모임 요약 · 추천 연차 (로그인 후 랜딩)
- **관리자**(`/admin`): 통계 개요 · 회원 권한/탈퇴(cascade) · 모임/그룹 모더레이션. 기본 관리자는 env `ADMIN_EMAILS`
- **공통 UI**: 디자인 토큰(globals.scss) + rem 반응형(clamp), PageHero(전 탭), Nav(활성 강조·중앙 스크롤) + 우하단 FAB(`lib/quickActions`), 공용 컴포넌트(Modal·Select·TimeSelect·DatePicker·ColorPalette+휠·Avatar·MemberRow·Notice·Accordion·Tooltip), 커스텀 confirm(`lib/confirm`)·토스트, 랜딩 글래스 리디자인
- **사용 가이드(스포트라이트 투어)**: FAB '📖 사용 가이드' → 대상 요소를 `box-shadow` 컷아웃으로 강조 + 스텝 설명 카드(`lib/guide` 라우트별 정의 + `GuideHost`, 대상은 각 페이지 `data-guide` 속성). 7개 탭 + **모임 방 내부**(/rooms/:id, 멤버·모드·드래그 표시·집계·채팅/공유 5스텝) 지원, 조건부 섹션 자동 스킵, 설명 카드는 실제 높이 측정 후 화면 안 클램프
- **배포·수익화**: **Cloudflare Workers + D1 단일 배포**(2026-08-13, https://moim.opnae.com) — 잠들지 않아 콜드스타트 없음, **AdSense 코드 연동**(Auto ads 스크립트 + `AdUnit` 수동 슬롯 + `ads.txt` — 승인 절차만 남음, Phase 8 참조)
- **리팩토링**: `lib/`(api·datetime·marks·clipboard·confirm·quickActions) 공용화, 데드코드 정리 3차까지(2026-07-08: `AvailabilityCalendar` 미사용 `mode` prop, `leave.ts` 내부 전용 함수 unexport, 미사용 `@fullcalendar/timegrid` 의존성 제거)

### 다음 작업 (남은 것)
- [ ] **이메일 코드 발송 활성화** — 현재 `BREVO_API_KEY` 미설정이라 로그인 코드가 **워커 로그에만** 출력된다(`npx wrangler tail`). Brevo 키를 `npx wrangler secret put BREVO_API_KEY` 로 넣으면 실제 메일 발송. (Workers 는 SMTP 불가 — HTTP API 만. 구 `backend/workers/mailWorker.js` 폴링 전송기와 `LoginCode.code` 평문 필드는 이관 과정에서 제거됨)
- [ ] **구 `backend/` 삭제** — 데이터 이전은 끝났으므로(2026-08-13) 프로덕션 안정 확인 후 제거하면 된다. 함께 정리할 것: `render.yaml`, 루트 `package.json` 의 `dev`/`start`/`dev:backend`/`install:all` 스크립트, `docs/ONBOARDING.md`·README 의 backend 언급
- [ ] **Render 서비스 2개 삭제**(사용자) + 그 뒤 GitHub push — 지금 push 하면 아직 살아있는 Render 가 autoDeploy 를 시도한다. 체크리스트는 [cf-migration.md](cf-migration.md) 상단
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
  - [ ] [adsense.google.com](https://adsense.google.com) 가입 — 사이트 URL = `moim.opnae.com`
  - [ ] 발급된 게시자 ID(`ca-pub-…`)를 `frontend/.env.local` 의 `NEXT_PUBLIC_ADSENSE_CLIENT` 에 설정(빌드 타임 인라인) + `public/ads.txt` 의 `pub-…` 숫자 교체 → `npm run worker:deploy`
  - [ ] 애드센스 사이트 **심사 통과 대기**(보통 수일~2주, 그동안 광고 자리는 빈칸)
  - [ ] ⚠️ 승인 리스크: 콘텐츠가 로그인 뒤에 숨어 있으면 "콘텐츠 부족"으로 거절 가능 → **로그인 없이 보이는 공개 소개 페이지**(서비스 설명/스크린샷 등) 보강 필요. (개인정보 처리방침·이용약관은 이미 있음)
  - [ ] 승인 후: 대시보드에서 **Auto ads** 켜기(자동 배치) 또는 광고 단위 슬롯 발급 → `<AdUnit slot="…" />` 로 수동 배치
- [ ] 운영 보안: JWT → httpOnly 쿠키 전환, Rate limit, 입력 검증 강화 (CORS 는 단일 도메인이 되어 불필요해짐)
- [x] 커스텀 도메인 + 콜드스타트 제거 ✅ — Workers 이관으로 해결(moim.opnae.com, 상시 가동)

---

## 알려진 한계 / 기술 부채 (MVP 의도된 단순화)
- 로그인 토큰을 **URL 쿼리(`?token=`)로 전달 + localStorage 저장** → 운영 전 httpOnly 쿠키로 전환 필요(Phase 8).
- **Google OAuth 에 `state` 파라미터 없음** — passport 시절부터의 동작을 그대로 이식했다(CSRF 방어 미비). 쿠키 전환 시 함께 처리할 것.
- 모든 인증 요청이 사용자 존재 확인용 **D1 read 1회**를 추가로 발생시킨다(유령 세션 차단 목적). 트래픽이 늘면 KV 캐시 검토.
- `/rooms/:id`·`/u/:userId` 는 정적 export 제약으로 **쿼리스트링 경로**(`/rooms/detail?id=`·`/u?id=`)가 됐다. 구 경로는 워커가 301 리다이렉트로 호환.
- 프론트 `next build` 시 **ESLint 건너뜀**(`next.config.mjs`) — eslint-config-next 추가 후 되돌릴 것.
- 일정 기본 가시성은 `public`(공유). 비공개는 그룹을 만들어 지정해야 상세 노출.
- 일정 입력은 커스텀 날짜 picker + 24시 시간 select + 종일 토글(타임존/반복 일정 미지원).
- 연차 계산기 공휴일은 `lib/holidays.ts` 에 2026–2031 양력+음력+대체공휴일 내장(음력 당일은 LUNAR 테이블, 임시공휴일·선거일은 수동 추가).
- `EnMono` 는 실제 폰트 파일 없이 시스템 모노스페이스 별칭(`local()`) — 환경별 글리프 차이 있음. 실제 폰트 확보 시 `@font-face src: url()` 연결.
- `AdUnit` 컴포넌트는 현재 어디서도 렌더하지 않음(수동 광고 배치용 대기 — AdSense 승인 후 사용, 삭제 금지).
- 이메일 코드 발송: **Workers 는 raw TCP(SMTP)를 못 연다** → **Brevo HTTP API** 만 지원(`BREVO_API_KEY`, 무료 300통/일). 키가 없으면 코드가 워커 로그에만 출력(`npx wrangler tail`). 교체 시 `worker/mailer.js` 한 파일만 수정.
- 자동화된 테스트는 없지만 **API 통합 검증 스크립트**는 있다 — `node scripts/verify-api.mjs <url> <워커로그>` (로그인→CRUD→권한→탈퇴 cascade 57 항목).

---

## ☁️ 인프라 이전 (2026-07-31 결정 → 2026-08-13 완료)

**Render + MongoDB Atlas → Cloudflare Workers + D1 이관 완료 — https://moim.opnae.com**

- 구성: `wrangler.toml`(custom_domain + assets `frontend/out` + `run_worker_first` + D1 바인딩) · `worker/`(수제 라우터 53 라우트) · `worker/schema.sql`(12 테이블)
- 검증: 로컬(`wrangler dev`) **57/57**, 프로덕션 **57/57** 통과 (`scripts/verify-api.mjs`)
- 상세 배경·설계 판단은 **[cf-migration.md](cf-migration.md)** 참조
- ⚠️ **데이터는 아직 안 옮겨졌다** — Atlas 클러스터가 사라진 상태. 위 "다음 작업" 첫 항목 참조.

### Moim 이관에서 배운 것 (다음 프로젝트 = Gilo 용)
- **ObjectId 를 TEXT PK 로 그대로 승계**하면 매핑 테이블도, 재로그인도 필요 없다(JWT `sub` 가 그대로 유효). MyBudget 처럼 `_id` 를 버리는 건 참조 관계가 없을 때만 가능.
- 프론트 계약을 지키는 가장 싼 방법은 **행 → 문서 변환 계층**(`worker/db.js`) 하나를 두는 것. 라우트마다 형태를 맞추지 않는다.
- **정적 export 는 동적 세그먼트를 못 만든다** — 런타임 id 경로(`/rooms/[id]`)는 쿼리스트링으로 옮기고, 구 경로는 워커에서 301. `run_worker_first` 에 그 경로들을 넣어야 SPA 폴백보다 먼저 잡힌다.
- `useSearchParams()` 대신 `window.location.search` 를 쓰면 Suspense 경계 없이 끝난다(기존 코드와도 일관).
- **탈퇴 cascade 는 FK `ON DELETE CASCADE` 로 대체**하면 애플리케이션 코드가 사라진다(Express 판의 6개 수동 삭제 → `DELETE FROM users` 한 줄). 덤으로 누락돼 있던 고아 정리까지 해결됐다.
- **D1 엔 TTL 인덱스가 없다** — Mongo TTL 로 자동 삭제되던 것(로그인 코드)은 관련 요청 경로에서 만료행을 직접 지운다. 크론까지 갈 필요 없음.
- Mongo 의 "배열 dedupe" 같은 애플리케이션 규칙은 **복합 PK/UNIQUE 로 승격**하면 코드가 준다(`PK(room_id,user_id,date)`).
- 검증은 **스크립트로 만들어 저장소에 남긴다** — 로컬/프로덕션에 같은 걸 돌려 비교할 수 있고, 다음 배포 때도 재사용된다.
- ⚠️ **PowerShell 파이프로 `wrangler secret put` 하면 개행이 섞여 값이 오염된다**(`"값" | npx wrangler secret put X`). 자체 검증은 통과하지만(서명·검증 모두 같은 오염된 값) **외부에서 발급된 기존 JWT 가 전부 401** 이 된다. 실제로 이번에 물렸다. → **`npx wrangler secret bulk secrets.json`** 으로 넣을 것. 값이 맞는지는 "이전 시스템이 발급한 토큰"으로 확인해야 드러난다.
- 데이터 이전 검증은 API 스모크만으론 부족하다 — **원본 백업의 실제 id 로 토큰을 만들어** 목록·상세·가시성까지 훑어야 매핑 오류가 잡힌다.
- 로컬 DNS 가 새 커스텀 도메인을 늦게 잡을 수 있다(negative cache). `curl --resolve` 로 먼저 확인하면 배포 문제와 구분된다.

**남은 순서: Gilo** (`C:\workspace\Gilo`, 별도 Atlas 클러스터 `cluster0.0bxwd0q` 사용 중).
참고: `C:\workspace\HOSTING-PLAN.md` · 선례 = `MyBudget`(완료) · `youtubePlaylist`(DB 없던 케이스) · `MenuManager`(처음부터 Workers + D1).
