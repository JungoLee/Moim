'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import Avatar from '@/components/Avatar';
import CopyButton from '@/components/CopyButton';
import type { Friend, Tier } from '@/lib/types';

export type ProfileUser = { _id: string; name: string; email: string; picture?: string };

/** 타인 프로필 액션 모달 — 캘린더 보기 / 친구 요청·시간 요청 / 그룹에 추가 / 이메일 복사 */
export default function UserProfileModal({ user, onClose }: { user: ProfileUser; onClose: () => void }) {
  const router = useRouter();
  const [isFriend, setIsFriend] = useState<boolean | null>(null);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const f = await api<{ friends: Friend[] }>('/api/friends');
        setIsFriend(f.friends.some((fr) => fr.user._id === user._id));
      } catch {
        setIsFriend(false);
      }
      try {
        const t = await api<{ tiers: Tier[] }>('/api/tiers');
        setTiers(t.tiers);
      } catch {
        /* 그룹 로드 실패 무시 */
      }
    })();
  }, [user._id]);

  function goCalendar() {
    onClose();
    router.push(`/u/${user._id}`);
  }

  function goTimeRequest() {
    onClose();
    router.push(`/requests?to=${user._id}`);
  }

  async function requestFriend() {
    setBusy(true);
    try {
      await api('/api/friends/requests', { method: 'POST', body: { email: user.email } });
      toast(`${user.name}님에게 친구 요청을 보냈습니다`, 'success');
      setIsFriend(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : '요청 실패', 'error');
    }
    setBusy(false);
  }

  async function addToTier(tierId: string) {
    try {
      await api(`/api/tiers/${tierId}/members`, { method: 'POST', body: { email: user.email } });
      toast('그룹에 추가했습니다', 'success');
      const t = await api<{ tiers: Tier[] }>('/api/tiers');
      setTiers(t.tiers);
    } catch (e) {
      toast(e instanceof Error ? e.message : '그룹 추가 실패', 'error');
    }
  }

  return (
    <div className="app-modal-backdrop" onClick={onClose}>
      <div className="app-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '23rem' }}>
        <div className="app-drawer-profile">
          <Avatar src={user.picture} alt={user.name} />
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: 0 }}>{user.name}</h3>
            <span className="app-muted">{user.email}</span>
          </div>
        </div>

        <div className="app-row" style={{ flexWrap: 'wrap' }}>
          <button className="app-btn" onClick={goCalendar}>
            캘린더 보기
          </button>
          {isFriend === false && (
            <button className="app-btn" onClick={requestFriend} disabled={busy}>
              친구 요청
            </button>
          )}
          {isFriend === true && (
            <button className="app-btn" onClick={goTimeRequest}>
              시간 요청
            </button>
          )}
          <CopyButton text={user.email} label="이메일 복사" />
        </div>

        {tiers.length > 0 && (
          <>
            <label className="app-muted">그룹에 추가</label>
            <div className="app-row" style={{ flexWrap: 'wrap' }}>
              {tiers.map((t) => {
                const already = t.members?.some((m) => m._id === user._id);
                return (
                  <button
                    key={t._id}
                    type="button"
                    className="app-btn app-btn--ghost"
                    onClick={() => addToTier(t._id)}
                    disabled={already}
                    title={already ? '이미 포함된 그룹' : `${t.name} 그룹에 추가`}
                  >
                    <i className="app-dot" style={{ background: t.color || 'var(--color-primary)' }} />
                    {t.name}
                    {already ? ' ✓' : ''}
                  </button>
                );
              })}
            </div>
          </>
        )}

        <div className="app-row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="app-btn app-btn--ghost" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
