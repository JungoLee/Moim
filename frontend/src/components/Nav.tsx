'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { clearToken } from '@/lib/api';
import { BRAND_NAME } from '@/lib/brand';

export default function Nav() {
  const router = useRouter();

  function logout() {
    clearToken();
    router.push('/');
  }

  return (
    <nav className="app-nav">
      <Link href="/dashboard" className="brand-mark">
        {BRAND_NAME}
      </Link>
      <Link href="/dashboard">내 캘린더</Link>
      <Link href="/friends">친구</Link>
      <span className="app-spacer" />
      <button className="app-btn app-btn--ghost" onClick={logout}>
        로그아웃
      </button>
    </nav>
  );
}
