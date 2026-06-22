'use client';

import { useState } from 'react';

type Props = {
  text: string;
  label?: string;
};

export default function CopyButton({ text, label = '복사' }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // 클립보드 API 불가(비보안 컨텍스트 등) → 폴백
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch {
        /* 무시 */
      }
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button type="button" className="app-btn app-btn--ghost" onClick={copy}>
      {copied ? '✓ 복사됨' : label}
    </button>
  );
}
