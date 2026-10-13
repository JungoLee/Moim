# 운영 노트 — 배포한 서비스를 다룰 때 알아야 할 것

> 운영 규칙·주의사항만 모았다. 셋업·트러블슈팅은 [ONBOARDING.md](ONBOARDING.md), 할 일은 [PLAN.md](PLAN.md).

---

## 0. 지금 구조를 한 문장으로

> **`moim.opnae.com` 요청이 오면 워커 하나가 다 받는다.** 주소가 `/api/…` 면 워커 코드가 D1 을 읽어 JSON 을 주고, 아니면 미리 빌드해 둔 HTML/JS 파일(`frontend/out`)을 그대로 준다.

잠들지 않고(콜드스타트 없음), 켜고 끌 것도 없다. 대신 "서버에 들어가서 로그 보기" 같은 게 없어서 확인은 전부 명령어로 한다(§4).

---

## 1. 이메일 코드 로그인 — 실제로 발송된다

**Resend**(`RESEND_API_KEY`, 발신 `noreply@opnae.com`)로 실제 발송한다(2026-08-18~). IP 당 하루 10통 제한(`worker/auth.js` `overMailRate`, D1 `mail_rate`)이 걸려 있다.

- 무료 쿼터는 하루 100통(Resend). 키는 **opnae 프로젝트 공용**(Gilo·MyBudget 등과 함께 쓴다) — 쿼터도 같이 쓰고, 유출 시 전 프로젝트 키를 함께 교체한다
- 발송이 안 되면: `npx wrangler tail` 로 `[mail]` 줄 확인 (키가 없으면 코드가 로그에만 찍히는 폴백은 그대로다)
- 코드 규격은 **영문 대소문자+숫자 6자, 대소문자 구분**. 사용자 문의 시 "소문자/대문자 그대로 입력"을 안내한다 — 화면은 6칸 입력이라 붙여넣기 한 번으로 채워진다

---

## 2. 헷갈리기 쉬운 운영 규칙 3가지

### ① push 한다고 배포되지 않는다
GitHub 에 올리는 것과 서비스에 반영되는 것은 **별개**다.

```powershell
npm run worker:deploy     # 이걸 해야 실제 사이트가 바뀐다 (빌드 + 배포)
```

`git push` 는 코드 보관일 뿐이다. (자동 배포로 바꾸려면 → [workers-auto-deploy.md](workers-auto-deploy.md))

### ② 화면을 고쳤으면 반드시 빌드가 먼저다
사이트가 보여주는 건 `frontend/out` 폴더의 **빌드 결과물**이지 소스가 아니다.
빌드 없이 `wrangler deploy` 만 하면 **예전 화면이 그대로 올라간다.** `npm run worker:deploy` 는 빌드를 포함하므로 이걸 쓰면 안전하다.
업데이트 내역(`frontend/src/release/releases.ts`)도 빌드에 실리므로 배포 직전에 갱신한다(`release-notes` 스킬).

### ③ DB 구조를 바꾸면 배포와 별도로 적용해야 한다
- **새 표·인덱스**: `worker/schema.sql` 에 넣고(`CREATE … IF NOT EXISTS` 라 다시 돌려도 안전)

  ```powershell
  npm run db:schema          # 로컬
  npm run db:schema:remote   # 운영 ← 이걸 빠뜨리면 운영만 옛 구조로 남는다
  ```
- **이미 있는 표에 칸 추가**: `schema.sql` 로는 안 들어간다. `worker/migrations/<이름>.sql`(ALTER)을 만들어 운영에 **한 번만** 적용하고, `schema.sql` 에도 같은 칸을 넣는다(새 DB 용). 적용 전에 운영 D1 백업.

  ```powershell
  npx wrangler d1 export moim --remote --output backup/d1-YYYYMMDD-before-<이름>.sql
  npx wrangler d1 execute moim --remote --file worker/migrations/<이름>.sql
  ```
  `2026-10-renewal.sql`(칸 4개)은 2026-10-08 운영에 적용했다 — 다시 돌리면 "duplicate column" 오류로 멈춘다.
- 표를 지우고 다시 만드는 변경은 자식 표의 `ON DELETE CASCADE` 를 발동시켜 연결 행이 조용히 사라질 수 있다 — 백업·복원 계획부터 세운다.

---

## 3. 절대 하면 안 되는 것

| 하면 안 되는 것 | 무슨 일이 벌어지나 |
|---|---|
| `JWT_SECRET` 변경 | **모든 사용자가 즉시 로그아웃**된다. 로그인 유지의 근거가 이 값 하나다 |
| `backup/` 폴더 삭제(저장소 루트, gitignore) | 이관 전 Mongo 원본 스냅샷(`*.json`)과 운영 D1 백업(`d1-*.sql`)이 **여기에만** 있다(git 에 없다) |
| D1 데이터베이스 삭제 | Time Travel 로도 복구 불가 |
| `wrangler secret` 을 PowerShell 파이프로 넣기 | 개행이 섞여 값이 오염된다. 반드시 `wrangler secret bulk` 사용 (실제로 한 번 물렸다 — 자체 검증은 통과하고 외부에서 발급된 기존 JWT 만 전부 401 이 된다) |
| `scripts/mongo-to-d1-seed.mjs` 결과를 `--remote` 에 적용 | 표마다 DELETE 후 INSERT 라 운영 데이터가 이관 당시 스냅샷으로 바뀐다 |

---

## 4. 뭔가 이상할 때 보는 법

서버에 접속하는 개념이 없으므로 전부 명령어로 확인한다.

```powershell
# 실시간 로그 (에러가 여기 찍힌다. 메일 코드는 키가 없는 환경에서만 찍힌다 — 운영은 실발송)
npx wrangler tail

# 데이터 직접 조회 (운영 조회도 D1 읽기 한도에 들어간다 — 필요할 때만)
npx wrangler d1 execute moim --remote --command "SELECT COUNT(*) FROM users"

# API 전체가 정상인지 한 번에 (70항목) — 로컬 전용
# ⚠ 운영은 로그인 코드가 로그에 안 찍혀(실메일 발송) 이 검증을 돌릴 수 없다.
# ⚠ 로컬 .dev.vars 에 RESEND_API_KEY 가 있으면 검증 계정 앞으로 실제 메일이 나간다 —
#   CLAUDE.md '빌드 · 검증'의 키 없는 설정(wrangler.toml 복사본 + JWT_SECRET 만 든 .dev.vars)으로 띄운다.
npx wrangler dev > dev.log                       # 다른 창에서
node scripts/verify-api.mjs http://127.0.0.1:8790 dev.log

# 데이터를 실수로 날렸을 때 — 30일 내 아무 시점으로 복구
npx wrangler d1 time-travel info moim
npx wrangler d1 time-travel restore moim --timestamp=2026-08-13T00:00:00Z

# 누가 D1 을 많이 읽었나 (읽기 한도 경고가 왔을 때)
npx wrangler d1 insights moim --sort-by=reads --timePeriod=1d
```

---

## 5. 비용 — 지금은 전부 무료 구간

무료 한도(대략): Workers **하루 10만 요청**, D1 **저장 5GB · 하루 500만 행 읽기 · 10만 행 쓰기**.

- ⚠ D1 한도는 **Cloudflare 계정 전체 합계**다 — opnae 의 다른 앱(Gallery·Gilo 등)과 나눠 쓴다. 넘어도 과금은 없지만 매일 09:00 KST(00:00 UTC) 초기화까지 **D1 을 쓰는 앱이 전부 오류**를 낸다. 2026-10-12 다른 앱 때문에 92% 까지 찬 적이 있다
- Moim 에서 읽기가 많은 곳: 모임 방 대화 6초 폴링(방 전체를 다시 읽음)·방 30초 새로고침·모든 인증 요청의 사용자 확인 1회. 화면이 자주 부르는 API 에 COUNT·전체 읽기를 더할 땐 호출 빈도부터 본다
- 정확한 사용량은 Cloudflare 대시보드 → Workers & Pages → moim(요청), D1 → moim(읽기·쓰기)

---

## 6. 보안 부채 (지금 당장은 아니지만 알고는 있을 것)

- 로그인 토큰이 **URL 쿼리(`?token=`)로 전달**되고 localStorage 에 저장된다 → 브라우저 기록·리퍼러에 남을 수 있다. httpOnly 쿠키 전환이 정석
- Google OAuth 에 **`state` 파라미터가 없다** (CSRF 방어 미비) — 구 passport 구현부터의 문제를 그대로 옮겨왔다
- 관리자 판정은 DB `users.is_admin`. `wrangler.toml` 의 `ADMIN_EMAILS` 는 첫 가입·구글 로그인 때 그 계정의 `is_admin` 을 켜기만 한다(내리지 않는다) — 관리자를 빼려면 관리자 화면에서 회수하고 `ADMIN_EMAILS` 에서도 지운다
- 할 일·우선순위는 [PLAN.md](PLAN.md)(Phase 8 운영 보안·알려진 한계)
