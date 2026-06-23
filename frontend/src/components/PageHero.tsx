import type { ReactNode } from 'react';
import Icon, { type IconName } from '@/components/Icon';
import styles from './PageHero.module.scss';

type Props = {
  icon: IconName;
  title: string;
  desc?: ReactNode;
  /** 제목 아래 작은 알약형 보조 설명 (예: 효율 정의) */
  note?: ReactNode;
  /** 우측 등에 둘 액션 (예: 버튼) */
  action?: ReactNode;
};

/** 모든 탭 상단 공통 비주얼 헤더 — 아이콘 배지 + 제목 + 설명. */
export default function PageHero({ icon, title, desc, note, action }: Props) {
  return (
    <header className={styles.hero}>
      <span className={styles.heroIcon}>
        <Icon name={icon} size={28} />
      </span>
      <div className={styles.heroText}>
        <h2 className={styles.heroTitle}>{title}</h2>
        {desc && <p className={styles.heroDesc}>{desc}</p>}
        {note && <span className={styles.heroNote}>{note}</span>}
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
