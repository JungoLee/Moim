'use client';

import { useEffect, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import styles from './CodeBoxes.module.scss';

// 인증코드 6칸 입력(길이는 length 로 바꿀 수 있다 — 모임 초대 코드는 8칸·대문자) — 한 칸에 한 글자(영문·숫자).
// 붙여넣기·OS 자동완성은 한 번에 여러 글자가 들어오므로 put() 이 칸에 나눠 담는다.
// ⚠️ maxLength=1 을 주면 안 된다 — OS 자동완성이 첫 글자만 남고 잘린다. 길이는 put() 이 자른다.
export const CODE_LEN = 6;

type Props = {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  disabled?: boolean;
  /** 칸 수 (기본 6) */
  length?: number;
  /** 입력을 대문자로 바꿔 담는다 (기본: 그대로) */
  uppercase?: boolean;
  /** 읽기 프로그램용 이름 (기본: '인증 코드 N자리') */
  label?: string;
};

export default function CodeBoxes({ value, onChange, onComplete, disabled, length = CODE_LEN, uppercase = false, label }: Props) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const focusAt = (i: number) => refs.current[Math.max(0, Math.min(length - 1, i))]?.focus();
  const codeRe = new RegExp(`^[A-Za-z0-9]{${length}}$`);

  const put = (from: number, text: string) => {
    let add = text.replace(/[^A-Za-z0-9]/g, '');
    if (uppercase) add = add.toUpperCase();
    if (!add) return;
    const arr = value.split('');
    for (let k = 0; k < add.length && from + k < length; k++) arr[from + k] = add[k];
    const next = arr.join('').slice(0, length);
    onChange(next);
    focusAt(from + add.length);
    if (next.length === length) onComplete?.(next);
  };

  const onKeyDown = (i: number) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (value[i]) onChange(value.slice(0, i) + value.slice(i + 1));
      else if (i > 0) {
        onChange(value.slice(0, i - 1) + value.slice(i));
        focusAt(i - 1);
      }
      return;
    }
    if (e.key === 'ArrowLeft') { e.preventDefault(); focusAt(i - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); focusAt(i + 1); }
  };

  // 데스크톱에서만 통하는 자동 채움 — 화면으로 돌아올 때 클립보드가 코드 모양이면 넣는다.
  // 모바일 브라우저는 사용자 동작 없이 클립보드를 읽지 못해 조용히 실패한다(그래서 아래 버튼이 있다).
  useEffect(() => {
    if (disabled) return undefined;
    const fromClipboard = async () => {
      if (value) return;
      try {
        const text = (await navigator.clipboard.readText()).trim();
        if (codeRe.test(text)) {
          const v = uppercase ? text.toUpperCase() : text;
          onChange(v);
          onComplete?.(v);
        }
      } catch {
        // 읽기 권한이 없으면 그냥 넘어간다
      }
    };
    void fromClipboard();
    const onBack = () => { if (document.visibilityState === 'visible') void fromClipboard(); };
    document.addEventListener('visibilitychange', onBack);
    window.addEventListener('focus', onBack);
    return () => {
      document.removeEventListener('visibilitychange', onBack);
      window.removeEventListener('focus', onBack);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, disabled]);

  // 버튼 안에서 읽으면 사용자 동작으로 인정돼 모바일에서도 통한다
  const pasteFromClipboard = async () => {
    try {
      put(0, (await navigator.clipboard.readText()).trim());
    } catch {
      // 지원하지 않거나 거부되면 아무 일도 하지 않는다 — 직접 입력으로 대체
    }
  };

  return (
    <div className={styles.wrap}>
      <div
        className={length > CODE_LEN ? `${styles.boxes} ${styles.dense}` : styles.boxes}
        role="group"
        aria-label={label || `인증 코드 ${length}자리`}
        onPaste={(e) => { e.preventDefault(); put(0, e.clipboardData.getData('text')); }}
      >
        {Array.from({ length }, (_, i) => (
          <input
            key={i}
            ref={(el) => { refs.current[i] = el; }}
            className={styles.box}
            value={value[i] || ''}
            onChange={(e) => put(i, e.target.value)}
            onKeyDown={onKeyDown(i)}
            onFocus={(e) => e.target.select()}
            disabled={disabled}
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            autoCapitalize="off"
            spellCheck={false}
            aria-label={`${i + 1} / ${length}`}
            autoFocus={i === 0}
          />
        ))}
      </div>
      {!value && (
        <button type="button" className={styles.paste} onClick={() => void pasteFromClipboard()}>
          복사한 코드 붙여넣기
        </button>
      )}
    </div>
  );
}
