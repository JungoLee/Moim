'use client';

import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { usePathname } from 'next/navigation';
import { api, getToken } from '@/lib/api';
import { copyToClipboard } from '@/lib/clipboard';
import { subscribeQuickActions, type QuickAction } from '@/lib/quickActions';
import { guideForPath, startGuide } from '@/lib/guide';
import Notice from '@/components/Notice';
import Modal from '@/components/Modal';
import RoomChat from '@/components/RoomChat';
import type { RoomComment } from '@/lib/types';

/** 모든 페이지 우하단 플로팅 + 버튼. 페이지별 '추가' 액션(레지스트리) + '친구 추가'(전역) + 모임 방 '채팅'. */
export default function QuickActions() {
  const pathname = usePathname();
  const roomId = (pathname?.match(/^\/rooms\/([a-zA-Z0-9]+)$/) || [])[1] || '';
  // 현재 페이지에 사용 가이드(스포트라이트 투어)가 정의돼 있으면 FAB 메뉴에 노출
  const guideSteps = guideForPath(pathname || '');

  const [menuOpen, setMenuOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  // 모임 공유 모달 (URL / 코드)
  const [shareOpen, setShareOpen] = useState(false);
  const [shareCode, setShareCode] = useState('');
  const [shareMsg, setShareMsg] = useState('');
  // 안읽은 채팅 수 (카톡/라인식 카운트 배지)
  const [meId, setMeId] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const lastReadRef = useRef(Date.now());
  const [email, setEmail] = useState('');
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  // 현재 페이지가 등록한 컨텍스트 액션 (공개 그룹 만들기, 시간 요청 등)
  const [pageActions, setPageActions] = useState<QuickAction[]>([]);
  useEffect(() => subscribeQuickActions(setPageActions), []);

  const wrapRef = useRef<HTMLDivElement>(null);

  // 모임 방 진입 시 채팅 자동 열기, 나가면 닫기
  useEffect(() => {
    setChatOpen(!!roomId);
  }, [roomId]);

  // 로그인 상태면 내 id 확보 (내가 보낸 메시지는 '안읽음'에서 제외)
  useEffect(() => {
    if (!getToken()) return;
    let alive = true;
    api<{ user: { _id: string } }>('/api/auth/me')
      .then((r) => { if (alive) setMeId(r.user._id); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // 채팅이 열리면 모두 읽음(0), 닫는 순간을 '마지막 읽음' 기준 시각으로 기록
  useEffect(() => {
    if (chatOpen) setUnreadCount(0);
    else lastReadRef.current = Date.now();
  }, [chatOpen]);

  // 채팅이 닫혀 있는 동안 6초마다 폴링해 안읽은(내 것 아닌, 마지막 읽음 이후) 메시지 수 집계
  useEffect(() => {
    if (!roomId || chatOpen) return;
    let alive = true;
    const check = async () => {
      try {
        const res = await api<{ comments: RoomComment[] }>(`/api/rooms/${roomId}`);
        if (!alive) return;
        const n = (res.comments || []).filter(
          (c) => c.user !== meId && new Date(c.createdAt).getTime() > lastReadRef.current
        ).length;
        setUnreadCount(n);
      } catch {
        /* 폴링 실패는 조용히 무시 */
      }
    };
    check();
    const t = setInterval(check, 6000);
    return () => { alive = false; clearInterval(t); };
  }, [roomId, chatOpen, meId]);

  // 페이지 진입 시 FAB 메뉴를 스태거 모션으로 잠깐 펼쳐 보여주고 2.5초 뒤 자동 닫기
  useEffect(() => {
    setMenuOpen(true);
    const t = setTimeout(() => setMenuOpen(false), 2500);
    return () => clearTimeout(t);
  }, [pathname]);

  // 메뉴 바깥 클릭 시 닫기 (화면을 가리지 않고 클릭은 그대로 통과)
  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  function openAddFriend() {
    setMenuOpen(false);
    setEmail('');
    setFeedback(null);
    setAddOpen(true);
  }

  async function openShare() {
    setMenuOpen(false);
    setShareMsg('');
    setShareCode('');
    setShareOpen(true);
    try {
      const res = await api<{ room: { code: string } }>(`/api/rooms/${roomId}`);
      setShareCode(res.room.code);
    } catch {
      /* 코드 조회 실패는 무시 (URL 공유는 가능) */
    }
  }

  async function copyText(text: string, msg: string) {
    if (!text) return;
    await copyToClipboard(text);
    setShareMsg(msg);
  }

  async function sendRequest(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setFeedback(null);
    try {
      await api('/api/friends/requests', { method: 'POST', body: { email: email.trim() } });
      setEmail('');
      setFeedback({ ok: true, text: '친구 요청을 보냈습니다.' });
    } catch (err) {
      setFeedback({ ok: false, text: err instanceof Error ? err.message : '요청 실패' });
    }
  }

  return (
    <>
      <div className="app-fab-wrap" ref={wrapRef}>
        <div className={menuOpen ? 'app-fab-menu is-open' : 'app-fab-menu'}>
          {roomId && (
            <button
              type="button"
              className="app-fab-item"
              onClick={() => {
                setMenuOpen(false);
                setChatOpen(true);
              }}
            >
              💬 채팅
              {unreadCount > 0 && (
                <span className="app-fab-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
              )}
            </button>
          )}
          {roomId && (
            <button type="button" className="app-fab-item" onClick={openShare}>
              📤 공유
            </button>
          )}
          {pageActions.map((a) => (
            <button
              key={a.id}
              type="button"
              className="app-fab-item"
              onClick={() => {
                setMenuOpen(false);
                a.onSelect();
              }}
            >
              {a.label}
            </button>
          ))}
          <button type="button" className="app-fab-item" onClick={openAddFriend}>
            👤 친구 추가
          </button>
          {guideSteps && (
            <button
              type="button"
              className="app-fab-item"
              onClick={() => {
                setMenuOpen(false);
                startGuide(guideSteps);
              }}
            >
              📖 사용 가이드
            </button>
          )}
        </div>
        <button
          type="button"
          className="app-fab"
          aria-label="빠른 작업"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          +
          {unreadCount > 0 && (
            <span className="app-fab-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
          )}
        </button>
      </div>

      {addOpen && (
        <Modal onClose={() => setAddOpen(false)}>
          <form className="app-contents" onSubmit={sendRequest}>
            <h3>친구 추가</h3>
            <p className="app-muted">친구의 이메일로 요청을 보내세요. 상대가 수락하면 친구가 됩니다.</p>
            <input
              className="app-input"
              type="email"
              placeholder="친구 이메일"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
            {feedback && <Notice ok={feedback.ok}>{feedback.text}</Notice>}
            <div className="app-actions">
              <button type="button" className="app-btn app-btn--ghost" onClick={() => setAddOpen(false)}>
                닫기
              </button>
              <button className="app-btn" type="submit">
                친구 요청
              </button>
            </div>
          </form>
        </Modal>
      )}

      {shareOpen && (
        <Modal onClose={() => setShareOpen(false)}>
          <div className="app-contents">
            <h3>모임 공유</h3>
            <p className="app-muted">친구에게 링크를 보내거나 초대 코드를 알려주세요.</p>
            <div className="app-share">
              <button
                type="button"
                className="app-share-opt"
                onClick={() => copyText(`${window.location.origin}/rooms/${roomId}`, '초대 링크를 복사했습니다.')}
              >
                <span className="app-share-icon">🔗</span>
                <span>URL 복사</span>
              </button>
              <button
                type="button"
                className="app-share-opt"
                onClick={() => copyText(shareCode, '초대 코드를 복사했습니다.')}
                disabled={!shareCode}
              >
                <span className="app-share-icon">#️⃣</span>
                <span>{shareCode ? `코드 복사 (${shareCode})` : '코드 복사'}</span>
              </button>
            </div>
            {shareMsg && <Notice ok>{shareMsg}</Notice>}
            <div className="app-actions">
              <button type="button" className="app-btn app-btn--ghost" onClick={() => setShareOpen(false)}>
                닫기
              </button>
            </div>
          </div>
        </Modal>
      )}

      {roomId && chatOpen && <RoomChat roomId={roomId} onClose={() => setChatOpen(false)} />}
    </>
  );
}
