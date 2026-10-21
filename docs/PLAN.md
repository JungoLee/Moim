# Moim 개발 계획 (living plan)

> 이 문서는 **단일 출처**다. 새 세션(사람·Claude Code)은 여기 "현재 상태"와 "다음 작업"부터 읽고 시작한다.
> 작업이 끝나면 해당 항목을 지우고(살아있는 할 일만 남긴다), 새 요청은 "다음 작업"이나 백로그에 추가한다.
> 완료 작업의 상세 이력은 **git log** 가 출처 — 여기엔 남기지 않는다. 고도화 아이디어(적용 전 후보)는 [UPGRADE-IDEAS.md](UPGRADE-IDEAS.md).
>
> _마지막 정리: 2026-10-20 — 2.1.0(UI·UX 다듬기) 운영 중(10-14 배포·push). 13테이블·59라우트(`worker/index.js` 대조)._

---

## 비전 (전체 기능 그림)
친구들과 스케줄을 공유하고 함께 비는 시간을 찾아 모임·여행을 잡는 소셜 캘린더.

1. **구글 로그인** — 됨(+ 이메일 코드 로그인)
2. **내 스케줄 공유** — 됨. 공유 대상엔 상세, 그 밖엔 "바쁨"만
3. **친한친구 기반 시간 요청** — 됨. "이 시간 내주세요" → 수락/거절
4. **근무 스케줄 방(room)** — 오전/오후/밤샘/스케줄 근무 등 친구들끼리 근무표 작성 → 백로그 Phase 5
5. **공통 빈 시간 찾기** — 모임 방(되는 날 찍기 → 겹침 집계 → 후보 → 날짜 확정)은 됨. 등록된 일정에서 자동 취합은 백로그 Phase 2
6. **실시간 웹 채팅** — 모임 방 대화(6초 폴링)는 됨. 진짜 실시간·1:1 은 백로그 Phase 4
7. **여행 플랜** — 백로그 Phase 6
8. **토큰 입장**(비회원/초대 편집) — 백로그 Phase 7
9. **AdSense** — 코드 준비됨, 승인 절차 남음(Phase 8-2)

---

## 아키텍처 (확정)
- 프론트: **Next.js(App Router, 정적 export) + TS + SCSS** (`frontend/` → `out/`). 화면 기준은 [design-system.md](design-system.md)(보드/표 두 테마)
- 백: **Cloudflare Workers**(`worker/`, 수제 라우터) + **D1**(SQLite, 바인딩 `env.DB`)
- 인증: **Google OAuth**(fetch 직접 구현) 또는 **이메일 코드** → **JWT**(jose HS256, `{sub}`, 30일) → 프론트 `localStorage` + `Authorization: Bearer` 호출
- 실시간(모임 대화): 현재 6초 폴링. Workers 에서는 Socket.io 대신 **Durable Objects + WebSocket** 이 대안(Phase 4)
- 공개 제어 핵심: 일정 가시성 = **일정별 공유/비공개**(`public`/`private`) × **그룹(Tier)** — 공유=친구 모두 상세, 비공개=선택 그룹 멤버만 상세(그 외 "바쁨")
- 배포: **단일 Cloudflare Workers** — https://moim.opnae.com (`wrangler.toml`, `custom_domain` 이라 DNS 자동). `/api/*` 는 워커, 그 외는 `frontend/out` 정적 자산. 프론트·API 가 같은 도메인이라 **CORS 없음**. 배포는 수동(`npm run worker:deploy`)

### 데이터 모델 (D1 — 13 테이블, `worker/schema.sql`)
> 응답 형태(`_id`·camelCase·중첩 객체)는 `worker/db.js` 가 되조립해 프론트 계약을 유지한다.
> **id 는 TEXT** — 이관 전 행은 Mongo ObjectId(24-hex) 승계, 신규는 `crypto.randomUUID()`. 시각은 TEXT ISO8601 UTC, 불리언은 INTEGER 0/1.
> 이미 있는 표에 칸을 더하면 `schema.sql`(새 DB 용)과 함께 **`worker/migrations/*.sql`**(운영 DB 에 한 번만 ALTER)을 만든다 — `schema.sql` 은 `CREATE TABLE IF NOT EXISTS` 라 기존 표에 칸을 넣지 못한다.

- **users**: `google_id`(unique, 이메일 가입자는 `email:<주소>` 자리표시자 → 구글 로그인 시 실제 id 로 교체 = 계정 통합), `email`, `name`, `nickname`(표시명 우선), `picture`, `is_admin`, `ui_theme`(board|table|'' — 화면 테마), `leave_*`(연차 설정 5필드 평탄화 — 갱신일 지나면 조회 시 자동 이월)
- **friendships**: `requester`, `recipient`, `status`(pending|accepted), `UNIQUE(requester,recipient)` — 친구 그래프 = 캘린더 열람 권한
- **tiers** + **tier_members**: 그룹(`owner`·`name`·`code` 고유·`color`) + 멤버 조인 테이블
- **rooms**(`join_by_url`, `confirmed_start`·`confirmed_end`·`confirmed_at` 확정 날짜) + **room_members** + **room_availability_marks**(`PK(room_id,user_id,date)`, status yes|no|after + time) + **room_comments**(`author_name` = 작성 시점 표시명 스냅샷)
- **events** + **event_audience_tiers**: 일정(`visibility` public|private|default) + 비공개 상세 열람 그룹. `origin_*` 는 자동 생성 일정의 출처 스냅샷 — `origin_kind` 'timeRequest'(시간 요청 수락, `origin_request_id` 로 양쪽 사본 연결) · 'room'(모임 날짜 확정, `origin_request_id` = 방 id)
- **time_requests**: `from_user`·`to_user`(SQL 예약어 회피), `status`(pending|accepted|declined) — 수락 시 양쪽 일정 생성
- **login_codes**: `email`(PK), `code_hash`(sha256 — 코드는 영문 대소문자+숫자 6자, 대소문자 구분), `expires_at`(발송 시 10분 / 로그 폴백 30분), `attempts`(최대 5회), `sent_at`(60초 쿨다운). **D1 엔 TTL 이 없어** 코드 요청 시 만료행을 함께 DELETE
- **mail_rate**: `key`(PK = `<IP>:<YYYY-MM-DD>`), `count` — 메일 발송 IP 당 하루 10통 제한. 지난 날짜 키는 요청 시 함께 DELETE
- 회원 탈퇴 cascade 는 **FK `ON DELETE CASCADE`** 가 전담(`DELETE FROM users` 한 줄)

---

## 현재 상태 — 2.0.3 운영 중 (2026-10-08 2.0 전면 개편 배포 → 2.0.1~2.0.3)

화면은 **보드**(어두움·왼쪽 메뉴·모임 방은 겹침 달력) / **표**(밝음·위 남색 메뉴·모임 방은 사람×날짜 표) 두 테마, 사용자가 고르고 계정(`users.ui_theme`)에 저장. 메뉴 4개(홈·캘린더·모임·사람) + 연차 계산. 상세는 [design-system.md](design-system.md), 업데이트 내역은 `frontend/src/release/releases.ts`.

- **인증·계정**: 구글 팝업 로그인 + 이메일 코드 로그인(6칸 입력, 같은 이메일 계정 자동 통합), 닉네임, 계정 서랍(테마·고유 번호·업데이트 내역·약관·로그아웃·탈퇴), 401 자동 로그아웃, 로그인 뒤 원래 주소 복귀, 인앱 브라우저 탈출 안내
- **홈**: 답할 것(받은 시간 요청·친구 요청 바로 수락/거절) · 이번 주(보드) / 친구 빈 시간 표(표, `GET /api/calendar/friends`) · 내 모임 · 추천 연차
- **캘린더**: FullCalendar 월 뷰, 일정 팝업(종일·장소·메모·공개 범위·그룹), 시간 요청·모임 확정 출처 표시, 친구 캘린더(`/u?id=`, 비공개는 "바쁨")
- **모임**: 코드/URL 초대(휴대폰은 기기 공유창), 되는 날·안 되는 날·저녁 이후 찍기(터치 끌기 포함), 히트 달력/사람×날짜 표, 후보 날짜, **날짜 확정**(멤버 모두의 캘린더에 비공개 종일 일정), 방 안 대화 패널, 방장 설정
- **사람**: 친구(요청·수락), 그룹(색·코드·멤버), 시간 요청(보내기·받은·보낸)
- **연차 계산기**(`/tools/leave`, 로그아웃 상태로도 열림): 브릿지 알고리즘, 공휴일 2026–2031 내장, 설정 계정 저장
- **관리자**(`/admin`): 통계 개요 · 회원 권한/탈퇴 · 모임/그룹 모더레이션. 기본 관리자는 env `ADMIN_EMAILS`
- **사용 가이드**: 화면 머리 `?` 버튼 → 스포트라이트 투어(`lib/guide.ts` + `data-guide`)
- **검색·수익화**: SEO 메타·sitemap·JSON-LD·랜딩 공개 소개 적용, AdSense 코드 연동(승인 전)

### 다음 작업 (남은 것)
> **▶ 다음 세션 재개 지점** — 2.1.0 은 10-14 배포·push 됐다. 첫 항목(운영 화면 눈 확인)을 2.1.0 기준으로 한 뒤 새 기능을 시작한다.

- [ ] **2.2.0 배포** — UX 점검 2차(2.1.1 분) + 주인 승인 결정 M1·M3·M4·M6·M7·M9(2026-10-21)가 **로컬 커밋 상태**. 운영 DB 변경 없음(표 구조 그대로, 새 API 3개는 기존 표만 읽고 `tier_members` 한 행을 지운다). 배포 뒤 확인: 모임 방 보조 후보·확정 확인창, 그룹 '내가 들어간 그룹'·나가기, 시간 요청 바쁨 안내, 친구 줄 링크, 휴대폰 위 머리(스위치 없음). 결정 비★(M2·M5·M8)은 하지 않았다 — 기준은 [design-system.md](design-system.md) 13장

- [ ] **2.1.0 운영 화면 눈 확인** — 로그인 뒤 두 테마 × PC·휴대폰. 실제 휴대폰에서 머리 접힘(iOS 사파리 바운스 포함)·모임 방·새 일정 시트도. 기준은 [design-system.md](design-system.md) 12장
- [ ] **이미 9시간 밀려 저장된 시간 요청 데이터** — 2.0 전에 보낸 시간 요청(과 수락으로 생긴 일정)은 시각이 9시간 늦게 저장돼 있다. 운영 DB 에서 대상 확인 후 보정할지 사용자 결정
- [ ] **OPNAE 공통 rem 기준(1rem = 10px)으로 옮길지 결정** — 글자 최소 12px 은 2.1.0 에서 맞췄다(휴대폰 루트 최솟값 16px + `rem(9~11)` → `rem(12)`). 남은 것은 `$rem-baseline: 16px` → 10px 표기 전환뿐이라 화면은 같게 둘 수 있다. 전 치수 숫자가 바뀌므로 사용자 확인 후 두 테마 전 화면 촬영 검수와 함께. 근거·현황은 [rem-convention.md](rem-convention.md)
- [ ] **프론트 의존성 보안 경고** — `frontend` 에서 `npm audit` critical 1·high 4(2026-10-13, next 14.2·postcss·source-map-js). 정적 export 라 노출은 낮다. 완전 해결은 next 16(큰 버전) 이라 **사용자 승인 후** 업그레이드 + 두 테마 검수
- [ ] **운영 verify-api 대안** — Resend 활성화(2026-08-18) 이후 운영에선 로그인 코드가 로그에 안 찍혀(실메일 발송) `verify-api.mjs` 를 운영에 돌릴 수 없다(가짜 주소 실발송 + IP 일 10통 제한과도 충돌). 당분간 **검증은 로컬 `wrangler dev`(키 없는 환경) 전용** — 운영 스모크가 필요해지면 별도 방안(health 확장 등) 검토
- [ ] **안 쓰는 크리덴셜 폐기** 🔐 — 이관으로 안 쓰이게 됐지만 **아직 살아 있는** 값들이다. 유출 시 그대로 악용된다
  - [ ] **Gmail 앱 비밀번호**(구 Express 서버의 `SMTP_PASS`, 2026-07-08 발급 — 서버 코드는 지웠지만 구글 계정의 앱 비밀번호는 살아 있다). [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) 에서 삭제
  - [ ] (판단) Google OAuth 클라이언트 시크릿 회전 — 이관 중 여러 곳을 거쳤으니 찜찜하면 콘솔에서 새로 발급 후 `wrangler secret bulk` 로 교체
- [ ] **D1 정기 백업** — Time Travel 은 30일까지만이고 DB 삭제는 못 되돌린다. 지금까지 백업은 2.0 직전 한 번(`backup/d1-20261008-before-renewal.sql`). `npx wrangler d1 export moim --remote --output backup/d1-YYYYMMDD.sql` 를 가끔 떠 둘 것
- [ ] **에러 알림** — 지금은 사용자가 말해주기 전엔 장애를 모른다. Cloudflare 대시보드 알림 또는 Logpush 검토
- [ ] **커스텀 404 페이지** — 현재 Next 기본 404. `frontend/src/app/not-found.tsx` 로 브랜드 404 만들기(검색 유입 이탈을 줄인다)
- [ ] **Workers Builds 자동 배포 켜기**(선택) — GitHub 연결 시 push 만으로 배포된다. 대시보드 설정 절차는 [workers-auto-deploy.md](workers-auto-deploy.md)
- [ ] **Cloudflare Web Analytics 붙이기** — 무료·쿠키 없음. SEO 성과(유입·페이지뷰)를 봐야 다음 액션이 정해진다. 대시보드에서 스니펫 받아 `frontend/src/app/layout.tsx` 에 `<Script>` 로 추가
- [ ] **안 읽음 표시 본격화** — 받은 요청 배지(홈·사람 메뉴)와 모임 대화 안 읽음 수(이 브라우저 `localStorage` 기준)는 됨. **서버 영속**·다른 알림(모임 변경 등)은 추후(UPGRADE-IDEAS 4·5)
- [ ] (판단) **끝난 이관 스크립트 `scripts/mongo-to-d1-seed.mjs` 삭제 여부** — Mongo 백업 JSON → seed.sql 변환용으로 역할이 끝났다. 주석의 `--remote` 적용 명령은 운영 데이터를 덮을 수 있어 지웠다(2026-10-13)

---

## 백로그 (Phase 2+ — 우선순위 순)

### Phase 2 — 공통 빈 시간 찾기 (남은 것 — 모임 방 찍기·집계·후보·확정은 됨)
- [ ] 기존 등록 일정(Event)에서 자동 취합 (수동 표시 없이 겹치는 빈 시간 계산) — 구체안 UPGRADE-IDEAS 1

### Phase 4 — 실시간 채팅
- [ ] **Durable Objects + WebSocket** 도입(JWT 핸드셰이크 인증) — Workers 는 Socket.io 불가
- [ ] 1:1·그룹 대화(지금은 모임 방 대화만) — 테이블 설계는 모임 대화(`room_comments`)와 합칠지 함께 결정
- [ ] 실시간 수신·서버 기준 안 읽음

### Phase 5 — 근무 스케줄 방
- [ ] 근무 유형(오전/오후/밤샘/커스텀) 정의 + 방(room) 단위 근무표
- [ ] 근무표 → Event/가용성으로 환산해 Phase 2 빈 시간 계산에 반영

### Phase 6 — 여행 플랜
- [ ] `TripPlan{ group, dates, items[], checklist[] }`
- [ ] 모임 날짜 확정(2.0) 뒤에 이어지는 흐름으로 — 확정된 방에서 여행 플랜 열기

### Phase 7 — 토큰 입장(초대/비회원 편집)
- [ ] `InviteToken{ token, calendar/group, scope, expiresAt }`
- [ ] 토큰 링크로 특정 캘린더/근무표 입장 + 제한된 편집

### Phase 8 — 검색 노출 & 수익화

#### 8-1. 검색 등록 (SEO 코드는 들어가 있다 — 남은 건 검색엔진에 알리는 절차)
- [ ] **Google Search Console 등록**
  - [ ] [search.google.com/search-console](https://search.google.com/search-console) → 속성 추가 → **URL 접두어** → `https://moim.opnae.com`
  - [ ] 소유권 확인 — **HTML 태그** 방식이 가장 쉽다. 받은 `<meta name="google-site-verification" content="…">` 값을
        `frontend/src/app/layout.tsx` 의 `metadata` 에 `verification: { google: '…' }` 로 넣고 `npm run worker:deploy`
        (DNS TXT 방식도 가능 — 도메인이 Cloudflare 에 있으므로 DNS 레코드 추가로도 됨)
  - [ ] **Sitemaps** 메뉴에서 `sitemap.xml` 제출
  - [ ] **URL 검사** → `https://moim.opnae.com/` 와 `/tools/leave` 색인 요청
  - [ ] 1~2주 뒤 "페이지" 리포트에서 색인 여부·제외 사유 확인
- [ ] **네이버 서치어드바이저**([searchadvisor.naver.com](https://searchadvisor.naver.com)) 등록 — 국내 검색 유입엔 구글보다 중요할 수 있다. 사이트 소유확인 + `sitemap.xml` 제출
- [ ] **Bing Webmaster Tools** — Search Console 계정 연동으로 몇 클릭에 끝난다
- [ ] (선택) OG 이미지 — 지금은 이미지 없이 텍스트 카드만 노출된다. 1200×630 PNG 를 `frontend/public/og.png` 로 넣고
      `layout.tsx` 의 `openGraph.images`·`twitter.images` 에 연결하면 공유 시 썸네일이 붙는다
- [ ] (선택) 개인정보 처리방침·이용약관을 **모달이 아닌 별도 페이지**(`/privacy`·`/terms`)로 — 크롤러가 읽을 수 있어야 신뢰도·AdSense 심사에 유리

#### 8-2. AdSense (코드는 준비 완료 — 남은 건 구글 쪽 신청·승인)
- [ ] [adsense.google.com](https://adsense.google.com) 가입 — 사이트 URL = `moim.opnae.com`
- [ ] 발급된 게시자 ID(`ca-pub-…`)를 `frontend/.env.local` 의 `NEXT_PUBLIC_ADSENSE_CLIENT` 에 설정(빌드 타임 인라인) + `frontend/public/ads.txt` 의 `pub-…` 숫자 교체 → `npm run worker:deploy`
- [ ] 애드센스 사이트 **심사 통과 대기**(보통 수일~2주, 그동안 광고 자리는 빈칸)
- [ ] 승인 후: 대시보드에서 **Auto ads** 켜기(자동 배치) 또는 광고 단위 슬롯 발급 → `<AdUnit slot="…" />` 로 수동 배치
  - 배치 시 주의 — 로그인 폼 위나 달력 조작 영역 근처는 오클릭 유발로 정책 위반이 될 수 있다. 랜딩 소개 섹션 사이·연차 계산기 결과 아래가 안전
  - 심사 전 `/privacy`·`/terms` 페이지화(8-1)를 해두면 더 안전
- [ ] 운영 보안: JWT → httpOnly 쿠키 전환(+ OAuth `state` 추가), 입력 검증 강화(UPGRADE-IDEAS 36). ※ 메일 발송 레이트 리밋은 적용됨(`mail_rate`)

---

## 알려진 한계 / 기술 부채 (MVP 의도된 단순화)
- 로그인 토큰을 **URL 쿼리(`?token=`)로 전달 + localStorage 저장** → 운영 전 httpOnly 쿠키로 전환 필요(Phase 8).
- **Google OAuth 에 `state` 파라미터 없음** — passport 시절부터의 동작을 그대로 이식했다(CSRF 방어 미비). 쿠키 전환 시 함께 처리할 것.
- 모든 인증 요청이 사용자 존재 확인용 **D1 read 1회**를 추가로 발생시킨다(유령 세션 차단 목적). 트래픽이 늘면 KV 캐시 검토(UPGRADE-IDEAS 10).
- D1 무료 읽기 한도(하루 500만 행)는 **opnae 계정 전체 공용**이다 — 모임 대화 6초 폴링이 방 전체(멤버·찍은 날·댓글)를 다시 읽는다(UPGRADE-IDEAS 27).
- `/rooms/:id`·`/u/:userId` 는 정적 export 제약으로 **쿼리스트링 경로**(`/rooms/detail?id=`·`/u?id=`)가 됐다. 구 경로는 워커가 301 리다이렉트로 호환.
- 프론트 `next build` 시 **ESLint 건너뜀**(`next.config.mjs`) — eslint-config-next 추가 후 되돌릴 것.
- 일정 기본 가시성은 `public`(공유). 비공개는 그룹을 만들어 지정해야 상세 노출.
- 일정 입력은 커스텀 날짜 picker + 24시 시간 select + 종일 토글(타임존/반복 일정 미지원).
- 연차 계산기 공휴일은 `lib/holidays.ts` 에 2026–2031 양력+음력+대체공휴일 내장(음력 당일은 LUNAR 테이블, 임시공휴일·선거일은 수동 추가). 2032년부터는 표를 늘려야 한다.
- `AdUnit` 컴포넌트는 현재 어디서도 렌더하지 않음(수동 광고 배치용 대기 — AdSense 승인 후 사용, 삭제 금지).
- 이메일 코드 발송: **Workers 는 raw TCP(SMTP)를 못 연다** → **Resend HTTP API** 만 지원(`RESEND_API_KEY`, 무료 100통/일 — opnae 프로젝트 공용, 발신 `noreply@opnae.com`). 키가 없으면 코드가 워커 로그에만 출력(`npx wrangler tail`). 교체 시 `worker/mailer.js` 한 파일만 수정. IP 당 하루 10통 제한(`mail_rate`).
- 자동화된 테스트는 없지만 **API 통합 검증 스크립트**는 있다 — `node scripts/verify-api.mjs <url> <워커로그>` (로그인→CRUD→권한→2.0 항목→탈퇴 cascade 70 항목). 단 Resend 활성화 이후 **로컬 `wrangler dev`(키 없는 환경) 전용** — 운영은 코드가 로그에 안 찍힌다.
