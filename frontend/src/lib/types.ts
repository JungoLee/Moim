export type User = {
  _id: string;
  name: string;
  nickname?: string;
  email: string;
  picture?: string;
  isAdmin?: boolean;
  createdAt?: string;
};

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

export type RoomSummary = {
  _id: string;
  name: string;
  code: string;
  memberCount: number;
  isOwner: boolean;
};

export type RoomDetail = {
  _id: string;
  name: string;
  code: string;
  owner: string;
  members: User[];
};

export type RoomComment = {
  _id: string;
  user: string;
  name: string;
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
