'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { setToken } from '@/lib/api';

export default function AuthCallback() {
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      setToken(token);
      router.replace('/home');
    } else {
      setError('로그인에 실패했습니다. 다시 시도해 주세요.');
    }
  }, [router]);

  return (
    <main className="app-container">
      <p className={error ? 'app-error' : 'app-muted'}>{error || '로그인 처리 중…'}</p>
    </main>
  );
}
