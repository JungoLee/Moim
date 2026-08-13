import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { NOINDEX } from '@/lib/seo';

// 로그인 콜백 — 토큰이 쿼리로 오는 경유 페이지
export const metadata: Metadata = { title: '로그인 중', ...NOINDEX };

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
