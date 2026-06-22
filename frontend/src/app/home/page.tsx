'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Nav from '@/components/Nav';
import { api, getToken } from '@/lib/api';
import { formatRange, displayName } from '@/lib/format';
import type { MoimEvent, User, FriendRequest, RoomSummary } from '@/lib/types';
import styles from './home.module.scss';

const TILES: Array<[string, string, string]> = [
  ['/dashboard', '📅', '내 캘린더'],
  ['/friends', '👥', '친구'],
  ['/tiers', '🏷️', '그룹'],
  ['/rooms', '🗓️', '모임'],
  ['/tools/leave', '🌴', '연차'],
];

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
        <div className={styles.hero}>
          <h2>{user ? `안녕하세요, ${displayName(user)} 님 👋` : '홈'}</h2>
          <p>오늘의 일정과 모임을 한눈에.</p>
        </div>

        <div className={styles.tiles}>
          {TILES.map(([href, icon, label]) => (
            <Link key={href} href={href} className={styles.tile}>
              <span className={styles.icon}>{icon}</span>
              <span className={styles.label}>{label}</span>
            </Link>
          ))}
        </div>

        {requests.length > 0 && (
          <Link href="/friends" className={styles.banner}>
            🔔 <strong>받은 친구 요청 {requests.length}건</strong> — 확인하기 →
          </Link>
        )}

        <div className="app-card">
          <div className={styles.sectionHead}>
            <h3>📅 다가오는 일정</h3>
            <span className="app-spacer" />
            <Link className="app-btn app-btn--ghost" href="/dashboard">
              캘린더 →
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="app-muted">예정된 일정이 없습니다.</p>
          ) : (
            upcoming.map((e) => (
              <div key={e._id} className={styles.row}>
                <strong>{e.title}</strong>
                <span className="app-spacer" />
                <span className="app-muted">{formatRange(e.start, e.end)}</span>
              </div>
            ))
          )}
        </div>

        <div className="app-card">
          <div className={styles.sectionHead}>
            <h3>🗓️ 내 모임</h3>
            <span className="app-spacer" />
            <Link className="app-btn app-btn--ghost" href="/rooms">
              모임 →
            </Link>
          </div>
          {rooms.length === 0 ? (
            <p className="app-muted">참여 중인 모임이 없습니다.</p>
          ) : (
            rooms.slice(0, 5).map((r) => (
              <Link key={r._id} href={`/rooms/${r._id}`} className={styles.row}>
                <strong>{r.name}</strong>
                <span className="app-spacer" />
                <span className="app-muted">멤버 {r.memberCount}명</span>
              </Link>
            ))
          )}
        </div>
      </main>
    </>
  );
}
