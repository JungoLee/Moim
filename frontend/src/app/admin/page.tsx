'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Nav from '@/components/Nav';
import { api, getToken } from '@/lib/api';
import { confirmDialog } from '@/lib/confirm';
import { displayName } from '@/lib/format';
import { dayLabel } from '@/lib/datetime';
import { toast } from '@/lib/toast';
import type { User } from '@/lib/types';
import styles from './admin.module.scss';

type Stats = { users: number; admins: number; events: number; tiers: number; rooms: number; friendships: number };
type Entity = { _id: string; name: string; code: string; memberCount: number; owner: string; createdAt?: string };
type Tab = 'overview' | 'users' | 'rooms' | 'tiers';

const STAT_LABELS: Array<[keyof Stats, string]> = [
  ['users', '가입자'],
  ['admins', '관리자'],
  ['events', '일정'],
  ['tiers', '그룹'],
  ['rooms', '모임'],
  ['friendships', '친구 관계'],
];

const TABS: Array<[Tab, string]> = [
  ['overview', '개요'],
  ['users', '가입자'],
  ['rooms', '모임'],
  ['tiers', '그룹'],
];

function fmtDate(s?: string): string {
  return s ? dayLabel(new Date(s)) : '';
}

export default function Admin() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [rooms, setRooms] = useState<Entity[]>([]);
  const [tiers, setTiers] = useState<Entity[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const s = await api<{ stats: Stats }>('/api/admin/stats');
      setStats(s.stats);
      const u = await api<{ users: User[] }>('/api/admin/users');
      setUsers(u.users);
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

  // 탭 진입 시 지연 로드
  useEffect(() => {
    if (tab === 'rooms' && rooms.length === 0) {
      api<{ rooms: Entity[] }>('/api/admin/rooms').then((r) => setRooms(r.rooms)).catch(() => {});
    }
    if (tab === 'tiers' && tiers.length === 0) {
      api<{ tiers: Entity[] }>('/api/admin/tiers').then((r) => setTiers(r.tiers)).catch(() => {});
    }
  }, [tab, rooms.length, tiers.length]);

  async function toggleAdmin(u: User) {
    try {
      await api(`/api/admin/users/${u._id}/admin`, { method: 'PATCH', body: { isAdmin: !u.isAdmin } });
      toast(u.isAdmin ? '관리자 권한을 해제했습니다' : '관리자로 지정했습니다', 'success');
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : '변경 실패', 'error');
    }
  }

  async function deleteUser(u: User) {
    if (
      !(await confirmDialog({
        message: `'${displayName(u)}' 회원을 삭제할까요?\n이 사용자의 일정·그룹·모임 등 데이터가 함께 삭제됩니다.`,
        confirmText: '삭제',
        danger: true,
      }))
    )
      return;
    try {
      await api(`/api/admin/users/${u._id}`, { method: 'DELETE' });
      toast('회원을 삭제했습니다', 'success');
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : '삭제 실패', 'error');
    }
  }

  async function deleteEntity(kind: 'rooms' | 'tiers', e: Entity) {
    if (!(await confirmDialog({ message: `'${e.name}'을(를) 삭제할까요?`, confirmText: '삭제', danger: true }))) return;
    try {
      await api(`/api/admin/${kind}/${e._id}`, { method: 'DELETE' });
      toast('삭제했습니다', 'success');
      if (kind === 'rooms') setRooms((prev) => prev.filter((x) => x._id !== e._id));
      else setTiers((prev) => prev.filter((x) => x._id !== e._id));
    } catch (err) {
      toast(err instanceof Error ? err.message : '삭제 실패', 'error');
    }
  }

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
            <div className={styles.tabs}>
              {TABS.map(([v, label]) => (
                <button key={v} className={tab === v ? 'app-btn' : 'app-btn app-btn--ghost'} onClick={() => setTab(v)}>
                  {label}
                </button>
              ))}
            </div>

            {tab === 'overview' && stats && (
              <div className={styles.statGrid}>
                {STAT_LABELS.map(([key, label]) => (
                  <div className="app-card" style={{ margin: 0 }} key={key}>
                    <div className="app-muted">{label}</div>
                    <div className={styles.statNum}>{stats[key]}</div>
                  </div>
                ))}
              </div>
            )}

            {tab === 'users' && (
              <div className="app-card">
                <h3>가입자 {users.length}명</h3>
                {users.map((u) => (
                  <div key={u._id} className={styles.row}>
                    {u.picture ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={u.picture} alt="" className="app-avatar-sm" style={{ width: 32, height: 32 }} />
                    ) : (
                      <span className={styles.avatarFallback}>👤</span>
                    )}
                    <div className={styles.info}>
                      <div>
                        <strong>{displayName(u)}</strong>
                        {u.isAdmin && <span className={styles.adminTag}>관리자</span>}
                      </div>
                      <div className="app-muted" style={{ fontSize: '0.8rem' }}>
                        {u.email}
                        {u.createdAt && ` · 가입 ${fmtDate(u.createdAt)}`}
                      </div>
                    </div>
                    <span className="app-spacer" />
                    <button className="app-btn app-btn--ghost" onClick={() => toggleAdmin(u)}>
                      {u.isAdmin ? '관리자 해제' : '관리자 지정'}
                    </button>
                    <button className={`app-btn app-btn--ghost ${styles.danger}`} onClick={() => deleteUser(u)}>
                      삭제
                    </button>
                  </div>
                ))}
              </div>
            )}

            {tab === 'rooms' && (
              <div className="app-card">
                <h3>모임 {rooms.length}개</h3>
                {rooms.length === 0 && <p className="app-muted">모임이 없습니다.</p>}
                {rooms.map((r) => (
                  <div key={r._id} className={styles.row}>
                    <div className={styles.info}>
                      <strong>{r.name}</strong>
                      <div className="app-muted" style={{ fontSize: '0.8rem' }}>
                        방장 {r.owner} · 멤버 {r.memberCount}명 · 코드 {r.code} · {fmtDate(r.createdAt)}
                      </div>
                    </div>
                    <span className="app-spacer" />
                    <button className={`app-btn app-btn--ghost ${styles.danger}`} onClick={() => deleteEntity('rooms', r)}>
                      삭제
                    </button>
                  </div>
                ))}
              </div>
            )}

            {tab === 'tiers' && (
              <div className="app-card">
                <h3>그룹 {tiers.length}개</h3>
                {tiers.length === 0 && <p className="app-muted">그룹이 없습니다.</p>}
                {tiers.map((t) => (
                  <div key={t._id} className={styles.row}>
                    <div className={styles.info}>
                      <strong>{t.name}</strong>
                      <div className="app-muted" style={{ fontSize: '0.8rem' }}>
                        소유 {t.owner} · 멤버 {t.memberCount}명 · 코드 {t.code} · {fmtDate(t.createdAt)}
                      </div>
                    </div>
                    <span className="app-spacer" />
                    <button className={`app-btn app-btn--ghost ${styles.danger}`} onClick={() => deleteEntity('tiers', t)}>
                      삭제
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
