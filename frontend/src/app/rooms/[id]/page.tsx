'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import type { FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Nav from '@/components/Nav';
import AvailabilityCalendar, { type DaySummary } from '@/components/AvailabilityCalendar';
import CopyButton from '@/components/CopyButton';
import Avatar from '@/components/Avatar';
import { api, getToken } from '@/lib/api';
import { confirmDialog } from '@/lib/confirm';
import { dayLabelKey } from '@/lib/datetime';
import { displayName } from '@/lib/format';
import TimeSelect from '@/components/TimeSelect';
import Modal from '@/components/Modal';
import MemberRow from '@/components/MemberRow';
import UserProfileModal from '@/components/UserProfileModal';
import type { RoomDetail, User, Mark, AvailStatus } from '@/lib/types';

const MODES: Array<[AvailStatus, string]> = [
  ['yes', '되는 날'],
  ['no', '안 되는 날'],
  ['after', '시간 이후'],
];

export default function RoomPage() {
  const router = useRouter();
  const params = useParams();
  const roomId = params.id as string;

  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [availabilities, setAvailabilities] = useState<Record<string, Mark[]>>({});
  const [meId, setMeId] = useState('');
  const [error, setError] = useState('');
  const [mode, setMode] = useState<AvailStatus>('yes');
  const [afterTime, setAfterTime] = useState('18:00');
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [renameVal, setRenameVal] = useState('');

  const load = useCallback(async () => {
    try {
      const me = await api<{ user: User }>('/api/auth/me');
      setMeId(me.user._id);
    } catch {
      return; // 인증 실패는 api() 가 처리(토큰 정리 후 랜딩 이동)
    }
    type RoomRes = { room: RoomDetail; availabilities: Record<string, Mark[]> };
    try {
      const res = await api<RoomRes>(`/api/rooms/${roomId}`);
      setRoom(res.room);
      setAvailabilities(res.availabilities || {});
      return;
    } catch {
      /* 멤버가 아닐 수 있음 → 아래에서 URL 가입 시도 */
    }
    try {
      // 방장이 'URL 가입'을 켜둔 방이면 자동 입장, 아니면 needCode 로 거절
      await api(`/api/rooms/${roomId}/join-url`, { method: 'POST' });
      const res = await api<RoomRes>(`/api/rooms/${roomId}`);
      setRoom(res.room);
      setAvailabilities(res.availabilities || {});
    } catch (e) {
      setError(e instanceof Error ? e.message : '이 방의 멤버가 아닙니다.');
    }
  }, [roomId]);

  useEffect(() => {
    if (!getToken()) {
      // 로그인 후 이 방으로 돌아오도록 경로 기억 (URL 가입 링크 공유 대응)
      try {
        sessionStorage.setItem('postLoginRedirect', `/rooms/${roomId}`);
      } catch {
        /* 무시 */
      }
      router.replace('/');
      return;
    }
    load();
  }, [router, load]);

  const total = room?.members.length || 0;

  const myMarks = useMemo(() => {
    const map: Record<string, Mark> = {};
    for (const m of availabilities[meId] || []) map[m.date] = m;
    return map;
  }, [availabilities, meId]);

  const summary = useMemo(() => {
    const sum: Record<string, DaySummary> = {};
    for (const marks of Object.values(availabilities)) {
      for (const m of marks) {
        const s = sum[m.date] || (sum[m.date] = { yes: 0, after: 0, no: 0, afterMax: '' });
        if (m.status === 'yes') s.yes++;
        else if (m.status === 'no') s.no++;
        else {
          s.after++;
          if (m.time && m.time > s.afterMax) s.afterMax = m.time;
        }
      }
    }
    return sum;
  }, [availabilities]);

  const fullDays = useMemo(
    () => Object.keys(summary).filter((d) => total > 0 && summary[d].yes === total).sort(),
    [summary, total]
  );
  const partialDays = useMemo(
    () =>
      Object.keys(summary)
        .filter((d) => {
          const s = summary[d];
          return total > 0 && s.no === 0 && s.yes + s.after === total && s.after > 0;
        })
        .sort(),
    [summary, total]
  );

  async function onApply(dates: string[], isDrag: boolean) {
    if (!meId) return;
    const map: Record<string, Mark> = {};
    for (const m of availabilities[meId] || []) map[m.date] = m;
    const setOne = (d: string): Mark => (mode === 'after' ? { date: d, status: 'after', time: afterTime } : { date: d, status: mode });
    if (!isDrag && dates.length === 1) {
      const d = dates[0];
      if (map[d] && map[d].status === mode) delete map[d];
      else map[d] = setOne(d);
    } else {
      for (const d of dates) map[d] = setOne(d);
    }
    const arr = Object.values(map);
    setAvailabilities((prev) => ({ ...prev, [meId]: arr })); // 즉시 반영
    try {
      await api(`/api/rooms/${roomId}/availability`, { method: 'PUT', body: { marks: arr } });
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패');
    }
  }

  // 내가 표시한 날짜(되는날/안되는날/시간이후) 전부 해제
  async function resetMine() {
    if (!(availabilities[meId]?.length)) return;
    if (!(await confirmDialog({ message: '내가 표시한 날짜를 모두 해제할까요?', confirmText: '전체 해제', danger: true }))) return;
    setAvailabilities((prev) => ({ ...prev, [meId]: [] }));
    try {
      await api(`/api/rooms/${roomId}/availability`, { method: 'PUT', body: { marks: [] } });
    } catch (e) {
      setError(e instanceof Error ? e.message : '초기화 실패');
    }
  }

  async function deleteRoom() {
    if (!(await confirmDialog({ message: '이 모임을 삭제할까요? 되돌릴 수 없습니다.', confirmText: '삭제', danger: true }))) return;
    try {
      await api(`/api/rooms/${roomId}`, { method: 'DELETE' });
      router.push('/rooms');
    } catch (err) {
      setError(err instanceof Error ? err.message : '모임 삭제 실패');
    }
  }

  function openSettings() {
    setRenameVal(room?.name || '');
    setSettingsOpen(true);
  }

  // 방장 설정 변경 (이름 / URL 가입 허용)
  async function patchRoom(body: { name?: string; joinByUrl?: boolean }) {
    try {
      await api(`/api/rooms/${roomId}`, { method: 'PATCH', body });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '설정 변경 실패');
    }
  }

  async function renameRoom(e: FormEvent) {
    e.preventDefault();
    const name = renameVal.trim();
    if (!name || name === room?.name) return;
    await patchRoom({ name });
  }

  async function regenCode() {
    if (!(await confirmDialog({ message: '초대 코드를 새로 발급할까요? 기존 코드·링크는 더 이상 쓸 수 없게 됩니다.', confirmText: '재발급', danger: true }))) return;
    try {
      await api(`/api/rooms/${roomId}/code`, { method: 'POST' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '코드 재발급 실패');
    }
  }

  async function kickMember(userId: string) {
    if (!(await confirmDialog({ message: '이 멤버를 강퇴할까요?', confirmText: '강퇴', danger: true }))) return;
    try {
      await api(`/api/rooms/${roomId}/members/${userId}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : '강퇴 실패');
    }
  }

  if (error) {
    return (
      <>
        <Nav />
        <main className="app-container">
          <div className="app-empty">
            <div className="app-empty-icon">🔒</div>
            <h2>{error}</h2>
            <p>모임에 참여하려면 방장에게 받은 초대 코드로 입장하세요.</p>
            <a className="app-btn" href="/rooms">모임 목록으로</a>
          </div>
        </main>
      </>
    );
  }
  if (!room) {
    return (
      <>
        <Nav />
        <main className="app-container">
          <div className="app-empty">
            <p>불러오는 중…</p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Nav />
      <main className="app-container">
        <div className="app-card room-head">
          <div className="room-head-top">
            <h2>{room.name}</h2>
            <span className="app-pill">멤버 {total}명</span>
            <span className="app-spacer" />
            <button className="app-btn app-btn--ghost" onClick={openSettings} aria-label="모임 설정">
              ⚙ 설정
            </button>
          </div>
          <div className="room-members">
            {room.members.map((m) =>
              m._id === meId ? (
                <span key={m._id} className="room-member">
                  <Avatar src={m.picture} alt={displayName(m)} />
                  <span>{displayName(m)}</span>
                </span>
              ) : (
                <button
                  key={m._id}
                  type="button"
                  className="room-member room-member--btn"
                  onClick={() => setProfileUser(m)}
                  title={`${displayName(m)} 프로필`}
                >
                  <Avatar src={m.picture} alt={displayName(m)} />
                  <span>{displayName(m)}</span>
                </button>
              )
            )}
          </div>
        </div>

        <div className="app-card">
          <div className="app-row">
            {MODES.map(([v, label]) =>
              v === 'after' ? (
                <div className="app-after" key={v}>
                  <button
                    className={mode === v ? 'app-btn' : 'app-btn app-btn--ghost'}
                    onClick={() => setMode(v)}
                  >
                    {label}
                  </button>
                  {mode === 'after' && (
                    <div className="app-after-pop" role="group" aria-label="기준 시각 선택">
                      <TimeSelect value={afterTime} onChange={setAfterTime} />
                    </div>
                  )}
                </div>
              ) : (
                <button
                  key={v}
                  className={mode === v ? 'app-btn' : 'app-btn app-btn--ghost'}
                  onClick={() => setMode(v)}
                >
                  {label}
                </button>
              )
            )}
            <span className="app-spacer" />
            <button
              className="app-btn app-btn--ghost"
              onClick={resetMine}
              disabled={!availabilities[meId]?.length}
            >
              리셋
            </button>
            <button className="app-btn app-btn--ghost" onClick={load}>
              새로고침
            </button>
          </div>
          <AvailabilityCalendar myMarks={myMarks} summary={summary} total={total} mode={mode} onApply={onApply} />
          <div className="app-legend">
            <span><i style={{ background: '#4ad295' }} />가능</span>
            <span><i style={{ background: '#ff9b9b' }} />안 됨</span>
            <span><i style={{ background: '#f0a85a' }} />시간 이후</span>
            <span><i style={{ background: 'rgba(74, 210, 149, 0.5)' }} />모두 가능</span>
          </div>
        </div>

        <div className="app-card">
          <h3>🎉 모두 되는 날 ({fullDays.length})</h3>
          {fullDays.length === 0 ? (
            <p className="app-muted">아직 전원이 종일 가능한 날이 없습니다.</p>
          ) : (
            <div className="app-row">
              {fullDays.map((d) => (
                <span key={d}>📅 {dayLabelKey(d)}</span>
              ))}
            </div>
          )}
          {partialDays.length > 0 && (
            <>
              <h3 style={{ marginTop: 'var(--space-4)' }}>🕖 시간 조율하면 가능 ({partialDays.length})</h3>
              <div className="app-row">
                {partialDays.map((d) => (
                  <span key={d} className="app-muted">
                    📅 {dayLabelKey(d)} ({summary[d].afterMax}~)
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </main>

      {settingsOpen && room && (
        <Modal onClose={() => setSettingsOpen(false)}>
          <div className="app-contents">
            <h3>모임 설정</h3>

            <div className="room-code">
              <span className="app-muted">초대 코드</span>
              <code className="room-code-val">{room.code}</code>
              <CopyButton text={room.code} label="코드 복사" />
              <CopyButton text={`${window.location.origin}/rooms/${room._id}`} icon title="초대 링크 복사" />
            </div>

            {room.owner === meId ? (
              <>
                <form className="app-form" onSubmit={renameRoom}>
                  <span className="app-form-label">모임 이름</span>
                  <div className="app-row">
                    <input
                      className="app-input app-field"
                      value={renameVal}
                      onChange={(e) => setRenameVal(e.target.value)}
                      placeholder="모임 이름"
                    />
                    <button
                      className="app-btn"
                      type="submit"
                      disabled={!renameVal.trim() || renameVal.trim() === room.name}
                    >
                      저장
                    </button>
                  </div>
                </form>

                <label className="app-switch">
                  <input
                    type="checkbox"
                    checked={!!room.joinByUrl}
                    onChange={(e) => patchRoom({ joinByUrl: e.target.checked })}
                  />
                  <span className="app-switch-track" aria-hidden />
                  <span>
                    URL로 바로 가입 허용 <span className="app-muted">(링크만 있으면 코드 없이 입장)</span>
                  </span>
                </label>

                <div className="app-row">
                  <span className="app-muted">초대 코드 재발급 (기존 링크 무효화)</span>
                  <span className="app-spacer" />
                  <button type="button" className="app-btn app-btn--ghost" onClick={regenCode}>
                    재발급
                  </button>
                </div>

                {room.members.some((m) => m._id !== room.owner) && (
                  <div>
                    <span className="app-form-label">멤버 강퇴</span>
                    <div className="app-member-list">
                      {room.members
                        .filter((m) => m._id !== room.owner)
                        .map((m) => (
                          <MemberRow
                            key={m._id}
                            user={m}
                            action={
                              <button className="app-btn app-btn--ghost" onClick={() => kickMember(m._id)}>
                                강퇴
                              </button>
                            }
                          />
                        ))}
                    </div>
                  </div>
                )}

                <div className="app-actions">
                  <button type="button" className="app-btn app-btn--ghost" onClick={() => setSettingsOpen(false)}>
                    닫기
                  </button>
                  <button type="button" className="app-btn app-btn--danger" onClick={deleteRoom}>
                    모임 삭제
                  </button>
                </div>
              </>
            ) : (
              <div className="app-actions">
                <button type="button" className="app-btn app-btn--ghost" onClick={() => setSettingsOpen(false)}>
                  닫기
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}

      {profileUser && <UserProfileModal user={profileUser} onClose={() => setProfileUser(null)} />}
    </>
  );
}
