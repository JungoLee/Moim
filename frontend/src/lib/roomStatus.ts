// 방 상태 태그 — 목록·사이드바·홈이 같은 말을 쓰도록 한 곳에서. docs/design-system.md 5장.
import { fmtKeyRange } from '@/lib/datetime';
import type { RoomSummary } from '@/lib/types';

export type RoomTone = 'accent' | 'warn' | 'muted' | 'primary';
export type RoomStatus = { label: string; tone: RoomTone; desc: string; progress: number };

export function roomStatus(r: RoomSummary): RoomStatus {
  const total = Math.max(r.memberCount, 1);
  const progress = Math.min(r.markedCount / total, 1);
  if (r.confirmed) {
    const range = fmtKeyRange(r.confirmed.start, r.confirmed.end);
    return { label: `확정 ${range.split(' ')[0]}`, tone: 'accent', desc: `${range}로 정했어요`, progress: 1 };
  }
  if (r.fullDayCount > 0) {
    return {
      label: `후보 ${r.fullDayCount}`,
      tone: 'accent',
      desc: `${r.markedCount}/${r.memberCount}명 찍음 · 모두 되는 날 ${r.fullDayCount}일`,
      progress,
    };
  }
  if (!r.myMarked && r.markedCount > 0) {
    return { label: '내 차례', tone: 'warn', desc: `${r.memberCount}명 중 ${r.markedCount}명 찍음 · 나도 아직이에요`, progress };
  }
  if (r.markedCount === 0) {
    return { label: '시작 전', tone: 'muted', desc: `${r.memberCount}명 · 아직 아무도 안 찍었어요`, progress: 0 };
  }
  const desc = r.markedCount >= r.memberCount ? '모두 찍었지만 다 같이 되는 날이 아직 없어요' : '모두 되는 날을 찾는 중이에요';
  return { label: `${r.markedCount}/${r.memberCount} 찍음`, tone: 'primary', desc, progress };
}
