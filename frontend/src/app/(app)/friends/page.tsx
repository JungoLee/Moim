'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import PeopleTabs from '@/components/people/PeopleTabs';
import Modal from '@/components/Modal';
import Avatar from '@/components/Avatar';
import Icon from '@/components/Icon';
import Notice from '@/components/Notice';
import TierPicker from '@/components/TierPicker';
import { useShell } from '@/components/shell/ShellContext';
import { api } from '@/lib/api';
import { displayName } from '@/lib/format';
import { toast } from '@/lib/toast';
import { useEscClose } from '@/lib/useEscClose';
import { useOutsideClose } from '@/lib/useOutsideClose';
import type { Friend, FriendRequest, Tier } from '@/lib/types';
import s from './page.module.scss';

export default function Friends() {
  const { refreshInbox } = useShell();
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [pageErr, setPageErr] = useState('');

  // 친구 추가 팝업
  const [addOpen, setAddOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [addErr, setAddErr] = useState('');
  const [busy, setBusy] = useState(false);

  const loadTiers = useCallback(async () => {
    try {
      const t = await api<{ tiers: Tier[] }>('/api/tiers');
      setTiers(t.tiers);
    } catch {
      /* 그룹을 못 불러와도 친구 목록은 쓸 수 있다 */
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const [f, r] = await Promise.all([
        api<{ friends: Friend[] }>('/api/friends'),
        api<{ requests: FriendRequest[] }>('/api/friends/requests'),
      ]);
      setFriends(f.friends);
      setRequests(r.requests);
      setPageErr('');
    } catch (e) {
      setFriends((prev) => prev ?? []);
      setPageErr(e instanceof Error ? e.message : '친구를 불러오지 못했어요.');
    }
    loadTiers();
  }, [loadTiers]);

  useEffect(() => {
    load();
  }, [load]);

  async function respond(id: string, action: 'accept' | 'decline') {
    try {
      await api(`/api/friends/requests/${id}/${action}`, { method: 'POST' });
      toast(action === 'accept' ? '친구가 되었어요' : '요청을 거절했어요', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : '처리하지 못했어요', 'error');
    }
    await load();
    refreshInbox();
  }

  async function sendRequest(e: FormEvent) {
    e.preventDefault();
    const to = email.trim();
    if (!to || busy) return;
    setBusy(true);
    setAddErr('');
    try {
      await api('/api/friends/requests', { method: 'POST', body: { email: to } });
      toast(`${to} 님에게 친구 요청을 보냈어요`, 'success');
      setEmail('');
      setAddOpen(false);
      load();
    } catch (err) {
      setAddErr(err instanceof Error ? err.message : '요청하지 못했어요');
    }
    setBusy(false);
  }

  async function addToTier(f: Friend, tierId: string) {
    try {
      await api(`/api/tiers/${tierId}/members`, { method: 'POST', body: { email: f.user.email } });
      toast('그룹에 넣었어요', 'success');
      loadTiers();
    } catch (e) {
      toast(e instanceof Error ? e.message : '그룹에 넣지 못했어요', 'error');
    }
  }

  function openAdd() {
    setAddErr('');
    setAddOpen(true);
  }

  return (
    <div className="ui-page">
      <PageHeader
        title="사람"
        sub="친구와 그룹을 만들고, 시간을 부탁해요"
        actions={
          <button type="button" className="ui-btn ui-btn--primary" onClick={openAdd} data-guide="friends-add">
            <Icon name="user-plus" size={18} />
            친구 추가
          </button>
        }
      />
      <PeopleTabs friendCount={friends?.length} tierCount={tiers.length} />

      {pageErr && <Notice>{pageErr}</Notice>}

      {requests.length > 0 && (
        <section className="ui-card" data-guide="friends-requests" aria-labelledby="fr-req-title">
          <div className="ui-card__head">
            <h2 id="fr-req-title" className="ui-card__title">
              받은 친구 요청
            </h2>
            <span className="ui-chip ui-chip--warn">{requests.length}명</span>
          </div>
          <ul className="ui-list">
            {requests.map((r) => {
              const name = displayName(r.requester);
              return (
                <li key={r._id} className="ui-row">
                  <Avatar src={r.requester.picture} name={name} id={r.requester._id} />
                  <span className="ui-row__main">
                    <span className="ui-row__title">{name}</span>
                    <span className="ui-row__sub">{r.requester.email}</span>
                  </span>
                  <span className="ui-row__side">
                    <button type="button" className="ui-btn ui-btn--accent ui-btn--sm" onClick={() => respond(r._id, 'accept')}>
                      수락
                    </button>
                    <button type="button" className="ui-btn ui-btn--sm" onClick={() => respond(r._id, 'decline')}>
                      거절
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="ui-card" data-guide="friends-list" aria-labelledby="fr-list-title">
        <div className="ui-card__head">
          <h2 id="fr-list-title" className="ui-card__title">
            내 친구
          </h2>
          {friends && friends.length > 0 && <span className="ui-card__sub">{friends.length}명</span>}
        </div>

        {friends === null ? (
          <div className={s.skeletons} aria-hidden>
            <span className="ui-skeleton" />
            <span className="ui-skeleton" />
            <span className="ui-skeleton" />
          </div>
        ) : friends.length === 0 ? (
          <div className="ui-empty">
            <span className="ui-empty__icon" aria-hidden>
              <Icon name="users" size={24} />
            </span>
            <p className="ui-empty__title">아직 친구가 없어요</p>
            <p className="ui-empty__text">이메일로 친구 요청을 보내면, 수락한 뒤 서로의 캘린더를 볼 수 있어요.</p>
            <button type="button" className="ui-btn ui-btn--primary" onClick={openAdd}>
              <Icon name="user-plus" size={18} />
              친구 추가
            </button>
          </div>
        ) : (
          <ul className="ui-list">
            {friends.map((f) => (
              <FriendItem key={f.friendshipId} friend={f} tiers={tiers} onAdd={(tierId) => addToTier(f, tierId)} />
            ))}
          </ul>
        )}
      </section>

      {addOpen && (
        <Modal
          title="친구 추가"
          size="sm"
          onClose={() => setAddOpen(false)}
          footer={
            <div className="ui-actions">
              <button type="button" className="ui-btn" onClick={() => setAddOpen(false)}>
                취소
              </button>
              <button type="submit" form="friend-add-form" className="ui-btn ui-btn--primary" disabled={busy || !email.trim()}>
                {busy ? '보내는 중…' : '요청 보내기'}
              </button>
            </div>
          }
        >
          <form id="friend-add-form" className="ui-form" onSubmit={sendRequest}>
            <div className="ui-field">
              <label className="ui-label" htmlFor="friend-email">
                친구의 이메일
              </label>
              <input
                id="friend-email"
                className="ui-input"
                type="email"
                inputMode="email"
                autoComplete="off"
                placeholder="friend@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <span className="ui-help">상대가 수락하면 서로의 캘린더를 볼 수 있어요.</span>
            </div>
            {addErr && <Notice>{addErr}</Notice>}
          </form>
        </Modal>
      )}
    </div>
  );
}

function FriendItem({ friend, tiers, onAdd }: { friend: Friend; tiers: Tier[]; onAdd: (tierId: string) => void }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  useOutsideClose(wrapRef, open, () => setOpen(false));
  useEscClose(() => setOpen(false), open);

  const u = friend.user;
  const name = displayName(u);

  return (
    <li className={`ui-row ${s.row}`}>
      <Avatar src={u.picture} name={name} id={u._id} />
      <span className="ui-row__main">
        <span className="ui-row__title">{name}</span>
        <span className="ui-row__sub">{u.email}</span>
      </span>
      <span className={`ui-row__side ${s.side}`}>
        <Link className="ui-btn ui-btn--sm" href={`/u?id=${u._id}`}>
          <Icon name="calendar" size={16} />
          캘린더
        </Link>
        <Link className="ui-btn ui-btn--sm" href={`/requests?to=${u._id}`}>
          <Icon name="send" size={16} />
          시간 요청
        </Link>
        <span className={s.menuWrap} ref={wrapRef}>
          <button
            type="button"
            className="ui-btn ui-btn--sm"
            aria-haspopup="true"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            그룹에 추가
            <Icon name="chevron-down" size={14} stroke={2.4} />
          </button>
          {open && (
            <div className={`ui-popover ${s.pop}`} role="group" aria-label={`${name} 님을 넣을 그룹`}>
              <p className={s.popTitle}>{name} 님을 넣을 그룹</p>
              <TierPicker tiers={tiers} userId={u._id} onAdd={onAdd} />
            </div>
          )}
        </span>
      </span>
    </li>
  );
}
