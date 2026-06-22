'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { BRAND_NAME } from '@/lib/brand';
import AccountDrawer from '@/components/AccountDrawer';
import type { User } from '@/lib/types';

export default function Nav() {
  const [open, setOpen] = useState(false);
  const [picture, setPicture] = useState('');

  useEffect(() => {
    api<{ user: User }>('/api/auth/me')
      .then((r) => setPicture(r.user.picture || ''))
      .catch(() => {});
  }, []);

  return (
    <nav className="app-nav">
      <Link href="/home" className="brand-mark">
        {BRAND_NAME}
      </Link>
      <Link href="/home">홈</Link>
      <Link href="/dashboard">내 캘린더</Link>
      <Link href="/friends">친구</Link>
      <Link href="/tiers">그룹</Link>
      <Link href="/rooms">모임</Link>
      <Link href="/tools/leave">연차</Link>
      <span className="app-spacer" />
      <button className="app-nav-acct" onClick={() => setOpen(true)} aria-label="계정 메뉴">
        {picture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={picture} alt="" />
        ) : (
          '👤'
        )}
      </button>
      {open && <AccountDrawer onClose={() => setOpen(false)} />}
    </nav>
  );
}
