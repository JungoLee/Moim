# Moim

친구들과 스케줄을 공유하고, 함께 비는 시간을 찾아 모임·여행을 잡는 소셜 캘린더.

- **frontend/** — Next.js(App Router) + TypeScript + SCSS
- **backend/** — Node + Express(ESM) + MongoDB(Mongoose), Google OAuth + JWT

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
2. **MongoDB** — 로컬 설치 또는 [MongoDB Atlas](https://www.mongodb.com/atlas) 무료 클러스터
3. **Google OAuth 클라이언트** — 아래 절차 참고

### Google OAuth 클라이언트 만들기
1. [Google Cloud Console](https://console.cloud.google.com/) → 프로젝트 생성
2. **API 및 서비스 → OAuth 동의 화면** 구성(외부, 테스트 사용자에 본인 이메일 추가)
3. **사용자 인증 정보 → 사용자 인증 정보 만들기 → OAuth 2.0 클라이언트 ID → 웹 애플리케이션**
4. **승인된 리디렉션 URI** 에 추가: `http://localhost:4000/api/auth/google/callback`
5. 발급된 **클라이언트 ID/비밀번호** 를 `backend/.env` 에 입력

---

## 셋업 & 실행

### 0) 최초 1회 — 설정 파일 + 의존성
```powershell
cd backend;  Copy-Item .env.example .env          # 값 채우기 (MONGODB_URI, JWT_SECRET, GOOGLE_*)
cd ..\frontend; Copy-Item .env.local.example .env.local
cd ..
$env:NODE_OPTIONS="--use-system-ca"   # VPN 환경에서만 필요
npm run install:all                   # backend + frontend 의존성 한 번에 설치
```

### 1) 루트에서 두 서버 한 번에 (권장)
```powershell
$env:NODE_OPTIONS="--use-system-ca"   # VPN 환경에서만 필요
npm run dev
```
- backend(`:4000`) + frontend(`:3000`)를 한 콘솔에서 실행. 출력은 `[backend]`/`[frontend]` 로 구분.
- **Ctrl+C** 한 번이면 두 서버가 함께 종료. 한쪽이 죽으면 나머지도 자동 정리(`concurrently`).

### 1-b) 개별 실행 (디버깅 등 따로 띄우고 싶을 때)
```powershell
# 터미널 A
cd backend;  $env:NODE_OPTIONS="--use-system-ca"; npm run dev   # http://localhost:4000
# 터미널 B
cd frontend; $env:NODE_OPTIONS="--use-system-ca"; npm run dev   # http://localhost:3000
```

브라우저에서 `http://localhost:3000` → "Sign in with Google"(팝업으로 로그인 → 자동 복귀).

---

## 배포 (Render)
운영은 **Render**에 루트 `render.yaml` **Blueprint**로 배포 — web 서비스 2개(`moim-api` 백 + `moim-web` 프론트, SSR) + MongoDB Atlas.

- Render → **New → Blueprint** → `JungoLee/Moim` 선택 → 시크릿(`MONGODB_URI`·`JWT_SECRET`·`GOOGLE_CLIENT_SECRET`) 입력 → **Apply**. 이후 `main` push 시 **autoDeploy**.
- **Atlas Network Access** 에 Render outbound IP 대역 등록(아니면 백엔드 DB 연결 실패 → `/api/health` 503).
- **구글 콘솔** OAuth 클라이언트에 운영 콜백 `https://moim-api.onrender.com/api/auth/google/callback` 등록.
- (선택) **AdSense**: `NEXT_PUBLIC_ADSENSE_CLIENT` 설정 시 광고 로드, `public/ads.txt`가 `/ads.txt`로 서빙(게시자 확인).
- 자세히 → [docs/ONBOARDING.md](docs/ONBOARDING.md) §7.

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
