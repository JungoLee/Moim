'use client';

import { useState } from 'react';
import { avatarColor, initialOf } from '@/lib/avatar';

type Props = {
  /** 구글 프로필 사진 URL — 없거나 깨지면 첫 글자 원 */
  src?: string;
  /** 사람 이름(닉네임 우선) — 첫 글자와 대체 글에 쓴다 */
  name?: string;
  /** 색을 고정할 사람 id (없으면 이름으로) */
  id?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const SIZE_CLASS = { sm: 'ui-avatar ui-avatar--sm', md: 'ui-avatar', lg: 'ui-avatar ui-avatar--lg' };

/** 원형 아바타 — 사진이 있으면 사진, 없거나 실패하면 이름 첫 글자 + 사람마다 정해진 파스텔 색 */
export default function Avatar({ src, name = '', id, size = 'md', className }: Props) {
  const [errored, setErrored] = useState(false);
  const cls = className ? `${SIZE_CLASS[size]} ${className}` : SIZE_CLASS[size];

  if (src && !errored) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={name} className={cls} referrerPolicy="no-referrer" onError={() => setErrored(true)} />
    );
  }
  return (
    // 파스텔 바탕색은 사람마다 달라 데이터로 정해지는 값 — 인라인 허용(설계 문서 1장)
    <span className={cls} style={{ background: avatarColor(id || name) }} role="img" aria-label={name || undefined}>
      {initialOf(name)}
    </span>
  );
}
