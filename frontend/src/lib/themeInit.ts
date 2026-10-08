// 테마 상수 + 첫 그림 전 스크립트 — 서버 컴포넌트(app/layout.tsx)가 import 하므로 훅·브라우저 API 를 두지 않는다.
import type { UiTheme } from '@/lib/types';

export const THEME_KEY = 'moim_ui_theme';
export const DEFAULT_THEME: UiTheme = 'board';

export function isTheme(v: unknown): v is UiTheme {
  return v === 'board' || v === 'table';
}

/** layout.tsx <head> 인라인 스크립트 — React 가 그리기 전에 data-theme 를 넣는다 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_KEY}');if(t!=='board'&&t!=='table')t='${DEFAULT_THEME}';document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','${DEFAULT_THEME}');}})();`;
