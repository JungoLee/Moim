/**
 * 텍스트를 클립보드에 복사. Clipboard API 가 불가한 환경(비보안 컨텍스트 등)에서는
 * 임시 textarea + execCommand 폴백을 사용한다.
 */
export async function copyToClipboard(text: string): Promise<void> {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    /* Clipboard API 불가 → 아래 폴백 */
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
  } catch {
    /* 무시 */
  }
  document.body.removeChild(ta);
}
