'use client';

import { useEffect, useState } from 'react';
import { subscribe, resolveConfirm, type ConfirmState } from '@/lib/confirm';
import { useEscClose } from '@/lib/useEscClose';

/** 전역 커스텀 확인 다이얼로그 호스트 (layout 에 1회 마운트). */
export default function ConfirmHost() {
  const [c, setC] = useState<ConfirmState | null>(null);

  useEffect(() => subscribe(setC), []);

  // ESC=취소 — 확인창이 맨 위 층이라 아래 창(모달·서랍)은 닫히지 않는다
  useEscClose(() => resolveConfirm(false), !!c);

  // Enter=확인
  useEffect(() => {
    if (!c) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Enter') resolveConfirm(true);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [c]);

  if (!c) return null;

  return (
    <div className="app-confirm-backdrop" onClick={() => resolveConfirm(false)}>
      <div className="app-confirm" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        {c.title && <h3 className="app-confirm-title">{c.title}</h3>}
        <p className="app-confirm-msg">{c.message}</p>
        <div className="app-confirm-actions">
          <button type="button" className="app-btn app-btn--ghost" onClick={() => resolveConfirm(false)}>
            {c.cancelText || '취소'}
          </button>
          <button
            type="button"
            className={c.danger ? 'app-btn app-btn--danger' : 'app-btn'}
            onClick={() => resolveConfirm(true)}
            autoFocus
          >
            {c.confirmText || '확인'}
          </button>
        </div>
      </div>
    </div>
  );
}
