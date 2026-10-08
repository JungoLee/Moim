'use client';

import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import Avatar from '@/components/Avatar';
import Icon from '@/components/Icon';
import { dateKey, DOW_KO, todayKey } from '@/lib/datetime';
import { displayName } from '@/lib/format';
import { heatLevel } from '@/lib/roomCandidates';
import type { DaySummary } from '@/lib/roomCandidates';
import type { Mark, User } from '@/lib/types';
import { dayWords, markWords } from './format';
import { useDragSelect } from './useDragSelect';
import styles from './MemberMatrix.module.scss';

type Props = {
  /** 나 먼저 정렬된 멤버 */
  members: User[];
  meId: string;
  availabilities: Record<string, Mark[]>;
  summary: Record<string, DaySummary>;
  total: number;
  /** 보는 달 (1일) */
  month: Date;
  holidays: Record<string, string>;
  /** 내 줄 고치기가 켜져 있으면 내 줄 칸이 눌린다 */
  editing: boolean;
  onApply: (dates: string[], isDrag: boolean) => void;
};

/**
 * 표 보기의 표 — 줄 = 멤버(나 먼저), 칸 = 그 달의 날짜, 맨 아래 '되는 사람' 합계.
 * 전원 가능한 날은 머리·합계를 진하게, 칸에 테두리. 내 줄만 누르기·끌기로 고친다. 넓으면 상자 안 가로 스크롤.
 */
export default function MemberMatrix({ members, meId, availabilities, summary, total, month, holidays, editing, onApply }: Props) {
  const today = todayKey();
  const monthIdx = month.getMonth();
  const days = useMemo(() => {
    const n = new Date(month.getFullYear(), monthIdx + 1, 0).getDate();
    return Array.from({ length: n }, (_, i) => new Date(month.getFullYear(), monthIdx, i + 1));
  }, [month, monthIdx]);
  const keys = useMemo(() => days.map(dateKey), [days]);
  const marksBy = useMemo(() => {
    const out: Record<string, Record<string, Mark>> = {};
    for (const [uid, list] of Object.entries(availabilities)) {
      const m: Record<string, Mark> = {};
      for (const x of list) m[x.date] = x;
      out[uid] = m;
    }
    return out;
  }, [availabilities]);

  const drag = useDragSelect({ keys, isDisabled: (k) => k < today, onApply });
  const tableStyle = { '--n': days.length } as CSSProperties;

  return (
    <div className={styles.scroll} tabIndex={0} role="region" aria-label="사람별 가능 날짜 표 (가로로 밀어 볼 수 있어요)">
      <table className={styles.table} style={tableStyle} {...drag.bind} data-editing={editing || undefined}>
        <caption className="ui-sr-only">{`${month.getFullYear()}년 ${monthIdx + 1}월 사람별 가능 날짜`}</caption>
        <thead>
          <tr>
            <th scope="col" className={styles.corner}>
              {monthIdx + 1}월
            </th>
            {days.map((d) => {
              const key = dateKey(d);
              const level = heatLevel(summary[key], total);
              const holiday = holidays[key];
              const dow = d.getDay();
              return (
                <th
                  key={key}
                  scope="col"
                  className={styles.head}
                  data-all={level === 5 || undefined}
                  data-dow={dow === 0 || holiday ? 'sun' : dow === 6 ? 'sat' : undefined}
                  data-today={key === today || undefined}
                  data-past={key < today || undefined}
                  title={holiday || undefined}
                  aria-label={`${d.getDate()}일 ${DOW_KO[dow]}요일${holiday ? `, ${holiday}` : ''}`}
                >
                  <span className={styles.dow}>{DOW_KO[dow]}</span>
                  <span className={styles.dnum}>{d.getDate()}</span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {members.map((m) => {
            const mine = m._id === meId;
            const name = displayName(m);
            const map = marksBy[m._id] || {};
            return (
              <tr key={m._id} data-mine={mine || undefined}>
                <th scope="row" className={styles.who}>
                  <span className={styles.whoInner}>
                    <Avatar src={m.picture} name={name} id={m._id} size="sm" />
                    <span className={styles.whoName}>{mine ? `${name} (나)` : name}</span>
                  </span>
                </th>
                {days.map((d) => {
                  const key = dateKey(d);
                  const mk = map[key];
                  const state = mk ? (mk.status === 'yes' ? 'yes' : mk.status === 'after' ? 'after' : 'no') : 'none';
                  const all = heatLevel(summary[key], total) === 5;
                  const past = key < today;
                  const words = `${name}, ${dayWords(d)}: ${markWords(mk)}`;
                  const face = (
                    <>
                      {state === 'yes' && <Icon name="check" size={13} stroke={3} />}
                      {state === 'after' && <span className={styles.hour}>{(mk?.time || '').slice(0, 2)}</span>}
                      {state === 'no' && <span aria-hidden="true">×</span>}
                    </>
                  );
                  return (
                    <td key={key} className={styles.td} data-all={all || undefined} data-past={past || undefined}>
                      {mine && editing ? (
                        <button
                          type="button"
                          className={styles.cell}
                          data-key={key}
                          data-state={state}
                          data-selecting={drag.selected?.has(key) || undefined}
                          disabled={past}
                          aria-label={words}
                        >
                          {face}
                        </button>
                      ) : (
                        <span className={styles.cell} data-state={state}>
                          {face}
                          <span className="ui-sr-only">{words}</span>
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" className={styles.who}>
              <span className={styles.whoInner}>
                <span className={styles.whoName}>되는 사람</span>
              </span>
            </th>
            {days.map((d) => {
              const key = dateKey(d);
              const s = summary[key];
              const level = heatLevel(s, total);
              const yes = s?.yes ?? 0;
              const after = s?.after ?? 0;
              return (
                <td
                  key={key}
                  className={styles.sum}
                  data-all={level === 5 || undefined}
                  data-high={level === 4 || undefined}
                  data-past={key < today || undefined}
                >
                  <span aria-hidden="true">
                    {yes}
                    {after > 0 ? '+' : ''}
                  </span>
                  <span className="ui-sr-only">{`${dayWords(d)}, ${total}명 중 ${yes}명 가능${after > 0 ? `, 저녁 이후 ${after}명` : ''}`}</span>
                </td>
              );
            })}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
