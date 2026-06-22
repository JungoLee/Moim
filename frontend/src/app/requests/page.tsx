'use client';

import { useEffect, useState, useCallback } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Nav from '@/components/Nav';
import DatePicker from '@/components/DatePicker';
import { api, getToken } from '@/lib/api';
import { formatRange, displayName } from '@/lib/format';
import { toast } from '@/lib/toast';
import type { Friend, TimeRequest } from '@/lib/types';

const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, m) => String(m * 5).padStart(2, '0'));

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

  const [toId, setToId] = useState('');
  const [date, setDate] = useState(todayStr());
  const [startTime, setStartTime] = useState('19:00');
  const [endTime, setEndTime] = useState('20:00');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    try {
      const f = await api<{ friends: Friend[] }>('/api/friends');
      setFriends(f.friends);
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

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!toId) {
      toast('보낼 친구를 선택하세요', 'error');
      return;
    }
    try {
      await api('/api/requests', {
        method: 'POST',
        body: { to: toId, start: `${date}T${startTime}`, end: `${date}T${endTime}`, title, message },
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

        <form className="app-card" onSubmit={send}>
          <h3>요청 보내기</h3>
          <div className="app-row">
            <select className="app-input app-field" value={toId} onChange={(e) => setToId(e.target.value)}>
              <option value="">친구 선택</option>
              {friends.map((f) => (
                <option key={f.user._id} value={f.user._id}>
                  {f.user.name} ({f.user.email})
                </option>
              ))}
            </select>
          </div>
          <div className="app-row">
            <DatePicker value={date} onChange={setDate} />
            <select className="app-select" value={startTime.slice(0, 2)} onChange={(e) => setStartTime(`${e.target.value}:${startTime.slice(3)}`)}>
              {HOURS.map((h) => (
                <option key={h} value={h}>{h}시</option>
              ))}
            </select>
            <select className="app-select" value={startTime.slice(3)} onChange={(e) => setStartTime(`${startTime.slice(0, 2)}:${e.target.value}`)}>
              {MINUTES.map((m) => (
                <option key={m} value={m}>{m}분</option>
              ))}
            </select>
            <span className="app-muted">~</span>
            <select className="app-select" value={endTime.slice(0, 2)} onChange={(e) => setEndTime(`${e.target.value}:${endTime.slice(3)}`)}>
              {HOURS.map((h) => (
                <option key={h} value={h}>{h}시</option>
              ))}
            </select>
            <select className="app-select" value={endTime.slice(3)} onChange={(e) => setEndTime(`${endTime.slice(0, 2)}:${e.target.value}`)}>
              {MINUTES.map((m) => (
                <option key={m} value={m}>{m}분</option>
              ))}
            </select>
          </div>
          <div className="app-row">
            <input className="app-input app-field" placeholder="제목 (예: 저녁 같이 먹어요)" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="app-row">
            <input className="app-input app-field" placeholder="메시지 (선택)" value={message} onChange={(e) => setMessage(e.target.value)} />
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
            <div className="app-muted">{formatRange(r.start, r.end)}</div>
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
            <div className="app-muted">{formatRange(r.start, r.end)}</div>
          </div>
        ))}
      </main>
    </>
  );
}
