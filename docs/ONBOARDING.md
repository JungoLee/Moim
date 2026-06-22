# Moim 핸들링 가이드 (신규자 + AI 용)

> 이 프로젝트를 처음 보는 사람도(또는 AI 가) 이 문서만 따라 셋업·실행·문제 해결할 수 있게 정리.
> 규칙은 [`../CLAUDE.md`](../CLAUDE.md), 살아있는 할 일은 [`PLAN.md`](PLAN.md), 리팩토링 절차는 [`refactoring-guide.md`](refactoring-guide.md).

## 0. 이게 뭔가
친구들과 스케줄을 공유하고 함께 비는 시간을 찾는 소셜 캘린더. **프론트** Next.js(App Router)+TS+SCSS(`frontend/`, :3000), **백** Node+Express(ESM)+MongoDB(`backend/`, :4000). 인증은 Google OAuth → 백엔드 JWT 발급 → 프론트가 `Authorization: Bearer` 로 호출.

---

## 1. 빠른 시작 (로컬)

```powershell
# 백엔드
cd backend
Copy-Item .env.example .env        # 값 채우기 (§2)
$env:NODE_OPTIONS="--use-system-ca"  # VPN 환경에서만
npm install
npm run dev                        # http://localhost:4000

# 프론트엔드 (새 터미널)
cd frontend
Copy-Item .env.local.example .env.local
$env:NODE_OPTIONS="--use-system-ca"  # VPN 환경에서만
npm install
npm run dev                        # http://localhost:3000
```

> Windows + VPN 이면 새 터미널마다 위 `NODE_OPTIONS` 가 필요. 영구 적용은 `setx NODE_OPTIONS "--use-system-ca"` (새 터미널부터).

---

## 2. 사전조건 체크리스트 (하나라도 빠지면 안 됨)

| # | 항목 | 어디 | 빠지면 증상 |
|---|------|------|------------|
| 1 | `backend/.env` 의 **MONGODB_URI** | 로컬 Mongo 또는 Atlas 연결 문자열 | DB 연결 실패 → 서버가 안 뜸 |
| 2 | (Atlas 사용 시) **Network Access 에 현재 공인 IP** | Atlas 콘솔 | 연결 타임아웃 |
| 3 | `backend/.env` 의 **JWT_SECRET** (고정값) | 임의 랜덤 문자열, 재시작해도 동일 유지 | 로그인 세션이 매번 만료 |
| 4 | `backend/.env` 의 **GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET** | Google Cloud Console OAuth | 구글 로그인 실패 |
| 5 | OAuth **승인된 리디렉션 URI** = `http://localhost:4000/api/auth/google/callback` | Google Cloud Console | 콜백 단계에서 실패 |
| 6 | **NODE_OPTIONS=--use-system-ca** (VPN) | 환경변수 | npm install/build 인증서 오류 |
| 7 | `frontend/.env.local` 의 **NEXT_PUBLIC_API_URL=http://localhost:4000** | 프론트 환경 | API 호출 실패 |

> `backend/.env.example`·`frontend/.env.local.example` 에 전체 변수 설명이 있음. **`.env` 는 커밋 금지.**

---

## 3. 트러블슈팅 — "에러나면 여기부터 의심"

### 🔴 서버가 안 뜸 / DB 연결 타임아웃
1. (Atlas) **Network Access** 에 지금 내 공인 IP 등록됐는지 (VPN이면 VPN 출구 IP) → 1순위.
2. `MONGODB_URI` 의 사용자/비번/주소 정확한지. 로컬 Mongo면 서비스가 떠 있는지(`mongod`).
3. 사내 VPN/방화벽이 27017 포트나 SRV(DNS) 막는지. **Node가 `mongodb+srv://` 조회에 `querySrv ECONNREFUSED` 를 내면** → Atlas "Connect → Drivers"의 표준(비-SRV) `mongodb://host1,host2,host3/...?ssl=true&replicaSet=...&authSource=admin` 문자열로 바꾸면 OS DNS 를 타서 해결됨.

### 🔴 `npm install` / `npm run build` 인증서(cert) 오류
→ VPN 의 사내 루트 CA 때문. **`NODE_OPTIONS=--use-system-ca`** 설정 후 새 터미널.

### 🔴 구글 로그인 안 됨 / 콜백 실패
1. Google Cloud Console → OAuth 클라이언트 → **승인된 리디렉션 URI** 에 `http://localhost:4000/api/auth/google/callback` 정확히 등록됐는지.
2. `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` 가 그 클라이언트 값과 일치하는지.
3. OAuth 동의 화면이 "테스트" 상태면 **테스트 사용자에 본인 이메일** 추가.

### 🔴 로그인은 되는데 자꾸 "토큰이 유효하지 않습니다"
→ **JWT_SECRET 이 재시작마다 바뀌는 경우.** `.env` 에 고정값으로 박아둘 것.

### 🔴 CORS 에러 (브라우저 콘솔)
→ `backend/.env` 의 `FRONTEND_URL` 이 `http://localhost:3000` 인지, 프론트 포트와 일치하는지 확인.

### 🟡 포트 충돌
→ 백엔드 4000 / 프론트 3000. 점유 시 해당 프로세스 종료 후 재시작. 포트 바꾸면 OAuth 리디렉션 URI·CORS·`NEXT_PUBLIC_API_URL` 도 같이 갱신.

---

## 4. 자주 빼먹는 것 (체크)
- [ ] `backend/.env` + `frontend/.env.local` **둘 다** 생성
- [ ] OAuth 승인된 리디렉션 URI 등록
- [ ] JWT_SECRET 고정 유지
- [ ] (Atlas) 현재 IP 등록

---

## 5. 구조 한눈에
```
frontend/  Next.js App Router
  src/app/        라우트 (로그인 / dashboard / friends / tiers(그룹) / rooms(모임) / tools/leave(연차) / admin / u/[userId] / auth/callback)
  src/components/ 공용 (Nav · Calendar=FullCalendar · AvailabilityCalendar · DatePicker · AccountDrawer · LegalModal · CopyButton)
  src/lib/        api.ts(fetch+토큰) · types.ts · format.ts · brand.ts · leave.ts(연차 알고리즘) · holidays.ts
backend/   Express(ESM)
  src/routes/     auth · events · friends · tiers(그룹) · rooms(모임) · calendar · admin
  src/models/     User · Friendship · Tier(그룹) · Room(모임) · Event
  src/middleware/ auth.js(requireAuth) · admin.js(requireAdmin)
  src/middleware/ auth.js(requireAuth)
  src/config/     db.js · passport.js(Google)
docs/      PLAN.md(로드맵·할 일) · refactoring-guide.md · ONBOARDING.md(이 문서)
CLAUDE.md  공통 작업 규칙 (모든 세션이 읽음)
루트        package.json — `npm run dev` 로 backend+frontend 동시 실행(concurrently)
```

## 6. 어디서 뭘 고치나
- 데이터 모델·기능 로드맵·다음 작업 → [`PLAN.md`](PLAN.md)
- 코드 정리/리팩토링 절차 → [`refactoring-guide.md`](refactoring-guide.md)
- 작업 규칙·컨벤션 → [`../CLAUDE.md`](../CLAUDE.md)
- 환경변수 전체 → `backend/.env.example`, `frontend/.env.local.example`
