'use client';

import { useEffect, useState, useCallback } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Nav from '@/components/Nav';
import Notice from '@/components/Notice';
import { api, getToken } from '@/lib/api';
import type { RoomSummary } from '@/lib/types';

export default function Rooms() {
  const router = useRouter();
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [pageErr, setPageErr] = useState('');
  const [createErr, setCreateErr] = useState('');
  const [joinErr, setJoinErr] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await api<{ rooms: RoomSummary[] }>('/api/rooms');
      setRooms(res.rooms);
    } catch (e) {
      setPageErr(e instanceof Error ? e.message : '불러오기 실패');
    }
  }, []);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/');
      return;
    }
    load();
  }, [router, load]);

  async function createRoom(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreateErr('');
    try {
      const res = await api<{ room: { _id: string } }>('/api/rooms', { method: 'POST', body: { name } });
      router.push(`/rooms/${res.room._id}`);
    } catch (err) {
      setCreateErr(err instanceof Error ? err.message : '생성 실패');
    }
  }

  async function joinRoom(e: FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setJoinErr('');
    try {
      const res = await api<{ roomId: string }>('/api/rooms/join', { method: 'POST', body: { code } });
      router.push(`/rooms/${res.roomId}`);
    } catch (err) {
      setJoinErr(err instanceof Error ? err.message : '입장 실패');
    }
  }

  return (
    <>
      <Nav />
      <main className="app-container">
        <h2>모임 (약속 잡기)</h2>
        <p className="app-muted">
          방을 만들어 코드로 친구를 초대하고, 각자 가능한 날짜를 표시하면 모두 되는 날을 찾아줍니다.
        </p>
        {pageErr && <Notice>{pageErr}</Notice>}

        <form className="app-card" onSubmit={createRoom}>
          <div className="app-row">
            <input className="app-input" placeholder="새 모임 이름 (예: 제주 여행)" value={name} onChange={(e) => setName(e.target.value)} />
            <button className="app-btn" type="submit">
              방 만들기
            </button>
          </div>
          {createErr && <Notice>{createErr}</Notice>}
        </form>

        <form className="app-card" onSubmit={joinRoom}>
          <div className="app-row">
            <input className="app-input" placeholder="초대 코드로 입장" value={code} onChange={(e) => setCode(e.target.value)} />
            <button className="app-btn app-btn--ghost" type="submit">
              입장
            </button>
          </div>
          {joinErr && <Notice>{joinErr}</Notice>}
        </form>

        <h3>내 모임</h3>
        {rooms.length === 0 && <p className="app-muted">아직 모임이 없습니다.</p>}
        {rooms.map((r) => (
          <Link key={r._id} href={`/rooms/${r._id}`} className="app-card" style={{ display: 'block' }}>
            <div className="app-row">
              <strong>{r.name}</strong>
              {r.isOwner && <span className="app-pill">방장</span>}
              <span className="app-spacer" />
              <span className="app-muted">
                멤버 {r.memberCount}명 · 코드 {r.code}
              </span>
            </div>
          </Link>
        ))}
      </main>
    </>
  );
}
