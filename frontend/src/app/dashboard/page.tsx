'use client';

import { useEffect, useState, useCallback } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Nav from '@/components/Nav';
import Calendar from '@/components/Calendar';
import { api, getToken } from '@/lib/api';
import { formatRange } from '@/lib/format';
import type { MoimEvent, Tier, User } from '@/lib/types';

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
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [audienceTiers, setAudienceTiers] = useState<string[]>([]);

  const loadTiers = useCallback(async () => {
    try {
      const tRes = await api<{ tiers: Tier[] }>('/api/tiers');
      setTiers(tRes.tiers);
    } catch {
      /* 그룹 로드 실패는 일정 작성 흐름을 막지 않음 */
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const meRes = await api<{ user: User }>('/api/auth/me');
      setUser(meRes.user);
      const evRes = await api<{ events: MoimEvent[] }>('/api/events');
      setEvents(evRes.events);
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패');
    }
    loadTiers();
  }, [loadTiers]);

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
      await api('/api/events', {
        method: 'POST',
        body: { title: finalTitle, start, end, visibility, audienceTiers: visibility === 'private' ? audienceTiers : [] },
      });
      setTitle('');
      setStart('');
      setEnd('');
      setVisibility('public');
      setAudienceTiers([]);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '추가 실패');
    }
  }

  async function removeEvent(id: string) {
    await api(`/api/events/${id}`, { method: 'DELETE' });
    load();
  }

  function toggleAudience(tierId: string) {
    setAudienceTiers((cur) => (cur.includes(tierId) ? cur.filter((id) => id !== tierId) : [...cur, tierId]));
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
              onChange={(e) => {
                const v = e.target.value as 'public' | 'private';
                setVisibility(v);
                if (v === 'private') loadTiers(); // 최근 만든 그룹까지 최신 반영
              }}
            >
              <option value="public">공유(누구나)</option>
              <option value="private">비공개(선택 그룹)</option>
            </select>
            <button className="app-btn" type="submit">
              추가
            </button>
          </div>

          {visibility === 'private' && (
            <div className="app-row" style={{ marginTop: 'var(--space-2)' }}>
              <span className="app-muted">공개할 그룹:</span>
              {tiers.length === 0 ? (
                <span className="app-muted">
                  없음 — <Link href="/tiers">그룹 만들기</Link> (비우면 나만 봅니다)
                </span>
              ) : (
                tiers.map((t) => (
                  <label key={t._id} className="app-muted">
                    <input
                      type="checkbox"
                      checked={audienceTiers.includes(t._id)}
                      onChange={() => toggleAudience(t._id)}
                    />{' '}
                    {t.name}
                  </label>
                ))
              )}
            </div>
          )}
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
