# Moim 리팩토링 가이드

> "리팩토링해줘" 요청 시 아래 체크리스트를 **순서대로** 실행한다.
> 개별 기능 추가/수정 후에도 **관련 섹션을 점검**해 회귀를 막는다.
> 스택: Next.js(App Router)+TS+SCSS 프론트 / Node+Express(ESM)+MongoDB 백 / Google OAuth+JWT.
> **MVP 단계** — 테스트 없는 영역의 동작 변경은 보수적으로. 명백한 cleanup·타입·토큰화부터, 동작 변경은 단계별 커밋 + 수동 검증.

---

## 0. 자동 점검 원칙 (기능 추가·수정 시마다)
- [ ] 변경 모듈의 **에러 경로** — try/catch · Promise reject · fetch 실패가 빠짐없이 처리되는지 (빈 `catch {}` 금지, 최소 `console.error`)
- [ ] 새 **하드코딩 값**(색·문자열·숫자)이 생겼으면 → 토큰/상수로 분리
- [ ] 새 **의존성**이 생겼으면 → 설치 전 사용자 승인 + `package.json` 등록
- [ ] 변경과 관련된 **PLAN.md / docs/** 가 현재 코드와 일치하는지
- [ ] 빌드 통과 — 프론트 `npm run build`(tsc 포함), 백엔드 변경 파일 `node --check`
- [ ] **정밀 수정**: 요청 범위만, 무관한 리팩토링/포맷팅 금지, 기존 스타일 따르기

---

## 1. 중복 코드 제거
| 대상 | 액션 |
|------|------|
| 동일 fetch/유틸이 2곳 이상 | `lib/` 공용 함수로 통합 (예: `api()`, `formatRange()`) |
| 컴포넌트 내 직접 `fetch` | 금지 — `lib/api.ts` 의 `api<T>()` 만 사용 |
| 프론트/백 검증 중복 | 백엔드 라우트를 **최종 검증 출처**로, 프론트는 UX 검증만 |
| 반복되는 폼 입력 블록 | 공용 컴포넌트로 추출 |

---

## 2. 타입 안전성 · 버그 · 리소스 누수
| 항목 | 체크 |
|------|------|
| `any` 제거 | props·API 응답·상태는 `lib/types.ts` 인터페이스. `as` 캐스팅 최소화 |
| **useEffect cleanup** | 타이머·이벤트 리스너·AbortController 가 모든 종료 경로에서 정리되는지 |
| 빈/비JSON 응답 방어 | `res.json().catch(() => ({}))` (api.ts 패턴) — 백엔드 재시작 중 JSON 파싱 오류 방지 |
| ObjectId 검증 | `:id` 라우트에서 `mongoose.Types.ObjectId.isValid()` 선행 (잘못된 ID → 400) |
| 소유권/권한 체크 | 일정·친구 변경 시 `owner === req.userId`, 캘린더 조회 시 친구 여부·그룹(Tier) 판정 누락 없는지 |

---

## 3. 상수 · 토큰 · 메시지 중앙화
| 항목 | 액션 |
|------|------|
| 색상/치수 하드코딩 | `globals.scss` 의 `--color-*`/`--radius-*`/`--space-*` 토큰으로 |
| 인라인 스타일 | `style={{...}}` → 전역 클래스(`app-*`) 또는 CSS Module |
| 사용자 노출 문자열 | 흩어진 한국어 리터럴 모으기 (추후 i18n 도입 시 단일 출처) |
| 매직넘버 | 토큰 만료·폴링 간격·limit 등은 명명 상수 + 의미 주석 |

---

## 4. 컴포넌트 · 훅 구조
| 항목 | 액션 |
|------|------|
| 거대 페이지 컴포넌트 | 기능 단위로 분해, 데이터 페칭 로직은 커스텀 훅(`useXxx`)으로 추출 |
| API 레이어 | `lib/api.ts` 일원화 — 공통 prefix `/api`, 일관 에러 형태 `{ ok, message }` |
| SCSS 위치 | 컴포넌트 전용 = `Foo.module.scss` 동거 / 여러 곳 공유 = 전역 `app/globals.scss` |
| 오케스트레이터 원칙 | 상위 컴포넌트는 조합·import 위주, 도메인 로직은 훅/lib |

---

## 5. 가독성 · 죽은 코드
| 항목 | 체크 |
|------|------|
| 미사용 코드 | 호출 안 되는 함수·미사용 변수/import 삭제 |
| 디버그 로그 | 임시 `console.log` 제거 (의도적 에러 로그는 유지) |
| 역할 주석 | 비자명한 함수/모듈에 한 줄 주석 (왜 그렇게 하는지) |

---

## 6. 백엔드 (Express + Mongoose)
| 항목 | 체크 |
|------|------|
| 입력 검증 | POST body 타입·필수값 검증, 미들웨어 순서(`express.json` 먼저) |
| 에러 응답 일관화 | `{ ok:false, message }` + 적절한 status |
| 인증 게이트 | 보호 라우트에 `requireAuth` 적용 |
| 가시성 로직 단일화 | 친구 여부 × 일정 `visibility`(공유/비공개·`audienceTiers`) 판정은 `routes/calendar.js` 패턴 재사용 (분산 금지) |

---

## 7. 보안
| 항목 | 체크 |
|------|------|
| CORS | 와일드카드 대신 `FRONTEND_URL` 허용 출처로 제한 |
| 시크릿 | `MONGODB_URI`·`JWT_SECRET`·`GOOGLE_*` 는 `.env` 만, 커밋 금지(`.env.example` 제공) |
| JWT 전달 | 현재 URL 쿼리 + localStorage(MVP) → **운영 전 httpOnly 쿠키 전환** (PLAN Phase 8) |
| 입력/주입 | 쿼리 인젝션 방어, 사용자 입력으로 경로 만들 때 traversal 방어 |
| (추후) | rate limit · 보안 헤더(helmet) 도입 |

---

## 8. 빌드 · 검증
- [ ] 프론트: `npm run build`(= `next build`, tsc 타입체크 포함) — VPN 시 `NODE_OPTIONS=--use-system-ca`. ⚠️ **`next dev` 실행 중엔 build 금지**(같은 `.next/` 공유로 dev 깨짐) — 그때는 `npx tsc --noEmit` 으로 타입만 검증
- [ ] 미사용 로컬/import 일괄 탐지: `npx tsc --noEmit --noUnusedLocals --noUnusedParameters`
- [ ] 백엔드: 변경 파일 `node --check`, 가능하면 부팅하여 라우터 로드 확인
- [ ] 커밋 전 `git fetch` + diverge 확인 (협업/동시 세션 충돌 방지)

---

## 9. 문서 · 설정
| 항목 | 체크 |
|------|------|
| `PLAN.md` | 완료 항목 정리·새 작업 추가(살아있는 계획 유지) |
| `docs/*.md` | 구조 변경 시 최신화 |
| `.gitignore` | `.env`, `.next/`, `node_modules/` 포함 |
| `CLAUDE.md` | 규칙 경로·내용 최신인지 |

---

## 리팩토링 실행 순서
1. **중복 제거** → 2. **타입/버그/누수** → 3. **상수/토큰/메시지** → 4. **컴포넌트·훅 구조** → 5. **가독성·죽은 코드** → 6. **백엔드 검증·일관성** → 7. **보안** → 8. **빌드·검증** → 9. **문서·설정**
