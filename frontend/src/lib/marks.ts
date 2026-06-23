import { dateKey, addDays, startOfDay } from '@/lib/datetime';
import { eventColor } from '@/lib/colors';
import type { MoimEvent } from '@/lib/types';

type RangeLike = { start: string; end: string };

/**
 * 날짜별 표시색 맵 ('YYYY-MM-DD' → #hex) 빌드 — DatePicker 의 일정 점 표시에 사용.
 * 일정(events)을 먼저 칠하고, 요청(requests)이 있으면 그 색으로 덮어쓴다.
 */
export function buildMarkedDates(opts: {
  events: MoimEvent[];
  tierColors?: Record<string, string>;
  requests?: RangeLike[];
  requestColor?: string;
}): Record<string, string> {
  const { events, tierColors, requests, requestColor } = opts;
  const m: Record<string, string> = {};
  const paint = (startISO: string, endISO: string, color: string) => {
    let cur = startOfDay(new Date(startISO));
    const last = startOfDay(new Date(endISO));
    while (cur.getTime() <= last.getTime()) {
      m[dateKey(cur)] = color;
      cur = addDays(cur, 1);
    }
  };
  for (const ev of events) paint(ev.start, ev.end, eventColor(ev, tierColors));
  if (requests && requestColor) {
    for (const r of requests) paint(r.start, r.end, requestColor);
  }
  return m;
}
