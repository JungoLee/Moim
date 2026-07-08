// 기본 관리자 이메일 판정 (콤마로 여러 개, env ADMIN_EMAILS 로 오버라이드)
// 구글 로그인(passport)·이메일 코드 로그인 양쪽에서 공용.
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'tough123181@gmail.com')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export function isAdminEmail(email) {
  return ADMIN_EMAILS.includes((email || '').toLowerCase());
}
