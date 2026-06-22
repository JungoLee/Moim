'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Nav from '@/components/Nav';
import AvailabilityCalendar from '@/components/AvailabilityCalendar';
import { api, getToken } from '@/lib/api';
import type { RoomDetail, User } from '@/lib/types';

export default function RoomPage() {
  const router = useRouter();
  const params = useParams();
  const roomId = params.id as string;

  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [availabilities, setAvailabilities] = useState<Record<string, string[]>>({});
  const [meId, setMeId] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const me = await api<{ user: User }>('/api/auth/me');
      setMeId(me.user._id);
      const res = await api<{ room: RoomDetail; availabilities: Record<string, string[]> }>(`/api/rooms/${roomId}`);
      setRoom(res.room);
      setAvailabilities(res.availabilities || {});
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패');
    }
  }, [roomId]);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/');
      return;
    }
    load();
  }, [router, load]);

  const total = room?.members.length || 0;
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const dates of Object.values(availabilities)) for (const d of dates) c[d] = (c[d] || 0) + 1;
    return c;
  }, [availabilities]);
  const myDates = useMemo(() => new Set(availabilities[meId] || []), [availabilities, meId]);
  const allDates = useMemo(
    () => Object.keys(counts).filter((d) => total > 0 && counts[d] === total).sort(),
    [counts, total]
  );

  async function toggle(dateStr: string) {
    if (!meId) return;
    const cur = new Set(availabilities[meId] || []);
    if (cur.has(dateStr)) cur.delete(dateStr);
    else cur.add(dateStr);
    const next = [...cur];
    setAvailabilities((prev) => ({ ...prev, [meId]: next })); // 낙관적 업데이트
    try {
      await api(`/api/rooms/${roomId}/availability`, { method: 'PUT', body: { dates: next } });
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    }
  }

  if (error) {
    return (
      <>
        <Nav />
        <main className="app-container">
          <p className="app-error">{error}</p>
        </main>
      </>
    );
  }
  if (!room) {
    return (
      <>
        <Nav />
        <main className="app-container">
          <p className="app-muted">불러오는 중…</p>
        </main>
      </>
    );
  }

  return (
    <>
      <Nav />
      <main className="app-container">
        <h2>{room.name}</h2>
        <p className="app-muted">
          초대 코드 <strong>{room.code}</strong> · 멤버 {total}명 — {room.members.map((m) => m.name).join(', ')}
        </p>

        <div className="app-card">
          <div className="app-row">
            <h3 style={{ margin: 0 }}>가능한 날 표시</h3>
            <span className="app-spacer" />
            <button className="app-btn app-btn--ghost" onClick={load}>
              새로고침
            </button>
          </div>
          <p className="app-muted">날짜를 눌러 내가 가능한 날을 표시하세요. 숫자는 그 날 가능한 인원입니다.</p>
          <AvailabilityCalendar myDates={myDates} counts={counts} total={total} onToggle={toggle} />
        </div>

        <div className="app-card">
          <h3>🎉 모두 되는 날 ({allDates.length})</h3>
          {allDates.length === 0 ? (
            <p className="app-muted">아직 전원이 가능한 날이 없습니다. 멤버들이 가능한 날을 표시하면 여기에 모입니다.</p>
          ) : (
            <div className="app-row">
              {allDates.map((d) => (
                <span key={d}>📅 {d}</span>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
