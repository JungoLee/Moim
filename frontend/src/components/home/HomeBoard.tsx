'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import Avatar from '@/components/Avatar';
import Icon from '@/components/Icon';
import PageHeader from '@/components/PageHeader';
import { displayName } from '@/lib/format';
import { eventColor } from '@/lib/colors';
import { DOW_KO, dateKey, fmtDayWords, fmtTime } from '@/lib/datetime';
import { getHolidays } from '@/lib/holidays';
import { roomStatus } from '@/lib/roomStatus';
import { eventsOnDay } from '@/components/home/week';
import { AnswerButtons, LeaveCard, SkeletonBlock } from '@/components/home/HomeParts';
import type { HomeData } from '@/components/home/useHomeData';
import styles from './HomeBoard.module.scss';

const MAX_ROOMS = 4;

/** 홈 — 보드 테마. 답할 것 카드 줄 → 이번 주 7칸 → 내 모임 카드 · 추천 연차 (docs 6-2) */
export default function HomeBoard({ data }: { data: HomeData }) {
  const { me, today, days, ready, inbox, weekEvents, rooms, leave, pendingKey, answer } = data;
  const name = me ? displayName(me) : '';

  const eyebrow = fmtDayWords(today);
  let title: string;
  if (!ready) title = name ? `${name} 님, 안녕하세요` : '홈';
  else if (inbox.length > 0) title = `${name} 님, 답할 게 ${inbox.length}개 있어요`;
  else if (data.todayEventCount > 0) title = `오늘 일정 ${data.todayEventCount}개`;
  else title = '오늘은 비어 있어요';

  // 오늘이 든 달과 다음 달까지의 공휴일 이름
  const holidays = getHolidays([today.getFullYear(), today.getFullYear() + 1]);

  return (
    <>
      <PageHeader
        eyebrow={eyebrow}
        title={title}
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

      <section aria-label="답할 것" data-guide="home-inbox">
        {!ready ? (
          <div className={styles.inbox}>
            <div className={styles.qCard}>
              <SkeletonBlock lines={3} label="답할 것을 불러오는 중" />
            </div>
          </div>
        ) : inbox.length === 0 ? (
          <p className={styles.nothing}>
            <Icon name="check" size={16} stroke={2.4} />
            지금 답할 것이 없어요
          </p>
        ) : (
          <ul className={styles.inbox}>
            {inbox.map((q) => (
              <li key={q.key} className={styles.qCard}>
                <div className={styles.qHead}>
                  <Avatar src={q.person?.picture} name={q.person ? displayName(q.person) : ''} id={q.person?._id} />
                  <div className={styles.qText}>
                    <span className={styles.qKind} data-kind={q.kind}>
                      {q.kindLabel}
                    </span>
                    <span className={styles.qTitle}>{q.title}</span>
                  </div>
                </div>
                <span className={styles.qWhen}>{q.when}</span>
                <AnswerButtons item={q} pending={pendingKey === q.key} onAnswer={answer} accent block />
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="ui-grid-2">
        <section className={`ui-card ui-grid-2__main ${styles.week}`} aria-label="이번 주" data-guide="home-week">
          <div className="ui-card__head">
            <h2 className="ui-card__title">이번 주</h2>
            <Link href="/dashboard" className={styles.more}>
              캘린더 열기 <Icon name="chevron-right" size={14} />
            </Link>
          </div>
          <div className={styles.weekScroll}>
            <ol className={styles.weekGrid}>
              {days.map((d, i) => {
                const key = dateKey(d);
                const holiday = holidays[key];
                const list = ready ? eventsOnDay(weekEvents, d) : [];
                const dow = DOW_KO[d.getDay()];
                const isToday = i === 0;
                return (
                  <li
                    key={key}
                    className={styles.day}
                    aria-current={isToday ? 'date' : undefined}
                    data-off={d.getDay() === 0 || !!holiday ? 'sun' : d.getDay() === 6 ? 'sat' : undefined}
                    aria-label={`${d.getMonth() + 1}월 ${d.getDate()}일 ${dow}요일${holiday ? `, ${holiday}` : ''}, 일정 ${list.length}개`}
                  >
                    <div className={styles.dayHead}>
                      <span className={styles.dow}>{dow}</span>
                      <span className={`ui-num ${styles.num}`}>{d.getDate()}</span>
                      <span className={styles.holiday}>{holiday || ''}</span>
                    </div>
                    {!ready && i % 2 === 0 && <span className="ui-skeleton" />}
                    {list.map((e) => (
                      <div key={e._id} className={styles.ev} style={{ '--ev': eventColor(e) } as CSSProperties}>
                        <span className={`ui-num ${styles.evTime}`}>{e.allDay ? '종일' : fmtTime(new Date(e.start))}</span>
                        <span className={styles.evTitle}>{e.title || '(제목 없음)'}</span>
                      </div>
                    ))}
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        <div className="ui-grid-2__side">
          <section className={styles.rooms} aria-label="내 모임" data-guide="home-rooms">
            {!ready ? (
              <div className={styles.roomCard}>
                <SkeletonBlock lines={3} label="내 모임을 불러오는 중" />
              </div>
            ) : rooms.length === 0 ? (
              <div className={`ui-empty ${styles.roomsEmpty}`}>
                <span className="ui-empty__icon">
                  <Icon name="rooms" size={28} />
                </span>
                <p className="ui-empty__title">아직 모임이 없어요</p>
                <Link href="/rooms?new=1" className="ui-btn ui-btn--primary">
                  새 모임
                </Link>
              </div>
            ) : (
              <>
                {rooms.slice(0, MAX_ROOMS).map((r) => {
                  const st = roomStatus(r);
                  return (
                    <Link key={r._id} href={`/rooms/detail?id=${r._id}`} className={styles.roomCard}>
                      <span className={styles.roomTop}>
                        <span className={styles.roomName}>{r.name}</span>
                        <span className={`ui-chip ui-chip--${st.tone}`}>{st.label}</span>
                      </span>
                      <span className={styles.bar} data-tone={st.tone} aria-hidden>
                        {/* 진행 막대 폭은 데이터 값 */}
                        <span style={{ width: `${Math.round(st.progress * 100)}%` }} />
                      </span>
                      <span className={styles.roomDesc}>{st.desc}</span>
                    </Link>
                  );
                })}
                {rooms.length > MAX_ROOMS && (
                  <Link href="/rooms" className={styles.more}>
                    모임 {rooms.length}개 모두 보기 <Icon name="chevron-right" size={14} />
                  </Link>
                )}
              </>
            )}
          </section>
          {ready && leave && <LeaveCard leave={leave} />}
        </div>
      </div>
    </>
  );
}
