'use client';

import { useEffect, useState, useCallback } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Nav from '@/components/Nav';
import CopyButton from '@/components/CopyButton';
import { api, getToken } from '@/lib/api';
import { TIER_PALETTE, DEFAULT_TIER_COLOR } from '@/lib/colors';
import type { Tier } from '@/lib/types';
import Notice from '@/components/Notice';

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
      load();
    } catch (err) {
      setCreateErr(err instanceof Error ? err.message : '그룹 생성 실패');
    }
  }

  async function deleteTier(id: string) {
    if (!window.confirm('이 그룹을 삭제할까요? 되돌릴 수 없습니다.')) return;
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

  return (
    <>
      <Nav />
      <main className="app-container">
        <h2>공개 그룹</h2>
        <p className="app-muted">
          비공개 일정은 선택한 그룹의 멤버에게만 상세가 보입니다. 멤버는 이메일로 추가하거나, 상대가 코드로 가입할 수 있어요.
        </p>
        {pageErr && <Notice>{pageErr}</Notice>}

        <form className="app-card" onSubmit={createTier}>
          <div className="app-row">
            <input
              className="app-input"
              placeholder="새 그룹 이름 (예: 친한친구, 회사)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button className="app-btn" type="submit">
              그룹 만들기
            </button>
          </div>
          <div className="app-row" style={{ marginTop: 'var(--space-2)' }}>
            <span className="app-muted">색상</span>
            <div className="app-swatches">
              {TIER_PALETTE.map((c) => (
                <button
                  type="button"
                  key={c}
                  className={c === color ? 'app-swatch is-on' : 'app-swatch'}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                  aria-label={`색상 ${c}`}
                  aria-pressed={c === color}
                />
              ))}
              <input
                type="color"
                className="app-swatch-custom"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                aria-label="커스텀 색상 선택"
                title="커스텀 색상"
              />
            </div>
          </div>
          {createErr && <Notice>{createErr}</Notice>}
        </form>

        <form className="app-card" onSubmit={joinByCode}>
          <div className="app-row">
            <input
              className="app-input"
              placeholder="코드로 그룹 가입"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
            />
            <button className="app-btn app-btn--ghost" type="submit">
              가입
            </button>
          </div>
          {joinMsg && <Notice ok={joinMsg.ok}>{joinMsg.text}</Notice>}
        </form>

        <h3>내 그룹</h3>
        {tiers.length === 0 && <p className="app-muted">아직 만든 그룹이 없습니다.</p>}
        {tiers.map((t) => (
          <div className="app-card" key={t._id}>
            <div className="app-row">
              <i className="app-dot" style={{ background: t.color || DEFAULT_TIER_COLOR }} />
              <strong>{t.name}</strong>
              <span className="app-muted">코드: {t.code}</span>
              <CopyButton text={t.code} label="복사" />
              <span className="app-spacer" />
              <button className="app-btn app-btn--ghost" onClick={() => deleteTier(t._id)}>
                삭제
              </button>
            </div>

            <div className="app-row" style={{ marginTop: 'var(--space-2)' }}>
              <span className="app-muted">색상</span>
              <div className="app-swatches">
                {TIER_PALETTE.map((c) => {
                  const cur = t.color || DEFAULT_TIER_COLOR;
                  return (
                    <button
                      type="button"
                      key={c}
                      className={c === cur ? 'app-swatch is-on' : 'app-swatch'}
                      style={{ background: c }}
                      onClick={() => updateColor(t._id, c)}
                      aria-label={`색상 ${c}`}
                      aria-pressed={c === cur}
                    />
                  );
                })}
                <input
                  type="color"
                  className="app-swatch-custom"
                  value={t.color || DEFAULT_TIER_COLOR}
                  onChange={(e) => updateColor(t._id, e.target.value)}
                  aria-label="커스텀 색상 선택"
                  title="커스텀 색상"
                />
              </div>
            </div>

            <div className="app-muted" style={{ marginTop: 'var(--space-2)' }}>
              멤버 {t.members.length}명
            </div>
            {t.members.map((m) => (
              <div className="app-row" key={m._id}>
                <span>
                  {m.name} <span className="app-muted">{m.email}</span>
                </span>
                <span className="app-spacer" />
                <button className="app-btn app-btn--ghost" onClick={() => removeMember(t._id, m._id)}>
                  제거
                </button>
              </div>
            ))}

            <div className="app-row" style={{ marginTop: 'var(--space-2)' }}>
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
