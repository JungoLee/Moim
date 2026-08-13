# Moim 핸들링 가이드 (신규자 + AI 용)

> 이 프로젝트를 처음 보는 사람도(또는 AI 가) 이 문서만 따라 셋업·실행·문제 해결할 수 있게 정리.
> 규칙은 [`../CLAUDE.md`](../CLAUDE.md), 살아있는 할 일은 [`PLAN.md`](PLAN.md), 리팩토링 절차는 [`refactoring-guide.md`](refactoring-guide.md), 인프라 이관 배경은 [`cf-migration.md`](cf-migration.md).

## 0. 이게 뭔가
친구들과 스케줄을 공유하고 함께 비는 시간을 찾는 소셜 캘린더.
**단일 Cloudflare Workers 배포** — https://moim.opnae.com. `/api/*` 는 워커(`worker/`), 그 외 경로는 Next.js 정적 export 산출물(`frontend/out`)을 같은 워커가 서빙한다. DB 는 **D1**(바인딩 `env.DB`).
인증은 **Google OAuth 또는 이메일 코드**(12자리 OTP) → 워커가 JWT 발급 → 프론트가 `localStorage` 에 담아 `Authorization: Bearer` 로 호출.

> `backend/`(구 Express + MongoDB)는 **삭제 예정 잔재**다 — 데이터 이전·Atlas 삭제까지 끝나 실행 자체가 불가능하다. 고치지 말 것.

---

## 1. 빠른 시작 (로컬)

```powershell
$env:NODE_OPTIONS="--use-system-ca"   # VPN 환경에서만
npm run install:all                   # 루트 + frontend 의존성

# .dev.vars 파일 생성 (gitignore) — §2 참조
npm run db:schema                     # 로컬 D1 에 스키마 적용 (최초 1회)

npm run build                         # frontend/out 정적 export
npm run worker:dev                    # http://localhost:8790  ← API + 프론트 한 곳
```

프론트만 빠르게 고칠 땐 `cd frontend; npm run dev`(:3000, HMR). 단 이 모드에서는 API 호출이 3000 포트로 나가 실패하므로, **API 가 필요하면 위 `worker:dev` 방식**을 쓴다.

> Windows + VPN 이면 새 터미널마다 `NODE_OPTIONS` 가 필요. 영구 적용은 `setx NODE_OPTIONS "--use-system-ca"` (새 터미널부터).

---

## 2. 사전조건 체크리스트 (하나라도 빠지면 안 됨)

| # | 항목 | 어디 | 빠지면 증상 |
|---|------|------|------------|
| 1 | **`npx wrangler login`** 완료 | Cloudflare 계정 | D1·배포 명령 전부 실패 |
| 2 | 루트 **`.dev.vars`** 에 `JWT_SECRET` | 임의 랜덤 문자열, **한 번 정하면 고정** | 로그인 세션이 매번 만료 |
| 3 | 루트 **`.dev.vars`** 에 `GOOGLE_CLIENT_SECRET` | Google Cloud Console OAuth | 구글 로그인 실패 |
| 4 | `wrangler.toml` `[vars]` 의 **GOOGLE_CLIENT_ID** | (이미 커밋돼 있음) | 구글 로그인 실패 |
| 5 | OAuth **승인된 리디렉션 URI** 2개 등록 | Google Cloud Console | 콜백에서 `redirect_uri_mismatch` |
| 6 | **NODE_OPTIONS=--use-system-ca** (VPN) | 환경변수 | npm install/build 인증서 오류 |
| 7 | **로컬 D1 스키마 적용**(`npm run db:schema`) | 최초 1회 | 모든 API 가 500 |

**5번 리디렉션 URI** — 둘 다 등록해야 한다:
- `https://moim.opnae.com/api/auth/google/callback` (운영)
- `http://localhost:8790/api/auth/google/callback` (로컬)

`.dev.vars` 예시 (**커밋 금지**):
```
JWT_SECRET=<운영과 동일한 고정 문자열>
GOOGLE_CLIENT_SECRET=<구글 클라이언트 비밀번호>
```

---

## 3. 트러블슈팅 — "에러나면 여기부터 의심"

### 🔴 모든 API 가 500
→ D1 스키마 미적용. `npm run db:schema`(로컬) / `npm run db:schema:remote`(운영). 워커 로그는 `npx wrangler tail`(운영) 또는 dev 콘솔.

### 🔴 `npm install` / `npm run build` 인증서(cert) 오류
→ VPN 의 사내 루트 CA 때문. **`NODE_OPTIONS=--use-system-ca`** 설정 후 새 터미널.

### 🔴 구글 로그인 안 됨 / 콜백 실패
1. **승인된 리디렉션 URI** 에 지금 접속 중인 origin 의 콜백이 정확히 등록됐는지(§2-5). 워커는 **요청 origin 에서 콜백 URL 을 유도**하므로 포트가 다르면 다른 URI 가 된다.
2. `GOOGLE_CLIENT_ID`(wrangler.toml) / `GOOGLE_CLIENT_SECRET`(시크릿)이 **같은 클라이언트**의 값인지.
3. OAuth 동의 화면이 "테스트" 상태면 **테스트 사용자에 본인 이메일** 추가.
4. 워커 로그에 `[auth] 구글 로그인 실패:` 가 찍히므로 원인 메시지 확인.

### 🔴 로그인은 되는데 자꾸 "토큰이 유효하지 않습니다"
→ **JWT_SECRET 불일치.** 로컬 `.dev.vars` 와 운영 시크릿이 다르면 서로의 토큰을 못 읽는다. 운영 시크릿을 바꾸면 **전체 사용자가 로그아웃**된다.

### 🟡 이메일 로그인 코드가 메일로 안 옴
→ `BREVO_API_KEY` 가 없으면 **발송하지 않고 워커 로그에만 출력**한다(정상 동작).
- 로컬: `wrangler dev` 콘솔의 `[mail] … 로그인 코드: XXXX`
- 운영: `npx wrangler tail` 로 같은 줄 확인
- 실제 발송하려면 [brevo.com](https://www.brevo.com) 무료 가입 후 `npx wrangler secret put BREVO_API_KEY`
- ⚠️ Workers 는 raw TCP 를 못 열어 **SMTP 는 불가능**. HTTP API 만 쓴다.

### 🟡 배포했는데 도메인이 안 잡힘
→ 로컬 DNS 의 negative cache 일 수 있다. 먼저 우회 확인:
`curl.exe -s --resolve moim.opnae.com:443:104.21.2.46 https://moim.opnae.com/api/health`
응답이 정상이면 배포는 성공이고 DNS 전파만 기다리면 된다.

### 🟡 포트 충돌
→ 워커 8790(`wrangler.toml` `[dev] port`), 프론트 dev 3000. **같은 PC 의 다른 Workers 프로젝트와 겹치면 wrangler 가 조용히 다른 포트로 옮겨가** 엉뚱한 워커를 테스트하게 되니 주의(MyBudget 8788 등).

### 🟡 정적 페이지가 404
→ `npm run build` 를 안 돌려 `frontend/out` 이 낡았을 수 있다. 새 페이지를 추가했으면 빌드 후 재배포.

---

## 4. 자주 빼먹는 것 (체크)
- [ ] `.dev.vars` 생성 (JWT_SECRET·GOOGLE_CLIENT_SECRET)
- [ ] OAuth 승인된 리디렉션 URI **2개** 등록
- [ ] JWT_SECRET 고정 유지 (바꾸면 전체 로그아웃)
- [ ] 로컬 D1 스키마 적용
- [ ] 배포 전 `npm run build` (worker:deploy 는 자동으로 포함)

---

## 5. 구조 한눈에
```
worker/    Cloudflare Workers (API)
  index.js        라우트 표 53개 + 구 동적경로 301 + ASSETS 폴백
  auth.js         JWT(jose) · requireAuth/requireAdmin · Google OAuth · 이메일 코드 · 내 정보 · 연차
  google.js       OAuth fetch (동의 URL · code 교환 · 프로필)
  mailer.js       Brevo HTTP API (키 없으면 로그 출력)
  db.js           id/시각 헬퍼 + D1 행 → 프론트 문서 형태 변환 ★계약의 단일 지점
  http.js         json()/fail() 응답 헬퍼
  events · friends · calendar · tiers · rooms · requests · admin
  schema.sql      D1 스키마 12테이블 (멱등)
frontend/  Next.js App Router (정적 export → out/)
  src/app/        라우트 (로그인 / home / dashboard / friends / tiers(그룹) / rooms · rooms/detail?id= / requests / tools/leave / admin / u?id= / auth/callback)
  src/components/ 공용:
                  Nav(현재탭 강조+우하단 FAB=QuickActions, FAB는 페이지가 lib/quickActions 로 액션 등록) · PageHero · Calendar=FullCalendar(월 뷰) · AvailabilityCalendar · DatePicker
                  RoomChat(모임 플로팅 채팅·폴링) · UserProfileModal · Modal · ConfirmHost · Toaster · Accordion · GuideHost(사용 가이드 투어)
                  Select · TimeSelect · ColorPalette+ColorWheel · Avatar · MemberRow · Notice · AccountDrawer · LegalModal · CopyButton · Icon · Tooltip · AdUnit
  src/lib/        api.ts(fetch+토큰) · clipboard · types · format · brand · colors · datetime · marks · confirm · quickActions · guide · inapp · toast · leave · holidays · adsense
  public/         ads.txt(애드센스 게시자 확인)
scripts/   verify-api.mjs(API 통합 검증 57항목) · mongo-to-d1-seed.mjs(백업 JSON → seed.sql)
backend/   ⚠️ 구 Express+Mongo — 삭제 예정 잔재(수정 금지, PLAN.md "다음 작업" 참조)
docs/      PLAN.md(로드맵·할 일) · cf-migration.md(이관) · refactoring-guide.md · ONBOARDING.md(이 문서) · PLAN_others.md
CLAUDE.md  공통 작업 규칙 (모든 세션이 읽음)
루트        wrangler.toml(도메인·assets·D1 바인딩) · .dev.vars(로컬 시크릿, gitignore) · package.json
```

## 6. 어디서 뭘 고치나
- 데이터 모델·기능 로드맵·다음 작업 → [`PLAN.md`](PLAN.md)
- API 응답 형태를 바꿔야 하면 → `worker/db.js` (프론트 계약의 단일 지점)
- 코드 정리/리팩토링 절차 → [`refactoring-guide.md`](refactoring-guide.md)
- 작업 규칙·컨벤션 → [`../CLAUDE.md`](../CLAUDE.md)

---

## 7. 배포 (Cloudflare Workers + D1)

```powershell
# 최초 1회
npm run db:schema:remote                        # 원격 D1 스키마
npx wrangler secret put JWT_SECRET              # 운영 값 (고정 유지)
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put BREVO_API_KEY           # (선택) 메일 발송

# 배포
npm run worker:deploy                           # = npm run build && wrangler deploy
```

- **커스텀 도메인**: `wrangler.toml` 의 `routes = [{ pattern = "moim.opnae.com", custom_domain = true }]` — wrangler 가 **DNS 레코드와 인증서를 자동 생성**한다(수동 CNAME 불필요).
- **`run_worker_first`**: `/api/*`·`/rooms/*`·`/u/*` 는 SPA 폴백보다 워커가 먼저 받아야 한다. 빠지면 API 요청에 `index.html` 이 돌아오고 구 경로 301 이 안 먹는다.
- **배포 후 검증**: `npx wrangler tail` 을 파일로 띄운 뒤
  `node scripts/verify-api.mjs https://moim.opnae.com <로그파일>` → 57 항목 전부 PASS 확인. (검증 계정·데이터는 스크립트가 스스로 지운다)
- **D1 직접 조회**: `npx wrangler d1 execute moim --remote --command "SELECT COUNT(*) FROM users"`
- **AdSense**(선택): `frontend/.env.local` 의 `NEXT_PUBLIC_ADSENSE_CLIENT`(`ca-pub-…`) 설정 후 재빌드·재배포. 빌드 타임에 인라인되므로 값 변경 시 반드시 다시 빌드.
- **콜드스타트 없음** — Workers 는 잠들지 않는다(Render free 의 ~50s 지연이 사라진 이유).
