'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api, clearToken } from '@/lib/api';
import { confirmDialog } from '@/lib/confirm';
import { useEscClose } from '@/lib/useEscClose';
import { toast } from '@/lib/toast';
import { displayName } from '@/lib/format';
import CopyButton from '@/components/CopyButton';
import LegalModal from '@/components/LegalModal';
import ReleaseModal from '@/release/ReleaseModal';
import Avatar from '@/components/Avatar';
import Icon from '@/components/Icon';
import ThemeSwitch from '@/components/shell/ThemeSwitch';
import { useShell } from '@/components/shell/ShellContext';
import styles from './AccountDrawer.module.scss';

export default function AccountDrawer({ onClose }: { onClose: () => void }) {
  const { me, refreshMe } = useShell();
  const [nick, setNick] = useState(me?.nickname || '');
  const [saved, setSaved] = useState(false);
  const [legal, setLegal] = useState<'terms' | 'privacy' | null>(null);
  const [releaseOpen, setReleaseOpen] = useState(false); // 업데이트 내역

  // ESC 로 닫기 — 위에 뜬 약관·업데이트 창이나 확인창이 먼저 받는다(층 스택)
  useEscClose(onClose);

  function logout() {
    clearToken();
    // SPA 이동(router.push) 대신 전체 로드 — 메모리에 남은 계정 상태·모듈 캐시(아바타 등)까지 초기화
    window.location.href = '/';
  }

  async function deleteAccount() {
    if (
      !(await confirmDialog({
        message: '회원 탈퇴할까요?\n내 일정·그룹·모임·친구 관계가 모두 지워지고, 되돌릴 수 없어요.',
        confirmText: '탈퇴',
        danger: true,
      }))
    )
      return;
    try {
      await api('/api/auth/me', { method: 'DELETE' });
      clearToken();
      // 전체 로드로 랜딩 복귀 — 탈퇴한 계정의 화면·캐시가 남아 보이지 않게
      window.location.href = '/';
    } catch {
      toast('탈퇴하지 못했어요. 잠시 뒤 다시 눌러 주세요.', 'error');
    }
  }

  async function saveNick() {
    try {
      await api('/api/auth/me', { method: 'PATCH', body: { nickname: nick } });
      await refreshMe();
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch {
      toast('닉네임을 저장하지 못했어요', 'error');
    }
  }

  return (
    <>
      <div className="ui-drawer-scrim" onClick={onClose} aria-hidden />
      <aside className="ui-drawer" role="dialog" aria-modal="true" aria-label="계정">
        <div className={styles.top}>
          <h2 className={styles.heading}>계정</h2>
          <button type="button" className="ui-btn ui-btn--ghost ui-btn--icon ui-btn--sm" onClick={onClose} aria-label="닫기" autoFocus>
            <Icon name="x" size={18} />
          </button>
        </div>

        {me ? (
          <>
            <div className={styles.profile}>
              <Avatar src={me.picture} name={displayName(me)} id={me._id} size="lg" />
              <div className={styles.who}>
                <strong>
                  {displayName(me)}
                  {me.isAdmin && <span className="ui-chip ui-chip--accent">관리자</span>}
                </strong>
                <span>{me.email}</span>
              </div>
            </div>

            <section className={styles.block}>
              <span className="ui-label">화면</span>
              <ThemeSwitch tone="surface" />
              <span className="ui-help">보드는 어두운 달력, 표는 밝은 사람×날짜 표예요. 이 계정에 기억돼요.</span>
            </section>

            <section className={styles.block}>
              <label className="ui-label" htmlFor="acct-nick">
                닉네임 <span className="ui-muted">(비우면 원래 이름)</span>
              </label>
              <div className="ui-inline">
                <input id="acct-nick" className="ui-input" placeholder={me.name} value={nick} maxLength={30} onChange={(e) => setNick(e.target.value)} />
                <button type="button" className="ui-btn" onClick={saveNick}>
                  {saved ? '저장됨' : '저장'}
                </button>
              </div>
            </section>

            <section className={styles.block}>
              <span className="ui-label">내 고유 번호</span>
              <div className="ui-inline">
                <code className={styles.code}>{me._id}</code>
                <CopyButton text={me._id} label="복사" />
              </div>
            </section>

            <nav className="ui-menu" aria-label="계정 메뉴">
              {me.isAdmin && (
                <Link href="/admin" onClick={onClose}>
                  <Icon name="settings" size={18} />
                  관리자 화면
                </Link>
              )}
              <button type="button" onClick={() => setReleaseOpen(true)}>
                <Icon name="refresh" size={18} />
                업데이트 내역
              </button>
              <button type="button" onClick={() => setLegal('terms')}>
                <Icon name="tag" size={18} />
                이용약관
              </button>
              <button type="button" onClick={() => setLegal('privacy')}>
                <Icon name="lock" size={18} />
                개인정보 처리방침
              </button>
              <button type="button" onClick={logout}>
                <Icon name="logout" size={18} />
                로그아웃
              </button>
            </nav>

            <button type="button" className={`ui-btn ui-btn--ghost ui-btn--sm ${styles.leave}`} onClick={deleteAccount}>
              회원 탈퇴
            </button>
          </>
        ) : (
          <span className="ui-skeleton" />
        )}

        {legal && <LegalModal type={legal} onClose={() => setLegal(null)} />}
        {releaseOpen && <ReleaseModal onClose={() => setReleaseOpen(false)} />}
      </aside>
    </>
  );
}
