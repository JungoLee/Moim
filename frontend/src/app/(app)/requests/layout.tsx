import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { NOINDEX } from '@/lib/seo';

export const metadata: Metadata = { title: '시간 요청', ...NOINDEX };

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
