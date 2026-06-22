'use client';

import { useEffect, useState } from 'react';
import { subscribe, type ToastItem } from '@/lib/toast';
import styles from './Toaster.module.scss';

export default function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => subscribe(setItems), []);

  return (
    <div className={styles.wrap} aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`${styles.toast} ${styles[t.type]}`}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}
