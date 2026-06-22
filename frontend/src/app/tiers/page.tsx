'use client';

import { useEffect, useState, useCallback } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Nav from '@/components/Nav';
import { api, getToken } from '@/lib/api';
import type { Tier } from '@/lib/types';

export default function Tiers() {
  const router = useRouter();
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [msg, setMsg] = useState('');
  // 등급별 멤버 추가 입력값
  const [memberEmail, setMemberEmail] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await api<{ tiers: Tier[] }>('/api/tiers');
    setTiers(res.tiers);
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
    setMsg('');
    try {
      await api('/api/tiers', { method: 'POST', body: { name } });
      setName('');
      load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : '등급 생성 실패');
    }
  }

  async function deleteTier(id: string) {
    await api(`/api/tiers/${id}`, { method: 'DELETE' });
    load();
  }

  async function addMember(tierId: string) {
    const email = (memberEmail[tierId] || '').trim();
    if (!email) return;
    setMsg('');
    try {
      await api(`/api/tiers/${tierId}/members`, { method: 'POST', body: { email } });
      setMemberEmail((m) => ({ ...m, [tierId]: '' }));
      load();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : '멤버 추가 실패');
    }
  }

  async function removeMember(tierId: string, userId: string) {
    await api(`/api/tiers/${tierId}/members/${userId}`, { method: 'DELETE' });
    load();
  }

  async function joinByCode(e: FormEvent) {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setMsg('');
    try {
      const res = await api<{ tierName: string }>('/api/tiers/join', {
        method: 'POST',
        body: { code: joinCode },
      });
      setJoinCode('');
      setMsg(`'${res.tierName}' 등급에 가입했습니다.`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : '가입 실패');
    }
  }

  return (
    <>
      <Nav />
      <main className="app-container">
        <h2>공개 등급</h2>
        <p className="app-muted">
          비공개 일정은 선택한 등급의 멤버에게만 상세가 보입니다. 멤버는 이메일로 추가하거나, 상대가 코드로 가입할 수 있어요.
        </p>
        {msg && <p className="app-muted">{msg}</p>}

        <form className="app-card" onSubmit={createTier}>
          <div className="app-row">
            <input
              className="app-input"
              placeholder="새 등급 이름 (예: 친한친구, 회사)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button className="app-btn" type="submit">
              등급 만들기
            </button>
          </div>
        </form>

        <form className="app-card" onSubmit={joinByCode}>
          <div className="app-row">
            <input
              className="app-input"
              placeholder="코드로 등급 가입"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
            />
            <button className="app-btn app-btn--ghost" type="submit">
              가입
            </button>
          </div>
        </form>

        <h3>내 등급</h3>
        {tiers.length === 0 && <p className="app-muted">아직 만든 등급이 없습니다.</p>}
        {tiers.map((t) => (
          <div className="app-card" key={t._id}>
            <div className="app-row">
              <strong>{t.name}</strong>
              <span className="app-muted">코드: {t.code}</span>
              <span className="app-spacer" />
              <button className="app-btn app-btn--ghost" onClick={() => deleteTier(t._id)}>
                삭제
              </button>
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
          </div>
        ))}
      </main>
    </>
  );
}
