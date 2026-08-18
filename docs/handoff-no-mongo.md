# 인계 — 운영은 D1 이다. MongoDB Atlas 에 접속하지 않는다

> 작성 2026-08-18 (회사 PC). **다른 PC 의 세션(사람·AI)이 Atlas 연결을 반복 시도하는 문제를 끊기 위한 문서.**
> 어떤 이유로든 Mongo 에 붙으려는 판단이 들면, 그 전에 이 문서를 근거로 중단할 것.

## 사실 (이 저장소의 현재)

- **운영 스택은 Cloudflare Workers + D1** (`worker/` + `wrangler.toml`). 서비스는 D1 로 돈다.
- `backend/`(Express + mongoose)는 **데이터 이전용으로만 보존**된 구 스택이다 — CLAUDE.md:12 명시.
  **수정 금지·실행 금지**, 삭제도 사용자 확인 전에는 금지. 여기 있는 mongoose 코드는
  "살아있는 서비스" 가 아니라 보관물이다.
- 즉 이 워크스페이스에서 mongoose 가 grep 에 걸리는 건 정상이지만, **그걸 이유로 Atlas 에
  접속하거나 `backend/` 를 기동할 이유는 없다.** (`mailWorker.js` 포함 — 켜지 말 것.)

## 그런데 왜 자꾸 붙으려 하나 — 저장소가 아니라 **그 PC 로컬 상태**가 원인이다

git 으로 넘어오지 않는 파일들이 낡은 컨텍스트를 준다. **Atlas 를 시도한 그 PC 에서** 아래를 확인·정리할 것:

1. **세션 시작 시 항상**: `git pull` → `git log -1 --oneline` → `git status`. 문서·기억보다 실제 파일이 우선.
2. 로컬 **`.env`** — PC 마다 각자 것. `backend/.env` 에 실제 `MONGODB_URI` 가 남아 있어도
   그건 이전 작업용이지, 세션이 임의로 접속해도 된다는 뜻이 아니다.
3. **`.claude/settings.local.json`** — 과거 허용 명령에 `mongoose`/`MONGODB_URI` 가 포함된 항목이 있으면 **삭제**.
4. **AI 프로젝트 메모리** — "Moim 은 Mongo 로 돈다"는 기억이 있으면 **"운영은 D1, backend/ 는 보관물"** 로 갱신.

## 🚫 금지

- `backend/` 기동(`server.js`·`mailWorker.js`)·수정·임의 삭제. Atlas 접속 시도.
- id 통일 시도 — 기존 행은 Mongo ObjectId 24-hex 승계, 신규는 `crypto.randomUUID()`. **혼재가 정상**이다.
- `worker/db.js` 의 `_id`·중첩 객체 되조립 제거 — 프론트 계약이다.

## 미결 (사용자 결정 대기)

- `backend/` 의 데이터 이전이 실제로 끝났는지 → 끝났다면 `backend/`+`render.yaml` 삭제 가능.
- Moim 이 쓰던 Atlas 클러스터가 아직 살아있는지 → 살아있다면 폐기/비밀번호 교체 여부.

## 기준 PC(2026-08-18 푸시한 쪽)와 동일하게 맞추기

1. `git pull` — 커밋된 것은 이걸로 끝. 기준 PC 워킹트리는 클린이며 origin 과 완전 일치.
2. gitignore 라 손으로 옮겨야 하는 파일: 루트 **`.dev.vars`** (값은 안전한 경로로 — 저장소 금지).
   `backend/.env` 는 보관물 전용이라 **복사 불필요** (backend 는 기동 금지).
3. `.claude/settings.local.json` 은 PC 별 설정 — 복사하지 말고, Mongo 관련 허용 항목만 삭제.

## 참고

- 프로젝트별 Mongo 실태 전수조사: `MenuManager(Tabl)/docs/handoff-mongodb-status.md` (2026-08-17)
- 이 문서는 위 미결이 정리되고 Atlas 시도가 재발하지 않음이 확인되면 삭제할 것.
