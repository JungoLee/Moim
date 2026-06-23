'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Nav from '@/components/Nav';
import DatePicker from '@/components/DatePicker';
import Select from '@/components/Select';
import { api, getToken } from '@/lib/api';
import { formatRange, displayName } from '@/lib/format';
import { eventColor } from '@/lib/colors';
import { toast } from '@/lib/toast';
import type { Friend, TimeRequest, MoimEvent } from '@/lib/types';

const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, m) => String(m * 5).padStart(2, '0'));

// 내가 보낸(대기 중) 시간 요청 날짜는 일정과 구분되는 색으로 표시
const REQUEST_COLOR = '#a855f7';

const STATUS: Record<TimeRequest['status'], string> = {
  pending: '대기 중',
  accepted: '수락됨',
  declined: '거절됨',
};

function todayStr(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export default function Requests() {
  const router = useRouter();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [received, setReceived] = useState<TimeRequest[]>([]);
  const [sent, setSent] = useState<TimeRequest[]>([]);
  const [events, setEvents] = useState<MoimEvent[]>([]);

  const [toId, setToId] = useState('');
  const [date, setDate] = useState(todayStr());
  const [allDay, setAllDay] = useState(false);
  const [startTime, setStartTime] = useState('19:00');
  const [endTime, setEndTime] = useState('20:00');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    try {
      const f = await api<{ friends: Friend[] }>('/api/friends');
      setFriends(f.friends);
      const ev = await api<{ events: MoimEvent[] }>('/api/events');
      setEvents(ev.events);
      const r = await api<{ requests: TimeRequest[] }>('/api/requests/received');
      setReceived(r.requests);
      const s = await api<{ requests: TimeRequest[] }>('/api/requests/sent');
      setSent(s.requests);
    } catch {
      /* 401 → 자동 로그아웃 */
    }
  }, []);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/');
      return;
    }
    load();
  }, [router, load]);

  // 날짜 → 색 (DatePicker 에 내 일정을 점으로 표시)
  const markedDates = useMemo(() => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const m: Record<string, string> = {};
    const mark = (startISO: string, endISO: string, color: string) => {
      const e = new Date(endISO);
      const last = new Date(e.getFullYear(), e.getMonth(), e.getDate());
      let cur = new Date(startISO);
      cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate());
      while (cur.getTime() <= last.getTime()) {
        m[`${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`] = color;
        cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1);
      }
    };
    for (const ev of events) mark(ev.start, ev.end, eventColor(ev));
    // 내가 보낸(대기 중) 시간 요청은 일정과 다른 색으로 덮어 표시
    for (const r of sent) {
      if (r.status === 'pending') mark(r.start, r.end, REQUEST_COLOR);
    }
    return m;
  }, [events, sent]);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!toId) {
      toast('보낼 친구를 선택하세요', 'error');
      return;
    }
    try {
      const start = allDay ? `${date}T00:00` : `${date}T${startTime}`;
      const end = allDay ? `${date}T23:59` : `${date}T${endTime}`;
      await api('/api/requests', {
        method: 'POST',
        body: { to: toId, start, end, allDay, title, message },
      });
      setTitle('');
      setMessage('');
      toast('시간 요청을 보냈습니다', 'success');
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : '전송 실패', 'error');
    }
  }

  async function act(id: string, action: 'accept' | 'decline') {
    try {
      await api(`/api/requests/${id}/${action}`, { method: 'POST' });
      toast(action === 'accept' ? '수락했습니다 (양쪽 캘린더에 일정 추가)' : '거절했습니다', 'success');
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : '처리 실패', 'error');
    }
  }

  async function cancel(id: string) {
    try {
      await api(`/api/requests/${id}`, { method: 'DELETE' });
      toast('요청을 취소했습니다', 'success');
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : '취소 실패', 'error');
    }
  }

  return (
    <>
      <Nav />
      <main className="app-container">
        <h2>시간 요청</h2>
        <p className="app-muted">친구에게 “이때 시간 내주세요”를 보내고, 수락하면 양쪽 캘린더에 일정이 자동으로 추가됩니다.</p>

        <form className="app-card app-form" onSubmit={send}>
          <h3>요청 보내기</h3>

          <label className="app-form-label">누구에게</label>
          <Select
            value={toId}
            onChange={setToId}
            placeholder="친구 선택"
            ariaLabel="친구 선택"
            options={friends.map((f) => ({ value: f.user._id, label: `${f.user.name} (${f.user.email})` }))}
          />

          <label className="app-form-label">날짜</label>
          <div className="app-form-date">
            <DatePicker value={date} onChange={setDate} markedDates={markedDates} />
          </div>

          <label className="app-form-label">시간</label>
          <label className="app-row" style={{ gap: 'var(--space-2)' }}>
            <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
            <span>종일</span>
          </label>
          {!allDay && (
            <div className="app-row app-when-times">
              <select className="app-select" aria-label="시작 시" value={startTime.slice(0, 2)} onChange={(e) => setStartTime(`${e.target.value}:${startTime.slice(3)}`)}>
                {HOURS.map((h) => (
                  <option key={h} value={h}>{h}시</option>
                ))}
              </select>
              <select className="app-select" aria-label="시작 분" value={startTime.slice(3)} onChange={(e) => setStartTime(`${startTime.slice(0, 2)}:${e.target.value}`)}>
                {MINUTES.map((m) => (
                  <option key={m} value={m}>{m}분</option>
                ))}
              </select>
              <span className="app-muted">~</span>
              <select className="app-select" aria-label="종료 시" value={endTime.slice(0, 2)} onChange={(e) => setEndTime(`${e.target.value}:${endTime.slice(3)}`)}>
                {HOURS.map((h) => (
                  <option key={h} value={h}>{h}시</option>
                ))}
              </select>
              <select className="app-select" aria-label="종료 분" value={endTime.slice(3)} onChange={(e) => setEndTime(`${endTime.slice(0, 2)}:${e.target.value}`)}>
                {MINUTES.map((m) => (
                  <option key={m} value={m}>{m}분</option>
                ))}
              </select>
            </div>
          )}

          <label className="app-form-label">제목</label>
          <input className="app-input" placeholder="예: 저녁 같이 먹어요" value={title} onChange={(e) => setTitle(e.target.value)} />

          <label className="app-form-label">메시지 (선택)</label>
          <input className="app-input" placeholder="짧은 메시지를 남겨보세요" value={message} onChange={(e) => setMessage(e.target.value)} />

          <div className="app-form-actions">
            <button className="app-btn" type="submit">
              보내기
            </button>
          </div>
        </form>

        <h3>받은 요청 ({received.filter((r) => r.status === 'pending').length})</h3>
        {received.length === 0 && <p className="app-muted">받은 요청이 없습니다.</p>}
        {received.map((r) => (
          <div className="app-card" key={r._id}>
            <div className="app-row">
              <strong>{r.from ? displayName(r.from) : '알 수 없음'}</strong>
              <span className="app-muted">{r.title}</span>
              <span className="app-spacer" />
              {r.status === 'pending' ? (
                <>
                  <button className="app-btn" onClick={() => act(r._id, 'accept')}>
                    수락
                  </button>
                  <button className="app-btn app-btn--ghost" onClick={() => act(r._id, 'decline')}>
                    거절
                  </button>
                </>
              ) : (
                <span className="app-pill">{STATUS[r.status]}</span>
              )}
            </div>
            <div className="app-muted">{formatRange(r.start, r.end, r.allDay)}</div>
            {r.message && <div className="app-muted">💬 {r.message}</div>}
          </div>
        ))}

        <h3 style={{ marginTop: 'var(--space-6)' }}>보낸 요청 ({sent.length})</h3>
        {sent.length === 0 && <p className="app-muted">보낸 요청이 없습니다.</p>}
        {sent.map((r) => (
          <div className="app-card" key={r._id}>
            <div className="app-row">
              <strong>{r.to ? displayName(r.to) : '알 수 없음'}</strong>
              <span className="app-muted">{r.title}</span>
              <span className="app-spacer" />
              <span className="app-pill">{STATUS[r.status]}</span>
              {r.status === 'pending' && (
                <button className="app-btn app-btn--ghost" onClick={() => cancel(r._id)}>
                  취소
                </button>
              )}
            </div>
            <div className="app-muted">{formatRange(r.start, r.end, r.allDay)}</div>
          </div>
        ))}
      </main>
    </>
  );
}
