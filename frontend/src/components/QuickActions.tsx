'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '@/lib/api';
import Notice from '@/components/Notice';

/** 모든 페이지 우하단 플로팅 + 버튼. 누르면 퀵 액션 메뉴가 열리고, '친구 추가'로 친구 요청 팝업을 띄운다. */
export default function QuickActions() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

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
      <div className="app-fab-wrap">
        {menuOpen && (
          <>
            <button type="button" className="app-fab-catcher" aria-label="닫기" onClick={() => setMenuOpen(false)} />
            <div className="app-fab-menu">
              <button type="button" className="app-fab-item" onClick={openAddFriend}>
                👤 친구 추가
              </button>
            </div>
          </>
        )}
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
        <div className="app-modal-backdrop" onClick={() => setAddOpen(false)}>
          <form className="app-modal" onClick={(e) => e.stopPropagation()} onSubmit={sendRequest}>
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
        </div>
      )}
    </>
  );
}
