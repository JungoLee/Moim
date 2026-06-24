import type { ReactNode } from 'react';
import Avatar from './Avatar';
import { displayName } from '@/lib/format';

type Props = {
  /** 표시할 멤버 (닉네임 우선, 이메일은 보조) */
  user: { name?: string; nickname?: string; email?: string; picture?: string };
  /** 우측 액션 (제거·강퇴 버튼 등) */
  action?: ReactNode;
};

/** 아바타 + 이름(닉네임 우선)/이메일 + 우측 액션 한 줄. 그룹·모임 멤버 목록 공용. */
export default function MemberRow({ user, action }: Props) {
  return (
    <div className="app-member">
      <Avatar src={user.picture} alt={displayName(user)} />
      <span className="app-member-info">
        <span className="app-member-name">{displayName(user)}</span>
        {user.email && <span className="app-member-email">{user.email}</span>}
      </span>
      {action}
    </div>
  );
}
