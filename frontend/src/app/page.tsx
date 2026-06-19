'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getToken, googleLoginUrl } from '@/lib/api';
import { BRAND_NAME } from '@/lib/brand';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    if (getToken()) router.replace('/dashboard');
  }, [router]);

  return (
    <main className="app-container">
      <h1 className="brand-mark">{BRAND_NAME}</h1>
      <p className="app-muted">친구들과 스케줄을 공유하고, 함께 비는 시간을 찾아 모임·여행을 잡으세요.</p>
      <a className="app-btn" href={googleLoginUrl()}>
        구글로 시작하기
      </a>
    </main>
  );
}
