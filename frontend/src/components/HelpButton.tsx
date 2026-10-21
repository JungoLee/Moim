'use client';

import { usePathname } from 'next/navigation';
import Icon from '@/components/Icon';
import { guideForPath, startGuide } from '@/lib/guide';
import { normPath } from '@/components/shell/nav';

/** 사용 가이드 `?` 단추 — PageHeader 가 없는 자리(모임 방 휴대폰 머리 줄 등)에서 쓴다. 이 화면에 가이드가 없으면 그리지 않는다 */
export default function HelpButton({ className = '' }: { className?: string }) {
  const steps = guideForPath(normPath(usePathname()));
  if (!steps) return null;
  return (
    <button
      type="button"
      className={`ui-btn ui-btn--ghost ui-btn--icon ${className}`.trim()}
      onClick={() => startGuide(steps)}
      aria-label="사용 가이드"
      title="사용 가이드"
      data-guide="help"
    >
      <Icon name="help" size={20} />
    </button>
  );
}
