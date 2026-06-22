'use client';

import { useEffect, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import type { EventInput } from '@fullcalendar/core';
import Nav from '@/components/Nav';
import { addDays, findBridges, selectPeriods, toKey, formatDate, type Bridge, type LeaveStyle } from '@/lib/leave';
import { getHolidays } from '@/lib/holidays';
import DatePicker from '@/components/DatePicker';
import Icon from '@/components/Icon';
import styles from './leave.module.scss';

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

    const bridges = findBridges(from, to, maxC, holidays);
    // 효율 2.0x 미만 제거 + 동일 기간 중복 제거
    const seen = new Set<string>();
    const deduped = bridges.filter((b) => {
      if (b.efficiency < 2.0) return false;
      const key = `${toKey(b.bridgeStart)}~${toKey(b.bridgeEnd)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // 후보 목록 (스타일 필터 + 정렬)
    let candidates = deduped;
    if (style === 'short') {
      const s = candidates.filter((c) => c.leaveDays <= 2);
      if (s.length) candidates = s;
    } else if (style === 'long') {
      const l = candidates.filter((c) => c.leaveDays >= 3);
      if (l.length) candidates = l;
    }
    candidates = [...candidates].sort((a, b) =>
      style === 'long' ? b.totalDays - a.totalDays || b.efficiency - a.efficiency : b.efficiency - a.efficiency
    );

    // 잔여 연차로 가능한 겹치지 않는 최적 조합
    const { selected, usedDays } = selectPeriods(deduped, rem, style, from, to);
    const comboOff = selected.reduce((s, p) => s + p.totalDays, 0);

    // 달력용 이벤트: 휴무 span(배경) + 실제 연차일 + 공휴일
    const calEvents: EventInput[] = [];
    for (const p of selected) {
      calEvents.push({
        start: p.spanStart,
        end: addDays(p.spanEnd, 1), // FullCalendar end 는 배타적
        display: 'background',
        color: 'rgba(74, 210, 149, 0.35)',
      });
      calEvents.push({ title: `🏖 연차 ${p.leaveDays}일`, start: p.bridgeStart, end: addDays(p.bridgeEnd, 1) });
    }
    for (const [dateStr, name] of Object.entries(holidays)) {
      calEvents.push({ title: `🎌 ${name}`, start: dateStr, allDay: true, classNames: ['evt-holiday'] });
    }

    setResult({
      candidates,
      shownCandidates: candidates.slice(0, MAX_LIST),
      combo: selected,
      comboLeave: usedDays,
      comboOff,
      calEvents,
      initialDate: selected.length ? toKey(selected[0].spanStart) : toKey(from),
    });
  }

  return (
    <>
      <Nav />
      <main className="app-container">
        <h2 className={styles.title}>
          <Icon name="sun" size={24} />
          연차 계산기
        </h2>
        <p className="app-muted">
          잔여 연차와 갱신일을 입력하면 주말·공휴일을 활용해 <strong>최소 연차로 최대 연휴</strong>를 만드는 계획을 추천합니다.
          (효율 = 연차 1일당 얻는 총 휴무일 수)
        </p>
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
              <label key={v} className="app-muted">
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
            <div className="app-card">
              <h3>내 잔여 연차로 추천 조합</h3>
              {result.combo.length === 0 ? (
                <p className="app-muted">추천할 조합이 없습니다. 잔여 연차나 기간/조건을 조정해보세요.</p>
              ) : (
                <p>
                  연차 <strong>{result.comboLeave}일</strong> 써서 총 <strong>{result.comboOff}일</strong> 휴무{' '}
                  <span className="app-muted">({result.combo.length}개 구간, 겹치지 않게 자동 선택)</span>
                </p>
              )}
              {result.combo.map((p, i) => (
                <div className={styles.row} key={`c${i}`}>
                  <span className={styles.eff}>{p.efficiency}x</span>
                  <strong>
                    {formatDate(p.spanStart)} ~ {formatDate(p.spanEnd)}
                  </strong>
                  <span className="app-muted">
                    연차 {p.leaveDays}일 → {p.totalDays}일 휴무
                  </span>
                  {p.holidayNames.length > 0 && <span className="app-muted">🎌 {p.holidayNames.join(' · ')}</span>}
                </div>
              ))}
            </div>

            {mounted && result.combo.length > 0 && (
              <div className="app-card">
                <h3>달력 보기</h3>
                <p className="app-muted">초록 배경 = 휴무 기간, 파란 칸 = 실제 쓰는 연차, 🎌 = 공휴일</p>
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
              </div>
            )}

            <h3>
              전체 추천 {result.candidates.length}개
              {result.candidates.length > MAX_LIST && <span className="app-muted"> (상위 {MAX_LIST}개 표시)</span>}
            </h3>
            {result.candidates.length === 0 && <p className="app-muted">조건에 맞는 추천이 없습니다.</p>}
            {result.shownCandidates.map((p, i) => (
              <div className="app-card" key={`a${i}`}>
                <div className="app-row">
                  <span className={styles.eff}>{p.efficiency}x</span>
                  <strong>
                    {formatDate(p.spanStart)} ~ {formatDate(p.spanEnd)}
                  </strong>
                  <span className="app-spacer" />
                  <span className="app-muted">
                    연차 {p.leaveDays}일 · 총 {p.totalDays}일 휴무
                  </span>
                </div>
                {p.holidayNames.length > 0 && <div className="app-muted">🎌 {p.holidayNames.join(' · ')}</div>}
              </div>
            ))}
          </>
        )}
      </main>
    </>
  );
}
