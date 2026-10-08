'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { setToken } from '@/lib/api';
import Icon from '@/components/Icon';
import s from './callback.module.scss';

export default function AuthCallback() {
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      setToken(token);
      // 팝업으로 열렸으면 닫는다(부모 창이 storage 이벤트로 기억해둔 곳/홈 이동 처리).
      // 일반 탭(팝업 차단)이면 window.close()가 무시되고 아래 replace로 직접 이동.
      window.close();
      let dest = '/home';
      try {
        const n = sessionStorage.getItem('postLoginRedirect');
        if (n) {
          sessionStorage.removeItem('postLoginRedirect');
          dest = n;
        }
      } catch {
        /* 무시 */
      }
      router.replace(dest);
    } else {
      setError('로그인하지 못했어요. 다시 시도해 주세요.');
    }
  }, [router]);

  return (
    <main className={s.wrap}>
      <div className={`ui-card ${s.card}`} role={error ? 'alert' : 'status'}>
        <div className="ui-empty">
          <span className="ui-empty__icon" aria-hidden>
            <Icon name={error ? 'x' : 'refresh'} size={24} />
          </span>
          <p className="ui-empty__title">{error || '로그인하는 중이에요…'}</p>
          {error && (
            <Link href="/" className="ui-btn ui-btn--primary">
              처음으로
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
