// 일정 시작~종료를 한국어로 보기 좋게 포맷. allDay 면 시간 없이 날짜만(같은 날은 하나로).
export function formatRange(start: string, end: string, allDay?: boolean): string {
  if (allDay) {
    const fmtDay = (d: Date) => d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
    const s = fmtDay(new Date(start));
    const e = fmtDay(new Date(end));
    return s === e ? `${s} (종일)` : `${s} ~ ${e} (종일)`;
  }
  const fmt = (d: Date) =>
    d.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  return `${fmt(new Date(start))} ~ ${fmt(new Date(end))}`;
}

// 표시명: 닉네임이 있으면 우선, 없으면 구글 이름.
export function displayName(u: { nickname?: string; name?: string }): string {
  return (u.nickname && u.nickname.trim()) || u.name || '사용자';
}
