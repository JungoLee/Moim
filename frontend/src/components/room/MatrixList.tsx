'use client';

import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import Avatar from '@/components/Avatar';
import { dateKey, DOW_KO, todayKey } from '@/lib/datetime';
import { displayName } from '@/lib/format';
import { heatLevel } from '@/lib/roomCandidates';
import type { DaySummary } from '@/lib/roomCandidates';
import type { Mark, User } from '@/lib/types';
import { dayWords, markWords } from './format';
import styles from './MatrixList.module.scss';

export type MatrixFilter = 'all' | 'three' | 'full';

const FILTERS: Array<[MatrixFilter, string]> = [
  ['all', '전체'],
  ['three', '3명 이상'],
  ['full', '모두 가능'],
];

/** 거르기 칩 — 표 모바일 머리에 놓는다 */
export function MatrixFilters({
  value,
  onChange,
  total,
}: {
  value: MatrixFilter;
  onChange: (f: MatrixFilter) => void;
  total: number;
}) {
  return (
    <div className={styles.filters} role="group" aria-label="날짜 거르기">
      {FILTERS.filter(([f]) => f !== 'three' || total >= 4).map(([f, label]) => (
        <button key={f} type="button" aria-pressed={value === f} onClick={() => onChange(f)}>
          {label}
        </button>
      ))}
    </div>
  );
}

type Props = {
  /** 나 먼저 정렬된 멤버 */
  members: User[];
  meId: string;
  availabilities: Record<string, Mark[]>;
  summary: Record<string, DaySummary>;
  total: number;
  month: Date;
  holidays: Record<string, string>;
  filter: MatrixFilter;
  /** '내 줄 고치기' — 켜면 날짜 줄을 눌러 내 칸을 바꾼다 */
  editing: boolean;
  onApply: (dates: string[], isDrag: boolean) => void;
};

/** 표 보기 모바일 — 줄 = 날짜(오늘부터), 칸 = 멤버, 끝에 '되는 수'. 전원 가능한 날은 진하게 */
export default function MatrixList({ members, meId, availabilities, summary, total, month, holidays, filter, editing, onApply }: Props) {
  const today = todayKey();
  const monthIdx = month.getMonth();
  const marksBy = useMemo(() => {
    const out: Record<string, Record<string, Mark>> = {};
    for (const [uid, list] of Object.entries(availabilities)) {
      const m: Record<string, Mark> = {};
      for (const x of list) m[x.date] = x;
      out[uid] = m;
    }
    return out;
  }, [availabilities]);

  const rows = useMemo(() => {
    const n = new Date(month.getFullYear(), monthIdx + 1, 0).getDate();
    const out: Date[] = [];
    for (let i = 1; i <= n; i++) {
      const d = new Date(month.getFullYear(), monthIdx, i);
      const key = dateKey(d);
      if (key < today) continue;
      const s = summary[key];
      if (filter === 'three' && (s?.yes ?? 0) < 3) continue;
      if (filter === 'full' && heatLevel(s, total) !== 5) continue;
      out.push(d);
    }
    return out;
  }, [month, monthIdx, today, summary, total, filter]);

  const gridStyle = { '--m': members.length } as CSSProperties;

  return (
    <div className={styles.scroll}>
      <div className={styles.inner} style={gridStyle}>
        <div className={styles.headRow} aria-hidden="true">
          <span />
          {members.map((m) => (
            <span key={m._id} className={styles.who}>
              <Avatar src={m.picture} name={displayName(m)} id={m._id} size="sm" />
            </span>
          ))}
          <span className={styles.sumHead}>되는 수</span>
        </div>

        {rows.length === 0 ? (
          <p className={styles.empty}>{filter === 'all' ? '이 달에는 남은 날짜가 없어요' : '조건에 맞는 날이 없어요'}</p>
        ) : (
          <ul className={styles.list}>
            {rows.map((d) => {
              const key = dateKey(d);
              const s = summary[key];
              const level = heatLevel(s, total);
              const yes = s?.yes ?? 0;
              const after = s?.after ?? 0;
              const holiday = holidays[key];
              const dow = d.getDay();
              const mine = marksBy[meId]?.[key];
              const content = (
                <>
                  <span className={styles.date} data-dow={dow === 0 || holiday ? 'sun' : dow === 6 ? 'sat' : undefined}>
                    <span className={styles.num}>{d.getDate()}</span>
                    <span className={styles.dowText}>{DOW_KO[dow]}</span>
                  </span>
                  {members.map((m) => {
                    const mk = marksBy[m._id]?.[key];
                    const state = mk ? mk.status : 'none';
                    return (
                      <span key={m._id} className={styles.cell} data-state={state} data-me={m._id === meId || undefined}>
                        {!editing && <span className="ui-sr-only">{`${displayName(m)}: ${markWords(mk)}`}</span>}
                      </span>
                    );
                  })}
                  <span className={styles.count} aria-hidden="true">
                    {after > 0 ? `${yes}+` : `${yes}/${total}`}
                  </span>
                </>
              );
              const summaryText = `${dayWords(d)}${holiday ? `, ${holiday}` : ''}, ${total}명 중 ${yes}명 가능${after > 0 ? `, 저녁 이후 ${after}명` : ''}`;
              return (
                <li key={key}>
                  {editing ? (
                    <button
                      type="button"
                      className={styles.row}
                      data-level={level}
                      data-editing
                      onClick={() => onApply([key], false)}
                      aria-label={`${summaryText}, 내 표시: ${markWords(mine)}. 누르면 바꿔요`}
                    >
                      {content}
                    </button>
                  ) : (
                    <div className={styles.row} data-level={level} role="group" aria-label={summaryText}>
                      {content}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
