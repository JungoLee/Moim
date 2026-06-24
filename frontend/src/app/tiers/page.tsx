'use client';

import { useEffect, useState, useCallback } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Nav from '@/components/Nav';
import CopyButton from '@/components/CopyButton';
import ColorPalette from '@/components/ColorPalette';
import Modal from '@/components/Modal';
import PageHero from '@/components/PageHero';
import Accordion from '@/components/Accordion';
import MemberRow from '@/components/MemberRow';
import { api, getToken } from '@/lib/api';
import { confirmDialog } from '@/lib/confirm';
import { setQuickActions } from '@/lib/quickActions';
import { DEFAULT_TIER_COLOR } from '@/lib/colors';
import type { Tier } from '@/lib/types';
import Notice from '@/components/Notice';
import s from './page.module.scss';

export default function Tiers() {
  const router = useRouter();
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [name, setName] = useState('');
  const [color, setColor] = useState(DEFAULT_TIER_COLOR);
  const [joinCode, setJoinCode] = useState('');
  const [pageErr, setPageErr] = useState('');
  const [createErr, setCreateErr] = useState('');
  const [joinMsg, setJoinMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [memberErr, setMemberErr] = useState<Record<string, string>>({});
  // 그룹별 멤버 추가 입력값
  const [memberEmail, setMemberEmail] = useState<Record<string, string>>({});
  // 추가/가입 모달 (FAB 퀵액션으로 열림)
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  // 그룹 설정 모달 (열려있는 그룹 id)
  const [settingsId, setSettingsId] = useState('');

  // FAB 컨텍스트 퀵액션 등록
  useEffect(
    () =>
      setQuickActions([
        { id: 'tier-create', label: '＋ 공개 그룹 만들기', onSelect: () => { setCreateErr(''); setCreateOpen(true); } },
        { id: 'tier-join', label: '🔑 코드로 가입', onSelect: () => { setJoinMsg(null); setJoinOpen(true); } },
      ]),
    []
  );

  const load = useCallback(async () => {
    try {
      const res = await api<{ tiers: Tier[] }>('/api/tiers');
      setTiers(res.tiers);
    } catch (err) {
      setPageErr(err instanceof Error ? err.message : '그룹을 불러오지 못했습니다.');
    }
  }, []);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/');
      return;
    }
    load();
  }, [router, load]);

  async function createTier(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreateErr('');
    try {
      await api('/api/tiers', { method: 'POST', body: { name, color } });
      setName('');
      setCreateOpen(false);
      load();
    } catch (err) {
      setCreateErr(err instanceof Error ? err.message : '그룹 생성 실패');
    }
  }

  async function deleteTier(id: string) {
    if (!(await confirmDialog({ message: '이 그룹을 삭제할까요? 되돌릴 수 없습니다.', confirmText: '삭제', danger: true }))) return;
    await api(`/api/tiers/${id}`, { method: 'DELETE' });
    load();
  }

  async function updateColor(tierId: string, c: string) {
    setMemberErr((m) => ({ ...m, [tierId]: '' }));
    try {
      await api(`/api/tiers/${tierId}`, { method: 'PATCH', body: { color: c } });
      load();
    } catch (err) {
      setMemberErr((m) => ({ ...m, [tierId]: err instanceof Error ? err.message : '색상 변경 실패' }));
    }
  }

  async function addMember(tierId: string) {
    const email = (memberEmail[tierId] || '').trim();
    if (!email) return;
    setMemberErr((m) => ({ ...m, [tierId]: '' }));
    try {
      await api(`/api/tiers/${tierId}/members`, { method: 'POST', body: { email } });
      setMemberEmail((m) => ({ ...m, [tierId]: '' }));
      load();
    } catch (err) {
      setMemberErr((m) => ({ ...m, [tierId]: err instanceof Error ? err.message : '멤버 추가 실패' }));
    }
  }

  async function removeMember(tierId: string, userId: string) {
    await api(`/api/tiers/${tierId}/members/${userId}`, { method: 'DELETE' });
    load();
  }

  async function joinByCode(e: FormEvent) {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setJoinMsg(null);
    try {
      const res = await api<{ tierName: string }>('/api/tiers/join', {
        method: 'POST',
        body: { code: joinCode },
      });
      setJoinCode('');
      setJoinMsg({ ok: true, text: `'${res.tierName}' 그룹에 가입했습니다.` });
    } catch (err) {
      setJoinMsg({ ok: false, text: err instanceof Error ? err.message : '가입 실패' });
    }
  }

  const settingsTier = tiers.find((t) => t._id === settingsId) || null;

  return (
    <>
      <Nav />
      <main className="app-container">
        <PageHero
          icon="tag"
          title="공유 그룹"
          desc="비공개 일정은 선택한 그룹 멤버에게만 상세가 보여요. 멤버는 이메일로 추가하거나 코드로 가입."
        />
        {pageErr && <Notice>{pageErr}</Notice>}

        {createOpen && (
          <Modal onClose={() => setCreateOpen(false)}>
            <form className="app-contents" onSubmit={createTier}>
              <h3>공개 그룹 만들기</h3>
              <input
                className="app-input"
                placeholder="새 그룹 이름 (예: 친한친구, 회사)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
              <div>
                <span className="app-muted">색상</span>
                <ColorPalette value={color} onChange={setColor} immediate />
              </div>
              {createErr && <Notice>{createErr}</Notice>}
              <div className="app-actions">
                <button type="button" className="app-btn app-btn--ghost" onClick={() => setCreateOpen(false)}>
                  닫기
                </button>
                <button className="app-btn" type="submit">
                  그룹 만들기
                </button>
              </div>
            </form>
          </Modal>
        )}

        {joinOpen && (
          <Modal onClose={() => setJoinOpen(false)}>
            <form className="app-contents" onSubmit={joinByCode}>
              <h3>코드로 그룹 가입</h3>
              <input
                className="app-input"
                placeholder="초대 코드 입력"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                autoFocus
              />
              {joinMsg && <Notice ok={joinMsg.ok}>{joinMsg.text}</Notice>}
              <div className="app-actions">
                <button type="button" className="app-btn app-btn--ghost" onClick={() => setJoinOpen(false)}>
                  닫기
                </button>
                <button className="app-btn" type="submit">
                  가입
                </button>
              </div>
            </form>
          </Modal>
        )}

        {settingsTier && (
          <Modal onClose={() => setSettingsId('')}>
            <div className="app-contents">
              <h3>
                <i className="app-dot" style={{ background: settingsTier.color || DEFAULT_TIER_COLOR }} />{' '}
                {settingsTier.name} 설정
              </h3>

              <div className="app-row">
                <span className="app-muted">초대 코드</span>
                <code className="room-code-val">{settingsTier.code}</code>
                <CopyButton text={settingsTier.code} label="복사" />
              </div>

              <div>
                <span className="app-muted">색상</span>
                <ColorPalette
                  value={settingsTier.color || DEFAULT_TIER_COLOR}
                  onChange={(hex) => updateColor(settingsTier._id, hex)}
                />
              </div>

              {memberErr[settingsTier._id] && <Notice>{memberErr[settingsTier._id]}</Notice>}

              <div className="app-actions">
                <button type="button" className="app-btn app-btn--ghost" onClick={() => setSettingsId('')}>
                  닫기
                </button>
                <button
                  type="button"
                  className="app-btn app-btn--danger"
                  onClick={() => deleteTier(settingsTier._id)}
                >
                  그룹 삭제
                </button>
              </div>
            </div>
          </Modal>
        )}

        <h3>내 그룹</h3>
        {tiers.length === 0 && <p className="app-muted">아직 만든 그룹이 없습니다.</p>}
        {tiers.map((t) => (
          <div className="app-card" key={t._id}>
            <div className="app-row">
              <i className="app-dot" style={{ background: t.color || DEFAULT_TIER_COLOR }} />
              <strong>{t.name}</strong>
              <span className="app-spacer" />
              <button
                className="app-btn app-btn--ghost"
                onClick={() => setSettingsId(t._id)}
                aria-label={`${t.name} 설정`}
              >
                ⚙ 설정
              </button>
            </div>

            <div style={{ marginTop: 'var(--space-2)' }}>
              <Accordion compact title="멤버" aside={`${t.members.length}명`}>
                {t.members.length === 0 ? (
                  <p className={s.empty}>아직 멤버가 없습니다.</p>
                ) : (
                  <div className="app-member-list">
                    {t.members.map((m) => (
                      <MemberRow
                        key={m._id}
                        user={m}
                        action={
                          <button className="app-btn app-btn--ghost" onClick={() => removeMember(t._id, m._id)}>
                            제거
                          </button>
                        }
                      />
                    ))}
                  </div>
                )}
              </Accordion>
            </div>

            <div className={`app-row ${s.add}`}>
              <input
                className="app-input"
                type="email"
                placeholder="멤버 이메일 추가"
                value={memberEmail[t._id] || ''}
                onChange={(e) => setMemberEmail((mm) => ({ ...mm, [t._id]: e.target.value }))}
              />
              <button className="app-btn" onClick={() => addMember(t._id)}>
                추가
              </button>
            </div>
            {memberErr[t._id] && <Notice>{memberErr[t._id]}</Notice>}
          </div>
        ))}
      </main>
    </>
  );
}
