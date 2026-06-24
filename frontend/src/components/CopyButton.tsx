'use client';

import { useState } from 'react';
import { copyToClipboard } from '@/lib/clipboard';

type Props = {
  text: string;
  label?: string;
  /** 아이콘 버튼으로 표시 (🔗). 텍스트 대신 아이콘 + title */
  icon?: boolean;
  /** 아이콘 모드의 접근성 라벨/툴팁 */
  title?: string;
};

export default function CopyButton({ text, label = '복사', icon = false, title }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await copyToClipboard(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (icon) {
    return (
      <button
        type="button"
        className="app-btn app-btn--ghost app-icon-btn"
        onClick={copy}
        title={title || label}
        aria-label={title || label}
      >
        {copied ? '✓' : '🔗'}
      </button>
    );
  }

  return (
    <button type="button" className="app-btn app-btn--ghost" onClick={copy}>
      {copied ? '✓ 복사됨' : label}
    </button>
  );
}
