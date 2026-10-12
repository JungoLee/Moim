'use client';

import { useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import { copyToClipboard } from '@/lib/clipboard';
import { canNativeShare, shareOrCopy } from '@/lib/share';

type Props = {
  text: string;
  label?: string;
  /** 아이콘만 (링크 모양) — label 은 접근성 이름·툴팁으로 */
  icon?: boolean;
  /** 아이콘 모드의 접근성 이름 */
  title?: string;
  size?: 'sm' | 'md';
  /** 링크 공유용 — 휴대폰·태블릿에서는 '공유하기'(시스템 공유창), PC 는 그대로 복사 */
  share?: boolean;
  /** share 일 때 공유창에 넘길 제목 */
  shareTitle?: string;
};

export default function CopyButton({ text, label = '복사', icon = false, title, size = 'sm', share = false, shareTitle }: Props) {
  const [copied, setCopied] = useState(false);
  // 공유창 가능 여부는 마운트 뒤에 정한다(정적 렌더·hydration 불일치 방지)
  const [native, setNative] = useState(false);
  useEffect(() => {
    if (share) setNative(canNativeShare());
  }, [share]);

  async function copy() {
    if (share && native) {
      const result = await shareOrCopy({ url: text, title: shareTitle });
      if (result !== 'copied') return; // 공유창을 썼거나 닫음 — '복사됨' 표시 안 함
    } else {
      await copyToClipboard(text);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const shareMode = share && native;
  const sz = size === 'sm' ? ' ui-btn--sm' : '';
  if (icon) {
    const name = shareMode ? '공유하기' : title || label;
    return (
      <button type="button" className={`ui-btn ui-btn--ghost ui-btn--icon${sz}`} onClick={copy} title={name} aria-label={name}>
        <Icon name={copied ? 'check' : shareMode ? 'share' : 'link'} size={16} />
      </button>
    );
  }
  return (
    <button type="button" className={`ui-btn${sz}`} onClick={copy}>
      <Icon name={copied ? 'check' : shareMode ? 'share' : 'copy'} size={16} />
      {copied ? '복사됨' : shareMode ? '공유하기' : label}
    </button>
  );
}
