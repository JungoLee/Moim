'use client';

import { applyTheme, chooseTheme, useTheme } from '@/lib/theme';
import { toast } from '@/lib/toast';
import type { UiTheme } from '@/lib/types';
import styles from './Shell.module.scss';

const OPTIONS: Array<[UiTheme, string]> = [
  ['board', '보드'],
  ['table', '표'],
];

type Props = {
  /** shell = 메뉴(어두운 바탕) 위, surface = 카드·서랍 위 */
  tone?: 'shell' | 'surface';
  /** 저장 실패 토스트 없이 조용히 (로그아웃 상태 랜딩 등) */
  local?: boolean;
};

/** 화면 테마 탭 '보드 | 표' — 누르면 바로 바뀌고 계정에 저장된다 (docs/design-system.md 7장) */
export default function ThemeSwitch({ tone = 'shell', local = false }: Props) {
  const theme = useTheme();

  async function pick(t: UiTheme) {
    if (t === theme) return;
    if (local) {
      applyTheme(t);
      return;
    }
    const ok = await chooseTheme(t);
    if (!ok) toast('화면 설정을 저장하지 못했어요. 이 브라우저에서만 바뀌었어요.', 'error');
  }

  return (
    <div className={tone === 'shell' ? styles.themeSwitch : `${styles.themeSwitch} ${styles.themeSwitchSurface}`} role="group" aria-label="화면 보기">
      {OPTIONS.map(([t, label]) => (
        <button key={t} type="button" aria-pressed={theme === t} onClick={() => pick(t)}>
          {label}
        </button>
      ))}
    </div>
  );
}
