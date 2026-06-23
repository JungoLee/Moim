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

/** 'YYYY-MM-DD' 문자열 → 'YYYY-MM-DD (요일)' (파싱 실패 시 원본 반환) */
export function dayLabelKey(key: string): string {
  const d = parseDateKey(key);
  return d ? dayLabel(d) : key;
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

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
