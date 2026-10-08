'use client';

import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '@/lib/api';
import { confirmDialog } from '@/lib/confirm';
import { toast } from '@/lib/toast';
import { dateKey, fmtDay, fmtDayShort, fmtTime } from '@/lib/datetime';
import { displayName } from '@/lib/format';
import Avatar from '@/components/Avatar';
import Icon from '@/components/Icon';
import UserProfileModal from '@/components/UserProfileModal';
import type { RoomComment, User } from '@/lib/types';
import styles from './RoomChat.module.scss';

type Props = {
  roomId: string;
  meId: string;
  members: User[];
  comments: RoomComment[];
  /** 대화를 다시 받아온다 */
  onRefresh: () => Promise<void>;
  /** 대화가 화면에 보이는 동안 — 안 읽음을 지운다 */
  onSeen: () => void;
};

const POLL_MS = 6000;

/** 같은 날이면 '14:05', 다른 날이면 '11/21 (토) 14:05' */
function stamp(iso: string, now: Date): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return dateKey(d) === dateKey(now) ? fmtTime(d) : `${fmtDayShort(d)} ${fmtTime(d)}`;
}

/**
 * 방 안에 붙는 대화 패널 — 떠다니는 창이 아니다. 내 말풍선은 오른쪽, 상대는 왼쪽,
 * 같은 사람이 이어서 쓰면 묶는다. 새 대화는 6초마다 받아오되 패널이 화면에 보이고 탭이 켜져 있을 때만.
 */
export default function RoomChat({ roomId, meId, members, comments, onRefresh, onSeen }: Props) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [profile, setProfile] = useState<User | null>(null);
  const [shown, setShown] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;

  // 화면에 실제로 보이는지 — 모바일에서 시트가 닫혀 있거나(display:none) 탭이 다른 곳이면 false
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return undefined;
    }
    const io = new IntersectionObserver(([entry]) => setShown(entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // 보일 때만 폴링, 탭이 가려지면(document.hidden) 멈추고 돌아오면 바로 한 번
  useEffect(() => {
    if (!shown) return undefined;
    const tick = () => {
      if (!document.hidden) void refreshRef.current();
    };
    const t = setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [shown]);

  // 새 대화가 오면 맨 아래로, 보이는 중이면 읽은 것으로
  const lastId = comments.length ? comments[comments.length - 1]._id : '';
  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lastId, shown]);
  useEffect(() => {
    if (shown) onSeen();
  }, [shown, lastId, onSeen]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    setText('');
    try {
      await api(`/api/rooms/${roomId}/comments`, { method: 'POST', body: { text: t } });
      await onRefresh();
    } catch (err) {
      setText(t); // 실패하면 쓴 글을 돌려둔다
      toast(err instanceof Error ? err.message : '보내지 못했어요', 'error');
    } finally {
      setSending(false);
    }
  }

  async function remove(id: string) {
    const ok = await confirmDialog({ message: '이 메시지를 삭제할까요?', confirmText: '삭제', danger: true });
    if (!ok) return;
    try {
      await api(`/api/rooms/${roomId}/comments/${id}`, { method: 'DELETE' });
      await onRefresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : '삭제하지 못했어요', 'error');
    }
  }

  const now = new Date();
  const byId = new Map(members.map((m) => [m._id, m]));

  return (
    <div className={styles.chat} ref={rootRef} data-guide="room-chat">
      <div className={styles.body} ref={bodyRef} role="log" aria-live="polite" aria-label="모임 대화">
        {comments.length === 0 && <p className={styles.empty}>아직 대화가 없어요. 먼저 말을 걸어 보세요.</p>}
        {comments.map((c, i) => {
          const prev = comments[i - 1];
          const mine = c.user === meId;
          const author = byId.get(c.user);
          const name = author ? displayName(author) : c.name || '알 수 없음';
          const newDay = !prev || dateKey(new Date(prev.createdAt)) !== dateKey(new Date(c.createdAt));
          // 직전과 같은 사람, 같은 날이면 이어 쓴 것 — 이름·아바타를 생략
          const cont = !newDay && prev && prev.user === c.user;
          return (
            <div key={c._id} className={styles.row}>
              {newDay && <span className={styles.day}>{fmtDay(new Date(c.createdAt))}</span>}
              <div className={styles.msg} data-mine={mine || undefined} data-cont={cont || undefined}>
                {!mine &&
                  (cont ? (
                    <span className={styles.gap} aria-hidden="true" />
                  ) : (
                    <button
                      type="button"
                      className={styles.avatarBtn}
                      onClick={() => author && setProfile(author)}
                      aria-label={`${name} 프로필`}
                      disabled={!author}
                    >
                      <Avatar src={c.picture || author?.picture} name={name} id={c.user} size="sm" />
                    </button>
                  ))}
                <div className={styles.col}>
                  {!mine && !cont && <span className={styles.name}>{name}</span>}
                  <div className={styles.line}>
                    {mine && (
                      <button type="button" className={styles.del} onClick={() => remove(c._id)} aria-label="내 메시지 삭제" title="삭제">
                        <Icon name="x" size={14} />
                      </button>
                    )}
                    <p className={styles.bubble}>{c.text}</p>
                    <span className={styles.time}>{stamp(c.createdAt, now)}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <form className={styles.form} onSubmit={send}>
        <input
          className="ui-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="메시지 입력"
          aria-label="메시지"
          maxLength={1000}
          autoComplete="off"
        />
        <button type="submit" className="ui-btn ui-btn--primary" disabled={!text.trim() || sending}>
          <Icon name="send" size={16} />
          보내기
        </button>
      </form>
      {profile && <UserProfileModal user={profile} onClose={() => setProfile(null)} />}
    </div>
  );
}
