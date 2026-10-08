export type User = {
  _id: string;
  name: string;
  nickname?: string;
  email: string;
  picture?: string;
  isAdmin?: boolean;
  /** 화면 테마 — '' 이면 아직 안 고름(보드) */
  uiTheme?: '' | 'board' | 'table';
  createdAt?: string;
};

export type UiTheme = 'board' | 'table';

export type MoimEvent = {
  _id: string;
  title?: string;
  start: string;
  end: string;
  allDay?: boolean;
  location?: string;
  memo?: string;
  visibility?: 'public' | 'private' | 'default';
  audienceTiers?: string[]; // 비공개 시 상세 열람 가능한 그룹 id 목록
  busy?: boolean; // 친구 캘린더 조회 시 "바쁨" 블록 여부
  // 자동 생성된 일정의 출처 — kind 'timeRequest'(fromName=요청한 사람, toName=받은 사람)
  //                           · 'room'(모임 확정: requestId=방 id, fromName=방장, toName=방 이름)
  origin?: { kind: string; requestId?: string; fromName: string; toName: string; requestedAt?: string };
  originPartnerGone?: boolean; // 상대방이 자기 쪽 사본을 삭제함 (서버가 목록 조회 시 주석)
};

// 사용자가 만드는 공개 그룹
export type Tier = {
  _id: string;
  name: string;
  code: string;
  color?: string; // 캘린더 라인 색상 (#rrggbb)
  members: User[];
};

export type Friend = {
  friendshipId: string;
  user: User;
};

export type FriendRequest = {
  _id: string;
  requester: User;
};

// 모임 방 (약속 잡기)
export type AvailStatus = 'yes' | 'no' | 'after'; // 종일가능 | 불가 | 그 시간 이후 가능
export type Mark = { date: string; status: AvailStatus; time?: string };

/** 확정한 날짜 — 'YYYY-MM-DD'(끝 포함) */
export type RoomConfirmed = { start: string; end: string; at?: string };

export type RoomSummary = {
  _id: string;
  name: string;
  code: string;
  memberCount: number;
  /** 한 날이라도 찍은 멤버 수 */
  markedCount: number;
  myMarked: boolean;
  /** 오늘 이후 전원 가능한 날 수 */
  fullDayCount: number;
  confirmed: RoomConfirmed | null;
  isOwner: boolean;
};

export type RoomDetail = {
  _id: string;
  name: string;
  code: string;
  joinByUrl?: boolean;
  owner: string;
  members: User[];
  confirmed: RoomConfirmed | null;
};

/** GET /api/calendar/friends — 친구 일정의 시간만 */
export type FriendBusy = { userId: string; start: string; end: string; allDay: boolean };

export type RoomComment = {
  _id: string;
  user: string;
  name: string;
  picture?: string;
  text: string;
  createdAt: string;
};

// 시간 요청
export type TimeRequest = {
  _id: string;
  from?: User;
  to?: User;
  title: string;
  start: string;
  end: string;
  allDay?: boolean;
  message: string;
  status: 'pending' | 'accepted' | 'declined';
};
