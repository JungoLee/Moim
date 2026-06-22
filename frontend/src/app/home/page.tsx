'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Nav from '@/components/Nav';
import { api, getToken } from '@/lib/api';
import { formatRange, displayName } from '@/lib/format';
import type { MoimEvent, User, FriendRequest, RoomSummary } from '@/lib/types';

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [events, setEvents] = useState<MoimEvent[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);

  const load = useCallback(async () => {
    try {
      const me = await api<{ user: User }>('/api/auth/me');
      setUser(me.user);
      const ev = await api<{ events: MoimEvent[] }>('/api/events');
      setEvents(ev.events);
      const rq = await api<{ requests: FriendRequest[] }>('/api/friends/requests');
      setRequests(rq.requests);
      const rm = await api<{ rooms: RoomSummary[] }>('/api/rooms');
      setRooms(rm.rooms);
    } catch {
      /* 401 이면 api 가 자동 로그아웃 처리 */
    }
  }, []);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/');
      return;
    }
    load();
  }, [router, load]);

  const now = Date.now();
  const upcoming = [...events]
    .filter((e) => new Date(e.end).getTime() >= now)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .slice(0, 5);

  return (
    <>
      <Nav />
      <main className="app-container">
        <h2>{user ? `안녕하세요, ${displayName(user)} 님 👋` : '홈'}</h2>

        {requests.length > 0 && (
          <Link href="/friends" className="app-card" style={{ display: 'block' }}>
            <div className="app-row">
              <strong>🔔 받은 친구 요청 {requests.length}건</strong>
              <span className="app-spacer" />
              <span className="app-muted">확인하기 →</span>
            </div>
          </Link>
        )}

        <div className="app-card">
          <div className="app-row">
            <h3 style={{ margin: 0 }}>다가오는 일정</h3>
            <span className="app-spacer" />
            <Link className="app-btn app-btn--ghost" href="/dashboard">
              캘린더 →
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="app-muted">예정된 일정이 없습니다.</p>
          ) : (
            upcoming.map((e) => (
              <div
                key={e._id}
                className="app-row"
                style={{ padding: 'var(--space-2) 0', borderTop: '1px solid var(--color-border-soft)' }}
              >
                <strong>{e.title}</strong>
                <span className="app-spacer" />
                <span className="app-muted">{formatRange(e.start, e.end)}</span>
              </div>
            ))
          )}
        </div>

        <div className="app-card">
          <div className="app-row">
            <h3 style={{ margin: 0 }}>내 모임</h3>
            <span className="app-spacer" />
            <Link className="app-btn app-btn--ghost" href="/rooms">
              모임 →
            </Link>
          </div>
          {rooms.length === 0 ? (
            <p className="app-muted">참여 중인 모임이 없습니다.</p>
          ) : (
            rooms.slice(0, 5).map((r) => (
              <Link
                key={r._id}
                href={`/rooms/${r._id}`}
                className="app-row"
                style={{ padding: 'var(--space-2) 0', borderTop: '1px solid var(--color-border-soft)', display: 'flex' }}
              >
                <strong>{r.name}</strong>
                <span className="app-spacer" />
                <span className="app-muted">멤버 {r.memberCount}명</span>
              </Link>
            ))
          )}
        </div>

        <div className="app-row">
          <Link className="app-btn" href="/dashboard">
            내 캘린더
          </Link>
          <Link className="app-btn app-btn--ghost" href="/friends">
            친구
          </Link>
          <Link className="app-btn app-btn--ghost" href="/tiers">
            그룹
          </Link>
          <Link className="app-btn app-btn--ghost" href="/rooms">
            모임
          </Link>
          <Link className="app-btn app-btn--ghost" href="/tools/leave">
            연차
          </Link>
        </div>
      </main>
    </>
  );
}
