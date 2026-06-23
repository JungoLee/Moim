'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Nav from '@/components/Nav';
import Calendar from '@/components/Calendar';
import DatePicker from '@/components/DatePicker';
import ColorPalette from '@/components/ColorPalette';
import { api, getToken } from '@/lib/api';
import { displayName } from '@/lib/format';
import { toast } from '@/lib/toast';
import { PUBLIC_COLOR, PRIVATE_COLOR, DEFAULT_TIER_COLOR, eventColor } from '@/lib/colors';
import type { MoimEvent, Tier, User, TimeRequest } from '@/lib/types';

const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, m) => String(m * 5).padStart(2, '0')); // 00,05,…,55

function dateStr(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function timeStr(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(Math.floor(d.getMinutes() / 5) * 5)}`;
}

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [events, setEvents] = useState<MoimEvent[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [sentRequests, setSentRequests] = useState<TimeRequest[]>([]);
  const [error, setError] = useState('');
  // 범례에서 팔레트가 열린 그룹 id (없으면 null)
  const [paletteFor, setPaletteFor] = useState<string | null>(null);

  // 일정 생성/수정 공용 모달
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'create' | 'edit'>('create');
  const [editId, setEditId] = useState('');
  const [fTitle, setFTitle] = useState('');
  const [fStartDate, setFStartDate] = useState('');
  const [fStartTime, setFStartTime] = useState('09:00');
  const [fEndDate, setFEndDate] = useState('');
  const [fEndTime, setFEndTime] = useState('10:00');
  const [fAllDay, setFAllDay] = useState(false);
  const [fLocation, setFLocation] = useState('');
  const [fMemo, setFMemo] = useState('');
  const [fShare, setFShare] = useState('public');

  const loadTiers = useCallback(async () => {
    try {
      const tRes = await api<{ tiers: Tier[] }>('/api/tiers');
      setTiers(tRes.tiers);
    } catch {
      /* 그룹 로드 실패는 흐름을 막지 않음 */
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const meRes = await api<{ user: User }>('/api/auth/me');
      setUser(meRes.user);
      const evRes = await api<{ events: MoimEvent[] }>('/api/events');
      setEvents(evRes.events);
      const sentRes = await api<{ requests: TimeRequest[] }>('/api/requests/sent');
      setSentRequests(sentRes.requests.filter((r) => r.status === 'pending'));
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패');
    }
    loadTiers();
  }, [loadTiers]);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/');
      return;
    }
    load();
  }, [router, load]);

  // 그룹 id → 색상 (캘린더 라인 색칠에 사용)
  const tierColors = useMemo(
    () => Object.fromEntries(tiers.map((t) => [t._id, t.color || DEFAULT_TIER_COLOR])),
    [tiers]
  );

  // 날짜 → 색 (DatePicker 에 내 일정을 점으로 표시)
  const markedDates = useMemo(() => {
    const m: Record<string, string> = {};
    for (const ev of events) {
      const color = eventColor(ev, tierColors);
      const e = new Date(ev.end);
      const last = new Date(e.getFullYear(), e.getMonth(), e.getDate());
      let cur = new Date(ev.start);
      cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate());
      while (cur.getTime() <= last.getTime()) {
        m[dateStr(cur)] = color;
        cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1);
      }
    }
    return m;
  }, [events, tierColors]);

  // 달력 클릭/드래그 → 생성 모달. allDay=월 뷰(종일 기본), false=주 뷰 시간 선택
  function openCreate(startDay: Date, endDay: Date, allDay = true) {
    setMode('create');
    setEditId('');
    setFTitle('');
    setFStartDate(dateStr(startDay));
    setFStartTime(allDay ? '09:00' : timeStr(startDay));
    setFEndDate(dateStr(endDay));
    setFEndTime(allDay ? '10:00' : timeStr(endDay));
    setFAllDay(allDay);
    setFLocation('');
    setFMemo('');
    setFShare('public');
    loadTiers();
    setOpen(true);
  }

  function openToday() {
    const t = new Date();
    openCreate(t, t);
  }

  // 일정 클릭 → 수정 모달
  function openEdit(id: string) {
    const ev = events.find((e) => e._id === id);
    if (!ev) return;
    const s = new Date(ev.start);
    const e = new Date(ev.end);
    setMode('edit');
    setEditId(id);
    setFTitle(ev.title || '');
    setFStartDate(dateStr(s));
    setFStartTime(timeStr(s));
    setFEndDate(dateStr(e));
    setFEndTime(timeStr(e));
    setFAllDay(!!ev.allDay);
    setFLocation(ev.location || '');
    setFMemo(ev.memo || '');
    setFShare(
      ev.visibility === 'private'
        ? ev.audienceTiers && ev.audienceTiers.length
          ? `tier:${ev.audienceTiers[0]}`
          : 'private'
        : 'public'
    );
    loadTiers();
    setOpen(true);
  }

  async function saveForm(e: FormEvent) {
    e.preventDefault();
    if (!fStartDate || !fEndDate) return;
    // 종일이면 시간 입력을 무시하고 하루 전체로 저장 (로컬 시간 파싱 일관성 유지)
    const start = fAllDay ? `${fStartDate}T00:00` : `${fStartDate}T${fStartTime}`;
    const end = fAllDay ? `${fEndDate}T23:59` : `${fEndDate}T${fEndTime}`;
    let visibility: 'public' | 'private' = 'public';
    let audienceTiers: string[] = [];
    if (fShare === 'private') visibility = 'private';
    else if (fShare.startsWith('tier:')) {
      visibility = 'private';
      audienceTiers = [fShare.slice(5)];
    }
    const body = {
      title: fTitle.trim() || '새 일정',
      start,
      end,
      allDay: fAllDay,
      location: fLocation.trim(),
      memo: fMemo,
      visibility,
      audienceTiers,
    };
    try {
      if (mode === 'edit' && editId) await api(`/api/events/${editId}`, { method: 'PATCH', body });
      else await api('/api/events', { method: 'POST', body });
      setOpen(false);
      load();
      toast(mode === 'edit' ? '일정을 수정했습니다' : '일정을 추가했습니다', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : '저장 실패', 'error');
    }
  }

  // 범례에서 그룹 색 변경 (그룹만 — 공개/비공개 제외)
  async function updateTierColor(tierId: string, color: string) {
    try {
      await api(`/api/tiers/${tierId}`, { method: 'PATCH', body: { color } });
      await loadTiers();
    } catch (err) {
      toast(err instanceof Error ? err.message : '색상 변경 실패', 'error');
    }
  }

  async function deleteEvent() {
    if (!editId) return;
    try {
      await api(`/api/events/${editId}`, { method: 'DELETE' });
      setOpen(false);
      load();
      toast('일정을 삭제했습니다');
    } catch (err) {
      toast(err instanceof Error ? err.message : '삭제 실패', 'error');
    }
  }

  return (
    <>
      <Nav />
      <main className="app-container">
        <div className="app-row">
          <h2 style={{ margin: 0 }}>{user ? `${displayName(user)} 님의 캘린더` : '내 캘린더'}</h2>
          <span className="app-spacer" />
          <button className="app-btn" onClick={openToday}>
            + 새 일정
          </button>
        </div>
        <p className="app-muted">달력의 날짜를 클릭하거나 드래그하면 일정 추가 창이 열립니다. 일정을 클릭하면 수정·삭제할 수 있어요.</p>
        {error && <p className="app-error">{error}</p>}

        <Calendar events={events} onSelectRange={openCreate} onSelectEvent={openEdit} tierColors={tierColors} requests={sentRequests} />

        <div className="app-legend">
          <span><i style={{ background: PUBLIC_COLOR }} />공개</span>
          <span><i style={{ background: PRIVATE_COLOR }} />비공개</span>
          {tiers.map((t) => {
            const cur = t.color || DEFAULT_TIER_COLOR;
            return (
              <span className="app-legend-group" key={t._id}>
                <button
                  type="button"
                  className="app-legend-trigger"
                  onClick={() => setPaletteFor(paletteFor === t._id ? null : t._id)}
                  aria-label={`${t.name} 색상 변경`}
                >
                  <i style={{ background: cur }} />
                  {t.name}
                </button>
                {paletteFor === t._id && (
                  <>
                    <button type="button" className="app-fab-catcher" aria-label="닫기" onClick={() => setPaletteFor(null)} />
                    <div className="app-palette-pop">
                      <ColorPalette
                        value={cur}
                        onChange={(hex) => {
                          updateTierColor(t._id, hex);
                          setPaletteFor(null);
                        }}
                      />
                    </div>
                  </>
                )}
              </span>
            );
          })}
        </div>

        {open && (
          <div className="app-modal-backdrop" onClick={() => setOpen(false)}>
            <form className="app-modal" onClick={(e) => e.stopPropagation()} onSubmit={saveForm}>
              <h3>{mode === 'edit' ? '일정 수정' : '새 일정'}</h3>
              <input className="app-input" placeholder="일정 제목" value={fTitle} onChange={(e) => setFTitle(e.target.value)} />

              <label className="app-row">
                <input type="checkbox" checked={fAllDay} onChange={(e) => setFAllDay(e.target.checked)} />
                <span>종일</span>
              </label>

              <label className="app-muted">시작</label>
              <div className="app-row">
                <DatePicker value={fStartDate} onChange={setFStartDate} markedDates={markedDates} />
                {!fAllDay && (
                  <>
                    <select className="app-select" value={fStartTime.slice(0, 2)} onChange={(e) => setFStartTime(`${e.target.value}:${fStartTime.slice(3)}`)}>
                      {HOURS.map((h) => (
                        <option key={h} value={h}>{h}시</option>
                      ))}
                    </select>
                    <select className="app-select" value={fStartTime.slice(3)} onChange={(e) => setFStartTime(`${fStartTime.slice(0, 2)}:${e.target.value}`)}>
                      {MINUTES.map((m) => (
                        <option key={m} value={m}>{m}분</option>
                      ))}
                    </select>
                  </>
                )}
              </div>

              <label className="app-muted">종료</label>
              <div className="app-row">
                <DatePicker value={fEndDate} onChange={setFEndDate} markedDates={markedDates} />
                {!fAllDay && (
                  <>
                    <select className="app-select" value={fEndTime.slice(0, 2)} onChange={(e) => setFEndTime(`${e.target.value}:${fEndTime.slice(3)}`)}>
                      {HOURS.map((h) => (
                        <option key={h} value={h}>{h}시</option>
                      ))}
                    </select>
                    <select className="app-select" value={fEndTime.slice(3)} onChange={(e) => setFEndTime(`${fEndTime.slice(0, 2)}:${e.target.value}`)}>
                      {MINUTES.map((m) => (
                        <option key={m} value={m}>{m}분</option>
                      ))}
                    </select>
                  </>
                )}
              </div>

              <input className="app-input" placeholder="위치 (선택)" value={fLocation} onChange={(e) => setFLocation(e.target.value)} />

              <textarea className="app-textarea" placeholder="내용 (메모)" value={fMemo} onChange={(e) => setFMemo(e.target.value)} rows={3} />

              <select className="app-select" value={fShare} onChange={(e) => setFShare(e.target.value)}>
                <option value="public">공유 (누구나)</option>
                <option value="private">비공개 (나만)</option>
                {tiers.length > 0 && (
                  <optgroup label="이 그룹에만 공개">
                    {tiers.map((t) => (
                      <option key={t._id} value={`tier:${t._id}`}>🔒 {t.name}</option>
                    ))}
                  </optgroup>
                )}
              </select>

              <div className="app-row">
                <button className="app-btn" type="submit">
                  {mode === 'edit' ? '저장' : '추가'}
                </button>
                <button type="button" className="app-btn app-btn--ghost" onClick={() => setOpen(false)}>
                  취소
                </button>
                {mode === 'edit' && (
                  <>
                    <span className="app-spacer" />
                    <button type="button" className="app-btn app-btn--ghost" onClick={deleteEvent}>
                      삭제
                    </button>
                  </>
                )}
              </div>
            </form>
          </div>
        )}
      </main>
    </>
  );
}
