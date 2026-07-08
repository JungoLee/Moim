# Moim 핸들링 가이드 (신규자 + AI 용)

> 이 프로젝트를 처음 보는 사람도(또는 AI 가) 이 문서만 따라 셋업·실행·문제 해결할 수 있게 정리.
> 규칙은 [`../CLAUDE.md`](../CLAUDE.md), 살아있는 할 일은 [`PLAN.md`](PLAN.md), 리팩토링 절차는 [`refactoring-guide.md`](refactoring-guide.md).

## 0. 이게 뭔가
친구들과 스케줄을 공유하고 함께 비는 시간을 찾는 소셜 캘린더. **프론트** Next.js(App Router)+TS+SCSS(`frontend/`, :3000), **백** Node+Express(ESM)+MongoDB(`backend/`, :4000). 인증은 **Google OAuth 또는 이메일 코드**(12자리 OTP) → 백엔드 JWT 발급 → 프론트가 `Authorization: Bearer` 로 호출.

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
| 8 | (선택) `backend/.env` 의 **SMTP_HOST/PORT/USER/PASS** | Gmail + 앱 비밀번호 | 이메일 코드가 메일 대신 백엔드 콘솔에만 출력 |

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

### 🟡 이메일 로그인 코드가 메일로 안 옴
→ 발송 경로 확인. **로컬**: `backend/.env` 의 SMTP 설정이 있으면 즉시 발송, 없으면 백엔드 콘솔에 코드 출력. **운영**: Render free 는 SMTP 차단이라 서버가 직접 발송 못 함 — 로컬에서 **`backend: npm run mail-worker`**(메일 전송기)를 켜두면 DB 폴링으로 대신 발송한다. 전송기도 꺼져 있으면 Render Logs 의 `[mail]` 줄에서 코드 확인 가능. (추후 Brevo `BREVO_API_KEY` 설정 시 운영 직접 발송)

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
  src/app/        라우트 (로그인 / home / dashboard / friends / tiers(그룹) / rooms(모임) / requests(시간요청) / tools/leave(연차) / admin / u/[userId] / auth/callback)
  src/components/ 공용:
                  Nav(현재탭 강조+우하단 FAB=QuickActions, FAB는 페이지가 lib/quickActions 로 액션 등록) · PageHero(탭 상단 비주얼 헤더) · Calendar=FullCalendar(월 뷰) · AvailabilityCalendar · DatePicker(block 풀폭·일정 점 표시)
                  RoomChat(모임 플로팅 채팅·말풍선·폴링) · UserProfileModal(타인 프로필 액션) · Modal(공용 모달 래퍼) · ConfirmHost(커스텀 확인창) · Toaster · Accordion(접기) · GuideHost(사용 가이드 스포트라이트 투어)
                  Select(커스텀 드롭다운) · TimeSelect(24시 시/분) · ColorPalette+ColorWheel(그룹 색) · Avatar · MemberRow(그룹·모임 멤버 행 공용) · Notice · AccountDrawer · LegalModal · CopyButton · Icon · Tooltip · AdUnit(광고)
  src/lib/        api.ts(fetch+토큰) · clipboard.ts(복사 공용) · types.ts · format.ts · brand.ts · colors.ts(그룹/일정 색) · datetime.ts(날짜·시간 유틸·HOURS/MINUTES) · marks.ts(달력 점 계산) · confirm.ts(커스텀 확인창) · quickActions.ts(FAB 액션 레지스트리) · guide.ts(사용 가이드 스텝 정의) · inapp.ts(인앱 브라우저 감지·탈출) · toast.ts(토스트) · leave.ts(연차) · holidays.ts · adsense.ts
  public/         ads.txt(애드센스 게시자 확인 → /ads.txt 로 서빙)
backend/   Express(ESM)
  src/routes/     auth · events · friends · tiers(그룹) · rooms(모임) · calendar · admin · requests(시간요청)
  src/models/     User · Friendship · Tier(그룹) · Room(모임) · Event · TimeRequest(시간요청) · LoginCode(이메일 코드)
  src/middleware/ auth.js(requireAuth — 사용자 존재까지 확인) · admin.js(requireAdmin)
  src/config/     db.js · passport.js(Google)
  src/utils/      jwt.js · mailer.js(SMTP 발송, 미설정 시 콘솔) · admins.js(기본 관리자 판정)
docs/      PLAN.md(로드맵·할 일) · refactoring-guide.md · ONBOARDING.md(이 문서) · PLAN_others.md(⚠️ Moim 무관 별도 프로젝트 계획, 새 레포 분리 전 임시 보관)
CLAUDE.md  공통 작업 규칙 (모든 세션이 읽음)
루트        package.json(`npm run dev`=두 서버 동시 실행, concurrently) · render.yaml(Render 배포 Blueprint)
```

## 6. 어디서 뭘 고치나
- 데이터 모델·기능 로드맵·다음 작업 → [`PLAN.md`](PLAN.md)
- 코드 정리/리팩토링 절차 → [`refactoring-guide.md`](refactoring-guide.md)
- 작업 규칙·컨벤션 → [`../CLAUDE.md`](../CLAUDE.md)
- 환경변수 전체 → `backend/.env.example`, `frontend/.env.local.example`

---

## 7. 배포 (Render)
운영은 **Render**에 루트 `render.yaml` **Blueprint**로 배포. web 서비스 2개 + MongoDB Atlas.

| 서비스 | rootDir | build | start | URL |
|---|---|---|---|---|
| `moim-api`(백) | `backend` | `npm install` | `npm start` | https://moim-api.onrender.com |
| `moim-web`(프론트, SSR) | `frontend` | `npm install && npm run build` | `npm start` | https://moim-web.onrender.com |

- **배포 방법**: Render → New → Blueprint → `JungoLee/Moim` 선택 → 시크릿(`MONGODB_URI`·`JWT_SECRET`·`GOOGLE_CLIENT_SECRET`·`SMTP_PASS`) 입력 → Apply. 이후 `main` push 시 **autoDeploy**.
- **시크릿만** `sync:false`(대시보드 입력), 공개값(URL·`GOOGLE_CLIENT_ID`·`NEXT_PUBLIC_API_URL`)은 `render.yaml`에 명시.
- **Atlas Network Access**: Render outbound IP 대역(서비스 → Connect → Outbound)을 화이트리스트에 추가해야 백엔드가 DB에 붙음. 빠지면 `moim-api`가 DB 연결 실패로 죽고 `/api/health`가 503.
- **구글 콘솔**: 운영 콜백 `https://moim-api.onrender.com/api/auth/google/callback`을 OAuth 클라이언트 "승인된 리디렉션 URI"에 추가.
- **콜드스타트**: free 플랜은 15분 무트래픽 시 슬립 → 첫 요청 ~50s 지연.
- **AdSense**(선택): `NEXT_PUBLIC_ADSENSE_CLIENT`(`ca-pub-…`) 설정 시 광고 로드. `public/ads.txt`가 `/ads.txt`로 서빙됨(게시자 확인). 미설정이면 광고 비활성.

> Next.js(SSR)라 프론트는 정적 사이트가 아닌 **web 서비스**(자체 `next start`)로 배포 → 그래서 백/프론트 2개로 분리.
