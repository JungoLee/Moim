'use client';

import { useRef, useState } from 'react';
import styles from './DatePicker.module.scss';
import { pad2, dateKey, parseDateKey, monthGridDays } from '@/lib/datetime';
import { useOutsideClose } from '@/lib/useOutsideClose';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

type Props = {
  value: string;
  onChange: (v: string) => void;
  /** 날짜별 표시 색 ("YYYY-MM-DD" → 색). 내 일정을 점으로만 표시 (글자 없음). */
  markedDates?: Record<string, string>;
  /** true 면 가로 폭을 꽉 채움 (행에서 flex 로 늘어남) */
  block?: boolean;
};

// 네이티브 date 대신 쓰는 커스텀 달력 입력
export default function DatePicker({ value, onChange, markedDates, block }: Props) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<Date>(() => parseDateKey(value) || new Date());
  const ref = useRef<HTMLDivElement>(null);

  useOutsideClose(ref, open, () => setOpen(false));

  function toggle() {
    setView(parseDateKey(value) || new Date());
    setOpen((o) => !o);
  }

  const days = monthGridDays(view);

  return (
    <div className={block ? `${styles.wrap} ${styles.wrapBlock}` : styles.wrap} ref={ref}>
      <button type="button" className={`app-input ${styles.field}`} onClick={toggle}>
        {value || '날짜 선택'}
      </button>
      {open && (
        <div className={styles.pop}>
          <div className={styles.head}>
            <button type="button" className={styles.nav} aria-label="이전 달" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}>
              ‹
            </button>
            <strong>
              {view.getFullYear()}-{pad2(view.getMonth() + 1)}
            </strong>
            <button type="button" className={styles.nav} aria-label="다음 달" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}>
              ›
            </button>
          </div>
          <div className={styles.weekdays}>
            {WEEKDAYS.map((w, i) => (
              <span key={w} className={i === 0 ? styles.sun : i === 6 ? styles.sat : undefined}>
                {w}
              </span>
            ))}
          </div>
          <div className={styles.grid}>
            {days.map((day) => {
              const key = dateKey(day);
              const inMonth = day.getMonth() === view.getMonth();
              const selected = key === value;
              const mark = markedDates?.[key];
              return (
                <button
                  type="button"
                  key={key}
                  className={[styles.day, inMonth ? '' : styles.out, selected ? styles.sel : ''].filter(Boolean).join(' ')}
                  onClick={() => {
                    onChange(key);
                    setOpen(false);
                  }}
                >
                  {day.getDate()}
                  {mark && <span className={styles.dot} style={{ background: mark }} aria-hidden />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
