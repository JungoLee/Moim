import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { NOINDEX } from '@/lib/seo';

// 로그인 뒤 화면 — 크롤러에겐 빈 껍데기라 색인하지 않는다
export const metadata: Metadata = { title: '홈', ...NOINDEX };

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
