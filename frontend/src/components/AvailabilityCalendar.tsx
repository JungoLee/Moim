'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Mark, AvailStatus } from '@/lib/types';
import styles from './AvailabilityCalendar.module.scss';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}
function toKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export type DaySummary = { yes: number; after: number; no: number; afterMax: string };

type Props = {
  myMarks: Record<string, Mark>;
  summary: Record<string, DaySummary>;
  total: number;
  mode: AvailStatus;
  onApply: (dates: string[], isDrag: boolean) => void;
};

export default function AvailabilityCalendar({ myMarks, summary, total, mode, onApply }: Props) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const [view, setView] = useState<Date>(() => startOfDay(new Date()));
  const [anchor, setAnchor] = useState<Date | null>(null);
  const [focusDay, setFocusDay] = useState<Date | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!dragging) return;
    function onUp() {
      setDragging(false);
      if (anchor && focusDay) {
        const lo = Math.min(anchor.getTime(), focusDay.getTime());
        const hi = Math.max(anchor.getTime(), focusDay.getTime());
        const dates: string[] = [];
        let c = new Date(lo);
        while (c.getTime() <= hi) {
          if (c.getTime() >= today.getTime()) dates.push(toKey(c));
          c = addDays(c, 1);
        }
        if (dates.length) onApply(dates, anchor.getTime() !== focusDay.getTime());
      }
      setAnchor(null);
      setFocusDay(null);
    }
    window.addEventListener('mouseup', onUp);
    return () => window.removeEventListener('mouseup', onUp);
  }, [dragging, anchor, focusDay, today, onApply]);

  const monthStart = new Date(view.getFullYear(), view.getMonth(), 1);
  const monthEnd = new Date(view.getFullYear(), view.getMonth() + 1, 0);
  const gridStart = addDays(monthStart, -monthStart.getDay());
  const gridEnd = addDays(monthEnd, 6 - monthEnd.getDay());
  const days: Date[] = [];
  let cur = gridStart;
  while (cur.getTime() <= gridEnd.getTime()) {
    days.push(cur);
    cur = addDays(cur, 1);
  }

  function inSelection(day: Date): boolean {
    if (!anchor || !focusDay) return false;
    const lo = Math.min(anchor.getTime(), focusDay.getTime());
    const hi = Math.max(anchor.getTime(), focusDay.getTime());
    return day.getTime() >= lo && day.getTime() <= hi;
  }

  const monthLabel = `${view.getFullYear()}-${String(view.getMonth() + 1).padStart(2, '0')}`;

  return (
    <div>
      <div className={styles.header}>
        <strong className={styles.title}>{monthLabel}</strong>
        <span className={styles.spacer} />
        <button className="app-btn app-btn--ghost" aria-label="이전 달" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}>
          ‹
        </button>
        <button className="app-btn app-btn--ghost" onClick={() => setView(startOfDay(new Date()))}>
          오늘
        </button>
        <button className="app-btn app-btn--ghost" aria-label="다음 달" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}>
          ›
        </button>
      </div>

      <div className={styles.weekdays}>
        {WEEKDAYS.map((w, i) => (
          <div key={w} className={i === 0 ? styles.sun : i === 6 ? styles.sat : undefined}>
            {w}
          </div>
        ))}
      </div>

      <div className={styles.grid}>
        {days.map((day) => {
          const key = toKey(day);
          const inMonth = day.getMonth() === view.getMonth();
          const past = day.getTime() < today.getTime();
          const mark = myMarks[key];
          const s = summary[key];
          const allYes = total > 0 && s && s.yes === total;
          const cls = [
            styles.cell,
            inMonth ? '' : styles.outside,
            past ? styles.past : '',
            inSelection(day) ? styles.selecting : '',
            allYes ? styles.all : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <button
              type="button"
              key={key}
              className={cls}
              disabled={past}
              onMouseDown={past ? undefined : () => { setAnchor(day); setFocusDay(day); setDragging(true); }}
              onMouseEnter={past || !dragging ? undefined : () => setFocusDay(day)}
            >
              <span className={styles.dayNum}>{day.getDate()}</span>
              {mark && (
                <span
                  className={[styles.mark, mark.status === 'yes' ? styles.mYes : mark.status === 'no' ? styles.mNo : styles.mAfter].join(' ')}
                >
                  {mark.status === 'yes' ? '가능' : mark.status === 'no' ? '불가' : `${mark.time}~`}
                </span>
              )}
              {s && (s.yes > 0 || s.after > 0) && (
                <span className={styles.count}>
                  가능 {s.yes + s.after}/{total}
                  {s.after > 0 && <span className={styles.afterNote}> ({s.afterMax}~)</span>}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
