'use client';

import { useEffect, useId, useState } from 'react';
import { subscribe, resolveConfirm, type ConfirmState } from '@/lib/confirm';
import { useEscClose } from '@/lib/useEscClose';

/**
 * 전역 확인창 (layout 에 1회 마운트).
 * ESC = 취소. Enter 는 문서 전체에서 받지 않는다 — 포커스된 버튼이 눌린다(확인 버튼에 먼저 포커스).
 * 예전엔 Enter 를 문서에서 받아 '취소'에 포커스를 두고 Enter 를 쳐도 삭제·탈퇴가 실행됐다.
 */
export default function ConfirmHost() {
  const [c, setC] = useState<ConfirmState | null>(null);
  const titleId = useId();

  useEffect(() => subscribe(setC), []);
  useEscClose(() => resolveConfirm(false), !!c);

  if (!c) return null;

  return (
    <div className="ui-confirm-scrim" onClick={() => resolveConfirm(false)}>
      <div
        className="ui-confirm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={c.title ? titleId : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        {c.title && (
          <h2 id={titleId} className="ui-confirm__title">
            {c.title}
          </h2>
        )}
        <p className="ui-confirm__msg">{c.message}</p>
        <div className="ui-actions">
          <button type="button" className="ui-btn" onClick={() => resolveConfirm(false)}>
            {c.cancelText || '취소'}
          </button>
          <button
            type="button"
            className={c.danger ? 'ui-btn ui-btn--danger-solid' : 'ui-btn ui-btn--primary'}
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
