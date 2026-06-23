'use client';

import { useEffect, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import type { EventInput } from '@fullcalendar/core';
import Nav from '@/components/Nav';
import { addDays, computeLeavePlan, toKey, formatDate, metricLabel, type Bridge, type LeaveStyle } from '@/lib/leave';
import { getHolidays } from '@/lib/holidays';
import { api, getToken } from '@/lib/api';
import DatePicker from '@/components/DatePicker';
import PageHero from '@/components/PageHero';
import Accordion from '@/components/Accordion';
import styles from './leave.module.scss';

type LeaveSettings = { remaining: number; start: string; renewal: string; maxConsec: number; style: LeaveStyle };

const MAX_LIST = 40; // 후보 목록 표시 상한

function parseDate(s: string): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function todayMidnight(): Date {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
}

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
  ['balanced', '균형(효율순)'],
  ['long', '길게 몰아서'],
];

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
        const s = r.leave;
        if (!s) return;
        if (typeof s.remaining === 'number') setRemaining(String(s.remaining));
        if (s.start) setStart(s.start);
        if (s.renewal) setRenewal(s.renewal);
        if (typeof s.maxConsec === 'number') setMaxConsec(String(s.maxConsec));
        if (s.style) setStyle(s.style);
      })
      .catch(() => {});
  }, []);

  function calculate() {
    setError('');
    const from = parseDate(start) || todayMidnight();
    const to = parseDate(renewal) || addDays(todayMidnight(), 365);
    if (from.getTime() >= to.getTime()) {
      setError('시작일이 갱신일보다 빨라야 합니다.');
      return;
    }
    const rem = parseFloat(remaining) || 0;
    const maxC = parseInt(maxConsec, 10) || 5;

    const years: number[] = [];
    for (let y = from.getFullYear(); y <= to.getFullYear(); y++) years.push(y);
    const holidays = getHolidays(years);

    const { combo, comboLeave, comboOff, candidates } = computeLeavePlan(from, to, rem, maxC, style, holidays);

    // 달력용 이벤트: 휴무 span(초록 배경) + 실제 연차일(블록·효율 표기) + 공휴일.
    // FullCalendar 월 뷰는 문자열 날짜 + allDay:true 여야 종일 블록으로 제대로 렌더된다(Date 객체는 시간 이벤트로 오인).
    const calEvents: EventInput[] = [];
    for (const p of combo) {
      calEvents.push({
        start: toKey(p.spanStart),
        end: toKey(addDays(p.spanEnd, 1)), // FullCalendar end 는 배타적
        display: 'background',
        color: 'rgba(74, 210, 149, 0.35)',
        allDay: true,
      });
      calEvents.push({
        title: `🏖 연차 ${p.leaveDays}일 · ${metricLabel(p, style)}`,
        start: toKey(p.bridgeStart),
        end: toKey(addDays(p.bridgeEnd, 1)),
        allDay: true,
        classNames: ['evt-leave'],
      });
    }
    for (const [dateStr, name] of Object.entries(holidays)) {
      calEvents.push({ title: `🎌 ${name}`, start: dateStr, allDay: true, classNames: ['evt-holiday'] });
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
    <>
      <Nav />
      <main className="app-container">
        <PageHero
          icon="sun"
          title="연차 계산기"
          desc={
            <>
              잔여 연차와 갱신일만 입력하면, 주말·공휴일을 엮어 <strong>최소 연차로 최대 연휴</strong>를 만드는 계획을 추천해요.
            </>
          }
          note="짧게·균형 = 효율(Nx, 가성비) · 길게 몰아서 = 점수(+N = 휴무×2−연차)"
        />
        {error && <p className="app-error">{error}</p>}

        <div className="app-card">
          <div className="app-row">
            <label className={styles.field}>
              잔여 연차(일)
              <input className="app-input" type="number" step="0.5" min="0" value={remaining} onChange={(e) => setRemaining(e.target.value)} />
            </label>
            <div className={styles.field}>
              <span>시작일</span>
              <DatePicker value={start} onChange={setStart} />
            </div>
            <div className={styles.field}>
              <span>연차 갱신일(까지)</span>
              <DatePicker value={renewal} onChange={setRenewal} />
            </div>
            <label className={styles.field}>
              최대 연속 연차
              <input className="app-input" type="number" min="1" max="20" value={maxConsec} onChange={(e) => setMaxConsec(e.target.value)} />
            </label>
          </div>
          <div className="app-row" style={{ marginTop: 'var(--space-3)' }}>
            <span className="app-muted">스타일:</span>
            {STYLES.map(([v, label]) => (
              <label key={v} className={styles.styleOpt}>
                <input type="radio" name="style" checked={style === v} onChange={() => setStyle(v)} /> {label}
              </label>
            ))}
            <span className="app-spacer" />
            <button className="app-btn" onClick={calculate}>
              최적 연차 계획 만들기
            </button>
          </div>
        </div>

        {result && (
          <>
            {/* 메인: 요약 + 달력 (한눈에 보기) */}
            <div className="app-card">
              <h3>내 잔여 연차로 추천 조합</h3>
              {result.combo.length === 0 ? (
                <p className="app-muted">추천할 조합이 없습니다. 잔여 연차나 기간/조건을 조정해보세요.</p>
              ) : (
                <>
                  <p>
                    연차 <strong>{result.comboLeave}일</strong> 써서 총 <strong>{result.comboOff}일</strong> 휴무{' '}
                    <span className="app-muted">({result.combo.length}개 구간, 겹치지 않게 자동 선택)</span>
                  </p>
                  {mounted && (
                    <>
                      <p className={styles.legend}>
                        <span className={styles.legSpan}>휴무 기간</span>
                        <span className={styles.legLeave}>
                          실제 쓰는 연차 · {result.style === 'long' ? '점수(+N)' : '효율(N x)'}
                        </span>
                        <span className={styles.legHoliday}>🎌 공휴일</span>
                      </p>
                      <FullCalendar
                        key={result.initialDate}
                        plugins={[dayGridPlugin]}
                        initialView="dayGridMonth"
                        initialDate={result.initialDate}
                        locale="ko"
                        height="auto"
                        headerToolbar={{ left: 'prev,next', center: 'title', right: 'today' }}
                        buttonText={{ today: '오늘' }}
                        events={result.calEvents}
                        displayEventTime={false}
                      />
                    </>
                  )}
                </>
              )}
            </div>

            {/* 추천 구간 상세 (접기) */}
            {result.combo.length > 0 && (
              <div className="app-card">
                <Accordion title={`추천 구간 ${result.combo.length}개 자세히 보기`}>
                  {result.combo.map((p, i) => (
                    <div className={styles.row} key={`c${i}`}>
                      <span className={styles.eff}>{metricLabel(p, result.style)}</span>
                      <strong>
                        {formatDate(p.spanStart)} ~ {formatDate(p.spanEnd)}
                      </strong>
                      <span className="app-muted">
                        연차 {p.leaveDays}일 → {p.totalDays}일 휴무
                      </span>
                      {p.holidayNames.length > 0 && <span className="app-muted">🎌 {p.holidayNames.join(' · ')}</span>}
                    </div>
                  ))}
                </Accordion>
              </div>
            )}

            {/* 전체 후보 (접기) */}
            {result.candidates.length > 0 && (
              <div className="app-card">
                <Accordion
                  title={`전체 추천 ${result.candidates.length}개 보기`}
                  aside={result.candidates.length > MAX_LIST ? `상위 ${MAX_LIST}개` : undefined}
                >
                  {result.shownCandidates.map((p, i) => (
                    <div className={styles.row} key={`a${i}`}>
                      <span className={styles.eff}>{metricLabel(p, result.style)}</span>
                      <strong>
                        {formatDate(p.spanStart)} ~ {formatDate(p.spanEnd)}
                      </strong>
                      <span className="app-spacer" />
                      <span className="app-muted">
                        연차 {p.leaveDays}일 · 총 {p.totalDays}일 휴무
                      </span>
                      {p.holidayNames.length > 0 && <span className="app-muted">🎌 {p.holidayNames.join(' · ')}</span>}
                    </div>
                  ))}
                </Accordion>
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
