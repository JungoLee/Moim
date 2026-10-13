import type { IconName } from '@/components/Icon';

// 메뉴 4개 + 보조 링크 — AppShell 의 보드 사이드바·표 위 메뉴·모바일 아래 탭 공용 (docs/design-system.md 0장 '메뉴')
type NavItem = { href: string; label: string; icon: IconName; match: (path: string) => boolean };

const under = (path: string, ...bases: string[]) => bases.some((b) => path === b || path.startsWith(`${b}/`));

export const NAV: NavItem[] = [
  { href: '/home', label: '홈', icon: 'home', match: (p) => under(p, '/home') },
  { href: '/dashboard', label: '캘린더', icon: 'calendar', match: (p) => under(p, '/dashboard') },
  { href: '/rooms', label: '모임', icon: 'rooms', match: (p) => under(p, '/rooms') },
  { href: '/friends', label: '사람', icon: 'users', match: (p) => under(p, '/friends', '/tiers', '/requests', '/u') },
];

export const LEAVE_LINK: NavItem = { href: '/tools/leave', label: '연차 계산', icon: 'sun', match: (p) => under(p, '/tools/leave') };

/** 끝의 '/' 를 떼어 비교 (정적 export 는 '/home' 과 '/home/' 둘 다 올 수 있다) */
export function normPath(p: string | null): string {
  if (!p) return '/';
  return p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p;
}
