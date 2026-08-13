# Cloudflare Workers + D1 이관 (2026-08-13 완료)

> Render(moim-api + moim-web) + MongoDB Atlas → **단일 Workers**(https://moim.opnae.com) + **D1**.
> 선례: `C:\workspace\MyBudget`. 이관에서 얻은 교훈은 [PLAN.md](PLAN.md) "Moim 이관에서 배운 것" 절.

## ✅ 현재 상태

| 항목 | 상태 |
|---|---|
| D1 스키마(12 테이블) | 로컬·원격 적용 완료 |
| 워커(53 라우트) | 배포 완료 |
| 프론트 정적 export | 배포 완료 (64 파일) |
| 커스텀 도메인 | `moim.opnae.com` 연결 완료(DNS 자동) |
| 시크릿 | `JWT_SECRET`·`GOOGLE_CLIENT_SECRET` 등록 완료 |
| 로컬 검증 | **57/57 통과** |
| 프로덕션 검증 | **57/57 통과** |
| **Mongo 데이터 이전** | ❌ **미완** — Atlas 클러스터가 DNS 에서 사라짐(무료 플랜 일시정지 추정). 운영 D1 은 현재 빈 상태 |

### 사용자가 해야 할 일 (남은 것)

**1. Google Cloud Console — 리디렉션 URI 추가** ⚠ *구글 로그인은 이걸 해야 동작한다*
[console.cloud.google.com](https://console.cloud.google.com) → API 및 서비스 → 사용자 인증 정보 → OAuth 2.0 클라이언트 → **승인된 리디렉션 URI** 에 추가:
- `https://moim.opnae.com/api/auth/google/callback`
- `http://localhost:8790/api/auth/google/callback` (로컬 개발용)

**2. MongoDB Atlas — 데이터 살릴지 결정**
[cloud.mongodb.com](https://cloud.mongodb.com) 에서 `Cluster0`(`yrdimyh`) 상태 확인:
- **Paused** → Resume 누르고 알려주면 백업 → D1 이전까지 진행한다(기존 로그인 세션까지 그대로 살아난다)
- **Deleted** → 복구 불가. 빈 DB 로 새로 시작(현재 상태 그대로)

**3. Render 서비스 삭제** (프로덕션 며칠 지켜본 뒤)
[dashboard.render.com](https://dashboard.render.com) → 각 서비스 → Settings → 맨 아래 **Delete Service**:
- [ ] `moim-api`
- [ ] `moim-web`
- [ ] Blueprint 자체(`Blueprints` 탭에 `moim` 이 남아 있으면 함께 삭제)
- ※ 저장소의 `render.yaml` 은 구 `backend/` 를 지울 때 함께 정리한다(PLAN.md "다음 작업")

**4. (선택) 로그인 코드 메일 발송**
현재 `BREVO_API_KEY` 미설정 → 이메일 로그인 코드가 **워커 로그에만** 출력된다(`npx wrangler tail`).
[brevo.com](https://www.brevo.com) 무료 가입(300통/일) → API 키 발급 → `npx wrangler secret put BREVO_API_KEY`.

**5. (선택) Atlas 클러스터 정리** — 데이터 이전을 끝냈거나 포기했다면 클러스터 삭제로 비용·계정 정리.

---

## 이관 기록 (아래는 작업 당시 계획·분석)

---

## 0. 분석 결과 (특수사항 판정)

### ① 프론트 — 정적 export **가능** (SSR 실사용 0건)
- 페이지 12개 전부 1행이 `'use client'`, 서버 컴포넌트 데이터 fetch 0건.
- `cookies()`/`headers()`/서버 `redirect()`/API Route/middleware/Server Action/ISR/`next/image` 전부 **0건**. 인증은 localStorage + `Authorization: Bearer` — 서버 개입 없음. OAuth 콜백도 `window.location.search` 파싱이라 정적 HTML로 동작.
- **유일한 블로커**: 동적 라우트 2개(`/rooms/[id]`, `/u/[userId]`)에 `generateStaticParams` 없음(런타임 ID라 불가능).
  → **쿼리스트링 전환**: `/rooms/detail?id=…`, `/u?id=…`. 파일 2개 이동 + 링크 생성 지점 6곳 수정. 구 경로는 워커가 301 리다이렉트(기존 초대 링크 호환).
- 결론: `@opennextjs/cloudflare` 불필요. `output: 'export'` → `frontend/out` 을 Workers assets 로 서빙.

### ② 백엔드 — Express 53개 라우트 → worker/ 수제 라우터 (MyBudget 패턴)
- 라우트 테이블 `[method, pattern, handler, requiresAuth]` + `matchPath` + `json()` 헬퍼 구조 복제.
- `fs`/`path`/`Buffer` 직접 사용 0건. Node 의존은 `crypto`(randomBytes/randomInt/createHash) 뿐 → Web Crypto 로 교체.
- passport 제거 → Google OAuth 수동 구현(fetch): auth URL 302 → code 교환(`oauth2.googleapis.com/token`) → `userinfo`. 콜백 URL 은 요청 origin 에서 유도(로컬/운영 자동).
- nodemailer 제거 → Brevo HTTP API(`sendViaBrevo`, 이미 fetch 기반)만 이식. `BREVO_API_KEY` 없으면 코드를 콘솔 출력(`wrangler tail` 로 확인) — **mailWorker.js·LoginCode 평문 코드 필드는 이관에서 제거**(PLAN.md "TEMP 제거" 항목 해소).
- Express 4 의 async 에러 미포착 버그는 라우터 루프 try/catch 로 자연 해소.

### ③ DB — Mongo 7 컬렉션 → D1 12 테이블
| Mongo | D1 |
|---|---|
| User (leave 중첩) | `users` (leave_* 평탄화) |
| Event (+audienceTiers[], origin 중첩) | `events` (origin_* 평탄화) + `event_audience_tiers` |
| Friendship | `friendships` (UNIQUE(requester,recipient)) |
| Tier (+members[]) | `tiers` + `tier_members` |
| Room (+members[], availabilities[][], comments[]) | `rooms` + `room_members` + `room_availability_marks`(UNIQUE(room_id,user_id,date)) + `room_comments` |
| TimeRequest | `time_requests` |
| LoginCode (Mongo TTL) | `login_codes` — TTL 은 요청 시 만료행 DELETE 로 대체(크론 불필요) |

- **ID 전략(핵심)**: 기존 문서의 ObjectId 24-hex 를 **TEXT PK 로 그대로 유지**, 신규 행은 `crypto.randomUUID()`.
  → 매핑 테이블 불필요 + **기존 JWT(`sub`=ObjectId)가 그대로 유효** = 로그인 유지.
- 날짜는 TEXT ISO8601 UTC. 불리언은 INTEGER 0/1. 다중 쓰기는 `db.batch()`.
- `ObjectId.isValid` 22곳 → D1 은 TEXT 라 캐스팅 에러가 없음. 형식 검증은 간단한 가드로 축소.

### ④ 인증/권한 체크리스트 (요청사항별)
- **JWT_SECRET**: `backend/.env` 의 기존 값을 그대로 `wrangler secret put JWT_SECRET`. HS256 + `{sub}` + 30d 유지 → 기존 토큰 호환.
- **jsonwebtoken → jose** (Workers 호환, 사용자 지정). 유일한 신규 런타임 의존성.
- **CORS 제거**: 같은 도메인이므로 삭제. 쿠키는 원래 미사용(확인됨) — 재확인 불필요.
- **Node 전용 API**: crypto 계열 6곳 → Web Crypto. `process.env` 모듈 최상위 평가(`utils/admins.js`) → `env` 파라미터 주입으로 리팩터.
- **시크릿**: `JWT_SECRET`·`GOOGLE_CLIENT_SECRET`(+`BREVO_API_KEY` 있으면) = wrangler secret. `GOOGLE_CLIENT_ID`·`ADMIN_EMAILS` = wrangler.toml `[vars]`. `FRONTEND_URL`·`GOOGLE_CALLBACK_URL`·`MONGODB_URI`·SMTP* 는 소멸. 로컬은 `.dev.vars`(gitignore).

---

## 1. 목표 구조

```
Moim/
├── wrangler.toml            name=moim, custom_domain=moim.opnae.com,
│                            assets=./frontend/out, run_worker_first=["/api/*","/rooms/*","/u/*"],
│                            D1 binding DB, dev port 8790
├── worker/
│   ├── index.js             라우터(53 라우트) + 구경로 301 + ASSETS 폴백
│   ├── http.js  auth.js(jose+requireAuth)  google.js(OAuth)  mailer.js(Brevo)
│   ├── db.js                id/검증/공용 쿼리 헬퍼
│   ├── {events,friends,calendar,tiers,rooms,requests,admin}.js
│   └── schema.sql           멱등(CREATE TABLE IF NOT EXISTS)
├── scripts/
│   ├── mongo-backup.mjs     Mongo 전체 → backup/*.json (gitignore)
│   └── mongo-to-d1-seed.mjs backup/*.json → worker/seed.sql (gitignore)
├── frontend/                output:'export' → out/
└── backend/                 프로덕션 안정 확인 후 삭제 예정 (PLAN.md 에 기록)
```

## 2. 실행 순서 (단계별 커밋)

1. **백업** — `scripts/mongo-backup.mjs` 로 7 컬렉션 전체 → `backup/*.json` (커밋: 스크립트만)
2. **스키마** — `worker/schema.sql` + wrangler.toml + 로컬 D1 적용 (`feat(infra): D1 스키마`)
3. **워커** — worker/ 전체 재작성 (`feat(worker): Express → Workers 라우터 이식`)
4. **프론트** — output:'export' + 동적 라우트 2개 쿼리스트링 전환 + API_BASE 상대경로 (`feat(front): 정적 export 전환`)
5. **데이터** — seed 스크립트 → 로컬 D1 적용 → **wrangler dev 검증**(로그인→CRUD→목록) (`feat(scripts): Mongo→D1 이전 스크립트`)
6. **배포** — 원격 D1 생성·스키마·시드·시크릿 → `wrangler deploy` → 프로덕션 curl 검증
7. **문서** — CLAUDE.md·README·docs 갱신 + Render 삭제 체크리스트 (`docs: 이관 완료`)

## 3. 사용자가 직접 해야 하는 것
→ 문서 상단 "사용자가 해야 할 일" 절로 이동(완료 시점 기준으로 정리됨).

## 4. 리스크 / 유의

- 도메인이 바뀌므로(onrender.com → moim.opnae.com) 기존 공유 링크는 어차피 끊김 — 구 경로 301 은 새 도메인 내 형식 호환용.
- AdSense 심사 URL(PLAN.md Phase 8)은 새 도메인으로 진행하면 됨.
- `attempts`·60초 쿨다운 등 로그인 코드 제한은 D1 행 기반이라 그대로 이식됨.
- 탈퇴 cascade 는 FK `ON DELETE CASCADE` 로 대체(기존 TimeRequest 고아 버그도 함께 해소).
