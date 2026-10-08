import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { NOINDEX } from '@/lib/seo';

// 타인 프로필/캘린더 — 개인정보라 절대 색인 금지
export const metadata: Metadata = { title: '친구 캘린더', ...NOINDEX };

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
