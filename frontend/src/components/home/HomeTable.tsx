'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Avatar from '@/components/Avatar';
import Icon from '@/components/Icon';
import PageHeader from '@/components/PageHeader';
import { displayName } from '@/lib/format';
import { DOW_KO, dateKey, fmtDayRange, fmtDayWords } from '@/lib/datetime';
import { getHolidays } from '@/lib/holidays';
import { roomStatus } from '@/lib/roomStatus';
import { useOutsideClose } from '@/lib/useOutsideClose';
import { useEscClose } from '@/lib/useEscClose';
import { BANDS, busyBands } from '@/components/home/week';
import { AnswerButtons, LeaveCard, SkeletonBlock } from '@/components/home/HomeParts';
import type { HomeData } from '@/components/home/useHomeData';
import type { User } from '@/lib/types';
import styles from './HomeTable.module.scss';

const STORAGE_KEY = 'moim_home_friends';
const DEFAULT_SHOWN = 5;

type Row = { id: string; name: string; user: User | null | undefined; mine: boolean; days: boolean[][] };

function readPicked(): string[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : null;
  } catch {
    return null;
  }
}

function writePicked(ids: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* 사생활 보호 모드 등 — 이번 화면에서만 적용된다 */
  }
}

/** 홈 — 표 테마. 이번 주 누가 언제 비나(나 + 친구 × 7일 × 3띠) + 오른쪽 답할 것·내 모임·추천 연차 (docs 6-2) */
export default function HomeTable({ data }: { data: HomeData }) {
  const { me, days, ready, inbox, rooms, leave, friends, friendBusy, friendsReady, weekEvents, pendingKey, answer } = data;

  // 보는 친구 — null 이면 아직 고른 적 없음(앞에서 다섯 명)
  const [picked, setPicked] = useState<string[] | null>(null);
  useEffect(() => setPicked(readPicked()), []);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  useOutsideClose(pickerRef, pickerOpen, () => setPickerOpen(false));
  useEscClose(() => setPickerOpen(false), pickerOpen);

  const shown = useMemo(
    () => (picked === null ? friends.slice(0, DEFAULT_SHOWN) : friends.filter((f) => picked.includes(f._id))),
    [friends, picked]
  );

  function setShown(ids: string[]) {
    setPicked(ids);
    writePicked(ids);
  }
  function toggleFriend(id: string) {
    const cur = shown.map((f) => f._id);
    setShown(cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  }

  const holidays = useMemo(() => getHolidays([days[0].getFullYear(), days[6].getFullYear()]), [days]);

  const rows: Row[] = useMemo(() => {
    const byUser = new Map<string, typeof friendBusy>();
    for (const b of friendBusy) byUser.set(b.userId, [...(byUser.get(b.userId) || []), b]);
    const mine: Row = {
      id: 'me',
      name: me ? displayName(me) : '나',
      user: me,
      mine: true,
      days: days.map((d) => busyBands(weekEvents, d)),
    };
    const others: Row[] = shown.map((f) => ({
      id: f._id,
      name: displayName(f),
      user: f,
      mine: false,
      days: days.map((d) => busyBands(byUser.get(f._id) || [], d)),
    }));
    return [mine, ...others];
  }, [me, days, weekEvents, shown, friendBusy]);

  // 다 같이 빔 — 보이는 사람 전원이 비는 띠
  const common = useMemo(
    () =>
      days.map((_, di) => {
        const free = BANDS.filter((_b, bi) => rows.every((r) => !r.days[di][bi]));
        return free.length === BANDS.length ? ['종일'] : free.map((b) => b.label);
      }),
    [days, rows]
  );

  const range = fmtDayRange(days[0], days[days.length - 1]);
  const tableReady = ready && friendsReady;

  return (
    <>
      <PageHeader
        title="이번 주, 누가 언제 비나"
        sub={`${range} · 친구 일정은 “바쁨”만 보여요`}
        actions={
          <Link href="/dashboard?new=1" className="ui-btn ui-btn--primary">
            <Icon name="plus" size={16} stroke={2.4} />새 일정
          </Link>
        }
      />
      {data.error && (
        <p className="ui-error" role="alert">
          {data.error}
        </p>
      )}

      <div className="ui-grid-2">
        <section className={`ui-card ui-grid-2__main ${styles.free}`} aria-label="이번 주 누가 비나" data-guide="home-free">
          {!tableReady ? (
            <SkeletonBlock lines={6} label="이번 주 일정을 불러오는 중" />
          ) : (
            <>
              <div className={styles.scroll}>
                <table className={styles.table}>
                  <caption className="ui-sr-only">{`${range} 사람별 바쁜 시간. 칸 하나는 위부터 오전, 오후, 저녁`}</caption>
                  <thead>
                    <tr>
                      <td className={styles.corner} />
                      {days.map((d, i) => {
                        const holiday = holidays[dateKey(d)];
                        return (
                          <th
                            key={dateKey(d)}
                            scope="col"
                            className={styles.dayHead}
                            aria-current={i === 0 ? 'date' : undefined}
                            data-off={d.getDay() === 0 || holiday ? 'sun' : d.getDay() === 6 ? 'sat' : undefined}
                          >
                            <span className={styles.dow}>{DOW_KO[d.getDay()]}</span>
                            <span className={`ui-num ${styles.num}`}>{d.getDate()}</span>
                            <span className={styles.holiday}>{holiday || ''}</span>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id}>
                        <th scope="row" className={styles.who} data-mine={r.mine || undefined}>
                          <Avatar src={r.user?.picture} name={r.name} id={r.user?._id} size="sm" />
                          <span className={styles.whoName}>{r.mine ? '나' : r.name}</span>
                        </th>
                        {days.map((d, di) => (
                          <td key={dateKey(d)} className={styles.cell}>
                            <div
                              className={styles.bands}
                              role="img"
                              aria-label={`${r.mine ? '나' : r.name}, ${fmtDayWords(d)}: ${BANDS.map(
                                (b, bi) => `${b.label} ${r.days[di][bi] ? '바쁨' : '빔'}`
                              ).join(', ')}`}
                            >
                              {BANDS.map((b, bi) => (
                                <span key={b.key} className={styles.band} data-busy={r.days[di][bi] || undefined} />
                              ))}
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th scope="row" className={styles.commonLabel}>
                        다 같이 빔
                      </th>
                      {days.map((d, di) => (
                        <td key={dateKey(d)} className={styles.commonCell}>
                          <span
                            className={styles.common}
                            role="img"
                            data-empty={common[di].length === 0 || undefined}
                            aria-label={`${d.getMonth() + 1}월 ${d.getDate()}일 다 같이 빔: ${common[di].length ? common[di].join(', ') : '없음'}`}
                          >
                            {common[di].length === 0 ? (
                              <span aria-hidden>–</span>
                            ) : (
                              common[di].map((t) => (
                                <span key={t} aria-hidden>
                                  {t}
                                </span>
                              ))
                            )}
                          </span>
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="ui-legend">
                <span>칸 하나 = 위부터 오전 · 오후 · 저녁</span>
                <span>
                  <i className={`ui-legend__sw ${styles.swBusy}`} />
                  바쁨
                </span>
                <span>
                  <i className={`ui-legend__sw ${styles.swFree}`} />빔
                </span>
              </div>

              {friends.length === 0 && (
                <p className={styles.hint}>
                  아직 친구가 없어요. <Link href="/friends">친구를 추가</Link>하면 같이 비는 시간을 찾아드려요.
                </p>
              )}

              <div className={styles.tools}>
                <Link href="/rooms?new=1" className="ui-btn ui-btn--primary">
                  모임 만들기
                </Link>
                <div className={styles.picker} ref={pickerRef}>
                  <button
                    type="button"
                    className="ui-btn"
                    aria-expanded={pickerOpen}
                    aria-haspopup="true"
                    onClick={() => setPickerOpen((o) => !o)}
                    disabled={friends.length === 0}
                  >
                    보는 친구 고르기
                    <span className="ui-num ui-muted">
                      {shown.length}/{friends.length}
                    </span>
                  </button>
                  {pickerOpen && (
                    <div className={`ui-popover ${styles.pop}`} role="group" aria-label="보는 친구">
                      <div className={styles.popHead}>
                        <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={() => setShown(friends.map((f) => f._id))}>
                          모두 보기
                        </button>
                        <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={() => setShown([])}>
                          모두 끄기
                        </button>
                      </div>
                      <div className="ui-menu">
                        {friends.map((f) => {
                          const on = shown.some((s) => s._id === f._id);
                          return (
                            <button key={f._id} type="button" aria-pressed={on} onClick={() => toggleFriend(f._id)}>
                              <Avatar src={f.picture} name={displayName(f)} id={f._id} size="sm" />
                              <span className={styles.popName}>{displayName(f)}</span>
                              {on && <Icon name="check" size={16} stroke={2.6} />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </section>

        <aside className="ui-grid-2__side" aria-label="답할 것과 내 모임">
          <section className="ui-card" aria-label="답할 것" data-guide="home-inbox">
            <div className="ui-card__head">
              <h2 className="ui-card__title">
                답할 것{' '}
                {ready && inbox.length > 0 && (
                  <span className="ui-badge" aria-label={`답할 것 ${inbox.length}개`}>
                    {inbox.length}
                  </span>
                )}
              </h2>
            </div>
            {!ready ? (
              <SkeletonBlock lines={3} label="답할 것을 불러오는 중" />
            ) : inbox.length === 0 ? (
              <p className="ui-muted">지금 답할 것이 없어요</p>
            ) : (
              <ul className="ui-list">
                {inbox.map((q) => (
                  <li key={q.key} className="ui-row">
                    <Avatar src={q.person?.picture} name={q.person ? displayName(q.person) : ''} id={q.person?._id} size="sm" />
                    <div className="ui-row__main">
                      <span className="ui-row__title">{q.title}</span>
                      <span className="ui-row__sub">{q.when}</span>
                    </div>
                    <div className="ui-row__side">
                      <AnswerButtons item={q} pending={pendingKey === q.key} onAnswer={answer} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="ui-card" aria-label="내 모임" data-guide="home-rooms">
            <div className="ui-card__head">
              <h2 className="ui-card__title">내 모임</h2>
              <Link href="/rooms" className={styles.more}>
                모임 <Icon name="chevron-right" size={14} />
              </Link>
            </div>
            {!ready ? (
              <SkeletonBlock lines={3} label="내 모임을 불러오는 중" />
            ) : rooms.length === 0 ? (
              <p className="ui-muted">
                아직 모임이 없어요. <Link href="/rooms?new=1">새 모임 만들기</Link>
              </p>
            ) : (
              <ul className="ui-list">
                {rooms.map((r) => {
                  const st = roomStatus(r);
                  return (
                    <li key={r._id}>
                      <Link href={`/rooms/detail?id=${r._id}`} className={`ui-row ${styles.roomRow}`}>
                        <span className="ui-row__main">
                          <span className="ui-row__title">{r.name}</span>
                        </span>
                        <span className={`ui-num ${styles.done}`}>
                          {r.markedCount}/{r.memberCount}
                        </span>
                        <span className={`ui-chip ui-chip--${st.tone}`}>{st.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {ready && leave && <LeaveCard leave={leave} />}
        </aside>
      </div>
    </>
  );
}
