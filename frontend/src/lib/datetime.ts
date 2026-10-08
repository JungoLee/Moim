// 날짜·시간 공용 유틸 (여러 페이지/컴포넌트가 각자 정의하던 것을 단일 출처로 통합)

/** 24시 시(時) 옵션: '00'~'23' */
export const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'));
/** 5분 단위 분(分) 옵션: '00','05',…,'55' */
export const MINUTES = Array.from({ length: 12 }, (_, m) => String(m * 5).padStart(2, '0'));

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Date → 'YYYY-MM-DD' (로컬 기준) */
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Date → 'HH:MM' (분은 5분 단위로 내림) */
export function timeKey(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(Math.floor(d.getMinutes() / 5) * 5)}`;
}

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

/** Date → 'YYYY-MM-DD (요일)' — 앱 전역 날짜 표기 형식 */
export function dayLabel(d: Date): string {
  return `${dateKey(d)} (${DOW[d.getDay()]})`;
}

/** 오늘 'YYYY-MM-DD' */
export function todayKey(): string {
  return dateKey(new Date());
}

/** 'YYYY-MM-DD' → Date (잘못된 값이면 null) */
export function parseDateKey(s: string): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** 달력 한 달 칸 — 그 달 1일이 든 주의 일요일부터 말일이 든 주의 토요일까지(DatePicker·AvailabilityCalendar 공용) */
export function monthGridDays(view: Date): Date[] {
  const monthStart = new Date(view.getFullYear(), view.getMonth(), 1);
  const monthEnd = new Date(view.getFullYear(), view.getMonth() + 1, 0);
  const gridStart = addDays(monthStart, -monthStart.getDay());
  const gridEnd = addDays(monthEnd, 6 - monthEnd.getDay());
  const days: Date[] = [];
  let cur = gridStart;
  while (cur.getTime() <= gridEnd.getTime()) {
    days.push(cur);
    cur = addDays(cur, 1);
  }
  return days;
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// ── 표시 형식 (docs/design-system.md 5장) ──────────────────────────
export const DOW_KO = DOW;

/** '11월 21일 (토)' */
export function fmtDay(d: Date): string {
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DOW[d.getDay()]})`;
}

/** '11/21 (토)' */
export function fmtDayShort(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()} (${DOW[d.getDay()]})`;
}

/** 날짜 구간 — 같은 날 '11/21 (토)', 같은 달 '11/21 (토) – 22 (일)', 다른 달 '11/30 (월) – 12/1 (화)' */
export function fmtDayRange(a: Date, b: Date): string {
  if (dateKey(a) === dateKey(b)) return fmtDayShort(a);
  if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()) {
    return `${fmtDayShort(a)} – ${b.getDate()} (${DOW[b.getDay()]})`;
  }
  return `${fmtDayShort(a)} – ${fmtDayShort(b)}`;
}

/** 'YYYY-MM-DD' 두 개로 구간 표기 (잘못된 값이면 빈 문자열) */
export function fmtKeyRange(startKey: string, endKey: string): string {
  const a = parseDateKey(startKey);
  const b = parseDateKey(endKey || startKey);
  return a && b ? fmtDayRange(a, b) : '';
}

/** '2026년 11월' */
export function fmtMonth(d: Date): string {
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
}

/** '19:00' (24시간) */
export function fmtTime(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** 일정 시각 — 종일: '11/21 (토)' 또는 구간, 시간 지정: '11/21 (토) 19:00 – 21:00' (다른 날이면 양쪽 날짜) */
export function fmtEventTime(startIso: string, endIso: string, allDay?: boolean): string {
  const s = new Date(startIso);
  const e = new Date(endIso);
  if (allDay) return `${fmtDayRange(s, e)} 종일`;
  if (dateKey(s) === dateKey(e)) return `${fmtDayShort(s)} ${fmtTime(s)} – ${fmtTime(e)}`;
  return `${fmtDayShort(s)} ${fmtTime(s)} – ${fmtDayShort(e)} ${fmtTime(e)}`;
}

/** 상대 시각 — '방금' · 'N분 전' · 'N시간 전' · '어제' · 그 밖은 '11/21 (토)' */
export function fmtRelative(iso: string, now: Date = new Date()): string {
  const t = new Date(iso);
  const diff = now.getTime() - t.getTime();
  if (diff < 60_000) return '방금';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
  if (dateKey(t) === dateKey(now)) return `${Math.floor(diff / 3_600_000)}시간 전`;
  if (dateKey(t) === dateKey(addDays(now, -1))) return '어제';
  return fmtDayShort(t);
}

/** 종일 구간을 서버에 보낼 ISO — 첫날 00:00 · 끝날 23:59 (로컬). 일정 화면·모임 확정 공용 */
export function allDayIsoRange(startKey: string, endKey: string): { start: string; end: string } {
  return {
    start: new Date(`${startKey}T00:00`).toISOString(),
    end: new Date(`${endKey}T23:59`).toISOString(),
  };
}
