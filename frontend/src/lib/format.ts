import { dayLabel } from './datetime';

// 일정 시작~종료를 'YYYY-MM-DD (요일)' 기준으로 포맷. allDay 면 시간 없이 날짜만(같은 날은 하나로).
export function formatRange(start: string, end: string, allDay?: boolean): string {
  if (allDay) {
    const s = dayLabel(new Date(start));
    const e = dayLabel(new Date(end));
    return s === e ? `${s} (종일)` : `${s} ~ ${e} (종일)`;
  }
  const fmt = (d: Date) => `${dayLabel(d)} ${d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`;
  return `${fmt(new Date(start))} ~ ${fmt(new Date(end))}`;
}

// 표시명: 닉네임이 있으면 우선, 없으면 구글 이름.
export function displayName(u: { nickname?: string; name?: string }): string {
  return (u.nickname && u.nickname.trim()) || u.name || '사용자';
}
