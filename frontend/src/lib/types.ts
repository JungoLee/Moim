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
  visibility?: 'public' | 'private' | 'default';
  audienceTiers?: string[]; // 비공개 시 상세 열람 가능한 그룹 id 목록
  busy?: boolean; // 친구 캘린더 조회 시 "바쁨" 블록 여부
};

// 사용자가 만드는 공개 그룹
export type Tier = {
  _id: string;
  name: string;
  code: string;
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
