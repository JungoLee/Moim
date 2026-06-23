'use client';

import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { usePathname } from 'next/navigation';
import { api } from '@/lib/api';
import { subscribeQuickActions, type QuickAction } from '@/lib/quickActions';
import Notice from '@/components/Notice';
import Modal from '@/components/Modal';
import RoomChat from '@/components/RoomChat';

/** 모든 페이지 우하단 플로팅 + 버튼. 페이지별 '추가' 액션(레지스트리) + '친구 추가'(전역) + 모임 방 '채팅'. */
export default function QuickActions() {
  const pathname = usePathname();
  const roomId = (pathname?.match(/^\/rooms\/([a-zA-Z0-9]+)$/) || [])[1] || '';

  const [menuOpen, setMenuOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
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
        </div>
        <button
          type="button"
          className="app-fab"
          aria-label="빠른 작업"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          +
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
            <div className="app-row">
              <button className="app-btn" type="submit">
                친구 요청
              </button>
              <button type="button" className="app-btn app-btn--ghost" onClick={() => setAddOpen(false)}>
                닫기
              </button>
            </div>
          </form>
        </Modal>
      )}

      {roomId && chatOpen && <RoomChat roomId={roomId} onClose={() => setChatOpen(false)} />}
    </>
  );
}
