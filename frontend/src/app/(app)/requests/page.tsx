'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import PageHeader from '@/components/PageHeader';
import PeopleTabs from '@/components/people/PeopleTabs';
import DatePicker from '@/components/DatePicker';
import Select from '@/components/Select';
import TimeSelect from '@/components/TimeSelect';
import Modal from '@/components/Modal';
import Avatar from '@/components/Avatar';
import Icon from '@/components/Icon';
import { useShell } from '@/components/shell/ShellContext';
import { api } from '@/lib/api';
import { REQUEST_COLOR } from '@/lib/colors';
import { allDayIsoRange, fmtEventTime, todayKey } from '@/lib/datetime';
import { displayName } from '@/lib/format';
import { buildMarkedDates } from '@/lib/marks';
import { toast } from '@/lib/toast';
import type { Friend, MoimEvent, TimeRequest } from '@/lib/types';
import s from './page.module.scss';

// 요청 상태 말·칩 색 — docs/design-system.md 5장
const STATUS: Record<TimeRequest['status'], { label: string; chip: string }> = {
  pending: { label: '답 기다리는 중', chip: 'ui-chip ui-chip--req' },
  accepted: { label: '수락함', chip: 'ui-chip ui-chip--accent' },
  declined: { label: '거절함', chip: 'ui-chip ui-chip--muted' },
};

type View = 'received' | 'sent';

export default function Requests() {
  const { refreshInbox } = useShell();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [received, setReceived] = useState<TimeRequest[] | null>(null);
  const [sent, setSent] = useState<TimeRequest[] | null>(null);
  const [events, setEvents] = useState<MoimEvent[]>([]);
  const [view, setView] = useState<View>('received');

  const [createOpen, setCreateOpen] = useState(false);
  const [toId, setToId] = useState('');
  const [date, setDate] = useState(todayKey());
  const [allDay, setAllDay] = useState(false);
  const [startTime, setStartTime] = useState('19:00');
  const [endTime, setEndTime] = useState('20:00');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [f, ev, r, sn] = await Promise.all([
        api<{ friends: Friend[] }>('/api/friends'),
        api<{ events: MoimEvent[] }>('/api/events'),
        api<{ requests: TimeRequest[] }>('/api/requests/received'),
        api<{ requests: TimeRequest[] }>('/api/requests/sent'),
      ]);
      setFriends(f.friends);
      setEvents(ev.events);
      setReceived(r.requests);
      setSent(sn.requests);
    } catch {
      /* 401 이면 api() 가 로그아웃 처리 */
      setReceived((p) => p ?? []);
      setSent((p) => p ?? []);
    }
  }, []);

  useEffect(() => {
    load();
    // 프로필 팝업·친구 목록에서 ?to=<userId> 로 들어오면 받는 사람을 미리 고르고 보내기 팝업을 연다
    const to = new URLSearchParams(window.location.search).get('to');
    if (to) {
      setToId(to);
      setCreateOpen(true);
    }
  }, [load]);

  // 날짜 → 색 (DatePicker: 내 일정 + 내가 보낸 대기 요청을 다른 색 점으로)
  const markedDates = useMemo(
    () =>
      buildMarkedDates({
        events,
        requests: (sent || []).filter((r) => r.status === 'pending'),
        requestColor: REQUEST_COLOR,
      }),
    [events, sent]
  );

  async function send(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!toId) {
      toast('보낼 친구를 골라 주세요', 'error');
      return;
    }
    if (!allDay && endTime <= startTime) {
      toast('끝나는 시각은 시작보다 늦어야 해요', 'error');
      return;
    }
    setBusy(true);
    try {
      // 시간대 없는 '2026-10-08T19:00' 을 그대로 보내면 서버가 UTC 로 읽어 9시간 밀린다 → 브라우저 시각 기준 ISO 로 보낸다
      const range = allDay
        ? allDayIsoRange(date, date)
        : {
            start: new Date(`${date}T${startTime}`).toISOString(),
            end: new Date(`${date}T${endTime}`).toISOString(),
          };
      await api('/api/requests', { method: 'POST', body: { to: toId, ...range, allDay, title, message } });
      setTitle('');
      setMessage('');
      setCreateOpen(false);
      setView('sent');
      toast('시간 요청을 보냈어요', 'success');
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : '보내지 못했어요', 'error');
    }
    setBusy(false);
  }

  async function act(id: string, action: 'accept' | 'decline') {
    try {
      await api(`/api/requests/${id}/${action}`, { method: 'POST' });
      toast(action === 'accept' ? '수락했어요. 두 사람 캘린더에 일정이 들어갔어요' : '거절했어요', 'success');
    } catch (err) {
      // 이미 다른 곳에서 처리됐으면(409) 서버 말을 그대로 알린다
      toast(err instanceof Error ? err.message : '처리하지 못했어요', 'error');
    }
    await load();
    refreshInbox();
  }

  async function cancel(id: string) {
    try {
      await api(`/api/requests/${id}`, { method: 'DELETE' });
      toast('요청을 취소했어요', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : '취소하지 못했어요', 'error');
    }
    await load();
    refreshInbox();
  }

  const pendingReceived = (received || []).filter((r) => r.status === 'pending').length;
  const list = view === 'received' ? received : sent;

  return (
    <div className="ui-page">
      <PageHeader
        title="사람"
        sub="친구에게 “이때 시간 내 줄래요?”를 보내요. 수락하면 두 사람 캘린더에 일정이 생겨요"
        actions={
          <button type="button" className="ui-btn ui-btn--primary" onClick={() => setCreateOpen(true)} data-guide="req-new">
            <Icon name="send" size={18} />
            시간 요청 보내기
          </button>
        }
      />
      <PeopleTabs />

      <section className="ui-card" data-guide="req-list" aria-label="시간 요청 목록">
        <div className="ui-card__head">
          <div className="ui-seg" role="group" aria-label="요청 보기">
            <button type="button" aria-pressed={view === 'received'} onClick={() => setView('received')}>
              받은 요청
              {pendingReceived > 0 && (
                <>
                  {' '}
                  <span className="ui-badge" aria-label={`답할 요청 ${pendingReceived}개`}>
                    {pendingReceived}
                  </span>
                </>
              )}
            </button>
            <button type="button" aria-pressed={view === 'sent'} onClick={() => setView('sent')}>
              보낸 요청
            </button>
          </div>
        </div>

        {list === null ? (
          <div className={s.skeletons} aria-hidden>
            <span className="ui-skeleton" />
            <span className="ui-skeleton" />
            <span className="ui-skeleton" />
          </div>
        ) : list.length === 0 ? (
          <div className="ui-empty">
            <span className="ui-empty__icon" aria-hidden>
              <Icon name="clock" size={24} />
            </span>
            <p className="ui-empty__title">{view === 'received' ? '받은 요청이 없어요' : '보낸 요청이 없어요'}</p>
            <p className="ui-empty__text">
              {view === 'received' ? '친구가 시간을 부탁하면 여기에 나타나요.' : '친구에게 시간을 부탁해 보세요.'}
            </p>
            {view === 'sent' && (
              <button type="button" className="ui-btn ui-btn--primary" onClick={() => setCreateOpen(true)}>
                <Icon name="send" size={18} />
                시간 요청 보내기
              </button>
            )}
          </div>
        ) : (
          <ul className="ui-list">
            {list.map((r) => {
              const other = view === 'received' ? r.from : r.to;
              const name = other ? displayName(other) : '알 수 없음';
              const st = STATUS[r.status];
              return (
                <li key={r._id} className={`ui-row ${s.row}`}>
                  <Avatar src={other?.picture} name={name} id={other?._id} />
                  <span className="ui-row__main">
                    <span className="ui-row__title">{r.title || '시간 요청'}</span>
                    <span className="ui-row__sub">
                      {name} · {fmtEventTime(r.start, r.end, r.allDay)}
                    </span>
                    {r.message && <span className={s.msg}>{r.message}</span>}
                  </span>
                  <span className={`ui-row__side ${s.side}`}>
                    {view === 'received' && r.status === 'pending' ? (
                      <>
                        <button type="button" className="ui-btn ui-btn--accent ui-btn--sm" onClick={() => act(r._id, 'accept')}>
                          수락
                        </button>
                        <button type="button" className="ui-btn ui-btn--sm" onClick={() => act(r._id, 'decline')}>
                          거절
                        </button>
                      </>
                    ) : (
                      <>
                        <span className={st.chip}>{st.label}</span>
                        {view === 'sent' && r.status === 'pending' && (
                          <button type="button" className="ui-btn ui-btn--sm" onClick={() => cancel(r._id)}>
                            요청 취소
                          </button>
                        )}
                      </>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {createOpen && (
        <Modal
          title="시간 요청 보내기"
          onClose={() => setCreateOpen(false)}
          footer={
            <div className="ui-actions">
              <button type="button" className="ui-btn" onClick={() => setCreateOpen(false)}>
                취소
              </button>
              <button type="submit" form="req-send-form" className="ui-btn ui-btn--primary" disabled={busy}>
                {busy ? '보내는 중…' : '보내기'}
              </button>
            </div>
          }
        >
          <form id="req-send-form" className="ui-form" onSubmit={send}>
            <div className="ui-field">
              <span className="ui-label">누구에게</span>
              <Select
                value={toId}
                onChange={setToId}
                placeholder="친구 고르기"
                ariaLabel="친구 고르기"
                options={friends.map((f) => ({ value: f.user._id, label: `${displayName(f.user)} (${f.user.email})` }))}
              />
            </div>

            <div className="ui-field">
              <span className="ui-label">날짜</span>
              <DatePicker value={date} onChange={setDate} markedDates={markedDates} block ariaLabel="날짜 고르기" />
            </div>

            <div className="ui-field">
              <span className="ui-label">시간</span>
              <label className="ui-switch">
                <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
                <span className="ui-switch__track" aria-hidden />
                <span>종일</span>
              </label>
              {!allDay && (
                <div className={s.times}>
                  <TimeSelect value={startTime} onChange={setStartTime} hourLabel="시작 시" minuteLabel="시작 분" />
                  <span className="ui-muted" aria-hidden>
                    –
                  </span>
                  <TimeSelect value={endTime} onChange={setEndTime} hourLabel="종료 시" minuteLabel="종료 분" />
                </div>
              )}
            </div>

            <div className="ui-field">
              <label className="ui-label" htmlFor="req-title">
                제목
              </label>
              <input
                id="req-title"
                className="ui-input"
                placeholder="예: 저녁 같이 먹어요"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="ui-field">
              <label className="ui-label" htmlFor="req-message">
                메시지 <span className="ui-muted">(선택)</span>
              </label>
              <input
                id="req-message"
                className="ui-input"
                placeholder="짧은 메시지를 남겨 보세요"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
