'use client';

import { useEffect, useState, useCallback } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Nav from '@/components/Nav';
import { api, getToken } from '@/lib/api';
import type { Friend, FriendRequest } from '@/lib/types';

export default function Friends() {
  const router = useRouter();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const f = await api<{ friends: Friend[] }>('/api/friends');
    setFriends(f.friends);
    const r = await api<{ requests: FriendRequest[] }>('/api/friends/requests');
    setRequests(r.requests);
  }, []);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/');
      return;
    }
    load();
  }, [router, load]);

  async function sendRequest(e: FormEvent) {
    e.preventDefault();
    setMsg('');
    try {
      await api('/api/friends/requests', { method: 'POST', body: { email } });
      setEmail('');
      setMsg('요청을 보냈습니다.');
      load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : '요청 실패');
    }
  }

  async function accept(id: string) {
    await api(`/api/friends/requests/${id}/accept`, { method: 'POST' });
    load();
  }

  async function decline(id: string) {
    await api(`/api/friends/requests/${id}/decline`, { method: 'POST' });
    load();
  }

  return (
    <>
      <Nav />
      <main className="app-container">
        <h2>친구</h2>

        <form className="app-card" onSubmit={sendRequest}>
          <div className="app-row">
            <input
              className="app-input"
              type="email"
              placeholder="친구 이메일"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button className="app-btn" type="submit">
              친구 요청
            </button>
          </div>
          {msg && <p className="app-muted">{msg}</p>}
        </form>

        {requests.length > 0 && (
          <div className="app-card">
            <h3>받은 요청</h3>
            {requests.map((r) => (
              <div className="app-row" key={r._id}>
                <span>
                  {r.requester.name} ({r.requester.email})
                </span>
                <span className="app-spacer" />
                <button className="app-btn" onClick={() => accept(r._id)}>
                  수락
                </button>
                <button className="app-btn app-btn--ghost" onClick={() => decline(r._id)}>
                  거절
                </button>
              </div>
            ))}
          </div>
        )}

        <h3>내 친구</h3>
        {friends.length === 0 && <p className="app-muted">아직 친구가 없습니다.</p>}
        {friends.map((f) => (
          <div className="app-card" key={f.friendshipId}>
            <div className="app-row">
              <strong>{f.user.name}</strong>
              <span className="app-muted">{f.user.email}</span>
              <span className="app-spacer" />
              <Link className="app-btn app-btn--ghost" href="/tiers">
                등급에 추가
              </Link>
              <Link className="app-btn app-btn--ghost" href={`/u/${f.user._id}`}>
                캘린더 보기
              </Link>
            </div>
          </div>
        ))}
      </main>
    </>
  );
}
