// 표시명: 닉네임이 있으면 우선, 없으면 구글 이름.
export function displayName(u: { nickname?: string; name?: string }): string {
  return (u.nickname && u.nickname.trim()) || u.name || '사용자';
}
