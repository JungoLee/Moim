# Moim

친구들과 스케줄을 공유하고, 함께 비는 시간을 찾아 모임·여행을 잡는 소셜 캘린더.

- **frontend/** — Next.js(App Router, 정적 export) + TypeScript + SCSS
- **worker/** — Cloudflare Workers(API) + D1(SQLite), Google OAuth + JWT

> 작업 규칙은 [CLAUDE.md](CLAUDE.md), 기능 로드맵·현재 상태·데이터 모델은 [docs/PLAN.md](docs/PLAN.md), 화면 기준은 [docs/design-system.md](docs/design-system.md), 셋업·트러블슈팅은 [docs/ONBOARDING.md](docs/ONBOARDING.md) 참조.

---

## 주요 기능 (현재 — 2.0)
- **화면 두 벌** — **보드**(어두움·왼쪽 메뉴) / **표**(밝음·위 메뉴) 중 골라 쓰고 계정에 저장. 메뉴는 홈·캘린더·모임·사람 + 연차 계산
- **구글 로그인**(팝업) **또는 이메일 코드 로그인**(아무 이메일 → 6자 코드 → 6칸 입력칸에 넣으면 바로 로그인, 같은 이메일 계정 자동 통합)
- **홈** — 답할 것(받은 시간 요청·친구 요청 바로 수락/거절) · 이번 주 / 친구 빈 시간 표 · 내 모임 · 추천 연차
- **캘린더** — **FullCalendar** 월 뷰, 드래그/클릭으로 기간 선택해 추가(종일·위치·메모)
- **친구 + 그룹** — 그룹을 만들어 **이메일 또는 고유 코드**로 멤버 추가, 그룹별 캘린더 색
- **공유/비공개** — 일정별로 `공유(친구 모두)` / `비공개(특정 그룹에만)` 제어. 비대상에게는 "바쁨"만 노출
- **모임 방**(`/rooms`) — 코드/URL 초대(휴대폰은 기기 공유창) + 되는 날·안 되는 날·저녁 이후 찍기 → 모두 되는 날 집계·후보 → **날짜 확정**(멤버 모두의 캘린더에 일정) + 방 안 대화
- **시간 요청**(`/requests`) — 친구에게 시간 요청 → 수락 시 양쪽 캘린더에 일정 자동 생성
- **연차 계산기**(`/tools/leave`, 로그인 없이도) — 주말·공휴일(2026–2031 내장)을 활용해 최소 연차로 최대 연휴를 추천(브릿지 알고리즘)

---

## 사전 준비
1. **Node.js 18+** (개발 환경엔 24 설치됨)
2. **Cloudflare 계정** — `npx wrangler login` (D1·Workers 배포용)
3. **Google OAuth 클라이언트** — 아래 절차 참고

### Google OAuth 클라이언트 만들기
1. [Google Cloud Console](https://console.cloud.google.com/) → 프로젝트 생성
2. **API 및 서비스 → OAuth 동의 화면** 구성(외부, 테스트 사용자에 본인 이메일 추가)
3. **사용자 인증 정보 → 사용자 인증 정보 만들기 → OAuth 2.0 클라이언트 ID → 웹 애플리케이션**
4. **승인된 리디렉션 URI** 에 추가:
   - `https://moim.opnae.com/api/auth/google/callback` (운영)
   - `http://localhost:8790/api/auth/google/callback` (로컬 `wrangler dev`)
5. 발급된 **클라이언트 ID** 는 `wrangler.toml` `[vars]`, **비밀번호** 는 시크릿(`wrangler secret put GOOGLE_CLIENT_SECRET`)

---

## 셋업 & 실행

### 0) 최초 1회 — 의존성 + 로컬 시크릿 + 로컬 DB
```powershell
$env:NODE_OPTIONS="--use-system-ca"   # VPN 환경에서만 필요
npm install; npm --prefix frontend install   # 루트(wrangler·jose) + frontend 의존성
# .dev.vars 에 JWT_SECRET · GOOGLE_CLIENT_SECRET 작성 (gitignore)
npm run db:schema                     # 로컬 D1 에 스키마 적용
```

### 1) 프론트 빌드 + 워커 실행 (운영과 동일한 구성)
```powershell
npm run build         # frontend/out 정적 export
npm run worker:dev    # http://localhost:8790 (API + 정적 자산)
```

### 1-b) 프론트만 빠르게 고칠 때
```powershell
npm run dev    # http://localhost:3000 (frontend next dev, HMR — 브라우저 자동 오픈)
```
API 는 상대경로라 이 모드에서는 호출이 3000 포트로 나간다 — API 까지 필요하면 위 1) 방식을 쓴다.

---

## 배포 (Cloudflare Workers + D1)
단일 Workers 배포 — **https://moim.opnae.com** (API `/api/*` + 정적 프론트, 커스텀 도메인은 wrangler 가 DNS 자동 생성).

```powershell
npm run db:schema:remote                        # 최초 1회 (원격 D1 스키마)
npx wrangler secret put JWT_SECRET              # 최초 1회
npx wrangler secret put GOOGLE_CLIENT_SECRET    # 최초 1회
npm run worker:deploy                           # 빌드 + 배포
```
- **로그인 코드 메일**: `RESEND_API_KEY` 시크릿을 넣으면 실제 발송(Resend, 발신 `noreply@opnae.com`) — **운영에는 등록돼 있다**(2026-08-18). 키가 없으면 `npx wrangler tail` 로그에 코드만 출력.
- (선택) **AdSense**: `NEXT_PUBLIC_ADSENSE_CLIENT` 설정 시 광고 로드, `public/ads.txt`가 `/ads.txt`로 서빙(게시자 확인).
- 배포 후 운영 규칙(DB 변경 적용·백업·하면 안 되는 것) → [docs/operating-notes.md](docs/operating-notes.md).

---

## API 요약 (현재 — 56개, 단일 출처는 `worker/index.js` 의 `ROUTES`)
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/health` | 헬스 체크 |
| GET | `/api/auth/google` | 구글 로그인 시작 |
| GET | `/api/auth/google/callback` | 콜백 → JWT 발급 후 프론트로 리디렉션 |
| POST | `/api/auth/email/request` | 이메일로 6자 로그인 코드 발송 (영문 대소문자+숫자 · 1분 쿨다운 · IP 당 하루 10통) |
| POST | `/api/auth/email/verify` | 코드 검증(**대소문자 구분**) → JWT 발급 (계정 없으면 생성, 같은 이메일 구글 계정과 통합) |
| GET/PATCH/DELETE | `/api/auth/me` | 내 정보 / 닉네임·화면 테마(`uiTheme`) 저장 / 회원 탈퇴(데이터 cascade) |
| GET/PUT | `/api/auth/leave` | 연차 계산기 설정 조회(갱신일 자동 이월) / 저장 |
| GET/POST | `/api/events` | 내 일정 목록(`?from&to`) / 생성 |
| PATCH/DELETE | `/api/events/:id` | 일정 수정 / 삭제 |
| GET | `/api/friends` | 친구 목록 |
| GET/POST | `/api/friends/requests` | 받은 요청 / 요청 보내기(email) |
| POST | `/api/friends/requests/:id/accept`·`/decline` | 수락 / 거절 |
| GET | `/api/calendar/friends` | 친구 전원의 바쁜 시간(`?from&to`, 시간만 — 홈 표 테마) |
| GET | `/api/calendar/:userId` | 공유/비공개·그룹 반영한 친구 캘린더 조회 |
| GET/POST | `/api/tiers` | 내 그룹 목록 / 생성 |
| POST | `/api/tiers/join` | 코드로 그룹 가입 |
| PATCH/DELETE | `/api/tiers/:id` | 그룹 색 변경 / 삭제 |
| POST/DELETE | `/api/tiers/:id/members[/:userId]` | 멤버 추가(email) / 제거 |
| GET/POST | `/api/rooms` · `/api/rooms/join` | 모임 방 목록(진행 상태 포함)·생성 / 코드 입장 |
| GET/PATCH/DELETE | `/api/rooms/:id` | 방 상세(멤버·가용성·대화·확정) / (방장) 이름·URL 가입 설정 / 삭제 |
| PUT | `/api/rooms/:id/availability` | 내 가능 표시 저장(전체 교체) |
| POST/DELETE | `/api/rooms/:id/comments[/:commentId]` | 방 대화 작성 / 삭제(본인·방장) |
| POST | `/api/rooms/:id/code` | (방장) 초대 코드 재발급 |
| DELETE | `/api/rooms/:id/members/:userId` | (방장) 멤버 내보내기 |
| POST | `/api/rooms/:id/join-url` | URL 가입(방장이 켰을 때 코드 없이 입장) |
| POST/DELETE | `/api/rooms/:id/confirm` | (방장) 날짜 확정 — 멤버 모두에게 비공개 종일 일정 / 확정 취소 |
| GET | `/api/requests/received`·`/sent` | 받은 / 보낸 시간요청 |
| POST | `/api/requests` | 시간요청 생성(친구에게) |
| POST | `/api/requests/:id/accept`·`/decline` | 수락(양쪽 일정 생성) / 거절 |
| DELETE | `/api/requests/:id` | 보낸 요청 취소 |
| GET | `/api/admin/stats` | (관리자) 통계 개요 |
| GET/PATCH/DELETE | `/api/admin/users` · `/:id/admin` · `/:id` | (관리자) 가입자 목록 / 권한 부여·회수 / 회원 삭제 |
| GET/DELETE | `/api/admin/rooms[/:id]` · `/api/admin/tiers[/:id]` | (관리자) 모임·그룹 목록 / 삭제(모더레이션) |

---

## 폴더 구조
```
Moim/
├─ wrangler.toml        # Workers 설정: moim.opnae.com · assets(frontend/out) · D1 바인딩
├─ package.json         # 루트: dev / build / worker:dev / worker:deploy / db:schema(:remote)
├─ CLAUDE.md            # 작업 규칙
├─ README.md
├─ docs/                # PLAN.md(로드맵·현재상태) · design-system.md(화면 기준) · ONBOARDING.md · operating-notes.md(운영 규칙) · refactoring-guide.md · UPGRADE-IDEAS.md · rem-convention.md · workers-auto-deploy.md
├─ worker/              # Cloudflare Workers API
│  ├─ index.js          # 라우트 표 56개 + 구 동적경로 301 + 정적 자산 폴백
│  ├─ auth·google·mailer·db·http.js                 # 인증·OAuth·메일·D1 공용/변환·응답 헬퍼
│  ├─ events·friends·calendar·tiers·rooms·requests·admin.js
│  ├─ schema.sql        # D1 13테이블 (users·events·friendships·tiers·rooms·time_requests·login_codes·mail_rate + 조인 5)
│  └─ migrations/       # 기존 표 변경(ALTER) — 운영에 한 번만
├─ scripts/             # verify-api.mjs(통합 검증 70항목) · open-browser.mjs · mongo-to-d1-seed.mjs(이관 1회용)
└─ frontend/
   └─ src/
      ├─ app/           # / · auth/callback · (app)/{home · dashboard · rooms(+rooms/detail?id=) · friends · tiers · requests · u?id= · tools/leave · admin}
      ├─ components/    # shell/(AppShell·ShellContext·nav·BrandMark·ThemeSwitch) · room/(useRoom·두 보기·달력·표·후보·대화…) · home/ · people/ · 공용 부품(PageHeader·Modal·Calendar·DatePicker…)
      ├─ lib/           # api · types · datetime · format · colors · theme · roomCandidates · roomStatus · leave · holidays · share · …
      ├─ release/       # 업데이트 내역(releases.ts) · ReleaseModal
      └─ styles/        # tokens · base · components(ui-*) · fullcalendar · _rem · _bp
```
자세한 파일 지도는 [docs/ONBOARDING.md](docs/ONBOARDING.md) §5.
