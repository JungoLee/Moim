// 화면 테마(보드/표) — docs/design-system.md 7장.
// html[data-theme] 가 단일 출처. localStorage 는 첫 그림 깜빡임 방지용 사본, 계정(users.ui_theme)이 우선.
'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { DEFAULT_THEME, THEME_KEY, isTheme } from '@/lib/themeInit';
import type { UiTheme } from '@/lib/types';

export { isTheme };

const THEME_COLOR: Record<UiTheme, string> = { board: '#0b0f1c', table: '#141a2c' };

function currentTheme(): UiTheme {
  if (typeof document === 'undefined') return DEFAULT_THEME;
  const t = document.documentElement.getAttribute('data-theme');
  return isTheme(t) ? t : DEFAULT_THEME;
}

const listeners = new Set<(t: UiTheme) => void>();

/** 화면에 바로 적용 + 이 브라우저에 기억 (서버 저장은 하지 않음) */
export function applyTheme(t: UiTheme): void {
  document.documentElement.setAttribute('data-theme', t);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[t]);
  try {
    localStorage.setItem(THEME_KEY, t);
  } catch {
    /* 사생활 보호 모드 등 — 화면만 바뀐다 */
  }
  for (const l of listeners) l(t);
}

/** 사용자가 고름 — 적용하고 계정에도 저장. 저장 실패면 false (화면은 바뀐 채로 둔다) */
export async function chooseTheme(t: UiTheme): Promise<boolean> {
  applyTheme(t);
  try {
    await api('/api/auth/me', { method: 'PATCH', body: { uiTheme: t } });
    return true;
  } catch {
    return false;
  }
}

/** 현재 테마 구독 — 테마별로 React 분기가 필요한 곳(0장 '코드 원칙'의 네 곳)에서만 쓴다 */
export function useTheme(): UiTheme {
  const [t, setT] = useState<UiTheme>(DEFAULT_THEME);
  useEffect(() => {
    setT(currentTheme());
    listeners.add(setT);
    return () => {
      listeners.delete(setT);
    };
  }, []);
  return t;
}
