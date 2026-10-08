'use client';

import { useState } from 'react';
import Icon from '@/components/Icon';
import { copyToClipboard } from '@/lib/clipboard';

type Props = {
  text: string;
  label?: string;
  /** 아이콘만 (링크 모양) — label 은 접근성 이름·툴팁으로 */
  icon?: boolean;
  /** 아이콘 모드의 접근성 이름 */
  title?: string;
  size?: 'sm' | 'md';
};

export default function CopyButton({ text, label = '복사', icon = false, title, size = 'sm' }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await copyToClipboard(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const sz = size === 'sm' ? ' ui-btn--sm' : '';
  if (icon) {
    return (
      <button type="button" className={`ui-btn ui-btn--ghost ui-btn--icon${sz}`} onClick={copy} title={title || label} aria-label={title || label}>
        <Icon name={copied ? 'check' : 'link'} size={16} />
      </button>
    );
  }
  return (
    <button type="button" className={`ui-btn${sz}`} onClick={copy}>
      <Icon name={copied ? 'check' : 'copy'} size={16} />
      {copied ? '복사됨' : label}
    </button>
  );
}
