'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, clearToken } from '@/lib/api';
import CopyButton from '@/components/CopyButton';
import LegalModal from '@/components/LegalModal';
import type { User } from '@/lib/types';

export default function AccountDrawer({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [legal, setLegal] = useState<'terms' | 'privacy' | null>(null);

  useEffect(() => {
    api<{ user: User }>('/api/auth/me')
      .then((r) => setUser(r.user))
      .catch(() => {});
  }, []);

  function logout() {
    clearToken();
    onClose();
    router.push('/');
  }

  return (
    <div className="app-drawer-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="app-drawer">
        <div className="app-row">
          <strong>계정</strong>
          <span className="app-spacer" />
          <button className="app-btn app-btn--ghost" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>

        {user && (
          <>
            <div className="app-drawer-profile">
              {user.picture && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.picture} alt="" width={56} height={56} style={{ borderRadius: '50%' }} />
              )}
              <div>
                <div>
                  <strong>{user.name}</strong>
                  {user.isAdmin && <span style={{ color: 'var(--color-success)' }}> · 관리자</span>}
                </div>
                <div className="app-muted">{user.email}</div>
              </div>
            </div>

            <div className="app-card" style={{ margin: 0 }}>
              <div className="app-muted" style={{ fontSize: '0.8rem' }}>
                내 고유 번호
              </div>
              <div className="app-row">
                <code style={{ wordBreak: 'break-all' }}>{user._id}</code>
                <span className="app-spacer" />
                <CopyButton text={user._id} label="복사" />
              </div>
            </div>

            {user.isAdmin && (
              <Link className="app-btn app-btn--ghost" href="/admin" onClick={onClose}>
                관리자 페이지 →
              </Link>
            )}
            <button className="app-btn app-btn--ghost" onClick={logout}>
              로그아웃
            </button>
          </>
        )}

        <span className="app-spacer" />
        <div className="app-row">
          <button className="app-btn app-btn--ghost" onClick={() => setLegal('terms')}>
            이용약관
          </button>
          <button className="app-btn app-btn--ghost" onClick={() => setLegal('privacy')}>
            개인정보 처리방침
          </button>
        </div>

        {legal && <LegalModal type={legal} onClose={() => setLegal(null)} />}
      </aside>
    </div>
  );
}
