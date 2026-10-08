'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Calendar from '@/components/Calendar';
import Icon from '@/components/Icon';
import PageHeader from '@/components/PageHeader';
import TierPicker from '@/components/TierPicker';
import { useShell } from '@/components/shell/ShellContext';
import { api, getToken } from '@/lib/api';
import { displayName } from '@/lib/format';
import { toast } from '@/lib/toast';
import { useOutsideClose } from '@/lib/useOutsideClose';
import { useEscClose } from '@/lib/useEscClose';
import type { MoimEvent, Tier, User } from '@/lib/types';
import styles from './u.module.scss';

export default function FriendCalendar() {
  const router = useRouter();
  const { me } = useShell();
  // 정적 export 는 동적 세그먼트를 만들 수 없어 ?id= 로 받는다 (구 /u/<id> 는 워커가 301)
  const [userId, setUserId] = useState('');

  const [owner, setOwner] = useState<User | null>(null);
  const [relation, setRelation] = useState('');
  const [events, setEvents] = useState<MoimEvent[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  const [tierOpen, setTierOpen] = useState(false);
  const tierRef = useRef<HTMLDivElement>(null);
  useOutsideClose(tierRef, tierOpen, () => setTierOpen(false));
  useEscClose(() => setTierOpen(false), tierOpen);

  useEffect(() => {
    setUserId(new URLSearchParams(window.location.search).get('id') || '');
  }, []);

  const load = useCallback(async () => {
    try {
      // 캘린더·그룹을 한꺼번에 (캘린더 owner 에 닉네임이 들어 있다)
      const [res, tr] = await Promise.all([
        api<{ owner: User; relation: string; events: MoimEvent[] }>(`/api/calendar/${userId}`),
        api<{ tiers: Tier[] }>('/api/tiers').catch(() => ({ tiers: [] as Tier[] })),
      ]);
      setOwner(res.owner);
      setRelation(res.relation);
      setEvents(res.events);
      setTiers(tr.tiers);
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오지 못했어요');
    } finally {
      setLoaded(true);
    }
  }, [userId]);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/');
      return;
    }
    if (!userId) return;
    load();
  }, [router, load, userId]);

  async function addToTier(tierId: string) {
    if (!owner) return;
    try {
      await api(`/api/tiers/${tierId}/members`, { method: 'POST', body: { email: owner.email } });
      toast('그룹에 넣었어요', 'success');
      const t = await api<{ tiers: Tier[] }>('/api/tiers');
      setTiers(t.tiers);
    } catch (e) {
      toast(e instanceof Error ? e.message : '그룹에 넣지 못했어요', 'error');
    }
  }

  const isSelf = relation === 'self' || (!!me && owner?._id === me._id);
  // 닉네임 우선 — 응답에 닉네임이 없는 내 캘린더는 내 정보에서
  const name = owner ? displayName(isSelf && me ? me : owner) : '';

  return (
    <div className="ui-page">
      <PageHeader
        eyebrow="사람"
        title={owner ? `${name} 님의 캘린더` : '캘린더'}
        sub="공개 일정은 자세히, 비공개 일정은 내가 속한 그룹일 때만 자세히 보여요"
        actions={
          owner &&
          !isSelf && (
            <>
              <Link href={`/requests?to=${owner._id}`} className="ui-btn ui-btn--primary">
                <Icon name="clock" size={16} />
                시간 요청 보내기
              </Link>
              <div className={styles.tierWrap} ref={tierRef}>
                <button
                  type="button"
                  className="ui-btn"
                  aria-expanded={tierOpen}
                  aria-haspopup="true"
                  onClick={() => setTierOpen((o) => !o)}
                >
                  <Icon name="plus" size={16} stroke={2.4} />
                  그룹에 추가
                </button>
                {tierOpen && (
                  <div className={`ui-popover ${styles.pop}`}>
                    <TierPicker tiers={tiers} userId={owner._id} onAdd={addToTier} />
                  </div>
                )}
              </div>
            </>
          )
        }
      />

      {error ? (
        <div className="ui-empty" role="alert">
          <span className="ui-empty__icon" aria-hidden>
            <Icon name="lock" size={24} />
          </span>
          <p className="ui-empty__title">캘린더를 볼 수 없어요</p>
          <p className="ui-empty__text">{error}</p>
          <Link href="/friends" className="ui-btn">
            친구 목록으로
          </Link>
        </div>
      ) : (
        <>
          <Calendar events={events} />
          {loaded && events.length === 0 && <p className="ui-muted">표시할 일정이 없어요</p>}
        </>
      )}
    </div>
  );
}
