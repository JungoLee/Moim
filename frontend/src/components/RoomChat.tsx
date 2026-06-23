'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '@/lib/api';
import Avatar from '@/components/Avatar';
import UserProfileModal from '@/components/UserProfileModal';
import type { RoomComment, RoomDetail, User } from '@/lib/types';

/** 모임 방 채팅 — 우하단 플로팅 패널. 내 메시지=오른쪽, 상대=왼쪽. 6초 폴링으로 near-realtime. */
export default function RoomChat({ roomId, onClose }: { roomId: string; onClose: () => void }) {
  const [meId, setMeId] = useState('');
  const [members, setMembers] = useState<Record<string, User>>({});
  const [roomName, setRoomName] = useState('');
  const [comments, setComments] = useState<RoomComment[]>([]);
  const [text, setText] = useState('');
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await api<{ comments: RoomComment[] }>(`/api/rooms/${roomId}`);
      setComments(res.comments || []);
    } catch {
      /* 폴링 실패는 조용히 무시 */
    }
  }, [roomId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const me = await api<{ user: User }>('/api/auth/me');
        const res = await api<{ room: RoomDetail; comments: RoomComment[] }>(`/api/rooms/${roomId}`);
        if (!alive) return;
        setMeId(me.user._id);
        setRoomName(res.room.name);
        setMembers(Object.fromEntries(res.room.members.map((m) => [m._id, m])));
        setComments(res.comments || []);
      } catch {
        /* 무시 */
      }
    })();
    return () => {
      alive = false;
    };
  }, [roomId]);

  // near-realtime: 6초마다 새 메시지 폴링
  useEffect(() => {
    const t = setInterval(refresh, 6000);
    return () => clearInterval(t);
  }, [refresh]);

  // 새 메시지 시 맨 아래로 스크롤
  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [comments]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setText('');
    try {
      await api(`/api/rooms/${roomId}/comments`, { method: 'POST', body: { text: t } });
      await refresh();
    } catch {
      setText(t); // 실패 시 입력 복구
    }
  }

  return (
    <>
    <div className="app-chat" role="dialog" aria-label="모임 채팅">
      <div className="app-chat-head">
        <strong>💬 {roomName || '채팅'}</strong>
        <span className="app-spacer" />
        <button type="button" className="app-chat-close" onClick={onClose} aria-label="채팅 닫기">
          ✕
        </button>
      </div>
      <div className="app-chat-body" ref={bodyRef}>
        {comments.length === 0 && <p className="app-muted">첫 메시지를 남겨보세요.</p>}
        {comments.map((c) => {
          const mine = c.user === meId;
          const author = members[c.user];
          return (
            <div key={c._id} className={mine ? 'app-msg app-msg--mine' : 'app-msg'}>
              {!mine && (
                <button
                  type="button"
                  className="app-msg-avatar"
                  onClick={() => author && setProfileUser(author)}
                  aria-label={`${c.name} 프로필`}
                >
                  <Avatar src={c.picture || author?.picture} alt={c.name} />
                </button>
              )}
              <div className="app-msg-col">
                {!mine && <span className="app-msg-name">{c.name || '익명'}</span>}
                <div className="app-msg-bubble">{c.text}</div>
              </div>
            </div>
          );
        })}
      </div>
      <form className="app-chat-input" onSubmit={send}>
        <input
          className="app-input"
          placeholder="메시지 입력"
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
        />
        <button className="app-btn" type="submit">
          전송
        </button>
      </form>
    </div>
    {profileUser && <UserProfileModal user={profileUser} onClose={() => setProfileUser(null)} />}
    </>
  );
}
