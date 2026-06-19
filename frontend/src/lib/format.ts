// 일정 시작~종료를 한국어로 보기 좋게 포맷.
export function formatRange(start: string, end: string): string {
  const fmt = (d: Date) =>
    d.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  return `${fmt(new Date(start))} ~ ${fmt(new Date(end))}`;
}
