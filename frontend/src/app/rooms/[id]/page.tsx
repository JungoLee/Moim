'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import type { FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Nav from '@/components/Nav';
import AvailabilityCalendar, { type DaySummary } from '@/components/AvailabilityCalendar';
import CopyButton from '@/components/CopyButton';
import Avatar from '@/components/Avatar';
import { api, getToken } from '@/lib/api';
import type { RoomDetail, User, Mark, AvailStatus, RoomComment } from '@/lib/types';

const MODES: Array<[AvailStatus, string]> = [
  ['yes', '되는 날'],
  ['no', '안 되는 날'],
  ['after', '시간 이후'],
];

export default function RoomPage() {
  const router = useRouter();
  const params = useParams();
  const roomId = params.id as string;

  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [availabilities, setAvailabilities] = useState<Record<string, Mark[]>>({});
  const [meId, setMeId] = useState('');
  const [mePicture, setMePicture] = useState('');
  const [error, setError] = useState('');
  const [mode, setMode] = useState<AvailStatus>('yes');
  const [afterTime, setAfterTime] = useState('18:00');
  const [comments, setComments] = useState<RoomComment[]>([]);
  const [commentText, setCommentText] = useState('');

  const load = useCallback(async () => {
    try {
      const me = await api<{ user: User }>('/api/auth/me');
      setMeId(me.user._id);
      setMePicture(me.user.picture || '');
      const res = await api<{ room: RoomDetail; availabilities: Record<string, Mark[]>; comments: RoomComment[] }>(
        `/api/rooms/${roomId}`
      );
      setRoom(res.room);
      setAvailabilities(res.availabilities || {});
      setComments(res.comments || []);
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

  const myMarks = useMemo(() => {
    const map: Record<string, Mark> = {};
    for (const m of availabilities[meId] || []) map[m.date] = m;
    return map;
  }, [availabilities, meId]);

  const summary = useMemo(() => {
    const sum: Record<string, DaySummary> = {};
    for (const marks of Object.values(availabilities)) {
      for (const m of marks) {
        const s = sum[m.date] || (sum[m.date] = { yes: 0, after: 0, no: 0, afterMax: '' });
        if (m.status === 'yes') s.yes++;
        else if (m.status === 'no') s.no++;
        else {
          s.after++;
          if (m.time && m.time > s.afterMax) s.afterMax = m.time;
        }
      }
    }
    return sum;
  }, [availabilities]);

  const fullDays = useMemo(
    () => Object.keys(summary).filter((d) => total > 0 && summary[d].yes === total).sort(),
    [summary, total]
  );
  const partialDays = useMemo(
    () =>
      Object.keys(summary)
        .filter((d) => {
          const s = summary[d];
          return total > 0 && s.no === 0 && s.yes + s.after === total && s.after > 0;
        })
        .sort(),
    [summary, total]
  );

  // 댓글 작성자 → 프로필 이미지 매핑 (댓글엔 picture 가 없어 멤버 목록에서 조회)
  const memberById = useMemo(() => {
    const map: Record<string, User> = {};
    for (const m of room?.members || []) map[m._id] = m;
    return map;
  }, [room]);

  async function onApply(dates: string[], isDrag: boolean) {
    if (!meId) return;
    const map: Record<string, Mark> = {};
    for (const m of availabilities[meId] || []) map[m.date] = m;
    const setOne = (d: string): Mark => (mode === 'after' ? { date: d, status: 'after', time: afterTime } : { date: d, status: mode });
    if (!isDrag && dates.length === 1) {
      const d = dates[0];
      if (map[d] && map[d].status === mode) delete map[d];
      else map[d] = setOne(d);
    } else {
      for (const d of dates) map[d] = setOne(d);
    }
    const arr = Object.values(map);
    setAvailabilities((prev) => ({ ...prev, [meId]: arr })); // 즉시 반영
    try {
      await api(`/api/rooms/${roomId}/availability`, { method: 'PUT', body: { marks: arr } });
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    }
  }

  async function addComment(e: FormEvent) {
    e.preventDefault();
    if (!commentText.trim()) return;
    try {
      await api(`/api/rooms/${roomId}/comments`, { method: 'POST', body: { text: commentText } });
      setCommentText('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '댓글 작성 실패');
    }
  }

  async function deleteComment(id: string) {
    try {
      await api(`/api/rooms/${roomId}/comments/${id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '삭제 실패');
    }
  }

  if (error) {
    return (
      <>
        <Nav />
        <main className="app-container">
          <div className="app-empty">
            <div className="app-empty-icon">🔒</div>
            <h2>{error}</h2>
            <p>모임에 참여하려면 방장에게 받은 초대 코드로 입장하세요.</p>
            <a className="app-btn" href="/rooms">모임 목록으로</a>
          </div>
        </main>
      </>
    );
  }
  if (!room) {
    return (
      <>
        <Nav />
        <main className="app-container">
          <div className="app-empty">
            <p>불러오는 중…</p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Nav />
      <main className="app-container">
        <div className="app-card room-head">
          <div className="room-head-top">
            <h2>{room.name}</h2>
            <span className="app-pill">멤버 {total}명</span>
          </div>
          <div className="room-code">
            <span className="app-muted">초대 코드</span>
            <code className="room-code-val">{room.code}</code>
            <CopyButton text={room.code} label="코드 복사" />
          </div>
          <div className="room-members">
            {room.members.map((m) => (
              <span key={m._id} className="room-member">
                <Avatar src={m.picture} alt={m.name} />
                <span>{m.name}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="room-grid">
          <div className="room-main">
        <div className="app-card">
          <div className="app-row">
            {MODES.map(([v, label]) => (
              <button key={v} className={mode === v ? 'app-btn' : 'app-btn app-btn--ghost'} onClick={() => setMode(v)}>
                {label}
              </button>
            ))}
            <span className="app-spacer" />
            <button className="app-btn app-btn--ghost" onClick={load}>
              새로고침
            </button>
          </div>
          {mode === 'after' && (
            <div className="app-row">
              <label htmlFor="after-time" className="app-muted">
                몇 시 이후부터 가능한가요?
              </label>
              <input
                id="after-time"
                className="app-input"
                type="time"
                value={afterTime}
                onChange={(e) => setAfterTime(e.target.value)}
              />
            </div>
          )}
          <p className="app-muted">
            {mode === 'yes' && '가능한 날을 클릭하세요. (다시 누르면 해제)'}
            {mode === 'no' && '안 되는 날을 클릭하거나 드래그해서 한 번에 표시하세요.'}
            {mode === 'after' && `클릭한 날은 "${afterTime} 이후 가능"으로 표시됩니다 (예: 퇴근 후).`}
          </p>
          <AvailabilityCalendar myMarks={myMarks} summary={summary} total={total} mode={mode} onApply={onApply} />
        </div>

        <div className="app-card">
          <h3>🎉 모두 되는 날 ({fullDays.length})</h3>
          {fullDays.length === 0 ? (
            <p className="app-muted">아직 전원이 종일 가능한 날이 없습니다.</p>
          ) : (
            <div className="app-row">
              {fullDays.map((d) => (
                <span key={d}>📅 {d}</span>
              ))}
            </div>
          )}
          {partialDays.length > 0 && (
            <>
              <h3 style={{ marginTop: 'var(--space-4)' }}>🕖 시간 조율하면 가능 ({partialDays.length})</h3>
              <div className="app-row">
                {partialDays.map((d) => (
                  <span key={d} className="app-muted">
                    📅 {d} ({summary[d].afterMax}~)
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
          </div>

          <aside className="room-aside">
            <div className="app-card">
              <h3>댓글 ({comments.length})</h3>
              <form className="app-row" style={{ flexWrap: 'nowrap' }} onSubmit={addComment}>
                <Avatar src={mePicture} />
                <input
                  className="app-input"
                  placeholder="댓글 입력"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  style={{ flex: 1, minWidth: 0 }}
                />
                <button className="app-btn" style={{ flexShrink: 0 }} type="submit">
                  등록
                </button>
              </form>
              {comments.length === 0 && <p className="app-muted">아직 댓글이 없습니다.</p>}
              {comments.map((c) => (
                <div key={c._id} className="room-comment">
                  <div className="app-row">
                    <Avatar src={memberById[c.user]?.picture} alt={c.name} />
                    <strong>{c.name || '익명'}</strong>
                    <span className="app-spacer" />
                    {c.user === meId && (
                      <button className="app-btn app-btn--ghost" onClick={() => deleteComment(c._id)}>
                        삭제
                      </button>
                    )}
                  </div>
                  <div>{c.text}</div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
