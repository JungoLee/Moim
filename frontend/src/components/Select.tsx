'use client';

import { useRef, useState } from 'react';
import Icon from '@/components/Icon';
import { useOutsideClose } from '@/lib/useOutsideClose';
import { useEscClose } from '@/lib/useEscClose';
import styles from './Select.module.scss';

type SelectOption = { value: string; label: string };

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  ariaLabel?: string;
};

/** 네이티브 select 를 대신하는 드롭다운 (토큰 사용) */
export default function Select({ value, onChange, options, placeholder = '선택', ariaLabel }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useOutsideClose(ref, open, () => setOpen(false));
  useEscClose(() => setOpen(false), open);

  const selected = options.find((o) => o.value === value);

  return (
    <div className={styles.wrap} ref={ref}>
      <button
        type="button"
        className={`ui-input ${styles.btn}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <span className={selected ? styles.value : `${styles.value} ui-muted`}>{selected ? selected.label : placeholder}</span>
        <Icon name="chevron-down" size={16} />
      </button>
      {open && (
        <ul className={styles.menu} role="listbox" aria-label={ariaLabel}>
          {options.length === 0 && <li className={styles.empty}>고를 항목이 없어요</li>}
          {options.map((o) => (
            <li key={o.value} role="option" aria-selected={o.value === value}>
              <button
                type="button"
                className={styles.item}
                aria-pressed={o.value === value}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                {o.label}
                {o.value === value && <Icon name="check" size={16} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
