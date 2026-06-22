# CLAUDE.md — Moim 공통 작업 규칙

> 모든 세션(사람·에이전트)이 이 파일을 먼저 읽고 따른다.
> 살아있는 할 일/상태·기능 로드맵·데이터 모델은 **[docs/PLAN.md](docs/PLAN.md)** 가 단일 출처. 리팩토링 절차는 **[docs/refactoring-guide.md](docs/refactoring-guide.md)**, 셋업·트러블슈팅은 **[docs/ONBOARDING.md](docs/ONBOARDING.md)**, 실행 요약은 **[README.md](README.md)** 참조.
> **새 세션은 작업 시작 전 docs/PLAN.md 의 "현재 상태"와 "다음 작업" 절을 반드시 확인할 것.**

## 프로젝트 개요
- **Moim** — 친구들과 스케줄을 공유하고, 함께 비는 시간을 찾아 모임·여행을 잡는 소셜 캘린더.
- 스택: 프론트 **Next.js(App Router) + React 18 + TypeScript + SCSS** (`frontend/`, 달력 UI는 **FullCalendar**), 백 **Node + Express(ESM) + MongoDB(Mongoose)** (`backend/`).
- 인증: **Google OAuth** (백엔드 passport-google-oauth20) → 백엔드가 **JWT** 발급, 프론트는 `Authorization: Bearer` 헤더로 호출.
- 핵심 개념: 일정 가시성 = **일정별 공유(public)/비공개(private)** × **그룹(Tier)**. 공유=친구 모두 상세, 비공개=선택 그룹 멤버만 상세(그 외 "바쁨"). 그룹은 사용자가 만들고 이메일/코드로 멤버 추가. (UI 표기는 '그룹', 코드 식별자는 `Tier`)

## 작업 방식
- **기억에 의존하지 말 것** — 변수·타입·API 계약·시그니처는 추측 말고 실제 소스에서 확인 후 사용.
- **정밀 수정** — 요청 범위만. 무관한 리팩토링/포맷팅 금지, 기존 스타일을 따른다.
- **단순성 우선** — 최소 코드. 요청하지 않은 기능·추상화·"미래 대비" 추가 금지. (MVP 단계)
- **검증 가능한 목표 + 셀프 검증** — 빌드/검증이 통과할 때까지 확인·수정. 검증 단계를 건너뛰지 않는다.
- **자율 실행** — 결정적으로 진행, 확인 프롬프트 최소화. 단 **설계가 여러 갈래로 갈리는 결정**만 질문.
- **죽은 코드** — 본인 변경으로 생긴 것만 제거. 기존 데드코드는 보고만.

## 코드 컨벤션
- **네이밍은 브랜드 비종속(generic)** — 코드 식별자(클래스·함수·변수·파일명)에 브랜드명 금지. 프론트 전역 클래스는 `app-*` 접두사. 브랜드는 **사용자 노출 텍스트에만**, 단일 출처 `frontend/src/lib/brand.ts` 의 `BRAND_NAME`(=`NEXT_PUBLIC_BRAND_NAME` 오버라이드)로 렌더.
- **TS**: `any` 지양 — props·API 응답·상태에 명시적 인터페이스(`src/lib/types.ts`). `as` 캐스팅 최소화.
- **스타일**: 인라인 `style={{}}` 지양. 색·치수는 `globals.scss` 의 `--color-*`/`--radius-*`/`--space-*` 토큰. 컴포넌트 전용 스타일이 커지면 `Foo.module.scss` 동거.
- **백엔드**: 에러 응답은 `{ ok:false, message }` + 적절한 status. `:id` 라우트는 `mongoose.Types.ObjectId.isValid()` 선행. 입력 검증은 라우트에서(서버가 최종 검증).
- **API 응답 형태**: 성공도 `{ ok:true, ...payload }` 로 통일.

## 빌드 · 검증
- 프론트: `npm run build` (= `next build`, tsc 타입체크 포함). 백엔드: 변경 파일 `node --check <file>`.
- ⚠️ **`next dev` 실행 중 `next build` 금지** — 같은 `.next/` 를 동시에 써서 dev 가 깨짐(`Cannot find module './###.js'`). 빌드하려면 dev 중지 후 실행. 타입만 볼 땐 `npx tsc --noEmit`(`.next` 미접촉, dev 와 공존 가능).
- **VPN 환경에서 npm 은 `NODE_OPTIONS=--use-system-ca` 필요** (없으면 cert 오류).
- 빌드 산출물(`.next/` 등) 직접 수정 금지 — 소스만.
- 새 의존성 설치는 **사용자 승인 후** + `package.json` 등록.

## 커밋
- 한국어 conventional 메시지(`feat(scope): …`, `fix(...)`, `docs(...)`). 완료된 작업만, 빌드 통과 후 커밋.
- 커밋 메시지 끝에: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- 내가 변경한 파일만 명시적으로 스테이징(`git add <paths>`).
- GitHub 원격: `github.com/JungoLee/Moim` (main). main push 시 Render가 `render.yaml` Blueprint로 자동 배포(autoDeploy).

## 환경 · 시크릿
- 백엔드 시크릿은 `backend/.env` 에만: `MONGODB_URI` · `JWT_SECRET`(고정 유지) · `GOOGLE_CLIENT_ID/SECRET`. 커밋 금지(`.env.example` 제공).
- 프론트 공개 설정은 `frontend/.env.local`: `NEXT_PUBLIC_API_URL`.

## 소통
- 모든 답변·주석·커밋은 **한국어**.
- 사용자가 직접 칠 명령은 PowerShell 기준(Bash 병용 가능).

## 유지
- 새 작업 요청 → **docs/PLAN.md** 에 항목 추가. 완료 → 해당 항목 정리(살아있는 계획만 유지).
- 구조·규칙 변경 → 이 파일과 docs 최신화.
