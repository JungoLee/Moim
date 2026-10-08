// 사진 없는 사람의 첫 글자 원 색 — 같은 사람은 늘 같은 색(id 해시). 파스텔이라 글자는 남색(#141a2c) 고정.
const PASTELS = ['#c4cbff', '#ffd3a6', '#a8ece1', '#f8c3dc', '#c7d6ff', '#fbe7a6', '#d4c4ff', '#b9e6c9'];

export function avatarColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PASTELS[h % PASTELS.length];
}

/** 이름의 첫 글자 — 한글 이름은 성 다음 글자(김하늘 → 하)가 더 구분된다 */
export function initialOf(name: string): string {
  const n = (name || '').trim();
  if (!n) return '?';
  if (/^[가-힣]{3,4}$/.test(n)) return n[1];
  return n[0].toUpperCase();
}
