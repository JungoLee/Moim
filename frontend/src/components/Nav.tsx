'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { api, getToken } from '@/lib/api';
import { BRAND_NAME } from '@/lib/brand';
import AccountDrawer from '@/components/AccountDrawer';
import QuickActions from '@/components/QuickActions';
import type { User } from '@/lib/types';

// SSR 안전 layout effect (클라이언트에선 paint 전에 실행 → 스크롤 점프 안 보이게)
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

// [경로, 라벨, 주요기능(모임)?]
const LINKS: Array<[string, string, boolean?]> = [
  ['/home', '홈'],
  ['/dashboard', '내 캘린더'],
  ['/friends', '친구'],
  ['/requests', '시간 요청'],
  ['/tiers', '공유 그룹'],
  ['/rooms', '모임', true],
  ['/tools/leave', '연차 계산'],
];

// 페이지 이동마다 Nav 가 리마운트돼도 아바타를 다시 안 받아오게 모듈 캐시 (깜빡임/요청 방지).
// 어떤 토큰(계정)의 아바타인지 함께 기억 — 로그아웃 후 다른 계정으로 로그인하면 무효화.
let cachedPicture: string | null = null;
let cachedToken: string | null = null;

// 받은 시간 요청(대기) 수 — '시간 요청' 탭 빨간 점. 이동마다 새로 부르지 않게 짧은 TTL 캐시.
let cachedPending: { count: number; token: string; at: number } | null = null;
const PENDING_TTL_MS = 10_000;

export default function Nav() {
  const pathname = usePathname() || '';
  const [open, setOpen] = useState(false);
  const [picture, setPicture] = useState(() =>
    typeof window !== 'undefined' && cachedToken === getToken() && cachedPicture !== null ? cachedPicture : ''
  );
  const linksRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = getToken();
    if (cachedPicture !== null && cachedToken === token) return; // 같은 계정 → 캐시 사용
    cachedPicture = null;
    cachedToken = token;
    if (!token) {
      setPicture('');
      return;
    }
    api<{ user: User }>('/api/auth/me')
      .then((r) => {
        cachedPicture = r.user.picture || '';
        setPicture(cachedPicture);
      })
      .catch(() => {});
  }, []);

  // 받은 시간 요청(대기) 수 → '시간 요청' 탭 빨간 점 (페이지 이동마다 TTL 지난 경우만 재조회)
  const [pendingReq, setPendingReq] = useState(() =>
    typeof window !== 'undefined' && cachedPending && cachedPending.token === getToken() ? cachedPending.count : 0
  );
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setPendingReq(0);
      return;
    }
    if (cachedPending && cachedPending.token === token && Date.now() - cachedPending.at < PENDING_TTL_MS) {
      setPendingReq(cachedPending.count);
      return;
    }
    api<{ requests: Array<{ status: string }> }>('/api/requests/received')
      .then((r) => {
        const count = r.requests.filter((x) => x.status === 'pending').length;
        cachedPending = { count, token, at: Date.now() };
        setPendingReq(count);
      })
      .catch(() => {});
  }, [pathname]);

  // 현재 페이지 메뉴를 가로 스크롤 네비 중앙으로 — paint 전에 즉시(애니메이션 X)라 '왼쪽→이동' 덜컥임 없음
  useIsoLayoutEffect(() => {
    const el = linksRef.current?.querySelector('[aria-current="page"]') as HTMLElement | null;
    if (el) el.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [pathname]);

  return (
    <>
      <nav className="app-nav">
        <Link href="/home" className="brand-mark">
          {BRAND_NAME}
        </Link>
        <div className="app-nav-links" ref={linksRef}>
          {LINKS.map(([href, label, feature]) => {
            const active = href === '/home' ? pathname === '/home' : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={feature ? 'app-nav-feature' : undefined}
                aria-current={active ? 'page' : undefined}
              >
                {label}
                {href === '/requests' && pendingReq > 0 && <span className="app-nav-dot" aria-label="받은 시간 요청 있음" />}
              </Link>
            );
          })}
        </div>
        <button className="app-nav-acct" onClick={() => setOpen(true)} aria-label="계정 메뉴">
          {picture ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={picture} alt="" />
          ) : (
            '👤'
          )}
        </button>
      </nav>
      {/* 드로어는 nav 밖에 — nav 의 backdrop-filter 가 fixed 포지셔닝을 가두는 문제 회피 */}
      {open && <AccountDrawer onClose={() => setOpen(false)} />}
      <QuickActions />
    </>
  );
}
