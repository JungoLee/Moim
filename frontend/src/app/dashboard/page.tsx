'use client';

import { useEffect, useState, useCallback } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Nav from '@/components/Nav';
import Calendar from '@/components/Calendar';
import { api, getToken } from '@/lib/api';
import { formatRange } from '@/lib/format';
import type { MoimEvent, User } from '@/lib/types';

// Date → datetime-local 입력 형식(YYYY-MM-DDTHH:mm, 로컬 기준)
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [events, setEvents] = useState<MoimEvent[]>([]);
  const [error, setError] = useState('');

  const [title, setTitle] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [visibility, setVisibility] = useState<'default' | 'private'>('default');

  const load = useCallback(async () => {
    try {
      const meRes = await api<{ user: User }>('/api/auth/me');
      setUser(meRes.user);
      const evRes = await api<{ events: MoimEvent[] }>('/api/events');
      setEvents(evRes.events);
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패');
    }
  }, []);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/');
      return;
    }
    load();
  }, [router, load]);

  async function addEvent(e: FormEvent) {
    e.preventDefault();
    if (!start || !end) return;
    const finalTitle = title.trim() || '새 일정'; // 제목 비면 기본값
    try {
      await api('/api/events', { method: 'POST', body: { title: finalTitle, start, end, visibility } });
      setTitle('');
      setStart('');
      setEnd('');
      setVisibility('default');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '추가 실패');
    }
  }

  async function removeEvent(id: string) {
    await api(`/api/events/${id}`, { method: 'DELETE' });
    load();
  }

  // 캘린더에서 날짜 클릭/드래그 → 새 일정 기간 프리필 (시작일 09시 ~ 종료일 10시)
  function pickRange(startDay: Date, endDay: Date) {
    const s = new Date(startDay);
    s.setHours(9, 0, 0, 0);
    const e = new Date(endDay);
    e.setHours(10, 0, 0, 0);
    setStart(toLocalInput(s));
    setEnd(toLocalInput(e));
  }

  return (
    <>
      <Nav />
      <main className="app-container">
        <h2>{user ? `${user.name} 님의 캘린더` : '내 캘린더'}</h2>
        {error && <p className="app-error">{error}</p>}

        <form className="app-card" onSubmit={addEvent}>
          <div className="app-row">
            <input className="app-input" placeholder="일정 제목" value={title} onChange={(e) => setTitle(e.target.value)} />
            <input className="app-input" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
            <input className="app-input" type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
            <select
              className="app-select"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as 'default' | 'private')}
            >
              <option value="default">공유(등급 따름)</option>
              <option value="private">비공개(바쁨만)</option>
            </select>
            <button className="app-btn" type="submit">
              추가
            </button>
          </div>
        </form>

        <Calendar events={events} onSelectRange={pickRange} />

        <h3>일정 목록</h3>
        {events.length === 0 && <p className="app-muted">아직 일정이 없습니다.</p>}
        {events.map((ev) => (
          <div className="app-card" key={ev._id}>
            <div className="app-row">
              <strong>{ev.title}</strong>
              {ev.visibility === 'private' && <span className="app-muted">· 비공개</span>}
              <span className="app-spacer" />
              <button className="app-btn app-btn--ghost" onClick={() => removeEvent(ev._id)}>
                삭제
              </button>
            </div>
            <div className="app-muted">{formatRange(ev.start, ev.end)}</div>
          </div>
        ))}
      </main>
    </>
  );
}
