'use client';

import { useMemo } from 'react';
import { dateKey, DOW_KO, fmtDayWords, monthGridDays, todayKey } from '@/lib/datetime';
import { heatLevel } from '@/lib/roomCandidates';
import type { DaySummary } from '@/lib/roomCandidates';
import type { Mark, RoomConfirmed } from '@/lib/types';
import { markWords } from './format';
import { useDragSelect } from './useDragSelect';
import styles from './HeatCalendar.module.scss';

type Props = {
  /** 보는 달 (1일) */
  month: Date;
  myMarks: Record<string, Mark>;
  summary: Record<string, DaySummary>;
  total: number;
  /** 'YYYY-MM-DD' → 공휴일 이름 */
  holidays: Record<string, string>;
  confirmed: RoomConfirmed | null;
  onApply: (dates: string[], isDrag: boolean) => void;
};

/**
 * 보드 보기의 달력 — 칸마다 '가능한 사람/전체'와 겹침 정도(히트 바탕), 내 표시.
 * 누르기·끌기는 포인터 이벤트(터치는 길게 눌러 끌기), 키보드는 칸에서 Enter/Space.
 */
export default function HeatCalendar({ month, myMarks, summary, total, holidays, confirmed, onApply }: Props) {
  const today = todayKey();
  const days = useMemo(() => monthGridDays(month), [month]);
  const monthIdx = month.getMonth();
  const keys = useMemo(() => days.filter((d) => d.getMonth() === monthIdx).map(dateKey), [days, monthIdx]);
  const drag = useDragSelect({ keys, isDisabled: (k) => k < today, onApply });

  return (
    <div className={styles.cal} data-guide="room-cal">
      <div className={styles.week} aria-hidden="true">
        {DOW_KO.map((w, i) => (
          <span key={w} data-dow={i === 0 ? 'sun' : i === 6 ? 'sat' : undefined}>
            {w}
          </span>
        ))}
      </div>
      <div className={styles.grid} role="group" aria-label={`${month.getFullYear()}년 ${monthIdx + 1}월 겹침 달력`} {...drag.bind}>
        {days.map((day) => {
          const key = dateKey(day);
          if (day.getMonth() !== monthIdx) {
            return (
              <span key={key} className={styles.outside} aria-hidden="true">
                {day.getDate()}
              </span>
            );
          }
          const s = summary[key];
          const mark = myMarks[key];
          const level = heatLevel(s, total);
          const dow = day.getDay();
          const past = key < today;
          const holiday = holidays[key];
          const yes = s?.yes ?? 0;
          const after = s?.after ?? 0;
          const inConfirmed = !!confirmed && key >= confirmed.start && key <= confirmed.end;
          const label =
            `${fmtDayWords(day)}, ${total}명 중 ${yes}명 가능` +
            (after > 0 ? `, 저녁 이후 ${after}명` : '') +
            `, 내 표시: ${markWords(mark)}` +
            (holiday ? `, ${holiday}` : '') +
            (inConfirmed ? ', 확정된 날' : '') +
            (past ? ', 지난 날' : '');
          return (
            <button
              key={key}
              type="button"
              className={styles.cell}
              data-key={key}
              data-level={level}
              data-dow={dow === 0 || holiday ? 'sun' : dow === 6 ? 'sat' : undefined}
              data-mine={mark?.status}
              data-today={key === today || undefined}
              data-selecting={drag.selected?.has(key) || undefined}
              data-confirmed={inConfirmed || undefined}
              disabled={past}
              aria-label={label}
            >
              <span className={styles.top}>
                <span className={styles.num}>{day.getDate()}</span>
                {holiday && <span className={styles.holiday}>{holiday}</span>}
                {mark?.status === 'yes' && <span className={styles.ring} aria-hidden="true" />}
                {mark?.status === 'after' && <span className={styles.mineAfter}>{mark.time}~</span>}
              </span>
              <span className={styles.bottom}>
                <span className={styles.count}>
                  {yes}/{total}
                </span>
                {after > 0 && <span className={styles.eve}>+{after} 저녁</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
