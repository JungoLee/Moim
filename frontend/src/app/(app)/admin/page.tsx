'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import Avatar from '@/components/Avatar';
import Icon from '@/components/Icon';
import { api } from '@/lib/api';
import { confirmDialog } from '@/lib/confirm';
import { displayName } from '@/lib/format';
import { fmtDay } from '@/lib/datetime';
import { toast } from '@/lib/toast';
import type { User } from '@/lib/types';
import s from './admin.module.scss';

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
  ['users', '회원'],
  ['rooms', '모임'],
  ['tiers', '그룹'],
];

// '11월 21일 (토)' — 올해가 아니면 앞에 연도
function fmtDate(v?: string): string {
  if (!v) return '';
  const d = new Date(v);
  return d.getFullYear() === new Date().getFullYear() ? fmtDay(d) : `${d.getFullYear()}년 ${fmtDay(d)}`;
}

/** 넓으면 표, 좁으면 상자 안에서 가로로 민다 */
function TableBox({ children }: { children: ReactNode }) {
  return (
    <div className={s.tableWrap} tabIndex={0} role="region" aria-label="목록 (가로로 밀 수 있어요)">
      <table className={s.table}>{children}</table>
    </div>
  );
}

function Loading() {
  return (
    <div className={s.loading} aria-hidden>
      <span className="ui-skeleton" />
      <span className="ui-skeleton" />
      <span className="ui-skeleton" />
    </div>
  );
}

export default function Admin() {
  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<User[] | null>(null);
  const [rooms, setRooms] = useState<Entity[] | null>(null);
  const [tiers, setTiers] = useState<Entity[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const st = await api<{ stats: Stats }>('/api/admin/stats');
      setStats(st.stats);
      const u = await api<{ users: User[] }>('/api/admin/users');
      setUsers(u.users);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '권한이 없어요.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 탭에 들어올 때 처음 한 번만 불러온다
  useEffect(() => {
    if (tab === 'rooms' && rooms === null) {
      api<{ rooms: Entity[] }>('/api/admin/rooms')
        .then((r) => setRooms(r.rooms))
        .catch(() => setRooms([]));
    }
    if (tab === 'tiers' && tiers === null) {
      api<{ tiers: Entity[] }>('/api/admin/tiers')
        .then((r) => setTiers(r.tiers))
        .catch(() => setTiers([]));
    }
  }, [tab, rooms, tiers]);

  async function toggleAdmin(u: User) {
    try {
      await api(`/api/admin/users/${u._id}/admin`, { method: 'PATCH', body: { isAdmin: !u.isAdmin } });
      toast(u.isAdmin ? '관리자 권한을 해제했어요' : '관리자로 지정했어요', 'success');
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : '바꾸지 못했어요', 'error');
    }
  }

  async function deleteUser(u: User) {
    if (
      !(await confirmDialog({
        message: `'${displayName(u)}' 회원을 탈퇴 처리할까요?\n이 회원의 일정·그룹·모임 등 데이터가 함께 지워져요.`,
        confirmText: '탈퇴 처리',
        danger: true,
      }))
    )
      return;
    try {
      await api(`/api/admin/users/${u._id}`, { method: 'DELETE' });
      toast('탈퇴 처리했어요', 'success');
      load();
    } catch (e) {
      toast(e instanceof Error ? e.message : '처리하지 못했어요', 'error');
    }
  }

  async function deleteEntity(kind: 'rooms' | 'tiers', e: Entity) {
    if (!(await confirmDialog({ message: `'${e.name}' 을(를) 삭제할까요?`, confirmText: '삭제', danger: true }))) return;
    try {
      await api(`/api/admin/${kind}/${e._id}`, { method: 'DELETE' });
      toast('삭제했어요', 'success');
      if (kind === 'rooms') setRooms((prev) => (prev || []).filter((x) => x._id !== e._id));
      else setTiers((prev) => (prev || []).filter((x) => x._id !== e._id));
    } catch (err) {
      toast(err instanceof Error ? err.message : '삭제하지 못했어요', 'error');
    }
  }

  if (error) {
    return (
      <div className="ui-page">
        <div className="ui-card">
          <div className="ui-empty">
            <span className="ui-empty__icon" aria-hidden>
              <Icon name="lock" size={24} />
            </span>
            <p className="ui-empty__title">{error}</p>
            <Link className="ui-btn ui-btn--primary" href="/home">
              홈으로
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const entityTable = (kind: 'rooms' | 'tiers', rows: Entity[] | null) => {
    const noun = kind === 'rooms' ? '모임' : '그룹';
    if (rows === null) return <Loading />;
    if (rows.length === 0) return <p className={s.empty}>{noun}이 없어요.</p>;
    return (
      <TableBox>
        <thead>
          <tr>
            <th scope="col">이름</th>
            <th scope="col">{kind === 'rooms' ? '방장' : '소유'}</th>
            <th scope="col">멤버</th>
            <th scope="col">코드</th>
            <th scope="col">만든 날</th>
            <th scope="col">
              <span className="ui-sr-only">동작</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r._id}>
              <td>
                <strong>{r.name}</strong>
              </td>
              <td className={s.meta}>{r.owner}</td>
              <td className={`${s.meta} ui-num`}>{r.memberCount}명</td>
              <td className={s.code}>{r.code}</td>
              <td className={s.meta}>{fmtDate(r.createdAt)}</td>
              <td className={s.actions}>
                <button type="button" className="ui-btn ui-btn--danger ui-btn--sm" onClick={() => deleteEntity(kind, r)}>
                  삭제
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </TableBox>
    );
  };

  const counts: Record<Tab, number | null> = {
    overview: null,
    users: users?.length ?? null,
    rooms: rooms?.length ?? null,
    tiers: tiers?.length ?? null,
  };

  return (
    <div className="ui-page">
      <PageHeader eyebrow="관리자" title="운영" />

      <div className="ui-tabs" role="tablist" aria-label="운영 메뉴">
        {TABS.map(([v, label]) => (
          <button
            key={v}
            type="button"
            role="tab"
            id={`admin-tab-${v}`}
            aria-selected={tab === v}
            aria-controls="admin-panel"
            onClick={() => setTab(v)}
          >
            {label}
            {counts[v] !== null && <span className="ui-num ui-muted">{counts[v]}</span>}
          </button>
        ))}
      </div>

      <div id="admin-panel" role="tabpanel" aria-labelledby={`admin-tab-${tab}`} className={s.panel}>
        {tab === 'overview' &&
          (stats ? (
            <dl className={s.stats}>
              {STAT_LABELS.map(([key, label]) => (
                <div className={`ui-card ${s.stat}`} key={key}>
                  <dt>{label}</dt>
                  <dd className="ui-num">{stats[key]}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <Loading />
          ))}

        {tab === 'users' &&
          (users === null ? (
            <Loading />
          ) : users.length === 0 ? (
            <p className={s.empty}>회원이 없어요.</p>
          ) : (
            <TableBox>
              <thead>
                <tr>
                  <th scope="col">회원</th>
                  <th scope="col">이메일</th>
                  <th scope="col">가입일</th>
                  <th scope="col">
                    <span className="ui-sr-only">동작</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u._id}>
                    <td>
                      <span className={s.userCell}>
                        <Avatar src={u.picture} name={displayName(u)} id={u._id} size="sm" />
                        <strong>{displayName(u)}</strong>
                        {u.isAdmin && <span className="ui-chip ui-chip--accent">관리자</span>}
                      </span>
                    </td>
                    <td className={s.meta}>{u.email}</td>
                    <td className={s.meta}>{fmtDate(u.createdAt)}</td>
                    <td className={s.actions}>
                      <button type="button" className="ui-btn ui-btn--sm" onClick={() => toggleAdmin(u)}>
                        {u.isAdmin ? '관리자 해제' : '관리자 지정'}
                      </button>
                      <button type="button" className="ui-btn ui-btn--danger ui-btn--sm" onClick={() => deleteUser(u)}>
                        탈퇴
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableBox>
          ))}

        {tab === 'rooms' && entityTable('rooms', rooms)}
        {tab === 'tiers' && entityTable('tiers', tiers)}
      </div>
    </div>
  );
}
