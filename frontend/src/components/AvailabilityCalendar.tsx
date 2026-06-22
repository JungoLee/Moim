'use client';

import { useMemo, useState } from 'react';
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

type Props = {
  myDates: Set<string>;
  counts: Record<string, number>; // 날짜별 가능 인원
  total: number; // 전체 멤버 수
  onToggle: (dateStr: string) => void;
};

export default function AvailabilityCalendar({ myDates, counts, total, onToggle }: Props) {
  const [view, setView] = useState<Date>(() => startOfDay(new Date()));

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

  const monthLabel = `${view.getFullYear()}년 ${view.getMonth() + 1}월`;

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
          const count = counts[key] || 0;
          const mine = myDates.has(key);
          const all = total > 0 && count === total;
          const cls = [styles.cell, inMonth ? '' : styles.outside, mine ? styles.mine : '', all ? styles.all : '']
            .filter(Boolean)
            .join(' ');
          return (
            <button type="button" key={key} className={cls} onClick={() => onToggle(key)}>
              <span className={styles.dayNum}>{day.getDate()}</span>
              {count > 0 && (
                <span className={styles.count}>
                  {count}/{total}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
