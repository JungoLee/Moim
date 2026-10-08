'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import Icon from '@/components/Icon';
import { useEscClose } from '@/lib/useEscClose';
import styles from './SheetPanel.module.scss';

type Props = {
  /** 모바일에서 전체 화면 시트로 열려 있는지 (데스크톱에서는 늘 그냥 카드) */
  open: boolean;
  onClose: () => void;
  /** 시트 머리 제목 + 접근성 이름 */
  label: string;
  className?: string;
  children: ReactNode;
};

/**
 * 후보·대화 패널 — 데스크톱에서는 화면 안에 붙은 카드, 모바일(<900)에서는 숨어 있다가
 * open 이면 전체 화면 시트가 된다. 같은 요소 하나라서 대화 패널이 두 벌 생기지 않는다.
 */
export default function SheetPanel({ open, onClose, label, className, children }: Props) {
  useEscClose(onClose, open);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const opener = document.activeElement as HTMLElement | null;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
      opener?.focus?.();
    };
  }, [open]);

  return (
    <section
      className={[styles.panel, className].filter(Boolean).join(' ')}
      data-open={open || undefined}
      role={open ? 'dialog' : undefined}
      aria-modal={open || undefined}
      aria-label={label}
    >
      <div className={styles.head}>
        <strong>{label}</strong>
        <button ref={closeRef} type="button" className="ui-btn ui-btn--ghost ui-btn--icon" onClick={onClose} aria-label="닫기">
          <Icon name="x" size={20} />
        </button>
      </div>
      <div className={styles.content}>{children}</div>
    </section>
  );
}
