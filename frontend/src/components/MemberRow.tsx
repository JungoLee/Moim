import type { ReactNode } from 'react';
import Avatar from './Avatar';
import { displayName } from '@/lib/format';

type Props = {
  /** 멤버 (닉네임 우선, 이메일은 보조) */
  user: { _id?: string; name?: string; nickname?: string; email?: string; picture?: string };
  /** 오른쪽 동작 (빼기·내보내기 버튼 등) */
  action?: ReactNode;
};

/** 아바타 + 이름/이메일 + 오른쪽 동작 한 줄 — 그룹·모임 멤버 목록 공용 (ui-list 안에 둔다) */
export default function MemberRow({ user, action }: Props) {
  const name = displayName(user);
  return (
    <div className="ui-row">
      <Avatar src={user.picture} name={name} id={user._id} size="sm" />
      <span className="ui-row__main">
        <span className="ui-row__title">{name}</span>
        {user.email && <span className="ui-row__sub">{user.email}</span>}
      </span>
      {action && <span className="ui-row__side">{action}</span>}
    </div>
  );
}
