'use client';

import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import Icon from './Icon';
import styles from './Accordion.module.scss';

type Props = {
  title: ReactNode;
  children: ReactNode;
  /** 처음부터 펼쳐둘지 */
  defaultOpen?: boolean;
  /** 헤더 우측 보조 텍스트/뱃지 */
  aside?: ReactNode;
};

/** 부드럽게 열리고 닫히는 접기 섹션 (grid-rows 0fr↔1fr 트랜지션). */
export default function Accordion({ title, children, defaultOpen = false, aside }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  return (
    <div className={styles.acc}>
      <button
        type="button"
        className={styles.head}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.chevron} data-open={open} aria-hidden>
          <Icon name="chevron" size={20} />
        </span>
        <span className={styles.title}>{title}</span>
        {aside != null && <span className={styles.aside}>{aside}</span>}
      </button>
      <div className={styles.panel} data-open={open} id={panelId} role="region">
        <div className={styles.panelInner}>{children}</div>
      </div>
    </div>
  );
}
