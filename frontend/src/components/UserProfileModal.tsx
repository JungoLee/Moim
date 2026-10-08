'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { displayName } from '@/lib/format';
import Avatar from '@/components/Avatar';
import CopyButton from '@/components/CopyButton';
import Icon from '@/components/Icon';
import Modal from '@/components/Modal';
import TierPicker from '@/components/TierPicker';
import type { Friend, Tier } from '@/lib/types';
import styles from './UserProfileModal.module.scss';

type ProfileUser = { _id: string; name: string; nickname?: string; email: string; picture?: string };

/** 다른 사람 프로필 — 캘린더 보기 / 친구 요청·시간 요청 / 그룹에 추가 / 이메일 복사 */
export default function UserProfileModal({ user, onClose }: { user: ProfileUser; onClose: () => void }) {
  const router = useRouter();
  const [isFriend, setIsFriend] = useState<boolean | null>(null);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [busy, setBusy] = useState(false);
  const name = displayName(user);

  useEffect(() => {
    let alive = true;
    Promise.all([
      api<{ friends: Friend[] }>('/api/friends').catch(() => ({ friends: [] as Friend[] })),
      api<{ tiers: Tier[] }>('/api/tiers').catch(() => ({ tiers: [] as Tier[] })),
    ]).then(([f, t]) => {
      if (!alive) return;
      setIsFriend(f.friends.some((fr) => fr.user._id === user._id));
      setTiers(t.tiers);
    });
    return () => {
      alive = false;
    };
  }, [user._id]);

  function go(path: string) {
    onClose();
    router.push(path);
  }

  async function requestFriend() {
    setBusy(true);
    try {
      await api('/api/friends/requests', { method: 'POST', body: { email: user.email } });
      toast(`${name}님에게 친구 요청을 보냈어요`, 'success');
      setIsFriend(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : '요청하지 못했어요', 'error');
    }
    setBusy(false);
  }

  async function addToTier(tierId: string) {
    try {
      await api(`/api/tiers/${tierId}/members`, { method: 'POST', body: { email: user.email } });
      toast('그룹에 넣었어요', 'success');
      const t = await api<{ tiers: Tier[] }>('/api/tiers');
      setTiers(t.tiers);
    } catch (e) {
      toast(e instanceof Error ? e.message : '그룹에 넣지 못했어요', 'error');
    }
  }

  return (
    <Modal onClose={onClose} size="sm" title="프로필">
      <div className={styles.head}>
        <Avatar src={user.picture} name={name} id={user._id} size="lg" />
        <div className={styles.id}>
          <strong>{name}</strong>
          <span>{user.email}</span>
        </div>
      </div>

      <div className={styles.actions}>
        <button type="button" className="ui-btn" onClick={() => go(`/u?id=${user._id}`)}>
          <Icon name="calendar" size={16} />
          캘린더 보기
        </button>
        {isFriend === false && (
          <button type="button" className="ui-btn ui-btn--primary" onClick={requestFriend} disabled={busy}>
            <Icon name="user-plus" size={16} />
            친구 요청
          </button>
        )}
        {isFriend === true && (
          <button type="button" className="ui-btn" onClick={() => go(`/requests?to=${user._id}`)}>
            <Icon name="clock" size={16} />
            시간 요청
          </button>
        )}
        <CopyButton text={user.email} label="이메일 복사" size="md" />
      </div>

      {isFriend === true && (
        <section className={styles.section}>
          <h3 className="ui-label">그룹에 추가</h3>
          <TierPicker tiers={tiers} userId={user._id} onAdd={addToTier} />
        </section>
      )}
    </Modal>
  );
}
