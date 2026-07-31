# rem 작성 규칙

> 2026-07-31, Claude(에이전트)가 `C:\workspaceoilerplate-2026`
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

## 기준값(baseline)은 16px 로 뒀다

`$rem-baseline: 16px` → **1rem = 16px**. boilerplate 는 `$global-font-size: 10px`
(1rem = 10px)를 쓰지만 이 프로젝트에는 그대로 옮기지 않았다. 이유:

이미 작성된 rem 값이 많은 프로젝트에서 html 기준을 10px 로 내리면, 기존 `1rem` 이
16px → 10px 로 바뀌어 **화면 전체가 62.5% 로 줄어든다.** 기준만 16px 로 두고 변환 공식은
동일하게 쓰는 편이 안전하고, 얻는 이득(px 로 쓰고 rem 으로 출력)은 똑같다.

새 프로젝트를 시작한다면 `$rem-baseline: 10px` 로 두고 `html` 에 `@include rem-baseline;`
을 걸면 boilerplate 와 완전히 같아진다. 기준 변경은 **프로젝트 시작 시점에만** 하는 결정이다.

## 남은 일

기존 코드의 rem 값을 일괄 치환하지는 않았다 — 동작이 같은 값을 건드리면 리뷰만 늘어난다.
**새로 쓰거나 고치는 부분부터** `rem()` 을 쓰면 된다.

## 이미지 규칙

치수와 같은 이유로 이미지도 화면 폭에 따라 변해야 한다. 두 층으로 나눈다.

**1) 전역 기본값** — 어떤 이미지도 컨테이너를 넘지 않게, 비율은 유지하게.

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
