# Gilo 이식 프롬프트 (Moim → Gilo)

> ⚠️ 이 파일은 **Gilo 레포의 Claude Code 세션에 붙여넣을 프롬프트**를 보관하는 문서다 (Moim 코드와 무관).
> 아래 구분선 안쪽을 통째로 복사해서 Gilo 세션에 붙여넣으면 된다. 이식이 끝나면 이 파일은 삭제해도 됨.

---

Moim 프로젝트(c:\workspace\Moim)에서 검증 완료된 인증 기능들을 이 프로젝트(Gilo)에 이식해줘.
Gilo의 스택·폴더 구조·기존 컨벤션을 먼저 파악하고 거기에 맞게 적용할 것 (Moim은 Next.js 정적 export + Cloudflare Workers/D1 이지만 Gilo 구조가 다르면 맞춰서).
참고할 Moim 원본 파일을 명시해두니 그대로 복붙하지 말고 Gilo 구조에 맞게 옮겨줘.

## 1. 이메일 코드 로그인 (필수)
아무 이메일 입력 → 6자 코드 발송 → 6칸 입력칸에 넣으면 로그인(JWT).
- 코드 저장: email(unique)·codeHash(sha256)·expiresAt(발송되면 10분 / 로그 폴백이면 30분)·attempts(최대 5회)·sentAt(재전송 60초 쿨다운). 평문 코드는 저장하지 않는다
  → 참고: c:\workspace\Moim\worker\schema.sql 의 `login_codes` 테이블
- 코드 생성: **영문 대소문자+숫자 62자에서 6자**(대소문자 구분). 6칸 입력·붙여넣기 전제라 헷갈리는 글자를 빼지 않는다. 모듈러 바이어스 제거한 균일 난수(`randomFrom`)
- 라우트 2개: POST /api/auth/email/request(검증·쿨다운·발송), POST /api/auth/email/verify(만료·시도횟수 체크, 일회용 삭제, JWT 발급). 검증은 **대소문자를 구분**한다(`toUpperCase()` 금지)
  → 참고: c:\workspace\Moim\worker\auth.js 의 "이메일 코드 로그인" 섹션
- 발송: **HTTP API(Resend)** — 키 미설정이면 콘솔에 코드 출력(개발 폴백). 메일은 코드가 한눈에 보이는 카드형 HTML(인라인 스타일만)
  → 참고: c:\workspace\Moim\worker\mailer.js
- 남용 방지: 이메일별 60초 쿨다운 + **IP 당 하루 N통** 제한(`mail_rate` 테이블, 지난 날짜 키는 요청 시 함께 삭제)
  → 참고: c:\workspace\Moim\worker\auth.js 의 `overMailRate`
- 계정 통합: verify 시 같은 email의 기존 유저가 있으면 그 계정으로 로그인. 새 유저는 googleId 자리표시자("email:<email>")로 생성.
  구글 로그인에서 googleId 미발견 시 email+자리표시자 매칭 → 실제 googleId로 교체
  → 참고: c:\workspace\Moim\worker\auth.js 의 `googleCallback`
- 프론트 로그인 화면: 구글 버튼 아래 "또는" 구분선 + 2단계 폼(이메일 입력→코드 받기 / 6칸 코드 입력→재전송·다른 이메일).
  6칸 입력은 **마지막 칸을 채우면 버튼 없이 바로 확인**, 붙여넣기 한 번에 채움, 화면 복귀 시 클립보드가 코드 모양이면 자동 입력(권한 없으면 조용히 넘어감), 첫 칸 `autoComplete="one-time-code"`
  → 참고: c:\workspace\Moim\frontend\src\components\CodeBoxes.tsx + app\page.tsx + globals.scss 의 .app-hero-or/.app-hero-email/.app-code-box
- 시크릿은 메일 API 키 하나만(배포 대시보드/`wrangler secret`). 발신 주소는 공개값.
  ⚠️ Cloudflare Workers 는 raw TCP 를 못 열어 **SMTP/nodemailer 불가** — Gilo 가 Node 서버라면 SMTP 도 선택지지만, HTTP API 쪽이 이식성이 좋다.

## 2. 세션 정리 버그 3종 수정 (필수 — Moim에서 실제 발생했던 버그)
- requireAuth 에서 사용자 존재 확인: 탈퇴한 계정의 JWT(만료 전)가 모든 API를 통과해
  "빈 데이터 유령 세션"이 생기는 문제 → 없으면 401
  → 참고: c:\workspace\Moim\worker\auth.js 의 `requireAuth`
- 로그아웃·회원탈퇴는 SPA 라우터 이동 대신 window.location.href='/' 전체 로드 (메모리 상태·모듈 캐시 초기화)
- 아바타/유저 정보를 모듈 캐시하고 있다면 캐시에 토큰(계정)을 함께 기록해 계정이 바뀌면 무효화
  → 참고: c:\workspace\Moim\frontend\src\components\Nav.tsx, AccountDrawer.tsx

## 3. 인앱 브라우저 구글 로그인 차단 우회 (필수)
카카오톡·라인 등 인앱 WebView에서 구글 OAuth가 "액세스 차단됨(disallowed_useragent)"으로 막힘.
- lib/inapp: UA 감지(KAKAOTALK|Line/|Instagram|FBAN|FBAV|FB_IAB 등) + 외부 브라우저 탈출
  (카카오 kakaotalk://web/openExternal?url=, 라인 ?openExternalBrowser=1, 안드로이드 크롬 intent://)
- 로그인 버튼 클릭 시 인앱이면 탈출 시도, 불가(iOS 일부)면 "다른 브라우저로 열기" 안내 토스트
  → 참고: c:\workspace\Moim\frontend\src\lib\inapp.ts + page.tsx 의 handleLogin

## 4. (선택) 사용 가이드 — 스포트라이트 투어
페이지별 스텝 정의 → FAB/버튼으로 시작 → 대상 요소 위 fixed 박스가
box-shadow: 0 0 0 2px 링, 0 0 0 10000px rgba(0,0,0,.6) 컷아웃으로 강조되고
top/left/width/height transition으로 스텝 간 이동, 아래(공간 없으면 위)에 설명 카드(이전/다음/건너뛰기).
카드는 실제 높이를 측정(useLayoutEffect)해 화면 안으로 클램프 — 안 그러면 카드가 화면 밖으로 나가
버튼을 못 누르는 버그가 생김(Moim에서 겪음).
대상은 각 페이지 data-guide 속성, 시작 시 화면에 없는 타겟은 자동 스킵, ESC/라우트 이동 시 종료.
→ 참고: c:\workspace\Moim\frontend\src\lib\guide.ts, components/GuideHost.tsx, globals.scss 의 .app-guide-*

작업 순서: 서버부터(코드 저장 스키마→메일러→라우트→인증 가드) 만들고 검증 후 프론트.
각 단계마다 빌드/타입체크 통과 확인하고, 완료 후 Gilo의 문서(PLAN 등)에 반영해줘.
