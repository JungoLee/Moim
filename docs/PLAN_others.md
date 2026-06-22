# PLAN_others — 글로벌 AI 사주 SaaS (별도 프로젝트)

> ⚠️ **이건 Moim과 무관한 별도 프로젝트** 계획입니다 (MyBudget 후속, 일반 사용자용 글로벌 유료 AI 사주 SaaS).
> 이어서 작업하려고 이 레포 `docs/` 에 임시 보관 — **새 레포로 분리할 때 통째로 이동**.
> 구성: ① 결정 필요 ② 확정 스펙(스택·아키텍처·스키마·가격·결제·마일스톤) ③ **리스크·선결과제(Claude 검토)** ← 진행 전 반드시 읽기.

---

## 0. 컨텍스트
- **두 프로젝트 분리**: MyBudget(기존 유지 — 프롬프트 R&D·관리자 테스트·Stellaflow 라우트) / **신규(이 문서)** — 글로벌 유료 SaaS.
- **핵심 요구**: Google 로그인(스텔라 코드/쿠폰 폐기) · 결제(KR+글로벌) · 화이트리스트 ON/OFF(관리자 토글) · 다국어 ko/en/fr/ja/zh · 모바일 출시(5~6개월차) · 개인정보/약관 공개 페이지.
- **MyBudget 재사용 자산**: `saju-calculator.js`(만세력) · `prompts/stellaflow-system.md`(22섹션) · `prompts/stellaflow-compatibility.md` · `shared/result-renderer.js` · `worker.js`(병렬·큐 클레임·CLI 호출) · i18n(`FORM_I18N`, `RENDERER_I18N`).

---

## 1. 결정 필요 (즉시 — 진행 게이트)
- [ ] **프로젝트 이름** / **도메인** (`.com` $9.15 / `.io` / `.app`)
- [ ] **개인정보 보호책임자(DPO)**: 이름(공개)·이메일(공개)·연락처
- [ ] **워커 DB 분리**: A. 별도 database(추천, Atlas 동일 클러스터) / B. 컬렉션 prefix(`saju_*`)
- [ ] **첫 풀이 무료 정책**: 가입 1회? / 화이트리스트 ON이면 무료도 차단? / 어뷰저 방지(이메일별 1회)
- [ ] **모바일 출시 시점**: 웹 출시 후 3개월 시작 → 5~6개월차 출시

---

## 2. 확정 스택
| 영역 | 선택 | 이유 |
|---|---|---|
| 웹 | Vite + React + TS | SPA 정적빌드 → Capacitor 호환 |
| 모바일 | Capacitor | 웹 코드 래핑, iOS+Android 단일 코드 |
| 백엔드 | Hono **또는** Express on Railway | ⚠️ 미결정 (§리스크) |
| DB | MongoDB Atlas | 기존 코드 재사용, M0 무료 |
| 워커 | 로컬 PC (MyBudget 재사용) | Claude CLI 구독 세션 ⚠️(§리스크 1) |
| 인증 | Google Identity Services + 자체 JWT | 무료, 의존성 최소 |
| 결제 | 다중 PG 어댑터(Toss+KakaoPay+Paddle+Stripe) | 시장별 최적 ⚠️(§리스크 2) |
| 웹 호스팅 | Vercel(정적) | 무료 글로벌 CDN |
| 백 호스팅 | Railway | DX, Mongo 묶기 |
| 도메인 | Cloudflare Registrar | 원가 + DNS/WAF |
| 에러 | Sentry / 이메일 Resend | 무료 티어 |

**분리(Vercel+Railway) 이유**: 모바일 앱이 별도 API 서비스를 웹과 공유하기 위함.

---

## 3. 아키텍처 (요약)
```
단일 코드베이스(Vite+React+TS)
  ├─ Vercel (웹 SPA, 정적)
  └─ Capacitor (iOS/Android)
        └──→ Railway API (/api/auth, /payment, /readings, /admin, /webhook)
                └──→ MongoDB Atlas (users/readings/payments/settings/auditLogs)
                        ↑ poll(병렬 N)        ↑ webhook
                   로컬 PC 워커            결제 PG들
                   (Claude CLI,            (Toss/Paddle/…)
                    saju-calc, 22섹션)
```

---

## 4. DB 스키마 (MongoDB)
```js
// users
{ _id, googleId, email, name, picture, locale,
  isWhitelisted, credits, totalSpentKrw, totalSpentUsd,
  isAdmin, createdAt, lastLoginAt, deletedAt }

// readings  (기존 stellaflow_requests + _results 통합)
{ _id, userId, type:'personal'|'compatibility',
  input:{ name, gender, birthDate, birthTime, birthPlace, calendar,
          concerns, outputLanguage, partner:{...}, relation },
  status:'pending'|'processing'|'done'|'error',
  paymentId, content, partialContent, eventLog:[{t,kind,text}],
  costUsd, inputTokens, outputTokens, cacheReadTokens,
  accuracyRating, feedbackText, errorMessage, createdAt, processedAt }

// payments
{ _id, userId, pgProvider, pgTxId, pgCheckoutId, amount, currency,
  productType, creditsAdded, status, receiptUrl, country,
  createdAt, paidAt, refundedAt }

// settings (단일 'global')
{ _id:'global', whitelistEnabled, maintenanceMode,
  pricing:{ krw:{...}, usd:{...}, iap:{...} } }

// auditLogs
{ _id, actorId, actorType, action, target, payload, ip, ua, createdAt }
```

---

## 5. 가격 정책
**한국(Toss/KakaoPay/NaverPay)**: 첫 풀이 무료 / 1회 2,900 / 3회 6,900 / 10회 19,900 / 월정액 9,900
**글로벌(Paddle)**: 1회 $4.99 / 3회 $11.99 / 10회 $34.99 / 월 $9.99
**모바일 IAP(30% 흡수)**: 1회 3,900 / 3회 9,900 / 월 13,900
**원가분해(1회, 명세 기준)**: 판매 2,900 − Claude 620 − PG 184 − 인프라 30 = **순익 2,066(71%)** → ⚠️ §리스크 4에서 재계산 필요.

---

## 6. 결제 (다중 PG 어댑터 패턴)
```
backend/payments/
  PaymentAdapter.ts (인터페이스)  PaymentService.ts (라우터)
  adapters/{Toss,Paddle,Stripe}Adapter.ts
  webhooks/{toss,paddle,stripe}.ts
```
- 인터페이스: `createCheckout()` → `{checkoutUrl, pgCheckoutId}` · `verifyWebhook(req)` → `{pgTxId, status, amount, currency}` · `refund(pgTxId)`
- 결제수단 자동추천: KR → toss-kakaopay/card/naverpay → paddle; 영미일 → paddle/stripe; 그 외 → paddle
- 플로우: 상품선택 → createCheckout → PG결제 → **webhook** → verify(서명) → payments insert(**idempotency: pgTxId**) → `users.credits +=` → 알림

---

## 7. 핵심 기능 / 페이지
- **사용자**: `/`(랜딩) `/login` `/reading`(개인/궁합 탭) `/reading/:id`(중첩 탭 결과) `/account`(크레딧·이력·결제·삭제) `/pricing`(KR/해외 자동분기) `/checkout`(PG 자동추천)
- **다국어**: 표시언어(UI)/결과언어(본문) 분리, 우상단 스위처, 표시→결과 단방향 동기화, ko/en/fr/ja/zh
- **관리자 `/admin`**: 사용자 목록 · **화이트리스트 관리 + ON/OFF 토글** · 결제/환불/수동 크레딧 · readings 조회 · audit log · 통계(DAU·매출·수단별)
- **공개**: `/privacy`(PIPA+GDPR) `/terms` `/refund-policy`(7일 청약철회) `/contact`

---

## 8. 다국어 · 개인정보 · 환불 · 워커 (요약)
- **i18n**: MyBudget `FORM_I18N`/`RENDERER_I18N` 이식, 5개 언어. 표시언어 vs 결과언어 분리.
- **개인정보(PIPA+GDPR)**: 수집(구글계정·입력·결제영수증URL·자동로그) / 목적 / 보유(회원=탈퇴시, 결제=5년, 풀이=요청시 삭제, 로그=3개월) / 제3자(Anthropic·PG·Google) / 위탁·국외이전(Vercel·Railway·Atlas·Anthropic·Sentry·Resend) / 사용자 권리(열람·수정·삭제·이동) / DPO / 쿠키(인증세션만).
- **환불(전상법)**: 7일 내 + 미사용 = 전액환불, 사용 후 = 불가(디지털콘텐츠), AI 오류 = 자동 크레딧 복원.
- **워커**: 병렬(`MAX_CONCURRENT=3`), Mongo 폴링 + 원자 claim, Claude CLI, 다국어 강제. 1건 10~20분/~25k tok, 현 구성 일 200~400건. 초과 시 API 직결/다중화.

---

## 9. 마일스톤 (명세 기준 — ⚠️ 시간 추정은 §리스크에서 재검토)
1. **기반(5일)**: 레포·Vercel/Railway·Atlas·Google+JWT·보호라우트·API 골격
2. **풀이(4일)**: 입력폼(개인/궁합)·readings 큐잉·워커 신규DB 폴링·결과페이지·i18n
3. **권한(2일)**: whitelistEnabled 토글 + 미들웨어
4. **결제(7일)**: Adapter+Service → Toss → Paddle → Stripe → 추천UX/가격
5. **공개페이지(3일)**: privacy/terms/refund/랜딩
6. **관리자(4일)**: 사용자/화이트리스트/결제/audit + 통계
7. **보안(2일)**: 체크리스트·Sentry·WAF·rate limit·헤더
8. **출시(1일)**: ZAP·도메인·OAuth 등록 → **웹 출시**
9. **모바일(3개월차~)**: Capacitor·IAP·푸시·심사 → **모바일 출시**
> 명세 목표: 웹 ~4주 / 모바일 5~6개월.

---

## 10. 비용·매출·KPI (요약)
- **운영비/월**: 0~1k MAU $25 → 1~5k $125 → 5~20k $280 → 20k+ $1,150~
- **매출/월(KR, 1.5회 가정)**: 100명 ~30만 / 1k ~300만 / 10k ~3,000만 / 100k ~3억
- **BEP ≈ MAU 50명**
- **KPI**: DAU/MAU · 가입→첫결제 전환(목표 5%) · ARPU · 수단별 분포 · 정확도 평점 · 환불율(<1%)
- **알림(Sentry/Atlas)**: 에러율 1%↑ / webhook 실패 / 쿼리 5s↑ / 큐 100건 적체

---

# 11. 🔬 리스크 & 선결과제 (Claude 검토) — 진행 전 필독

## 🔴 치명적 — 빌드/과금 전 *반드시* 검증
- [ ] **1. Claude 구독 CLI로 상업 SaaS 운영 = Anthropic 약관 위반 소지.** 구독(Pro/Max)은 개인·대화형 용도 → **자동화된 유료 재판매**(일 200~400건)는 정지 위험. **상업용은 Anthropic API**로 전환 전제. (→ 4번 원가와 직결)
- [ ] **2. 결제사의 "점술/사주" 업종 수용 여부.** Paddle/Stripe acceptable use가 occult/fortune-telling을 제한할 수 있음. 글로벌 결제 전체가 Paddle 위에 있으니 **아키텍처 확정 전 PG에 업종 승인 문의**. Toss/KakaoPay도 동일.
- [ ] **3. 한국 과금 법적 선행조건 누락.** **사업자등록 + 통신판매업 신고 + 부가세(10%) 처리 + 현금영수증/세금계산서** 의무. 표시가 부가세 포함 여부, 법인/개인 형태가 모든 과금의 전제.
- [ ] **4. 단위 원가/마진 재계산.** "620원/25k tok"은 Sonnet급+구독 평탄비용 가정. **Opus급 API**면 1건 ~2,000원+(22섹션은 출력 더 큼) → 71% 마진 붕괴 가능. PG수수료·부가세 포함 **API 기준 재산출** 필수(2,900 상품 적자 점검).

## 🟠 높음 — 구조·신뢰성·법률
- [ ] **5. 로컬 PC 워커 = 단일 장애점.** 집 PC(전원·절전·가정용 인터넷·재부팅)에 유료 SLA가 묶임. + **1건 10~20분 대기**는 충동구매 UX로 김, 피크에 큐 적체(동시3). → 완료 알림(이메일/푸시)·대기 고지·API 폴백·HA 필요.
- [ ] **6. 크레딧·결제 신뢰성 구멍.** ① 크레딧 차감 시점(제출 vs 성공)+에러 자동복원 = hold→commit/release 라이프사이클 미정의. ② 멈춘 `processing` **재큐잉·하트비트·재시도·dead-letter** 없음. ③ **webhook 유실/지연 대사(reconcile) 잡 + 리턴URL 검증 백업** 없음("결제됐는데 크레딧 미충전").
- [ ] **7. 개인정보 동의 핵심 누락.** 궁합 = **제3자(상대방) 정보** 동의 문제 / **만14세 미만** 연령게이트 / **고민 텍스트=민감정보** 별도 동의 / users 스키마에 **동의 기록 필드**(약관·방침 버전, consentAt) 없음 / `deletedAt`(soft) vs **삭제권 실제 파기·익명화** + 결제 5년 보존 예외 명시.
- [ ] **8. 환불 정책 ↔ 전상법.** **묶음(3/10회) 미사용분 부분환불** 의무 가능 / **월정액 자동갱신**(사전고지·간편해지) 규정 없음.
- [ ] **9. "글로벌 Day1"이 법적 부담 곱하기.** 특히 **zh+중국 PIPL(데이터 현지화·국외이전 승인)** 초고난도, **GDPR 제27조 EU 대리인**, 일본 APPI, 미 CCPA. → **언어≠시장** 분리, 초기 KR+영어권으로 축소(zh 보류/해외화자 한정).
- [ ] **10. LLM 고유 보안 누락.** 보안 체크리스트가 웹/결제 전용 → **프롬프트 인젝션**(이름·고민 필드), 로그·프롬프트 **PII 노출**, 입출력 **콘텐츠 모더레이션** 추가.

## 🟡 중간 — 스코프·품질·스키마
- [ ] **마일스톤 과낙관**: "Day1 3개 PG"/결제7일/보안2일 비현실. → **KR PG 1개 + Paddle**로 출시, Stripe·IAP 후순위.
- [ ] **테스트/CI/스테이징 0** (돈 다루는 앱). 결제어댑터·크레딧·webhook 멱등성 자동 테스트 + **재무 대사 대시보드** 필요.
- [ ] **무료 첫 풀이 어뷰징** (Gmail 양산, 건당 −620원 손실) → 기기 핑거프린트/전화인증/결제수단 게이팅.
- [ ] **월정액 "무제한" 어뷰징** (API 종량 × 헤비유저 = 적자) → 공정사용 캡.
- [ ] **Capacitor 네이티브 현실**: 웹 GIS ≠ 네이티브 Google Sign-In(클라이언트·SHA), **IAP 영수증 서버검증**, 앱스토어 사주앱 심사·연령등급·anti-steering.
- [ ] **스키마 보강**: readings에 **promptVersion·model**(품질클레임 추적), users **동의 필드**, **refresh토큰/블랙리스트 저장소**, **admin 부트스트랩 + settings 'global' 시드**.
- [ ] **Hono vs Express 미결정**(미들웨어 생태계) · **JS 자산→TS** 이관 전략.
- [ ] **Webhook raw-body 함정**: `express.json()`이 서명검증 깨뜨림 → webhook 라우트 raw body 파서.
- [ ] **획득(마케팅)·SEO 부재**: 매출 시뮬은 MAU 가정인데 **CAC·유입 채널·SEO** 없음.
- [ ] **면책 고지**: "엔터테인먼트용, 의료·법률·재무 조언 아님" + 책임 한계.

## ⚪ 사소/나중
상표 검색·등록 · 제품 애널리틱스 툴(PostHog/GA4 — KPI는 있는데 계측 도구 없음) · DR 복구 리허설·인시던트 런북 · 접근성.

---

## 🎯 가장 먼저 검증할 3가지 (이게 막히면 나머지 무의미)
1. **Anthropic API 컴플라이언스 + 그 기준 실제 원가/마진 재계산** (구독 CLI 탈피)
2. **결제사(Paddle/Toss) 사주 업종 수용 여부** 사전 확인
3. **사업자등록·통신판매 신고·부가세** 등 한국 과금 법적 선행조건

> 위 3개에 답이 나오기 전엔 코드 착수 비권장. 답 확정 후 본 문서를 v3.1(선결과제 반영본)으로 갱신.
