'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, getToken } from '@/lib/api';
import { confirmDialog } from '@/lib/confirm';
import { displayName } from '@/lib/format';
import { dayLabel, timeKey } from '@/lib/datetime';
import { toast } from '@/lib/toast';
import CopyButton from '@/components/CopyButton';
import { BRAND_NAME } from '@/lib/brand';
import type { User } from '@/lib/types';
import styles from './admin.module.scss';

type Stats = { users: number; admins: number; events: number; tiers: number; rooms: number; friendships: number };
type Entity = { _id: string; name: string; code: string; memberCount: number; owner: string; createdAt?: string };
type Tab = 'overview' | 'users' | 'rooms' | 'tiers';
// TEMP(email-approval): 이메일 로그인 코드 수동 전달용 — 발송 수단(Brevo/SMTP) 설정 후 제거 가능
type PendingCode = { _id: string; email: string; code: string; expiresAt: string };

const STAT_LABELS: Array<[keyof Stats, string]> = [
  ['users', '가입자'],
  ['admins', '관리자'],
  ['events', '일정'],
  ['tiers', '그룹'],
  ['rooms', '모임'],
  ['friendships', '친구 관계'],
];

const TABS: Array<[Tab, string, string]> = [
  ['overview', '📊', '대시보드'],
  ['users', '👤', '가입자'],
  ['rooms', '📅', '모임'],
  ['tiers', '🏷️', '그룹'],
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
  const [pendingCodes, setPendingCodes] = useState<PendingCode[]>([]); // TEMP(email-approval)
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const s = await api<{ stats: Stats }>('/api/admin/stats');
      setStats(s.stats);
      const u = await api<{ users: User[] }>('/api/admin/users');
      setUsers(u.users);
      // TEMP(email-approval): 발송 수단이 생기면 항상 빈 배열
      const c = await api<{ codes: PendingCode[] }>('/api/admin/login-codes');
      setPendingCodes(c.codes);
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

  if (error) {
    return (
      <main className="app-container">
        <div className="app-empty">
          <div className="app-empty-icon">🔒</div>
          <h2>{error}</h2>
          <Link className="app-btn" href="/home">
            메인으로
          </Link>
        </div>
      </main>
    );
  }

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          ADMIN <span className="brand-mark">{BRAND_NAME}</span>
        </div>
        <nav className={styles.nav}>
          {TABS.map(([v, ico, label]) => (
            <button
              key={v}
              className={tab === v ? `${styles.navItem} ${styles.active}` : styles.navItem}
              onClick={() => setTab(v)}
            >
              <span className={styles.ico}>{ico}</span>
              {label}
            </button>
          ))}
        </nav>
        <div className={styles.spacer} />
        <div className={styles.footLink}>
          <Link href="/home" className={styles.navItem}>
            <span className={styles.ico}>🏠</span> 메인으로
          </Link>
        </div>
      </aside>

      <main className={styles.main}>
        {tab === 'overview' && (
          <>
            <h2 className={styles.pageTitle}>대시보드</h2>
            {stats && (
              <div className={styles.cards}>
                {STAT_LABELS.map(([key, label]) => (
                  <div className={styles.card} key={key}>
                    <div className={styles.num}>{stats[key]}</div>
                    <div className={styles.lab}>{label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* TEMP(email-approval): 발송 수단(Brevo/SMTP) 미설정 동안 관리자가 코드를 직접 전달(승인).
                발송 수단 설정 후엔 목록이 항상 비어 렌더되지 않음 → 그때 이 섹션 제거 가능 */}
            {pendingCodes.length > 0 && (
              <>
                <h3 className={styles.sectionTitle}>📨 이메일 로그인 코드 대기 ({pendingCodes.length})</h3>
                <p className={styles.hint}>
                  메일 발송이 아직 꺼져 있어요 — 코드를 요청한 본인에게 직접 전달(카톡 등)하면 승인됩니다.
                </p>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>이메일</th>
                        <th>코드</th>
                        <th>만료</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingCodes.map((c) => (
                        <tr key={c._id}>
                          <td>{c.email}</td>
                          <td className={styles.codeCell}>{c.code}</td>
                          <td className={styles.metaCell}>{timeKey(new Date(c.expiresAt))} 까지</td>
                          <td className={styles.actionsCell}>
                            <CopyButton text={c.code} label="복사" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className={styles.sectionGap}>
                  <button className={styles.btnSm} onClick={load}>
                    새로고침
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {tab === 'users' && (
          <>
            <h2 className={styles.pageTitle}>가입자 ({users.length})</h2>
            <div className={styles.tableWrap}>
              {users.length === 0 ? (
                <div className={styles.empty}>가입자가 없습니다.</div>
              ) : (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>사용자</th>
                      <th>이메일</th>
                      <th>가입일</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u._id}>
                        <td>
                          <span className={styles.userCell}>
                            {u.picture ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={u.picture} alt="" className="app-avatar-sm" style={{ width: 28, height: 28 }} />
                            ) : (
                              <span className={styles.avatarFallback}>👤</span>
                            )}
                            <strong>{displayName(u)}</strong>
                            {u.isAdmin && <span className={`${styles.badge} ${styles.badgeAdmin}`}>관리자</span>}
                          </span>
                        </td>
                        <td className={styles.metaCell}>{u.email}</td>
                        <td className={styles.metaCell}>{fmtDate(u.createdAt)}</td>
                        <td className={styles.actionsCell}>
                          <button className={styles.btnSm} onClick={() => toggleAdmin(u)}>
                            {u.isAdmin ? '관리자 해제' : '관리자 지정'}
                          </button>
                          <button className={`${styles.btnSm} ${styles.btnDanger}`} onClick={() => deleteUser(u)}>
                            삭제
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {tab === 'rooms' && (
          <>
            <h2 className={styles.pageTitle}>모임 ({rooms.length})</h2>
            <div className={styles.tableWrap}>
              {rooms.length === 0 ? (
                <div className={styles.empty}>모임이 없습니다.</div>
              ) : (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>이름</th>
                      <th>방장</th>
                      <th>멤버</th>
                      <th>코드</th>
                      <th>생성</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rooms.map((r) => (
                      <tr key={r._id}>
                        <td>
                          <strong>{r.name}</strong>
                        </td>
                        <td className={styles.metaCell}>{r.owner}</td>
                        <td className={styles.metaCell}>{r.memberCount}명</td>
                        <td className={styles.codeCell}>{r.code}</td>
                        <td className={styles.metaCell}>{fmtDate(r.createdAt)}</td>
                        <td className={styles.actionsCell}>
                          <button
                            className={`${styles.btnSm} ${styles.btnDanger}`}
                            onClick={() => deleteEntity('rooms', r)}
                          >
                            삭제
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {tab === 'tiers' && (
          <>
            <h2 className={styles.pageTitle}>그룹 ({tiers.length})</h2>
            <div className={styles.tableWrap}>
              {tiers.length === 0 ? (
                <div className={styles.empty}>그룹이 없습니다.</div>
              ) : (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>이름</th>
                      <th>소유</th>
                      <th>멤버</th>
                      <th>코드</th>
                      <th>생성</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {tiers.map((t) => (
                      <tr key={t._id}>
                        <td>
                          <strong>{t.name}</strong>
                        </td>
                        <td className={styles.metaCell}>{t.owner}</td>
                        <td className={styles.metaCell}>{t.memberCount}명</td>
                        <td className={styles.codeCell}>{t.code}</td>
                        <td className={styles.metaCell}>{fmtDate(t.createdAt)}</td>
                        <td className={styles.actionsCell}>
                          <button
                            className={`${styles.btnSm} ${styles.btnDanger}`}
                            onClick={() => deleteEntity('tiers', t)}
                          >
                            삭제
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
