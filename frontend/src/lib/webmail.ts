/**
 * 이메일 주소 도메인 → 그 메일함 바로가기.
 *
 * 인증 코드를 보낸 다음 "메일 확인하러 가기" 버튼을 띄우기 위한 표다. 쓰던 기기라면
 * 대개 로그인돼 있으니 새 탭으로 열면 바로 받은편지함이 보인다.
 * 표에 없는 도메인(회사 메일 등)은 갈 곳을 알 수 없으므로 `null` — 버튼을 숨긴다.
 */

export interface Webmail {
  name: string;
  url: string;
}

const HOSTS: Record<string, Webmail> = {
  'gmail.com': { name: 'Gmail', url: 'https://mail.google.com/mail/u/0/' },
  'googlemail.com': { name: 'Gmail', url: 'https://mail.google.com/mail/u/0/' },
  'naver.com': { name: '네이버 메일', url: 'https://mail.naver.com' },
  'daum.net': { name: '다음 메일', url: 'https://mail.daum.net' },
  'hanmail.net': { name: '다음 메일', url: 'https://mail.daum.net' },
  'kakao.com': { name: '카카오 메일', url: 'https://mail.kakao.com' },
  'nate.com': { name: '네이트 메일', url: 'https://mail.nate.com' },
  'outlook.com': { name: 'Outlook', url: 'https://outlook.live.com/mail/0/' },
  'outlook.kr': { name: 'Outlook', url: 'https://outlook.live.com/mail/0/' },
  'hotmail.com': { name: 'Outlook', url: 'https://outlook.live.com/mail/0/' },
  'live.com': { name: 'Outlook', url: 'https://outlook.live.com/mail/0/' },
  'live.co.kr': { name: 'Outlook', url: 'https://outlook.live.com/mail/0/' },
  'msn.com': { name: 'Outlook', url: 'https://outlook.live.com/mail/0/' },
  'icloud.com': { name: 'iCloud 메일', url: 'https://www.icloud.com/mail' },
  'me.com': { name: 'iCloud 메일', url: 'https://www.icloud.com/mail' },
  'mac.com': { name: 'iCloud 메일', url: 'https://www.icloud.com/mail' },
  'yahoo.com': { name: 'Yahoo 메일', url: 'https://mail.yahoo.com' },
  'yahoo.co.kr': { name: 'Yahoo 메일', url: 'https://mail.yahoo.com' },
  'ymail.com': { name: 'Yahoo 메일', url: 'https://mail.yahoo.com' },
  'aol.com': { name: 'AOL 메일', url: 'https://mail.aol.com' },
  'proton.me': { name: 'Proton Mail', url: 'https://mail.proton.me' },
  'protonmail.com': { name: 'Proton Mail', url: 'https://mail.proton.me' },
  'pm.me': { name: 'Proton Mail', url: 'https://mail.proton.me' },
  'zoho.com': { name: 'Zoho Mail', url: 'https://mail.zoho.com' },
  'gmx.com': { name: 'GMX', url: 'https://www.gmx.com' },
  'yandex.com': { name: 'Yandex Mail', url: 'https://mail.yandex.com' },
  'yandex.ru': { name: 'Yandex Mail', url: 'https://mail.yandex.com' },
  'qq.com': { name: 'QQ 메일', url: 'https://mail.qq.com' },
  '163.com': { name: '163 메일', url: 'https://mail.163.com' },
};

/** 모르는 도메인이면 null */
export function webmailOf(email: string): Webmail | null {
  const host = email.trim().toLowerCase().split('@')[1];
  return host ? HOSTS[host] ?? null : null;
}
