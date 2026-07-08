'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Nav from '@/components/Nav';
import PageHero from '@/components/PageHero';
import Modal from '@/components/Modal';
import { api, getToken } from '@/lib/api';
import { toast } from '@/lib/toast';
import type { Friend, FriendRequest, Tier } from '@/lib/types';

export default function Friends() {
  const router = useRouter();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  // '그룹에 추가' 팝업의 대상 친구 (null 이면 닫힘)
  const [addFor, setAddFor] = useState<Friend | null>(null);

  const load = useCallback(async () => {
    const f = await api<{ friends: Friend[] }>('/api/friends');
    setFriends(f.friends);
    const r = await api<{ requests: FriendRequest[] }>('/api/friends/requests');
    setRequests(r.requests);
    try {
      const t = await api<{ tiers: Tier[] }>('/api/tiers');
      setTiers(t.tiers);
    } catch {
      /* 그룹 로드 실패는 흐름을 막지 않음 */
    }
  }, []);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/');
      return;
    }
    load();
  }, [router, load]);

  async function accept(id: string) {
    await api(`/api/friends/requests/${id}/accept`, { method: 'POST' });
    load();
  }

  async function decline(id: string) {
    await api(`/api/friends/requests/${id}/decline`, { method: 'POST' });
    load();
  }

  async function addToTier(tierId: string) {
    if (!addFor) return;
    try {
      await api(`/api/tiers/${tierId}/members`, { method: 'POST', body: { email: addFor.user.email } });
      toast('그룹에 추가했습니다', 'success');
      const t = await api<{ tiers: Tier[] }>('/api/tiers');
      setTiers(t.tiers);
    } catch (e) {
      toast(e instanceof Error ? e.message : '그룹 추가 실패', 'error');
    }
  }

  return (
    <>
      <Nav />
      <main className="app-container">
        <PageHero icon="users" title="친구" desc="친구를 추가하고 받은 요청을 수락하세요." />

        {requests.length > 0 && (
          <div className="app-card" data-guide="friends-requests">
            <h3>받은 요청</h3>
            {requests.map((r) => (
              <div className="app-row" key={r._id}>
                <span>
                  {r.requester.name} ({r.requester.email})
                </span>
                <span className="app-spacer" />
                <button className="app-btn" onClick={() => accept(r._id)}>
                  수락
                </button>
                <button className="app-btn app-btn--ghost" onClick={() => decline(r._id)}>
                  거절
                </button>
              </div>
            ))}
          </div>
        )}

        <div data-guide="friends-list">
          <h3>내 친구</h3>
          {friends.length === 0 && <p className="app-muted">아직 친구가 없습니다.</p>}
          {friends.map((f) => (
            <div className="app-card" key={f.friendshipId}>
              <div className="app-row">
                <strong>{f.user.name}</strong>
                <span className="app-muted">{f.user.email}</span>
                <span className="app-spacer" />
                <button className="app-btn app-btn--ghost" onClick={() => setAddFor(f)}>
                  그룹에 추가
                </button>
                <Link className="app-btn app-btn--ghost" href={`/u/${f.user._id}`}>
                  캘린더 보기
                </Link>
              </div>
            </div>
          ))}
        </div>

        {addFor && (
          <Modal onClose={() => setAddFor(null)}>
            <div className="app-contents">
              <h3>그룹에 추가</h3>
              <p className="app-muted">
                <strong>{addFor.user.name}</strong>님을 넣을 그룹을 고르세요. 비공개 일정은 그룹 멤버에게만 상세가
                보여요.
              </p>
              {tiers.length === 0 ? (
                <p className="app-muted">
                  아직 그룹이 없어요 — <Link href="/tiers">공유 그룹</Link>에서 먼저 만들어주세요.
                </p>
              ) : (
                <div className="app-profile-tiers">
                  {tiers.map((t) => {
                    const already = t.members?.some((m) => m._id === addFor.user._id);
                    return (
                      <button
                        key={t._id}
                        type="button"
                        className={already ? 'app-tier-chip is-in' : 'app-tier-chip'}
                        onClick={() => addToTier(t._id)}
                        disabled={already}
                        title={already ? '이미 포함된 그룹' : `${t.name} 그룹에 추가`}
                      >
                        <i className="app-dot" style={{ background: t.color || 'var(--color-primary)' }} />
                        {t.name}
                        {already && ' ✓'}
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="app-actions">
                <button type="button" className="app-btn app-btn--ghost" onClick={() => setAddFor(null)}>
                  닫기
                </button>
              </div>
            </div>
          </Modal>
        )}
      </main>
    </>
  );
}
