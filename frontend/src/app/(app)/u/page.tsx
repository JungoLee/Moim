'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Nav from '@/components/Nav';
import Calendar from '@/components/Calendar';
import PageHero from '@/components/PageHero';
import { api, getToken } from '@/lib/api';
import type { MoimEvent, User } from '@/lib/types';

export default function FriendCalendar() {
  const router = useRouter();
  // 정적 export 는 동적 세그먼트를 만들 수 없어 ?id= 로 받는다 (구 /u/<id> 는 워커가 301)
  const [userId, setUserId] = useState('');

  const [owner, setOwner] = useState<User | null>(null);
  const [events, setEvents] = useState<MoimEvent[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    setUserId(new URLSearchParams(window.location.search).get('id') || '');
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await api<{ owner: User; relation: string; events: MoimEvent[] }>(`/api/calendar/${userId}`);
      setOwner(res.owner);
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
    if (!userId) return;
    load();
  }, [router, load, userId]);

  return (
    <>
      <Nav />
      <main className="app-container">
        <PageHero
          icon="calendar"
          title={owner ? `${owner.name} 님의 캘린더` : '캘린더'}
          desc="공유 일정은 상세히, 비공개 일정은 내가 속한 그룹일 때만 상세로 보여요."
        />
        {error && <p className="app-error">{error}</p>}
        {!error && <Calendar events={events} />}
        {events.length === 0 && !error && <p className="app-muted">표시할 일정이 없습니다.</p>}
      </main>
    </>
  );
}
