'use client';

import { useEffect, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import type { EventInput } from '@fullcalendar/core';
import { fmtDayRange } from '@/lib/datetime';
import { addDays, computeLeavePlan, toKey, metricLabel, type Bridge, type LeaveStyle } from '@/lib/leave';
import { getHolidays } from '@/lib/holidays';
import { api, getToken } from '@/lib/api';
import DatePicker from '@/components/DatePicker';
import PageHeader from '@/components/PageHeader';
import Accordion from '@/components/Accordion';
import Icon from '@/components/Icon';
import Notice from '@/components/Notice';
import s from './leave.module.scss';

type LeaveSettings = { remaining: number; start: string; renewal: string; maxConsec: number; style: LeaveStyle };

const MAX_LIST = 40; // 후보 목록 표시 상한

function parseDate(v: string): Date | null {
  if (!v) return null;
  const [y, m, d] = v.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function todayMidnight(): Date {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
}

// 달력 제목 '2026년 11월'
const ymTitle = (arg: { date: { year: number; month: number } }) => `${arg.date.year}년 ${arg.date.month + 1}월`;

type Result = {
  candidates: Bridge[];
  shownCandidates: Bridge[];
  combo: Bridge[];
  comboLeave: number;
  comboOff: number;
  calEvents: EventInput[];
  initialDate: string;
  style: LeaveStyle; // 표시 지표(효율/점수) 결정용
};

const STYLES: Array<[LeaveStyle, string]> = [
  ['short', '짧게 여러 번'],
  ['balanced', '균형'],
  ['long', '길게 몰아서'],
];

/** 구간 한 줄 — 날짜 · '연차 1일 · 4일 쉬기' · 공휴일 이름 · 효율 배지 */
function BridgeRow({ p, style }: { p: Bridge; style: LeaveStyle }) {
  return (
    <li className="ui-row">
      <span className="ui-row__main">
        <span className="ui-row__title">{fmtDayRange(p.spanStart, p.spanEnd)}</span>
        <span className="ui-row__sub">
          연차 {p.leaveDays}일 · {p.totalDays}일 쉬기
          {p.holidayNames.length > 0 && <> · {p.holidayNames.join(', ')}</>}
        </span>
      </span>
      <span className="ui-row__side">
        <span className="ui-chip ui-chip--accent" title={style === 'long' ? '점수 = 휴무×2−연차' : '효율 = 연차 1일당 휴무 일수'}>
          {metricLabel(p, style)}
        </span>
      </span>
    </li>
  );
}

export default function LeavePlanner() {
  const [remaining, setRemaining] = useState('15');
  const [start, setStart] = useState(() => toKey(todayMidnight()));
  const [renewal, setRenewal] = useState(() => toKey(addDays(todayMidnight(), 365)));
  const [maxConsec, setMaxConsec] = useState('5');
  const [style, setStyle] = useState<LeaveStyle>('balanced');
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');
  // FullCalendar 는 클라이언트에서만 렌더 (SSR 회피)
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // 저장된 설정 로드 (로그인 시). 갱신일이 지났으면 서버가 자동으로 다음 해로 이월해 내려준다.
  useEffect(() => {
    if (!getToken()) return;
    api<{ leave: LeaveSettings }>('/api/auth/leave')
      .then((r) => {
        const v = r.leave;
        if (!v) return;
        if (typeof v.remaining === 'number') setRemaining(String(v.remaining));
        if (v.start) setStart(v.start);
        if (v.renewal) setRenewal(v.renewal);
        if (typeof v.maxConsec === 'number') setMaxConsec(String(v.maxConsec));
        if (v.style) setStyle(v.style);
      })
      .catch(() => {});
  }, []);

  function calculate() {
    setError('');
    const from = parseDate(start) || todayMidnight();
    const to = parseDate(renewal) || addDays(todayMidnight(), 365);
    if (from.getTime() >= to.getTime()) {
      setError('시작일이 갱신일보다 빨라야 해요.');
      return;
    }
    const rem = parseFloat(remaining) || 0;
    const maxC = parseInt(maxConsec, 10) || 5;

    const years: number[] = [];
    for (let y = from.getFullYear(); y <= to.getFullYear(); y++) years.push(y);
    const holidays = getHolidays(years);

    const { combo, comboLeave, comboOff, candidates } = computeLeavePlan(from, to, rem, maxC, style, holidays);

    // 달력용 이벤트: 휴무 기간(배경) + 실제 연차일(블록·효율 표기) + 공휴일.
    // FullCalendar 월 뷰는 문자열 날짜 + allDay:true 여야 종일 블록으로 제대로 렌더된다(Date 객체는 시간 이벤트로 오인).
    const calEvents: EventInput[] = [];
    for (const p of combo) {
      calEvents.push({
        start: toKey(p.spanStart),
        end: toKey(addDays(p.spanEnd, 1)), // FullCalendar end 는 배타적
        display: 'background',
        classNames: ['fc-ev--span'],
        allDay: true,
      });
      calEvents.push({
        title: `연차 ${p.leaveDays}일 · ${metricLabel(p, style)}`,
        start: toKey(p.bridgeStart),
        end: toKey(addDays(p.bridgeEnd, 1)),
        allDay: true,
        classNames: ['fc-ev--leave'],
      });
    }
    for (const [dateStr, name] of Object.entries(holidays)) {
      calEvents.push({ title: name, start: dateStr, allDay: true, classNames: ['fc-ev--holiday'] });
    }

    setResult({
      candidates,
      shownCandidates: candidates.slice(0, MAX_LIST),
      combo,
      comboLeave,
      comboOff,
      calEvents,
      initialDate: combo.length ? toKey(combo[0].spanStart) : toKey(from),
      style,
    });

    // 설정 저장 (로그인 시) — 시작일/갱신일 등을 다음 방문에도 유지
    if (getToken()) {
      api('/api/auth/leave', {
        method: 'PUT',
        body: { remaining: rem, start, renewal, maxConsec: maxC, style },
      }).catch(() => {});
    }
  }

  return (
    <div className="ui-page">
      <PageHeader eyebrow="도구" title="연차 계산기" sub="주말·공휴일을 엮어 연차를 가장 길게 써요" />

      <div className="ui-grid-2">
        <section className={`ui-card ${s.form}`} data-guide="leave-form" aria-labelledby="leave-form-title">
          <div className="ui-card__head">
            <h2 id="leave-form-title" className="ui-card__title">
              조건
            </h2>
          </div>
          <form
            className="ui-form"
            onSubmit={(e) => {
              e.preventDefault();
              calculate();
            }}
          >
            <div className="ui-field">
              <label className="ui-label" htmlFor="leave-remaining">
                남은 연차 (일)
              </label>
              <input
                id="leave-remaining"
                className="ui-input ui-num"
                type="number"
                inputMode="decimal"
                step="0.5"
                min="0"
                value={remaining}
                onChange={(e) => setRemaining(e.target.value)}
              />
            </div>
            <div className="ui-field">
              <span className="ui-label">시작일</span>
              <DatePicker value={start} onChange={setStart} block ariaLabel="시작일" />
            </div>
            <div className="ui-field">
              <span className="ui-label">연차 갱신일 (까지)</span>
              <DatePicker value={renewal} onChange={setRenewal} block ariaLabel="연차 갱신일" />
            </div>
            <div className="ui-field">
              <label className="ui-label" htmlFor="leave-consec">
                최대 연속 연차 (일)
              </label>
              <input
                id="leave-consec"
                className="ui-input ui-num"
                type="number"
                inputMode="numeric"
                min="1"
                max="20"
                value={maxConsec}
                onChange={(e) => setMaxConsec(e.target.value)}
              />
            </div>
            <div className="ui-field">
              <span className="ui-label">방식</span>
              <div className="ui-seg ui-seg--block" role="group" aria-label="계획 방식">
                {STYLES.map(([v, label]) => (
                  <button key={v} type="button" aria-pressed={style === v} onClick={() => setStyle(v)}>
                    {label}
                  </button>
                ))}
              </div>
              <span className="ui-help">짧게·균형은 효율(연차 1일당 휴무, 4x), 길게 몰아서는 점수(휴무×2−연차)로 골라요.</span>
            </div>
            {error && <Notice>{error}</Notice>}
            <button type="submit" className="ui-btn ui-btn--primary ui-btn--lg ui-btn--block" data-guide="leave-calc">
              <Icon name="sun" size={18} />
              계획 만들기
            </button>
          </form>
        </section>

        <div className={s.result} data-guide="leave-result" aria-live="polite">
          {!result ? (
            <section className="ui-card">
              <div className="ui-empty">
                <span className="ui-empty__icon" aria-hidden>
                  <Icon name="calendar" size={24} />
                </span>
                <p className="ui-empty__title">조건을 넣고 계획을 만들어 보세요</p>
                <p className="ui-empty__text">연차를 어디에 쓰면 가장 오래 쉬는지 달력에 표시해 드려요.</p>
              </div>
            </section>
          ) : result.combo.length === 0 ? (
            <section className="ui-card">
              <div className="ui-empty">
                <span className="ui-empty__icon" aria-hidden>
                  <Icon name="search" size={24} />
                </span>
                <p className="ui-empty__title">추천할 조합이 없어요</p>
                <p className="ui-empty__text">남은 연차나 기간, 최대 연속 연차를 바꿔 보세요.</p>
              </div>
            </section>
          ) : (
            <>
              <section className="ui-card">
                <div className={s.summary}>
                  <span className={s.big}>
                    연차 <strong className="ui-num">{result.comboLeave}</strong>일
                  </span>
                  <Icon name="chevron-right" size={22} className={s.arrow} />
                  <span className={s.big}>
                    휴무 <strong className="ui-num">{result.comboOff}</strong>일
                  </span>
                </div>
                <p className="ui-help">{result.combo.length}개 구간, 겹치지 않게 자동으로 골랐어요.</p>

                {mounted && (
                  <div className={s.calendar}>
                    <div className="ui-legend" role="group" aria-label="달력 범례">
                      <span>
                        <i className={`ui-legend__sw ${s.swSpan}`} />
                        쉬는 기간
                      </span>
                      <span>
                        <i className={`ui-legend__sw ${s.swLeave}`} />
                        연차 쓰는 날 · {result.style === 'long' ? '점수(+N점)' : '효율(Nx)'}
                      </span>
                      <span>
                        <i className={`ui-legend__sw ${s.swHoliday}`} />
                        공휴일
                      </span>
                    </div>
                    <FullCalendar
                      key={result.initialDate}
                      plugins={[dayGridPlugin]}
                      initialView="dayGridMonth"
                      initialDate={result.initialDate}
                      locale="ko"
                      height="auto"
                      titleFormat={ymTitle}
                      headerToolbar={{ left: 'prev,next', center: 'title', right: 'today' }}
                      buttonText={{ today: '오늘' }}
                      events={result.calEvents}
                      displayEventTime={false}
                    />
                  </div>
                )}
              </section>

              <section className="ui-card" aria-labelledby="leave-combo-title">
                <div className="ui-card__head">
                  <h2 id="leave-combo-title" className="ui-card__title">
                    추천 구간
                  </h2>
                  <span className="ui-card__sub">{result.combo.length}개</span>
                </div>
                <ul className="ui-list">
                  {result.combo.map((p, i) => (
                    <BridgeRow key={`c${i}`} p={p} style={result.style} />
                  ))}
                </ul>
              </section>

              {result.candidates.length > 0 && (
                <section className="ui-card">
                  <Accordion
                    title={`전체 후보 ${result.candidates.length}개 보기`}
                    aside={result.candidates.length > MAX_LIST ? `상위 ${MAX_LIST}개` : undefined}
                  >
                    <ul className="ui-list">
                      {result.shownCandidates.map((p, i) => (
                        <BridgeRow key={`a${i}`} p={p} style={result.style} />
                      ))}
                    </ul>
                  </Accordion>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
