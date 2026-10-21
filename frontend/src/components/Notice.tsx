import type { ReactNode } from 'react';
import Icon from '@/components/Icon';
import styles from './Notice.module.scss';

type Props = {
  /** true = 성공, false = 오류(기본) */
  ok?: boolean;
  /** 막지 않는 주의 — 노란 바탕 */
  warn?: boolean;
  children: ReactNode;
};

/** 폼 아래 한 줄 알림 — 입력칸 바로 아래에 둔다. 오류는 읽기 프로그램이 바로 읽도록 role=alert */
export default function Notice({ ok = false, warn = false, children }: Props) {
  return (
    <p className={ok ? `${styles.notice} ${styles.ok}` : warn ? `${styles.notice} ${styles.warn}` : styles.notice} role={ok || warn ? 'status' : 'alert'}>
      <Icon name={ok ? 'check' : warn ? 'clock' : 'x'} size={16} stroke={2.4} />
      <span>{children}</span>
    </p>
  );
}
