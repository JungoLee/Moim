'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api, getToken } from '@/lib/api';
import { applyTheme, isTheme } from '@/lib/theme';
import type { FriendRequest, RoomSummary, TimeRequest, User } from '@/lib/types';

// 틀이 한 번 불러와 모든 화면이 같이 쓰는 것 — 내 정보·답할 것·내 모임.
// 예전엔 화면마다 /api/auth/me 를 따로 불렀다(4곳). 이제 여기 한 곳.
type Inbox = { requests: TimeRequest[]; friendRequests: FriendRequest[] };

type ShellValue = {
  /** 로그인 안 했으면 null, 불러오는 중이면 undefined */
  me: User | null | undefined;
  inbox: Inbox;
  /** 불러오기 전 null */
  rooms: RoomSummary[] | null;
  /** 모임 목록을 못 불러왔는가 — 비어 보이는 것과 구분한다 */
  roomsError: boolean;
  refreshMe: () => Promise<void>;
  refreshInbox: () => Promise<void>;
  refreshRooms: () => Promise<void>;
};

const EMPTY_INBOX: Inbox = { requests: [], friendRequests: [] };

const ShellContext = createContext<ShellValue>({
  me: null,
  inbox: EMPTY_INBOX,
  rooms: null,
  roomsError: false,
  refreshMe: async () => {},
  refreshInbox: async () => {},
  refreshRooms: async () => {},
});

export function ShellProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<User | null | undefined>(undefined);
  const [inbox, setInbox] = useState<Inbox>(EMPTY_INBOX);
  const [rooms, setRooms] = useState<RoomSummary[] | null>(null);
  const [roomsError, setRoomsError] = useState(false);

  const refreshMe = useCallback(async () => {
    try {
      const r = await api<{ user: User }>('/api/auth/me');
      setMe(r.user);
      // 계정에 저장된 테마가 이 브라우저 값보다 우선
      if (isTheme(r.user.uiTheme)) applyTheme(r.user.uiTheme);
    } catch {
      setMe(null); // 401 이면 api() 가 토큰을 지우고 랜딩으로 보낸다
    }
  }, []);

  const refreshInbox = useCallback(async () => {
    try {
      const [req, fr] = await Promise.all([
        api<{ requests: TimeRequest[] }>('/api/requests/received'),
        api<{ requests: FriendRequest[] }>('/api/friends/requests'),
      ]);
      setInbox({ requests: req.requests.filter((r) => r.status === 'pending'), friendRequests: fr.requests });
    } catch {
      /* 배지는 없어도 화면은 쓸 수 있다 */
    }
  }, []);

  const refreshRooms = useCallback(async () => {
    try {
      const r = await api<{ rooms: RoomSummary[] }>('/api/rooms');
      setRooms(r.rooms);
      setRoomsError(false);
    } catch {
      setRoomsError(true);
      setRooms((prev) => prev ?? []);
    }
  }, []);

  useEffect(() => {
    if (!getToken()) {
      setMe(null);
      return;
    }
    refreshMe();
    refreshInbox();
    refreshRooms();
  }, [refreshMe, refreshInbox, refreshRooms]);

  const value = useMemo(
    () => ({ me, inbox, rooms, roomsError, refreshMe, refreshInbox, refreshRooms }),
    [me, inbox, rooms, roomsError, refreshMe, refreshInbox, refreshRooms]
  );
  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

/** 틀 데이터 — 내 정보(me)·답할 것(inbox)·내 모임(rooms)과 다시 불러오기 */
export function useShell(): ShellValue {
  return useContext(ShellContext);
}

/** 답할 것 개수 (홈 배지) */
export function inboxCount(inbox: Inbox): number {
  return inbox.requests.length + inbox.friendRequests.length;
}
