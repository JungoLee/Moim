'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { api } from '@/lib/api';
import { normPath } from '@/components/shell/nav';
import { useShell } from '@/components/shell/ShellContext';
import type { Friend, Tier } from '@/lib/types';

type Props = {
  /** 이미 아는 개수 — 주면 다시 불러오지 않고 이 값을 쓴다(수락·삭제 뒤 바로 맞춰진다) */
  friendCount?: number;
  tierCount?: number;
};

/** 사람 세 화면(친구 · 그룹 · 시간 요청) 머리 아래 공통 탭 — docs/design-system.md 6-6 */
export default function PeopleTabs({ friendCount, tierCount }: Props) {
  const pathname = normPath(usePathname());
  const { inbox } = useShell();
  const [friends, setFriends] = useState<number | null>(null);
  const [tiers, setTiers] = useState<number | null>(null);
  const needFriends = friendCount === undefined;
  const needTiers = tierCount === undefined;

  useEffect(() => {
    let alive = true;
    if (needFriends) {
      api<{ friends: Friend[] }>('/api/friends')
        .then((r) => alive && setFriends(r.friends.length))
        .catch(() => {});
    }
    if (needTiers) {
      api<{ tiers: Tier[] }>('/api/tiers')
        .then((r) => alive && setTiers(r.tiers.length))
        .catch(() => {});
    }
    return () => {
      alive = false;
    };
  }, [needFriends, needTiers]);

  const f = friendCount ?? friends;
  const t = tierCount ?? tiers;
  const pending = inbox.requests.length;

  return (
    <nav className="ui-tabs" aria-label="사람" data-guide="people-tabs">
      <Link href="/friends" aria-current={pathname === '/friends' ? 'page' : undefined}>
        친구
        {f !== null && <span className="ui-num ui-muted">{f}</span>}
      </Link>
      <Link href="/tiers" aria-current={pathname === '/tiers' ? 'page' : undefined}>
        그룹
        {t !== null && <span className="ui-num ui-muted">{t}</span>}
      </Link>
      <Link href="/requests" aria-current={pathname === '/requests' ? 'page' : undefined}>
        시간 요청
        {pending > 0 && (
          <span className="ui-badge" aria-label={`답할 시간 요청 ${pending}개`}>
            {pending > 99 ? '99+' : pending}
          </span>
        )}
      </Link>
    </nav>
  );
}
