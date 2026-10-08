'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import Icon from '@/components/Icon';
import { guideForPath, startGuide } from '@/lib/guide';
import { normPath } from '@/components/shell/nav';

type Props = {
  title: ReactNode;
  eyebrow?: ReactNode;
  sub?: ReactNode;
  /** 오른쪽 버튼들 */
  actions?: ReactNode;
  /** 제목 옆에 붙일 것(칩 등) */
  badge?: ReactNode;
};

/** 화면 머리 — eyebrow · 제목 · 설명 · 오른쪽 동작. 그 화면에 사용 가이드가 있으면 `?` 버튼을 붙인다. */
export default function PageHeader({ title, eyebrow, sub, actions, badge }: Props) {
  const steps = guideForPath(normPath(usePathname()));
  return (
    <header className="ui-page-head">
      <div className="ui-page-head__main">
        {eyebrow && <span className="ui-page-head__eyebrow">{eyebrow}</span>}
        <h1>
          {title}
          {badge && <> {badge}</>}
        </h1>
        {sub && <p className="ui-page-head__sub">{sub}</p>}
      </div>
      {(actions || steps) && (
        <div className="ui-page-head__actions">
          {actions}
          {steps && (
            <button
              type="button"
              className="ui-btn ui-btn--ghost ui-btn--icon"
              onClick={() => startGuide(steps)}
              aria-label="사용 가이드"
              title="사용 가이드"
              data-guide="help"
            >
              <Icon name="help" size={20} />
            </button>
          )}
        </div>
      )}
    </header>
  );
}
