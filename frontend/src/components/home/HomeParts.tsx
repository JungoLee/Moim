'use client';

import Link from 'next/link';
import Icon from '@/components/Icon';
import { fmtDay, fmtDayRange } from '@/lib/datetime';
import { metricLabel } from '@/lib/leave';
import type { InboxItem, LeaveSuggestion } from '@/components/home/useHomeData';
import styles from './HomeParts.module.scss';

// 홈 두 보기가 같이 쓰는 작은 부품 — 수락/거절 버튼 · 추천 연차 카드 · 불러오는 중 자리

/** 수락·거절 — 그 자리에서 처리. 처리 중에는 둘 다 잠근다 */
export function AnswerButtons({
  item,
  pending,
  onAnswer,
  accent,
  block,
}: {
  item: InboxItem;
  pending: boolean;
  onAnswer: (item: InboxItem, action: 'accept' | 'decline') => void;
  /** true = 수락을 틸 채움(보드), false = 주 버튼(표) */
  accent?: boolean;
  /** 카드 폭을 반씩 */
  block?: boolean;
}) {
  const who = item.title;
  return (
    <div className={block ? `${styles.answer} ${styles.answerBlock}` : styles.answer}>
      <button
        type="button"
        className={`ui-btn ui-btn--sm ${accent ? 'ui-btn--accent' : 'ui-btn--primary'}`}
        disabled={pending}
        onClick={() => onAnswer(item, 'accept')}
        aria-label={`${who} 수락`}
      >
        수락
      </button>
      <button
        type="button"
        className="ui-btn ui-btn--sm"
        disabled={pending}
        onClick={() => onAnswer(item, 'decline')}
        aria-label={`${who} 거절`}
      >
        거절
      </button>
    </div>
  );
}

/** 추천 연차 — computeLeavePlan 의 첫 항목 */
export function LeaveCard({ leave }: { leave: LeaveSuggestion }) {
  const b = leave.bridge;
  const head =
    b.leaveDays === 1
      ? `${fmtDay(b.bridgeStart)} 하루 쓰면 ${b.totalDays}일 쉬어요`
      : `${fmtDayRange(b.bridgeStart, b.bridgeEnd)} ${b.leaveDays}일 쓰면 ${b.totalDays}일 쉬어요`;
  const holidays = b.holidayNames.length > 0 ? ` · ${b.holidayNames.join(' · ')} 낀 연휴` : '';
  return (
    <section className={`ui-card ${styles.leave}`} aria-label="추천 연차" data-guide="home-leave">
      <div className={styles.leaveHead}>
        <span className={styles.leaveLabel}>
          <Icon name="sun" size={16} />
          추천 연차
        </span>
        <span className="ui-chip ui-chip--accent" title="연차 1일당 쉬는 날(또는 순이익 점수)">
          {metricLabel(b, leave.style)}
        </span>
      </div>
      <p className={styles.leaveMain}>{head}</p>
      <p className={styles.leaveSub}>
        {fmtDayRange(b.spanStart, b.spanEnd)}
        {holidays}
      </p>
      <p className={styles.leaveSub}>
        전체 계획은 연차 {leave.comboLeave}일로 {leave.comboOff}일 휴무
      </p>
      <Link href="/tools/leave" className={styles.leaveLink}>
        연차 계산 열기 <Icon name="chevron-right" size={14} />
      </Link>
    </section>
  );
}

/** 불러오는 중 — "없습니다"를 먼저 보이지 않게 막대로 자리 잡는다 */
export function SkeletonBlock({ lines = 3, label }: { lines?: number; label: string }) {
  return (
    <div className={styles.skeleton} role="status" aria-label={label}>
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className="ui-skeleton" />
      ))}
    </div>
  );
}
