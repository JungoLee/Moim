'use client';

import { useEffect, useRef } from 'react';
import type { KeyboardEvent } from 'react';

// 인증코드 6칸 입력 — 한 칸에 한 글자(영문 대소문자·숫자).
// 붙여넣기는 한 번에 채우고, 방향키·백스페이스로 칸을 옮긴다.
// 화면으로 돌아왔을 때 클립보드에 코드 모양 문자열이 있으면 자동으로 채운다
// (브라우저가 읽기를 막으면 조용히 넘어간다 — Ctrl+V 는 언제나 동작한다).
export const CODE_LEN = 6;
const CODE_RE = /^[A-Za-z0-9]{6}$/;

type Props = {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  disabled?: boolean;
};

export default function CodeBoxes({ value, onChange, onComplete, disabled }: Props) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const focusAt = (i: number) => refs.current[Math.max(0, Math.min(CODE_LEN - 1, i))]?.focus();

  const put = (from: number, text: string) => {
    const add = text.replace(/[^A-Za-z0-9]/g, '');
    if (!add) return;
    const arr = value.split('');
    for (let k = 0; k < add.length && from + k < CODE_LEN; k++) arr[from + k] = add[k];
    const next = arr.join('').slice(0, CODE_LEN);
    onChange(next);
    focusAt(from + add.length);
    if (next.length === CODE_LEN) onComplete?.(next);
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

  // 클립보드에 코드가 있으면 돌아올 때 채운다 — 메일에서 복사해 온 경우
  useEffect(() => {
    if (disabled) return undefined;
    const fromClipboard = async () => {
      if (value) return;
      try {
        const text = (await navigator.clipboard.readText()).trim();
        if (CODE_RE.test(text)) {
          onChange(text);
          onComplete?.(text);
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

  return (
    <div
      className="app-code-boxes"
      role="group"
      aria-label="인증 코드 6자리"
      onPaste={(e) => { e.preventDefault(); put(0, e.clipboardData.getData('text')); }}
    >
      {Array.from({ length: CODE_LEN }, (_, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          className="app-code-box"
          value={value[i] || ''}
          onChange={(e) => put(i, e.target.value.slice(-1))}
          onKeyDown={onKeyDown(i)}
          onFocus={(e) => e.target.select()}
          disabled={disabled}
          maxLength={1}
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          autoCapitalize="off"
          spellCheck={false}
          aria-label={`${i + 1}번째 자리`}
          autoFocus={i === 0}
        />
      ))}
    </div>
  );
}
