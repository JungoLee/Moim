'use client';

import { useEffect } from 'react';
import type { CSSProperties } from 'react';
import { ADSENSE_CLIENT } from '@/lib/adsense';

declare global {
  interface Window {
    adsbygoogle?: Record<string, unknown>[];
  }
}

type Props = {
  /** 광고 단위 슬롯 ID (data-ad-slot) — 애드센스 대시보드에서 광고 단위 생성 시 발급 */
  slot: string;
  /** 광고 형식 — 기본 'auto'(반응형) */
  format?: string;
  /** 전체 너비 반응형 여부 — 기본 true */
  responsive?: boolean;
  style?: CSSProperties;
  className?: string;
};

/** 수동 배치용 광고 단위. 게시자 ID(NEXT_PUBLIC_ADSENSE_CLIENT) 미설정 시 아무것도 렌더하지 않는다. */
export default function AdUnit({ slot, format = 'auto', responsive = true, style, className }: Props) {
  useEffect(() => {
    if (!ADSENSE_CLIENT) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      /* 광고 로드 실패는 무시 */
    }
  }, []);

  if (!ADSENSE_CLIENT) return null;

  return (
    <ins
      className={['adsbygoogle', className].filter(Boolean).join(' ')}
      style={{ display: 'block', ...style }}
      data-ad-client={ADSENSE_CLIENT}
      data-ad-slot={slot}
      data-ad-format={format}
      data-full-width-responsive={responsive ? 'true' : 'false'}
    />
  );
}
