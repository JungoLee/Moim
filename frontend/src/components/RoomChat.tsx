'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent, PointerEvent as ReactPointerEvent } from 'react';
import { api } from '@/lib/api';
import { confirmDialog } from '@/lib/confirm';
import Avatar from '@/components/Avatar';
import UserProfileModal from '@/components/UserProfileModal';
import { pad2 } from '@/lib/datetime';
import { displayName } from '@/lib/format';
import type { RoomComment, RoomDetail, User } from '@/lib/types';

/** ISO 문자열 → 'M/D HH:MM' (그룹 첫 메시지 타임스탬프) */
function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getMonth() + 1}/${d.getDate()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** ISO 문자열 → 'HH:MM' (연속 메시지용 시·분만) */
function fmtTimeOnly(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** 모임 방 채팅 — 우하단 플로팅 패널. 내 메시지=오른쪽, 상대=왼쪽. 6초 폴링으로 near-realtime. */
export default function RoomChat({ roomId, onClose }: { roomId: string; onClose: () => void }) {
  const [meId, setMeId] = useState('');
  const [members, setMembers] = useState<Record<string, User>>({});
  const [roomName, setRoomName] = useState('');
  const [comments, setComments] = useState<RoomComment[]>([]);
  const [text, setText] = useState('');
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // 좌상단 핸들 드래그 → 좌상단 방향으로 크기 조절 (우/하단 고정)
  function onResizeStart(e: ReactPointerEvent<HTMLDivElement>) {
    e.preventDefault();
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = rect.width;
    const startH = rect.height;
    const maxW = window.innerWidth - 64; // 4rem 여백
    const maxH = window.innerHeight - 144; // 9rem 여백
    const move = (ev: PointerEvent) => {
      const w = Math.min(maxW, Math.max(240, startW + (startX - ev.clientX)));
      const h = Math.min(maxH, Math.max(256, startH + (startY - ev.clientY)));
      setSize({ w, h });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

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

  async function deleteMessage(id: string) {
    if (!(await confirmDialog({ message: '이 메시지를 삭제할까요?', confirmText: '삭제', danger: true }))) return;
    try {
      await api(`/api/rooms/${roomId}/comments/${id}`, { method: 'DELETE' });
      await refresh();
    } catch {
      /* 실패 무시 */
    }
  }

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
    <div
      className="app-chat"
      role="dialog"
      aria-label="모임 채팅"
      ref={panelRef}
      style={size ? { width: size.w, height: size.h } : undefined}
    >
      <div className="app-chat-resize" onPointerDown={onResizeStart} title="크기 조절" aria-hidden />
      <div className="app-chat-head">
        <strong>💬 {roomName || '채팅'}</strong>
        <span className="app-spacer" />
        <button type="button" className="app-chat-close" onClick={onClose} aria-label="채팅 닫기">
          ✕
        </button>
      </div>
      <div className="app-chat-body" ref={bodyRef}>
        {comments.length === 0 && <p className="app-muted">첫 메시지를 남겨보세요.</p>}
        {comments.map((c, i) => {
          const mine = c.user === meId;
          const author = members[c.user];
          const authorName = author ? displayName(author) : c.name || '익명';
          // 직전 메시지와 같은 사람 → 연속(아바타·이름 생략, 시·분만)
          const cont = i > 0 && comments[i - 1].user === c.user;
          return (
            <div
              key={c._id}
              className={`app-msg${mine ? ' app-msg--mine' : ''}${cont ? ' app-msg--cont' : ''}`}
            >
              {!mine &&
                (cont ? (
                  <span className="app-msg-avatar-gap" aria-hidden />
                ) : (
                  <button
                    type="button"
                    className="app-msg-avatar"
                    onClick={() => author && setProfileUser(author)}
                    aria-label={`${authorName} 프로필`}
                  >
                    <Avatar src={c.picture || author?.picture} alt={authorName} />
                  </button>
                ))}
              <div className="app-msg-col">
                {!mine && !cont && <span className="app-msg-name">{authorName}</span>}
                <div className="app-msg-line">
                  {mine && (
                    <button
                      type="button"
                      className="app-msg-del"
                      onClick={() => deleteMessage(c._id)}
                      aria-label="메시지 삭제"
                      title="삭제"
                    >
                      ✕
                    </button>
                  )}
                  <div className="app-msg-bubble">{c.text}</div>
                  <span className="app-msg-time">{cont ? fmtTimeOnly(c.createdAt) : fmtTime(c.createdAt)}</span>
                </div>
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
