# Moim

친구들과 스케줄을 공유하고, 함께 비는 시간을 찾아 모임·여행을 잡는 소셜 캘린더.

- **frontend/** — Next.js(App Router) + TypeScript + SCSS
- **backend/** — Node + Express(ESM) + MongoDB(Mongoose), Google OAuth + JWT

> 작업 규칙은 [CLAUDE.md](CLAUDE.md), 기능 로드맵·현재 상태·데이터 모델은 [docs/PLAN.md](docs/PLAN.md), 셋업·트러블슈팅은 [docs/ONBOARDING.md](docs/ONBOARDING.md) 참조.

---

## 주요 기능 (현재)
- **구글 로그인** → 내 일정 작성 — 월·주 **FullCalendar**, 드래그/클릭으로 기간 선택해 추가
- **친구 + 그룹** — 그룹을 만들어 **이메일 또는 고유 코드**로 멤버 추가
- **공유/비공개** — 일정별로 `공유(누구나)` / `비공개(특정 그룹에만)` 제어. 비대상에게는 "바쁨"만 노출
- **연차 계산기**(`/tools/leave`) — 주말·공휴일을 활용해 최소 연차로 최대 연휴를 추천(브릿지 알고리즘)

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

브라우저에서 `http://localhost:3000` → "구글로 시작하기".

---

## API 요약 (현재)
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/health` | 헬스 체크 |
| GET | `/api/auth/google` | 구글 로그인 시작 |
| GET | `/api/auth/google/callback` | 콜백 → JWT 발급 후 프론트로 리디렉션 |
| GET | `/api/auth/me` | 내 정보 |
| GET/POST | `/api/events` | 내 일정 목록 / 생성 |
| PATCH/DELETE | `/api/events/:id` | 일정 수정 / 삭제 |
| GET | `/api/friends` | 친구 목록 |
| GET/POST | `/api/friends/requests` | 받은 요청 / 요청 보내기(email) |
| POST | `/api/friends/requests/:id/accept`·`/decline` | 수락 / 거절 |
| GET/POST | `/api/tiers` | 내 그룹 목록 / 생성 |
| DELETE | `/api/tiers/:id` | 그룹 삭제 |
| POST/DELETE | `/api/tiers/:id/members[/:userId]` | 멤버 추가(email) / 제거 |
| POST | `/api/tiers/join` | 코드로 그룹 가입 |
| GET | `/api/calendar/:userId` | 공유/비공개·그룹 반영한 친구 캘린더 조회 |
| GET/POST | `/api/rooms` · `/join` | 모임 방 목록·생성 / 코드 입장 |
| GET/PUT | `/api/rooms/:id` · `/availability` | 방 상세(멤버·가용성·댓글) / 내 가능표시 저장 |
| POST/DELETE | `/api/rooms/:id/comments[/:cid]` | 방 댓글 작성 / 삭제 |
| PATCH | `/api/auth/me` | 닉네임 설정 |
| GET/PATCH | `/api/admin/users[/:id/admin]` | (관리자) 가입자 목록 / 권한 부여·회수 |

---

## 폴더 구조
```
Moim/
├─ package.json         # 루트: concurrently 로 두 서버 동시 실행 (npm run dev)
├─ CLAUDE.md            # 작업 규칙
├─ README.md
├─ docs/                # PLAN.md(로드맵·현재상태) · ONBOARDING.md · refactoring-guide.md
├─ backend/
│  └─ src/{config,middleware,models,routes,utils}   # models: User·Friendship·Tier·Event
└─ frontend/
   └─ src/
      ├─ app/           # dashboard · friends · tiers · rooms · tools/leave · admin · u/[userId] · auth/callback
      ├─ components/    # Nav · Calendar(FullCalendar) · AvailabilityCalendar · DatePicker · AccountDrawer · LegalModal · CopyButton
      └─ lib/           # api · types · format · brand · leave · holidays
```
