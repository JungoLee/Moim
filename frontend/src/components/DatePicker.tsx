'use client';

import { useRef, useState } from 'react';
import Icon from '@/components/Icon';
import styles from './DatePicker.module.scss';
import { DOW_KO, dateKey, fmtDay, fmtMonth, parseDateKey, monthGridDays } from '@/lib/datetime';
import { useOutsideClose } from '@/lib/useOutsideClose';
import { useEscClose } from '@/lib/useEscClose';

type Props = {
  value: string;
  onChange: (v: string) => void;
  /** 날짜별 점 색 ('YYYY-MM-DD' → 색). 그 날 내 일정이 있음을 점으로만 표시 */
  markedDates?: Record<string, string>;
  /** 가로 폭을 꽉 채움 */
  block?: boolean;
  ariaLabel?: string;
};

function label(value: string): string {
  const d = parseDateKey(value);
  if (!d) return '날짜 선택';
  const y = d.getFullYear() === new Date().getFullYear() ? '' : `${d.getFullYear()}년 `;
  return `${y}${fmtDay(d)}`;
}

/** 네이티브 date 대신 쓰는 달력 입력 */
export default function DatePicker({ value, onChange, markedDates, block, ariaLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<Date>(() => parseDateKey(value) || new Date());
  const ref = useRef<HTMLDivElement>(null);

  useOutsideClose(ref, open, () => setOpen(false));
  useEscClose(() => setOpen(false), open);

  function toggle() {
    setView(parseDateKey(value) || new Date());
    setOpen((o) => !o);
  }

  const days = monthGridDays(view);
  const today = dateKey(new Date());

  return (
    <div className={block ? `${styles.wrap} ${styles.block}` : styles.wrap} ref={ref}>
      <button type="button" className={`ui-input ${styles.field}`} onClick={toggle} aria-expanded={open} aria-label={ariaLabel}>
        <Icon name="calendar" size={16} />
        <span>{label(value)}</span>
      </button>
      {open && (
        <div className={styles.pop} role="dialog" aria-label="날짜 고르기">
          <div className={styles.head}>
            <button type="button" className="ui-btn ui-btn--ghost ui-btn--icon ui-btn--sm" aria-label="이전 달" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}>
              <Icon name="chevron-left" size={18} />
            </button>
            <strong>{fmtMonth(view)}</strong>
            <button type="button" className="ui-btn ui-btn--ghost ui-btn--icon ui-btn--sm" aria-label="다음 달" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}>
              <Icon name="chevron-right" size={18} />
            </button>
          </div>
          <div className={styles.weekdays}>
            {DOW_KO.map((w, i) => (
              <span key={w} data-dow={i}>
                {w}
              </span>
            ))}
          </div>
          <div className={styles.grid}>
            {days.map((day) => {
              const key = dateKey(day);
              const mark = markedDates?.[key];
              return (
                <button
                  type="button"
                  key={key}
                  className={styles.day}
                  data-out={day.getMonth() !== view.getMonth() || undefined}
                  data-today={key === today || undefined}
                  data-dow={day.getDay()}
                  aria-pressed={key === value}
                  onClick={() => {
                    onChange(key);
                    setOpen(false);
                  }}
                >
                  {day.getDate()}
                  {/* 일정 색은 데이터로 정해지는 값 — 인라인 허용 */}
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
