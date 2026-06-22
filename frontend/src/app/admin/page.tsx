'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Nav from '@/components/Nav';
import { api, getToken } from '@/lib/api';
import type { User } from '@/lib/types';

export default function Admin() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await api<{ users: User[] }>('/api/admin/users');
      setUsers(r.users);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '권한이 없습니다.');
    }
  }, []);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/');
      return;
    }
    load();
  }, [router, load]);

  async function toggle(u: User) {
    try {
      await api(`/api/admin/users/${u._id}/admin`, { method: 'PATCH', body: { isAdmin: !u.isAdmin } });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '변경 실패');
    }
  }

  return (
    <>
      <Nav />
      <main className="app-container">
        <h2>관리자</h2>
        {error && <p className="app-error">{error}</p>}
        {!error && <p className="app-muted">가입자 {users.length}명</p>}
        {users.map((u) => (
          <div className="app-card" key={u._id}>
            <div className="app-row">
              <strong>{u.name}</strong>
              <span className="app-muted">{u.email}</span>
              {u.isAdmin && <span style={{ color: 'var(--color-success)' }}>· 관리자</span>}
              <span className="app-spacer" />
              <code className="app-muted" style={{ fontSize: '0.72rem' }}>{u._id}</code>
              <button className="app-btn app-btn--ghost" onClick={() => toggle(u)}>
                {u.isAdmin ? '관리자 해제' : '관리자 지정'}
              </button>
            </div>
          </div>
        ))}
      </main>
    </>
  );
}
