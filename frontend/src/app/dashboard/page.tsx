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
  const [tiers, setTiers] = useState<Tier[]>([]);
  // 공개 범위: 'public'(누구나) | 'private'(나만) | 'tier:<id>'(특정 그룹에만)
  const [share, setShare] = useState<string>('public');

  // 일정 수정 모달
  const [editing, setEditing] = useState<MoimEvent | null>(null);
  const [eTitle, setETitle] = useState('');
  const [eStart, setEStart] = useState('');
  const [eEnd, setEEnd] = useState('');
  const [eMemo, setEMemo] = useState('');
  const [eShare, setEShare] = useState('public');

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
    let visibility: 'public' | 'private' = 'public';
    let audienceTiers: string[] = [];
    if (share === 'private') {
      visibility = 'private';
    } else if (share.startsWith('tier:')) {
      visibility = 'private';
      audienceTiers = [share.slice(5)];
    }
    try {
      await api('/api/events', {
        method: 'POST',
        body: { title: finalTitle, start, end, visibility, audienceTiers },
      });
      setTitle('');
      setStart('');
      setEnd('');
      setShare('public');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '추가 실패');
    }
  }

  async function removeEvent(id: string) {
    await api(`/api/events/${id}`, { method: 'DELETE' });
    load();
  }

  // 일정 클릭 → 수정 모달 열기
  function openEdit(id: string) {
    const ev = events.find((e) => e._id === id);
    if (!ev) return;
    setEditing(ev);
    setETitle(ev.title || '');
    setEStart(toLocalInput(new Date(ev.start)));
    setEEnd(toLocalInput(new Date(ev.end)));
    setEMemo(ev.memo || '');
    setEShare(
      ev.visibility === 'private'
        ? ev.audienceTiers && ev.audienceTiers.length
          ? `tier:${ev.audienceTiers[0]}`
          : 'private'
        : 'public'
    );
    loadTiers();
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editing || !eStart || !eEnd) return;
    let visibility: 'public' | 'private' = 'public';
    let audienceTiers: string[] = [];
    if (eShare === 'private') visibility = 'private';
    else if (eShare.startsWith('tier:')) {
      visibility = 'private';
      audienceTiers = [eShare.slice(5)];
    }
    try {
      await api(`/api/events/${editing._id}`, {
        method: 'PATCH',
        body: { title: eTitle.trim() || '새 일정', start: eStart, end: eEnd, memo: eMemo, visibility, audienceTiers },
      });
      setEditing(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '수정 실패');
    }
  }

  async function deleteEditing() {
    if (!editing) return;
    await api(`/api/events/${editing._id}`, { method: 'DELETE' });
    setEditing(null);
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
              value={share}
              onFocus={loadTiers}
              onChange={(e) => setShare(e.target.value)}
            >
              <option value="public">공유 (누구나)</option>
              <option value="private">비공개 (나만)</option>
              {tiers.length > 0 && (
                <optgroup label="이 그룹에만 공개">
                  {tiers.map((t) => (
                    <option key={t._id} value={`tier:${t._id}`}>
                      🔒 {t.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <button className="app-btn" type="submit">
              추가
            </button>
          </div>

          {tiers.length === 0 && (
            <p className="app-muted" style={{ marginTop: 'var(--space-2)' }}>
              특정 그룹에만 공개하려면 <Link href="/tiers">그룹</Link>을 먼저 만드세요.
            </p>
          )}
        </form>

        <Calendar events={events} onSelectRange={pickRange} onSelectEvent={openEdit} />

        <h3>일정 목록</h3>
        {events.length === 0 && <p className="app-muted">아직 일정이 없습니다.</p>}
        {events.map((ev) => (
          <div className="app-card" key={ev._id}>
            <div className="app-row">
              <strong>{ev.title}</strong>
              {ev.visibility === 'private' && <span className="app-muted">· 비공개</span>}
              <span className="app-spacer" />
              <button className="app-btn app-btn--ghost" onClick={() => openEdit(ev._id)}>
                수정
              </button>
              <button className="app-btn app-btn--ghost" onClick={() => removeEvent(ev._id)}>
                삭제
              </button>
            </div>
            <div className="app-muted">{formatRange(ev.start, ev.end)}</div>
          </div>
        ))}

        {editing && (
          <div className="app-modal-backdrop" onClick={() => setEditing(null)}>
            <form className="app-modal" onClick={(e) => e.stopPropagation()} onSubmit={saveEdit}>
              <h3>일정 수정</h3>
              <input className="app-input" placeholder="제목" value={eTitle} onChange={(e) => setETitle(e.target.value)} />
              <label className="app-muted">
                시작{' '}
                <input className="app-input" type="datetime-local" value={eStart} onChange={(e) => setEStart(e.target.value)} />
              </label>
              <label className="app-muted">
                종료{' '}
                <input className="app-input" type="datetime-local" value={eEnd} onChange={(e) => setEEnd(e.target.value)} />
              </label>
              <textarea
                className="app-textarea"
                placeholder="내용 (메모)"
                value={eMemo}
                onChange={(e) => setEMemo(e.target.value)}
                rows={3}
              />
              <select className="app-select" value={eShare} onChange={(e) => setEShare(e.target.value)}>
                <option value="public">공유 (누구나)</option>
                <option value="private">비공개 (나만)</option>
                {tiers.length > 0 && (
                  <optgroup label="이 그룹에만 공개">
                    {tiers.map((t) => (
                      <option key={t._id} value={`tier:${t._id}`}>
                        🔒 {t.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              <div className="app-row">
                <button className="app-btn" type="submit">
                  저장
                </button>
                <button type="button" className="app-btn app-btn--ghost" onClick={() => setEditing(null)}>
                  취소
                </button>
                <span className="app-spacer" />
                <button type="button" className="app-btn app-btn--ghost" onClick={deleteEditing}>
                  삭제
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </>
  );
}
