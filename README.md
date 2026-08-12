# Moim

친구들과 스케줄을 공유하고, 함께 비는 시간을 찾아 모임·여행을 잡는 소셜 캘린더.

- **frontend/** — Next.js(App Router, 정적 export) + TypeScript + SCSS
- **worker/** — Cloudflare Workers(API) + D1(SQLite), Google OAuth + JWT
- **backend/** — (구) Node + Express + MongoDB — Workers 이관 완료 후 삭제 예정

> 작업 규칙은 [CLAUDE.md](CLAUDE.md), 기능 로드맵·현재 상태·데이터 모델은 [docs/PLAN.md](docs/PLAN.md), 셋업·트러블슈팅은 [docs/ONBOARDING.md](docs/ONBOARDING.md) 참조.

---

## 주요 기능 (현재)
- **구글 로그인**(팝업) **또는 이메일 코드 로그인**(아무 이메일 → 12자리 코드 → 로그인, 같은 이메일 계정 자동 통합) → 내 일정 작성 — **FullCalendar** 월 뷰, 드래그/클릭으로 기간 선택해 추가(종일·위치·메모)
- **친구 + 그룹** — 그룹을 만들어 **이메일 또는 고유 코드**로 멤버 추가, 그룹별 캘린더 라인 색
- **공유/비공개** — 일정별로 `공유(누구나)` / `비공개(특정 그룹에만)` 제어. 비대상에게는 "바쁨"만 노출
- **모임 방**(`/rooms`) — 코드/URL 초대 + 3모드 가용성(되는날·안되는날·시간 이후) → **모두 되는 날** 집계 + 플로팅 채팅
- **시간 요청**(`/requests`) — 친구에게 시간 요청 → 수락 시 양쪽 캘린더에 일정 자동 생성
- **연차 계산기**(`/tools/leave`) — 주말·공휴일(2026–2031 내장)을 활용해 최소 연차로 최대 연휴를 추천(브릿지 알고리즘)

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
npm run install:all                   # 루트 + frontend 의존성
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
cd frontend; npm run dev    # http://localhost:3000 (HMR)
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
- **로그인 코드 메일**: `BREVO_API_KEY` 시크릿을 넣으면 실제 발송, 없으면 `npx wrangler tail` 로그에 코드 출력.
- (선택) **AdSense**: `NEXT_PUBLIC_ADSENSE_CLIENT` 설정 시 광고 로드, `public/ads.txt`가 `/ads.txt`로 서빙(게시자 확인).
- 이관 배경·의사결정 → [docs/cf-migration.md](docs/cf-migration.md).

---

## API 요약 (현재)
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/health` | 헬스 체크 |
| GET | `/api/auth/google` | 구글 로그인 시작 |
| GET | `/api/auth/google/callback` | 콜백 → JWT 발급 후 프론트로 리디렉션 |
| POST | `/api/auth/email/request` | 이메일로 12자리 로그인 코드 발송 (1분 쿨다운) |
| POST | `/api/auth/email/verify` | 코드 검증 → JWT 발급 (계정 없으면 생성, 같은 이메일 구글 계정과 통합) |
| GET/PATCH/DELETE | `/api/auth/me` | 내 정보 / 닉네임 설정 / 회원 탈퇴(데이터 cascade) |
| GET/PUT | `/api/auth/leave` | 연차 계산기 설정 조회(갱신일 자동 이월) / 저장 |
| GET/POST | `/api/events` | 내 일정 목록 / 생성 |
| PATCH/DELETE | `/api/events/:id` | 일정 수정 / 삭제 |
| GET | `/api/friends` | 친구 목록 |
| GET/POST | `/api/friends/requests` | 받은 요청 / 요청 보내기(email) |
| POST | `/api/friends/requests/:id/accept`·`/decline` | 수락 / 거절 |
| GET/POST | `/api/tiers` | 내 그룹 목록 / 생성 |
| PATCH/DELETE | `/api/tiers/:id` | 그룹 색 변경 / 삭제 |
| POST/DELETE | `/api/tiers/:id/members[/:userId]` | 멤버 추가(email) / 제거 |
| POST | `/api/tiers/join` | 코드로 그룹 가입 |
| GET | `/api/calendar/:userId` | 공유/비공개·그룹 반영한 친구 캘린더 조회 |
| GET/POST | `/api/rooms` · `/join` | 모임 방 목록·생성 / 코드 입장 |
| GET/PUT | `/api/rooms/:id` · `/availability` | 방 상세(멤버·가용성·채팅 메시지) / 내 가능표시 저장 |
| POST/DELETE | `/api/rooms/:id/comments[/:cid]` | 방 채팅 메시지 작성 / 삭제(본인·방장) |
| PATCH/DELETE/POST | `/api/rooms/:id` · `/:id/code` | (방장) 방 설정(이름·URL가입)·삭제 / 초대코드 재발급 |
| DELETE/POST | `/api/rooms/:id/members/:uid` · `/:id/join-url` | (방장) 멤버 강퇴 / URL 가입(코드 없이 입장) |
| GET | `/api/requests/received`·`/sent` | 받은 / 보낸 시간요청 |
| POST | `/api/requests` | 시간요청 생성(친구에게) |
| POST | `/api/requests/:id/accept`·`/decline` | 수락(양쪽 일정 생성) / 거절 |
| DELETE | `/api/requests/:id` | 보낸 요청 취소 |
| GET | `/api/admin/stats` | (관리자) 통계 개요 |
| GET/PATCH/DELETE | `/api/admin/users[/:id/admin]` | (관리자) 가입자 목록 / 권한 부여·회수 / 회원 삭제 |
| GET/DELETE | `/api/admin/rooms[/:id]` · `/tiers[/:id]` | (관리자) 모임·그룹 목록 / 삭제(모더레이션) |

---

## 폴더 구조
```
Moim/
├─ package.json         # 루트: concurrently 로 두 서버 동시 실행 (npm run dev)
├─ render.yaml          # Render 배포 Blueprint (web 2개: moim-api·moim-web)
├─ CLAUDE.md            # 작업 규칙
├─ README.md
├─ docs/                # PLAN.md(로드맵·현재상태) · ONBOARDING.md · refactoring-guide.md
├─ backend/
│  └─ src/{config,middleware,models,routes,utils}   # models: User·Friendship·Tier·Room·Event·TimeRequest·LoginCode
└─ frontend/
   └─ src/
      ├─ app/           # home · dashboard · friends · tiers · rooms · requests · tools/leave · admin · u/[userId] · auth/callback
      ├─ components/    # Nav(+QuickActions FAB) · PageHero · Calendar(FullCalendar) · AvailabilityCalendar · DatePicker · Modal · Select · TimeSelect · ColorPalette(+ColorWheel) · Avatar · MemberRow · Notice · Accordion · AccountDrawer · LegalModal · CopyButton · Icon · Tooltip · RoomChat · UserProfileModal · ConfirmHost · Toaster · GuideHost · AdUnit
      └─ lib/           # api · clipboard · types · format · brand · colors · datetime · marks · confirm · quickActions · guide · inapp · toast · leave · holidays · adsense
```
