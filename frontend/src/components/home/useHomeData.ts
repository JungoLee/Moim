'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { displayName } from '@/lib/format';
import { toast } from '@/lib/toast';
import { computeLeavePlan, type Bridge, type LeaveStyle } from '@/lib/leave';
import { getHolidays } from '@/lib/holidays';
import { addDays, fmtEventTime, parseDateKey, startOfDay } from '@/lib/datetime';
import { useShell } from '@/components/shell/ShellContext';
import { WEEK_LENGTH, eventsOnDay, overlapsDay, weekDays } from '@/components/home/week';
import type { FriendBusy, MoimEvent, RoomSummary, User } from '@/lib/types';

// 홈 두 보기(HomeBoard·HomeTable)가 같이 쓰는 데이터와 동작. 데이터·문구·동작은 여기 한 곳(docs/design-system.md 0장).

type LeaveSettings = { remaining: number; start: string; renewal: string; maxConsec: number; style: LeaveStyle };

/** '답할 것' 한 건 — 시간 요청 또는 친구 요청 */
export type InboxItem = {
  key: string;
  kind: 'time' | 'friend';
  id: string;
  person: User | undefined;
  kindLabel: string;
  title: string;
  when: string;
};

export type LeaveSuggestion = {
  bridge: Bridge;
  style: LeaveStyle;
  comboLeave: number;
  comboOff: number;
};

export type HomeData = {
  me: User | null | undefined;
  today: Date;
  days: Date[];
  /** 처음 불러오기가 끝났는가 — 끝나기 전에는 '없습니다'를 보이지 않고 ui-skeleton */
  ready: boolean;
  error: string;
  /** 오늘부터 7일에 걸치는 내 일정 */
  weekEvents: MoimEvent[];
  todayEventCount: number;
  inbox: InboxItem[];
  rooms: RoomSummary[];
  leave: LeaveSuggestion | null;
  /** 표 보기용 — 친구 목록과 친구들의 바쁜 시간 */
  friends: User[];
  friendBusy: FriendBusy[];
  friendsReady: boolean;
  /** 지금 처리 중인 답할 것 key (버튼 잠금) */
  pendingKey: string;
  answer: (item: InboxItem, action: 'accept' | 'decline') => Promise<void>;
};

export function useHomeData(opts: { withFriends: boolean }): HomeData {
  const { me, inbox, rooms, refreshInbox, refreshRooms } = useShell();
  const [today] = useState(() => startOfDay(new Date()));
  const days = useMemo(() => weekDays(today), [today]);

  const [events, setEvents] = useState<MoimEvent[] | null>(null);
  const [leaveSettings, setLeaveSettings] = useState<LeaveSettings | null>(null);
  const [inboxLoaded, setInboxLoaded] = useState(false);
  const [leaveLoaded, setLeaveLoaded] = useState(false);
  const [error, setError] = useState('');
  const [pendingKey, setPendingKey] = useState('');

  const [friends, setFriends] = useState<User[] | null>(null);
  const [friendBusy, setFriendBusy] = useState<FriendBusy[]>([]);

  const loadEvents = useCallback(async () => {
    try {
      const r = await api<{ events: MoimEvent[] }>('/api/events');
      setEvents(r.events);
    } catch (e) {
      setError(e instanceof Error ? e.message : '일정을 불러오지 못했어요. 화면을 새로고침해 주세요.');
      setEvents((prev) => prev ?? []);
    }
  }, []);

  const loadFriends = useCallback(async () => {
    try {
      const from = startOfDay(new Date());
      const to = addDays(from, WEEK_LENGTH);
      const q = `from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`;
      const r = await api<{ friends: User[]; busy: FriendBusy[] }>(`/api/calendar/friends?${q}`);
      setFriends(r.friends);
      setFriendBusy(r.busy);
    } catch {
      setFriends((prev) => prev ?? []);
    }
  }, []);

  // 처음 불러오기 — 예전처럼 차례로 기다리지 않고 한꺼번에 (틀이 들고 있는 값도 새로 고친다)
  useEffect(() => {
    refreshInbox().finally(() => setInboxLoaded(true));
    refreshRooms();
    loadEvents();
    api<{ leave: LeaveSettings }>('/api/auth/leave')
      .then((r) => setLeaveSettings(r.leave || null))
      .catch(() => {})
      .finally(() => setLeaveLoaded(true));
    // 처음 한 번만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const friendsRequested = useRef(false);
  useEffect(() => {
    if (!opts.withFriends || friendsRequested.current) return;
    friendsRequested.current = true;
    loadFriends();
  }, [opts.withFriends, loadFriends]);

  const weekEvents = useMemo(() => {
    if (!events) return [];
    return events.filter((e) => days.some((d) => overlapsDay(e, d)));
  }, [events, days]);

  const todayEventCount = useMemo(() => eventsOnDay(weekEvents, today).length, [weekEvents, today]);

  const items: InboxItem[] = useMemo(() => {
    const t: InboxItem[] = inbox.requests.map((r) => ({
      key: `t-${r._id}`,
      kind: 'time',
      id: r._id,
      person: r.from,
      kindLabel: '시간 요청',
      title: `${r.from ? displayName(r.from) : '친구'} · ${r.title}`,
      when: fmtEventTime(r.start, r.end, r.allDay),
    }));
    const f: InboxItem[] = inbox.friendRequests.map((r) => ({
      key: `f-${r._id}`,
      kind: 'friend',
      id: r._id,
      person: r.requester,
      kindLabel: '친구 요청',
      title: `${displayName(r.requester)} 님이 친구 요청`,
      when: r.requester.email,
    }));
    return [...t, ...f];
  }, [inbox]);

  // 추천 연차 — 저장된 설정으로 계산한 첫 항목 (연차 계산기와 같은 로직)
  const leave = useMemo<LeaveSuggestion | null>(() => {
    if (!leaveSettings) return null;
    // 저장된 시작일이 지났으면 오늘부터 (연차 계산기와 같은 규칙)
    const saved = parseDateKey(leaveSettings.start);
    const from = saved && saved.getTime() > today.getTime() ? saved : today;
    const to = parseDateKey(leaveSettings.renewal) || new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());
    if (from.getTime() >= to.getTime()) return null;
    const years: number[] = [];
    for (let y = from.getFullYear(); y <= to.getFullYear(); y++) years.push(y);
    const style = leaveSettings.style || 'balanced';
    const plan = computeLeavePlan(from, to, leaveSettings.remaining || 0, leaveSettings.maxConsec || 5, style, getHolidays(years));
    const next = plan.combo.find((b) => b.spanEnd.getTime() >= today.getTime());
    if (!next) return null;
    return { bridge: next, style, comboLeave: plan.comboLeave, comboOff: plan.comboOff };
  }, [leaveSettings, today]);

  const answer = useCallback(
    async (item: InboxItem, action: 'accept' | 'decline') => {
      setPendingKey(item.key);
      try {
        if (item.kind === 'time') {
          await api(`/api/requests/${item.id}/${action}`, { method: 'POST' });
          toast(action === 'accept' ? '수락했어요. 양쪽 캘린더에 일정을 넣었어요' : '거절했어요', 'success');
          if (action === 'accept') loadEvents();
        } else {
          await api(`/api/friends/requests/${item.id}/${action}`, { method: 'POST' });
          toast(action === 'accept' ? '친구가 됐어요' : '거절했어요', 'success');
          if (action === 'accept' && opts.withFriends) loadFriends();
        }
      } catch (e) {
        // 이미 다른 곳에서 처리된 요청(409)도 여기로 온다 — 서버 문구를 그대로 알리고 목록을 새로 고친다
        toast(e instanceof Error ? e.message : '처리하지 못했어요', 'error');
      } finally {
        await refreshInbox();
        setPendingKey('');
      }
    },
    [loadEvents, loadFriends, opts.withFriends, refreshInbox]
  );

  const ready = events !== null && rooms !== null && inboxLoaded && leaveLoaded;

  return {
    me,
    today,
    days,
    ready,
    error,
    weekEvents,
    todayEventCount,
    inbox: items,
    rooms: rooms ?? [],
    leave,
    friends: friends ?? [],
    friendBusy,
    friendsReady: friends !== null,
    pendingKey,
    answer,
  };
}
