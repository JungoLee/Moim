'use client';

import { useEffect, useMemo, useState } from 'react';
import type { MoimEvent } from '@/lib/types';
import styles from './Calendar.module.scss';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const MAX_CHIPS = 3;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

type Props = {
  events: MoimEvent[];
  /** 날짜 칸 클릭/드래그로 기간 선택 (대시보드: 새 일정 프리필). 없으면 읽기 전용 그리드. */
  onSelectRange?: (start: Date, end: Date) => void;
};

export default function Calendar({ events, onSelectRange }: Props) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const [view, setView] = useState<Date>(() => startOfDay(new Date()));
  const [anchor, setAnchor] = useState<Date | null>(null); // 드래그 시작점
  const [focusDay, setFocusDay] = useState<Date | null>(null); // 드래그 현재점
  const [dragging, setDragging] = useState(false);

  const interactive = !!onSelectRange;

  // 드래그 중 어디서 떼든(그리드 밖 포함) 종료 처리
  useEffect(() => {
    if (!dragging) return;
    function onUp() {
      setDragging(false);
      if (anchor && focusDay && onSelectRange) {
        const lo = anchor.getTime() <= focusDay.getTime() ? anchor : focusDay;
        const hi = anchor.getTime() <= focusDay.getTime() ? focusDay : anchor;
        onSelectRange(lo, hi);
      }
    }
    window.addEventListener('mouseup', onUp);
    return () => window.removeEventListener('mouseup', onUp);
  }, [dragging, anchor, focusDay, onSelectRange]);

  const monthStart = new Date(view.getFullYear(), view.getMonth(), 1);
  const monthEnd = new Date(view.getFullYear(), view.getMonth() + 1, 0);
  const gridStart = addDays(monthStart, -monthStart.getDay()); // 첫 주 일요일
  const gridEnd = addDays(monthEnd, 6 - monthEnd.getDay()); // 마지막 주 토요일

  const days: Date[] = [];
  let cursor = gridStart;
  while (cursor.getTime() <= gridEnd.getTime()) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }

  function eventsOn(day: Date): MoimEvent[] {
    const t = day.getTime();
    return events.filter((ev) => {
      const s = startOfDay(new Date(ev.start)).getTime();
      const e = startOfDay(new Date(ev.end)).getTime();
      return s <= t && t <= e;
    });
  }

  function inSelection(day: Date): boolean {
    if (!anchor || !focusDay) return false;
    const lo = Math.min(anchor.getTime(), focusDay.getTime());
    const hi = Math.max(anchor.getTime(), focusDay.getTime());
    const t = day.getTime();
    return t >= lo && t <= hi;
  }

  function handleDown(day: Date) {
    if (!interactive) return;
    setAnchor(day);
    setFocusDay(day);
    setDragging(true);
  }

  function handleEnter(day: Date) {
    if (!interactive || !dragging) return;
    setFocusDay(day);
  }

  const monthLabel = `${view.getFullYear()}년 ${view.getMonth() + 1}월`;

  return (
    <div className={styles.calendar}>
      <div className={styles.header}>
        <strong className={styles.title}>{monthLabel}</strong>
        <span className={styles.spacer} />
        <button
          className="app-btn app-btn--ghost"
          aria-label="이전 달"
          onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
        >
          ‹
        </button>
        <button className="app-btn app-btn--ghost" onClick={() => setView(startOfDay(new Date()))}>
          오늘
        </button>
        <button
          className="app-btn app-btn--ghost"
          aria-label="다음 달"
          onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
        >
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
          const inMonth = day.getMonth() === view.getMonth();
          const dayEvents = eventsOn(day);
          const isToday = sameDay(day, today);
          const selected = inSelection(day);
          const cellClass = [
            styles.cell,
            inMonth ? '' : styles.outside,
            interactive ? styles.clickable : '',
            selected ? styles.selected : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <div
              key={day.toISOString()}
              className={cellClass}
              onMouseDown={interactive ? () => handleDown(day) : undefined}
              onMouseEnter={interactive ? () => handleEnter(day) : undefined}
            >
              <div className={[styles.dayNum, isToday ? styles.today : ''].filter(Boolean).join(' ')}>
                {day.getDate()}
              </div>
              <div className={styles.chips}>
                {dayEvents.slice(0, MAX_CHIPS).map((ev) => {
                  const busy = ev.busy || ev.visibility === 'private';
                  return (
                    <div
                      key={ev._id}
                      className={[styles.chip, busy ? styles.busy : ''].filter(Boolean).join(' ')}
                      title={ev.busy ? '바쁨' : ev.title || '(제목 없음)'}
                    >
                      {ev.busy ? '바쁨' : ev.title || '(제목 없음)'}
                    </div>
                  );
                })}
                {dayEvents.length > MAX_CHIPS && (
                  <div className={styles.more}>+{dayEvents.length - MAX_CHIPS}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {interactive && (
        <p className={styles.hint}>날짜를 클릭하거나 드래그해서 기간을 선택하세요.</p>
      )}
    </div>
  );
}
