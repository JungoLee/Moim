// 홈 '이번 주' 계산 — 보드(7칸)와 표(사람 × 7일 × 3띠)가 같이 쓴다. 화면 코드 없는 순수 함수.
import { addDays, startOfDay } from '@/lib/datetime';

export const WEEK_LENGTH = 7;

/** 하루를 세 띠로 — 오전 06–12 · 오후 12–18 · 저녁 18–24 (그 앞 0–6시는 띠에 넣지 않는다) */
export const BANDS = [
  { key: 'am', label: '오전', from: 6, to: 12 },
  { key: 'pm', label: '오후', from: 12, to: 18 },
  { key: 'eve', label: '저녁', from: 18, to: 24 },
] as const;

export type TimeSpan = { start: string; end: string; allDay?: boolean };

/** 오늘부터 7일 */
export function weekDays(today: Date): Date[] {
  const first = startOfDay(today);
  return Array.from({ length: WEEK_LENGTH }, (_, i) => addDays(first, i));
}

/** 그 날(자정~다음 자정)에 걸치는가 */
export function overlapsDay(span: TimeSpan, day: Date): boolean {
  const from = startOfDay(day).getTime();
  const to = addDays(day, 1).getTime();
  const s = new Date(span.start).getTime();
  const e = new Date(span.end).getTime();
  if (s >= to) return false;
  return e > from || (s >= from && s < to);
}

/** 일정 목록에서 그 날 것만 — 종일 먼저, 그다음 시작 시각 순 */
export function eventsOnDay<T extends TimeSpan>(items: T[], day: Date): T[] {
  return items
    .filter((it) => overlapsDay(it, day))
    .sort((a, b) => Number(!!b.allDay) - Number(!!a.allDay) || new Date(a.start).getTime() - new Date(b.start).getTime());
}

/** 그 날 세 띠가 바쁜지 [오전, 오후, 저녁]. 종일 일정은 세 띠 모두 바쁨 */
export function busyBands(items: TimeSpan[], day: Date): boolean[] {
  const base = startOfDay(day).getTime();
  const HOUR = 3_600_000;
  const todays = items.filter((it) => overlapsDay(it, day));
  return BANDS.map((b) => {
    const from = base + b.from * HOUR;
    const to = base + b.to * HOUR;
    return todays.some((it) => {
      if (it.allDay) return true;
      return new Date(it.start).getTime() < to && new Date(it.end).getTime() > from;
    });
  });
}
