'use client';

import { useState } from 'react';
import Icon from '@/components/Icon';
import { fmtKeyRange } from '@/lib/datetime';
import { displayName } from '@/lib/format';
import type { Candidate } from '@/lib/roomCandidates';
import type { RoomConfirmed, User } from '@/lib/types';
import { hourText } from './format';
import styles from './CandidateList.module.scss';

const DAY_WORD: Record<number, string> = { 2: '이틀', 3: '사흘', 4: '나흘' };

type Described = {
  range: string;
  /** 1순위일 때 쓰는 '추천 · …' */
  tag: string;
  desc: string;
  /** 표 보기 큰 숫자 — '5/5' · '4+' */
  n: string;
  tone: 'accent' | 'warn';
};

/** 후보 한 개를 사람이 읽는 말로 */
export function describeCandidate(c: Candidate, total: number, members: User[]): Described {
  const range = fmtKeyRange(c.start, c.end);
  if (c.kind === 'partial') {
    const yes = total - c.afterIds.length;
    const names = c.afterIds
      .map((id) => members.find((m) => m._id === id))
      .filter((m): m is User => !!m)
      .map(displayName)
      .join('·');
    return {
      range,
      tag: '추천 · 시간을 맞추면 모두',
      desc: `${yes}명 + ${names} ${hourText(c.afterMax)} 이후`,
      n: `${yes}+`,
      tone: 'warn',
    };
  }
  return {
    range,
    tag: c.kind === 'run' ? `추천 · 연속 ${DAY_WORD[c.days] || `${c.days}일`}` : '추천 · 모두 가능',
    desc: `${total}명 모두 종일 가능${c.kind === 'run' ? ` · ${c.days}일 연속` : ''}`,
    n: `${total}/${total}`,
    tone: 'accent',
  };
}

type Props = {
  cands: Candidate[];
  confirmed: RoomConfirmed | null;
  isOwner: boolean;
  total: number;
  members: User[];
  /** changing = 이미 확정된 방에서 날짜를 바꾸는 중 */
  onConfirm: (c: Candidate, changing: boolean) => void;
  onUnconfirm: () => void;
};

/**
 * 후보 목록 — 1순위는 큰 카드, 방장만 [확정]. 확정된 방은 맨 위에 '확정된 날짜' 카드(방장: 바꾸기·확정 취소).
 */
export default function CandidateList({ cands, confirmed, isOwner, total, members, onConfirm, onUnconfirm }: Props) {
  const [changing, setChanging] = useState(false);
  const showList = !confirmed || (isOwner && changing);

  return (
    <div className={styles.wrap} data-guide="room-cands">
      {confirmed && (
        <div className={styles.confirmed}>
          <span className="ui-chip ui-chip--accent">
            <Icon name="check" size={13} stroke={3} />
            확정된 날짜
          </span>
          <strong className={styles.confirmedDate}>{fmtKeyRange(confirmed.start, confirmed.end)}</strong>
          <span className={styles.desc}>멤버 {total}명의 캘린더에 비공개 일정으로 들어가 있어요</span>
          {isOwner && (
            <div className={styles.confirmedActions}>
              <button type="button" className="ui-btn ui-btn--sm" aria-pressed={changing} onClick={() => setChanging((v) => !v)}>
                {changing ? '바꾸기 닫기' : '바꾸기'}
              </button>
              <button type="button" className="ui-btn ui-btn--sm ui-btn--danger" onClick={onUnconfirm}>
                확정 취소
              </button>
            </div>
          )}
        </div>
      )}

      {showList &&
        (cands.length === 0 ? (
          <p className={styles.empty}>
            아직 모두 되는 날이 없어요. 가능한 날을 표시하면 모두 되는 날을 찾아 드려요.
          </p>
        ) : (
          <ol className={styles.list}>
            {cands.map((c, i) => {
              const d = describeCandidate(c, total, members);
              const first = i === 0 && !confirmed;
              const btnText = confirmed ? '이 날로 바꾸기' : first ? '이 날로 확정' : '확정';
              return (
                <li key={`${c.start}-${c.end}-${c.kind}`} className={styles.item} data-first={first || undefined} data-tone={d.tone}>
                  {first && <span className={styles.tag}>{d.tag}</span>}
                  <span className={styles.n} aria-hidden="true">
                    {d.n}
                  </span>
                  <span className={styles.main}>
                    <strong className={styles.date}>{d.range}</strong>
                    <span className={styles.desc}>{d.desc}</span>
                  </span>
                  {isOwner && (
                    <button
                      type="button"
                      className={styles.btn}
                      data-first={first || undefined}
                      onClick={() => onConfirm(c, !!confirmed)}
                      aria-label={`${btnText}, ${d.range}`}
                    >
                      {btnText}
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
        ))}

      {showList && cands.length > 0 && (
        <p className={styles.note}>
          {isOwner ? `확정하면 ${total}명 모두의 캘린더에 비공개 일정으로 들어가요.` : '방장이 확정할 수 있어요.'}
        </p>
      )}
    </div>
  );
}

type StripProps = {
  cands: Candidate[];
  confirmed: RoomConfirmed | null;
  isOwner: boolean;
  total: number;
  members: User[];
  onConfirm: (c: Candidate, changing: boolean) => void;
  /** '모두 보기' — 후보 시트 열기 */
  onMore: () => void;
};

/** 모바일 아래 탭 위에 붙는 띠 — 확정된 날짜, 없으면 1순위 후보 + [확정] */
export function CandidateStrip({ cands, confirmed, isOwner, total, members, onConfirm, onMore }: StripProps) {
  if (confirmed) {
    return (
      <div className={styles.strip} data-state="confirmed">
        <span className={styles.stripMain}>
          <span className={styles.stripTag}>확정된 날짜</span>
          <strong className={styles.stripDate}>{fmtKeyRange(confirmed.start, confirmed.end)}</strong>
        </span>
        {isOwner && (
          <button type="button" className={styles.stripMore} onClick={onMore}>
            바꾸기
          </button>
        )}
      </div>
    );
  }
  if (cands.length === 0) return null;
  const first = cands[0];
  const d = describeCandidate(first, total, members);
  return (
    <div className={styles.strip}>
      <span className={styles.stripMain}>
        <span className={styles.stripTag}>{d.tag}</span>
        <strong className={styles.stripDate}>{d.range}</strong>
        <span className={styles.stripDesc}>{d.desc}</span>
      </span>
      <span className={styles.stripSide}>
        {isOwner ? (
          <button type="button" className="ui-btn ui-btn--primary" onClick={() => onConfirm(first, false)}>
            확정
          </button>
        ) : (
          <span className={styles.stripWait}>방장이 확정해요</span>
        )}
        {cands.length > 1 && (
          <button type="button" className={styles.stripMore} onClick={onMore}>
            후보 {cands.length}개 보기
          </button>
        )}
      </span>
    </div>
  );
}
