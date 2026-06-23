'use client';

import { useEffect, useRef, useState } from 'react';

export type SelectOption = { value: string; label: string };

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  ariaLabel?: string;
};

/** 네이티브 select 를 대체하는 커스텀 드롭다운 (앱 디자인 토큰 사용). */
export default function Select({ value, onChange, options, placeholder = '선택', ariaLabel }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div className="app-dropdown" ref={ref}>
      <button
        type="button"
        className="app-input app-dropdown-btn"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <span className={selected ? 'app-dropdown-value' : 'app-dropdown-value app-muted'}>
          {selected ? selected.label : placeholder}
        </span>
        <svg
          className="app-dropdown-caret"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <ul className="app-dropdown-menu" role="listbox">
          {options.length === 0 && <li className="app-dropdown-empty">선택할 항목이 없습니다</li>}
          {options.map((o) => (
            <li key={o.value} role="option" aria-selected={o.value === value}>
              <button
                type="button"
                className={o.value === value ? 'app-dropdown-item is-on' : 'app-dropdown-item'}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
