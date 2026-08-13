# 운영 노트 — 이관 후 알아야 할 것

> Workers + D1 로 옮긴 뒤 **운영 방식이 바뀐 부분**만 모았다. 셋업·트러블슈팅은 [ONBOARDING.md](ONBOARDING.md), 할 일은 [PLAN.md](PLAN.md).

---

## 0. 지금 구조를 한 문장으로

> **`moim.opnae.com` 요청이 오면 워커 하나가 다 받는다.** 주소가 `/api/…` 면 워커 코드가 D1 을 읽어 JSON 을 주고, 아니면 미리 빌드해 둔 HTML/JS 파일을 그대로 준다.

예전엔 **서버 2개(프론트·백) + DB 1개 = 3덩어리**였고, 각각 켜져 있어야 했다.
지금은 **1덩어리**다. 잠들지 않고, 켜고 끌 것도 없다. 대신 "서버에 들어가서 로그 보기" 같은 게 없어져서, 확인은 전부 명령어로 한다(§4).

---

## 1. ⚠️ 지금 실제로 안 되는 것

### 이메일 코드 로그인 — 코드가 사용자에게 가지 않는다
"인증 코드를 보냈어요" 라고 화면엔 뜨지만 **메일이 실제로 발송되지 않는다.** 코드는 서버 로그에만 찍힌다.

- **원인**: 메일 발송에 `BREVO_API_KEY` 가 필요한데 아직 안 넣었다. (Workers 는 SMTP 를 못 써서 HTTP API 만 가능 — Gmail 계정 정보로는 안 된다)
- **지금 코드 확인하는 법**: `npx wrangler tail` 을 켜 둔 채로 사용자가 요청하면 `[mail] … 로그인 코드: XXXX` 가 찍힌다
- **구글 로그인은 정상이다.** 즉 지금 남에게 공유해도 구글 계정만 있으면 쓸 수 있다
- **고치는 순서** (순서가 중요): ① 레이트 리밋 먼저 → ② Brevo 키 등록
  레이트 리밋 없이 키부터 넣으면 이메일 주소만 바꿔가며 호출해 **하루 300통 무료 쿼터가 소진**된다 (PLAN.md 참조)

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

### ③ DB 구조를 바꾸면 배포와 별도로 적용해야 한다
`worker/schema.sql` 을 고쳤다면:

```powershell
npm run db:schema          # 로컬
npm run db:schema:remote   # 운영 ← 이걸 빠뜨리면 운영만 옛 구조로 남는다
```

---

## 3. 절대 하면 안 되는 것

| 하면 안 되는 것 | 무슨 일이 벌어지나 |
|---|---|
| `JWT_SECRET` 변경 | **모든 사용자가 즉시 로그아웃**된다. 로그인 유지의 근거가 이 값 하나다 |
| `C:\workspace\Moim\backup\` 삭제 | Mongo 를 지웠으므로 **이 폴더가 유일한 원본 스냅샷**이다(git 에 없다). D1 이 아니라 "이관 전 원본"이 사라진다 |
| D1 데이터베이스 삭제 | Time Travel 로도 복구 불가 |
| `wrangler secret` 을 PowerShell 파이프로 넣기 | 개행이 섞여 값이 오염된다. 반드시 `wrangler secret bulk` 사용 (실제로 한 번 물렸다) |

---

## 4. 뭔가 이상할 때 보는 법

서버에 접속하는 개념이 없으므로 전부 명령어로 확인한다.

```powershell
# 실시간 로그 (에러·메일 코드가 여기 찍힌다)
npx wrangler tail

# 데이터 직접 조회
npx wrangler d1 execute moim --remote --command "SELECT COUNT(*) FROM users"

# API 전체가 정상인지 한 번에 (57항목)
npx wrangler tail --format pretty > tail.log     # 다른 창에서
node scripts/verify-api.mjs https://moim.opnae.com tail.log

# 데이터를 실수로 날렸을 때 — 30일 내 아무 시점으로 복구
npx wrangler d1 time-travel info moim
npx wrangler d1 time-travel restore moim --timestamp=2026-08-13T00:00:00Z
```

---

## 5. 비용 — 지금은 전부 무료 구간

무료 한도(대략): Workers **하루 10만 요청**, D1 **저장 5GB · 하루 500만 행 읽기 · 10만 행 쓰기**.
현재 데이터가 **440KB, 사용자 5명** 이라 한도의 0.01% 수준이다. 정확한 사용량은 Cloudflare 대시보드 → Workers & Pages → moim 에서 볼 수 있다.
Render 유료(월 $7)로 갈 이유가 없어졌고, **콜드스타트(첫 접속 50초 지연)도 사라졌다**.

---

## 6. 아직 안 한 것 (놓치기 쉬운 순서)

1. **브라우저에서 실제로 써보기** — API 는 자동 검증했지만 구글 로그인 팝업·모임 만들기를 사람이 확인한 적이 없다. 가장 먼저 할 일
2. **검색 등록** — SEO 코드는 넣었지만 구글에 "우리 사이트 있다"고 알리지 않으면 **검색에 아예 안 나온다**. Search Console 등록이 시작점 (PLAN.md Phase 8-1)
3. **레이트 리밋 → Brevo 키** — 위 §1 순서대로
4. **구 `backend/` 삭제** — Mongo 가 사라져 이제 실행 자체가 안 되는 죽은 코드다
5. **에러 알림 없음** — 지금은 사용자가 말해주기 전엔 장애를 모른다. 필요해지면 Cloudflare 알림 또는 Logpush 검토

---

## 7. 보안 부채 (지금 당장은 아니지만 알고는 있을 것)

- 로그인 토큰이 **URL 쿼리(`?token=`)로 전달**되고 localStorage 에 저장된다 → 브라우저 기록·리퍼러에 남을 수 있다. httpOnly 쿠키 전환이 정석
- Google OAuth 에 **`state` 파라미터가 없다** (CSRF 방어 미비) — 구 passport 구현부터의 문제를 그대로 옮겨왔다
- 관리자 판정이 **이메일 하드코딩**(`wrangler.toml` 의 `ADMIN_EMAILS`)이다. 지금 규모에선 오히려 안전한 선택이지만, 사람이 늘면 DB 기반으로 옮겨야 한다
