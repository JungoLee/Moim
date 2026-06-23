'use client';

import { useEffect } from 'react';
import type { CSSProperties, ReactNode } from 'react';

type Props = {
  onClose: () => void;
  children: ReactNode;
  /** .app-modal 에 덧붙일 클래스 (예: app-profile) */
  className?: string;
  /** max-width 오버라이드 */
  maxWidth?: CSSProperties['maxWidth'];
};

/** 공용 모달 래퍼 — 배경 딤 + 중앙 카드 + 바깥 클릭/ESC 닫기. (app-modal-backdrop/app-modal 마크업 통합) */
export default function Modal({ onClose, children, className, maxWidth }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="app-modal-backdrop" onClick={onClose}>
      <div
        className={className ? `app-modal ${className}` : 'app-modal'}
        style={maxWidth ? { maxWidth } : undefined}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
