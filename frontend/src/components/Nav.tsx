'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { api } from '@/lib/api';
import { BRAND_NAME } from '@/lib/brand';
import AccountDrawer from '@/components/AccountDrawer';
import QuickActions from '@/components/QuickActions';
import type { User } from '@/lib/types';

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

export default function Nav() {
  const pathname = usePathname() || '';
  const [open, setOpen] = useState(false);
  const [picture, setPicture] = useState('');

  useEffect(() => {
    api<{ user: User }>('/api/auth/me')
      .then((r) => setPicture(r.user.picture || ''))
      .catch(() => {});
  }, []);

  return (
    <>
      <nav className="app-nav">
        <Link href="/home" className="brand-mark">
          {BRAND_NAME}
        </Link>
        <div className="app-nav-links">
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
