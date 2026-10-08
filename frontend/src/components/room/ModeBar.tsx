'use client';

import Icon from '@/components/Icon';
import TimeSelect from '@/components/TimeSelect';
import type { AvailStatus } from '@/lib/types';
import styles from './ModeBar.module.scss';

const MODES: Array<[AvailStatus, string]> = [
  ['yes', '되는 날'],
  ['no', '안 되는 날'],
  ['after', '저녁 이후'],
];

type Props = {
  mode: AvailStatus;
  onMode: (m: AvailStatus) => void;
  afterTime: string;
  onAfterTime: (t: string) => void;
  /** 내 표시 지우기 — 지울 게 없으면 꺼진다 */
  onReset: () => void;
  canReset: boolean;
  onRefresh?: () => void;
  /** 바깥에서 덧붙일 클래스 */
  className?: string;
};

/** 표시 방법 고르기 — [되는 날 · 안 되는 날 · 저녁 이후] + 저녁 이후일 때 시각 + 내 표시 지우기 */
export default function ModeBar({ mode, onMode, afterTime, onAfterTime, onReset, canReset, onRefresh, className }: Props) {
  return (
    <div className={[styles.bar, className].filter(Boolean).join(' ')} data-guide="room-modes">
      <div className={`ui-seg ${styles.seg}`} role="group" aria-label="표시 방법">
        {MODES.map(([v, label]) => (
          <button key={v} type="button" data-mode={v} aria-pressed={mode === v} onClick={() => onMode(v)}>
            {label}
          </button>
        ))}
      </div>
      {mode === 'after' && (
        <div className={styles.time} role="group" aria-label="이 시각 이후 가능">
          <TimeSelect value={afterTime} onChange={onAfterTime} />
          <span className={styles.timeText}>이후</span>
        </div>
      )}
      <span className={styles.tools}>
        <button type="button" className="ui-btn ui-btn--sm ui-btn--ghost" onClick={onReset} disabled={!canReset}>
          <Icon name="eraser" size={16} />
          내 표시 지우기
        </button>
        {onRefresh && (
          <button type="button" className="ui-btn ui-btn--sm ui-btn--ghost ui-btn--icon" onClick={onRefresh} aria-label="새로고침" title="다른 사람이 찍은 것 다시 받기">
            <Icon name="refresh" size={16} />
          </button>
        )}
      </span>
    </div>
  );
}
