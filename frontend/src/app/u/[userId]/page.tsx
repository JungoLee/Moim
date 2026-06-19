'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Nav from '@/components/Nav';
import { api, getToken } from '@/lib/api';
import { formatRange } from '@/lib/format';
import type { MoimEvent, User } from '@/lib/types';

export default function FriendCalendar() {
  const router = useRouter();
  const params = useParams();
  const userId = params.userId as string;

  const [owner, setOwner] = useState<User | null>(null);
  const [tier, setTier] = useState('');
  const [events, setEvents] = useState<MoimEvent[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await api<{ owner: User; tier: string; events: MoimEvent[] }>(`/api/calendar/${userId}`);
      setOwner(res.owner);
      setTier(res.tier);
      setEvents(res.events);
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패');
    }
  }, [userId]);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/');
      return;
    }
    load();
  }, [router, load]);

  return (
    <>
      <Nav />
      <main className="app-container">
        <h2>{owner ? `${owner.name} 님의 캘린더` : '캘린더'}</h2>
        {tier === 'normal' && <p className="app-muted">이 친구는 바쁜 시간만 공개합니다.</p>}
        {tier === 'close' && <p className="app-muted">상세 일정을 볼 수 있습니다.</p>}
        {error && <p className="app-error">{error}</p>}
        {events.length === 0 && !error && <p className="app-muted">표시할 일정이 없습니다.</p>}
        {events.map((ev) => (
          <div className="app-card" key={ev._id}>
            <div className="app-row">{ev.busy ? <strong className="app-muted">바쁨</strong> : <strong>{ev.title}</strong>}</div>
            <div className="app-muted">{formatRange(ev.start, ev.end)}</div>
            {ev.location && <div className="app-muted">📍 {ev.location}</div>}
          </div>
        ))}
      </main>
    </>
  );
}
