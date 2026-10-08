'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import Icon from '@/components/Icon';
import styles from './RoomMobileHead.module.scss';

type Props = {
  name: string;
  /** 이름 아래 작은 글 — '5명 모두 찍음' */
  sub: string;
  /** 오른쪽 단추들 */
  children?: ReactNode;
};

/** 모바일(<900) 방 머리 — 뒤로 · 방 이름 · 한 줄 설명 · 오른쪽 단추. 데스크톱에서는 숨는다(PageHeader 가 대신) */
export default function RoomMobileHead({ name, sub, children }: Props) {
  return (
    <div className={styles.head}>
      <Link href="/rooms" className={styles.back} aria-label="모임 목록으로">
        <Icon name="chevron-left" size={22} />
      </Link>
      <div className={styles.title}>
        <h1>{name}</h1>
        <span>{sub}</span>
      </div>
      {children && <div className={styles.side}>{children}</div>}
    </div>
  );
}

type IconBtnProps = {
  icon: 'chat' | 'share' | 'settings';
  label: string;
  onClick: () => void;
  /** 안 읽은 수 (0 이면 안 보임) */
  badge?: number;
};

/** 머리 오른쪽 아이콘 단추 (바탕에서 글자색을 물려받는다) */
export function HeadIconButton({ icon, label, onClick, badge = 0 }: IconBtnProps) {
  return (
    <button type="button" className={styles.iconBtn} onClick={onClick} aria-label={label} title={label}>
      <Icon name={icon} size={20} />
      {badge > 0 && (
        <span className={`ui-badge ${styles.badge}`} aria-hidden="true">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
}
