'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, clearToken } from '@/lib/api';
import { displayName } from '@/lib/format';
import CopyButton from '@/components/CopyButton';
import LegalModal from '@/components/LegalModal';
import type { User } from '@/lib/types';

export default function AccountDrawer({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [nick, setNick] = useState('');
  const [saved, setSaved] = useState(false);
  const [legal, setLegal] = useState<'terms' | 'privacy' | null>(null);

  useEffect(() => {
    api<{ user: User }>('/api/auth/me')
      .then((r) => {
        setUser(r.user);
        setNick(r.user.nickname || '');
      })
      .catch(() => {});
  }, []);

  // ESC 로 닫기
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function logout() {
    clearToken();
    onClose();
    router.push('/');
  }

  async function saveNick() {
    try {
      const r = await api<{ user: User }>('/api/auth/me', { method: 'PATCH', body: { nickname: nick } });
      setUser(r.user);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch {
      /* 무시 */
    }
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
                  <strong>{displayName(user)}</strong>
                  {user.isAdmin && <span style={{ color: 'var(--color-success)' }}> · 관리자</span>}
                </div>
                <div className="app-muted">{user.email}</div>
              </div>
            </div>

            <div className="app-card" style={{ margin: 0 }}>
              <div className="app-muted" style={{ fontSize: '0.8rem', marginBottom: 'var(--space-2)' }}>
                닉네임 (비우면 구글 이름 사용)
              </div>
              <div className="app-row" style={{ flexWrap: 'nowrap' }}>
                <input
                  className="app-input"
                  style={{ flex: 1, minWidth: 0 }}
                  placeholder={user.name}
                  value={nick}
                  onChange={(e) => setNick(e.target.value)}
                />
                <button className="app-btn" style={{ flexShrink: 0 }} onClick={saveNick}>
                  {saved ? '✓' : '저장'}
                </button>
              </div>
            </div>

            <div className="app-card" style={{ margin: 0 }}>
              <div className="app-muted" style={{ fontSize: '0.8rem' }}>내 고유 번호</div>
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
