# Moim

친구들과 스케줄을 공유하고, 함께 비는 시간을 찾아 모임·여행을 잡는 소셜 캘린더.

- **frontend/** — Next.js(App Router) + TypeScript + SCSS
- **backend/** — Node + Express(ESM) + MongoDB(Mongoose), Google OAuth + JWT

> 작업 규칙은 [CLAUDE.md](CLAUDE.md), 기능 로드맵·현재 상태·데이터 모델은 [docs/PLAN.md](docs/PLAN.md) 참조.

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

### 1) 백엔드
```powershell
cd backend
Copy-Item .env.example .env   # 값 채우기 (MONGODB_URI, JWT_SECRET, GOOGLE_*)
$env:NODE_OPTIONS="--use-system-ca"   # VPN 환경에서만 필요
npm install
npm run dev                   # http://localhost:4000
```

### 2) 프론트엔드 (새 터미널)
```powershell
cd frontend
Copy-Item .env.local.example .env.local
$env:NODE_OPTIONS="--use-system-ca"   # VPN 환경에서만 필요
npm install
npm run dev                   # http://localhost:3000
```

브라우저에서 `http://localhost:3000` → "구글로 시작하기".

---

## API 요약 (Phase 1)
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
| PATCH | `/api/friends/:friendUserId/tier` | 친구 공개 등급(close/normal) 변경 |
| GET | `/api/calendar/:userId` | 등급 반영한 친구 캘린더 조회 |

---

## 폴더 구조
```
Moim/
├─ CLAUDE.md            # 작업 규칙
├─ README.md
├─ docs/PLAN.md         # 기능 로드맵 · 현재 상태 · 다음 작업
├─ backend/
│  └─ src/{config,middleware,models,routes,utils}
└─ frontend/
   └─ src/{app,components,lib}
```
