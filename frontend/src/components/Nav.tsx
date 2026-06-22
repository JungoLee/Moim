'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BRAND_NAME } from '@/lib/brand';
import AccountDrawer from '@/components/AccountDrawer';

export default function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="app-nav">
      <Link href="/dashboard" className="brand-mark">
        {BRAND_NAME}
      </Link>
      <Link href="/dashboard">내 캘린더</Link>
      <Link href="/friends">친구</Link>
      <Link href="/tiers">그룹</Link>
      <Link href="/rooms">모임</Link>
      <Link href="/tools/leave">연차</Link>
      <span className="app-spacer" />
      <button className="app-btn app-btn--ghost" onClick={() => setOpen(true)}>
        계정
      </button>
      {open && <AccountDrawer onClose={() => setOpen(false)} />}
    </nav>
  );
}
