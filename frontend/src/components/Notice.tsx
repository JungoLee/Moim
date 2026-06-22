import type { ReactNode } from 'react';

type Props = {
  /** true=성공(초록), false=에러(빨강, 기본) */
  ok?: boolean;
  children: ReactNode;
};

/** 폼 하단 인라인 알림 — 입력칸 바로 아래에 두어 눈에 띄게. 에러=빨강(⚠️), 성공=초록(✓) */
export default function Notice({ ok = false, children }: Props) {
  return (
    <p
      style={{
        margin: 'var(--space-2) 0 0',
        padding: 'var(--space-2) var(--space-3)',
        borderRadius: 'var(--radius-sm)',
        fontSize: '0.9rem',
        color: ok ? 'var(--color-success)' : 'var(--color-danger)',
        background: ok ? 'rgba(74, 210, 149, 0.12)' : 'rgba(255, 107, 107, 0.12)',
        border: `1px solid ${ok ? 'rgba(74, 210, 149, 0.4)' : 'rgba(255, 107, 107, 0.4)'}`,
      }}
    >
      {ok ? '✓ ' : '⚠️ '}
      {children}
    </p>
  );
}
