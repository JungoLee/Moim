// 모임 방 화면 공용 글 만들기 — 칸 읽어주는 글·시각 표기. (날짜를 말로: lib/datetime 의 fmtDayWords)
import type { Mark } from '@/lib/types';

/** '19:00' → '19시', '19:30' → '19:30' (집계 말: '이도윤 19시 이후') */
export function hourText(time: string): string {
  if (!time) return '';
  const [h, m] = time.split(':');
  return m === '00' || !m ? `${Number(h)}시` : `${Number(h)}:${m}`;
}

/** 내 표시를 말로 — 가능 · 안 됨 · 19:00 이후 · 없음 */
export function markWords(m: Mark | undefined): string {
  if (!m) return '없음';
  if (m.status === 'yes') return '가능';
  if (m.status === 'no') return '안 됨';
  return `${m.time || ''} 이후`.trim();
}
