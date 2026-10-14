# rem 작성 규칙

> 2026-07-31, Claude(에이전트)가 `C:\workspace\boilerplate-2026`
> (`src/assets/styles/abstracts/_mixins.scss`)의 px→rem 변환 공식을 이 프로젝트로 이식했다.
> 파일: **`frontend/src/styles/_rem.scss`**

## 왜

디자인은 px 로 온다. 그런데 px 로 박아 넣으면 사용자가 브라우저 기본 글자 크기를 키워도
화면이 커지지 않는다(접근성). 그래서 rem 으로 쓰되 **px → rem 계산은 도구가 하게** 한다.

손으로 계산하면 `0.3125rem`·`1.875rem` 같은 값이 코드에 남는데, 이건 읽는 사람이
"몇 px 이었는지" 되짚어야 한다. `rem(5)`·`rem(30)` 이면 의도가 그대로 보인다.

## 쓰는 법

```scss
@use '@/styles/rem' as *;   // 컴포넌트 SCSS 맨 위

.card {
  font-size: rem(14);            // → 0.875rem
  padding: rem(12) rem(20);      // → 0.75rem 1.25rem
  margin: rem(10 5);             // 리스트도 됨
  border: rem(1) solid #333;     // 숫자만 변환, 나머지는 그대로

  @include rem(gap, 8);          // 선언까지 한 번에
  @include rem((margin: 10 5, padding: 12));  // 여러 속성
}
```

단위는 생략해도 되고 px 를 붙여도 된다 — `rem(14)` 와 `rem(14px)` 이 같다.
미디어 쿼리는 rem 이 아니라 px 로 쓴다(`styles/_bp.scss` — rem 은 html 글자 크기를 따라 움직여 경계가 어긋난다).

## 기준값 — 지금 Moim

- **`$rem-baseline: 16px`** — `rem()` 은 16 으로 나눈다(`rem(16)` = `1rem`).
- **html 글자 크기는 `clamp(16px, 12px + 0.45vw, 18px)`**(`styles/base.scss`) — 넓은 화면에서 글자를 크게(사용자 요청). 모든 rem 이 이 한 줄을 따라 함께 커지고 작아진다. 그래서 `rem(16)` 은 좁은 화면에서 16px, 넓은 화면에서 18px 로 보인다. (2.1.0 전에는 최솟값이 14px 이라 휴대폰에서 `rem(12)` 가 10.5px 였다. 최솟값만 16px 로 올려 889px 이상 — 데스크톱 — 은 그대로다.)
- 처음 이식할 때 boilerplate 의 `$global-font-size: 10px`(1rem = 10px)를 그대로 옮기지 않은 이유: 이미 작성된 rem 값이 많은 프로젝트에서 html 기준을 바꾸면 화면 전체 크기가 한꺼번에 바뀐다.

## OPNAE 공통 규칙과 다른 점 (결정 대기)

OPNAE 아래 프로젝트 공통 규칙은 **`1rem = 10px`(html 62.5%, `$rem-baseline: 10px`)·글자 최소 12px** 다.
- **글자 최소 12px 은 2.1.0 에서 맞췄다** — 루트 최솟값 16px + `rem(9)`~`rem(11)` 16곳을 `rem(12)` 로. 이제 어느 화면 폭에서도 `rem(12)` ≥ 12px 이다. 새 코드도 `rem(12)` 아래는 쓰지 않는다.
- 남은 것은 **기준값 `1rem = 10px` 으로 옮기는 일**뿐이다(코드 표기만 바뀌고 화면 크기는 같게 할 수 있다 — 예: `$rem-baseline: 10px` + html `clamp(10px, 7.5px + 0.28vw, 11.25px)`). 전 화면 치수 숫자가 바뀌므로 두 테마 전 화면 촬영 검수와 함께 → [PLAN.md](PLAN.md) "다음 작업".

## 이미지 규칙

치수와 같은 이유로 이미지도 화면 폭에 따라 변해야 한다. 두 층으로 나눈다.

**1) 전역 기본값** — 어떤 이미지도 컨테이너를 넘지 않게, 비율은 유지하게(`styles/base.scss`).

```css
img, svg, video { max-width: 100%; }
img, video      { height: auto; }
```

**2) 크기를 정하는 이미지**(로고·히어로 등)는 미디어 쿼리로 끊지 말고 연속적으로 변하게.

```scss
.logo {
  width: clamp(1.7rem, 5.5vw, 2.1rem);  // 최소 / 화면 비율 / 최대
  height: auto;                          // 비율 유지 — 절대 고정값을 같이 주지 않는다
}
```

`@media (max-width: 640px) { .logo { width: 1.4rem } }` 처럼 구간을 끊으면 경계에서 툭
튀고 분기마다 값을 관리해야 한다. `clamp()` 는 한 줄로 끝난다.

**HTML/JSX 의 `width`·`height` 속성은 지우지 않는다.** 이미지가 로드되기 전 브라우저가
자리를 미리 잡는 데(레이아웃 흔들림 = CLS 방지) 쓰인다. 실제 표시 크기는 CSS 가 정하고,
`height: auto` 가 속성값을 덮으므로 충돌하지 않는다.
