'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Nav from '@/components/Nav';
import { api, getToken } from '@/lib/api';
import { displayName } from '@/lib/format';
import { toast } from '@/lib/toast';
import type { User } from '@/lib/types';
import styles from './admin.module.scss';

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
      toast(u.isAdmin ? '관리자 권한을 해제했습니다' : '관리자로 지정했습니다', 'success');
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : '변경 실패', 'error');
    }
  }

  const adminCount = users.filter((u) => u.isAdmin).length;

  return (
    <>
      <Nav />
      <main className="app-container">
        <div className={styles.head}>
          <span className={styles.badge}>ADMIN</span>
          <h2 style={{ margin: 0 }}>관리자</h2>
        </div>

        {error ? (
          <p className="app-error">{error}</p>
        ) : (
          <>
            <div className={styles.stats}>
              <div className="app-card" style={{ margin: 0 }}>
                <div className="app-muted">전체 가입자</div>
                <div className={styles.statNum}>{users.length}</div>
              </div>
              <div className="app-card" style={{ margin: 0 }}>
                <div className="app-muted">관리자</div>
                <div className={styles.statNum}>{adminCount}</div>
              </div>
            </div>

            <div className="app-card">
              <h3>가입자 목록</h3>
              {users.map((u) => (
                <div key={u._id} className={styles.userRow}>
                  {u.picture ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={u.picture} alt="" className="app-avatar-sm" style={{ width: 32, height: 32 }} />
                  ) : (
                    <span className={styles.avatarFallback}>👤</span>
                  )}
                  <div className={styles.userInfo}>
                    <div>
                      <strong>{displayName(u)}</strong>
                      {u.isAdmin && <span className={styles.adminTag}>관리자</span>}
                    </div>
                    <div className="app-muted" style={{ fontSize: '0.8rem' }}>
                      {u.email}
                      {u.createdAt && ` · 가입 ${new Date(u.createdAt).toLocaleDateString('ko-KR')}`}
                    </div>
                  </div>
                  <span className="app-spacer" />
                  <button className="app-btn app-btn--ghost" onClick={() => toggle(u)}>
                    {u.isAdmin ? '관리자 해제' : '관리자 지정'}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </>
  );
}
