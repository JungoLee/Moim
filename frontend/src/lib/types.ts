export type User = {
  _id: string;
  name: string;
  email: string;
  picture?: string;
};

export type MoimEvent = {
  _id: string;
  title?: string;
  start: string;
  end: string;
  allDay?: boolean;
  location?: string;
  memo?: string;
  visibility?: 'default' | 'private';
  busy?: boolean; // 친구 캘린더 조회 시 "바쁨" 블록 여부
};

export type Tier = 'close' | 'normal';

export type Friend = {
  friendshipId: string;
  user: User;
  myTierForThem: Tier;
};

export type FriendRequest = {
  _id: string;
  requester: User;
};
