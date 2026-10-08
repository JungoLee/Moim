'use client';

import { useState } from 'react';
import Avatar from '@/components/Avatar';
import Icon from '@/components/Icon';
import UserProfileModal from '@/components/UserProfileModal';
import { displayName } from '@/lib/format';
import type { User } from '@/lib/types';
import styles from './MemberStrip.module.scss';

type Props = {
  /** 나 먼저 정렬된 멤버 */
  members: User[];
  meId: string;
  /** 하루라도 찍은 멤버 id */
  markedIds: Set<string>;
};

/** 멤버 칩(아바타 + 이름 + 찍었으면 체크, 아직이면 '아직') + 진행 한 줄. 내가 아닌 사람을 누르면 프로필 */
export default function MemberStrip({ members, meId, markedIds }: Props) {
  const [profile, setProfile] = useState<User | null>(null);
  const total = members.length;
  const marked = members.filter((m) => markedIds.has(m._id)).length;
  const all = total > 0 && marked === total;

  return (
    <section className={styles.strip} aria-label="멤버" data-guide="room-members">
      <ul className={styles.list}>
        {members.map((m) => {
          const name = displayName(m);
          const done = markedIds.has(m._id);
          const inner = (
            <>
              <Avatar src={m.picture} name={name} id={m._id} size="sm" />
              <span className={styles.name}>{m._id === meId ? `${name} (나)` : name}</span>
              {done ? (
                <span className={styles.done} role="img" aria-label="날짜를 찍었어요">
                  <Icon name="check" size={14} stroke={3} />
                </span>
              ) : (
                <span className={styles.wait}>아직</span>
              )}
            </>
          );
          return (
            <li key={m._id}>
              {m._id === meId ? (
                <span className={styles.chip}>{inner}</span>
              ) : (
                <button type="button" className={styles.chip} onClick={() => setProfile(m)} title={`${name} 프로필`}>
                  {inner}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <span className={styles.progress} data-all={all || undefined}>
        {all ? `${total}명 모두 날짜를 찍었어요` : `${total}명 중 ${marked}명 찍음`}
      </span>
      {profile && <UserProfileModal user={profile} onClose={() => setProfile(null)} />}
    </section>
  );
}
