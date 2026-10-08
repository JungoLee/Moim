'use client';

import Icon from '@/components/Icon';
import { fmtMonth } from '@/lib/datetime';
import styles from './MonthNav.module.scss';

type Props = {
  /** 보는 달 (1일) */
  month: Date;
  onShift: (n: number) => void;
  onToday?: () => void;
  className?: string;
  /** 라벨을 '11월' 처럼 짧게 */
  short?: boolean;
};

/** ‹ 2026년 11월 › — 달 이동 */
export default function MonthNav({ month, onShift, onToday, className, short }: Props) {
  return (
    <div className={[styles.nav, className].filter(Boolean).join(' ')} role="group" aria-label="달 이동">
      <button type="button" className="ui-btn ui-btn--ghost ui-btn--icon ui-btn--sm" onClick={() => onShift(-1)} aria-label="이전 달">
        <Icon name="chevron-left" size={18} />
      </button>
      <strong className={styles.label} aria-live="polite">
        {short ? `${month.getMonth() + 1}월` : fmtMonth(month)}
      </strong>
      <button type="button" className="ui-btn ui-btn--ghost ui-btn--icon ui-btn--sm" onClick={() => onShift(1)} aria-label="다음 달">
        <Icon name="chevron-right" size={18} />
      </button>
      {onToday && (
        <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={onToday}>
          오늘
        </button>
      )}
    </div>
  );
}
