'use client';

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import styles from './Tooltip.module.scss';

// 호버/포커스 시 뜨는 툴팁. 트리거 위치를 재서 화면 밖으로 안 넘치게 (위/아래 플립 + 좌우 클램프).
export default function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !wrapRef.current || !tipRef.current) return;
    const GAP = 8;
    const MARGIN = 8;
    const r = wrapRef.current.getBoundingClientRect();
    const t = tipRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // 기본은 아래. 아래 공간 부족하면 위로 플립, 둘 다 부족하면 화면 안으로 클램프.
    let top = r.bottom + GAP;
    if (top + t.height > vh - MARGIN) {
      const above = r.top - t.height - GAP;
      top = above >= MARGIN ? above : Math.max(MARGIN, vh - t.height - MARGIN);
    }
    // 좌우: 트리거 중앙 정렬 후 화면 안으로 클램프
    let left = r.left + r.width / 2 - t.width / 2;
    left = Math.max(MARGIN, Math.min(left, vw - t.width - MARGIN));

    setPos({ top, left });
  }, [open]);

  function show() {
    setOpen(true);
  }
  function hide() {
    setOpen(false);
    setPos(null);
  }

  return (
    <span ref={wrapRef} className={styles.wrap} onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      {children}
      {open && (
        <div
          ref={tipRef}
          role="tooltip"
          className={styles.tip}
          style={pos ? { top: pos.top, left: pos.left, opacity: 1 } : { top: -9999, left: -9999, opacity: 0 }}
        >
          {label}
        </div>
      )}
    </span>
  );
}
