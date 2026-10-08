import type { ReactNode } from 'react';
import Icon from '@/components/Icon';
import styles from './Notice.module.scss';

type Props = {
  /** true = 성공, false = 오류(기본) */
  ok?: boolean;
  children: ReactNode;
};

/** 폼 아래 한 줄 알림 — 입력칸 바로 아래에 둔다. 오류는 읽기 프로그램이 바로 읽도록 role=alert */
export default function Notice({ ok = false, children }: Props) {
  return (
    <p className={ok ? `${styles.notice} ${styles.ok}` : styles.notice} role={ok ? 'status' : 'alert'}>
      <Icon name={ok ? 'check' : 'x'} size={16} stroke={2.4} />
      <span>{children}</span>
    </p>
  );
}
