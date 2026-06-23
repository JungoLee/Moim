import type { ReactNode } from 'react';
import Icon, { type IconName } from '@/components/Icon';
import styles from './PageHero.module.scss';

type Props = {
  icon: IconName;
  title: string;
  desc?: ReactNode;
  /** 우측 등에 둘 액션 (예: 버튼) */
  action?: ReactNode;
};

/** 모든 탭 상단 공통 비주얼 헤더 — 아이콘 배지 + 제목 + 설명. */
export default function PageHero({ icon, title, desc, action }: Props) {
  return (
    <header className={styles.hero}>
      <span className={styles.heroIcon}>
        <Icon name={icon} size={28} />
      </span>
      <div className={styles.heroText}>
        <h2 className={styles.heroTitle}>{title}</h2>
        {desc && <p className={styles.heroDesc}>{desc}</p>}
      </div>
      {action && (
        <>
          <span className="app-spacer" />
          {action}
        </>
      )}
    </header>
  );
}
