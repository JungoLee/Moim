'use client';

import { useState } from 'react';
import type { CSSProperties } from 'react';

type Props = {
  /** 구글 프로필 이미지 URL (없거나 로드 실패 시 실루엣 폴백) */
  src?: string;
  alt?: string;
};

// 이미지 없음/깨짐일 때의 원형 실루엣 (크기/원형은 globals 의 .app-avatar-sm 가 담당)
const FALLBACK_STYLE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--color-surface-3)',
  color: 'var(--color-muted)',
};

function Fallback() {
  return (
    <span className="app-avatar-sm" style={FALLBACK_STYLE} aria-hidden>
      <svg width="62%" height="62%" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="12" cy="8" r="3.6" />
        <path d="M12 13.2c-3.8 0-6.8 1.9-6.8 4.3V19h13.6v-1.5c0-2.4-3-4.3-6.8-4.3z" />
      </svg>
    </span>
  );
}

/** 원형 아바타(28px) — 구글 프로필 이미지가 있으면 표시, 없거나 로드 실패 시 실루엣 폴백 */
export default function Avatar({ src, alt = '' }: Props) {
  const [errored, setErrored] = useState(false);

  if (src && !errored) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        className="app-avatar-sm"
        referrerPolicy="no-referrer"
        onError={() => setErrored(true)}
      />
    );
  }
  return <Fallback />;
}
