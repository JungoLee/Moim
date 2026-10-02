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
