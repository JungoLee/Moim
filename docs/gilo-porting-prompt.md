# Gilo 이식 프롬프트 (Moim → Gilo)

> ⚠️ 이 파일은 **Gilo 레포의 Claude Code 세션에 붙여넣을 프롬프트**를 보관하는 문서다 (Moim 코드와 무관).
> 아래 구분선 안쪽을 통째로 복사해서 Gilo 세션에 붙여넣으면 된다. 이식이 끝나면 이 파일은 삭제해도 됨.

---

Moim 프로젝트(c:\workspace\Moim)에서 검증 완료된 인증 기능들을 이 프로젝트(Gilo)에 이식해줘.
Gilo의 스택·폴더 구조·기존 컨벤션을 먼저 파악하고 거기에 맞게 적용할 것 (Moim은 Next.js+Express지만 Gilo 구조가 다르면 맞춰서).
참고할 Moim 원본 파일을 명시해두니 그대로 복붙하지 말고 Gilo 구조에 맞게 옮겨줘.

## 1. 이메일 코드 로그인 (필수)
아무 이메일 입력 → 12자리 코드 발송 → 입력하면 로그인(JWT).
- 모델 LoginCode: email(unique)·codeHash(sha256)·expiresAt(TTL 10분)·attempts(최대 5회)·sentAt(재전송 60초 쿨다운)
  → 참고: c:\workspace\Moim\backend\src\models\LoginCode.js
- 코드 생성: 대문자+숫자 12자리, 헷갈리는 I·L·O·0·1 제외, crypto.randomInt
- 라우트 2개: POST /api/auth/email/request(검증·쿨다운·발송), POST /api/auth/email/verify(만료·시도횟수 체크, 일회용 삭제, JWT 발급)
  → 참고: c:\workspace\Moim\backend\src\routes\auth.js 의 "이메일 코드 로그인" 섹션
- 발송: nodemailer + SMTP env(SMTP_HOST/PORT/USER/PASS/SMTP_FROM), SMTP 미설정이면 콘솔에 코드 출력(개발 폴백)
  → 참고: c:\workspace\Moim\backend\src\utils\mailer.js  (nodemailer 설치 필요)
- 계정 통합: verify 시 같은 email의 기존 유저가 있으면 그 계정으로 로그인. 새 유저는 googleId 자리표시자("email:<email>")로 생성.
  구글 passport 전략에서 googleId 미발견 시 email+자리표시자 매칭 → 실제 googleId로 교체
  → 참고: c:\workspace\Moim\backend\src\config\passport.js
- 프론트 로그인 화면: 구글 버튼 아래 "또는" 구분선 + 2단계 폼(이메일 입력→코드 받기 / 코드 입력→로그인·재전송·다른 이메일)
  → 참고: c:\workspace\Moim\frontend\src\app\page.tsx + globals.scss 의 .app-hero-or/.app-hero-email
- env 예시 파일과 배포 설정에 SMTP 변수 추가. 시크릿은 SMTP_PASS 만(배포 대시보드 입력), HOST/PORT/USER 는 공개값.
  SMTP 계정은 Gmail+앱 비밀번호 — Gilo 용으로 별도 발급 권장(서비스별 분리).

## 2. 세션 정리 버그 3종 수정 (필수 — Moim에서 실제 발생했던 버그)
- requireAuth 미들웨어에서 User.exists 확인: 탈퇴한 계정의 JWT(만료 전)가 모든 API를 통과해
  "빈 데이터 유령 세션"이 생기는 문제 → 없으면 401
  → 참고: c:\workspace\Moim\backend\src\middleware\auth.js
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

작업 순서: 백엔드부터(모델→메일러→라우트→미들웨어) 만들고 검증 후 프론트.
각 단계마다 빌드/타입체크 통과 확인하고, 완료 후 Gilo의 문서(PLAN 등)에 반영해줘.
