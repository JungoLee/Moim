'use client';

import { useEffect, useState, useCallback } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Nav from '@/components/Nav';
import Notice from '@/components/Notice';
import Modal from '@/components/Modal';
import PageHero from '@/components/PageHero';
import { api, getToken } from '@/lib/api';
import { setQuickActions } from '@/lib/quickActions';
import type { RoomSummary } from '@/lib/types';

export default function Rooms() {
  const router = useRouter();
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [pageErr, setPageErr] = useState('');
  const [createErr, setCreateErr] = useState('');
  const [joinErr, setJoinErr] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

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

  // FAB 컨텍스트 퀵액션 등록
  useEffect(
    () =>
      setQuickActions([
        { id: 'room-create', label: '＋ 모임 만들기', onSelect: () => { setCreateErr(''); setCreateOpen(true); } },
        { id: 'room-join', label: '🔑 초대 코드로 입장', onSelect: () => { setJoinErr(''); setJoinOpen(true); } },
      ]),
    []
  );

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
        <PageHero
          icon="calendar-check"
          title="모임"
          desc="친구를 초대해 각자 가능한 날짜를 표시하면, 다 같이 되는 날을 찾아줘요."
        />
        {pageErr && <Notice>{pageErr}</Notice>}

        {createOpen && (
          <Modal onClose={() => setCreateOpen(false)}>
            <form className="app-contents" onSubmit={createRoom}>
              <h3>모임 만들기</h3>
              <input
                className="app-input"
                placeholder="새 모임 이름 (예: 제주 여행)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
              {createErr && <Notice>{createErr}</Notice>}
              <div className="app-row">
                <button className="app-btn" type="submit">
                  방 만들기
                </button>
                <button type="button" className="app-btn app-btn--ghost" onClick={() => setCreateOpen(false)}>
                  닫기
                </button>
              </div>
            </form>
          </Modal>
        )}

        {joinOpen && (
          <Modal onClose={() => setJoinOpen(false)}>
            <form className="app-contents" onSubmit={joinRoom}>
              <h3>초대 코드로 입장</h3>
              <input
                className="app-input"
                placeholder="초대 코드 입력"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoFocus
              />
              {joinErr && <Notice>{joinErr}</Notice>}
              <div className="app-row">
                <button className="app-btn" type="submit">
                  입장
                </button>
                <button type="button" className="app-btn app-btn--ghost" onClick={() => setJoinOpen(false)}>
                  닫기
                </button>
              </div>
            </form>
          </Modal>
        )}

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
