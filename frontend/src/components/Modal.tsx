'use client';

import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import Icon from '@/components/Icon';
import { useEscClose } from '@/lib/useEscClose';

type Props = {
  onClose: () => void;
  children: ReactNode;
  /** 머리 제목 — 있으면 머리(제목 + 닫기 ✕)를 그린다 */
  title?: ReactNode;
  /** 아래 버튼 줄 (보통 <div className="ui-actions">…) */
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** .ui-modal 에 덧붙일 클래스 */
  className?: string;
};

const FOCUSABLE = 'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

/**
 * 공용 팝업 — 가운데 카드(좁은 화면은 아래에서 올라오는 시트).
 * ESC·바깥 클릭 닫기, 열 때 첫 입력칸(없으면 첫 버튼)에 포커스, 닫으면 연 버튼으로 포커스 복귀.
 */
export default function Modal({ onClose, children, title, footer, size = 'md', className }: Props) {
  useEscClose(onClose);
  const titleId = useId();
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const box = boxRef.current;
    if (box && !box.contains(document.activeElement)) {
      const field = box.querySelector<HTMLElement>('input:not([disabled]):not([type="hidden"]), textarea:not([disabled])');
      (field || box.querySelector<HTMLElement>(FOCUSABLE) || box).focus();
    }
    return () => opener?.focus?.();
  }, []);

  const cls = ['ui-modal', size === 'sm' ? 'ui-modal--sm' : size === 'lg' ? 'ui-modal--lg' : '', className || '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className="ui-scrim" onClick={onClose}>
      <div
        ref={boxRef}
        className={cls}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="ui-modal__head">
            <h2 id={titleId} className="ui-modal__title">
              {title}
            </h2>
            <button type="button" className="ui-btn ui-btn--ghost ui-btn--icon ui-btn--sm" onClick={onClose} aria-label="닫기">
              <Icon name="x" size={18} />
            </button>
          </div>
        )}
        <div className="ui-modal__body">{children}</div>
        {footer && <div className="ui-modal__foot">{footer}</div>}
      </div>
    </div>
  );
}
