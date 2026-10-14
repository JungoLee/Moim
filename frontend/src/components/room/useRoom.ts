'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { confirmDialog } from '@/lib/confirm';
import { toast } from '@/lib/toast';
import { allDayIsoRange, fmtKeyRange, startOfDay, todayKey } from '@/lib/datetime';
import { displayName } from '@/lib/format';
import { getHolidays } from '@/lib/holidays';
import { candidates, summarize } from '@/lib/roomCandidates';
import type { Candidate, DaySummary } from '@/lib/roomCandidates';
import { useShell } from '@/components/shell/ShellContext';
import type { AvailStatus, Mark, RoomComment, RoomDetail, User } from '@/lib/types';

// 모임 방 데이터·동작 한 곳 — 보드 보기와 표 보기가 같이 쓴다 (docs/design-system.md 4-3).

type RoomRes = { room: RoomDetail; availabilities: Record<string, Mark[]>; comments: RoomComment[] };

type RoomPhase = 'loading' | 'ready' | 'denied';

const seenKey = (roomId: string) => `moim_chat_seen_${roomId}`;

function readSeen(roomId: string): string {
  try {
    return localStorage.getItem(seenKey(roomId)) || '';
  } catch {
    return '';
  }
}

function fail(prefix: string, e: unknown) {
  toast(`${prefix} ${e instanceof Error ? e.message : ''}`.trim(), 'error');
}

export function useRoom(roomId: string) {
  const { me, refreshRooms } = useShell();
  const meId = me?._id || '';

  const [phase, setPhase] = useState<RoomPhase>('loading');
  const [error, setError] = useState('');
  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [availabilities, setAvailabilities] = useState<Record<string, Mark[]>>({});
  const [comments, setComments] = useState<RoomComment[]>([]);
  const [seenAt, setSeenAt] = useState<string | null>(null);

  // 표시 방법 — 달력·표 둘 다 이걸로 찍는다
  const [mode, setMode] = useState<AvailStatus>('yes');
  const [afterTime, setAfterTime] = useState('19:00');
  // 보고 있는 달 (1일)
  const [month, setMonth] = useState(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), 1);
  });

  const meIdRef = useRef(meId);
  meIdRef.current = meId;
  const availRef = useRef(availabilities);
  availRef.current = availabilities;
  const modeRef = useRef({ mode, afterTime });
  modeRef.current = { mode, afterTime };
  // 저장은 순서대로 한 줄로 — 빠르게 연달아 눌러도 마지막 상태가 남는다
  const saveChain = useRef<Promise<unknown>>(Promise.resolve());
  const pendingSaves = useRef(0);

  const apply = useCallback((res: RoomRes, keepMine: boolean) => {
    setRoom(res.room);
    setComments(res.comments || []);
    setAvailabilities((prev) => {
      const next = res.availabilities || {};
      return keepMine && meIdRef.current && prev[meIdRef.current] ? { ...next, [meIdRef.current]: prev[meIdRef.current] } : next;
    });
  }, []);

  /** 서버에서 다시 받기. silent 이면 실패해도 조용히 */
  const reload = useCallback(
    async (silent = false) => {
      if (!roomId) return;
      try {
        const res = await api<RoomRes>(`/api/rooms/${roomId}`);
        apply(res, pendingSaves.current > 0);
      } catch (e) {
        if (!silent) fail('불러오지 못했어요.', e);
      }
    },
    [roomId, apply]
  );

  // 처음 불러오기 — 멤버가 아니면 URL 가입을 시도하고, 안 되면 막힘
  useEffect(() => {
    if (!roomId || !meId) return undefined;
    let alive = true;
    setPhase('loading');
    (async () => {
      try {
        const res = await api<RoomRes>(`/api/rooms/${roomId}`);
        if (!alive) return;
        apply(res, false);
        setPhase('ready');
        return;
      } catch {
        /* 멤버가 아닐 수 있음 → 아래에서 URL 가입 시도 */
      }
      try {
        await api(`/api/rooms/${roomId}/join-url`, { method: 'POST' });
        const res = await api<RoomRes>(`/api/rooms/${roomId}`);
        if (!alive) return;
        apply(res, false);
        setPhase('ready');
        void refreshRooms();
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : '');
        setPhase('denied');
      }
    })();
    return () => {
      alive = false;
    };
  }, [roomId, meId, apply, refreshRooms]);

  // 다른 사람이 찍은 것·새 대화를 가끔 받아온다 — 화면이 보일 때만, 내가 저장하는 중에는 쉰다
  useEffect(() => {
    if (phase !== 'ready') return undefined;
    const t = setInterval(() => {
      if (document.hidden || pendingSaves.current > 0) return;
      void reload(true);
    }, 30_000);
    return () => clearInterval(t);
  }, [phase, reload]);

  // ── 파생 값 ───────────────────────────────────────────
  const members = useMemo(() => room?.members ?? [], [room]);
  const total = members.length;
  const isOwner = !!room && room.owner === meId;
  const ownerUser = useMemo(() => members.find((m) => m._id === room?.owner), [members, room]);
  const ownerName = ownerUser ? displayName(ownerUser) : '';
  /** 나 먼저 */
  const ordered = useMemo<User[]>(() => {
    const mine = members.filter((m) => m._id === meId);
    return [...mine, ...members.filter((m) => m._id !== meId)];
  }, [members, meId]);

  // 나간 멤버가 남긴 표시는 집계에 넣지 않는다
  const memberAvail = useMemo(() => {
    const ids = new Set(members.map((m) => m._id));
    const out: Record<string, Mark[]> = {};
    for (const [uid, marks] of Object.entries(availabilities)) if (ids.has(uid)) out[uid] = marks;
    return out;
  }, [availabilities, members]);

  const summary = useMemo<Record<string, DaySummary>>(() => summarize(memberAvail), [memberAvail]);
  const cands = useMemo<Candidate[]>(() => candidates(summary, total, todayKey()), [summary, total]);
  const markedIds = useMemo(() => {
    const s = new Set<string>();
    for (const [uid, marks] of Object.entries(memberAvail)) if (marks.length > 0) s.add(uid);
    return s;
  }, [memberAvail]);
  const markedCount = markedIds.size;
  const myMarks = useMemo(() => {
    const map: Record<string, Mark> = {};
    for (const m of availabilities[meId] || []) map[m.date] = m;
    return map;
  }, [availabilities, meId]);

  const holidays = useMemo(() => getHolidays([month.getFullYear(), month.getFullYear() + 1]), [month]);

  const shiftMonth = useCallback((n: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1)), []);
  const goToday = useCallback(() => {
    const t = startOfDay(new Date());
    setMonth(new Date(t.getFullYear(), t.getMonth(), 1));
  }, []);

  // ── 안 읽은 대화 ─────────────────────────────────────
  useEffect(() => {
    if (phase !== 'ready') return;
    let s = readSeen(roomId);
    if (!s) {
      // 처음 들어온 방 — 이미 있던 대화는 읽은 것으로
      s = comments.length ? comments[comments.length - 1].createdAt : new Date().toISOString();
      try {
        localStorage.setItem(seenKey(roomId), s);
      } catch {
        /* 무시 */
      }
    }
    setSeenAt((prev) => prev ?? s);
    // 방이 바뀔 때만 다시 읽는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, roomId]);

  const unread = useMemo(() => {
    if (seenAt === null) return 0;
    return comments.filter((c) => c.user !== meId && c.createdAt > seenAt).length;
  }, [comments, seenAt, meId]);

  /** 대화가 화면에 보이는 동안 부른다 — 지금까지를 읽은 것으로 */
  const markChatSeen = useCallback(() => {
    const last = comments.length ? comments[comments.length - 1].createdAt : '';
    if (!last) return;
    setSeenAt((prev) => {
      if (prev !== null && prev >= last) return prev;
      try {
        localStorage.setItem(seenKey(roomId), last);
      } catch {
        /* 무시 */
      }
      return last;
    });
  }, [comments, roomId]);

  const refreshComments = useCallback(async () => {
    try {
      const res = await api<RoomRes>(`/api/rooms/${roomId}`);
      setComments(res.comments || []);
    } catch {
      /* 폴링 실패는 조용히 */
    }
  }, [roomId]);

  // ── 내 표시 ──────────────────────────────────────────
  const save = useCallback(
    (marks: Mark[]) => {
      pendingSaves.current++;
      saveChain.current = saveChain.current
        .then(() => api(`/api/rooms/${roomId}/availability`, { method: 'PUT', body: { marks } }))
        .catch(async (e) => {
          fail('저장하지 못했어요.', e);
          pendingSaves.current--; // 되돌리기 전에 먼저 내려놓아야 서버 값을 받는다
          await reload(true);
          pendingSaves.current++;
        })
        .finally(() => {
          pendingSaves.current--;
        });
    },
    [roomId, reload]
  );

  /**
   * 내 칸에 현재 표시 방법을 적용.
   * 한 칸만 눌렀는데(끌기 아님) 이미 같은 표시면 지운다, 아니면 덮어쓴다. 끌어서 고른 여러 칸은 전부 덮어쓴다.
   */
  const applyMarks = useCallback(
    (dates: string[], isDrag: boolean) => {
      if (!meIdRef.current || dates.length === 0) return;
      const { mode: m, afterTime: at } = modeRef.current;
      const map: Record<string, Mark> = {};
      for (const x of availRef.current[meIdRef.current] || []) map[x.date] = x;
      const make = (d: string): Mark => (m === 'after' ? { date: d, status: 'after', time: at } : { date: d, status: m });
      if (!isDrag && dates.length === 1) {
        const d = dates[0];
        if (map[d] && map[d].status === m && (m !== 'after' || map[d].time === at)) delete map[d];
        else map[d] = make(d);
      } else {
        for (const d of dates) map[d] = make(d);
      }
      const arr = Object.values(map);
      availRef.current = { ...availRef.current, [meIdRef.current]: arr };
      setAvailabilities(availRef.current);
      save(arr);
    },
    [save]
  );

  /** 내 표시 전부 지우기 (확인창 있음) */
  const resetMine = useCallback(async () => {
    const n = availRef.current[meIdRef.current]?.length || 0;
    if (!n) return;
    const ok = await confirmDialog({
      message: `내가 표시한 날짜 ${n}일을 모두 지울까요?\n되돌릴 수 없어요. 다른 사람이 찍은 날짜는 그대로예요.`,
      confirmText: '모두 지우기',
      danger: true,
    });
    if (!ok) return;
    availRef.current = { ...availRef.current, [meIdRef.current]: [] };
    setAvailabilities(availRef.current);
    save([]);
  }, [save]);

  // ── 확정 ─────────────────────────────────────────────
  /** 방장이 날짜 확정 — 확인창 → 서버 → 토스트. 했으면 true */
  const confirm = useCallback(
    async (range: { start: string; end: string }, changing = false) => {
      const label = fmtKeyRange(range.start, range.end);
      const ok = await confirmDialog({
        title: changing ? '확정 날짜를 바꿀까요?' : undefined,
        message: `${label}로 확정할까요? 멤버 ${total}명의 캘린더에 비공개 일정으로 들어가요.`,
        confirmText: changing ? '바꾸기' : '확정',
      });
      if (!ok) return false;
      try {
        const iso = allDayIsoRange(range.start, range.end);
        await api(`/api/rooms/${roomId}/confirm`, {
          method: 'POST',
          body: { startDate: range.start, endDate: range.end, start: iso.start, end: iso.end },
        });
        toast('확정했어요. 모두의 캘린더에 넣었어요', 'success');
        await reload(true);
        void refreshRooms();
        return true;
      } catch (e) {
        fail('확정하지 못했어요.', e);
        return false;
      }
    },
    [roomId, total, reload, refreshRooms]
  );

  /** 방장이 확정 취소 */
  const unconfirm = useCallback(async () => {
    const ok = await confirmDialog({
      message: '확정을 취소할까요? 멤버들의 캘린더에서 이 일정이 지워져요.',
      confirmText: '확정 취소',
      danger: true,
    });
    if (!ok) return false;
    try {
      await api(`/api/rooms/${roomId}/confirm`, { method: 'DELETE' });
      toast('확정을 취소했어요', 'success');
      await reload(true);
      void refreshRooms();
      return true;
    } catch (e) {
      fail('확정을 취소하지 못했어요.', e);
      return false;
    }
  }, [roomId, reload, refreshRooms]);

  return {
    roomId,
    phase,
    error,
    room,
    meId,
    me,
    members,
    ordered,
    total,
    isOwner,
    ownerName,
    availabilities: memberAvail,
    myMarks,
    summary,
    cands,
    markedIds,
    markedCount,
    holidays,
    comments,
    unread,
    markChatSeen,
    refreshComments,
    mode,
    setMode,
    afterTime,
    setAfterTime,
    month,
    shiftMonth,
    goToday,
    reload,
    applyMarks,
    resetMine,
    confirm,
    unconfirm,
  };
}

export type RoomApi = ReturnType<typeof useRoom>;
