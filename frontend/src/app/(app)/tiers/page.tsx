'use client';

import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import PageHeader from '@/components/PageHeader';
import PeopleTabs from '@/components/people/PeopleTabs';
import CopyButton from '@/components/CopyButton';
import ColorPalette from '@/components/ColorPalette';
import Modal from '@/components/Modal';
import Avatar from '@/components/Avatar';
import Icon from '@/components/Icon';
import MemberRow from '@/components/MemberRow';
import Notice from '@/components/Notice';
import { api } from '@/lib/api';
import { confirmDialog } from '@/lib/confirm';
import { DEFAULT_TIER_COLOR } from '@/lib/colors';
import { displayName } from '@/lib/format';
import { toast } from '@/lib/toast';
import type { Tier } from '@/lib/types';
import s from './page.module.scss';

const STACK_MAX = 5; // 카드에 겹쳐 보이는 아바타 수

export default function Tiers() {
  const [tiers, setTiers] = useState<Tier[] | null>(null);
  const [pageErr, setPageErr] = useState('');

  // 만들기 · 코드 가입 · 설정 팝업
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(DEFAULT_TIER_COLOR);
  const [createErr, setCreateErr] = useState('');
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinErr, setJoinErr] = useState('');
  const [settingsId, setSettingsId] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [settingsErr, setSettingsErr] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await api<{ tiers: Tier[] }>('/api/tiers');
      setTiers(res.tiers);
      setPageErr('');
    } catch (err) {
      setTiers((prev) => prev ?? []);
      setPageErr(err instanceof Error ? err.message : '그룹을 불러오지 못했어요.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setCreateErr('');
    setCreateOpen(true);
  }

  function openJoin() {
    setJoinErr('');
    setJoinOpen(true);
  }

  function openSettings(id: string) {
    setSettingsErr('');
    setMemberEmail('');
    setSettingsId(id);
  }

  async function createTier(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreateErr('');
    try {
      await api('/api/tiers', { method: 'POST', body: { name, color } });
      setName('');
      setCreateOpen(false);
      toast('그룹을 만들었어요', 'success');
      load();
    } catch (err) {
      setCreateErr(err instanceof Error ? err.message : '그룹을 만들지 못했어요');
    }
  }

  async function joinByCode(e: FormEvent) {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setJoinErr('');
    try {
      const res = await api<{ tierName: string }>('/api/tiers/join', { method: 'POST', body: { code: joinCode } });
      setJoinCode('');
      setJoinOpen(false);
      toast(`'${res.tierName}' 그룹에 가입했어요`, 'success');
      load();
    } catch (err) {
      setJoinErr(err instanceof Error ? err.message : '가입하지 못했어요');
    }
  }

  async function deleteTier(id: string) {
    if (!(await confirmDialog({ message: '이 그룹을 삭제할까요? 되돌릴 수 없어요.', confirmText: '삭제', danger: true }))) return;
    try {
      await api(`/api/tiers/${id}`, { method: 'DELETE' });
      setSettingsId('');
      toast('그룹을 삭제했어요', 'success');
      load();
    } catch (err) {
      setSettingsErr(err instanceof Error ? err.message : '삭제하지 못했어요');
    }
  }

  async function updateColor(tierId: string, c: string) {
    setSettingsErr('');
    try {
      await api(`/api/tiers/${tierId}`, { method: 'PATCH', body: { color: c } });
      load();
    } catch (err) {
      setSettingsErr(err instanceof Error ? err.message : '색을 바꾸지 못했어요');
    }
  }

  async function addMember(e: FormEvent, tierId: string) {
    e.preventDefault();
    const email = memberEmail.trim();
    if (!email) return;
    setSettingsErr('');
    try {
      await api(`/api/tiers/${tierId}/members`, { method: 'POST', body: { email } });
      setMemberEmail('');
      load();
    } catch (err) {
      setSettingsErr(err instanceof Error ? err.message : '멤버를 추가하지 못했어요');
    }
  }

  async function removeMember(tierId: string, userId: string) {
    setSettingsErr('');
    try {
      await api(`/api/tiers/${tierId}/members/${userId}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setSettingsErr(err instanceof Error ? err.message : '멤버를 빼지 못했어요');
    }
  }

  const settingsTier = tiers?.find((t) => t._id === settingsId) || null;

  return (
    <div className="ui-page">
      <PageHeader
        title="사람"
        sub="비공개 일정을 이 그룹에게만 자세히 보여줄 수 있어요"
        actions={
          <>
            <button type="button" className="ui-btn" onClick={openJoin}>
              <Icon name="enter" size={18} />
              코드로 가입
            </button>
            <button type="button" className="ui-btn ui-btn--primary" onClick={openCreate} data-guide="tiers-new">
              <Icon name="plus" size={18} />
              그룹 만들기
            </button>
          </>
        }
      />
      <PeopleTabs tierCount={tiers?.length} />

      {pageErr && <Notice>{pageErr}</Notice>}

      {tiers === null ? (
        <div className={s.grid} aria-hidden>
          <span className={`ui-skeleton ${s.skeleton}`} />
          <span className={`ui-skeleton ${s.skeleton}`} />
        </div>
      ) : tiers.length === 0 ? (
        <section className="ui-card" data-guide="tiers-list">
          <div className="ui-empty">
            <span className="ui-empty__icon" aria-hidden>
              <Icon name="tag" size={24} />
            </span>
            <p className="ui-empty__title">아직 만든 그룹이 없어요</p>
            <p className="ui-empty__text">그룹을 만들고 친구를 넣으면, 비공개 일정을 그 그룹에게만 자세히 보여줄 수 있어요.</p>
            <button type="button" className="ui-btn ui-btn--primary" onClick={openCreate}>
              <Icon name="plus" size={18} />
              그룹 만들기
            </button>
          </div>
        </section>
      ) : (
        <ul className={s.grid} data-guide="tiers-list">
          {tiers.map((t) => (
            <li key={t._id}>
              <article className={`ui-card ${s.card}`}>
                <div className={s.cardHead}>
                  {/* 그룹 색은 데이터 값이라 인라인 */}
                  <span className={s.dot} style={{ background: t.color || DEFAULT_TIER_COLOR }} aria-hidden />
                  <h2 className={s.name}>{t.name}</h2>
                  <span className="ui-chip">{t.members.length}명</span>
                </div>

                <div className={s.stack} aria-label={`멤버 ${t.members.length}명`}>
                  {t.members.length === 0 ? (
                    <span className="ui-help">아직 멤버가 없어요</span>
                  ) : (
                    <>
                      {t.members.slice(0, STACK_MAX).map((m) => (
                        <Avatar key={m._id} src={m.picture} name={displayName(m)} id={m._id} size="sm" className={s.stackAvatar} />
                      ))}
                      {t.members.length > STACK_MAX && <span className={s.more}>+{t.members.length - STACK_MAX}</span>}
                    </>
                  )}
                </div>

                <div className={s.cardFoot}>
                  <span className={s.code}>
                    <span className="ui-help">초대 코드</span>
                    <code className="ui-num">{t.code}</code>
                  </span>
                  <span className="ui-spacer" />
                  <CopyButton text={t.code} label="코드 복사" />
                  <button type="button" className="ui-btn ui-btn--sm" onClick={() => openSettings(t._id)} aria-label={`${t.name} 설정`}>
                    <Icon name="settings" size={16} />
                    설정
                  </button>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}

      {createOpen && (
        <Modal
          title="그룹 만들기"
          size="sm"
          onClose={() => setCreateOpen(false)}
          footer={
            <div className="ui-actions">
              <button type="button" className="ui-btn" onClick={() => setCreateOpen(false)}>
                취소
              </button>
              <button type="submit" form="tier-create-form" className="ui-btn ui-btn--primary" disabled={!name.trim()}>
                만들기
              </button>
            </div>
          }
        >
          <form id="tier-create-form" className="ui-form" onSubmit={createTier}>
            <div className="ui-field">
              <label className="ui-label" htmlFor="tier-name">
                그룹 이름
              </label>
              <input
                id="tier-name"
                className="ui-input"
                placeholder="예: 친한 친구, 회사"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="ui-field">
              <span className="ui-label">색</span>
              <ColorPalette value={color} onChange={setColor} immediate />
            </div>
            {createErr && <Notice>{createErr}</Notice>}
          </form>
        </Modal>
      )}

      {joinOpen && (
        <Modal
          title="코드로 가입"
          size="sm"
          onClose={() => setJoinOpen(false)}
          footer={
            <div className="ui-actions">
              <button type="button" className="ui-btn" onClick={() => setJoinOpen(false)}>
                취소
              </button>
              <button type="submit" form="tier-join-form" className="ui-btn ui-btn--primary" disabled={!joinCode.trim()}>
                가입
              </button>
            </div>
          }
        >
          <form id="tier-join-form" className="ui-form" onSubmit={joinByCode}>
            <div className="ui-field">
              <label className="ui-label" htmlFor="tier-code">
                초대 코드
              </label>
              <input
                id="tier-code"
                className="ui-input"
                placeholder="친구에게 받은 코드"
                autoComplete="off"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
              />
            </div>
            {joinErr && <Notice>{joinErr}</Notice>}
          </form>
        </Modal>
      )}

      {settingsTier && (
        <Modal
          title={
            <span className={s.modalTitle}>
              <span className={s.dot} style={{ background: settingsTier.color || DEFAULT_TIER_COLOR }} aria-hidden />
              {settingsTier.name} 설정
            </span>
          }
          onClose={() => setSettingsId('')}
          footer={
            <div className="ui-actions">
              <button type="button" className="ui-btn ui-btn--danger" onClick={() => deleteTier(settingsTier._id)}>
                <Icon name="trash" size={16} />
                그룹 삭제
              </button>
              <span className="ui-spacer" />
              <button type="button" className="ui-btn" onClick={() => setSettingsId('')}>
                닫기
              </button>
            </div>
          }
        >
          <div className="ui-field">
            <span className="ui-label">초대 코드</span>
            <div className={s.codeLine}>
              <code className={`ui-num ${s.codeVal}`}>{settingsTier.code}</code>
              <CopyButton text={settingsTier.code} label="복사" />
            </div>
          </div>

          <div className="ui-field">
            <span className="ui-label">색</span>
            <ColorPalette value={settingsTier.color || DEFAULT_TIER_COLOR} onChange={(hex) => updateColor(settingsTier._id, hex)} />
          </div>

          <div className="ui-field">
            <span className="ui-label">멤버 {settingsTier.members.length}명</span>
            {settingsTier.members.length === 0 ? (
              <p className="ui-help">아직 멤버가 없어요. 아래에서 이메일로 추가해요.</p>
            ) : (
              <div className="ui-list">
                {settingsTier.members.map((m) => (
                  <MemberRow
                    key={m._id}
                    user={m}
                    action={
                      <button type="button" className="ui-btn ui-btn--sm" onClick={() => removeMember(settingsTier._id, m._id)}>
                        빼기
                      </button>
                    }
                  />
                ))}
              </div>
            )}
            <form className="ui-inline" onSubmit={(e) => addMember(e, settingsTier._id)}>
              <input
                className="ui-input"
                type="email"
                inputMode="email"
                autoComplete="off"
                aria-label="추가할 멤버 이메일"
                placeholder="멤버 이메일 추가"
                value={memberEmail}
                onChange={(e) => setMemberEmail(e.target.value)}
              />
              <button type="submit" className="ui-btn ui-btn--primary" disabled={!memberEmail.trim()}>
                추가
              </button>
            </form>
          </div>

          {settingsErr && <Notice>{settingsErr}</Notice>}
        </Modal>
      )}
    </div>
  );
}
